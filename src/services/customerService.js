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
import bcrypt from "bcryptjs"
import { db } from "../firebase"

// reference collection
const customerRef = collection(db, "customers")

// tambah pelanggan
// `password` (plaintext) wajib diisi — dipakai pelanggan untuk cek tagihan
// sendiri lewat public API (lihat functions/lib/billingLookup.js). Di-hash
// di sini supaya plaintext tidak pernah ditulis ke Firestore, hanya hash-nya.
export async function addCustomer(data) {
 const { password, ...rest } = data
 return await addDoc(customerRef, {
   ...rest,
   name_lowercase: data.name.toLowerCase(),
   password_hash: bcrypt.hashSync(password, 10),
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
// `password` (plaintext, opsional) hanya dikirim kalau admin mengisi/mengubah
// password — kalau kosong, password_hash yang sudah ada dibiarkan apa adanya.
export async function updateCustomer(id, data) {
 const ref = doc(db, "customers", id)
 const payload = {
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
 }

 if (data.password) {
   payload.password_hash = bcrypt.hashSync(data.password, 10)
 }

 await updateDoc(ref, payload)
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
