<script setup>
import { ref, onMounted, computed } from "vue"
import { PhPlus, PhTrash, PhCalendar, PhWallet, PhUser, PhGear } from "@phosphor-icons/vue"
import { getRevenues, addRevenue, updateRevenue, deleteRevenue } from "../services/revenueService"
import { getCategories, addCategory, deleteCategory } from "../services/categoryService"
import SearchInput from "@/components/SearchInput.vue"
import FilterChips from "@/components/FilterChips.vue"
import SheetModal from "@/components/SheetModal.vue"
import { useToast } from "@/composables/useToast"

const { showToast } = useToast()

const revenues = ref([])
const categories = ref([])
const searchQuery = ref("")
const filterCategory = ref("all")

const filterOptions = computed(() => {
  return [
    { key: "all", label: "Semua" },
    ...categories.value.map(c => ({ key: c.name, label: c.name }))
  ]
})

// Modal & Form State
const isAddOpen = ref(false)
const isEditOpen = ref(false)
const isManageCategoryOpen = ref(false)
const isSubmitting = ref(false)
const newCategoryName = ref("")

const form = ref({
  id: "",
  category: "",
  description: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  payer_name: "",
  payment_method: "Tunai",
  note: ""
})

async function loadData() {
  try {
    const [revRes, catRes] = await Promise.all([
      getRevenues(),
      getCategories("revenue")
    ])
    revenues.value = revRes
    categories.value = catRes
    if (catRes.length > 0 && !form.value.category) {
      form.value.category = catRes[0].name
    }
  } catch (err) {
    console.error("Gagal memuat pendapatan lain/kategori:", err)
  }
}

const filteredRevenues = computed(() => {
  return revenues.value.filter(item => {
    const matchSearch = item.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                        item.category.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                        (item.payer_name && item.payer_name.toLowerCase().includes(searchQuery.value.toLowerCase()))
    const matchCategory = filterCategory.value === "all" || item.category === filterCategory.value
    return matchSearch && matchCategory
  })
})

function openAdd() {
  form.value = {
    id: "",
    category: categories.value[0]?.name || "Penjualan Perangkat",
    description: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    payer_name: "",
    payment_method: "Tunai",
    note: ""
  }
  isAddOpen.value = true
}

function openEdit(item) {
  let dateStr = new Date().toISOString().slice(0, 10)
  if (item.date) {
    const d = item.date.toDate ? item.date.toDate() : new Date(item.date)
    if (!isNaN(d)) dateStr = d.toISOString().slice(0, 10)
  }
  form.value = {
    id: item.id,
    category: item.category,
    description: item.description,
    amount: item.amount,
    date: dateStr,
    payer_name: item.payer_name || "",
    payment_method: item.payment_method || "Tunai",
    note: item.note || ""
  }
  isEditOpen.value = true
}

async function submitAdd() {
  if (isSubmitting.value) return
  if (!form.value.description || !form.value.amount || !form.value.date) {
    return alert("Deskripsi, nominal, dan tanggal wajib diisi.")
  }
  if (Number(form.value.amount) <= 0) {
    return alert("Nominal harus lebih besar dari 0.")
  }

  isSubmitting.value = true
  try {
    await addRevenue(form.value)
    isAddOpen.value = false
    showToast("Pendapatan lain berhasil dicatat")
    await loadData()
  } catch (err) {
    console.error("Gagal menambah pendapatan:", err)
    alert(err.message || "Gagal menambah pendapatan")
  } finally {
    isSubmitting.value = false
  }
}

async function submitEdit() {
  if (isSubmitting.value) return
  if (!form.value.description || !form.value.amount || !form.value.date) {
    return alert("Deskripsi, nominal, dan tanggal wajib diisi.")
  }
  if (Number(form.value.amount) <= 0) {
    return alert("Nominal harus lebih besar dari 0.")
  }

  isSubmitting.value = true
  try {
    await updateRevenue(form.value.id, form.value)
    isEditOpen.value = false
    showToast("Perubahan pendapatan lain disimpan")
    await loadData()
  } catch (err) {
    console.error("Gagal mengupdate pendapatan:", err)
    alert(err.message || "Gagal mengupdate pendapatan")
  } finally {
    isSubmitting.value = false
  }
}

