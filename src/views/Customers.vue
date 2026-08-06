<script setup>
import { ref, onMounted, watch, computed } from "vue"
import { PhPlus } from "@phosphor-icons/vue"
import { addCustomer, getCustomers, updateCustomer } from "../services/customerService"
import { getActiveProducts } from "../services/productService"
import SearchInput from "@/components/SearchInput.vue"
import FilterChips from "@/components/FilterChips.vue"
import SheetModal from "@/components/SheetModal.vue"
import StatusBadge from "@/components/StatusBadge.vue"
import { useToast } from "@/composables/useToast"

const { showToast } = useToast()

const customers = ref([])
const products = ref([])

// form state (tambah pelanggan)
const isAddOpen = ref(false)
const name = ref("")
const phone = ref("")
const address = ref("")
const productId = ref("")
const price = ref("")
const password = ref("")
const searchQuery = ref("")
const filterStatus = ref("all")

const filterOptions = [
  { key: "all", label: "Semua" },
  { key: "active", label: "Aktif" },
  { key: "inactive", label: "Nonaktif" },
]

const isSubmitting = ref(false);
const isLoadingList = ref(false);

// ── Edit Sheet ────────────────────────────────────────────
const isEditOpen   = ref(false)
const isUpdating   = ref(false)
const isEditDatePickerOpen = ref(false)
const isEditPasswordOpen   = ref(false)
const editForm     = ref({
  id: "", name: "", phone: "", address: "",
  product_id: "", product_name: "", custom_price: "", is_active: true,
  join_date: "", balance: 0, password: "", has_password: false
})

function openEdit(customer) {
  let joinDateStr = ""
  if (customer.join_date) {
    const d = customer.join_date.toDate ? customer.join_date.toDate() : new Date(customer.join_date)
    joinDateStr = d.toISOString().slice(0, 10)
  }
  editForm.value = {
    id:           customer.id,
    name:         customer.name         ?? "",
    phone:        customer.phone        ?? "",
    address:      customer.address      ?? "",
    product_id:   customer.product_id   ?? "",
    product_name: customer.product_name ?? "",
    custom_price: customer.custom_price ?? "",
    is_active:    customer.is_active    ?? true,
    join_date:    joinDateStr,
    balance:      customer.balance      ?? 0,
    password:     "",
    has_password: !!customer.password_hash
  }
  isEditDatePickerOpen.value = false
  // Password belum diatur → paksa terbuka supaya admin wajib mengisinya.
  isEditPasswordOpen.value = !editForm.value.has_password
  isEditOpen.value = true
}

// auto-fill harga saat ganti paket di form edit
watch(() => editForm.value.product_id, (val) => {
  const p = products.value.find(x => x.id === val)
  if (p) {
    editForm.value.custom_price  = p.price
    editForm.value.product_name  = p.name
  }
})

async function submitEdit() {
  if (!editForm.value.name || !editForm.value.phone) {
    return alert("Nama dan No HP wajib diisi")
  }
  if (!editForm.value.has_password && !editForm.value.password) {
    return alert("Password cek tagihan wajib diisi untuk pelanggan ini")
  }
  isUpdating.value = true
  try {
    await updateCustomer(editForm.value.id, editForm.value)
    await loadCustomers()
    isEditOpen.value = false
    showToast("Perubahan pelanggan disimpan")
  } finally {
    isUpdating.value = false
  }
}

const MONTHS_SHORT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
const MONTHS_FULL_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

const toDate = (ts) => {
  if (!ts) return null
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return isNaN(d) ? null : d
}

const joinShort = (ts) => {
  const d = toDate(ts)
  return d ? `Bergabung ${MONTHS_SHORT_ID[d.getMonth()]} ${d.getFullYear()}` : "Pelanggan Lama"
}

const joinFull = (ts) => {
  const d = toDate(ts)
  return d ? `${d.getDate()} ${MONTHS_FULL_ID[d.getMonth()]} ${d.getFullYear()}` : ""
}

