<script setup>
import { computed, onMounted, ref } from "vue"
import {
  PhArrowLeft,
  PhCaretRight,
  PhClockCounterClockwise,
  PhCloudCheck,
  PhHandCoins,
  PhUsers,
  PhWarningCircle
} from "@phosphor-icons/vue"
import SearchInput from "@/components/SearchInput.vue"
import FilterChips from "@/components/FilterChips.vue"
import StatusBadge from "@/components/StatusBadge.vue"
import { useCustomerPayments } from "@/composables/useCustomerPayments"
import { formatMonthId } from "@/utils/date"

const {
  loading,
  loadingHistory,
  error,
  customers,
  selectedCustomer,
  historyRows,
  historyTotals,
  loadCustomers,
  openCustomer,
  closeDetail
} = useCustomerPayments()

const search = ref("")
const statusFilter = ref("all") // all | active | inactive
const historyFilter = ref("paid") // paid | outstanding | all

const statusOptions = [
  { key: "all", label: "Semua" },
  { key: "active", label: "Aktif" },
  { key: "inactive", label: "Nonaktif" }
]

const historyOptions = [
  { key: "paid", label: "Sudah Dibayar" },
  { key: "outstanding", label: "Belum Lunas" },
  { key: "all", label: "Semua Tagihan" }
]

onMounted(loadCustomers)

// ── Formatter ────────────────────────────────────────────────
const formatRupiah = (val) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(val || 0))

const formatDate = (value) => {
  if (!value) return "-"
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d)) return "-"
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

// ── Landing: ringkasan & daftar pelanggan ────────────────────
const overview = computed(() => {
  const list = customers.value
  return {
    total: list.length,
    active: list.filter(c => c.isActive).length,
    paidCustomers: list.filter(c => c.totalPaid > 0).length,
    totalPaid: list.reduce((sum, c) => sum + c.totalPaid, 0)
  }
})

const filteredCustomers = computed(() => {
  const keyword = search.value.toLowerCase().trim()

  return customers.value.filter(c => {
    const matchKeyword =
      !keyword ||
      c.name.toLowerCase().includes(keyword) ||
      c.productName.toLowerCase().includes(keyword) ||
      (c.phone || "").includes(keyword)

    const matchStatus =
      statusFilter.value === "all" ||
      (statusFilter.value === "active" ? c.isActive : !c.isActive)

    return matchKeyword && matchStatus
  })
})

// ── Detail: riwayat pembayaran ───────────────────────────────
const filteredHistory = computed(() => {
  const rows = historyRows.value

  if (historyFilter.value === "paid") return rows.filter(r => r.hasPayment)
  if (historyFilter.value === "outstanding") return rows.filter(r => r.outstanding > 0)
  return rows
})

const detailStats = computed(() => {
  const totals = historyTotals.value
  if (!totals) return []

  return [
    { label: "Lama Berlangganan", value: selectedCustomer.value?.durationLabel || "-" },
    { label: "Total Tagihan", value: formatRupiah(totals.totalBilled) },
    { label: "Total Dibayar", value: formatRupiah(totals.totalPaid), variant: "green" },
    { label: "Tunggakan", value: formatRupiah(totals.outstanding), variant: totals.outstanding > 0 ? "red" : "" }
  ]
})

// Kalau `paid_at` tidak tersimpan, tetap tampilkan bulan tagihan terakhir
// yang sudah dibayar -- jangan tampilkan "-" seolah tidak pernah bayar.
function lastPaymentLabel(customer) {
  if (customer.lastPaidAt) return formatDate(customer.lastPaidAt)
  if (customer.lastPaidMonth) return formatMonthId(customer.lastPaidMonth)
  return "-"
}

function paymentSource(row) {
  if (row.autoSubscribed) return "Saldo otomatis"
  if (row.status === "paid") return "Bayar manual"
  if (row.status === "partial") return "Bayar sebagian"
  return "-"
}
</script>

