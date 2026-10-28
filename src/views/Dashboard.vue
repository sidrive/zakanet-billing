<script setup>
import { ref, computed, onMounted } from "vue"
import { useDashboard } from "../composables/useDashboard"
import { checkAndAutoDraw } from "@/services/promoService"
import StatusBadge from "@/components/StatusBadge.vue"
import SheetModal from "@/components/SheetModal.vue"
import { PhCheckSquare, PhSquare, PhInfo, PhCaretRight, PhWallet } from "@phosphor-icons/vue"
import { addExpense, markExpenseAsPaid } from "@/services/expenseService"
import { recordPayablePayment } from "@/services/payableService"
import { useToast } from "@/composables/useToast"

const { showToast } = useToast()
const { summary, unpaidList, loading, error, loadDashboard, recentPayments, ensureMonthlyInvoices } = useDashboard()

const currentMonth = new Date().toISOString().slice(0, 7)
const todayLabel = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })

const formatRupiah = (val) => {
  const num = Number(val)
  if (isNaN(num)) return "0"
  return new Intl.NumberFormat("id-ID").format(num)
}

const formatDate = (timestamp) => {
  if (!timestamp) return "-"
  let date = null
  if (typeof timestamp.toDate === "function") {
    date = timestamp.toDate()
  } else if (timestamp?.seconds) {
    date = new Date(timestamp.seconds * 1000)
  } else {
    date = new Date(timestamp)
  }
  if (!date || isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("id-ID")
}

const initials = (name) => (name || "?").charAt(0).toUpperCase()

// State & Logic Kalkulator Pembayaran ISP
const isModalOpen = ref(false)
const showConfirm = ref(false)
const isSubmitting = ref(false)
const includeBaseShare = ref(true)
const selectedExpenses = ref([])
const selectedPayables = ref([])

onMounted(async () => {
  try {
    await loadDashboard(currentMonth)
  } catch (err) {
    console.error("Error in loadDashboard:", err)
  }

  try {
    ensureMonthlyInvoices(currentMonth)
  } catch (err) {
    console.error("Error in ensureMonthlyInvoices:", err)
  }

  try {
    checkAndAutoDraw(currentMonth)
  } catch (err) {
    console.error("Error in checkAndAutoDraw:", err)
  }
})

const retryLoad = async () => {
  try {
    await loadDashboard(currentMonth)
  } catch (err) {
    console.error("Error retrying loadDashboard:", err)
  }
}

const openModal = () => {
  if (!summary.value) return
  // Jangan centang "Bagi Hasil Omzet" secara default kalau sudah lunas bulan ini (baseIspShare
  // sudah 0) -- kalau tidak, tiap kali kalkulator dibuka lagi (mis. buat bayar vendor yang baru
  // muncul) akan ikut membuat entri Pengeluaran "Setoran Bagi Hasil ISP" senilai Rp 0 berulang.
  includeBaseShare.value = !summary.value.isIspSharePaid
  selectedExpenses.value = (summary.value.ispExpenseList || []).map(e => e.id)
  selectedPayables.value = (summary.value.unpaidPayableList || []).map(p => p.id)
  isModalOpen.value = true
}

const selectAll = () => {
  includeBaseShare.value = !summary.value?.isIspSharePaid
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

const processSettlement = async () => {
  if (isSubmitting.value) return
  isSubmitting.value = true

  try {
    // 1. Bayar Bagi Hasil -- skip kalau sudah lunas bulan ini (baseIspShare 0), biar tidak
    // bikin entri Pengeluaran Rp 0 yang redundan.
    if (includeBaseShare.value && summary.value.baseIspShare > 0) {
      await addExpense({
        category: "Setoran Bagi Hasil ISP",
        description: `Bagi hasil omzet 50% bulan ${currentMonth}`,
        amount: summary.value.baseIspShare,
        date: new Date().toISOString().slice(0, 10),
        payment_method: "Transfer",
        is_isp_bill: true,
        note: "Pembayaran otomatis via kalkulator dashboard"
      })
    }

    // 2. Bayar pengeluaran teknisi
    for (const expId of selectedExpenses.value) {
      await markExpenseAsPaid(expId)
    }

    // 3. Bayar payables
    for (const payId of selectedPayables.value) {
      const payable = summary.value.unpaidPayableList.find(p => p.id === payId)
      if (payable) {
        await recordPayablePayment(payId, {
          amount: payable.remaining_amount,
          method: "tunai_transfer",
          note: "Pelunasan otomatis via kalkulator dashboard"
        })
      }
    }

    showToast("Pembayaran berhasil diproses")
    showConfirm.value = false
    isModalOpen.value = false
    await loadDashboard(currentMonth)
  } catch (err) {
    console.error(err)
    alert("Gagal memproses pembayaran: " + err.message)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="dashboard-page">
    <div class="dashboard-greeting">
      <div class="dashboard-greeting__hello">Halo, Admin 👋</div>
      <div class="dashboard-greeting__date">{{ todayLabel }}</div>
    </div>

    <div v-if="!summary && error" class="card loading-card">
      <p style="color: var(--color-red); font-weight: 700; margin-bottom: 6px;">Gagal Memuat Dashboard</p>
      <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">{{ error }}</p>
      <button type="button" class="btn-primary" style="padding: 8px 16px; border-radius: var(--radius-card);" @click="retryLoad">Coba Lagi</button>
    </div>

    <div v-else-if="!summary" class="card loading-card">
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
            <span>Pilih item yang ingin dilunasi di atas, lalu klik tombol pembayaran di bawah untuk mengeksekusi pelunasan otomatis.</span>
          </div>

          <!-- Tombol Aksi Bayar -->
          <div class="calc-footer-actions">
            <button
              type="button"
              class="btn-primary-action"
              :disabled="selectedCount === 0"
              @click="showConfirm = true"
            >
              <PhWallet size="18" weight="bold" />
              Bayar / Lunasi Terpilih (Rp {{ formatRupiah(calculatedTotal) }})
            </button>
          </div>
        </div>
      </SheetModal>

      <!-- Modal Konfirmasi Pembayaran -->
      <div v-if="showConfirm" class="modal-overlay">
        <div class="modal-dialog animate-scale-in">
          <div class="modal-header">
            <h3>Konfirmasi Pelunasan & Pembayaran</h3>
          </div>
          <div class="modal-body">
            <p>Anda akan memproses pelunasan untuk <strong>{{ selectedCount }} item</strong> dengan total sebesar:</p>
            <div class="confirm-total-box">
              Rp {{ formatRupiah(calculatedTotal) }}
            </div>
            <p class="confirm-note">
              Tindakan ini akan mencatat pembayaran secara otomatis dan menghilangkan item yang lunas dari daftar kewajiban di dashboard.
            </p>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn-secondary"
              @click="showConfirm = false"
              :disabled="isSubmitting"
            >
              Batal
            </button>
            <button
              type="button"
              class="btn-primary"
              @click="processSettlement"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? 'Memproses...' : 'Ya, Bayar & Lunasi' }}
            </button>
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

.calc-total-card {
  background: var(--color-dark-surface);
  color: var(--color-dark-surface-text);
  border-radius: var(--radius-card);
  padding: 16px;
  margin-bottom: 16px;
}

.calc-total-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  opacity: 0.8;
}

.calc-total-card__amount {
  font-size: 24px;
  font-weight: 800;
  margin: 8px 0;
}

.calc-total-card__sub { font-size: 11px; opacity: 0.7; }

.calc-action-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.btn-text-sm {
  background: none;
  border: 1px solid var(--color-card-border);
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-text-sm--red { color: var(--color-red); border-color: var(--color-red-tint); }

.calc-section { margin-bottom: 20px; }
.calc-section__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
}

.calc-item-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-card-border);
  cursor: pointer;
  margin-bottom: 6px;
  transition: background 0.2s;
}

