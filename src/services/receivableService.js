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
  getDoc
} from "firebase/firestore"
import { db } from "../firebase"
import { useAuth } from "../composables/useAuth"

const receivableRef = collection(db, "receivables")

export async function getReceivables() {
  const q = query(receivableRef, orderBy("created_at", "desc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

export async function addReceivable(data) {
  const { state } = useAuth()
  const userEmail = state.user?.email || "system@zakanet"
  const amount = Number(data.amount)

  return await addDoc(receivableRef, {
    debtor_name: data.debtor_name,
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

export async function updateReceivable(id, data) {
  const ref = doc(db, "receivables", id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error("Piutang tidak ditemukan")
  const current = snap.data()

  const newAmount = Number(data.amount)
  const currentPaid = current.paid_amount || 0

  // Hitung ulang status berdasarkan total amount baru vs paid_amount yang sudah ada
  let newStatus = "unpaid"
  if (currentPaid >= newAmount) {
    newStatus = "paid"
  } else if (currentPaid > 0) {
    newStatus = "partial"
  }

  await updateDoc(ref, {
    debtor_name: data.debtor_name,
    description: data.description,
    amount: newAmount,
    status: newStatus,
    due_date: data.due_date ? Timestamp.fromDate(new Date(data.due_date)) : null,
    note: data.note || "",
    updated_at: serverTimestamp()
  })
}

export async function recordPayment(id, paymentAmount) {
  const ref = doc(db, "receivables", id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error("Piutang tidak ditemukan")
  const data = snap.data()

  const totalAmount = data.amount || 0
  const currentPaid = data.paid_amount || 0
  const addAmount = Number(paymentAmount)

  if (addAmount <= 0) {
    throw new Error("Nominal pembayaran harus lebih dari 0")
  }

  let newPaid = currentPaid + addAmount
  // Clamp agar paid_amount tidak melebihi total amount
  if (newPaid > totalAmount) {
    newPaid = totalAmount
  }

  let newStatus = "unpaid"
  if (newPaid >= totalAmount) {
    newStatus = "paid"
  } else if (newPaid > 0) {
    newStatus = "partial"
  }

  await updateDoc(ref, {
    paid_amount: newPaid,
    status: newStatus,
    updated_at: serverTimestamp()
  })

  return { paid_amount: newPaid, status: newStatus }
}

export async function deleteReceivable(id) {
  const ref = doc(db, "receivables", id)
  await deleteDoc(ref)
}
