import { ref } from "vue"
import { db } from "@/firebase"
import { collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore"
import { applyAutoSubscribe, getOpenInvoices } from "@/services/paymentService"
import { canGenerateInvoice } from "@/utils/billingRules"

export function useDashboard() {
  const summary = ref(null)
  const unpaidList = ref([])
  const loading = ref(false)
  const recentPayments = ref([])

  const loadDashboard = async (month) => {
    loading.value = true

    // 1️⃣ ambil semua clients
    const clientsSnap = await getDocs(collection(db, "customers"))
    const clientMap = {}

    clientsSnap.forEach(doc => {
      const clientData = doc.data()

      clientMap[doc.id] = clientData.name
    })

    // 2️⃣ ambil invoices bulan ini
    const q = query(
      collection(db, "invoices"),
      where("month", "==", month)
    )

    const snapshot = await getDocs(q)

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

    // Query total piutang semua bulan
    const unpaidAllQuery = query(
      collection(db, "invoices"),
      where("status", "!=", "paid")
    )

    const unpaidAllSnap = await getDocs(unpaidAllQuery)

    const debtMap = {}

    let totalOutstandingAll = 0

    unpaidAllSnap.forEach(doc => {
      const data = doc.data()
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

    // Query 5 pembayaran terbaru
    const recentQuery = query(
      collection(db, "payments"),
      orderBy("created_at", "desc"),
      limit(5)
    )

    const recentSnap = await getDocs(recentQuery)

    let recent = []

    recentSnap.forEach(doc => {
      recent.push({ id: doc.id, ...doc.data() })
    })

    // urutkan manual karena belum pakai orderBy
    recent.sort((a, b) => b.created_at?.seconds - a.created_at?.seconds)

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
      ispCost: Math.round(totalBillableAmount / 2)
    }

    unpaidList.value = debtList
    loading.value = false
  }

  const ensureMonthlyInvoices = async (month) => {
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
    }
  }

  return {
    summary,
    unpaidList,
    loading,
    loadDashboard,
    recentPayments,
    ensureMonthlyInvoices,
  }
}
