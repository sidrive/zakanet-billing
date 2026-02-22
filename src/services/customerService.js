import {
 collection,
 addDoc,
 getDocs,
 query,
 where,
 orderBy
} from "firebase/firestore"
import { db } from "../firebase"

// reference collection
const customerRef = collection(db, "customers")

// tambah pelanggan
export async function addCustomer(data) {
 return await addDoc(customerRef, {
   ...data,
   name_lowercase: data.name.toLowerCase(),
   balance: 0,
   is_active: true,
   created_at: new Date()
 })
}

// ambil semua pelanggan
export async function getCustomers() {
 const q = query(customerRef, orderBy("created_at", "desc"))
 const snapshot = await getDocs(q)
 return snapshot.docs.map(doc => ({
   id: doc.id,
   ...doc.data()
 }))
}

// search pelanggan by nama
export async function searchCustomersByName(keyword) {
 const q = query(
   customerRef,
   where("name_lowercase", ">=", keyword.toLowerCase()),
   where("name_lowercase", "<=", keyword.toLowerCase() + "\uf8ff")
 )

 const snapshot = await getDocs(q)
 return snapshot.docs.map(doc => ({
   id: doc.id,
   ...doc.data()
 }))
}

// search pelanggan by phone
export async function searchCustomersByPhone(phone) {
 const q = query(customerRef, where("phone", "==", phone))
 const snapshot = await getDocs(q)

 return snapshot.docs.map(doc => ({
   id: doc.id,
   ...doc.data()
 }))
}
