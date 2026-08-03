<script setup>
import { ref, computed } from "vue"
import { PhMagnifyingGlass, PhX, PhWallet } from "@phosphor-icons/vue"
import { getCustomers } from "../services/customerService"
import { getOpenInvoices, createPayment, ensureInvoiceThisMonth, applyAutoSubscribe } from "../services/paymentService"
import { doc, updateDoc, getDoc } from "firebase/firestore"
import { db } from "../firebase"
import { currentMonth } from "../utils/date"
import SheetModal from "@/components/SheetModal.vue"
import StatusBadge from "@/components/StatusBadge.vue"
import { useToast } from "@/composables/useToast"

const { showToast } = useToast()

const customers = ref([])
const selectedCustomer = ref(null)
const unpaidInvoices = ref([])

const payAmount = ref(0)
const discountType = ref("nominal")
const discountValue = ref(0)

const discountAmount = computed(() => {
  const val = Number(discountValue.value || 0)
  if (val <= 0) return 0
  if (discountType.value === "percent") {
    const totalTagihan = unpaidInvoices.value.reduce((sum, inv) => sum + (inv.amount - inv.paid_amount), 0)
    return Math.round(totalTagihan * val / 100)
  }
  return val
})

const preview = ref(null)
const alreadyPaidThisMonth = ref(false)
const saldoAmount = ref(0)
const loading = ref(false)
const saldoAwal = ref(0)
const saldoDipakai = ref(0)
const showConfirm = ref(false)

const searchQuery = ref('');

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

function clearSelectedCustomer() {
  selectedCustomer.value = null
  searchQuery.value = ''
  preview.value = null
}

async function processPayment() {
  if (!preview.value) {
    alert("Lakukan preview dulu")
    return
  }

  if (!selectedCustomer.value) return alert("Pilih pelanggan dulu")

  loading.value = true

  // Diskon dihitung sebagai "pembayaran tambahan" yang mengurangi tagihan
  // tanpa perlu uang tunai dari pelanggan.
  let sisa = Number(payAmount.value) + preview.value.discount

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
    discount_amount: preview.value.discount,
    note: "Pembayaran invoice (partial enabled)"
  })

  loading.value = false
  showToast("Pembayaran berhasil diproses")
  // Refresh halaman setelah toast sempat tampil
  setTimeout(() => window.location.reload(), 2200)
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

  const discount = discountAmount.value
  let sisa = Number(payAmount.value) + discount

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
    discount,
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

  saldoAmount.value = 0
  loading.value = false
  showToast("Saldo berhasil ditambahkan")
  setTimeout(() => window.location.reload(), 2200)
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

function openConfirm() {
  showConfirm.value = true
}

async function confirmProcess() {
  showConfirm.value = false
  await processPayment()
}

const formatMonthLabel = (monthStr) => {
  if (!monthStr) return ""

  const [year, month] = monthStr.split("-")
  const date = new Date(Number(year), Number(month) - 1)

  return date.toLocaleString("id-ID", {
    month: "long",
    year: "numeric"
  })
}

const tunggakanLabel = computed(() => {
  if (!unpaidInvoices.value?.length) return ""

  const months = unpaidInvoices.value
    .map(inv => formatMonthLabel(inv.month))
    .sort((a, b) => a.localeCompare(b))

  return months.join(", ")
})

// Filter pelanggan berdasarkan input
const hasSearchQuery = computed(() => searchQuery.value.trim().length > 0)

const filteredCustomers = computed(() => {
  if (!hasSearchQuery.value) return [];
  const query = searchQuery.value.toLowerCase();
  return customers.value.filter(c =>
    c.name.toLowerCase().includes(query) ||
    c.id.toString().includes(query)
  );
});

const hasNoResults = computed(() => hasSearchQuery.value && filteredCustomers.value.length === 0)
</script>

