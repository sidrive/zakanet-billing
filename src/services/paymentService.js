import {
 collection,
 addDoc,
 getDocs,
 query,
 where,
 orderBy,
 updateDoc,
 doc
} from "firebase/firestore"
import { db } from "../firebase"
import { currentMonth } from "../utils/date"
import { canGenerateInvoice } from "@/utils/billingRules"

const invoiceRef = collection(db, "invoices")
const paymentRef = collection(db, "payments")

export async function getUnpaidInvoices(customerId) {
 const q = query(
   invoiceRef,
   where("customer_id", "==", customerId),
   where("status", "==", "unpaid"),
   // orderBy("month", "asc")
 )
 const snap = await getDocs(q)
 console.log("UNPAID INVOICES FETCHED:", snap.docs.map(d => d.data()))
 return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function payInvoice(invoiceId, type) {
 const ref = doc(db, "invoices", invoiceId)
 await updateDoc(ref, {
   status: "paid",
   paid_type: type,
   paid_at: new Date()
 })
}

export async function createPayment(data) {
 await addDoc(paymentRef, {
   ...data,
   created_at: new Date()
 })
}

export async function hasPaidThisMonth(customerId, month) {
 const q = query(
   invoiceRef,
   where("customer_id", "==", customerId),
   where("month", "==", month),
   where("status", "==", "paid")
 )

 const snap = await getDocs(q)
 return !snap.empty
}

export async function ensureInvoiceThisMonth(customer) {
  const month = currentMonth()

  // ⛔ Skip jika nonaktif
  if (!customer.is_active) return null

  const q = query(
    invoiceRef,
    where("customer_id", "==", customer.id),
    where("month", "==", month)
  )

  const snap = await getDocs(q)

  if (!snap.empty) {
    return {
      id: snap.docs[0].id,
      ...snap.docs[0].data()
    }
  }

  if (!canGenerateInvoice(customer, month)) {
    return null
  }

  // =============================
  // Generate invoice
  // =============================

  const ref = await addDoc(invoiceRef, {
    customer_id: customer.id,
    customer_name: customer.name,
    month,
    amount: Number(customer.custom_price),
    paid_amount: 0,
    status: "unpaid",
    auto_subscribed: false,
    paid_at: null,
    created_at: new Date()
  })

  return {
    id: ref.id,
    customer_id: customer.id,
    month,
    amount: Number(customer.custom_price),
    paid_amount: 0,
    status: "unpaid",
    auto_subscribed: false
  }
}


export async function getOpenInvoices(customerId) {
 const q = query(
   invoiceRef,
   where("customer_id", "==", customerId),
   where("status", "in", ["unpaid", "partial"])
 )

 const snap = await getDocs(q)

 return snap.docs
   .map(d => ({ id: d.id, ...d.data() }))
   .sort((a, b) => a.month.localeCompare(b.month)) // manual sort
}


export async function applyAutoSubscribe(customer, invoices) {
 let saldo = customer.balance || 0
 if (saldo <= 0) return

 for (const inv of invoices) {
   if (saldo <= 0) break

   const sisa = inv.amount - (inv.paid_amount || 0)

   if (sisa <= 0) continue

   if (saldo >= sisa) {
     await updateDoc(doc(db, "invoices", inv.id), {
       paid_amount: inv.amount,
       status: "paid",
       paid_at: new Date(),
       auto_subscribed: true
     })
     saldo -= sisa
   } else {
     await updateDoc(doc(db, "invoices", inv.id), {
       paid_amount: (inv.paid_amount || 0) + saldo,
       status: "partial"
     })
     saldo = 0
   }
 }

 await updateDoc(doc(db, "customers", customer.id), {
   balance: saldo
 })
}

