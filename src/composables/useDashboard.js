import { ref } from "vue"
import { db } from "@/firebase"
import { collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore"
import { applyAutoSubscribe, getOpenInvoices } from "@/services/paymentService"
import { canGenerateInvoice } from "@/utils/billingRules"

export function useDashboard() {
  const summary = ref(null)
  const unpaidList = ref([])
  const loading = ref(false)
  const error = ref(null)
  const recentPayments = ref([])

  const loadDashboard = async (month) => {
    loading.value = true
    error.value = null

    try {
      // 1️⃣ ambil semua clients
      const clientsSnap = await getDocs(collection(db, "customers"))
      const clientMap = {}

      clientsSnap.forEach(doc => {
        const clientData = doc.data()
        clientMap[doc.id] = clientData.name
      })

      // 2️⃣ ambil invoices bulan ini (dengan fallback jika query gagal atau index belum ada)
      let snapshot = { docs: [] }
      try {
        const q = query(
          collection(db, "invoices"),
          where("month", "==", month)
        )
        snapshot = await getDocs(q)
      } catch (err) {
        console.warn("Falling back to client-side filter for month invoices:", err)
        const allInvSnap = await getDocs(collection(db, "invoices"))
        snapshot = {
          docs: allInvSnap.docs.filter(doc => doc.data().month === month)
        }
      }

      let totalInvoice = 0
      let paidCount = 0
      let partialCount = 0
      let unpaidCount = 0
      let totalRevenue = 0
      let totalOutstandingMonth = 0
      let totalBillableAmount = 0

      let debtList = []

      snapshot.forEach(doc => {
        const data = doc.data()
        totalInvoice++

        const outstanding = (data.amount || 0) - (data.paid_amount || 0)
        totalBillableAmount += data.amount || 0

        if (data.status === "paid") {
          paidCount++
          totalRevenue += data.paid_amount || 0
        }

        if (data.status === "partial") {
          partialCount++
          totalRevenue += data.paid_amount || 0
          totalOutstandingMonth += outstanding

          debtList.push({
            id: doc.id,
            ...data,
            total_outstanding: outstanding
          })
        }

        if (data.status === "unpaid") {
          unpaidCount++
          totalOutstandingMonth += outstanding

          debtList.push({
            id: doc.id,
            ...data,
            total_outstanding: outstanding
          })
        }
      })

      // 3️⃣ Hitung Kewajiban ISP Pusat, Hutang Material, & Operasional Lokal
      // Format month: "YYYY-MM"
      const expensesSnap = await getDocs(collection(db, "expenses"))
      let totalOtherExpensesMonth = 0
      let totalIspBillExpensesMonth = 0
      let ispExpenseList = []
      let isIspSharePaid = false

      expensesSnap.forEach(doc => {
        const d = doc.data()
        const date = typeof d.date?.toDate === "function"
          ? d.date.toDate()
          : (d.date ? new Date(d.date) : null)

        if (date && !isNaN(date)) {
          const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          if (itemMonth === month) {
            const amt = Number(d.amount) || 0
            if (d.category === "Setoran Bagi Hasil ISP") {
              isIspSharePaid = true
            }

            if (d.is_isp_bill) {
              // Hanya masukkan ke list jika BELUM dibayar
              if (!d.is_paid) {
                totalIspBillExpensesMonth += amt
                ispExpenseList.push({
                  id: doc.id,
                  description: d.description || "Pengeluaran ISP",
                  category: d.category || "Pengeluaran",
                  amount: amt,
                  date: date
                })
              }
            } else {
              totalOtherExpensesMonth += amt
            }
          }
        }
      })

      // Hitung sisa hutang material/perangkat dari koleksi payables
      const payablesSnap = await getDocs(collection(db, "payables"))
      let totalUnpaidPayables = 0
      let unpaidPayableList = []

      payablesSnap.forEach(doc => {
        const d = doc.data()
        const amount = Number(d.amount) || 0
        const paidAmount = Number(d.paid_amount) || 0
        const remaining = amount - paidAmount
        if (remaining > 0) {
          totalUnpaidPayables += remaining
          unpaidPayableList.push({
            id: doc.id,
            supplier_name: d.supplier_name || "ISP Pusat",
            description: d.description || "Hutang Material/Perangkat",
            amount: amount,
            paid_amount: paidAmount,
            remaining_amount: remaining,
            due_date: d.due_date
          })
        }
      })

      const baseIspShare = isIspSharePaid ? 0 : Math.round(totalBillableAmount / 2)
      const totalIspObligation = baseIspShare + totalIspBillExpensesMonth

      // Query total piutang semua bulan (dengan fallback jika index status != paid belum ada)
      let unpaidAllDocs = []
      try {
        const unpaidAllQuery = query(
          collection(db, "invoices"),
          where("status", "!=", "paid")
        )
        const unpaidAllSnap = await getDocs(unpaidAllQuery)
        unpaidAllDocs = unpaidAllSnap.docs.map(doc => doc.data())
      } catch (err) {
        console.warn("Falling back to client-side filter for unpaid invoices:", err)
        const allInvSnap = await getDocs(collection(db, "invoices"))
        unpaidAllDocs = allInvSnap.docs
          .map(doc => doc.data())
          .filter(d => d.status !== "paid")
      }

      const debtMap = {}
      let totalOutstandingAll = 0

      unpaidAllDocs.forEach(data => {
        const customerId = data.customer_id
        const outstanding = (Number(data.amount) || 0) - (Number(data.paid_amount) || 0)

        if (!debtMap[customerId]) {
          debtMap[customerId] = 0
        }

        debtMap[customerId] += outstanding
        totalOutstandingAll += outstanding
      })

      debtList = debtList.map(item => {
        const totalCustomerDebt = debtMap[item.customer_id]

        if (totalCustomerDebt !== undefined) {
          return {
            ...item,
            total_outstanding: totalCustomerDebt
          }
        }

        return item
      })

      // Query 5 pembayaran terbaru (dengan fallback jika index created_at belum ada)
      let recent = []
      try {
        const recentQuery = query(
          collection(db, "payments"),
          orderBy("created_at", "desc"),
          limit(5)
        )
        const recentSnap = await getDocs(recentQuery)
        recentSnap.forEach(doc => {
          recent.push({ id: doc.id, ...doc.data() })
        })
      } catch (err) {
        console.warn("Falling back to client-side sort for recent payments:", err)
        try {
          const allPaymentsSnap = await getDocs(collection(db, "payments"))
          allPaymentsSnap.forEach(doc => {
            recent.push({ id: doc.id, ...doc.data() })
          })
          recent.sort((a, b) => {
            const timeA = a.created_at?.seconds || (a.created_at ? new Date(a.created_at).getTime() : 0)
            const timeB = b.created_at?.seconds || (b.created_at ? new Date(b.created_at).getTime() : 0)
            return timeB - timeA
          })
        } catch (e) {
          console.error("Failed to fetch payments:", e)
        }
      }

      recentPayments.value = recent.slice(0, 5)

      summary.value = {
        totalInvoice,
        paidCount,
        partialCount,
        unpaidCount,
        totalRevenue,
        totalOutstandingMonth,
        totalOutstandingAll,
        totalBillableAmount,
        baseIspShare,
        totalIspBillExpensesMonth,
        ispExpenseList,
        isIspSharePaid,
        ispObligation: totalIspObligation,
        totalUnpaidPayables,
        unpaidPayableList,
        grandTotalIspObligation: totalIspObligation + totalUnpaidPayables,
        otherExpenses: totalOtherExpensesMonth
      }

      unpaidList.value = debtList
    } catch (err) {
      console.error("Failed to load dashboard:", err)
      error.value = err.message || "Gagal memuat data dashboard"
    } finally {
      loading.value = false
    }
  }

  const ensureMonthlyInvoices = async (month) => {
    try {
      // 1️⃣ Ambil semua customer
      const customerSnap = await getDocs(collection(db, "customers"))

      // 2️⃣ Ambil semua invoice bulan ini
      const invoiceSnap = await getDocs(
        query(
          collection(db, "invoices"),
          where("month", "==", month)
        )
      )

      // Buat set customer_id yang sudah punya invoice
      const existingCustomerIds = new Set()
      invoiceSnap.forEach(doc => {
        existingCustomerIds.add(doc.data().customer_id)
      })

      for (const docSnap of customerSnap.docs) {
        try {
          const customer = docSnap.data()
          const customerId = docSnap.id

          // Skip jika sudah ada invoice bulan ini
          if (existingCustomerIds.has(customerId)) continue

          if (!canGenerateInvoice(customer, month)) continue

          // =============================
          // Buat invoice bulan ini
          // =============================
          await addDoc(collection(db, "invoices"), {
            customer_id: customerId,
            customer_name: customer.name,
            amount: Number(customer.custom_price),
            paid_amount: 0,
            status: "unpaid",
            auto_subscribed: false,
            month,
            created_at: serverTimestamp()
          })

          // =============================
          // 7️⃣ Full otomatis: cek saldo
          // =============================
          if ((customer.balance || 0) > 0) {
            const openInvoices = await getOpenInvoices(customerId)

            await applyAutoSubscribe(
              { id: customerId, ...customer },
              openInvoices
            )
          }
        } catch (err) {
          console.error(`Error generating invoice for customer ${docSnap.id}:`, err)
        }
      }
    } catch (err) {
      console.error("Error in ensureMonthlyInvoices:", err)
    }
  }

  return {
    summary,
    unpaidList,
    loading,
    error,
    loadDashboard,
    recentPayments,
    ensureMonthlyInvoices,
  }
}

