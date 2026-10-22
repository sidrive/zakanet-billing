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
const paymentMethod = ref("tunai_transfer") // "tunai_transfer" | "barang"
const paymentItemDescription = ref("")
const paymentCombinedMonthly = ref(false)
const linkExpense = ref(false) // khusus method "barang": sekalian catat pembelian sebagai Pengeluaran
const expensePurchaseAmount = ref("")

const PAYMENT_METHOD_LABEL = {
  tunai_transfer: "Tunai / Transfer",
  barang: "Ganti Barang"
}

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
  paymentMethod.value = "tunai_transfer"
  paymentItemDescription.value = ""
  paymentCombinedMonthly.value = false
  linkExpense.value = false
  expensePurchaseAmount.value = ""

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
  if (paymentMethod.value === "barang" && !paymentItemDescription.value.trim()) {
    return alert("Deskripsi barang wajib diisi untuk pelunasan via ganti barang.")
  }

  const shouldLinkExpense = paymentMethod.value === "barang" && linkExpense.value
  const expenseAmountNum = Number(expensePurchaseAmount.value)
  if (shouldLinkExpense && (!expenseAmountNum || expenseAmountNum <= 0)) {
    return alert("Masukkan nominal pembelian barang (untuk dicatat sebagai pengeluaran) yang valid.")
  }

  const currentRemaining = (form.value.amount || 0) - (form.value.paid_amount || 0)
  if (amountNum > currentRemaining) {
    return alert(`Nominal pembayaran melebihi sisa hutang (Sisa: Rp ${currentRemaining.toLocaleString('id-ID')})`)
  }

  try {
    await recordPayablePayment(
      form.value.id,
      {
        amount: amountNum,
        method: paymentMethod.value,
        item_description: paymentItemDescription.value,
        is_combined_with_monthly_settlement: paymentCombinedMonthly.value,
        note: paymentNote.value
      },
      shouldLinkExpense ? { amount: expenseAmountNum } : null
    )
    showToast(shouldLinkExpense ? "Pembayaran hutang & pengeluaran terkait dicatat" : "Pembayaran hutang dicatat")
    paymentAmount.value = ""
    paymentNote.value = ""
    paymentMethod.value = "tunai_transfer"
    paymentItemDescription.value = ""
    paymentCombinedMonthly.value = false
    linkExpense.value = false
    expensePurchaseAmount.value = ""
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
          <label class="input-label">Bayar / Cicil Hutang</label>
          <div class="payment-input-stack">
            <div class="method-toggle-group">
              <button
                type="button"
                :class="['method-toggle-btn', paymentMethod === 'tunai_transfer' ? 'active' : '']"
                @click="paymentMethod = 'tunai_transfer'; linkExpense = false; expensePurchaseAmount = ''"
              >Tunai / Transfer</button>
              <button
                type="button"
                :class="['method-toggle-btn', paymentMethod === 'barang' ? 'active' : '']"
                @click="paymentMethod = 'barang'"
              >Ganti Barang</button>
            </div>

            <input
              v-model="paymentAmount"
              type="number"
              :placeholder="paymentMethod === 'barang' ? 'Nilai taksiran barang (Rp)' : 'Nominal bayar (Rp)'"
              class="main-input"
            />
            <input
              v-if="paymentMethod === 'barang'"
              v-model="paymentItemDescription"
              placeholder="Deskripsi barang pengganti (wajib)"
              class="main-input"
            />
            <input v-model="paymentNote" placeholder="Catatan tambahan (opsional)" class="main-input" />

            <label class="checkbox-label">
              <input type="checkbox" v-model="paymentCombinedMonthly" />
              Digabung dengan setoran bulanan ke ISP Pusat
            </label>

            <template v-if="paymentMethod === 'barang'">
              <label class="checkbox-label">
                <input type="checkbox" v-model="linkExpense" />
                Barang dibeli dari luar -- sekalian catat sebagai Pengeluaran
              </label>
              <input
                v-if="linkExpense"
                v-model="expensePurchaseAmount"
                type="number"
                placeholder="Nominal pembelian riil barang (Rp)"
                class="main-input"
              />
              <p v-if="linkExpense" class="input-hint">
                Dicatat otomatis di menu Pengeluaran (kategori "Pembelian Perangkat"), terpisah dari
                nilai taksiran di atas -- boleh beda kalau harga beli tidak sama dengan nilai yang
                disepakati untuk melunasi hutang.
              </p>
            </template>

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
                <div class="history-tags">
                  <span class="method-badge" :class="`method-badge--${pay.method || 'tunai_transfer'}`">
                    {{ PAYMENT_METHOD_LABEL[pay.method] || PAYMENT_METHOD_LABEL.tunai_transfer }}
                  </span>
                  <span v-if="pay.is_combined_with_monthly_settlement" class="method-badge method-badge--monthly">+ Setoran Bulanan</span>
                </div>
                <div v-if="pay.method === 'barang' && pay.item_description" class="history-note">Barang: {{ pay.item_description }}</div>
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

/* base.css men-stretch semua <input> (termasuk checkbox) ke width: 100% --
   checkbox butuh ukuran nativenya kembali supaya tidak jadi kotak panjang aneh. */
.checkbox-label input[type="checkbox"] {
  width: auto;
  flex-shrink: 0;
  padding: 0;
}

.payment-input-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.method-toggle-group {
  display: flex;
  gap: 8px;
}

.method-toggle-btn {
  flex: 1;
  padding: 9px;
  border-radius: var(--radius-pill);
  border: 1.5px solid var(--color-card-border);
  background: #FFFFFF;
  color: var(--color-text-secondary);
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}

.method-toggle-btn.active {
  background: var(--color-green-tint);
  color: var(--color-green);
  border-color: var(--color-green);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.input-hint {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin: -2px 0 0;
}

.history-tags {
  display: flex;
  gap: 6px;
  margin: 3px 0;
  flex-wrap: wrap;
}

.method-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--color-chip-bg);
  color: var(--color-text-secondary);
}

.method-badge--barang {
  background: var(--color-orange-tint);
  color: var(--color-orange-text);
}

.method-badge--monthly {
  background: var(--color-green-tint);
  color: var(--color-green);
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
