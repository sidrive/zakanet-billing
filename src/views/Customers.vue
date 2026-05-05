<script setup>
import { ref, onMounted, watch, computed } from "vue"
import { addCustomer, getCustomers, updateCustomer } from "../services/customerService"
import { getActiveProducts } from "../services/productService"

const customers = ref([])
const products = ref([])

// form state
const name = ref("")
const phone = ref("")
const address = ref("")
const productId = ref("")
const price = ref("")
const searchQuery = ref("")
const filterStatus = ref("all")

const isSubmitting = ref(false);
const isLoadingList = ref(false);

// ── Edit Dialog ────────────────────────────────────────────
const isEditOpen   = ref(false)
const isUpdating   = ref(false)
const editForm     = ref({
  id: "", name: "", phone: "", address: "",
  product_id: "", product_name: "", custom_price: "", is_active: true,
  join_date: ""
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
    join_date:    joinDateStr
  }
  isEditOpen.value = true
  document.body.style.overflow = "hidden"
}

function closeEdit() {
  isEditOpen.value = false
  document.body.style.overflow = ""
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
  isUpdating.value = true
  try {
    await updateCustomer(editForm.value.id, editForm.value)
    await loadCustomers()
    closeEdit()
  } finally {
    isUpdating.value = false
  }
}