async function removeRevenue(id) {
  if (!confirm("Yakin ingin menghapus catatan pendapatan ini?")) return
  try {
    await deleteRevenue(id)
    isEditOpen.value = false
    showToast("Pendapatan dihapus")
    await loadData()
  } catch (err) {
    console.error("Gagal menghapus pendapatan:", err)
    alert(err.message || "Gagal menghapus pendapatan")
  }
}

async function handleAddCategory() {
  if (isSubmitting.value) return
  if (!newCategoryName.value.trim()) return alert("Nama kategori wajib diisi")
  isSubmitting.value = true
  try {
    await addCategory("revenue", newCategoryName.value)
    newCategoryName.value = ""
    categories.value = await getCategories("revenue")
    showToast("Kategori baru ditambahkan")
  } catch (err) {
    alert(err.message || "Gagal menambah kategori")
  } finally {
    isSubmitting.value = false
  }
}

async function handleRemoveCategory(id) {
  if (!confirm("Hapus kategori ini?")) return
  try {
    await deleteCategory(id)
    categories.value = await getCategories("revenue")
    showToast("Kategori dihapus")
  } catch (err) {
    alert("Gagal menghapus kategori")
  }
}

const MONTHS_FULL_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

function formatDate(ts) {
  if (!ts) return ""
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d)) return ""
  return `${d.getDate()} ${MONTHS_FULL_ID[d.getMonth()]} ${d.getFullYear()}`
}

onMounted(loadData)
</script>