const filteredCustomers = computed(() => {
  return customers.value.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (customer.phone && customer.phone.includes(searchQuery.value));

    const matchesStatus =
      filterStatus.value === 'all' ||
      (filterStatus.value === 'active' && customer.is_active) ||
      (filterStatus.value === 'inactive' && !customer.is_active);

    return matchesSearch && matchesStatus;
  });
});

async function loadCustomers() {
  isLoadingList.value = true;

  try {
    customers.value = await getCustomers();
  } catch (error) {
    console.error("Gagal memuat data pelanggan:", error);
  } finally {
    isLoadingList.value = false;
  }
}

async function loadProducts() {
  products.value = await getActiveProducts()
}

// auto isi harga saat pilih paket
watch(productId, (val) => {
  const p = products.value.find(x => x.id === val)
  if (p) {
    price.value = p.price
  }
})

async function submitCustomer() {
  if (!name.value || !phone.value || !productId.value) {
    return alert("Nama, HP, dan paket wajib diisi")
  }
  if (!password.value) {
    return alert("Password cek tagihan wajib diisi")
  }

  const product = products.value.find(p => p.id === productId.value)
  isSubmitting.value = true;

  await addCustomer({
    name: name.value,
    phone: phone.value,
    address: address.value,
    product_id: product.id,
    product_name: product.name,
    custom_price: Number(price.value),
    password: password.value
  })

  // reset
  name.value = ""
  phone.value = ""
  address.value = ""
  productId.value = ""
  price.value = ""
  password.value = ""

  isSubmitting.value = false;
  isAddOpen.value = false
  showToast("Pelanggan berhasil disimpan")
  await loadCustomers()
}

onMounted(() => {
  loadProducts()
  loadCustomers()
})
</script>

