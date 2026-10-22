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
  getDoc,
  runTransaction
} from "firebase/firestore"
import { db } from "../firebase"
import { useAuth } from "../composables/useAuth"

const payableRef = collection(db, "payables")

export async function getPayables() {
  const q = query(payableRef, orderBy("created_at", "desc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

export async function getPayablePayments(payableId) {
  const q = query(
    collection(db, "payables", payableId, "payable_payments"),
    orderBy("created_at", "asc")
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

export async function addPayable(data) {
  const { state } = useAuth()
  const userEmail = state.user?.email || "system@zakanet"
  const amount = Number(data.amount)

  return await addDoc(payableRef, {
    supplier_name: data.supplier_name || "ISP Pusat",
    description: data.description,
    amount: amount,
    paid_amount: 0,
    status: "unpaid",
    due_date: data.due_date ? Timestamp.fromDate(new Date(data.due_date)) : null,
    note: data.note || "",
    created_by: userEmail,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  })
}

export async function updatePayable(id, data) {
  const ref = doc(db, "payables", id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error("Hutang tidak ditemukan")
  const current = snap.data()

  const newAmount = Number(data.amount)
  const currentPaid = current.paid_amount || 0

  let newStatus = "unpaid"
  if (currentPaid >= newAmount) {
    newStatus = "paid"
  } else if (currentPaid > 0) {
    newStatus = "partial"
  }

  await updateDoc(ref, {
    supplier_name: data.supplier_name || "ISP Pusat",
    description: data.description,
    amount: newAmount,
    status: newStatus,
    due_date: data.due_date ? Timestamp.fromDate(new Date(data.due_date)) : null,
    note: data.note || "",
    updated_at: serverTimestamp()
  })
}

// Dibungkus runTransaction (bukan getDoc + writeBatch) supaya baca-cek-tulis atomik --
// kalau dua tab/dua orang mencatat pembayaran untuk hutang yang sama nyaris bersamaan,
// transaksi kedua akan membaca saldo TERBARU (bukan data basi yang sudah divalidasi di
// klien sebelumnya), sehingga tidak bisa menembus sisa hutang yang sebenarnya.
// Overpayment ditolak (bukan di-clamp diam-diam) supaya nominal yang tercatat di riwayat
// cicilan (payable_payments) selalu sama persis dengan yang benar-benar ditambahkan ke
// paid_amount -- tidak ada lagi riwayat yang totalnya melebihi nilai hutang.
//
// `payment` menerima:
//   amount                        - nominal uang ATAU nilai taksiran barang (dua-duanya
//                                   mengurangi sisa hutang dengan cara yang sama)
//   method                        - "tunai_transfer" | "barang"
//   item_description              - wajib kalau method === "barang", deskripsi barang pengganti
//   is_combined_with_monthly_settlement - opsional, true kalau pelunasan ini digabung
//                                   dengan setoran kewajiban bulanan ke ISP Pusat
//   note                          - catatan bebas tambahan, opsional
//
// `linkedExpense` (opsional) -- dipakai saat pelunasan "Ganti Barang" melibatkan pembelian
// barang dari pihak luar (bukan dari stok sendiri). Kalau diisi, satu dokumen `expenses`
// baru ikut ditulis DALAM transaksi yang sama (atomik dengan pencatatan pelunasan hutang
// di atas) -- supaya uang riil yang keluar untuk beli barang pengganti itu tetap tercatat
// sebagai pengeluaran, terpisah dari nilai taksiran yang dipakai melunasi hutang (dua
// angka ini boleh beda, selisihnya untung/rugi barter yang sah).
//   amount   - harga beli riil barang dari pihak luar
//   category - opsional, default "Pembelian Perangkat"
export async function recordPayablePayment(payableId, payment, linkedExpense = null) {
  const addAmount = Number(payment.amount)
  if (addAmount <= 0) {
    throw new Error("Nominal pembayaran harus lebih dari 0")
  }

  const method = payment.method === "barang" ? "barang" : "tunai_transfer"
  const itemDescription = (payment.item_description || "").trim()
  if (method === "barang" && !itemDescription) {
    throw new Error("Deskripsi barang wajib diisi untuk pelunasan via ganti barang")
  }

  let expenseAmount = 0
  if (linkedExpense) {
    expenseAmount = Number(linkedExpense.amount)
    if (expenseAmount <= 0) {
      throw new Error("Nominal pembelian barang (untuk dicatat sebagai pengeluaran) harus lebih dari 0")
    }
  }

  const { state } = useAuth()
  const userEmail = state.user?.email || "system@zakanet"

  const payableDocRef = doc(db, "payables", payableId)

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(payableDocRef)
    if (!snap.exists()) throw new Error("Hutang tidak ditemukan")
    const data = snap.data()

    const totalAmount = data.amount || 0
    const currentPaid = data.paid_amount || 0
    const remaining = totalAmount - currentPaid

    if (addAmount > remaining) {
      throw new Error(`Nominal pembayaran melebihi sisa hutang saat ini (Rp ${remaining.toLocaleString('id-ID')})`)
    }

    const newPaid = currentPaid + addAmount
    let newStatus = "unpaid"
    if (newPaid >= totalAmount) newStatus = "paid"
    else if (newPaid > 0) newStatus = "partial"

    tx.update(payableDocRef, {
      paid_amount: newPaid,
      status: newStatus,
      updated_at: serverTimestamp()
    })

    const newPaymentDocRef = doc(collection(payableDocRef, "payable_payments"))
    tx.set(newPaymentDocRef, {
      amount: addAmount,
      method,
      item_description: method === "barang" ? itemDescription : "",
      is_combined_with_monthly_settlement: !!payment.is_combined_with_monthly_settlement,
      note: payment.note || "",
      created_at: serverTimestamp()
    })

    if (linkedExpense) {
      const newExpenseDocRef = doc(collection(db, "expenses"))
      tx.set(newExpenseDocRef, {
        category: linkedExpense.category || "Pembelian Perangkat",
        description: linkedExpense.description || `Beli barang pengganti hutang ke ${data.supplier_name || "ISP Pusat"}: ${itemDescription}`,
        amount: expenseAmount,
        date: serverTimestamp(),
        payment_method: "Tunai",
        is_isp_bill: false,
        note: `Terkait pelunasan Hutang Vendor (Ganti Barang) ID ${payableId}`,
        created_by: userEmail,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      })
    }

    return { paid_amount: newPaid, status: newStatus }
  })
}

export async function deletePayable(id) {
  const ref = doc(db, "payables", id)
  await deleteDoc(ref)
}
