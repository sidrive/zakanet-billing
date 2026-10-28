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
      let clientsSnap = { docs: [] }
      try {
        clientsSnap = await getDocs(collection(db, "customers"))
      } catch (e) {
        console.warn("Error fetching customers:", e)
      }

      const clientMap = {}
      clientsSnap.docs.forEach(doc => {
        const clientData = doc.data()
        clientMap[doc.id] = clientData.name
      })

      // 2️⃣ ambil invoices bulan ini (dengan fallback jika query gagal)
      let snapshot = { docs: [] }
      try {
        const q = query(
          collection(db, "invoices"),
          where("month", "==", month)
        )
        snapshot = await getDocs(q)
      } catch (err) {
        console.warn("Falling back to client-side filter for month invoices:", err)
        try {
          const allInvSnap = await getDocs(collection(db, "invoices"))
          snapshot = {
            docs: allInvSnap.docs.filter(doc => doc.data().month === month)
          }
        } catch (e) {
          console.warn("Error fetching all invoices:", e)
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

      snapshot.docs.forEach(doc => {
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
      let expensesSnap = { docs: [] }
      try {
        expensesSnap = await getDocs(collection(db, "expenses"))
      } catch (e) {
        console.warn("Error fetching expenses:", e)
      }

      let totalOtherExpensesMonth = 0
      let totalIspBillExpensesMonth = 0
      let ispExpenseList = []
      let isIspSharePaid = false

      expensesSnap.docs.forEach(doc => {
        const d = doc.data()
        let date = null
        if (d.date) {
          if (typeof d.date.toDate === "function") {
            date = d.date.toDate()
          } else if (d.date.seconds) {
            date = new Date(d.date.seconds * 1000)
          } else {
            date = new Date(d.date)
          }
        }

        if (date && !isNaN(date.getTime())) {
          const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          if (itemMonth === month) {
            const amt = Number(d.amount) || 0
            if (d.category === "Setoran Bagi Hasil ISP" || d.is_isp_share || (d.category || "").toLowerCase().includes("bagi hasil")) {
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
      let payablesSnap = { docs: [] }
      try {
        payablesSnap = await getDocs(collection(db, "payables"))
      } catch (e) {
        console.warn("Error fetching payables:", e)
      }

      let totalUnpaidPayables = 0
      let unpaidPayableList = []

      payablesSnap.docs.forEach(doc => {
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
        try {
          const allInvSnap = await getDocs(collection(db, "invoices"))
          unpaidAllDocs = allInvSnap.docs
            .map(doc => doc.data())
            .filter(d => d.status !== "paid")
        } catch (e) {
          console.warn("Error fetching all invoices:", e)
        }
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
        recentSnap.docs.forEach(doc => {
          recent.push({ id: doc.id, ...doc.data() })
        })
      } catch (err) {
        console.warn("Falling back to client-side sort for recent payments:", err)
        try {
          const allPaymentsSnap = await getDocs(collection(db, "payments"))
          allPaymentsSnap.docs.forEach(doc => {
            recent.push({ id: doc.id, ...doc.data() })
          })
          recent.sort((a, b) => {
            const getTime = (item) => {
              if (!item?.created_at) return 0
              if (typeof item.created_at.toDate === "function") return item.created_at.toDate().getTime()
              if (item.created_at.seconds) return item.created_at.seconds * 1000
              const d = new Date(item.created_at)
              return isNaN(d.getTime()) ? 0 : d.getTime()
            }
            return getTime(b) - getTime(a)
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
      let invoiceSnap = { docs: [] }
      try {
        invoiceSnap = await getDocs(
          query(
            collection(db, "invoices"),
            where("month", "==", month)
          )
        )
      } catch (e) {
        const allSnap = await getDocs(collection(db, "invoices"))
        invoiceSnap = {
          docs: allSnap.docs.filter(d => d.data().month === month)
        }
      }

      // Buat set customer_id yang sudah punya invoice
      const existingCustomerIds = new Set()
      invoiceSnap.docs.forEach(doc => {
        existingCustomerIds.add(doc.data().customer_id)
      })

      let generatedAny = false

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

          generatedAny = true

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

      if (generatedAny) {
        await loadDashboard(month)
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


