<script setup>
import { ref, onMounted, computed } from "vue"
import { PhLightning, PhPlus } from "@phosphor-icons/vue"
import { addProduct, getProducts } from "../services/productService"
import SearchInput from "@/components/SearchInput.vue"
import SheetModal from "@/components/SheetModal.vue"
import StatusBadge from "@/components/StatusBadge.vue"
import { useToast } from "@/composables/useToast"

const { showToast } = useToast()

const products = ref([])
const isAddOpen = ref(false)

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

  isAddOpen.value = false
  showToast("Paket berhasil disimpan")
  await loadProducts()
}

onMounted(loadProducts)
</script>

<template>
  <div class="product-page">
    <div class="product-toolbar">
      <SearchInput v-model="searchQuery" placeholder="Cari paket..." />
      <button class="btn-add-product" @click="isAddOpen = true">
        <PhPlus size="14" weight="bold" /> Buat Paket Baru
      </button>
    </div>

    <div class="product-grid">
      <div v-for="p in filteredProducts" :key="p.id" class="product-card">
        <div class="product-card__icon">
          <PhLightning size="18" weight="fill" />
        </div>
        <div class="product-card__name">{{ p.name }}</div>
        <div class="product-card__meta">{{ p.speed || '0' }} Mbps · Rp {{ p.price.toLocaleString('id-ID') }}/bln</div>
        <StatusBadge :variant="p.is_active ? 'active' : 'inactive'" class="product-card__badge" />
      </div>
    </div>

    <p v-if="filteredProducts.length === 0" class="empty-state">Belum ada paket layanan.</p>

    <SheetModal v-model="isAddOpen" title="Buat Paket Baru">
      <div class="sheet-form">
        <div class="form-group">
          <label class="input-label">Nama Paket</label>
          <input v-model="name" placeholder="Contoh: Home Ultra" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Kecepatan (Mbps)</label>
          <input v-model="speed" type="number" placeholder="0" class="main-input" />
        </div>
        <div class="form-group">
          <label class="input-label">Harga Bulanan (Rp)</label>
          <input v-model="price" type="number" placeholder="0" class="main-input" />
        </div>
        <button @click="submitProduct" class="btn-green full-width">Simpan Paket</button>
      </div>
    </SheetModal>
  </div>
</template>

<style scoped>
.product-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 18px;
}

.btn-add-product {
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

.product-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

@media (max-width: 900px) {
  .product-grid {
    grid-template-columns: 1fr;
  }
}

.product-card {
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  padding: 18px;
  box-shadow: var(--shadow-card);
  transition: var(--transition-card);
}

.product-card__icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--color-orange-tint);
  color: var(--color-orange-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.product-card__name {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.product-card__meta {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.product-card__badge {
  display: inline-block;
  margin-top: 12px;
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

.sheet-form .main-input {
  padding: 11px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-card-border);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  width: 100%;
  box-sizing: border-box;
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
}

.btn-green:hover {
  background: var(--color-green-hover);
}

.full-width {
  width: 100%;
}
</style>