<template>
  <div class="customer-page">
    <div class="customer-toolbar">
      <SearchInput v-model="searchQuery" placeholder="Cari nama atau no HP" class="customer-toolbar__search" />
      <div class="customer-toolbar__filters">
        <FilterChips :options="filterOptions" v-model="filterStatus" />
      </div>
      <button class="btn-add-customer" @click="isAddOpen = true">
        <PhPlus size="16" weight="bold" /> <span class="btn-add-customer__label">Tambah</span>
      </button>
    </div>

    <div v-if="isLoadingList" class="card loading-card">
      <div class="spinner"></div>
      <p>Memuat data pelanggan...</p>
    </div>

    <template v-else>
      <div class="customer-grid">
        <div v-for="c in filteredCustomers" :key="c.id" class="customer-card" @click="openEdit(c)">
          <div class="customer-card__top">
            <div class="customer-card__avatar">{{ c.name.charAt(0) }}</div>
            <div class="customer-card__info">
              <div class="customer-card__name">{{ c.name }}</div>
              <div class="customer-card__phone">{{ c.phone || 'No HP -' }} · {{ joinShort(c.join_date) }}</div>
            </div>
            <StatusBadge :variant="c.is_active ? 'active' : 'inactive'" />
          </div>
          <div class="customer-card__footer">
            <span>{{ c.product_name || 'Tanpa Paket' }} · Rp {{ c.custom_price.toLocaleString('id-ID') }}</span>
            <span v-if="c.balance > 0" class="customer-card__balance">Saldo Rp {{ c.balance.toLocaleString('id-ID') }}</span>
          </div>
        </div>
      </div>

      <p v-if="filteredCustomers.length === 0" class="empty-state">Tidak ada pelanggan yang cocok.</p>
    </template>

    <!-- ── Tambah Pelanggan ── -->
    <SheetModal v-model="isAddOpen" title="Tambah Pelanggan" subtitle="Isi data pelanggan baru">
      <div class="sheet-form">
        <div class="form-group">
          <label class="input-label">Nama Lengkap</label>
          <input v-model="name" placeholder="Contoh: Budi Santoso" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Nomor WhatsApp</label>
          <input v-model="phone" placeholder="0812..." class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Pilih Paket Internet</label>
          <select v-model="productId" class="main-input">
            <option value="">-- Pilih Paket --</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="input-label">Harga Custom (Rp)</label>
          <input v-model="price" type="number" placeholder="Harga paket" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Alamat Pemasangan</label>
          <textarea v-model="address" placeholder="Alamat lengkap lokasi pelanggan" class="main-input" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label class="input-label">Password Cek Tagihan</label>
          <input v-model="password" type="password" placeholder="Wajib diisi" class="main-input" />
          <p class="input-hint">Dipakai pelanggan untuk cek tagihan sendiri lewat website</p>
        </div>
        <button
          @click="submitCustomer"
          class="btn-green full-width"
          :class="{ 'btn-loading': isSubmitting }"
          :disabled="isSubmitting"
        >
          <span v-if="!isSubmitting">Simpan Pelanggan</span>
          <span v-else class="loader-flex"><div class="mini-spinner"></div> Menyimpan...</span>
        </button>
      </div>
    </SheetModal>

    <!-- ── Edit Pelanggan ── -->
    <SheetModal v-model="isEditOpen" :title="`Edit ${editForm.name}`" subtitle="Perubahan akan langsung tersimpan ke database">
      <div v-if="editForm.balance > 0" class="saldo-info-row">
        <span>Saldo Deposit</span>
        <span class="saldo-info-row__value">Rp {{ editForm.balance.toLocaleString('id-ID') }}</span>
      </div>
      <div class="sheet-form">
        <div class="form-group">
          <label class="input-label">Nama Lengkap</label>
          <input v-model="editForm.name" placeholder="Nama pelanggan" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Nomor WhatsApp</label>
          <input v-model="editForm.phone" placeholder="0812..." class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Pilih Paket Internet</label>
          <select v-model="editForm.product_id" class="main-input">
            <option value="">-- Pilih Paket --</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="input-label">Harga Custom (Rp)</label>
          <input v-model="editForm.custom_price" type="number" placeholder="Harga paket" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Alamat Pemasangan</label>
          <textarea v-model="editForm.address" placeholder="Alamat lengkap" class="main-input" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label class="input-label">Tanggal Bergabung</label>
          <div v-if="!isEditDatePickerOpen" class="join-date-display">
            <span v-if="editForm.join_date">Bergabung sejak {{ joinFull(editForm.join_date) }}</span>
            <span v-else>Tanggal bergabung belum diatur</span>
            <button type="button" class="link-btn" @click="isEditDatePickerOpen = true">Ubah tanggal</button>
          </div>
          <input v-else v-model="editForm.join_date" type="date" class="main-input main-input--focused" />
          <p class="input-hint">Mempengaruhi awal tagihan &amp; eligibilitas promo</p>
        </div>
        <div class="form-group">
          <label class="input-label">Password Cek Tagihan</label>
          <div v-if="editForm.has_password && !isEditPasswordOpen" class="join-date-display">
            <span>Password sudah diatur</span>
            <button type="button" class="link-btn" @click="isEditPasswordOpen = true">Ubah password</button>
          </div>
          <template v-else>
            <input v-model="editForm.password" type="password" placeholder="Wajib diisi" class="main-input main-input--focused" />
            <p v-if="!editForm.has_password" class="input-hint input-hint--warning">Belum diatur — wajib diisi supaya pelanggan bisa cek tagihan</p>
            <p v-else class="input-hint">Kosongkan &amp; simpan tanpa mengubah kalau tidak ingin mengganti password</p>
          </template>
        </div>
        <div class="form-group">
          <label class="input-label">Status Pelanggan</label>
          <div class="status-toggle-group">
            <button type="button" :class="['toggle-btn', editForm.is_active ? 'active' : '']" @click="editForm.is_active = true">Aktif</button>
            <button type="button" :class="['toggle-btn', 'danger-btn', !editForm.is_active ? 'active-danger' : '']" @click="editForm.is_active = false">Nonaktif</button>
          </div>
        </div>
        <button
          class="btn-green full-width"
          :class="{ 'btn-loading': isUpdating }"
          :disabled="isUpdating"
          @click="submitEdit"
        >
          <span v-if="!isUpdating">Simpan Perubahan</span>
          <span v-else class="loader-flex"><div class="mini-spinner"></div> Menyimpan...</span>
        </button>
      </div>
    </SheetModal>
  </div>
