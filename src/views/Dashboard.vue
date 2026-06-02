<script setup>
import { onMounted } from "vue"
import { useDashboard } from "../composables/useDashboard"
import { checkAndAutoDraw } from "@/services/promoService"

const { summary, unpaidList, loadDashboard, recentPayments, ensureMonthlyInvoices } = useDashboard()

const currentMonth = new Date().toISOString().slice(0, 7)

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

const handleGenerate = async () => {
  await ensureMonthlyInvoices(currentMonth)
  await loadDashboard(currentMonth)
}
</script>

<!-- <template>
  <div class="dashboard-container">
    <h1 class="page-title">Dashboard</h1>

    <div v-if="summary" class="card-grid">
      <div class="card">
        <p class="card-label">Total Invoice</p>
        <h2>{{ summary.totalInvoice }}</h2>
      </div>

      <div class="card success">
        <p class="card-label">Sudah Bayar</p>
        <h2>{{ summary.paidCount }}</h2>
      </div>

      <div class="card danger">
        <p class="card-label">Belum Bayar</p>
        <h2>{{ summary.unpaidCount }}</h2>
      </div>

      <div class="card highlight">
        <p class="card-label">Pendapatan</p>
        <h2>Rp {{ formatRupiah(summary.totalRevenue) }}</h2>
      </div>

      <div class="card warning">
        <p class="card-label">Partial</p>
        <h2>{{ summary.partialCount }}</h2>
      </div>

      <div class="card warning">
        <p class="card-label">Piutang Bulan Ini</p>
        <h2>Rp {{ formatRupiah(summary.totalOutstandingMonth) }}</h2>
      </div>

      <div class="card danger">
        <p class="card-label">Total Piutang Aktif</p>
        <h2>Rp {{ formatRupiah(summary.totalOutstandingAll) }}</h2>
      </div>
    </div>

    <div class="table-wrapper">
      <h2 class="section-title">Pelanggan Belum Bayar</h2>

      <table v-if="unpaidList.length">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Tagihan</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in unpaidList" :key="item.id">
            <td>{{ item.customer_name }}</td>
            <td>
              Rp {{ formatRupiah(item.total_outstanding) }}
              <div v-if="item.status === 'partial'" class="small-info">
                (Dari Rp {{ formatRupiah(item.amount) }})
              </div>
            </td>
            <td>
              <span
                v-if="item.status === 'unpaid'"
                class="badge danger"
              >
                Unpaid
              </span>

              <span
                v-else-if="item.status === 'partial'"
                class="badge warning"
              >
                Partial
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">
        🎉 Semua pelanggan sudah bayar bulan ini
      </div>
    </div>

    <div class="mini-log">
      <h2 class="section-title">Pembayaran Terbaru</h2>

      <div v-if="recentPayments.length">
        <div
          v-for="item in recentPayments"
          :key="item.id"
          class="log-item"
        >
          <div>
            <strong>{{ item.name || item.customer_id }}</strong>
            bayar Rp {{ formatRupiah(item.amount) }}
          </div>
          <small>{{ formatDate(item.created_at) }}</small>
        </div>
      </div>

      <div v-else class="empty">
        Belum ada pembayaran terbaru
      </div>
    </div>
  </div>
