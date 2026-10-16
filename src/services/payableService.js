import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  getDoc,
  writeBatch
} from "firebase/firestore"
import { db } from "../firebase"
import { useAuth } from "../composables/useAuth"

const payableRef = collection(db, "payables")

export async function getPayables() {
  const q = query(payableRef, orderBy("created_at", "desc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

export async function getPayablePayments(payableId) {
  const q = query(
    collection(db, "payables", payableId, "payable_payments"),
    orderBy("created_at", "asc")
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

export async function addPayable(data) {
  const { state } = useAuth()
  const userEmail = state.user?.email || "system@zakanet"
  const amount = Number(data.amount)

  return await addDoc(payableRef, {
    supplier_name: data.supplier_name || "ISP Pusat",
    description: data.description,
    amount: amount,
    paid_amount: 0,
    status: "unpaid",
    due_date: data.due_date ? Timestamp.fromDate(new Date(data.due_date)) : null,
    note: data.note || "",
    created_by: userEmail,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  })
}

export async function updatePayable(id, data) {
  const ref = doc(db, "payables", id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error("Hutang tidak ditemukan")
  const current = snap.data()

  const newAmount = Number(data.amount)
  const currentPaid = current.paid_amount || 0

  let newStatus = "unpaid"
  if (currentPaid >= newAmount) {
    newStatus = "paid"
  } else if (currentPaid > 0) {
    newStatus = "partial"
  }

  await updateDoc(ref, {
    supplier_name: data.supplier_name || "ISP Pusat",
    description: data.description,
    amount: newAmount,
    status: newStatus,
    due_date: data.due_date ? Timestamp.fromDate(new Date(data.due_date)) : null,
    note: data.note || "",
    updated_at: serverTimestamp()
  })
}

export async function recordPayablePayment(payableId, paymentAmount, note = "") {
  const batch = writeBatch(db)
  const payableDocRef = doc(db, "payables", payableId)
  const paymentCollectionRef = collection(payableDocRef, "payable_payments")
  const newPaymentDocRef = doc(paymentCollectionRef)

  const snap = await getDoc(payableDocRef)
  if (!snap.exists()) throw new Error("Hutang tidak ditemukan")
  const data = snap.data()

  const totalAmount = data.amount || 0
  const currentPaid = data.paid_amount || 0
  const addAmount = Number(paymentAmount)

  if (addAmount <= 0) {
    throw new Error("Nominal pembayaran harus lebih dari 0")
  }

  let newPaid = currentPaid + addAmount
  if (newPaid > totalAmount) newPaid = totalAmount

  let newStatus = "unpaid"
  if (newPaid >= totalAmount) newStatus = "paid"
  else if (newPaid > 0) newStatus = "partial"

  batch.update(payableDocRef, {
    paid_amount: newPaid,
    status: newStatus,
    updated_at: serverTimestamp()
  })

  batch.set(newPaymentDocRef, {
    amount: addAmount,
    note: note,
    created_at: serverTimestamp()
  })

  await batch.commit()
  return { paid_amount: newPaid, status: newStatus }
}

export async function deletePayable(id) {
  const ref = doc(db, "payables", id)
  await deleteDoc(ref)
}