const formatJoinDate = (ts) => {
  if (!ts) return null
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

const filteredCustomers = computed(() => {
  return customers.value.filter((customer) => {
    // Validasi Search (Nama atau No HP)
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (customer.phone && customer.phone.includes(searchQuery.value));

    // Validasi Status
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

  const product = products.value.find(p => p.id === productId.value)
  isSubmitting.value = true;

  await addCustomer({
    name: name.value,
    phone: phone.value,
    address: address.value,
    product_id: product.id,
    product_name: product.name,
    custom_price: Number(price.value)
  })

  // reset
  name.value = ""
  phone.value = ""
  address.value = ""
  productId.value = ""
  price.value = ""

  await loadCustomers()
  isSubmitting.value = false;
}

onMounted(() => {
  loadProducts()
  loadCustomers()
})
</script>

<!-- <template>
 <Card style="margin-bottom:16px">
  <h4>Tambah Pelanggan</h4>
  <div class="form-grid">
    <input v-model="name" placeholder="Nama" />
    <input v-model="phone" placeholder="No HP" />
    <input v-model="address" placeholder="Alamat" />
    <select v-model="productId">
      <option value="">Pilih Paket</option>
      <option v-for="p in products" :key="p.id" :value="p.id">
        {{ p.name }}
      </option>
    </select>
    <input v-model="price" type="number" placeholder="Harga" />
    <button @click="submitCustomer">Simpan</button>
  </div>
</Card>

<div class="card mt-24">
  <h4>Daftar Pelanggan</h4>

  <div class="table-wrapper">
    <table class="data-table">
      <thead>
        <tr>
          <th>Nama</th>
          <th>Paket</th>
          <th>Harga</th>
          <th>Saldo</th>
          <th>Status</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="c in customers" :key="c.id">
          <td class="col-name">{{ c.name }}</td>
          <td>{{ c.product_name || '-' }}</td>
          <td>Rp {{ c.custom_price.toLocaleString() }}</td>
          <td>
            <span v-if="c.balance > 0">
              Rp {{ c.balance.toLocaleString() }}
            </span>
            <span v-else>-</span>
          </td>
          <td>
            <span
              class="badge"
              :class="c.is_active ? 'badge-success' : 'badge-danger'"
            >
              {{ c.is_active ? 'Aktif' : 'Nonaktif' }}
            </span>
          </td>
        </tr>

        <tr v-if="customers.length === 0">
          <td colspan="5" class="empty">
            Belum ada pelanggan
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
</template> -->

<template>
  <div class="customer-page">
    <header class="section-header">
      <div>
        <h2 class="section-title">Kelola Pelanggan</h2>
        <p class="section-subtitle">Daftarkan pelanggan baru atau kelola data yang sudah ada</p>
      </div>
    </header>

    <div class="card form-card mb-24">
      <h4 class="card-inner-title">Tambah Pelanggan Baru</h4>
      <div class="form-grid-modern">
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
        <div class="form-group full-width">
          <label class="input-label">Alamat Pemasangan</label>
          <textarea v-model="address" placeholder="Alamat lengkap lokasi pelanggan" class="main-input" rows="2"></textarea>
        </div>
        <div class="form-actions full-width">
          <button 
            @click="submitCustomer" 
            class="btn-green" 
            :class="{ 'btn-loading': isSubmitting }"
            :disabled="isSubmitting"
          >
            <span v-if="!isSubmitting">+ Simpan Pelanggan</span>
            <span v-else class="loader-flex">
              <div class="mini-spinner"></div> Menyimpan...
            </span>
          </button>
        </div>
      </div>
    </div>

    <div class="card no-padding">
      <div class="card-header-table">
        <h4 class="card-inner-title">Daftar Pelanggan</h4>
        <div class="filter-group">
          <select v-model="filterStatus" class="search-input select-filter">
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
          
          <div class="search-wrapper">
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Cari nama atau no HP..." 
              class="search-input" 
            />
          </div>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Info Pelanggan</th>
              <th>Paket</th>
              <th>Bergabung</th>
              <th>Biaya Bulanan</th>
              <th>Saldo Deposit</th>
              <th>Status</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="isLoadingList" v-for="n in 3" :key="'loader-' + n">
              <td colspan="5">
                <div class="skeleton-row">
                  <div class="skeleton-avatar"></div>
                  <div class="skeleton-text"></div>
                </div>
              </td>
            </tr>
            <tr v-else v-for="c in filteredCustomers" :key="c.id">
              <td>
                <div class="customer-info-cell">
                  <div class="mini-avatar">{{ c.name.charAt(0) }}</div>
                  <div>
                    <div class="col-name">{{ c.name }}</div>
                    <div class="col-subtext">{{ c.phone || 'No HP -' }}</div>
                  </div>
                </div>
              </td>
              <td>
                <div class="pkg-badge">{{ c.product_name || 'Tanpa Paket' }}</div>
              </td>
              <td>
                <span v-if="formatJoinDate(c.join_date)" class="text-sm">
                  {{ formatJoinDate(c.join_date) }}
                </span>
                <span v-else class="text-muted text-sm">Pelanggan Lama</span>
              </td>
              <td>
                <span class="text-bold">Rp {{ c.custom_price.toLocaleString() }}</span>
              </td>
              <td>
                <span v-if="c.balance > 0" class="text-green text-bold">
                  Rp {{ c.balance.toLocaleString() }}
                </span>
                <span v-else class="text-muted">Rp 0</span>
              </td>
              <td>
                <span class="badge" :class="c.is_active ? 'badge-success' : 'badge-danger'">
                  {{ c.is_active ? 'Aktif' : 'Nonaktif' }}
                </span>
              </td>
              <td class="text-center">
                <button class="btn-icon-edit" @click="openEdit(c)" title="Edit pelanggan">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
              </td>
            </tr>

            <tr v-if="customers.length === 0">
              <td colspan="7" class="empty-state">
                <div class="empty-box">
                  <p>Belum ada data pelanggan terdaftar.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <!-- ── Edit Dialog ─────────────────────────────────────── -->
    <Transition name="dialog-fade">
      <div v-if="isEditOpen" class="dialog-overlay" @click.self="closeEdit">
        <div class="dialog-card">

          <div class="dialog-header">
            <div>
              <h4 class="dialog-title">Edit Data Pelanggan</h4>
              <p class="dialog-subtitle">Perubahan akan langsung tersimpan ke database</p>
            </div>
            <button class="btn-close" @click="closeEdit" aria-label="Tutup">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="dialog-body">
            <div class="form-grid-modern">

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

              <div class="form-group full-width">
                <label class="input-label">Alamat Pemasangan</label>
                <textarea v-model="editForm.address" placeholder="Alamat lengkap" class="main-input" rows="2"></textarea>
              </div>

              <div class="form-group">
                <label class="input-label">Tanggal Bergabung</label>
                <input
                  v-model="editForm.join_date"
                  type="date"
                  class="main-input"
                />
                <p class="input-hint">Mempengaruhi awal tagihan &amp; eligibilitas promo</p>
              </div>

              <div class="form-group full-width">
                <label class="input-label">Status Pelanggan</label>
                <div class="status-toggle-group">
                  <button
                    type="button"
                    :class="['toggle-btn', editForm.is_active ? 'active' : '']"
                    @click="editForm.is_active = true"
                  >
                    <span class="toggle-dot"></span> Aktif
                  </button>
                  <button
                    type="button"
                    :class="['toggle-btn', 'danger-btn', !editForm.is_active ? 'active-danger' : '']"
                    @click="editForm.is_active = false"
                  >
                    <span class="toggle-dot"></span> Nonaktif
                  </button>
                </div>
              </div>

            </div>
          </div>

          <div class="dialog-footer">
            <button class="btn-cancel" @click="closeEdit" :disabled="isUpdating">Batal</button>
            <button
              class="btn-green"
              :class="{ 'btn-loading': isUpdating }"
              :disabled="isUpdating"
              @click="submitEdit"
            >
              <span v-if="!isUpdating">Simpan Perubahan</span>
              <span v-else class="loader-flex">
                <div class="mini-spinner"></div> Menyimpan...
              </span>
            </button>
          </div>

        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
/* Header Styling */
.section-header { margin-bottom: 24px; }
.section-title { font-size: 24px; font-weight: 800; color: var(--text-main); }
.section-subtitle { font-size: 14px; color: var(--text-muted); }

/* Form Grid Modern */
.form-grid-modern {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.full-width { grid-column: 1 / -1; }
.card-inner-title { font-size: 16px; font-weight: 700; margin-bottom: 18px; color: var(--text-main); }

/* Table Improvements */
.no-padding { padding: 0; overflow: hidden; }
.card-header-table {
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
}

.customer-info-cell { display: flex; align-items: center; gap: 12px; }
.mini-avatar {
  width: 32px; height: 32px; background: var(--primary-light); color: var(--primary);
  border-radius: 8px; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px;
}

.col-subtext { font-size: 12px; color: var(--text-muted); }
.pkg-badge {
  background: #f1f5f9; padding: 4px 8px; border-radius: 6px;
  font-size: 12px; font-weight: 600; color: #475569; display: inline-block;
}

.text-bold { font-weight: 700; }
.text-center { text-align: center; }

/* Search Box */
.search-input {
  background: #f8fafc; border: 1px solid var(--border);
  padding: 8px 16px; border-radius: 100px; font-size: 13px; width: 200px;
}

/* Empty State */
.empty-state { padding: 48px !important; text-align: center; color: var(--text-muted); }

/* Responsive */
@media (max-width: 600px) {
  .card-header-table { flex-direction: column; align-items: flex-start; gap: 12px; }
  .search-input { width: 100%; }
}

.filter-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.select-filter {
  width: auto !important;
  cursor: pointer;
  background-color: #fff;
}

.search-wrapper {
  position: relative;
}

/* Responsive: Di mobile, filter jadi tumpuk vertikal */
@media (max-width: 600px) {
  .filter-group {
    flex-direction: column;
    width: 100%;
    align-items: stretch;
  }
  
  .select-filter, .search-input {
    width: 100% !important;
  }
}

.btn-loading {
  opacity: 0.8;
  cursor: not-allowed;
  background: var(--primary-dark) !important;
}

.loader-flex {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.mini-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Edit Button ── */
.btn-icon-edit {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 100px;
  background: #F1F5F9; color: #475569;
  border: 1px solid #E2E8F0;
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all 0.15s;
}
.btn-icon-edit:hover { background: var(--primary-light); color: var(--primary); border-color: var(--primary); }

/* ── Dialog Overlay ── */
.dialog-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}

.dialog-card {
  background: white; border-radius: 20px;
  width: 100%; max-width: 560px;
  max-height: 90vh; overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.18);
  display: flex; flex-direction: column;
}

/* Dialog Header */
.dialog-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 24px 28px 0; gap: 12px;
}
.dialog-title    { font-size: 18px; font-weight: 800; color: var(--text-main); }
.dialog-subtitle { font-size: 13px; color: var(--text-muted); margin-top: 3px; }

.btn-close {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  background: #F1F5F9; border: none; cursor: pointer; color: #475569;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.btn-close:hover { background: #FEE2E2; color: var(--danger); }

/* Dialog Body */
.dialog-body { padding: 20px 28px; flex: 1; }

/* Dialog Footer */
.dialog-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 16px 28px 24px; border-top: 1px solid var(--border);
}

.btn-cancel {
  padding: 10px 22px; border-radius: 100px;
  background: white; border: 1px solid var(--border);
  font-size: 14px; font-weight: 600; cursor: pointer; color: var(--text-muted);
  transition: background 0.15s;
}
.btn-cancel:hover:not(:disabled) { background: #F1F5F9; }
.btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }

/* Status Toggle */
.status-toggle-group { display: flex; gap: 10px; margin-top: 4px; }

.toggle-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 20px; border-radius: 100px;
  border: 1.5px solid var(--border); font-size: 13px; font-weight: 600;
  cursor: pointer; background: white; color: var(--text-muted);
  transition: all 0.15s;
}
.toggle-btn.active {
  background: var(--primary-light); color: var(--primary);
  border-color: var(--primary);
}
.toggle-btn .toggle-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }

.danger-btn { color: var(--text-muted); }
.danger-btn.active-danger {
  background: #FEE2E2; color: var(--danger); border-color: var(--danger);
}

/* Dialog animation */
.dialog-fade-enter-active, .dialog-fade-leave-active { transition: opacity 0.2s ease; }
.dialog-fade-enter-from,  .dialog-fade-leave-to      { opacity: 0; }
.dialog-fade-enter-active .dialog-card { animation: slideUp 0.22s ease; }

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

@media (max-width: 600px) {
  .dialog-card    { border-radius: 16px; }
  .dialog-header  { padding: 20px 20px 0; }
  .dialog-body    { padding: 16px 20px; }
  .dialog-footer  { padding: 14px 20px 20px; flex-direction: column-reverse; }
  .btn-cancel, .btn-green { width: 100%; justify-content: center; }
}

.text-sm    { font-size: 12px; }
.text-muted { color: var(--text-muted); }

/* ── Input hint text ── */
.input-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 5px;
}

/* ── Feedback visual saat input di-disable ── */
.main-input:disabled {
  background-color: #f1f5f9;
  cursor: not-allowed;
  color: #94a3b8;
}

/* Container untuk loading row */
.skeleton-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

/* Animasi Pulse */
.shadow-pulse {
  animation: pulse 1.5s infinite ease-in-out;
}

.skeleton-avatar {
  width: 32px;
  height: 32px;
  background: #f1f5f9;
  border-radius: 8px;
  flex-shrink: 0;
}

.skeleton-line {
  height: 14px;
  background: #f1f5f9;
  border-radius: 4px;
  width: 60%;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}
</style>
