// ============================================================
// Service: Laporan Pembayaran per Pelanggan
//
// Hanya mengambil data dari Firestore lalu menyerahkan agregasinya
// ke utils/customerReport.js (supaya tidak ada logika hitung di sini
// maupun di view).
//
// Sumber data:
// - `customers` → identitas, paket, join_date
// - `invoices`  → riwayat tagihan bulanan (amount, paid_amount, status, paid_at)
// ============================================================
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../firebase"
import {
  summarizeCustomers,
  buildPaymentHistory,
  aggregateHistory
} from "@/utils/customerReport"

const customerRef = collection(db, "customers")
const invoiceRef = collection(db, "invoices")

// Daftar pelanggan + lama berlangganan + total pembayaran.
export async function getCustomerPaymentSummary() {
  const [customerSnap, invoiceSnap] = await Promise.all([
    getDocs(customerRef),
    getDocs(invoiceRef)
  ])

  const customers = customerSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const invoices = invoiceSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  return summarizeCustomers(customers, invoices)
}

// Riwayat pembayaran tagihan internet satu pelanggan.
export async function getCustomerPaymentHistory(customerId) {
  if (!customerId) return { rows: [], totals: aggregateHistory([]) }

  const snap = await getDocs(query(invoiceRef, where("customer_id", "==", customerId)))
  const rows = buildPaymentHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })))

  return { rows, totals: aggregateHistory(rows) }
}
