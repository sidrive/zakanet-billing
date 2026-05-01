import { collection, getDocs, query, where, orderBy } from "firebase/firestore"
import { Timestamp } from "firebase/firestore"
import { db } from "../firebase"

export async function getMonthSummary(month) {
  const snap = await getDocs(query(collection(db, "invoices"), where("month", "==", month)))

  let totalOmzet = 0
  let totalTerbayar = 0
  let autoCount = 0
  let total = 0

  snap.forEach(doc => {
    const d = doc.data()
    totalOmzet += Number(d.amount) || 0
    totalTerbayar += Number(d.paid_amount) || 0
    if (d.auto_subscribed) autoCount++
    total++
  })

  return {
    totalOmzet,
    totalTerbayar,
    totalPiutang: totalOmzet - totalTerbayar,
    autoPayRate: total > 0 ? Math.round((autoCount / total) * 100) : 0
  }
}

export async function getDailyTrend(month) {
  const [year, monthNum] = month.split("-").map(Number)
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const start = new Date(year, monthNum - 1, 1, 0, 0, 0)
  const end = new Date(year, monthNum - 1, daysInMonth, 23, 59, 59)

  const q = query(
    collection(db, "payments"),
    where("created_at", ">=", Timestamp.fromDate(start)),
    where("created_at", "<=", Timestamp.fromDate(end)),
    orderBy("created_at", "asc")
  )

  const snap = await getDocs(q)
  const daily = Array(daysInMonth).fill(0)

  snap.forEach(doc => {
    const d = doc.data()
    const date = d.created_at?.toDate?.()
    if (date) {
      daily[date.getDate() - 1] += Number(d.amount) || 0
    }
  })

  return {
    data: daily,
    labels: Array.from({ length: daysInMonth }, (_, i) => String(i + 1))
  }
}

export async function getMonthlyTrend() {
  const last12 = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    last12.push(d.toISOString().slice(0, 7))
  }

  const snap = await getDocs(query(
    collection(db, "invoices"),
    where("month", "in", last12)
  ))

  const monthly = {}
  last12.forEach(m => (monthly[m] = 0))

  snap.forEach(doc => {
    const d = doc.data()
    if (monthly[d.month] !== undefined) {
      monthly[d.month] += Number(d.paid_amount) || 0
    }
  })

  return {
    data: last12.map(m => monthly[m]),
    labels: last12.map(m => {
      const [y, mo] = m.split("-")
      return new Date(Number(y), Number(mo) - 1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" })
    })
  }
}

export async function getPackageDistribution() {
  const [prodSnap, custSnap] = await Promise.all([
    getDocs(collection(db, "products")),
    getDocs(query(collection(db, "customers"), where("is_active", "==", true)))
  ])

  const priceMap = {}
  prodSnap.forEach(doc => {
    const d = doc.data()
    const price = Number(d.price)
    if (price) priceMap[price] = d.name
  })

  const dist = {}
  custSnap.forEach(doc => {
    const d = doc.data()
    const price = Number(d.custom_price)
    const label = priceMap[price] ?? "Lainnya"
    dist[label] = (dist[label] || 0) + 1
  })

  const total = Object.values(dist).reduce((a, b) => a + b, 0)
  return Object.entries(dist).map(([name, count]) => ({
    name,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0
  }))
}

export async function getTopDepositCustomers(n = 5) {
  const snap = await getDocs(collection(db, "customers"))
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(c => (c.balance || 0) > 0)
    .sort((a, b) => (b.balance || 0) - (a.balance || 0))
    .slice(0, n)
}

/**
 * Ambil detail invoice bulan tertentu, digabung dengan
 * data balance (customers) dan catatan pembayaran (payments).
 *
 * Auto-subscribed invoice tidak memiliki payment record karena
 * balance langsung dipotong tanpa transaksi manual.
 */
export async function getDetailedInvoices(month) {
  const [year, monthNum] = month.split("-").map(Number)
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const start = new Date(year, monthNum - 1, 1, 0, 0, 0)
  const end = new Date(year, monthNum - 1, daysInMonth, 23, 59, 59)

  const [invoicesSnap, customersSnap, paymentsSnap] = await Promise.all([
    getDocs(query(collection(db, "invoices"), where("month", "==", month))),
    getDocs(collection(db, "customers")),
    getDocs(query(
      collection(db, "payments"),
      where("created_at", ">=", Timestamp.fromDate(start)),
      where("created_at", "<=", Timestamp.fromDate(end)),
      orderBy("created_at", "desc")
    ))
  ])

  // Map: customer_id → balance
  const balanceMap = {}
  customersSnap.forEach(doc => {
    balanceMap[doc.id] = Number(doc.data().balance) || 0
  })

  // Map: customer_id → most recent payment note in month
  // (auto-subscribed invoices have no payment record — note stays "-")
  const noteMap = {}
  paymentsSnap.forEach(doc => {
    const d = doc.data()
    if (!noteMap[d.customer_id] && d.note) {
      noteMap[d.customer_id] = d.note
    }
  })

  return invoicesSnap.docs
    .map(doc => {
      const d = doc.data()
      const outstanding = (Number(d.amount) || 0) - (Number(d.paid_amount) || 0)
      return {
        id: doc.id,
        customer_id: d.customer_id,
        customer_name: d.customer_name,
        month: d.month,
        amount: Number(d.amount) || 0,
        paid_amount: Number(d.paid_amount) || 0,
        outstanding: outstanding < 0 ? 0 : outstanding,
        status: d.status,
        auto_subscribed: d.auto_subscribed ?? false,
        paid_at: d.paid_at ?? null,
        balance: balanceMap[d.customer_id] ?? 0,
        note: d.auto_subscribed ? "-" : (noteMap[d.customer_id] ?? "-")
      }
    })
    .sort((a, b) => {
      // paid first, then partial, then unpaid
      const order = { paid: 0, partial: 1, unpaid: 2 }
      return (order[a.status] ?? 3) - (order[b.status] ?? 3)
    })
}