<template>
  <div class="customer-payments">
    <!-- ==================== LANDING: DAFTAR PELANGGAN ==================== -->
    <template v-if="!selectedCustomer">
      <div class="toolbar">
        <SearchInput v-model="search" placeholder="Cari nama pelanggan, paket, atau no HP..." />
      </div>

      <div class="filter-wrapper">
        <FilterChips :options="statusOptions" v-model="statusFilter" />
      </div>

      <div v-if="loading" class="card loading-card">
        <div class="spinner"></div>
        <p>Memuat data pelanggan...</p>
      </div>

      <div v-else-if="error" class="card error-card">
        <PhWarningCircle size="20" weight="bold" />
        <p>Gagal memuat laporan: {{ error }}</p>
      </div>

      <template v-else>
        <div class="summary-strip">
          <div class="summary-item">
            <PhUsers size="16" weight="bold" class="summary-icon" />
            <div>
              <span class="summary-label">Total Pelanggan</span>
              <span class="summary-value">{{ overview.total }}</span>
            </div>
          </div>
          <div class="summary-item">
            <PhCloudCheck size="16" weight="bold" class="summary-icon" />
            <div>
              <span class="summary-label">Pelanggan Aktif</span>
              <span class="summary-value">{{ overview.active }}</span>
            </div>
          </div>
          <div class="summary-item">
            <PhHandCoins size="16" weight="bold" class="summary-icon" />
            <div>
              <span class="summary-label">Pernah Bayar</span>
              <span class="summary-value">{{ overview.paidCustomers }}</span>
            </div>
          </div>
          <div class="summary-item summary-item--accent">
            <div>
              <span class="summary-label">Total Diterima</span>
              <span class="summary-value">{{ formatRupiah(overview.totalPaid) }}</span>
            </div>
          </div>
        </div>

        <div class="customer-grid">
          <button
            v-for="c in filteredCustomers"
            :key="c.id"
            type="button"
            class="customer-card"
            @click="openCustomer(c)"
          >
            <div class="customer-card__top">
              <div class="customer-card__avatar">{{ c.name.charAt(0).toUpperCase() }}</div>
              <div class="customer-card__info">
                <span class="customer-card__name">{{ c.name }}</span>
                <span class="customer-card__meta">{{ c.productName }}</span>
              </div>
              <StatusBadge :variant="c.isActive ? 'active' : 'inactive'" />
            </div>

            <div class="customer-card__duration">
              <PhClockCounterClockwise size="14" weight="bold" />
              <span>Berlangganan {{ c.durationLabel }}</span>
            </div>

            <div class="customer-card__numbers">
              <div class="num-block">
                <span class="num-label">Total Dibayar</span>
                <span class="num-value" :class="c.totalPaid > 0 ? 'num-value--green' : ''">{{ formatRupiah(c.totalPaid) }}</span>
              </div>
              <div class="num-block">
                <span class="num-label">Tagihan Lunas</span>
                <span class="num-value">{{ c.paidCount }}/{{ c.invoiceCount }}</span>
              </div>
            </div>

            <div class="customer-card__footer">
              <span class="footer-line">Gabung {{ formatDate(c.joinDate) }}</span>
              <span class="footer-line">Bayar terakhir {{ lastPaymentLabel(c) }}</span>
              <PhCaretRight size="13" weight="bold" class="customer-card__chevron" />
            </div>
          </button>
        </div>

        <p v-if="filteredCustomers.length === 0" class="empty-state">
          Tidak ada pelanggan yang cocok dengan pencarian.
        </p>
      </template>
    </template>

    <!-- ==================== DETAIL: RIWAYAT PEMBAYARAN ==================== -->
    <template v-else>
      <button type="button" class="btn-back" @click="closeDetail">
        <PhArrowLeft size="15" weight="bold" /> Kembali ke daftar pelanggan
      </button>

      <div class="card detail-header">
        <div class="detail-header__main">
          <div class="detail-avatar">{{ selectedCustomer.name.charAt(0).toUpperCase() }}</div>
          <div class="detail-identity">
            <h3 class="detail-name">{{ selectedCustomer.name }}</h3>
            <p class="detail-meta">
              {{ selectedCustomer.productName }}
              <span v-if="selectedCustomer.phone"> · {{ selectedCustomer.phone }}</span>
            </p>
            <p class="detail-sub">
              Bergabung {{ formatDate(selectedCustomer.joinDate) }} · berlangganan
              <strong>{{ selectedCustomer.durationLabel }}</strong>
            </p>
          </div>
          <StatusBadge :variant="selectedCustomer.isActive ? 'active' : 'inactive'" />
        </div>

        <div v-if="detailStats.length" class="detail-stats">
          <div v-for="stat in detailStats" :key="stat.label" class="detail-stat">
            <span class="num-label">{{ stat.label }}</span>
            <span class="num-value" :class="stat.variant === 'green' ? 'num-value--green' : stat.variant === 'red' ? 'num-value--red' : ''">
              {{ stat.value }}
            </span>
          </div>
        </div>
      </div>

      <div class="detail-toolbar">
        <FilterChips :options="historyOptions" v-model="historyFilter" />
        <span class="detail-count">{{ filteredHistory.length }} tagihan</span>
      </div>

      <div v-if="loadingHistory" class="card loading-card">
        <div class="spinner"></div>
        <p>Memuat riwayat pembayaran...</p>
      </div>

      <div v-else-if="error" class="card error-card">
        <PhWarningCircle size="20" weight="bold" />
        <p>Gagal memuat riwayat: {{ error }}</p>
      </div>

      <div v-else-if="filteredHistory.length === 0" class="card empty-card">
        <p class="empty-state">
          {{ historyRows.length === 0
            ? "Pelanggan ini belum punya catatan tagihan."
            : "Tidak ada tagihan pada filter ini." }}
        </p>
      </div>

      <div v-else class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Bulan Tagihan</th>
              <th class="text-right">Tagihan</th>
              <th class="text-right">Dibayar</th>
              <th class="text-right">Sisa</th>
              <th>Status</th>
              <th>Tanggal Bayar</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredHistory" :key="row.id">
              <td class="cell-month">{{ formatMonthId(row.month) }}</td>
              <td class="text-right">{{ formatRupiah(row.amount) }}</td>
              <td class="text-right cell-paid">{{ formatRupiah(row.paidAmount) }}</td>
              <td class="text-right" :class="row.outstanding > 0 ? 'cell-outstanding' : ''">
                {{ formatRupiah(row.outstanding) }}
              </td>
              <td><StatusBadge :variant="row.status" /></td>
              <td class="cell-date">{{ formatDate(row.paidAt) }}</td>
              <td class="cell-source">{{ paymentSource(row) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.customer-payments {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
}

.filter-wrapper { display: flex; }

/* ── Kartu ringkasan atas ─────────────────────────────── */
.summary-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  min-width: 0;
}

.summary-item--accent {
  background: var(--color-dark-surface);
  border-color: var(--color-dark-surface);
}

.summary-item--accent .summary-label { color: var(--color-dark-surface-text); }
.summary-item--accent .summary-value { color: #FFFFFF; }

.summary-icon { color: var(--color-green); flex-shrink: 0; }

.summary-item > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.summary-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.summary-value {
  font-size: 17px;
  font-weight: 800;
  color: var(--color-text-primary);
  letter-spacing: -0.2px;
}

/* ── Grid pelanggan ───────────────────────────────────── */
.customer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.customer-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 16px;
  text-align: left;
  font-family: inherit;
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card-lg);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: var(--transition-card-clickable);
}