<template>
  <div class="payment-page">

    <!-- ── Pilih Pelanggan ── -->
    <div v-if="!selectedCustomer" class="customer-picker">
      <div class="customer-picker__hint">Pilih pelanggan untuk memproses pembayaran</div>
      <div class="customer-picker__search">
        <PhMagnifyingGlass size="15" class="customer-picker__search-icon" />
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Ketik nama pelanggan..."
          class="customer-picker__input"
        />
        <button v-if="searchQuery" class="customer-picker__clear" @click="searchQuery = ''">
          <PhX size="13" weight="bold" />
        </button>
      </div>

      <div class="candidate-list">
        <p v-if="!hasSearchQuery" class="empty-state">Mulai ketik nama pelanggan untuk mencari</p>
        <p v-else-if="hasNoResults" class="empty-state">Tidak ditemukan pelanggan yang cocok</p>
        <div v-for="c in filteredCustomers" :key="c.id" class="candidate-row" @click="selectCustomer(c)">
          <div class="candidate-row__avatar">{{ c.name.charAt(0) }}</div>
          <div class="candidate-row__name">{{ c.name }}</div>
        </div>
      </div>
    </div>

    <!-- ── Detail Pembayaran ── -->
    <div v-else class="payment-detail">
      <button class="btn-back" @click="clearSelectedCustomer">← Ganti pelanggan</button>

      <div v-if="loading" class="card loading-card">
        <div class="spinner"></div>
        <p>Sedang menyiapkan data...</p>
      </div>

      <template v-else>
        <div class="summary-card">
          <div class="summary-card__profile">
            <div class="summary-card__avatar">{{ selectedCustomer.name.charAt(0) }}</div>
            <div>
              <div class="summary-card__name">{{ selectedCustomer.name }}</div>
              <div class="summary-card__product">{{ selectedCustomer.product_name || 'Tanpa paket' }}</div>
            </div>
          </div>
          <div class="summary-card__stats">
            <div class="summary-card__stat">
              <div class="summary-card__stat-label">Saldo</div>
              <div class="summary-card__stat-value">Rp {{ saldoAwal.toLocaleString('id-ID') }}</div>
            </div>
            <div class="summary-card__stat">
              <div class="summary-card__stat-label">Tunggakan</div>
              <div class="summary-card__stat-value">
                {{ unpaidInvoices.length }} bulan
                <span v-if="unpaidInvoices.length > 0" class="summary-card__stat-hint">({{ tunggakanLabel }})</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="alreadyPaidThisMonth" class="info-banner">
          ✓ Tagihan bulan ini sudah lunas. Saldo tambahan disimpan untuk periode berikutnya.
        </div>

        <div v-if="!alreadyPaidThisMonth" class="card form-section">
          <div class="form-section__title">Nominal Pembayaran</div>
          <div class="amount-input">
            <span class="amount-input__prefix">Rp</span>
            <input type="number" v-model="payAmount" placeholder="0" class="amount-input__field" />
          </div>

          <div class="form-group mt-12">
            <label class="input-label">Promo / Diskon (Opsional)</label>
            <div class="discount-row">
              <div class="discount-toggle">
                <button type="button" :class="{ active: discountType === 'nominal' }" @click="discountType = 'nominal'">Rp</button>
                <button type="button" :class="{ active: discountType === 'percent' }" @click="discountType = 'percent'">%</button>
              </div>
              <input type="number" v-model="discountValue" placeholder="0" class="discount-value-input" />
            </div>
          </div>

          <button class="btn-outline-green" :disabled="payAmount <= 0" @click="simulatePayment">
            Cek Rincian Tagihan
          </button>
        </div>

        <div v-else class="card form-section">
          <div class="form-section__title">Tambah Saldo (Top Up)</div>
          <div class="amount-input">
            <span class="amount-input__prefix">Rp</span>
            <input type="number" v-model="saldoAmount" placeholder="Masukkan nominal saldo..." class="amount-input__field" />
          </div>
          <button class="btn-green full-width mt-12" @click="addSaldoOnly">Konfirmasi Top Up</button>
        </div>

        <div v-if="preview" class="card form-section">
          <div class="form-section__title">Ringkasan Transaksi</div>
          <div class="summary-list">
            <div v-for="i in preview.closed" :key="i.id" class="summary-list__row">
              <span>Lunas: {{ formatMonthId(i.month) }}</span>
              <StatusBadge variant="paid" />
            </div>
            <div v-for="i in preview.partial" :key="i.id" class="summary-list__row">
              <span>Cicil: {{ formatMonthId(i.month) }}</span>
              <span class="text-sm">Rp {{ i.will_pay.toLocaleString('id-ID') }}</span>
            </div>
            <div v-if="preview.discount > 0" class="summary-list__row">
              <span>Diskon{{ discountType === 'percent' ? ` (${discountValue}%)` : '' }}</span>
              <span class="text-green text-bold">- Rp {{ preview.discount.toLocaleString('id-ID') }}</span>
            </div>
          </div>

          <div class="dashed-divider"></div>

          <div class="total-row">
            <span>Estimasi Saldo Akhir</span>
            <span class="total-row__value">Rp {{ preview.saldoAkhir.toLocaleString('id-ID') }}</span>
          </div>

          <p v-if="autoSubscribeUsedThisMonth()" class="hint-text">
            *Saldo akan otomatis memotong tagihan bulan berjalan.
          </p>

          <button class="btn-green full-width mt-12" @click="openConfirm">Konfirmasi Pembayaran</button>
        </div>
      </template>
    </div>

    <SheetModal v-model="showConfirm" title="Konfirmasi Pembayaran" subtitle="Periksa kembali rincian sebelum diproses">
      <div class="confirm-icon"><PhWallet size="22" weight="fill" /></div>
      <div class="confirm-box">
        <div class="confirm-box__row">
          <span>Pelanggan</span>
          <span class="text-bold">{{ selectedCustomer?.name }}</span>
        </div>
        <div class="confirm-box__row">
          <span>Total Bayar</span>
          <span class="text-green text-bold">Rp {{ Number(payAmount || 0).toLocaleString('id-ID') }}</span>
        </div>
      </div>
      <div class="confirm-actions">
        <button class="btn-cancel" @click="showConfirm = false">Batal</button>
        <button class="btn-confirm" @click="confirmProcess">Ya, Proses</button>
      </div>
    </SheetModal>
  </div>