</template> -->
<template>
  <div class="dashboard-page">
    <!-- <header class="section-header">
      <div>
        <h2 class="section-title">Ringkasan Bisnis</h2>
        <p class="section-subtitle">Pantau kesehatan keuangan dan status tagihan hari ini</p>
      </div>
      <button class="btn-outline" @click="handleGenerate">
        <span>🔄</span> Sinkron Invoice
      </button>
    </header> -->

    <div v-if="!summary" class="card loading-card">
      <div class="spinner"></div>
      <p>Memuat data ringkasan...</p>
    </div>

    <div v-else class="dashboard-content animate-fade-in">
      
      <div class="stats-main-grid">
        <div class="card stat-card highlight">
          <div class="stat-icon">💰</div>
          <div class="stat-content">
            <p class="card-label">Total Pendapatan</p>
            <h2 class="stat-value">Rp {{ formatRupiah(summary.totalRevenue) }}</h2>
          </div>
        </div>
        <div class="card stat-card danger-light">
          <div class="stat-icon">📉</div>
          <div class="stat-content">
            <p class="card-label">Total Piutang Aktif</p>
            <h2 class="stat-value text-red">Rp {{ formatRupiah(summary.totalOutstandingAll) }}</h2>
          </div>
        </div>
        <div class="card stat-card isp-light">
          <div class="stat-icon">🌐</div>
          <div class="stat-content">
            <p class="card-label">Biaya ISP (50%)</p>
            <h2 class="stat-value text-indigo">Rp {{ formatRupiah(summary.ispCost) }}</h2>
            <p class="stat-sublabel">Dari {{ summary.totalInvoice }} tagihan aktif</p>
          </div>
        </div>
      </div>

      <div class="stats-status-grid mt-24">
        <div class="card status-card border-green">
          <p class="card-label">Sudah Bayar</p>
          <div class="status-content">
            <h2 class="text-green">{{ summary.paidCount }}</h2>
            <span class="status-unit">Pelanggan</span>
          </div>
        </div>
        <div class="card status-card border-red">
          <p class="card-label">Belum Bayar</p>
          <div class="status-content">
            <h2 class="text-red">{{ summary.unpaidCount }}</h2>
            <span class="status-unit">Pelanggan</span>
          </div>
        </div>
        <div class="card status-card border-orange">
          <p class="card-label">Pembayaran Partial</p>
          <div class="status-content">
            <h2 class="text-orange">{{ summary.partialCount }}</h2>
            <span class="status-unit">Pelanggan</span>
          </div>
        </div>
      </div>

      <div class="dashboard-main-grid mt-24">
        
        <div class="card no-padding overflow-hidden">
          <div class="card-header-table">
            <h4 class="table-title">Pelanggan Belum Bayar</h4>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>PELANGGAN</th>
                  <th>SISA TAGIHAN</th>
                  <th class="text-center">STATUS</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in unpaidList" :key="item.id">
                  <td>
                    <div class="col-name">{{ item.customer_name }}</div>
                  </td>
                  <td>
                    <div class="text-bold">Rp {{ formatRupiah(item.total_outstanding) }}</div>
                    <div v-if="item.status === 'partial'" class="col-subtext">
                      (Dari Rp {{ formatRupiah(item.amount) }})
                    </div>
                  </td>
                  <td class="text-center">
                    <span :class="['status-badge', item.status]">
                      {{ item.status === 'unpaid' ? 'Belum Bayar' : 'Partial' }}
                    </span>
                  </td>
                </tr>
                <tr v-if="unpaidList.length === 0">
                  <td colspan="3" class="empty-state">
                    <div class="empty-box">
                      <span>🎉</span>
                      <p>Semua pelanggan sudah lunas bulan ini!</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h4 class="table-title mb-16">Pembayaran Terbaru</h4>
          <div class="activity-timeline" v-if="recentPayments.length">
            <div v-for="item in recentPayments" :key="item.id" class="activity-item">
              <div class="activity-dot"></div>
              <div class="activity-info">
                <p class="activity-text">
                  <strong>{{ item.name || 'User' }}</strong> 
                  bayar <span class="text-green">Rp {{ formatRupiah(item.amount) }}</span>
                </p>
                <small class="activity-time">{{ formatDate(item.created_at) }}</small>
              </div>
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
/* .dashboard-container {
  padding: 30px;
  background: #f5f7fa;
  min-height: 100vh;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 25px;
  color: #2c3e50;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.card {
  background: white;
  padding: 20px;
  border-radius: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: 0.2s ease;
}

.card:hover {
  transform: translateY(-3px);
}

.card-label {
  font-size: 13px;
  color: #7f8c8d;
  margin-bottom: 8px;
}

.card h2 {
  font-size: 22px;
  font-weight: 700;
}

.success h2 {
  color: #27ae60;
}

.danger h2 {
  color: #e74c3c;
}

.highlight h2 {
  color: #2980b9;
}

.warning h2 {
  color: #f39c12;
}

.table-wrapper {
  background: white;
  padding: 25px;
  border-radius: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.section-title {
  margin-bottom: 15px;
  font-size: 18px;
  font-weight: 600;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  font-size: 13px;
  padding: 12px;
  background: #f0f2f5;
  color: #555;
}

td {
  padding: 12px;
  border-bottom: 1px solid #eee;
  font-size: 14px;
}

.badge {
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.badge.danger {
  background: #fdecea;
  color: #e74c3c;
}

.empty {
  padding: 20px;
  text-align: center;
  color: #888;
}

.mini-log {
  margin-top: 30px;
  background: white;
  padding: 20px;
  border-radius: 14px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.log-item {
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  font-size: 14px;
}

.log-item:last-child {
  border-bottom: none;
}

.badge.warning {
  background: #fff4e5;
  color: #f39c12;
}

.small-info {
  font-size: 12px;
  color: #888;
} */

 /* Layout & Spacing */
