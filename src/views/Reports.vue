<script setup>
import { onMounted, computed, ref } from "vue"
import { Line, Doughnut } from "vue-chartjs"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
} from "chart.js"
import { useReports } from "../composables/useReports"
import StatusBadge from "@/components/StatusBadge.vue"
import SearchInput from "@/components/SearchInput.vue"
import FilterChips from "@/components/FilterChips.vue"

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler, ArcElement
)

const { loading, error, reportData, detailRows, selectedMonth, loadReports, setMonth } = useReports()

const trendView       = ref("daily")
const detailSearch    = ref("")
const detailStatusFilter = ref("all")

const detailFilterOptions = [
  { key: "all", label: "Semua" },
  { key: "paid", label: "Lunas" },
  { key: "partial", label: "Partial" },
  { key: "unpaid", label: "Belum Bayar" },
]

const CHART_COLORS = ["#059669", "#60C6FF", "#AFD3FF", "#EA580C", "#DC2626"]

onMounted(() => loadReports(selectedMonth.value))

// ── Formatters ──────────────────────────────────────────────
const formatRupiah = (val) =>
  "Rp " + new Intl.NumberFormat("id-ID").format(val || 0)

const formatDate = (ts) => {
  if (!ts) return "-"
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d)) return "-"
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

// ── Period dropdown ────────────────────────────────────────
const periodOptions = computed(() => {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    })
  }
  return options
})

// ── Line chart ─────────────────────────────────────────────
const lineChartData = computed(() => {
  if (!reportData.value) return null
  const trend = trendView.value === "daily"
    ? reportData.value.dailyTrend
    : reportData.value.monthlyTrend
  return {
    labels: trend.labels,
    datasets: [{
      label: "Pendapatan",
      data: trend.data,
      borderColor: "#059669",
      backgroundColor: "rgba(5, 150, 105, 0.10)",
      borderWidth: 2.5,
      fill: true, tension: 0.4,
      pointRadius: 3, pointHoverRadius: 6,
      pointBackgroundColor: "#059669",
      pointBorderColor: "#fff", pointBorderWidth: 2
    }]
  }
})

const lineChartOptions = {
  responsive: true, maintainAspectRatio: false,
  interaction: { intersect: false, mode: "index" },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#111318", padding: 10, cornerRadius: 8,
      callbacks: { label: (ctx) => "  " + formatRupiah(ctx.raw) }
    }
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 }, color: "#8A8A93" } },
    y: {
      grid: { color: "rgba(0,0,0,0.04)", drawBorder: false },
      ticks: {
        font: { size: 11 }, color: "#8A8A93",
        callback: (val) => {
          if (val >= 1000000) return "Rp " + (val / 1000000).toFixed(0) + "jt"
          if (val >= 1000)    return "Rp " + (val / 1000).toFixed(0) + "rb"
          return "Rp " + val
        }
      }
    }
  }
}

// ── Donut chart ────────────────────────────────────────────
const donutChartData = computed(() => {
  if (!reportData.value?.packageDist?.length) return null
  return {
    labels: reportData.value.packageDist.map(p => p.name),
    datasets: [{
      data: reportData.value.packageDist.map(p => p.count),
      backgroundColor: CHART_COLORS, borderWidth: 0, hoverOffset: 6
    }]
  }
})

const donutChartOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx) => `  ${ctx.label}: ${ctx.parsed} pelanggan` } }
  },
  cutout: "68%"
}

// ── Detail table filters ───────────────────────────────────
const filteredDetailRows = computed(() => {
  const keyword = detailSearch.value.toLowerCase().trim()
  return detailRows.value.filter(row => {
    const matchName   = !keyword || row.customer_name.toLowerCase().includes(keyword)
    const matchStatus = detailStatusFilter.value === "all" || row.status === detailStatusFilter.value
    return matchName && matchStatus
  })
})

</script>

