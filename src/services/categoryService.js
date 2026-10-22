import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  setDoc,
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

// In-flight promise map to prevent in-memory race conditions across concurrent callers
const inFlightRequests = new Map()

export async function getCategories(type) {
  if (inFlightRequests.has(type)) {
    return inFlightRequests.get(type)
  }

  const promise = (async () => {
    try {
      const q = query(
        categoryRef,
        where("type", "==", type)
      )
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        // Seed default categories using deterministic document IDs to prevent duplicate seeding
        // when multiple requests or tabs execute simultaneously.
        const defaults = type === "expense" ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_REVENUE_CATEGORIES
        const seeded = []
        for (const name of defaults) {
          const docId = `${type}_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`
          const categoryDocRef = doc(db, "categories", docId)
          await setDoc(categoryDocRef, {
            name,
            type,
            created_at: serverTimestamp()
          }, { merge: true })
          seeded.push({ id: docId, name, type })
        }
        return seeded
      }

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } finally {
      inFlightRequests.delete(type)
    }
  })()

  inFlightRequests.set(type, promise)
  return promise
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