.calc-item-row.is-selected { background: #f0fdf4; border-color: #bbf7d0; }

.calc-item-row__info { flex: 1; min-width: 0; }
.calc-item-row__name { font-size: 13px; font-weight: 600; }
.calc-item-row__sub { font-size: 11px; color: var(--color-text-secondary); }
.calc-item-row__amount { font-size: 13px; font-weight: 700; }
.calc-item-row__amount--red { color: var(--color-red); }

.empty-section-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-style: italic;
  padding: 8px;
}

.calc-footer-note {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-chip-bg);
  padding: 10px;
  border-radius: var(--radius-card);
  line-height: 1.4;
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

.calc-footer-actions {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-divider);
}

.btn-primary-action {
  width: 100%;
  padding: 14px;
  background: var(--color-green);
  color: white;
  border: none;
  border-radius: var(--radius-card);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary-action:hover:not(:disabled) {
  background: #059669; /* var(--color-green-dark) approximation */
  transform: translateY(-2px);
}

.btn-primary-action:disabled {
  background: var(--color-text-tertiary);
  cursor: not-allowed;
}

/* Modal Konfirmasi */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-dialog {
  background: var(--color-card-bg);
  border-radius: var(--radius-card-lg);
  padding: 24px;
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-modal);
}

.modal-header h3 { font-size: 16px; font-weight: 800; color: var(--color-text-primary); }

.confirm-total-box {
  margin: 16px 0;
  padding: 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  font-size: 22px;
  font-weight: 800;
  text-align: center;
  border-radius: var(--radius-card);
}

.confirm-note { font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; }

.modal-footer {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}

.btn-secondary {
  flex: 1; padding: 12px; background: var(--color-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card); font-weight: 600; cursor: pointer;
}

.btn-primary {
  flex: 1; padding: 12px; background: var(--color-green);
  color: white; border: none; border-radius: var(--radius-card);
  font-weight: 600; cursor: pointer;
}

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
