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

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler, ArcElement
)

const { loading, error, reportData, detailRows, selectedMonth, loadReports, setMonth } = useReports()

const trendView       = ref("daily")
const detailSearch    = ref("")
const detailStatusFilter = ref("all")

const CHART_COLORS = ["#00AA13", "#60C6FF", "#AFD3FF", "#FFB020", "#E63946"]

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
      borderColor: "#00AA13",
      backgroundColor: "rgba(0, 170, 19, 0.10)",
      borderWidth: 2.5,
      fill: true, tension: 0.4,
      pointRadius: 3, pointHoverRadius: 6,
      pointBackgroundColor: "#00AA13",
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
      backgroundColor: "#1C1C1C", padding: 10, cornerRadius: 8,
      callbacks: { label: (ctx) => "  " + formatRupiah(ctx.raw) }
    }
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 }, color: "#646464" } },
    y: {
      grid: { color: "rgba(0,0,0,0.04)", drawBorder: false },
      ticks: {
        font: { size: 11 }, color: "#646464",
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

const statusLabel = { paid: "Lunas", partial: "Partial", unpaid: "Belum Bayar" }
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

        <!-- Section Header + Filters -->
        <div class="card-header-table">
          <div>
            <h4 class="card-inner-title">Detail Transaksi</h4>
            <p class="card-inner-subtitle">Rincian tagihan &amp; pembayaran periode ini</p>
          </div>
          <div class="filter-group">
            <select v-model="detailStatusFilter" class="search-input select-filter">
              <option value="all">Semua Status</option>
              <option value="paid">Lunas</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Belum Bayar</option>
            </select>
            <input
              v-model="detailSearch"
              type="text"
              placeholder="Cari nama pelanggan..."
              class="search-input"
            />
          </div>
        </div>

        <!-- Desktop Table (hidden on mobile) -->
        <div class="table-wrapper desktop-only">
          <table class="data-table detail-table">
            <thead>
              <tr>
                <th>Nama Pelanggan</th>
                <th>Tgl Bayar</th>
                <th>Metode</th>
                <th class="text-center">Status</th>
                <th class="text-right">Tagihan</th>
                <th class="text-right">Dibayar</th>
                <th class="text-right">Hutang</th>
                <th class="text-right">Sisa Saldo</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredDetailRows" :key="row.id">
                <td>
                  <div class="customer-info-cell">
                    <div class="mini-avatar">{{ row.customer_name?.charAt(0) ?? "?" }}</div>
                    <span class="col-name">{{ row.customer_name }}</span>
                  </div>
                </td>
                <td>
                  <span v-if="row.status === 'unpaid'" class="text-muted">-</span>
                  <span v-else>{{ formatDate(row.paid_at) }}</span>
                </td>
                <td>
                  <span v-if="row.status === 'unpaid'" class="text-muted">-</span>
                  <span v-else-if="row.auto_subscribed" class="badge-method auto">Auto-Debit</span>
                  <span v-else class="badge-method manual">Manual Cash</span>
                </td>
                <td class="text-center">
                  <span :class="['status-badge', row.status]">
                    {{ statusLabel[row.status] ?? row.status }}
                  </span>
                </td>
                <td class="text-right text-bold">{{ formatRupiah(row.amount) }}</td>
                <td class="text-right">
                  <span :class="row.paid_amount > 0 ? 'text-green text-bold' : 'text-muted'">
                    {{ formatRupiah(row.paid_amount) }}
                  </span>
                </td>
                <td class="text-right">
                  <span :class="row.outstanding > 0 ? 'text-danger text-bold' : 'text-muted'">
                    {{ formatRupiah(row.outstanding) }}
                  </span>
                </td>
                <td class="text-right">
                  <span :class="row.balance > 0 ? 'text-green text-bold' : 'text-muted'">
                    {{ formatRupiah(row.balance) }}
                  </span>
                </td>
                <td><span class="note-text">{{ row.note }}</span></td>
              </tr>
              <tr v-if="filteredDetailRows.length === 0">
                <td colspan="9" class="empty-state">
                  <div class="empty-box"><p>Tidak ada data untuk periode ini</p></div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile Card List (hidden on desktop) -->
        <div class="detail-cards mobile-only">
          <div v-for="row in filteredDetailRows" :key="row.id + '-card'" class="detail-card">

            <!-- Card Header: name + badges -->
            <div class="detail-card-header">
              <div class="customer-info-cell">
                <div class="mini-avatar">{{ row.customer_name?.charAt(0) ?? "?" }}</div>
                <div>
                  <div class="col-name">{{ row.customer_name }}</div>
                  <div class="col-subtext">
                    {{ row.status === 'unpaid' ? 'Belum Bayar' : formatDate(row.paid_at) }}
                  </div>
                </div>
              </div>
              <div class="badge-stack">
                <span :class="['status-badge', row.status]">
                  {{ statusLabel[row.status] ?? row.status }}
                </span>
                <span
                  v-if="row.status !== 'unpaid'"
                  :class="['badge-method', row.auto_subscribed ? 'auto' : 'manual']"
                >
                  {{ row.auto_subscribed ? 'Auto-Debit' : 'Manual Cash' }}
                </span>
              </div>
            </div>

            <!-- Card Body: 2-column grid of values -->
            <div class="detail-card-body">
              <div class="card-stat-item">
                <span class="stat-label">Tagihan</span>
                <span class="stat-value text-bold">{{ formatRupiah(row.amount) }}</span>
              </div>
              <div class="card-stat-item">
                <span class="stat-label">Dibayar</span>
                <span :class="['stat-value', row.paid_amount > 0 ? 'text-green text-bold' : 'text-muted']">
                  {{ formatRupiah(row.paid_amount) }}
                </span>
              </div>
              <div class="card-stat-item">
                <span class="stat-label">Hutang</span>
                <span :class="['stat-value', row.outstanding > 0 ? 'text-danger text-bold' : 'text-muted']">
                  {{ formatRupiah(row.outstanding) }}
                </span>
              </div>
              <div class="card-stat-item">
                <span class="stat-label">Sisa Saldo</span>
                <span :class="['stat-value', row.balance > 0 ? 'text-green text-bold' : 'text-muted']">
                  {{ formatRupiah(row.balance) }}
                </span>
              </div>
              <div v-if="row.note && row.note !== '-'" class="card-stat-item card-stat-full">
                <span class="stat-label">Keterangan</span>
                <span class="stat-value text-muted">{{ row.note }}</span>
              </div>
            </div>

          </div>

          <!-- Mobile Empty State -->
          <div v-if="filteredDetailRows.length === 0" class="mobile-empty">
            Tidak ada data untuk periode ini
          </div>
        </div>

        <!-- Table Footer -->
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
.period-label { font-size: 14px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }

.period-select {
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 100px;
  font-size: 14px; font-weight: 600;
  background: white; cursor: pointer;
  width: auto; color: var(--text-main);
}

.btn-download {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 18px;
  background: white; border: 1px solid var(--border);
  border-radius: 100px; font-size: 13px; font-weight: 600;
  cursor: pointer; color: var(--text-main);
  transition: background 0.15s; white-space: nowrap; flex-shrink: 0;
}
.btn-download:hover { background: var(--bg-main); }

/* ═══════════════════════════════════════════
   SECTION LABEL
════════════════════════════════════════════ */
.section-label { font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 16px; }

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
.icon-green  { background: #E5F6E7; }
.icon-blue   { background: #EFF6FF; }
.icon-orange { background: #FFF4E5; }
.icon-dark   { background: #F1F5F9; }

.summary-text { min-width: 0; }
.summary-value {
  font-size: 18px; font-weight: 800; color: var(--text-main);
  margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.autopay-rate { color: var(--primary); }
.card-sublabel { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

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
.chart-title { font-size: 15px; font-weight: 700; color: var(--text-main); }
.mb-12 { margin-bottom: 12px; }

.trend-select {
  padding: 5px 14px; border: 1px solid var(--border); border-radius: 100px;
  font-size: 12px; font-weight: 600; background: white; cursor: pointer;
  width: auto; color: var(--text-main);
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
  gap: 16px; border-bottom: 1px solid var(--border);
}
.card-inner-title   { font-size: 16px; font-weight: 700; color: var(--text-main); }
.card-inner-subtitle { font-size: 13px; color: var(--text-muted); margin-top: 2px; }

.filter-group { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

.search-input {
  background: #f8fafc; border: 1px solid var(--border);
  padding: 8px 16px; border-radius: 100px;
  font-size: 13px; width: 200px;
}
.select-filter { width: auto !important; cursor: pointer; background-color: #fff; }

/* ── Desktop Table ── */
.detail-table th, .detail-table td { padding: 14px 16px; font-size: 13px; }

.customer-info-cell { display: flex; align-items: center; gap: 10px; }
.mini-avatar {
  width: 30px; height: 30px; background: var(--primary-light); color: var(--primary);
  border-radius: 8px; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px; flex-shrink: 0;
}
.col-name    { font-weight: 600; color: var(--text-main); }
.col-subtext { font-size: 12px; color: var(--text-muted); }

/* Method badges */
.badge-method {
  display: inline-block; padding: 3px 10px;
  border-radius: 100px; font-size: 11px; font-weight: 700;
}
.badge-method.auto   { background: #E5F6E7; color: #00AA13; }
.badge-method.manual { background: #F1F5F9; color: #475569; }

/* Status badges */
.status-badge {
  display: inline-block; padding: 4px 12px;
  border-radius: 100px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.4px;
}
.status-badge.paid    { background: #DCFCE7; color: #16A34A; border: 1px solid #BBF7D0; }
.status-badge.partial { background: #FFF7ED; color: #EA580C; border: 1px solid #FFEDD5; }
.status-badge.unpaid  { background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; }

.note-text { font-size: 12px; color: var(--text-muted); max-width: 160px; display: block; }

/* Table footer */
.table-footer {
  padding: 12px 24px; font-size: 12px; color: var(--text-muted);
  border-top: 1px solid var(--border); background: #FAFAFA;
}

/* ── Mobile Cards ── */
.detail-cards { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

.detail-card {
  border: 1px solid var(--border); border-radius: var(--radius-md);
  background: white; overflow: hidden;
}

.detail-card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid var(--border);
  background: #FAFAFA; gap: 12px;
}

.badge-stack { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }

.detail-card-body {
  display: grid; grid-template-columns: 1fr 1fr;
}

.card-stat-item {
  padding: 12px 16px; display: flex; flex-direction: column; gap: 3px;
  border-bottom: 1px solid var(--border);
}
.card-stat-item:nth-child(odd):not(.card-stat-full) {
  border-right: 1px solid var(--border);
}
.card-stat-full { grid-column: 1 / -1; }
.card-stat-item:last-child { border-bottom: none; }

.stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 600; }
.stat-value { font-size: 13px; color: var(--text-main); }

.mobile-empty { padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 14px; }

/* ═══════════════════════════════════════════
   VISIBILITY TOGGLE: DESKTOP / MOBILE
════════════════════════════════════════════ */
.desktop-only { display: block; }
.mobile-only  { display: none; }

/* ═══════════════════════════════════════════
   SHARED UTILITIES
════════════════════════════════════════════ */
.text-right  { text-align: right; }
.text-bold   { font-weight: 700; }
.text-green  { color: var(--primary); }
.text-danger { color: var(--danger); }
.text-muted  { color: var(--text-muted); }
.no-padding  { padding: 0; }

/* ═══════════════════════════════════════════
   STATES
════════════════════════════════════════════ */
.loading-card {
  display: flex; flex-direction: column; align-items: center;
  padding: 80px; gap: 16px; color: var(--text-muted);
}
.spinner {
  width: 36px; height: 36px; border: 4px solid var(--border);
  border-top-color: var(--primary); border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.error-card     { padding: 40px; text-align: center; color: var(--danger); }
.empty-state    { padding: 48px !important; text-align: center; color: var(--text-muted); }
.empty-box p    { font-size: 14px; }
.empty-state-text { text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0; }

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
  /* Visibility switch */
  .desktop-only { display: none !important; }
  .mobile-only  { display: block !important; }

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
  .filter-group { flex-direction: column; align-items: stretch; width: 100%; gap: 8px; }
  .search-input { width: 100% !important; }
  .select-filter { width: 100% !important; }

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
