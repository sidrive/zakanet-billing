<script setup>
import { onMounted } from "vue"
import { useDashboard } from "../composables/useDashboard"
import { checkAndAutoDraw } from "@/services/promoService"
import StatusBadge from "@/components/StatusBadge.vue"

const { summary, unpaidList, loadDashboard, recentPayments, ensureMonthlyInvoices } = useDashboard()

const currentMonth = new Date().toISOString().slice(0, 7)
const todayLabel = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })

onMounted(async () => {
  await ensureMonthlyInvoices(currentMonth)
  await loadDashboard(currentMonth)
  // Jalankan undian promo di background — tidak memblokir dashboard
  checkAndAutoDraw(currentMonth)
})

const formatRupiah = (val) => {
  return new Intl.NumberFormat("id-ID").format(val)
}

const formatDate = (timestamp) => {
  if (!timestamp) return "-"
  const date = timestamp.toDate()
  return date.toLocaleDateString("id-ID")
}

const initials = (name) => (name || "?").charAt(0).toUpperCase()
</script>

<template>
  <div class="dashboard-page">
    <div class="dashboard-greeting">
      <div class="dashboard-greeting__hello">Halo, Admin 👋</div>
      <div class="dashboard-greeting__date">{{ todayLabel }}</div>
    </div>

    <div v-if="!summary" class="card loading-card">
      <div class="spinner"></div>
      <p>Memuat data ringkasan...</p>
    </div>

    <div v-else class="dashboard-content animate-fade-in">

      <div class="stats-main-grid">
        <div class="stat-card stat-card--dark">
          <p class="stat-card__label">Pendapatan Bulan Ini</p>
          <h2 class="stat-card__value">Rp {{ formatRupiah(summary.totalRevenue) }}</h2>
        </div>
        <div class="stat-card">
          <p class="stat-card__label">Piutang Aktif</p>
          <h2 class="stat-card__value stat-card__value--red">Rp {{ formatRupiah(summary.totalOutstandingAll) }}</h2>
        </div>
        <div class="stat-card">
          <p class="stat-card__label">Biaya ISP (50%)</p>
          <h2 class="stat-card__value">Rp {{ formatRupiah(summary.ispCost) }}</h2>
          <p class="stat-card__sublabel">Dari {{ summary.totalInvoice }} tagihan aktif</p>
        </div>
      </div>

      <div class="mini-stats-grid">
        <div class="mini-stat">
          <div class="mini-stat__value mini-stat__value--green">{{ summary.paidCount }}</div>
          <div class="mini-stat__label">Lunas</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat__value mini-stat__value--orange">{{ summary.partialCount }}</div>
          <div class="mini-stat__label">Partial</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat__value mini-stat__value--red">{{ summary.unpaidCount }}</div>
          <div class="mini-stat__label">Belum Bayar</div>
        </div>
      </div>

      <div class="dashboard-main-grid">

        <div class="dashboard-section">
          <div class="dashboard-section__header">
            <h4 class="dashboard-section__title">Perlu Ditagih</h4>
            <span class="dashboard-section__count">{{ unpaidList.length }} pelanggan</span>
          </div>

          <div v-if="unpaidList.length" class="unpaid-list">
            <div v-for="item in unpaidList" :key="item.id" class="unpaid-row">
              <div class="unpaid-row__avatar">{{ initials(item.customer_name) }}</div>
              <div class="unpaid-row__info">
                <div class="unpaid-row__name">{{ item.customer_name }}</div>
                <div class="unpaid-row__amount">
                  Rp {{ formatRupiah(item.total_outstanding) }} tertunggak
                  <template v-if="item.status === 'partial'"> (dari Rp {{ formatRupiah(item.amount) }})</template>
                </div>
              </div>
              <StatusBadge :variant="item.status === 'unpaid' ? 'unpaid' : 'partial'" />
            </div>
          </div>
          <div v-else class="empty-box">
            <span>🎉</span>
            <p>Semua pelanggan sudah lunas bulan ini!</p>
          </div>
        </div>

        <div class="dashboard-section">
          <h4 class="dashboard-section__title mb-16">Aktivitas Terbaru</h4>
          <div v-if="recentPayments.length" class="activity-list">
            <div v-for="item in recentPayments" :key="item.id" class="activity-row">
              <div class="activity-row__text">
                <strong>{{ item.name || 'User' }}</strong>
                bayar <span class="text-green">Rp {{ formatRupiah(item.amount) }}</span>
              </div>
              <div class="activity-row__time">{{ formatDate(item.created_at) }}</div>
            </div>
          </div>
          <div v-else class="empty-state-mini">
            <p>Belum ada aktivitas hari ini</p>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page { padding: 0; }

