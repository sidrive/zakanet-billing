<script setup>
import { ref, onMounted, computed } from "vue"
import { PhPlus, PhHandCoins, PhTrash, PhCalendar, PhUser, PhCheckCircle, PhWarning } from "@phosphor-icons/vue"
import { getReceivables, addReceivable, updateReceivable, recordPayment, deleteReceivable } from "../services/receivableService"
import SearchInput from "@/components/SearchInput.vue"
import FilterChips from "@/components/FilterChips.vue"
import SheetModal from "@/components/SheetModal.vue"
import StatusBadge from "@/components/StatusBadge.vue"
import { useToast } from "@/composables/useToast"

const { showToast } = useToast()

const receivables = ref([])
const searchQuery = ref("")
const filterStatus = ref("all")

const filterOptions = [
  { key: "all", label: "Semua" },
  { key: "unpaid", label: "Belum Lunas" },
  { key: "partial", label: "Sebagian" },
  { key: "paid", label: "Lunas" },
]

// Modal & Form State
const isAddOpen = ref(false)
const isEditOpen = ref(false)

const form = ref({
  id: "",
  debtor_name: "",
  description: "",
  amount: "",
  due_date: "",
  note: ""
})

// Payment modal inside edit
const paymentAmount = ref("")

async function loadData() {
  try {
    receivables.value = await getReceivables()
  } catch (err) {
    console.error("Gagal memuat piutang:", err)
  }
}

const filteredReceivables = computed(() => {
  return receivables.value.filter(item => {
    const matchSearch = item.debtor_name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                        item.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchStatus = filterStatus.value === "all" || item.status === filterStatus.value
    return matchSearch && matchStatus
  })
})

function openAdd() {
  form.value = {
    id: "",
    debtor_name: "",
    description: "",
    amount: "",
    due_date: "",
    note: ""
  }
  isAddOpen.value = true
}

function openEdit(item) {
  let dateStr = ""
  if (item.due_date) {
    const d = item.due_date.toDate ? item.due_date.toDate() : new Date(item.due_date)
    if (!isNaN(d)) dateStr = d.toISOString().slice(0, 10)
  }
  form.value = {
    id: item.id,
    debtor_name: item.debtor_name || "",
    description: item.description || "",
    amount: item.amount || 0,
    due_date: dateStr,
    note: item.note || "",
    paid_amount: item.paid_amount || 0,
    status: item.status || "unpaid"
  }
  paymentAmount.value = ""
  isEditOpen.value = true
}

async function submitAdd() {
  if (!form.value.debtor_name || !form.value.description || !form.value.amount) {
    return alert("Nama debitur, deskripsi, dan nominal piutang wajib diisi.")
  }
  if (Number(form.value.amount) <= 0) {
    return alert("Nominal piutang harus lebih besar dari 0.")
  }

  await addReceivable(form.value)
  isAddOpen.value = false
  showToast("Piutang berhasil dicatat")
  await loadData()
}

async function submitEdit() {
  if (!form.value.debtor_name || !form.value.description || !form.value.amount) {
    return alert("Nama debitur, deskripsi, dan nominal piutang wajib diisi.")
  }
  if (Number(form.value.amount) <= 0) {
    return alert("Nominal piutang harus lebih besar dari 0.")
  }

  await updateReceivable(form.value.id, form.value)
  isEditOpen.value = false
  showToast("Perubahan piutang disimpan")
  await loadData()
}

async function submitPayment() {
  const amountNum = Number(paymentAmount.value)
  if (!amountNum || amountNum <= 0) {
    return alert("Masukkan nominal pembayaran yang valid.")
  }

  const currentRemaining = (form.value.amount || 0) - (form.value.paid_amount || 0)
  if (amountNum > currentRemaining) {
    return alert(`Nominal pembayaran melebihi sisa piutang (Sisa: Rp ${currentRemaining.toLocaleString('id-ID')})`)
  }

  try {
    await recordPayment(form.value.id, amountNum)
    showToast("Pembayaran cicilan berhasil dicatat")
    paymentAmount.value = ""
    isEditOpen.value = false
    await loadData()
  } catch (err) {
    alert(err.message || "Gagal mencatat pembayaran")
  }
}

async function removeReceivable(id) {
  if (!confirm("Yakin ingin menghapus catatan piutang ini?")) return
  await deleteReceivable(id)
  isEditOpen.value = false
  showToast("Piutang dihapus")
  await loadData()
}

const MONTHS_FULL_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

function formatDate(ts) {
  if (!ts) return "-"
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d)) return "-"
  return `${d.getDate()} ${MONTHS_FULL_ID[d.getMonth()]} ${d.getFullYear()}`
}

onMounted(loadData)
</script>

