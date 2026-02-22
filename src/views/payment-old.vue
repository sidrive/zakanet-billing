<template>
 <div class="page">
   <h2 class="page-title">Pembayaran Pelanggan</h2>

   <!-- PILIH PELANGGAN -->
   <Card>
     <label class="label">Pelanggan</label>
     <select @change="selectCustomer(customers[$event.target.selectedIndex - 1])">
       <option value="">-- Pilih Pelanggan --</option>
       <option v-for="c in customers" :key="c.id">
         {{ c.name }}
       </option>
     </select>
   </Card>

   <!-- GRID UTAMA -->
   <div
     v-if="selectedCustomer && !loading && !alreadyPaidThisMonth"
     class="grid"
   >
     <!-- INFO -->
     <Card class="card">
       <h4 class="card-title">Informasi Pelanggan</h4>

       <div class="info-row">
         <span>Saldo</span>
         <strong>Rp {{ saldoAwal.toLocaleString() }}</strong>
       </div>

       <div class="info-row">
         <span>Hutang</span>
         <strong>{{ unpaidInvoices.length }} bulan</strong>
       </div>

       <div class="info-row">
         <span>Tagihan bulanan</span>
         <strong>Rp. {{ selectedCustomer.custom_price.toLocaleString() }}</strong>
       </div>
     </Card>

     <!-- FORM -->
     <Card class="card">
       <h4 class="card-title">Pembayaran</h4>

       <label class="label">Nominal Bayar</label>
       <input type="number" v-model="payAmount" />

       <label class="label">Diskon</label>
       <div class="row">
         <select v-model="discountType">
           <option value="nominal">Rp</option>
           <option value="percent">%</option>
         </select>
         <input type="number" v-model="discountValue" />
       </div>

       <button class="btn-secondary" :disabled="payAmount <= 0" @click="simulatePayment">
         Preview Pembayaran
       </button>
     </Card>
   </div>

   <!-- PREVIEW -->
   <Card v-if="preview && !loading" class="preview section">
     <h4 class="card-title">Ringkasan Pembayaran</h4>

     <div class="summary">
       <div class="summary-row">
         <span>Invoice Dilunasi</span>
         <strong>{{ preview.closed.length }}</strong>
       </div>
       <div v-if="preview.partial.length" class="summary-row">
         <span>Invoice Sebagian</span>
         <strong>{{ preview.partial.length }}</strong>
       </div>
     </div>

     <ul class="list" v-if="preview.closed.length">
       <li v-for="i in preview.closed" :key="i.id">
         {{ formatMonthId(i.month) }} – <span class="badge success">Lunas</span>
       </li>
     </ul>

     <ul class="invoice-item" v-if="preview.partial.length">
       <li v-for="i in preview.partial" :key="i.id">
         {{ formatMonthId(i.month) }} – Dibayar Rp {{ i.will_pay.toLocaleString() }}
       </li>
     </ul>

     <div class="divider"></div>

     <div class="summary-row total">
       <span>Saldo Akhir</span>
       <strong>Rp {{ preview.saldoAkhir.toLocaleString() }}</strong>
     </div>

     <p v-if="autoSubscribeUsedThisMonth()" class="hint">
       ℹ️ Saldo otomatis digunakan untuk tagihan
       {{ formatMonthId(currentMonth()) }}
     </p>

     <div class="action-bar">
      <button class="btn-primary section-sm" @click="openConfirm">
        Konfirmasi & Simpan
      </button>
     </div>
   </Card>

   <!-- SUDAH BAYAR -->
   <Card
     v-if="selectedCustomer && alreadyPaidThisMonth && !loading"
     class="card warning"
   >
     ⚠️ Pelanggan sudah membayar bulan ini.
     Gunakan <b>Tambah Saldo</b> untuk pembayaran berikutnya.
   </Card>

   <!-- TAMBAH SALDO -->
   <Card
     v-if="selectedCustomer && alreadyPaidThisMonth && !loading"
     class="card"
   >
     <h4 class="card-title">Tambah Saldo</h4>

     <label class="label">Nominal Saldo</label>
     <input type="number" v-model="saldoAmount" />

     <button class="btn-secondary" @click="addSaldoOnly">
       Simpan Saldo
     </button>
   </Card>

   <Card v-if="loading" class="card">
     🔄 Memuat data...
   </Card>
 </div>
 <!-- CONFIRM MODAL -->
<div v-if="showConfirm" class="modal-backdrop">
  <div class="modal">
    <h4>Konfirmasi Pembayaran</h4>

    <p>
      Anda akan memproses pembayaran untuk
      <b>{{ selectedCustomer.name }}</b>.
    </p>

    <p class="modal-summary">
      Saldo akhir:
      <b>Rp {{ preview?.saldoAkhir?.toLocaleString() }}</b>
    </p>

    <div class="modal-actions">
      <button class="btn-secondary" @click="showConfirm = false">
        Batal
      </button>
      <button class="btn-primary" @click="confirmProcess">
        Ya, Proses
      </button>
    </div>
  </div>
</div>
<!-- TOAST -->
<div v-if="toast.show" class="toast" :class="toast.type">
  {{ toast.message }}
</div>
</template>


<script setup>
import { ref } from "vue"
import { getCustomers } from "../services/customerService"
import { getOpenInvoices, payInvoice, createPayment, hasPaidThisMonth, ensureInvoiceThisMonth, applyAutoSubscribe } from "../services/paymentService"
import { doc, updateDoc, getDoc } from "firebase/firestore"
import { db } from "../firebase"
import { currentMonth } from "../utils/date"

const customers = ref([])
const selectedCustomer = ref(null)
const unpaidInvoices = ref([])

const payAmount = ref(0)
const discountType = ref("nominal")
const discountValue = ref(0)

