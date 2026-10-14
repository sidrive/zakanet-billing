import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "firebase/firestore"
import { db } from "../firebase"

const categoryRef = collection(db, "categories")

const DEFAULT_EXPENSE_CATEGORIES = [
  "Operasional",
  "Gaji",
  "Sewa Tempat",
  "Listrik & Internet",
  "Perawatan Perangkat",
  "Pembelian Perangkat",
  "Lainnya"
]

const DEFAULT_REVENUE_CATEGORIES = [
  "Penjualan Perangkat",
  "Biaya Instalasi",
  "Jasa Teknisi",
  "Lainnya"
]

export async function getCategories(type) {
  const q = query(
    categoryRef,
    where("type", "==", type),
    orderBy("created_at", "asc")
  )
  const snapshot = await getDocs(q)

  if (snapshot.empty) {
    // Seed default categories if none exist
    const defaults = type === "expense" ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_REVENUE_CATEGORIES
    const seeded = []
    for (const name of defaults) {
      const docRef = await addDoc(categoryRef, {
        name,
        type,
        created_at: serverTimestamp()
      })
      seeded.push({ id: docRef.id, name, type })
    }
    return seeded
  }

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

export async function addCategory(type, name) {
  if (!name || !name.trim()) throw new Error("Nama kategori wajib diisi")
  const trimmed = name.trim()

  const snapshot = await getDocs(query(categoryRef, where("type", "==", type), where("name", "==", trimmed)))
  if (!snapshot.empty) {
    throw new Error("Kategori dengan nama tersebut sudah ada")
  }

  const docRef = await addDoc(categoryRef, {
    name: trimmed,
    type,
    created_at: serverTimestamp()
  })

  return { id: docRef.id, name: trimmed, type }
}

export async function deleteCategory(id) {
  const ref = doc(db, "categories", id)
  await deleteDoc(ref)
}