/* --- Dashboard Layout --- */
.dashboard-page { padding: 0; }

/* --- Stats Grid System --- */
.stats-main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}

.stats-status-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

/* --- Card Customization --- */
.stat-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 28px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  background: #F1F5F9;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.status-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.status-content {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 12px;
}

.status-content h2 { font-size: 32px; font-weight: 800; }
.status-unit { font-size: 14px; color: var(--text-muted); font-weight: 600; }

/* Border accents for Status Cards */
.border-green { border-bottom: 4px solid var(--primary); }
.border-red { border-bottom: 4px solid var(--danger); }
.border-orange { border-bottom: 4px solid var(--warning); }

/* --- Table & Activity Grid --- */
.dashboard-main-grid {
  display: grid;
  grid-template-columns: 1.8fr 1fr;
  gap: 24px;
}

.table-title { font-size: 16px; font-weight: 800; color: var(--text-main); }
.card-header-table { padding: 20px 24px; border-bottom: 1px solid var(--border); }

/* --- Status Badges (Refined) --- */
.status-badge {
  padding: 6px 14px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.unpaid { background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; }
.status-badge.partial { background: #FFF7ED; color: #EA580C; border: 1px solid #FFEDD5; }

/* --- Activity Timeline --- */
.activity-timeline { padding-left: 8px; margin-top: 20px; }
.activity-item {
  display: flex;
  gap: 16px;
  padding-bottom: 24px;
  position: relative;
}

.activity-item:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 5px; top: 18px; bottom: 0;
  width: 2px; background: var(--border);
}

.activity-dot {
  width: 12px; height: 12px;
  background: var(--primary);
  border: 3px solid #E5F6E7;
  border-radius: 50%;
  flex-shrink: 0;
  z-index: 2;
}

.activity-info { margin-top: -2px; }
.activity-text { font-size: 14px; line-height: 1.4; }
.activity-time { color: var(--text-muted); font-size: 12px; }

/* --- States (Loading & Empty) --- */
.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px;
  gap: 16px;
  color: var(--text-muted);
}

.spinner {
  width: 40px; height: 40px;
  border: 4px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.empty-box { text-align: center; padding: 40px; }
.empty-box span { font-size: 40px; display: block; margin-bottom: 12px; }

/* --- Transitions --- */
.animate-fade-in {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* --- Responsive --- */
@media (max-width: 1200px) {
  .stats-main-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 1024px) {
  .stats-main-grid, .stats-status-grid, .dashboard-main-grid {
    grid-template-columns: 1fr;
  }
}

.col-subtext { font-size: 12px; color: var(--text-muted); }

.isp-light { border-left: 4px solid #6366f1; }
.text-indigo { color: #6366f1; }

.stat-sublabel {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
</style>