.dashboard-greeting { margin-bottom: 20px; }
.dashboard-greeting__hello { font-size: 15px; font-weight: 700; color: var(--color-text-primary); }
.dashboard-greeting__date { font-size: 13px; color: var(--color-text-secondary); margin-top: 2px; }

/* --- Stats Grid System --- */
.stats-main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}

.stat-card {
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card-lg);
  padding: 20px;
}

.stat-card--dark {
  background: var(--color-dark-surface);
  border: none;
}

.stat-card__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.stat-card--dark .stat-card__label { color: var(--color-dark-surface-text); }

.stat-card__value {
  font-size: 26px;
  font-weight: 800;
  margin-top: 10px;
  color: var(--color-text-primary);
}

.stat-card--dark .stat-card__value { color: #FFFFFF; }
.stat-card__value--red { color: var(--color-red); }

.stat-card__sublabel {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

/* --- Mini status grid --- */
.mini-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 16px;
}

.mini-stat {
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  padding: 12px;
  text-align: center;
}

.mini-stat__value { font-size: 18px; font-weight: 800; }
.mini-stat__value--green { color: var(--color-green); }
.mini-stat__value--orange { color: var(--color-orange-text); }
.mini-stat__value--red { color: var(--color-red); }
.mini-stat__label { font-size: 10px; color: var(--color-text-secondary); font-weight: 600; margin-top: 2px; }

/* --- Main grid: Perlu Ditagih | Aktivitas Terbaru --- */
.dashboard-main-grid {
  display: grid;
  grid-template-columns: 1.8fr 1fr;
  gap: 16px;
  margin-top: 24px;
}

.dashboard-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.dashboard-section__title { font-size: 15px; font-weight: 800; color: var(--color-text-primary); }
.dashboard-section__count { font-size: 12px; font-weight: 700; color: var(--color-green); }

.unpaid-row {
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.unpaid-row__avatar {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--color-chip-bg);
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.unpaid-row__info { flex: 1; min-width: 0; }
.unpaid-row__name { font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
.unpaid-row__amount { font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }

.activity-list {
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  padding: 4px 16px;
}

.activity-row {
  padding: 12px 0;
  border-bottom: 1px solid var(--color-divider);
}

.activity-row:last-child { border-bottom: none; }
.activity-row__text { font-size: 13px; color: var(--color-text-primary); }
.activity-row__time { font-size: 11px; color: var(--color-text-secondary); margin-top: 3px; }

/* --- States (Loading & Empty) --- */
.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px;
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

.empty-box { text-align: center; padding: 40px; color: var(--color-text-secondary); }
.empty-box span { font-size: 40px; display: block; margin-bottom: 12px; }
.empty-state-mini { padding: 20px; text-align: center; color: var(--color-text-secondary); font-size: 13px; }

/* --- Transitions --- */
.animate-fade-in { animation: fadeIn 0.5s ease-out; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.mb-16 { margin-bottom: 16px; }

/* --- Responsive --- */
@media (max-width: 1024px) {
  .dashboard-main-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .stats-main-grid {
    display: flex;
    overflow-x: auto;
    gap: 10px;
    margin: 0 -16px;
    padding: 0 16px 4px;
  }

  .stat-card {
    flex: 0 0 auto;
    min-width: 150px;
    padding: 16px;
  }

  .stat-card__value { font-size: 19px; margin-top: 8px; }
}
</style>
