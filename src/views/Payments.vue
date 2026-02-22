<template>
  <div class="payment-container">
    <header class="payment-header">
      <h2 class="title">Pembayaran Layanan ISP</h2>
      <p class="subtitle">Kelola tagihan dan saldo pelanggan dengan mudah</p>
    </header>

    <div class="card selector-card">
      <label class="input-label">Pilih Pelanggan</label>
      <div class="select-wrapper">
        <select @change="selectCustomer(customers[$event.target.selectedIndex - 1])" class="custom-select">
          <option value="">Cari nama pelanggan...</option>
          <option v-for="c in customers" :key="c.id">{{ c.name }}</option>
        </select>
        <span class="chevron"></span>
      </div>
    </div>

    <div v-if="selectedCustomer && !loading" class="main-grid">
      
      <div class="content-left">
        <div class="card info-card">
          <div class="customer-profile">
            <div class="avatar">{{ selectedCustomer.name.charAt(0) }}</div>
            <div class="profile-text">
              <h3 class="customer-name">{{ selectedCustomer.name }}</h3>
              <p class="customer-id">ID: #{{ selectedCustomer.id.toString().padStart(5, '0') }}</p>
            </div>
          </div>
          
          <div class="stats-container">
            <div class="stat-box shadow-inner">
              <span class="stat-label">Saldo Saat Ini</span>
              <span class="stat-value text-green">Rp {{ saldoAwal.toLocaleString() }}</span>
            </div>
            <div class="stat-box shadow-inner">
              <span class="stat-label">Tunggakan</span>
              <span class="stat-value" :class="unpaidInvoices.length > 0 ? 'text-red' : ''">
                {{ unpaidInvoices.length }} Bulan
              </span>
            </div>
          </div>
        </div>

        <div v-if="!alreadyPaidThisMonth" class="card form-card">
          <h4 class="section-title">Detail Pembayaran</h4>
          
          <div class="form-group">
            <label class="input-label">Nominal Bayar</label>
            <div class="input-group">
              <span class="input-addon">Rp</span>
              <input type="number" v-model="payAmount" class="main-input" placeholder="0" />
            </div>
          </div>

          <div class="form-group">
            <label class="input-label">Promo / Diskon (Opsional)</label>
            <div class="input-group">
              <select v-model="discountType" class="input-addon-select">
                <option value="nominal">Rp</option>
                <option value="percent">%</option>
              </select>
              <input type="number" v-model="discountValue" class="main-input" placeholder="0" />
            </div>
          </div>

          <button class="btn-outline-green" :disabled="payAmount <= 0" @click="simulatePayment">
            Cek Rincian Tagihan
          </button>
        </div>

        <div v-else class="card topup-card">
          <div class="alert-banner">
            <div class="alert-icon">
              <span>i</span>
            </div>
            <div class="alert-text">
              <h5 class="alert-title">Tagihan Sudah Lunas</h5>
              <p>Pelanggan tidak memiliki tunggakan bulan ini. Saldo tambahan akan digunakan untuk periode berikutnya.</p>
            </div>
          </div>

          <div class="divider-dashed"></div>

          <div class="topup-form">
            <label class="input-label">Tambah Saldo (Top Up)</label>
            <div class="input-group">
              <span class="input-addon">Rp</span>
              <input 
                type="number" 
                v-model="saldoAmount" 
                class="main-input" 
                placeholder="Masukkan nominal saldo..." 
              />
            </div>
            <button class="btn-green full-width mt-16" @click="addSaldoOnly">
              Konfirmasi Top Up
            </button>
          </div>
        </div>
      </div>

      <div class="content-right" v-if="preview">
        <div class="card preview-card">
          <h4 class="section-title">Ringkasan Transaksi</h4>
          
          <div class="summary-list">
            <div v-for="i in preview.closed" :key="i.id" class="summary-item">
              <span>Lunas: {{ formatMonthId(i.month) }}</span>
              <span class="badge-green">Lunas</span>
            </div>
            <div v-for="i in preview.partial" :key="i.id" class="summary-item">
              <span>Cicil: {{ formatMonthId(i.month) }}</span>
              <span class="text-sm">Rp {{ i.will_pay.toLocaleString() }}</span>
            </div>
          </div>

          <div class="divider-dashed"></div>

          <div class="total-row">
            <span>Estimasi Saldo Akhir</span>
            <span class="total-amount">Rp {{ preview.saldoAkhir.toLocaleString() }}</span>
          </div>

          <p v-if="autoSubscribeUsedThisMonth()" class="hint-text">
            *Saldo akan otomatis memotong tagihan bulan berjalan.
          </p>

          <button class="btn-green full-width mt-16" @click="openConfirm">
            Konfirmasi Pembayaran
          </button>
        </div>
      </div>

    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Sedang menyiapkan data...</p>
    </div>

    <div v-if="showConfirm" class="modal-overlay" @click.self="showConfirm = false">
      <div class="modal-content animate-pop">
        <div class="modal-header">
          <div class="icon-confirm-wrapper">
            <span class="icon-confirm">💰</span>
          </div>
          <h3 class="modal-title">Konfirmasi Pembayaran</h3>
        </div>

        <div class="modal-body">
          <p class="modal-description">
            Anda akan memproses pembayaran untuk pelanggan:
          </p>
          <div class="customer-preview-box">
            <span class="customer-name-bold">{{ selectedCustomer?.name }}</span>
            <span class="customer-id-small">ID: #{{ selectedCustomer?.id }}</span>
          </div>

          <div class="payment-summary-card">
            <div class="summary-item">
              <span class="label">Total Bayar</span>
              <span class="value text-green">Rp {{ payAmount?.toLocaleString() }}</span>
            </div>
            <div class="divider-dashed"></div>
            <div class="summary-item">
              <span class="label">Estimasi Saldo Akhir</span>
              <span class="value">Rp {{ preview?.saldoAkhir?.toLocaleString() }}</span>
            </div>
          </div>
        </div>

        <div class="modal-footer-actions">
          <button class="btn-cancel" @click="showConfirm = false">
            Batal
          </button>
          <button class="btn-confirm-final" @click="confirmProcess">
            Ya, Proses Pembayaran
          </button>
        </div>
      </div>
    </div>
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
    name: selectedCustomer.value.name,
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
