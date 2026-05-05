import {
 collection,
 addDoc,
 getDocs,
 query,
 where,
 orderBy,
 doc,
 updateDoc,
 serverTimestamp,
 Timestamp
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
   join_date: serverTimestamp(),
   created_at: serverTimestamp()
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

// update data pelanggan
export async function updateCustomer(id, data) {
 const ref = doc(db, "customers", id)
 await updateDoc(ref, {
   name: data.name,
   name_lowercase: data.name.toLowerCase(),
   phone: data.phone,
   address: data.address,
   product_id: data.product_id,
   product_name: data.product_name,
   custom_price: Number(data.custom_price),
   is_active: data.is_active,
   join_date: data.join_date
     ? Timestamp.fromDate(new Date(data.join_date))
     : null
 })
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