const preview = ref(null)
const alreadyPaidThisMonth = ref(false)
const saldoAmount = ref(0)
const loading = ref(false)
const saldoAwal = ref(0)
const saldoDipakai = ref(0)
const showConfirm = ref(false)


async function loadCustomers() {
  customers.value = await getCustomers()
}
loadCustomers()

async function selectCustomer(c) {
  loading.value = true

  selectedCustomer.value = c
  preview.value = null
  payAmount.value = 0
  discountValue.value = 0
  unpaidInvoices.value = []

  saldoAwal.value = c.balance || 0
  saldoDipakai.value = 0

  // 1️⃣ Pastikan invoice bulan ini ADA
  await ensureInvoiceThisMonth(c)

  // 2️⃣ Ambil invoice terbuka (TERMASUK bulan ini)
  const openInvoices = await getOpenInvoices(c.id)

  // 3️⃣ Auto subscribe PAKAI invoice ini
  await applyAutoSubscribe(c, openInvoices)

  await refreshSelectedCustomer()

  saldoDipakai.value =
    (saldoAwal.value || 0) -
    (selectedCustomer.value.balance || 0)

  // 4️⃣ Ambil ulang invoice SETELAH auto subscribe
  unpaidInvoices.value = await getOpenInvoices(c.id)

  // 5️⃣ Status bulan ini
  alreadyPaidThisMonth.value = unpaidInvoices.value.every(
    inv => inv.month !== currentMonth()
  )

  loading.value = false
}


function calculateDiscount(total) {
  if (discountType.value === "percent") {
    return Math.round((discountValue.value / 100) * total)
  }
  return discountValue.value
}

async function processPayment() {

  if (!preview.value) {
    alert("Lakukan preview dulu")
    return
  }

  if (!selectedCustomer.value) return alert("Pilih pelanggan dulu")

  loading.value = true

  let sisa = Number(payAmount.value)
  
  for (const inv of unpaidInvoices.value) {
    const sisaInvoice = inv.amount - inv.paid_amount

    if (sisa <= 0) break

    if (sisa >= sisaInvoice) {
      // lunasi invoice
      await updateDoc(doc(db, "invoices", inv.id), {
        paid_amount: inv.amount,
        status: "paid",
        paid_at: new Date()
      })
      sisa -= sisaInvoice
    } else {
      // partial
      await updateDoc(doc(db, "invoices", inv.id), {
        paid_amount: inv.paid_amount + sisa,
        status: "partial"
      })
      sisa = 0
    }
  }

  // sisa uang jadi saldo HANYA jika semua invoice lunas
  if (sisa > 0) {
    await updateDoc(doc(db, "customers", selectedCustomer.value.id), {
      balance: (selectedCustomer.value.balance || 0) + sisa
    })
  }

  await createPayment({
    customer_id: selectedCustomer.value.id,
    amount: Number(payAmount.value),
    discount_type: discountType.value,
    discount_value: Number(discountValue.value),
    discount_amount: 0,
    note: "Pembayaran invoice (partial enabled)"
  })
  loading.value = false
  // Refresh halaman setelah pembayaran berhasil
  window.location.reload()
  showToast("Pembayaran berhasil diproses", "success")
}

function simulatePayment() {
  if (!selectedCustomer.value) {
    alert("Pilih pelanggan dulu")
    return
  }

  if (unpaidInvoices.value.length === 0) {
    alert(
      "Tidak ada tagihan yang perlu dibayar.\n" +
      "Gunakan Tambah Saldo untuk menyimpan pembayaran."
    )
    preview.value = null
    return
  }

  let sisa = Number(payAmount.value)

  const closed = []
  const partial = []

  for (const inv of unpaidInvoices.value) {
    const sisaInvoice = inv.amount - inv.paid_amount

    if (sisa <= 0) break

    if (sisa >= sisaInvoice) {
      closed.push(inv)
      sisa -= sisaInvoice
    } else {
      partial.push({
        ...inv,
        will_pay: sisa
      })
      sisa = 0
    }
  }

  preview.value = {
    closed,
    partial,
    saldoAkhir:
      unpaidInvoices.value.length === closed.length
        ? (selectedCustomer.value.balance || 0) + sisa
        : selectedCustomer.value.balance || 0
  }
}

async function addSaldoOnly() {
  
  if (!selectedCustomer.value) return
  loading.value = true

  const custRef = doc(db, "customers", selectedCustomer.value.id)

  await updateDoc(custRef, {
    balance: (selectedCustomer.value.balance || 0) + Number(saldoAmount.value)
  })

  await createPayment({
    customer_id: selectedCustomer.value.id,
    amount: Number(saldoAmount.value),
    discount_type: null,
    discount_value: 0,
    discount_amount: 0,
    note: "Top up saldo"
  })

  alert("Saldo berhasil ditambahkan")
  saldoAmount.value = 0
  loading.value = false
  window.location.reload()
}

function formatMonthId(monthId) {
  if (!monthId) return "-"

  const [year, month] = monthId.split("-")
  const date = new Date(Number(year), Number(month) - 1)

  return date.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric"
  })
}

async function refreshSelectedCustomer() {
  const snap = await getDoc(
    doc(db, "customers", selectedCustomer.value.id)
  )
  selectedCustomer.value = {
    id: snap.id,
    ...snap.data()
  }
}

function autoSubscribeUsedThisMonth() {
 return saldoDipakai.value > 0
}

function rupiah(value) {
 return value.toLocaleString(value)
}

function openConfirm() {
  showConfirm.value = true
}

async function confirmProcess() {
  showConfirm.value = false
  await processPayment()
}

const toast = ref({
  show: false,
  message: "",
  type: "success" // success | error
})

function showToast(message, type = "success") {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}



</script>
