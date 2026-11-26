// ============================================================
// Helper murni (tanpa Firebase) untuk modul
// "Laporan Pembayaran per Pelanggan".
//
// Dipisah dari service supaya:
// - agregasi data tidak diduplikasi di view / composable
// - gampang diuji tanpa koneksi Firestore
//
// Sumber data: collection `invoices` (1 dokumen = 1 tagihan bulanan
// per pelanggan) + collection `customers` untuk identitas & join_date.
// ============================================================

// Normalisasi berbagai bentuk tanggal Firestore/JS menjadi Date.
// Menerima: Timestamp Firestore, Date, number (ms), "YYYY-MM",
// string tanggal ISO, atau objek { seconds }.
export function toDate(value) {
  if (!value) return null

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }

  if (typeof value.toDate === "function") {
    const d = value.toDate()
    return d instanceof Date && !isNaN(d.getTime()) ? d : null
  }

  if (typeof value === "number") {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }

  if (typeof value === "string") {
    // Format bulan internal app: "YYYY-MM" → tanggal 1 bulan tersebut
    if (/^\d{4}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number)
      return new Date(y, m - 1, 1)
    }
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }

  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000)
  }

  return null
}

// Selisih bulan kalender antara dua tanggal (dibulatkan ke bawah).
// Return null kalau salah satu tanggal tidak valid.
export function monthsBetween(start, end = new Date()) {
  const a = toDate(start)
  const b = toDate(end)
  if (!a || !b) return null

  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) months -= 1

  return months < 0 ? 0 : months
}

// Label "lama berlangganan" yang enak dibaca.
export function formatDuration(months) {
  if (months === null || months === undefined) return "-"
  if (months < 1) return "< 1 bulan"
  if (months < 12) return `${months} bulan`

  const years = Math.floor(months / 12)
  const rest = months % 12
  return rest === 0 ? `${years} tahun` : `${years} tahun ${rest} bulan`
}

function emptyBucket() {
  return {
    invoiceCount: 0,
    paidCount: 0,
    totalBilled: 0,
    totalPaid: 0,
    lastPaidAt: null,
    firstMonth: null,
    lastMonth: null,
    lastPaidMonth: null
  }
}

// Agregasi `invoices` per customer_id (sekali jalan, O(n)).
function groupInvoicesByCustomer(invoices) {
  const map = new Map()

  for (const inv of invoices) {
    if (!inv || !inv.customer_id) continue

    let bucket = map.get(inv.customer_id)
    if (!bucket) {
      bucket = emptyBucket()
      map.set(inv.customer_id, bucket)
    }

    const amount = Number(inv.amount) || 0
    const paid = Number(inv.paid_amount) || 0
    const month = typeof inv.month === "string" ? inv.month : null

    bucket.invoiceCount += 1
    bucket.totalBilled += amount
    bucket.totalPaid += paid
    if (inv.status === "paid") bucket.paidCount += 1

    if (month) {
      if (!bucket.firstMonth || month < bucket.firstMonth) bucket.firstMonth = month
      if (!bucket.lastMonth || month > bucket.lastMonth) bucket.lastMonth = month
      if (paid > 0 && (!bucket.lastPaidMonth || month > bucket.lastPaidMonth)) {
        bucket.lastPaidMonth = month
      }
    }

    const paidAt = toDate(inv.paid_at)
    if (paid > 0 && paidAt && (!bucket.lastPaidAt || paidAt > bucket.lastPaidAt)) {
      bucket.lastPaidAt = paidAt
    }
  }

  return map
}

// Ringkasan per pelanggan untuk halaman landing laporan.
// customers: dokumen `customers` ({ id, name, phone, product_name, is_active, join_date, created_at })
// invoices : dokumen `invoices` ({ customer_id, month, amount, paid_amount, status, paid_at })
export function summarizeCustomers(customers = [], invoices = [], now = new Date()) {
  const grouped = groupInvoicesByCustomer(invoices)

  return customers
    .map(customer => {
      const bucket = grouped.get(customer.id) || emptyBucket()

      // Lama berlangganan dihitung dari join_date. Kalau kosong (data lama),
      // pakai created_at, lalu fallback ke bulan tagihan pertama.
      const joinDate =
        toDate(customer.join_date) ||
        toDate(customer.created_at) ||
        toDate(bucket.firstMonth)

      const months = monthsBetween(joinDate, now)
      const outstanding = Math.max(0, bucket.totalBilled - bucket.totalPaid)

      return {
        id: customer.id,
        name: customer.name || "(Tanpa Nama)",
        phone: customer.phone || "",
        productName: customer.product_name || "Tanpa Paket",
        isActive: customer.is_active !== false,
        joinDate,
        months,
        durationLabel: formatDuration(months),
        invoiceCount: bucket.invoiceCount,
        paidCount: bucket.paidCount,
        totalBilled: bucket.totalBilled,
        totalPaid: bucket.totalPaid,
        outstanding,
        lastPaidAt: bucket.lastPaidAt || toDate(bucket.lastPaidMonth),
        lastPaidMonth: bucket.lastPaidMonth
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, "id"))
}

// Riwayat tagihan satu pelanggan, terbaru di atas.
export function buildPaymentHistory(invoices = []) {
  return invoices
    .map(inv => {
      const amount = Number(inv.amount) || 0
      const paidAmount = Number(inv.paid_amount) || 0
      const month = typeof inv.month === "string" ? inv.month : ""

      let status = inv.status
      if (!status) {
        status = amount > 0 && paidAmount >= amount ? "paid" : paidAmount > 0 ? "partial" : "unpaid"
      }

      return {
        id: inv.id,
        month,
        amount,
        paidAmount,
        outstanding: Math.max(0, amount - paidAmount),
        status,
        paidAt: toDate(inv.paid_at),
        autoSubscribed: inv.auto_subscribed === true,
        hasPayment: paidAmount > 0
      }
    })
    .sort((a, b) => b.month.localeCompare(a.month))
}

// Total ringkas untuk header halaman detail.
export function aggregateHistory(history = []) {
  const totals = {
    invoiceCount: history.length,
    paidCount: 0,
    totalBilled: 0,
    totalPaid: 0,
    outstanding: 0,
    firstPaidMonth: null,
    lastPaidMonth: null
  }

  for (const row of history) {
    totals.totalBilled += row.amount
    totals.totalPaid += row.paidAmount
    totals.outstanding += row.outstanding
    if (row.status === "paid") totals.paidCount += 1
    if (row.hasPayment && row.month) {
      if (!totals.firstPaidMonth || row.month < totals.firstPaidMonth) totals.firstPaidMonth = row.month
      if (!totals.lastPaidMonth || row.month > totals.lastPaidMonth) totals.lastPaidMonth = row.month
    }
  }

  return totals
}