<template>
  <div class="reports-page">

    <!-- ── Filters Bar ── -->
    <div class="reports-filters">
      <div class="period-select-wrapper">
        <span class="period-label">Periode:</span>
        <select class="period-select" :value="selectedMonth" @change="setMonth($event.target.value)">
          <option v-for="opt in periodOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
      <button class="btn-download">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Unduh PDF
      </button>
    </div>

    <!-- ── Loading ── -->
    <div v-if="loading" class="card loading-card">
      <div class="spinner"></div>
      <p>Memuat data laporan...</p>
    </div>

    <!-- ── Error ── -->
    <div v-else-if="error" class="card error-card">
      <p>Gagal memuat data: {{ error }}</p>
    </div>

    <!-- ── Main Content ── -->
    <template v-else-if="reportData">

      <!-- Summary Cards -->
      <p class="section-label">Analitik Ringkas</p>
      <div class="summary-grid">

        <div class="card summary-card">
          <div class="summary-icon icon-green">💰</div>
          <div class="summary-text">
            <p class="card-label">Total Omzet Bulanan</p>
            <h2 class="summary-value">{{ formatRupiah(reportData.summary.totalOmzet) }}</h2>
          </div>
        </div>

        <div class="card summary-card">
          <div class="summary-icon icon-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2">
              <polyline points="9 11 12 14 22 4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          </div>
          <div class="summary-text">
            <p class="card-label">Total Terbayar</p>
            <h2 class="summary-value">{{ formatRupiah(reportData.summary.totalTerbayar) }}</h2>
          </div>
        </div>

        <div class="card summary-card">
          <div class="summary-icon icon-orange">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div class="summary-text">
            <p class="card-label">Total Piutang</p>
            <h2 class="summary-value">{{ formatRupiah(reportData.summary.totalPiutang) }}</h2>
          </div>
        </div>

        <div class="card summary-card">
          <div class="summary-icon icon-dark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </div>
          <div class="summary-text">
            <p class="card-label">Tingkat Auto-Pay (Saldo)</p>
            <h2 class="summary-value autopay-rate">{{ reportData.summary.autoPayRate }}%</h2>
            <p class="card-sublabel">of total perbayar</p>
          </div>
        </div>

      </div>

      <!-- Charts Row -->
      <div class="charts-grid">

        <!-- Line Chart -->
        <div class="card chart-card">
          <div class="chart-header">
            <h4 class="chart-title">Tren Pendapatan &amp; Saldo</h4>
            <select class="trend-select" v-model="trendView">
              <option value="daily">Harian</option>
              <option value="monthly">Bulanan</option>
            </select>
          </div>
          <div class="chart-body">
            <Line v-if="lineChartData" :data="lineChartData" :options="lineChartOptions" />
          </div>
        </div>

        <!-- Right column -->
        <div class="charts-right">

          <!-- Donut -->
          <div class="card chart-card-sm">
            <h4 class="chart-title mb-12">Distribusi Paket Layanan</h4>
            <div v-if="reportData.packageDist.length" class="donut-wrapper">
              <div class="donut-canvas">
                <Doughnut :data="donutChartData" :options="donutChartOptions" />
              </div>
              <div class="donut-legend">
                <div v-for="(item, idx) in reportData.packageDist" :key="idx" class="legend-item">
                  <span class="legend-dot" :style="{ background: CHART_COLORS[idx] }"></span>
                  <span>{{ item.name }}: {{ item.percentage }}%</span>
                </div>
              </div>
            </div>
            <div v-else class="empty-state-text">Belum ada data paket</div>
          </div>

          <!-- Top Deposit -->
          <div class="card chart-card-sm">
            <h4 class="chart-title mb-12">Top 5 Saldo Deposit Pelanggan</h4>
            <div class="table-wrapper">
              <table class="data-table deposit-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th class="text-right">Saldo Deposit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in reportData.topCustomers" :key="c.id">
                    <td>{{ c.name }}</td>
                    <td class="text-right text-bold text-green">{{ formatRupiah(c.balance) }}</td>
                  </tr>
                  <tr v-if="!reportData.topCustomers.length">
                    <td colspan="2" class="empty-state-text">Belum ada saldo deposit</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      <!-- ── Detail Transaksi ── -->
      <div class="card no-padding detail-section">

        <!-- Section Header -->
        <div class="card-header-table">
          <div>
            <h4 class="card-inner-title">Detail Transaksi</h4>
            <p class="card-inner-subtitle">Rincian tagihan &amp; pembayaran periode ini</p>
          </div>
        </div>

        <div class="detail-toolbar">
          <SearchInput v-model="detailSearch" placeholder="Cari nama pelanggan..." class="detail-toolbar__search" />
          <FilterChips :options="detailFilterOptions" v-model="detailStatusFilter" />
        </div>

        <div class="detail-list">
          <div v-for="row in filteredDetailRows" :key="row.id" class="detail-card">
            <div class="detail-card__top">
              <div class="detail-card__avatar">{{ row.customer_name?.charAt(0) ?? "?" }}</div>
              <div class="detail-card__info">
                <div class="detail-card__name">{{ row.customer_name }}</div>
                <div class="detail-card__meta">
                  <template v-if="row.status === 'unpaid'">Belum ada pembayaran</template>
                  <template v-else>{{ formatDate(row.paid_at) }} · {{ row.auto_subscribed ? 'Auto-Debit' : 'Manual Cash' }}</template>
                </div>
              </div>
              <StatusBadge :variant="row.status" />
            </div>

            <div class="detail-card__grid">
              <div>
                <div class="detail-card__stat-label">Tagihan</div>
                <div class="detail-card__stat-value">{{ formatRupiah(row.amount) }}</div>
              </div>
              <div>
                <div class="detail-card__stat-label">Dibayar</div>
                <div class="detail-card__stat-value" :class="row.paid_amount > 0 ? 'text-green' : 'text-muted'">{{ formatRupiah(row.paid_amount) }}</div>
              </div>
              <div>
                <div class="detail-card__stat-label">Hutang</div>
                <div class="detail-card__stat-value" :class="row.outstanding > 0 ? 'text-danger' : 'text-muted'">{{ formatRupiah(row.outstanding) }}</div>
              </div>
              <div>
                <div class="detail-card__stat-label">Sisa Saldo</div>
                <div class="detail-card__stat-value" :class="row.balance > 0 ? 'text-green' : 'text-muted'">{{ formatRupiah(row.balance) }}</div>
              </div>
            </div>

            <div v-if="row.note && row.note !== '-'" class="detail-card__note">{{ row.note }}</div>
          </div>

          <p v-if="filteredDetailRows.length === 0" class="empty-state-text">Tidak ada transaksi yang cocok.</p>
        </div>

        <div v-if="filteredDetailRows.length > 0" class="table-footer">
          Menampilkan {{ filteredDetailRows.length }} dari {{ detailRows.length }} transaksi
        </div>

      </div>

    </template>
  </div>