</template>

<style scoped>
.payment-page { max-width: 560px; }

/* ── Customer picker ── */
.customer-picker__hint { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 10px; }

.customer-picker__search {
  position: relative;
  margin-bottom: 12px;
}

.customer-picker__search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
}

.customer-picker__input {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 40px 11px 36px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-card-border);
  background: var(--color-card-bg);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: var(--transition-input);
}

.customer-picker__input:focus { border-color: var(--color-green); }

.customer-picker__clear {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: var(--color-chip-bg);
  color: var(--color-text-tertiary);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.candidate-row {
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: var(--transition-card-clickable);
}

.candidate-row__avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--color-chip-bg);
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.candidate-row__name { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }

.candidate-row:hover {
  transform: translateY(-1px);
  border-color: var(--color-green-tint-border);
}

.empty-state { text-align: center; padding: 32px 20px; color: var(--color-text-secondary); font-size: 13px; }

/* ── Payment detail ── */
.btn-back {
  border: none;
  background: none;
  color: var(--color-green);
  font-size: 12px;
  font-weight: 700;
  padding: 0 0 12px;
  cursor: pointer;
}

.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
  color: var(--color-text-secondary);
}

.spinner {
  width: 36px; height: 36px;
  border: 4px solid var(--color-card-border);
  border-top-color: var(--color-green);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.summary-card {
  background: var(--color-dark-surface);
  border-radius: var(--radius-card-lg);
  padding: 18px 20px;
  color: #FFFFFF;
  margin-bottom: 14px;
}

.summary-card__profile { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.summary-card__avatar {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.12);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 15px;
}
.summary-card__name { font-size: 15px; font-weight: 800; }
.summary-card__product { font-size: 12px; color: var(--color-dark-surface-text); }

.summary-card__stats { display: flex; gap: 10px; }
.summary-card__stat {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px 12px;
}
.summary-card__stat-label { font-size: 10px; color: var(--color-dark-surface-text); font-weight: 600; }
.summary-card__stat-value { font-size: 15px; font-weight: 800; margin-top: 3px; }
.summary-card__stat-hint { font-size: 10px; font-weight: 500; display: block; color: var(--color-dark-surface-text); }

.info-banner {
  background: var(--color-green-tint);
  border: 1px solid var(--color-green-tint-border);
  border-radius: var(--radius-card);
  padding: 14px;
  font-size: 12px;
  color: var(--color-green-hover);
  margin-bottom: 14px;
}

.form-section {
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  padding: 16px 18px;
  margin-bottom: 14px;
}

.form-section__title { font-size: 13px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 12px; }

.form-group { display: flex; flex-direction: column; }
.input-label { font-size: 12px; font-weight: 600; color: var(--color-text-tertiary); margin-bottom: 6px; }

.amount-input {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--color-card-border);
  border-radius: 12px;
  overflow: hidden;
  transition: var(--transition-input);
}

