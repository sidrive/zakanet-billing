<script setup>
import { ref, computed, onMounted } from "vue"
import { useDashboard } from "../composables/useDashboard"
import { checkAndAutoDraw } from "@/services/promoService"
import StatusBadge from "@/components/StatusBadge.vue"
import SheetModal from "@/components/SheetModal.vue"
import { PhCheckSquare, PhSquare, PhInfo, PhCaretRight } from "@phosphor-icons/vue"

const { summary, unpaidList, loadDashboard, recentPayments, ensureMonthlyInvoices } = useDashboard()

const currentMonth = new Date().toISOString().slice(0, 7)
const todayLabel = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })

// State & Logic Kalkulator Pembayaran ISP
const isModalOpen = ref(false)
const includeBaseShare = ref(true)
const selectedExpenses = ref([])
const selectedPayables = ref([])

const openModal = () => {
  if (!summary.value) return
  includeBaseShare.value = true
  selectedExpenses.value = (summary.value.ispExpenseList || []).map(e => e.id)
  selectedPayables.value = (summary.value.unpaidPayableList || []).map(p => p.id)
  isModalOpen.value = true
}

const selectAll = () => {
  includeBaseShare.value = true
  selectedExpenses.value = (summary.value?.ispExpenseList || []).map(e => e.id)
  selectedPayables.value = (summary.value?.unpaidPayableList || []).map(p => p.id)
}

const deselectAll = () => {
  includeBaseShare.value = false
  selectedExpenses.value = []
  selectedPayables.value = []
}

const toggleExpense = (id) => {
  const index = selectedExpenses.value.indexOf(id)
  if (index > -1) {
    selectedExpenses.value.splice(index, 1)
  } else {
    selectedExpenses.value.push(id)
  }
}

const togglePayable = (id) => {
  const index = selectedPayables.value.indexOf(id)
  if (index > -1) {
    selectedPayables.value.splice(index, 1)
  } else {
    selectedPayables.value.push(id)
  }
}

const calculatedTotal = computed(() => {
  if (!summary.value) return 0
  let total = 0
  if (includeBaseShare.value) {
    total += (summary.value.baseIspShare || 0)
  }

  if (summary.value.ispExpenseList) {
    summary.value.ispExpenseList.forEach(item => {
      if (selectedExpenses.value.includes(item.id)) {
        total += (item.amount || 0)
      }
    })
  }

  if (summary.value.unpaidPayableList) {
    summary.value.unpaidPayableList.forEach(item => {
      if (selectedPayables.value.includes(item.id)) {
        total += (item.remaining_amount || 0)
      }
    })
  }

  return total
})

const selectedCount = computed(() => {
  let count = 0
  if (includeBaseShare.value) count++
  count += selectedExpenses.value.length
  count += selectedPayables.value.length
  return count
})

