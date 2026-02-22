<script setup>
import { ref, onMounted, computed } from "vue"
import { addProduct, getProducts } from "../services/productService"

const products = ref([])

const name = ref("")
const speed = ref("")
const price = ref("")
const searchQuery = ref('');

async function loadProducts() {
  products.value = await getProducts()
}

const filteredProducts = computed(() => {
  return products.value.filter(p => 
    p.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

async function submitProduct() {
  if (!name.value || !price.value) {
    return alert("Nama & harga wajib diisi")
  }

  await addProduct({
    name: name.value,
    speed: speed.value ? Number(speed.value) : null,
    price: Number(price.value)
  })

  name.value = ""
  speed.value = ""
  price.value = ""

  await loadProducts()
}

onMounted(loadProducts)
</script>

<template>
  <div class="product-page">
    <header class="section-header">
      <div>
        <h2 class="section-title">Paket Layanan Internet</h2>
        <p class="section-subtitle">Atur penawaran kecepatan dan harga langganan bulanan</p>
      </div>
    </header>

    <div class="card form-card mb-24">
      <h4 class="card-inner-title">Buat Paket Baru</h4>
      <div class="form-grid-product">
        <div class="form-group">
          <label class="input-label">Nama Paket</label>
          <input v-model="name" placeholder="Contoh: Home Ultra" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Kecepatan (Mbps)</label>
          <div class="input-group">
            <input v-model="speed" type="number" placeholder="0" class="main-input" />
            <span class="input-addon">Mbps</span>
          </div>
        </div>
        <div class="form-group">
          <label class="input-label">Harga Bulanan</label>
          <div class="input-group">
            <span class="input-addon">Rp</span>
            <input v-model="price" type="number" placeholder="0" class="main-input" />
          </div>
        </div>
        <div class="form-actions align-self-end">
          <button @click="submitProduct" class="btn-green full-width">
             Simpan Paket
          </button>
        </div>
      </div>
    </div>

    <div class="card no-padding">
      <div class="card-header-table">
        <h4 class="card-inner-title">Daftar Paket Saat Ini</h4>
        <div class="search-box">
          <input v-model="searchQuery" type="text" placeholder="Cari paket..." class="search-input" />
        </div>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Detail Paket</th>
              <th>Kecepatan</th>
              <th>Harga Jual</th>
              <th>Status</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in filteredProducts" :key="p.id">
              <td>
                <div class="product-info-cell">
                  <div class="icon-pkg">⚡</div>
                  <div class="col-name">{{ p.name }}</div>
                </div>
              </td>
              <td>
                <span class="speed-badge">{{ p.speed || '0' }} Mbps</span>
              </td>
              <td>
                <span class="text-bold">Rp {{ p.price.toLocaleString() }}</span>
              </td>
              <td>
                <span class="badge" :class="p.is_active ? 'badge-success' : 'badge-danger'">
                  {{ p.is_active ? 'Aktif' : 'Nonaktif' }}
                </span>
              </td>
              <td class="text-center">
                <button class="btn-icon-only">⚙️</button>
              </td>
            </tr>
            <tr v-if="filteredProducts.length === 0">
              <td colspan="5" class="empty-state">Belum ada paket layanan.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>


<style scoped>
.form-grid-product {
  display: grid;
  grid-template-columns: 2fr 1fr 1.5fr 1fr;
  gap: 16px;
  align-items: flex-end;
}

.input-group {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.input-group .main-input {
  border: none !important;
  border-radius: 0 !important;
}

.input-addon {
  background: #f8fafc;
  padding: 0 12px;
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  border-left: 1px solid var(--border);
}

/* Khusus addon Rp (kiri) */
.input-group span:first-child {
  border-left: none;
  border-right: 1px solid var(--border);
}

.product-info-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-pkg {
  font-size: 20px;
  background: #fff9db;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}

.speed-badge {
  background: var(--primary-light);
  color: var(--primary);
  padding: 4px 10px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 12px;
}

@media (max-width: 900px) {
  .form-grid-product {
    grid-template-columns: 1fr;
  }
}
</style>
