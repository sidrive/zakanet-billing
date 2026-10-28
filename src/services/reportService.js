import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore"
import { db } from "../firebase"

function isIspShareExpense(d) {
  if (!d) return false
  if (d.is_isp_share) return true
  const cat = (d.category || "").toLowerCase()
  return cat.includes("bagi hasil") || cat === "setoran isp"
}

export async function getMonthSummary(month) {
  const [invoicesSnap, revenuesSnap, expensesSnap, payablesSnap] = await Promise.all([
    getDocs(query(collection(db, "invoices"), where("month", "==", month))),
    getDocs(collection(db, "revenues")),
    getDocs(collection(db, "expenses")),
    getDocs(collection(db, "payables"))
  ])

  let totalOmzet = 0
  let totalTerbayar = 0
  let autoCount = 0
  let total = 0

  invoicesSnap.forEach(doc => {
    const d = doc.data()
    totalOmzet += Number(d.amount) || 0
    totalTerbayar += Number(d.paid_amount) || 0
    if (d.auto_subscribed) autoCount++
    total++
  })

  // Pendapatan Lain bulan ini
  let totalRevenuesMonth = 0
  revenuesSnap.forEach(doc => {
    const d = doc.data()
    const date = d.date?.toDate ? d.date.toDate() : (d.date ? new Date(d.date) : null)
    if (date && !isNaN(date)) {
      const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (itemMonth === month) {
        totalRevenuesMonth += Number(d.amount) || 0
      }
    }
  })

  // Pengeluaran (dibagi: Tagihan ISP Pusat vs Operasional Lokal)
  let totalIspBillExpensesMonth = 0
  let totalLocalExpensesMonth = 0
  let isIspSharePaid = false

  expensesSnap.forEach(doc => {
    const d = doc.data()
    const date = d.date?.toDate ? d.date.toDate() : (d.date ? new Date(d.date) : null)
    if (date && !isNaN(date)) {
      const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (itemMonth === month) {
        const amt = Number(d.amount) || 0
        if (isIspShareExpense(d)) {
          isIspSharePaid = true
        }

        if (d.is_isp_bill) {
          totalIspBillExpensesMonth += amt
        } else {
          totalLocalExpensesMonth += amt
        }
      }
    }
  })

  // Sisa Hutang Material Vendor
  let totalPayablesMonth = 0
  payablesSnap.forEach(doc => {
    const d = doc.data()
    const remaining = (Number(d.amount) || 0) - (Number(d.paid_amount) || 0)
    if (remaining > 0) {
      totalPayablesMonth += remaining
    }
  })

  const baseIspShare = isIspSharePaid ? 0 : Math.round(totalOmzet / 2) // 50% bagi hasil dari total tagihan (kecuali sudah dibayar)
  const totalIspObligation = baseIspShare + totalIspBillExpensesMonth // 50% + tagihan teknisi
  const grandTotalIspObligation = totalIspObligation + totalPayablesMonth // termasuk sisa hutang barang/kabel

  const totalGrossRevenue = totalTerbayar + totalRevenuesMonth
  const totalAllCosts = totalIspObligation + totalLocalExpensesMonth
  const netProfit = totalGrossRevenue - totalAllCosts

  return {
    totalOmzet,
    totalTerbayar,
    totalPiutang: totalOmzet - totalTerbayar,
    autoPayRate: total > 0 ? Math.round((autoCount / total) * 100) : 0,
    totalRevenuesMonth,
    baseIspShare,
    totalIspBillExpensesMonth,
    totalIspObligation,
    totalPayablesMonth,
    grandTotalIspObligation,
    totalLocalExpensesMonth,
    totalGrossRevenue,
    totalAllCosts,
    netProfit
  }
}

export async function getIspSettlementDetails(month) {
  const [invoicesSnap, expensesSnap, payablesSnap] = await Promise.all([
    getDocs(query(collection(db, "invoices"), where("month", "==", month))),
    getDocs(collection(db, "expenses")),
    getDocs(collection(db, "payables"))
  ])

  let totalInvoiceAmount = 0
  let totalPaidInvoiceAmount = 0
  let isIspSharePaid = false

  invoicesSnap.forEach(doc => {
    const d = doc.data()
    totalInvoiceAmount += Number(d.amount) || 0
    totalPaidInvoiceAmount += Number(d.paid_amount) || 0
  })

  expensesSnap.forEach(doc => {
    const d = doc.data()
    const date = d.date?.toDate ? d.date.toDate() : (d.date ? new Date(d.date) : null)
    if (date && !isNaN(date)) {
      const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (itemMonth === month && isIspShareExpense(d)) {
        isIspSharePaid = true
      }
    }
  })

  const baseIspShare = isIspSharePaid ? 0 : Math.round(totalInvoiceAmount / 2)

  const ispTechExpenses = []
  expensesSnap.forEach(doc => {
    const d = doc.data()
    const date = d.date?.toDate ? d.date.toDate() : (d.date ? new Date(d.date) : null)
    if (date && !isNaN(date)) {
      const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (itemMonth === month && d.is_isp_bill) {
        ispTechExpenses.push({ id: doc.id, ...d, date })
      }
    }
  })

  const activePayables = []
  payablesSnap.forEach(doc => {
    const d = doc.data()
    const remaining = (Number(d.amount) || 0) - (Number(d.paid_amount) || 0)
    if (remaining > 0) {
      activePayables.push({ id: doc.id, ...d, remaining })
    }
  })

  return {
    baseIspShare,
    ispTechExpenses,
    activePayables
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

  const balanceMap = {}
  customersSnap.forEach(doc => {
    balanceMap[doc.id] = Number(doc.data().balance) || 0
  })

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
      const order = { paid: 0, partial: 1, unpaid: 2 }
      return (order[a.status] ?? 3) - (order[b.status] ?? 3)
    })
}
