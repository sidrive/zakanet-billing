<script setup>
import { ref, onMounted, watch, computed } from "vue"
import { addCustomer, getCustomers } from "../services/customerService"
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
                <button class="btn-icon-only">edit</button>
              </td>
            </tr>

            <tr v-if="customers.length === 0">
              <td colspan="6" class="empty-state">
                <div class="empty-box">
                  <p>Belum ada data pelanggan terdaftar.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
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

/* Feedback visual saat input di-disable */
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
