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
  writeBatch
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
  const totalAmount = Number(data.amount)
  const paidAmount = data.is_partial ? Number(data.paid_amount || 0) : totalAmount
  const dateVal = data.date ? Timestamp.fromDate(new Date(data.date)) : serverTimestamp()

  // Jika belum lunas sepenuhnya (is_partial = true dan paidAmount < totalAmount),
  // lakukan batch write untuk mencatat revenue sekaligus mencatat piutang di receivables.
  if (data.is_partial && paidAmount < totalAmount) {
    const batch = writeBatch(db)
    const newRevRef = doc(collection(db, "revenues"))
    const newRecRef = doc(collection(db, "receivables"))

    const remaining = totalAmount - paidAmount

    batch.set(newRevRef, {
      category: data.category,
      description: data.description,
      amount: paidAmount, // Yang sudah dibayar tercatat sebagai kas masuk
      date: dateVal,
      payer_name: data.payer_name || "",
      payment_method: data.payment_method || "Tunai",
      note: (data.note || "") + ` (Sebagian belum lunas, sisa Rp ${remaining.toLocaleString('id-ID')} masuk ke Piutang)`,
      created_by: userEmail,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    })

    batch.set(newRecRef, {
      debtor_name: data.payer_name || "Pelanggan Umum",
      description: `Piutang dari Pendapatan: ${data.description}`,
      amount: totalAmount,
      paid_amount: paidAmount,
      status: paidAmount > 0 ? "partial" : "unpaid",
      due_date: data.due_date ? Timestamp.fromDate(new Date(data.due_date)) : null,
      note: data.note || "",
      created_by: userEmail,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    })

    await batch.commit()
    return true
  }

  return await addDoc(revenueRef, {
    category: data.category,
    description: data.description,
    amount: totalAmount,
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
