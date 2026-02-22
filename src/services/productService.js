import {
 collection,
 addDoc,
 getDocs,
 query,
 orderBy
} from "firebase/firestore"
import { db } from "../firebase"

const productRef = collection(db, "products")

// tambah paket
export async function addProduct(data) {
 return await addDoc(productRef, {
   ...data,
   is_active: true,
   created_at: new Date()
 })
}

// ambil semua paket
export async function getProducts() {
 const q = query(productRef, orderBy("created_at", "desc"))
 const snapshot = await getDocs(q)

 return snapshot.docs.map(doc => ({
   id: doc.id,
   ...doc.data()
 }))
}

// ambil semua paket yang aktif
export async function getActiveProducts() {
 const q = query(productRef, orderBy("created_at", "desc"))
 const snapshot = await getDocs(q)

 return snapshot.docs
   .map(doc => ({ id: doc.id, ...doc.data() }))
   .filter(p => p.is_active)
}