const totalItemCount = computed(() => {
  let count = 1
  count += (summary.value?.ispExpenseList?.length || 0)
  count += (summary.value?.unpaidPayableList?.length || 0)
  return count
})

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
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
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
          <p class="stat-card__label">Kewajiban Bulan Ini ke Pusat</p>
          <h2 class="stat-card__value stat-card__value--red">Rp {{ formatRupiah(summary.ispObligation) }}</h2>
          <p class="stat-card__sublabel">50% omzet (Rp {{ formatRupiah(summary.baseIspShare) }}) + Jasa Teknisi (Rp {{ formatRupiah(summary.totalIspBillExpensesMonth) }})</p>
        </div>
        <div class="stat-card">
          <p class="stat-card__label">Hutang Material / Barang</p>
          <h2 class="stat-card__value stat-card__value--red">Rp {{ formatRupiah(summary.totalUnpaidPayables) }}</h2>
          <p class="stat-card__sublabel">Sisa hutang barang ke supplier/pusat</p>
        </div>
      </div>

      <div class="grand-total-banner grand-total-banner--clickable" @click="openModal">
        <div class="grand-total-banner__left">
          <span>Grand Total Wajib Dibayar ke ISP Pusat:</span>
        </div>
        <div class="grand-total-banner__right">
          <strong>Rp {{ formatRupiah(summary.grandTotalIspObligation) }}</strong>
          <span class="banner-action-tag">
            Rincian <PhCaretRight size="12" weight="bold" />
          </span>
        </div>
      </div>

      <div class="piutang-banner">
        <span>Piutang Aktif (Tagihan Pelanggan Belum Lunas):</span>
        <strong>Rp {{ formatRupiah(summary.totalOutstandingAll) }}</strong>
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

      <!-- Modal Rincian & Kalkulator Pembayaran ISP -->
      <SheetModal v-model="isModalOpen" title="Kalkulator Referensi Pembayaran ISP">
        <div v-if="summary" class="isp-calc-content">
          <!-- Banner Total Terpilih -->
          <div class="calc-total-card">
            <div class="calc-total-card__header">
              <span class="calc-total-card__label">Total Dipilih untuk Dibayar</span>
              <span class="calc-total-card__badge">{{ selectedCount }} dari {{ totalItemCount }} item</span>
            </div>
            <div class="calc-total-card__amount">
              Rp {{ formatRupiah(calculatedTotal) }}
            </div>
            <div class="calc-total-card__sub">
              Grand Total Keseluruhan: Rp {{ formatRupiah(summary.grandTotalIspObligation) }}
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="calc-action-bar">
            <button type="button" class="btn-text-sm" @click="selectAll">
              <PhCheckSquare size="14" /> Pilih Semua
            </button>
            <button type="button" class="btn-text-sm btn-text-sm--red" @click="deselectAll">
              <PhSquare size="14" /> Kosongkan
            </button>
          </div>

          <!-- Section 1: 50% Omzet Share -->
          <div class="calc-section">
            <div class="calc-section__title">1. Bagi Hasil Omzet Bulanan</div>
            <div
              class="calc-item-row"
              :class="{ 'is-selected': includeBaseShare }"
              @click="includeBaseShare = !includeBaseShare"
            >
              <input
                type="checkbox"
                :checked="includeBaseShare"
                @click.stop="includeBaseShare = !includeBaseShare"
              />
              <div class="calc-item-row__info">
                <div class="calc-item-row__name">50% Omzet Tagihan Bulan Ini</div>
                <div class="calc-item-row__sub">Dari total tagihan Rp {{ formatRupiah(summary.totalBillableAmount) }}</div>
              </div>
              <div class="calc-item-row__amount">
                Rp {{ formatRupiah(summary.baseIspShare) }}
              </div>
            </div>
          </div>

          <!-- Section 2: Jasa Teknisi & Tagihan ISP -->
          <div class="calc-section">
            <div class="calc-section__title">
              2. Jasa Teknisi & Operasional ISP ({{ summary.ispExpenseList?.length || 0 }})
            </div>
            <div v-if="summary.ispExpenseList && summary.ispExpenseList.length > 0" class="calc-item-list">
              <div
                v-for="item in summary.ispExpenseList"
                :key="item.id"
                class="calc-item-row"
                :class="{ 'is-selected': selectedExpenses.includes(item.id) }"
                @click="toggleExpense(item.id)"
              >
                <input
                  type="checkbox"
                  :checked="selectedExpenses.includes(item.id)"
                  @click.stop="toggleExpense(item.id)"
                />
                <div class="calc-item-row__info">
                  <div class="calc-item-row__name">{{ item.description }}</div>
                  <div class="calc-item-row__sub">Kategori: {{ item.category }}</div>
                </div>
                <div class="calc-item-row__amount">
                  Rp {{ formatRupiah(item.amount) }}
                </div>
              </div>
            </div>
            <div v-else class="empty-section-hint">
              Tidak ada pengeluaran di-tag untuk ISP bulan ini
            </div>
          </div>

          <!-- Section 3: Hutang Material/Perangkat -->
          <div class="calc-section">
            <div class="calc-section__title">
              3. Hutang Material & Perangkat ({{ summary.unpaidPayableList?.length || 0 }})
            </div>
            <div v-if="summary.unpaidPayableList && summary.unpaidPayableList.length > 0" class="calc-item-list">
              <div
                v-for="item in summary.unpaidPayableList"
                :key="item.id"
                class="calc-item-row"
                :class="{ 'is-selected': selectedPayables.includes(item.id) }"
                @click="togglePayable(item.id)"
              >
                <input
                  type="checkbox"
                  :checked="selectedPayables.includes(item.id)"
                  @click.stop="togglePayable(item.id)"
                />
                <div class="calc-item-row__info">
                  <div class="calc-item-row__name">{{ item.description }}</div>
                  <div class="calc-item-row__sub">
                    {{ item.supplier_name }} &bull; Total: Rp {{ formatRupiah(item.amount) }} (Sisa: Rp {{ formatRupiah(item.remaining_amount) }})
                  </div>
                </div>
                <div class="calc-item-row__amount calc-item-row__amount--red">
                  Rp {{ formatRupiah(item.remaining_amount) }}
                </div>
              </div>
            </div>
            <div v-else class="empty-section-hint">
              Tidak ada sisa hutang material/perangkat aktif
            </div>
          </div>

          <div class="calc-footer-note">
            <PhInfo size="15" />
            <span>Fitur ini adalah kalkulator bantu untuk referensi pembayaran. Pilihan di atas tidak mengubah status transaksi di sistem.</span>
          </div>
        </div>
      </SheetModal>
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
  box-shadow: var(--shadow-card);
  transition: var(--transition-card);
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
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.grand-total-banner {
  margin-top: 14px;
  padding: 12px 18px;
  border-radius: var(--radius-card);
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 700;
}

