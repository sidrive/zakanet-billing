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

const revenueRef = collection(db, "revenues")

export async function getRevenues() {
  const q = query(revenueRef, orderBy("date", "desc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

export async function addRevenue(data) {
  const { state } = useAuth()
  const userEmail = state.user?.email || "system@zakanet"
  const dateVal = data.date ? Timestamp.fromDate(new Date(data.date)) : serverTimestamp()

  return await addDoc(revenueRef, {
    category: data.category,
    description: data.description,
    amount: Number(data.amount),
    date: dateVal,
    payer_name: data.payer_name || "",
    payment_method: data.payment_method || "Tunai",
    note: data.note || "",
    created_by: userEmail,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  })
}

export async function updateRevenue(id, data) {
  const ref = doc(db, "revenues", id)
  await updateDoc(ref, {
    category: data.category,
    description: data.description,
    amount: Number(data.amount),
    date: data.date ? Timestamp.fromDate(new Date(data.date)) : serverTimestamp(),
    payer_name: data.payer_name || "",
    payment_method: data.payment_method || "Tunai",
    note: data.note || "",
    updated_at: serverTimestamp()
  })
}

export async function deleteRevenue(id) {
  const ref = doc(db, "revenues", id)
  await deleteDoc(ref)
}
