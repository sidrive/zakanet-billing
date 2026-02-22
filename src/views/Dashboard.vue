<script setup>
import { onMounted } from "vue"
import { useDashboard } from "../composables/useDashboard"

const { summary, unpaidList, loadDashboard, recentPayments, ensureMonthlyInvoices } = useDashboard()

const currentMonth = new Date().toISOString().slice(0, 7)

onMounted(async () => {
  await ensureMonthlyInvoices(currentMonth)
  await loadDashboard(currentMonth)
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

<template>
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

      <!-- <button @click="handleGenerate">
        Generate Invoice Bulan Ini
      </button> -->

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
</template>

<style scoped>
.dashboard-container {
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
}
</style>
