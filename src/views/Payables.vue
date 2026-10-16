<script setup>
import { ref, onMounted, computed } from "vue"
import { PhPlus, PhTrash, PhCalendar, PhBuildings } from "@phosphor-icons/vue"
import { getPayables, addPayable, updatePayable, recordPayablePayment, deletePayable, getPayablePayments } from "../services/payableService"
import SearchInput from "@/components/SearchInput.vue"
import FilterChips from "@/components/FilterChips.vue"
import SheetModal from "@/components/SheetModal.vue"
import StatusBadge from "@/components/StatusBadge.vue"
import { useToast } from "@/composables/useToast"

const { showToast } = useToast()

const payables = ref([])
const paymentHistory = ref([])
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
  supplier_name: "ISP Pusat",
  description: "",
  amount: "",
  due_date: "",
  note: ""
})

// Payment modal inside edit
const paymentAmount = ref("")
const paymentNote = ref("")

async function loadData() {
  try {
    payables.value = await getPayables()
  } catch (err) {
    console.error("Gagal memuat hutang:", err)
  }
}

const filteredPayables = computed(() => {
  return payables.value.filter(item => {
    const matchSearch = (item.supplier_name && item.supplier_name.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
                        item.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchStatus = filterStatus.value === "all" || item.status === filterStatus.value
    return matchSearch && matchStatus
  })
})

function openAdd() {
  form.value = {
    id: "",
    supplier_name: "ISP Pusat",
    description: "",
    amount: "",
    due_date: "",
    note: ""
  }
  isAddOpen.value = true
}

async function openEdit(item) {
  let dateStr = ""
  if (item.due_date) {
    const d = item.due_date.toDate ? item.due_date.toDate() : new Date(item.due_date)
    if (!isNaN(d)) dateStr = d.toISOString().slice(0, 10)
  }
  form.value = {
    id: item.id,
    supplier_name: item.supplier_name || "ISP Pusat",
    description: item.description || "",
    amount: item.amount || 0,
    due_date: dateStr,
    note: item.note || "",
    paid_amount: item.paid_amount || 0,
    status: item.status || "unpaid"
  }
  paymentAmount.value = ""
  paymentNote.value = ""

  try {
    paymentHistory.value = await getPayablePayments(item.id)
  } catch (err) {
    console.error("Gagal memuat riwayat pembayaran hutang:", err)
    paymentHistory.value = []
  }

  isEditOpen.value = true
}

async function submitAdd() {
  if (!form.value.description || !form.value.amount) {
    return alert("Deskripsi material/barang dan nominal hutang wajib diisi.")
  }
  if (Number(form.value.amount) <= 0) {
    return alert("Nominal hutang harus lebih besar dari 0.")
  }

  await addPayable(form.value)
  isAddOpen.value = false
  showToast("Hutang material berhasil dicatat")
  await loadData()
}

async function submitEdit() {
  if (!form.value.description || !form.value.amount) {
    return alert("Deskripsi material/barang dan nominal hutang wajib diisi.")
  }
  if (Number(form.value.amount) <= 0) {
    return alert("Nominal hutang harus lebih besar dari 0.")
  }

  await updatePayable(form.value.id, form.value)
  isEditOpen.value = false
  showToast("Perubahan hutang disimpan")
  await loadData()
}

async function submitPayment() {
  const amountNum = Number(paymentAmount.value)
  if (!amountNum || amountNum <= 0) {
    return alert("Masukkan nominal pembayaran yang valid.")
  }

  const currentRemaining = (form.value.amount || 0) - (form.value.paid_amount || 0)
  if (amountNum > currentRemaining) {
    return alert(`Nominal pembayaran melebihi sisa hutang (Sisa: Rp ${currentRemaining.toLocaleString('id-ID')})`)
  }

  try {
    await recordPayablePayment(form.value.id, amountNum, paymentNote.value)
    showToast("Pembayaran hutang dicatat")
    paymentAmount.value = ""
    paymentNote.value = ""
    isEditOpen.value = false
    await loadData()
  } catch (err) {
    alert(err.message || "Gagal mencatat pembayaran")
  }
}

async function removePayable(id) {
  if (!confirm("Yakin ingin menghapus catatan hutang ini?")) return
  await deletePayable(id)
  isEditOpen.value = false
  showToast("Hutang dihapus")
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
  <div class="payable-page">
    <div class="toolbar">
      <SearchInput v-model="searchQuery" placeholder="Cari material / supplier..." />
      <button class="btn-add" @click="openAdd">
        <PhPlus size="14" weight="bold" /> Catat Hutang Material
      </button>
    </div>

    <div class="filter-wrapper">
      <FilterChips :options="filterOptions" v-model="filterStatus" />
    </div>

    <div class="payable-grid">
      <div v-for="item in filteredPayables" :key="item.id" class="payable-card" @click="openEdit(item)">
        <div class="payable-card__header">
          <div class="supplier-info">
            <PhBuildings size="15" weight="bold" />
            <span class="supplier-name">{{ item.supplier_name }}</span>
          </div>
          <StatusBadge :variant="item.status" />
        </div>

        <div class="payable-card__desc">{{ item.description }}</div>

        <div class="payable-numbers">
          <div class="num-block">
            <span class="label">Total Hutang</span>
            <span class="val">Rp {{ Number(item.amount).toLocaleString('id-ID') }}</span>
          </div>
          <div class="num-block">
            <span class="label">Sisa</span>
            <span class="val remaining">Rp {{ Number(item.amount - (item.paid_amount || 0)).toLocaleString('id-ID') }}</span>
          </div>
        </div>

        <div class="payable-card__footer">
          <span class="meta-item"><PhCalendar size="13" /> Tempo: {{ formatDate(item.due_date) }}</span>
        </div>
      </div>
    </div>

    <p v-if="filteredPayables.length === 0" class="empty-state">Belum ada catatan hutang ke supplier.</p>

    <!-- Modal Tambah -->
    <SheetModal v-model="isAddOpen" title="Catat Hutang Material Baru">
      <div class="sheet-form">
        <div class="form-group">
          <label class="input-label">Supplier / ISP Pusat</label>
          <input v-model="form.supplier_name" placeholder="ISP Pusat" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Deskripsi Material / Barang</label>
          <input v-model="form.description" placeholder="Contoh: Ambil 5 roll kabel & 10 router" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Total Nilai Hutang (Rp)</label>
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
        <button @click="submitAdd" class="btn-green full-width">Simpan Hutang</button>
      </div>
    </SheetModal>

    <!-- Modal Edit & Pembayaran -->
    <SheetModal v-model="isEditOpen" title="Detail & Pembayaran Hutang">
      <div class="sheet-form">
        <div class="status-summary-box">
          <div>Status: <strong>{{ form.status.toUpperCase() }}</strong></div>
          <div>Terbayar: Rp {{ Number(form.paid_amount || 0).toLocaleString('id-ID') }}</div>
          <div>Sisa: <strong>Rp {{ Number((form.amount || 0) - (form.paid_amount || 0)).toLocaleString('id-ID') }}</strong></div>
        </div>

        <!-- Form Bayar Hutang -->
        <div v-if="form.status !== 'paid'" class="payment-box">
          <label class="input-label">Bayar / Cicil Hutang (Rp)</label>
          <div class="payment-input-stack">
            <input v-model="paymentAmount" type="number" placeholder="Nominal bayar" class="main-input" />
            <input v-model="paymentNote" placeholder="Catatan (mis. Digabung setoran bulanan / ganti barang)" class="main-input" />
            <button @click="submitPayment" class="btn-green full-width">Simpan Pembayaran</button>
          </div>
        </div>

        <!-- Riwayat Pembayaran -->
        <div class="history-section">
          <label class="input-label">Riwayat Pembayaran / Pelunasan</label>
          <div v-if="paymentHistory.length > 0" class="history-list">
            <div v-for="pay in paymentHistory" :key="pay.id" class="history-row">
              <div>
                <div class="history-amount">- Rp {{ Number(pay.amount).toLocaleString('id-ID') }}</div>
                <div class="history-note">{{ pay.note || 'Tanpa catatan' }}</div>
              </div>
              <div class="history-date">{{ formatDate(pay.created_at) }}</div>
            </div>
          </div>
          <p v-else class="empty-history">Belum ada riwayat pembayaran.</p>
        </div>

        <hr class="divider" />

        <div class="form-group">
          <label class="input-label">Supplier / ISP Pusat</label>
          <input v-model="form.supplier_name" placeholder="ISP Pusat" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Deskripsi Material / Barang</label>
          <input v-model="form.description" placeholder="Contoh: Ambil 5 roll kabel" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Total Nilai Hutang (Rp)</label>
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
          <button @click="removePayable(form.id)" class="btn-danger"><PhTrash size="16" /> Hapus</button>
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

.payable-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

@media (max-width: 900px) {
  .payable-grid {
    grid-template-columns: 1fr;
  }
}

.payable-card {
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

.payable-card:hover {
  border-color: var(--color-green);
  transform: translateY(-2px);
}

.payable-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.supplier-info {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-primary);
  font-weight: 700;
  font-size: 14px;
}

.payable-card__desc {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.payable-numbers {
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
  color: var(--color-red, #dc2626);
}

.payable-card__footer {
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
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 12px;
  border-radius: 10px;
}

.payment-input-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.history-section {
  margin-top: 8px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
  margin-top: 4px;
}

.history-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-chip-bg);
  border-radius: 8px;
  font-size: 12px;
}

.history-amount {
  font-weight: 700;
  color: var(--color-red);
}

.history-note {
  color: var(--color-text-secondary);
  font-size: 11px;
}

.history-date {
  color: var(--color-text-tertiary);
  font-size: 11px;
}

.empty-history {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-style: italic;
  margin-top: 4px;
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
