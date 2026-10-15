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
  Timestamp
} from "firebase/firestore"
import { db } from "../firebase"
import { useAuth } from "../composables/useAuth"

const expenseRef = collection(db, "expenses")

export async function getExpenses() {
  const q = query(expenseRef, orderBy("date", "desc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

export async function addExpense(data) {
  const { state } = useAuth()
  const userEmail = state.user?.email || "system@zakanet"

  return await addDoc(expenseRef, {
    category: data.category,
    description: data.description,
    amount: Number(data.amount),
    date: data.date ? Timestamp.fromDate(new Date(data.date)) : serverTimestamp(),
    payment_method: data.payment_method || "Tunai",
    is_isp_bill: !!data.is_isp_bill,
    note: data.note || "",
    created_by: userEmail,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  })
}

export async function updateExpense(id, data) {
  const ref = doc(db, "expenses", id)
  await updateDoc(ref, {
    category: data.category,
    description: data.description,
    amount: Number(data.amount),
    date: data.date ? Timestamp.fromDate(new Date(data.date)) : serverTimestamp(),
    payment_method: data.payment_method || "Tunai",
    is_isp_bill: !!data.is_isp_bill,
    note: data.note || "",
    updated_at: serverTimestamp()
  })
}

export async function deleteExpense(id) {
  const ref = doc(db, "expenses", id)
  await deleteDoc(ref)
}