</template>

<style scoped>
.reports-page { padding: 0; }

/* ═══════════════════════════════════════════
   FILTERS BAR
════════════════════════════════════════════ */
.reports-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 12px;
}

.period-select-wrapper { display: flex; align-items: center; gap: 10px; }
.period-label { font-size: 14px; font-weight: 600; color: var(--color-text-secondary); white-space: nowrap; }

.period-select {
  padding: 8px 14px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-pill);
  font-size: 14px; font-weight: 600;
  background: white; cursor: pointer;
  width: auto; color: var(--color-text-primary);
}

.btn-download {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 18px;
  background: white; border: 1px solid var(--color-card-border);
  border-radius: var(--radius-pill); font-size: 13px; font-weight: 600;
  cursor: pointer; color: var(--color-text-primary);
  transition: background 0.15s; white-space: nowrap; flex-shrink: 0;
}
.btn-download:hover { background: var(--color-page-bg); }

/* ═══════════════════════════════════════════
   SECTION LABEL
════════════════════════════════════════════ */
.section-label { font-size: 16px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 16px; }

/* ═══════════════════════════════════════════
   SUMMARY CARDS — 4 cols → 2 cols → 1 col
════════════════════════════════════════════ */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card { display: flex; align-items: flex-start; gap: 14px; padding: 18px 20px; }