.grand-total-banner--clickable {
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

.grand-total-banner--clickable:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  transform: translateY(-1px);
}

.grand-total-banner__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.banner-action-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: #fca5a5;
  color: #7f1d1d;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  font-weight: 700;
}

.piutang-banner {
  margin-top: 10px;
  padding: 12px 18px;
  border-radius: var(--radius-card);
  background: var(--color-orange-tint);
  border: 1px solid #FED7AA;
  color: var(--color-orange-text);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 700;
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
  box-shadow: var(--shadow-card);
  transition: var(--transition-card);
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
  box-shadow: var(--shadow-card);
  transition: var(--transition-card);
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
  box-shadow: var(--shadow-card);
  transition: var(--transition-card);
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

/* --- Kalkulator Modal Styles --- */
.isp-calc-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.calc-total-card {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-card);
  padding: 16px;
}

.calc-total-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.calc-total-card__label {
  font-size: 12px;
  font-weight: 700;
  color: #991b1b;
}

.calc-total-card__badge {
  font-size: 11px;
  font-weight: 700;
  background: #fca5a5;
  color: #7f1d1d;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}

.calc-total-card__amount {
  font-size: 24px;
  font-weight: 800;
  color: #991b1b;
  margin-top: 6px;
}

.calc-total-card__sub {
  font-size: 11px;
  color: #b91c1c;
  margin-top: 4px;
}

.calc-action-bar {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-text-sm {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s ease;
}

.btn-text-sm:hover {
  background: var(--color-chip-bg);
  color: var(--color-text-primary);
}

.btn-text-sm--red {
  color: var(--color-red);
}

.btn-text-sm--red:hover {
  background: #fee2e2;
}

.calc-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calc-section__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.calc-item-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.calc-item-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.calc-item-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: var(--color-green);
}

.calc-item-row:hover {
  border-color: var(--color-green);
}

.calc-item-row.is-selected {
  background: var(--color-green-tint, #f0fdf4);
  border-color: var(--color-green, #16a34a);
}

.calc-item-row__info {
  flex: 1;
  min-width: 0;
}

.calc-item-row__name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.calc-item-row__sub {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.calc-item-row__amount {
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text-primary);
  text-align: right;
  flex-shrink: 0;
}

.calc-item-row__amount--red {
  color: var(--color-red);
}

.empty-section-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-style: italic;
  padding: 8px 12px;
  background: var(--color-chip-bg);
  border-radius: 8px;
}

.calc-footer-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-chip-bg);
  padding: 10px 12px;
  border-radius: 8px;
  margin-top: 4px;
}

.calc-footer-note svg {
  flex-shrink: 0;
  margin-top: 1px;
}
</style>