<template>
  <div class="revenue-page">
    <div class="toolbar">
      <SearchInput v-model="searchQuery" placeholder="Cari pendapatan lain..." />
      <div class="toolbar-actions">
        <button class="btn-manage" @click="isManageCategoryOpen = true" title="Kelola Kategori">
          <PhGear size="16" /> Kelola Kategori
        </button>
        <button class="btn-add" @click="openAdd">
          <PhPlus size="14" weight="bold" /> Catat Pendapatan
        </button>
      </div>
    </div>

    <div class="filter-wrapper">
      <FilterChips :options="filterOptions" v-model="filterCategory" />
    </div>

    <div class="revenue-grid">
      <div v-for="item in filteredRevenues" :key="item.id" class="revenue-card" @click="openEdit(item)">
        <div class="revenue-card__header">
          <span class="category-badge">{{ item.category }}</span>
          <span class="revenue-amount">+ Rp {{ Number(item.amount).toLocaleString('id-ID') }}</span>
        </div>
        <div class="revenue-card__desc">{{ item.description }}</div>
        <div v-if="item.payer_name" class="revenue-card__payer">
          <PhUser size="13" /> Pembeli: <strong>{{ item.payer_name }}</strong>
        </div>
        <div class="revenue-card__footer">
          <span class="meta-item"><PhCalendar size="13" /> {{ formatDate(item.date) }}</span>
          <span class="meta-item"><PhWallet size="13" /> {{ item.payment_method }}</span>
        </div>
      </div>
    </div>

    <p v-if="filteredRevenues.length === 0" class="empty-state">Belum ada catatan pendapatan lain.</p>

    <!-- Modal Tambah -->
    <SheetModal v-model="isAddOpen" title="Catat Pendapatan Lain">
      <div class="sheet-form">
        <div class="form-group">
          <label class="input-label">Kategori</label>
          <select v-model="form.category" class="main-input">
            <option v-for="cat in categories" :key="cat.id" :value="cat.name">{{ cat.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="input-label">Deskripsi / Keterangan</label>
          <input v-model="form.description" placeholder="Contoh: Penjualan Router TP-Link" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Nama Pembeli / Pihak (Opsional)</label>
          <input v-model="form.payer_name" placeholder="Nama pelanggan / pembeli" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Nominal Total (Rp)</label>
          <input v-model="form.amount" type="number" placeholder="0" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Tanggal</label>
          <input v-model="form.date" type="date" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Metode Pembayaran</label>
          <select v-model="form.payment_method" class="main-input">
            <option value="Tunai">Tunai</option>
            <option value="Transfer">Transfer</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>
        <div class="form-group">
          <label class="input-label">Catatan (Opsional)</label>
          <textarea v-model="form.note" placeholder="Keterangan tambahan..." class="main-input textarea"></textarea>
        </div>
        <button @click="submitAdd" :disabled="isSubmitting" class="btn-green full-width">
          {{ isSubmitting ? "Menyimpan..." : "Simpan Pendapatan" }}
        </button>
      </div>
    </SheetModal>

    <!-- Modal Edit -->
    <SheetModal v-model="isEditOpen" title="Edit Pendapatan Lain">
      <div class="sheet-form">
        <div class="form-group">
          <label class="input-label">Kategori</label>
          <select v-model="form.category" class="main-input">
            <option v-for="cat in categories" :key="cat.id" :value="cat.name">{{ cat.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="input-label">Deskripsi / Keterangan</label>
          <input v-model="form.description" placeholder="Contoh: Penjualan Router TP-Link" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Nama Pembeli / Pihak (Opsional)</label>
          <input v-model="form.payer_name" placeholder="Nama pelanggan / pembeli" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Nominal (Rp)</label>
          <input v-model="form.amount" type="number" placeholder="0" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Tanggal</label>
          <input v-model="form.date" type="date" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Metode Pembayaran</label>
          <select v-model="form.payment_method" class="main-input">
            <option value="Tunai">Tunai</option>
            <option value="Transfer">Transfer</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>
        <div class="form-group">
          <label class="input-label">Catatan (Opsional)</label>
          <textarea v-model="form.note" placeholder="Keterangan tambahan..." class="main-input textarea"></textarea>
        </div>
        <div class="button-row">
          <button @click="submitEdit" :disabled="isSubmitting" class="btn-green flex-1">
            {{ isSubmitting ? "Menyimpan..." : "Simpan Perubahan" }}
          </button>
          <button @click="removeRevenue(form.id)" :disabled="isSubmitting" class="btn-danger"><PhTrash size="16" /> Hapus</button>
        </div>
      </div>
    </SheetModal>

    <!-- Modal Kelola Kategori -->
    <SheetModal v-model="isManageCategoryOpen" title="Kelola Kategori Pendapatan Lain">
      <div class="sheet-form">
        <div class="payment-input-row">
          <input v-model="newCategoryName" placeholder="Nama kategori baru..." class="main-input" />
          <button @click="handleAddCategory" class="btn-green btn-pay">Tambah</button>
        </div>

        <div class="category-list">
          <div v-for="cat in categories" :key="cat.id" class="category-row">
            <span>{{ cat.name }}</span>
            <button class="btn-icon-danger" @click="handleRemoveCategory(cat.id)" title="Hapus">
              <PhTrash size="14" />
            </button>
          </div>
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
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
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

.btn-manage {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 11px 16px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-card-border);
  background: var(--color-card-bg);
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}
.btn-manage:hover { background: var(--color-page-bg); }

.category-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
  max-height: 250px;
  overflow-y: auto;
}

.category-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}

.btn-icon-danger {
  background: #fee2e2;
  border: none;
  color: #dc2626;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.btn-icon-danger:hover { background: #fecaca; }

.revenue-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

@media (max-width: 900px) {
  .revenue-grid {
    grid-template-columns: 1fr;
  }
}

.revenue-card {
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: var(--transition-card);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.revenue-card:hover {
  border-color: var(--color-green);
  transform: translateY(-2px);
}

.revenue-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-chip-bg);
  color: var(--color-text-secondary);
}

.revenue-amount {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-green, #16a34a);
}

.revenue-card__desc {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.revenue-card__payer {
  font-size: 12px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.revenue-card__footer {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: var(--color-text-secondary);
  border-top: 1px solid var(--color-card-border);
  padding-top: 8px;
  margin-top: 2px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
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

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
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

.payment-input-row {
  display: flex;
  gap: 8px;
}

.btn-pay {
  margin-top: 0 !important;
  padding: 0 16px !important;
  white-space: nowrap;
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