.summary-icon {
  width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 22px;
}
.icon-green  { background: var(--color-green-tint); }
.icon-blue   { background: #EFF6FF; }
.icon-orange { background: var(--color-orange-tint); }
.icon-dark   { background: var(--color-chip-bg); }

.summary-text { min-width: 0; }
.summary-value {
  font-size: 18px; font-weight: 800; color: var(--color-text-primary);
  margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.autopay-rate { color: var(--color-green); }
.card-sublabel { font-size: 11px; color: var(--color-text-secondary); margin-top: 2px; }

/* ═══════════════════════════════════════════
   CHARTS GRID — side-by-side → stacked
════════════════════════════════════════════ */
.charts-grid {
  display: grid;
  grid-template-columns: 1.45fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.charts-right { display: flex; flex-direction: column; gap: 20px; }
.chart-card   { padding: 20px 24px; }

.chart-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.chart-title { font-size: 15px; font-weight: 700; color: var(--color-text-primary); }
.mb-12 { margin-bottom: 12px; }

.trend-select {
  padding: 5px 14px; border: 1px solid var(--color-card-border); border-radius: var(--radius-pill);
  font-size: 12px; font-weight: 600; background: white; cursor: pointer;
  width: auto; color: var(--color-text-primary);
}

.chart-body { height: 280px; position: relative; }

.chart-card-sm { padding: 20px; }

/* Donut */
.donut-wrapper { display: flex; align-items: center; gap: 20px; }
.donut-canvas  { width: 110px; height: 110px; flex-shrink: 0; }
.donut-legend  { flex: 1; }
.legend-item   { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; }
.legend-dot    { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* Deposit table */
.deposit-table { border: none; }
.deposit-table th, .deposit-table td { padding: 10px 12px; font-size: 13px; }

/* ═══════════════════════════════════════════
   DETAIL SECTION WRAPPER
════════════════════════════════════════════ */
.detail-section { overflow: hidden; }

.card-header-table {
  padding: 20px 24px;
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;
  gap: 16px; border-bottom: 1px solid var(--color-card-border);
}
.card-inner-title   { font-size: 16px; font-weight: 700; color: var(--color-text-primary); }
.card-inner-subtitle { font-size: 13px; color: var(--color-text-secondary); margin-top: 2px; }

/* ── Detail Transaksi toolbar ── */
.detail-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 16px 24px 0;
  flex-wrap: wrap;
}

.detail-toolbar__search { flex: 1; max-width: 280px; }

/* ── Detail Transaksi card list ── */
.detail-list { padding: 16px 24px; display: flex; flex-direction: column; gap: 10px; }

.detail-card {
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow-card);
  transition: var(--transition-card);
}

.detail-card__top { display: flex; align-items: center; gap: 12px; }

.detail-card__avatar {
  width: 34px; height: 34px; border-radius: 10px;
  background: var(--color-chip-bg); color: var(--color-text-tertiary);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px; flex-shrink: 0;
}

.detail-card__info { flex: 1; min-width: 0; }
.detail-card__name { font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
.detail-card__meta { font-size: 11px; color: var(--color-text-secondary); margin-top: 2px; }

.detail-card__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--color-divider);
}

.detail-card__stat-label { font-size: 10px; color: var(--color-text-secondary); font-weight: 600; }
.detail-card__stat-value { font-size: 12.5px; font-weight: 700; color: var(--color-text-primary); margin-top: 3px; }

.detail-card__note { font-size: 11px; color: var(--color-text-secondary); margin-top: 10px; }

/* Table footer */
.table-footer {
  padding: 12px 24px; font-size: 12px; color: var(--color-text-secondary);
  border-top: 1px solid var(--color-card-border); background: var(--color-surface);
}

/* ═══════════════════════════════════════════
   SHARED UTILITIES
════════════════════════════════════════════ */
.text-right  { text-align: right; }
.text-bold   { font-weight: 700; }
.text-green  { color: var(--color-green); }
.text-danger { color: var(--color-red); }
.text-muted  { color: var(--color-text-secondary); }
.no-padding  { padding: 0; }

/* ═══════════════════════════════════════════
   STATES
════════════════════════════════════════════ */
.loading-card {
  display: flex; flex-direction: column; align-items: center;
  padding: 80px; gap: 16px; color: var(--color-text-secondary);
}
.spinner {
  width: 36px; height: 36px; border: 4px solid var(--color-card-border);
  border-top-color: var(--color-green); border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.error-card     { padding: 40px; text-align: center; color: var(--color-red); }
.empty-state-text { text-align: center; color: var(--color-text-secondary); font-size: 13px; padding: 20px 0; }

/* ═══════════════════════════════════════════
   RESPONSIVE BREAKPOINTS
════════════════════════════════════════════ */

/* Tablet: ≤ 1024px */
@media (max-width: 1024px) {
  .summary-grid { grid-template-columns: repeat(2, 1fr); }
  .charts-grid  { grid-template-columns: 1fr; }
  .chart-body   { height: 240px; }
}

/* Mobile: ≤ 767px — main breakpoint */
@media (max-width: 767px) {
  /* Filter bar: stack vertically */
  .reports-filters {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .period-select-wrapper { justify-content: space-between; }
  .btn-download { justify-content: center; width: 100%; }

  /* Summary: 2-column on mobile */
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }
  .summary-card  { padding: 14px; gap: 10px; }
  .summary-icon  { width: 40px; height: 40px; font-size: 18px; border-radius: 10px; }
  .summary-value { font-size: 14px; }

  /* Charts: reduced height, better donut layout */
  .charts-grid  { gap: 12px; margin-bottom: 16px; }
  .chart-body   { height: 200px; }
  .chart-card   { padding: 16px; }
  .chart-card-sm { padding: 16px; }
  .donut-wrapper { flex-direction: row; gap: 16px; }
  .donut-canvas  { width: 90px; height: 90px; }

  /* Detail section header */
  .card-header-table {
    flex-direction: column; align-items: flex-start; gap: 12px;
    padding: 16px;
  }
  .detail-toolbar { padding: 12px 16px 0; }
  .detail-toolbar__search { max-width: none; flex-basis: 100%; }
  .detail-list { padding: 12px 16px; }
  .detail-card__grid { grid-template-columns: 1fr 1fr; }

  /* Table footer spacing */
  .table-footer { padding: 10px 16px; }
}

/* Small phones: ≤ 480px */
@media (max-width: 480px) {
  .summary-grid  { grid-template-columns: 1fr; }
  .donut-wrapper { flex-direction: column; align-items: flex-start; }
  .donut-canvas  { width: 100px; height: 100px; }
  .section-label { font-size: 14px; }
  .card-inner-title { font-size: 15px; }
}
</style>