.customer-card:hover {
  border-color: var(--color-green-tint-border);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.customer-card__top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.customer-card__avatar,
.detail-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-green-tint);
  color: var(--color-green);
  font-size: 15px;
  font-weight: 800;
}

.customer-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.customer-card__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.customer-card__meta {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.customer-card__duration {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-tertiary);
  font-size: 12px;
  font-weight: 700;
}

.customer-card__numbers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid var(--color-divider);
  border-bottom: 1px solid var(--color-divider);
}

.num-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.num-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.num-value {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.num-value--green { color: var(--color-green); }
.num-value--red { color: var(--color-red); }

.customer-card__footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 8px;
  row-gap: 2px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.footer-line {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.customer-card__chevron {
  grid-column: 2;
  grid-row: 1 / span 2;
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

/* ── Detail pelanggan ─────────────────────────────────── */
.btn-back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-card-border);
  background: var(--color-card-bg);
  color: var(--color-text-tertiary);
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: var(--transition-card);
}

.btn-back:hover { border-color: var(--color-green); color: var(--color-green); }

.detail-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-header__main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-avatar { width: 44px; height: 44px; font-size: 17px; }

.detail-identity { flex: 1; min-width: 0; }

.detail-name {
  font-size: 17px;
  font-weight: 800;
  color: var(--color-text-primary);
  margin: 0 0 2px;
}

.detail-meta {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin: 0 0 2px;
}

.detail-sub {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 0;
}

.detail-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--color-divider);
}

.detail-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.detail-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
}

/* ── Tabel riwayat ────────────────────────────────────── */
.text-right { text-align: right; }

.cell-month { font-weight: 700; color: var(--color-text-primary); white-space: nowrap; }
.cell-paid { color: var(--color-green); font-weight: 700; }
.cell-outstanding { color: var(--color-red); font-weight: 700; }
.cell-date { color: var(--color-text-tertiary); white-space: nowrap; }
.cell-source { color: var(--color-text-secondary); font-size: 13px; }

/* ── State loading / error / kosong ───────────────────── */
.loading-card,
.error-card,
.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 24px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.error-card { color: var(--color-red); }

.spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 3px solid var(--color-divider-strong);
  border-top-color: var(--color-green);
  animation: cp-spin 0.8s linear infinite;
}

@keyframes cp-spin { to { transform: rotate(360deg); } }

.empty-state {
  text-align: center;
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: 16px 0;
}

/* ── Mobile ───────────────────────────────────────────── */
@media (max-width: 768px) {
  .summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-value { font-size: 15px; }

  .customer-grid { grid-template-columns: 1fr; }

  .detail-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 12px;
  }

  .detail-header__main { align-items: flex-start; }
}
</style>