<template>
  <div class="receivable-page">
    <div class="toolbar">
      <SearchInput v-model="searchQuery" placeholder="Cari nama debitur..." />
      <button class="btn-add" @click="openAdd">
        <PhPlus size="14" weight="bold" /> Catat Piutang
      </button>
    </div>

    <div class="filter-wrapper">
      <FilterChips :options="filterOptions" v-model="filterStatus" />
    </div>

    <div class="receivable-grid">
      <div v-for="item in filteredReceivables" :key="item.id" class="receivable-card" @click="openEdit(item)">
        <div class="receivable-card__header">
          <div class="debtor-info">
            <PhUser size="15" weight="bold" />
            <span class="debtor-name">{{ item.debtor_name }}</span>
          </div>
          <StatusBadge :variant="item.status" />
        </div>

        <div class="receivable-card__desc">{{ item.description }}</div>

        <div class="receivable-numbers">
          <div class="num-block">
            <span class="label">Total Piutang</span>
            <span class="val">Rp {{ Number(item.amount).toLocaleString('id-ID') }}</span>
          </div>
          <div class="num-block">
            <span class="label">Sisa</span>
            <span class="val remaining">Rp {{ Number(item.amount - (item.paid_amount || 0)).toLocaleString('id-ID') }}</span>
          </div>
        </div>

        <div class="receivable-card__footer">
          <span class="meta-item"><PhCalendar size="13" /> Tempo: {{ formatDate(item.due_date) }}</span>
        </div>
      </div>
    </div>

    <p v-if="filteredReceivables.length === 0" class="empty-state">Belum ada catatan piutang.</p>

    <!-- Modal Tambah -->
    <SheetModal v-model="isAddOpen" title="Catat Piutang Baru">
      <div class="sheet-form">
        <div class="form-group">
          <label class="input-label">Nama Debitur / Pihak</label>
          <input v-model="form.debtor_name" placeholder="Contoh: Toko Berkah" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Keterangan / Alasan Piutang</label>
          <input v-model="form.description" placeholder="Contoh: Talangan bayar bandwidth" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Total Nominal (Rp)</label>
          <input v-model="form.amount" type="number" placeholder="0" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Jatuh Tempo (Opsional)</label>
          <input v-model="form.due_date" type="date" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Catatan (Opsional)</label>
          <textarea v-model="form.note" placeholder="Keterangan tambahan..." class="main-input textarea"></textarea>
        </div>
        <button @click="submitAdd" class="btn-green full-width">Simpan Piutang</button>
      </div>
    </SheetModal>

    <!-- Modal Edit & Pembayaran -->
    <SheetModal v-model="isEditOpen" title="Detail & Pembayaran Piutang">
      <div class="sheet-form">
        <div class="status-summary-box">
          <div>Status: <strong>{{ form.status.toUpperCase() }}</strong></div>
          <div>Terbayar: Rp {{ Number(form.paid_amount || 0).toLocaleString('id-ID') }}</div>
          <div>Sisa: <strong>Rp {{ Number((form.amount || 0) - (form.paid_amount || 0)).toLocaleString('id-ID') }}</strong></div>
        </div>

        <div v-if="form.status !== 'paid'" class="payment-box">
          <label class="input-label">Catat Pembayaran / Cicilan (Rp)</label>
          <div class="payment-input-row">
            <input v-model="paymentAmount" type="number" placeholder="Nominal bayar" class="main-input" />
            <button @click="submitPayment" class="btn-green btn-pay">Bayar</button>
          </div>
        </div>

        <hr class="divider" />

        <div class="form-group">
          <label class="input-label">Nama Debitur / Pihak</label>
          <input v-model="form.debtor_name" placeholder="Contoh: Toko Berkah" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Keterangan / Alasan Piutang</label>
          <input v-model="form.description" placeholder="Contoh: Talangan bayar bandwidth" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Total Nominal (Rp)</label>
          <input v-model="form.amount" type="number" placeholder="0" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Jatuh Tempo (Opsional)</label>
          <input v-model="form.due_date" type="date" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Catatan (Opsional)</label>
          <textarea v-model="form.note" placeholder="Keterangan tambahan..." class="main-input textarea"></textarea>
        </div>
        <div class="button-row">
          <button @click="submitEdit" class="btn-green flex-1">Simpan Perubahan</button>
          <button @click="removeReceivable(form.id)" class="btn-danger"><PhTrash size="16" /> Hapus</button>
        </div>
      </div>
    </SheetModal>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}

.filter-wrapper {
  margin-bottom: 18px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.btn-add {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 20px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--color-dark-surface);
  color: #FFFFFF;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.receivable-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

@media (max-width: 900px) {
  .receivable-grid {
    grid-template-columns: 1fr;
  }
}

.receivable-card {
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: var(--transition-card);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.receivable-card:hover {
  border-color: var(--color-green);
  transform: translateY(-2px);
}

.receivable-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.debtor-info {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-primary);
  font-weight: 700;
  font-size: 14px;
}

.receivable-card__desc {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.receivable-numbers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  background: var(--color-chip-bg);
  padding: 10px;
  border-radius: 8px;
}

.num-block {
  display: flex;
  flex-direction: column;
}

.num-block .label {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.num-block .val {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.num-block .val.remaining {
  color: var(--color-orange-icon, #d97706);
}

.receivable-card__footer {
  display: flex;
  font-size: 11px;
  color: var(--color-text-secondary);
  border-top: 1px solid var(--color-card-border);
  padding-top: 8px;
  margin-top: 2px;
}

.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.sheet-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-summary-box {
  background: var(--color-chip-bg);
  padding: 12px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.payment-box {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 12px;
  border-radius: 10px;
}

.payment-input-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.btn-pay {
  margin-top: 0 !important;
  padding: 0 16px !important;
  white-space: nowrap;
}

.divider {
  border: none;
  border-top: 1px solid var(--color-card-border);
  margin: 4px 0;
}

.main-input {
  padding: 11px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-card-border);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  background: var(--color-input-bg, #ffffff);
  color: var(--color-text-primary);
}

.textarea {
  resize: vertical;
  min-height: 80px;
}

.input-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  margin-bottom: 4px;
  display: block;
}

.btn-green {
  margin-top: 6px;
  padding: 13px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--color-green);
  color: #FFFFFF;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  text-align: center;
}

.btn-green:hover {
  background: var(--color-green-hover);
}

.btn-danger {
  margin-top: 6px;
  padding: 13px 20px;
  border-radius: var(--radius-pill);
  border: none;
  background: #fee2e2;
  color: #dc2626;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}

.btn-danger:hover {
  background: #fecaca;
}

.full-width {
  width: 100%;
}

.button-row {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.flex-1 {
  flex: 1;
}
</style>