.amount-input__prefix {
  background: var(--color-surface);
  padding: 0 14px;
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  border-right: 1px solid var(--color-card-border);
}

/* ── Diskon segmented toggle ── */
.discount-row { display: flex; gap: 8px; }

.discount-toggle {
  display: flex;
  border: 1px solid var(--color-card-border);
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
}

.discount-toggle button {
  padding: 0 16px;
  height: 38px;
  border: none;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  background: #FFFFFF;
  color: var(--color-text-secondary);
  font-family: inherit;
  transition: background .15s, color .15s;
}

.discount-toggle button:last-child { border-left: 1px solid var(--color-card-border); }
.discount-toggle button.active { background: var(--color-dark-surface); color: #FFFFFF; }

.discount-value-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--color-card-border);
  border-radius: 12px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 700;
  outline: none;
  font-family: inherit;
  transition: var(--transition-input);
}

.discount-value-input:focus { border-color: var(--color-green); }

.amount-input__field {
  flex: 1;
  border: none;
  padding: 11px 14px;
  font-size: 15px;
  font-weight: 700;
  outline: none;
  min-width: 0;
  font-family: inherit;
}

.btn-outline-green {
  width: 100%;
  margin-top: 12px;
  padding: 11px;
  border-radius: var(--radius-pill);
  border: 1.5px solid var(--color-green);
  background: #FFFFFF;
  color: var(--color-green);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.btn-outline-green:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-green {
  padding: 12px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--color-green);
  color: #FFFFFF;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.btn-green:hover { background: var(--color-green-hover); }
.full-width { width: 100%; }
.mt-12 { margin-top: 12px; }

.summary-list__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  padding: 6px 0;
  color: var(--color-text-tertiary);
}

.dashed-divider { border-top: 1px dashed var(--color-card-border); margin: 10px 0; }

.total-row { display: flex; justify-content: space-between; font-size: 14px; }
.total-row__value { color: var(--color-green); font-weight: 800; }

.hint-text { font-size: 11px; color: var(--color-text-secondary); margin-top: 8px; }

.text-sm { font-size: 12px; }
.text-bold { font-weight: 700; }
.text-green { color: var(--color-green); }

/* ── Confirm sheet ── */
.confirm-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-green-tint);
  color: var(--color-green);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
}

.confirm-box {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 16px;
}

.confirm-box__row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 8px;
  color: var(--color-text-secondary);
}

.confirm-box__row:last-child { margin-bottom: 0; }

.confirm-actions { display: flex; gap: 10px; }

.btn-cancel {
  flex: 1;
  padding: 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-card-border);
  background: #FFFFFF;
  color: var(--color-text-tertiary);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.btn-confirm {
  flex: 1;
  padding: 12px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--color-green);
  color: #FFFFFF;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}
</style>