</template>

<style scoped>
.customer-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.customer-toolbar__search { order: 1; }
.customer-toolbar__filters { order: 2; }
.btn-add-customer { order: 3; }

@media (max-width: 900px) {
  .btn-add-customer { order: 2; }

  .customer-toolbar__filters {
    order: 3;
    flex-basis: 100%;
  }
}

.btn-add-customer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  background: var(--color-dark-surface);
  color: #FFFFFF;
  border: none;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.customer-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

@media (max-width: 900px) {
  .customer-grid { grid-template-columns: 1fr; }

  .btn-add-customer {
    width: 38px;
    height: 38px;
    padding: 0;
    justify-content: center;
    border-radius: 50%;
  }

  .btn-add-customer__label { display: none; }
}

.customer-card {
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  padding: 16px;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: var(--transition-card-clickable);
}

.customer-card:hover {
  transform: translateY(-1px);
  border-color: var(--color-green-tint-border);
}

.customer-card__top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.customer-card__avatar {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--color-green-tint);
  color: var(--color-green);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.customer-card__info { flex: 1; min-width: 0; }
.customer-card__name { font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
.customer-card__phone { font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }

.customer-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-divider);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.customer-card__balance {
  flex-shrink: 0;
  font-weight: 700;
  color: var(--color-green);
  background: var(--color-green-tint);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
}

.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 16px;
  color: var(--color-text-secondary);
}

.spinner {
  width: 40px; height: 40px;
  border: 4px solid var(--color-card-border);
  border-top-color: var(--color-green);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Saldo Deposit info (edit sheet) ── */
.saldo-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-green-tint);
  border: 1px solid var(--color-green-tint-border);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-green-hover);
}

.saldo-info-row__value { font-size: 14px; font-weight: 800; }

/* ── Tanggal Bergabung (edit-on-demand) ── */
.join-date-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-surface);
  border: 1px solid var(--color-card-border);
  border-radius: 10px;
  padding: 11px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.link-btn {
  border: none;
  background: none;
  color: var(--color-green);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.main-input--focused { border-color: var(--color-green); }

/* ── Sheet form ── */
.sheet-form { display: flex; flex-direction: column; gap: 12px; }
.form-group { display: flex; flex-direction: column; }
.input-label { font-size: 12px; font-weight: 600; color: var(--color-text-tertiary); margin-bottom: 4px; }

.main-input {
  padding: 11px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-card-border);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  resize: none;
  transition: var(--transition-input);
}

.main-input:focus { border-color: var(--color-green); }

.input-hint { font-size: 11px; color: var(--color-text-secondary); margin-top: 5px; }
.input-hint--warning { color: var(--color-red); font-weight: 600; }

.full-width { width: 100%; }

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
}

.btn-green:hover:not(:disabled) { background: var(--color-green-hover); }
.btn-loading { opacity: 0.8; cursor: not-allowed; }

.loader-flex { display: flex; align-items: center; justify-content: center; gap: 8px; }
.mini-spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.status-toggle-group { display: flex; gap: 8px; margin-top: 4px; }
.toggle-btn {
  flex: 1;
  padding: 10px;
  border-radius: var(--radius-pill);
  border: 1.5px solid var(--color-card-border);
  background: #FFFFFF;
  color: var(--color-text-secondary);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.toggle-btn.active {
  background: var(--color-green-tint);
  color: var(--color-green);
  border-color: var(--color-green);
}

.toggle-btn.danger-btn.active-danger {
  background: var(--color-red-tint);
  color: var(--color-red);
  border-color: var(--color-red);
}
</style>
