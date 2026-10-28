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
  const isPaid = !!data.is_paid

  return await addDoc(expenseRef, {
    category: data.category,
    description: data.description,
    amount: Number(data.amount),
    date: data.date ? Timestamp.fromDate(new Date(data.date)) : serverTimestamp(),
    payment_method: data.payment_method || "Tunai",
    is_isp_bill: !!data.is_isp_bill,
    // `is_paid` dipakai dashboard untuk menyaring expense ber-tag ISP yang masih harus
    // dibayar (lihat useDashboard.js) -- defaultnya false untuk pengeluaran biasa yang
    // dicatat manual lewat Expenses.vue. Kalkulator settlement di Dashboard.vue mengirim
    // is_paid: true saat mencatat setoran yang MEMANG sudah lunas saat itu juga, supaya
    // catatannya sendiri tidak langsung muncul lagi sebagai "belum dibayar".
    is_paid: isPaid,
    paid_at: isPaid ? serverTimestamp() : null,
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

export async function markExpenseAsPaid(id) {
  const ref = doc(db, "expenses", id)
  await updateDoc(ref, {
    is_paid: true,
    paid_at: serverTimestamp(),
    updated_at: serverTimestamp()
  })
}

export async function deleteExpense(id) {
  const ref = doc(db, "expenses", id)
  await deleteDoc(ref)
}
