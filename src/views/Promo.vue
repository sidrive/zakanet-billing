<script setup>
import { ref, computed, onMounted } from "vue"
import {
  getPromoSettings, updatePromoSettings,
  toggleAutoDraw, seedPromoHistory, drawWinners,
  getWinnersForMonth, getAllWinners, getEligibleQueue
} from "../services/promoService"

// ── State ──────────────────────────────────────────────────
const loading       = ref(true)
const isDrawing     = ref(false)
const settings      = ref(null)
const currentWinners = ref([])
const eligibleQueue  = ref([])
const allWinners     = ref([])

const currentMonth = new Date().toISOString().slice(0, 7)

// ── Helpers ────────────────────────────────────────────────
const formatRupiah = (val) =>
  "Rp " + new Intl.NumberFormat("id-ID").format(val || 0)

const monthLabel = (m) => {
  if (!m) return "-"
  const [y, mo] = m.split("-")
  return new Date(Number(y), Number(mo) - 1)
    .toLocaleDateString("id-ID", { month: "long", year: "numeric" })
}

const formatJoinDate = (ts) => {
  if (!ts) return "Pelanggan Lama"
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString("id-ID", { month: "short", year: "numeric" })
}

// ── Computed ───────────────────────────────────────────────
const historyGrouped = computed(() => {
  const groups = {}
  allWinners.value.forEach(w => {
    if (!groups[w.month]) groups[w.month] = []
    groups[w.month].push(w)
  })
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, winners]) => ({ month, winners }))
})

const totalWinnersReal = computed(() =>
  allWinners.value.filter(w => !w.seeded).length
)

const isCurrentMonthDrawn = computed(() =>
  settings.value?.last_draw_month === currentMonth || currentWinners.value.length > 0
)

// ── Data loader ────────────────────────────────────────────
async function loadAll() {
  const [s, winners, queue, history] = await Promise.all([
    getPromoSettings(),
    getWinnersForMonth(currentMonth),
    getEligibleQueue(currentMonth),
    getAllWinners()
  ])
  settings.value       = s
  currentWinners.value = winners
  eligibleQueue.value  = queue
  allWinners.value     = history
}

// ── Actions ────────────────────────────────────────────────
async function handleToggleAutoDraw() {
  const next = !settings.value.auto_draw_enabled
  await toggleAutoDraw(next)
  settings.value = { ...settings.value, auto_draw_enabled: next }
}

async function handleManualDraw() {
  isDrawing.value = true
  try {
    await drawWinners(currentMonth)
    await loadAll()
  } finally {
    isDrawing.value = false
  }
}

async function handleUpdateDiscount(val) {
  const num = Number(val)
  if (!num || num <= 0 || num > 100) return
  await updatePromoSettings({ discount_percent: num })
  settings.value = { ...settings.value, discount_percent: num }
}

// ── Mount ──────────────────────────────────────────────────
onMounted(async () => {
  try {
    await seedPromoHistory() // idempoten — hanya berjalan sekali
    await loadAll()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="promo-page">

    <!-- ── Loading ── -->
    <div v-if="loading" class="card loading-card">
      <div class="spinner"></div>
      <p>Memuat data promo...</p>
    </div>

    <template v-else>

      <!-- ═══════════════════════════════════════════════════
           HEADER
      ════════════════════════════════════════════════════ -->
      <div class="promo-header">
        <div>
          <h2 class="section-title">Promo Bulanan</h2>
          <p class="section-subtitle">
            Undian hadiah untuk pelanggan setia · Batch #{{ settings?.current_batch ?? 1 }} · {{ monthLabel(currentMonth) }}
          </p>
        </div>

        <div class="header-controls">
          <!-- Auto-Draw Toggle -->
          <div class="toggle-row" @click="handleToggleAutoDraw">
            <span class="toggle-label">Auto-Draw saat Login</span>
            <div :class="['switch', settings?.auto_draw_enabled ? 'on' : 'off']">
              <div class="switch-thumb"></div>
            </div>
          </div>

          <!-- Manual Draw Button -->
          <button
            v-if="!isCurrentMonthDrawn"
            class="btn-draw"
            :class="{ 'btn-loading': isDrawing }"
            :disabled="isDrawing"
            @click="handleManualDraw"
          >
            <span v-if="!isDrawing">🎲 Jalankan Undian</span>
            <span v-else class="loader-flex">
              <div class="mini-spinner"></div> Mengundi...
            </span>
          </button>
          <div v-else class="badge-done">✓ Sudah Diundi</div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════
           STAT CARDS
      ════════════════════════════════════════════════════ -->
      <div class="stat-row">
        <div class="card stat-mini">
          <p class="stat-mini-label">Batch Saat Ini</p>
          <h3 class="stat-mini-value">#{{ settings?.current_batch ?? 1 }}</h3>
        </div>
        <div class="card stat-mini">
          <p class="stat-mini-label">Dalam Antrian</p>
          <h3 class="stat-mini-value">{{ eligibleQueue.length }}</h3>
        </div>
        <div class="card stat-mini">
          <p class="stat-mini-label">Total Pemenang</p>
          <h3 class="stat-mini-value">{{ totalWinnersReal }}</h3>
        </div>
        <div class="card stat-mini">
          <p class="stat-mini-label">Nilai Diskon</p>
          <h3 class="stat-mini-value green">{{ settings?.discount_percent ?? 50 }}%</h3>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════
           PEMENANG BULAN INI
      ════════════════════════════════════════════════════ -->
      <p class="section-label mt-0">🏆 Pemenang {{ monthLabel(currentMonth) }}</p>

      <!-- Winners exist -->
      <div v-if="currentWinners.length" class="winners-grid">
        <div
          v-for="(w, idx) in currentWinners"
          :key="w.id"
          :class="['winner-card', idx === 0 ? 'winner-gold' : 'winner-silver']"
        >
          <div class="winner-trophy">{{ idx === 0 ? '🥇' : '🥈' }}</div>
          <div class="winner-rank">Pemenang {{ idx + 1 }}</div>
          <h2 class="winner-name">{{ w.customer_name }}</h2>
          <div class="winner-discount">
            <span class="discount-label">Diskon Invoice</span>
            <span class="discount-value">{{ w.discount_percent ?? 50 }}%</span>
            <span v-if="w.discount_amount > 0" class="discount-actual">
              ≈ {{ formatRupiah(w.discount_amount) }}
            </span>
          </div>
          <div class="winner-badges">
            <span v-if="w.invoice_updated" class="winner-badge applied">
              ✓ Invoice Terpotong
            </span>
            <span v-else-if="w.seeded" class="winner-badge applied">
              ✓ Data Historis
            </span>
            <span v-else class="winner-badge pending">
              ⏳ Menunggu Invoice
            </span>
          </div>
        </div>

        <!-- Placeholder jika hanya 1 pemenang -->
        <div v-if="currentWinners.length < 2" class="winner-card winner-empty">
          <div class="winner-trophy">🎰</div>
          <p class="winner-empty-text">Tidak cukup pelanggan eligible untuk 2 pemenang</p>
        </div>
      </div>

      <!-- No draw yet -->
      <div v-else class="card no-draw-card">
        <div class="no-draw-icon">🎁</div>
        <h3 class="no-draw-title">Undian Belum Dijalankan</h3>
        <p class="no-draw-sub">
          {{ settings?.auto_draw_enabled
            ? 'Auto-Draw aktif — akan berjalan otomatis saat admin login bulan ini'
            : 'Auto-Draw nonaktif — tekan tombol "Jalankan Undian" untuk memulai' }}
        </p>
        <button
          class="btn-draw-lg"
          :class="{ 'btn-loading': isDrawing }"
          :disabled="isDrawing"
          @click="handleManualDraw"
        >
          <span v-if="!isDrawing">🎲 Jalankan Undian Sekarang</span>
          <span v-else class="loader-flex"><div class="mini-spinner white"></div> Mengundi...</span>
        </button>
      </div>

      <!-- ═══════════════════════════════════════════════════
           MAIN GRID: ANTRIAN + RIWAYAT
      ════════════════════════════════════════════════════ -->
      <div class="main-grid">

        <!-- ── Daftar Tunggu (Eligible Queue) ── -->
        <div class="card no-padding">
          <div class="card-header-table">
            <div>
              <h4 class="card-inner-title">Daftar Tunggu</h4>
              <p class="card-inner-subtitle">Pelanggan eligible yang belum menang di batch ini</p>
            </div>
            <span class="count-badge">{{ eligibleQueue.length }} pelanggan</span>
          </div>

          <div class="queue-list">
            <div v-for="c in eligibleQueue" :key="c.id" class="queue-row">
              <span class="queue-row__name">{{ c.name }}</span>
              <span class="queue-row__meta">{{ c.product_name || 'Custom' }} · {{ formatJoinDate(c.join_date) }}</span>
            </div>
            <div v-if="eligibleQueue.length === 0" class="empty-state">
              <div class="empty-box">
                <span class="empty-icon">🎉</span>
                <p>Semua pelanggan sudah menang di batch ini!</p>
                <p class="text-muted text-sm">Batch baru dimulai pada undian berikutnya</p>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Riwayat Pemenang ── -->
        <div class="card no-padding">
          <div class="card-header-table">
            <div>
              <h4 class="card-inner-title">Riwayat Pemenang</h4>
              <p class="card-inner-subtitle">Semua pemenang undian sejak awal</p>
            </div>
            <span class="count-badge">{{ historyGrouped.length }} bulan</span>
          </div>

          <div class="history-scroll">
            <div
              v-for="group in historyGrouped"
              :key="group.month"
              class="history-group"
            >
              <div class="history-month-header">
                <span class="history-month-label">{{ monthLabel(group.month) }}</span>
                <span v-if="group.month === currentMonth" class="badge-current">Bulan Ini</span>
                <span v-if="group.winners[0]?.batch === 0" class="badge-history">Historis</span>
              </div>

              <div class="history-winners-row">
                <div
                  v-for="(w, i) in group.winners"
                  :key="w.id"
                  class="history-winner-chip"
                >
                  <span class="chip-rank">{{ i === 0 ? '🥇' : '🥈' }}</span>
                  <span class="chip-name">{{ w.customer_name }}</span>
                  <span v-if="w.invoice_updated && w.discount_amount > 0" class="chip-discount">
                    −{{ formatRupiah(w.discount_amount) }}
                  </span>
                  <span v-else class="chip-discount">
                    −{{ w.discount_percent ?? 50 }}%
                  </span>
                </div>
              </div>
            </div>

            <div v-if="historyGrouped.length === 0" class="empty-state">
              <div class="empty-box">
                <span class="empty-icon">📋</span>
                <p>Belum ada riwayat pemenang</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- ═══════════════════════════════════════════════════
           PENGATURAN DISKON
      ════════════════════════════════════════════════════ -->
      <div class="card settings-card">
        <h4 class="card-inner-title">⚙️ Pengaturan Promo</h4>
        <div class="settings-grid">
          <div class="setting-item">
            <label class="input-label">Persentase Diskon per Pemenang (%)</label>
            <div class="setting-input-row">
              <input
                type="number"
                class="main-input setting-input"
                :value="settings?.discount_percent"
                @change="handleUpdateDiscount($event.target.value)"
                placeholder="50"
                min="1"
                max="100"
              />
              <span class="setting-hint">Dihitung dari tagihan bulan berjalan pemenang</span>
            </div>
          </div>
          <div class="setting-item">
            <label class="input-label">Status Auto-Draw</label>
            <div class="setting-toggle-area" @click="handleToggleAutoDraw">
              <div :class="['switch lg', settings?.auto_draw_enabled ? 'on' : 'off']">
                <div class="switch-thumb"></div>
              </div>
              <div>
                <p class="toggle-status-text">
                  {{ settings?.auto_draw_enabled ? 'Aktif' : 'Nonaktif' }}
                </p>
                <p class="text-muted text-sm">
                  {{ settings?.auto_draw_enabled
                    ? 'Undian berjalan otomatis tiap kali admin login di bulan baru'
                    : 'Admin harus memicu undian secara manual' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.promo-page { padding: 0; }

/* ── Loading ── */
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

/* ── Page Header ── */
.promo-header {
  display: flex; align-items: flex-start;
  justify-content: space-between; flex-wrap: wrap;
  gap: 16px; margin-bottom: 24px;
}

.section-title    { font-size: 24px; font-weight: 800; color: var(--color-text-primary); }
.section-subtitle { font-size: 14px; color: var(--color-text-secondary); margin-top: 4px; }

.header-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

/* Auto-Draw Toggle Row */
.toggle-row {
  display: flex; align-items: center; gap: 10px; cursor: pointer;
  background: white; border: 1px solid var(--color-card-border);
  padding: 8px 16px; border-radius: var(--radius-pill);
  transition: border-color 0.15s;
}
.toggle-row:hover { border-color: var(--color-green); }
.toggle-label { font-size: 13px; font-weight: 600; color: var(--color-text-primary); white-space: nowrap; }

/* Switch toggle */
.switch {
  width: 40px; height: 22px; border-radius: var(--radius-pill);
  position: relative; cursor: pointer; transition: background 0.2s;
  flex-shrink: 0;
}
.switch.on  { background: var(--color-green); }
.switch.off { background: #CBD5E1; }
.switch.lg  { width: 52px; height: 28px; }

.switch-thumb {
  position: absolute; top: 3px; width: 16px; height: 16px;
  background: white; border-radius: 50%; transition: left 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.switch.on  .switch-thumb { left: 20px; }
.switch.off .switch-thumb { left: 3px; }
.switch.lg .switch-thumb  { width: 22px; height: 22px; top: 3px; }
.switch.lg.on  .switch-thumb { left: 27px; }
.switch.lg.off .switch-thumb { left: 3px; }

/* Draw buttons */
.btn-draw {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 20px; background: var(--color-green); color: white;
  border-radius: var(--radius-pill); font-size: 14px; font-weight: 700;
  border: none; cursor: pointer; transition: background 0.15s;
  white-space: nowrap;
}
.btn-draw:hover:not(:disabled) { background: var(--color-green-hover); }
.btn-draw:disabled { opacity: 0.7; cursor: not-allowed; }

.badge-done {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; background: var(--color-green-tint); color: var(--color-green);
  border: 1px solid var(--color-green-tint-border); border-radius: var(--radius-pill);
  font-size: 13px; font-weight: 700;
}

/* ── Stat Row ── */
.stat-row {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 16px; margin-bottom: 24px;
}
.stat-mini { padding: 18px 20px; }
.stat-mini-label { font-size: 12px; color: var(--color-text-secondary); font-weight: 500; }
.stat-mini-value { font-size: 22px; font-weight: 800; color: var(--color-text-primary); margin-top: 4px; }
.stat-mini-value.green { color: var(--color-green); }

/* ── Section Label ── */
.section-label { font-size: 16px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 16px; }
.mt-0 { margin-top: 0; }

/* ── Winner Cards ── */
.winners-grid {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 20px; margin-bottom: 24px;
}

.winner-card {
  border-radius: 20px; padding: 32px 28px;
  display: flex; flex-direction: column; align-items: center;
  text-align: center; gap: 8px; position: relative; overflow: hidden;
}

.winner-gold {
  background: linear-gradient(135deg, var(--color-green) 0%, var(--color-green-hover) 100%);
  box-shadow: 0 8px 30px rgba(5, 150, 105, 0.30);
}
.winner-silver {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  box-shadow: 0 8px 30px rgba(30, 41, 59, 0.25);
}

.winner-trophy { font-size: 48px; line-height: 1; margin-bottom: 4px; }

.winner-rank {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 1px; color: rgba(255,255,255,0.7);
}

.winner-name {
  font-size: 28px; font-weight: 900; color: white;
  margin: 4px 0; line-height: 1.2;
}

.winner-discount {
  display: flex; flex-direction: column; align-items: center;
  background: rgba(255,255,255,0.15); border-radius: 12px;
  padding: 10px 20px; margin-top: 4px; width: 100%;
}
.discount-label  { font-size: 11px; color: rgba(255,255,255,0.7); font-weight: 600; }
.discount-value  { font-size: 24px; font-weight: 800; color: white; }
.discount-actual { font-size: 13px; color: rgba(255,255,255,0.75); font-weight: 600; margin-top: 2px; }

.winner-badges { margin-top: 4px; }
.winner-badge {
  display: inline-block; padding: 4px 12px; border-radius: var(--radius-pill);
  font-size: 11px; font-weight: 700;
}
.winner-badge.applied { background: rgba(255,255,255,0.25); color: white; }
.winner-badge.pending { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }

.winner-empty {
  background: var(--color-surface); border: 2px dashed var(--color-card-border);
  box-shadow: none; justify-content: center;
}
.winner-empty .winner-trophy { font-size: 40px; }
.winner-empty-text { font-size: 14px; color: var(--color-text-secondary); max-width: 200px; }

/* ── No Draw Card ── */
.no-draw-card {
  display: flex; flex-direction: column; align-items: center;
  padding: 60px 40px; gap: 12px; text-align: center;
  margin-bottom: 24px;
}
.no-draw-icon  { font-size: 56px; }
.no-draw-title { font-size: 20px; font-weight: 800; color: var(--color-text-primary); }
.no-draw-sub   { font-size: 14px; color: var(--color-text-secondary); max-width: 400px; }

.btn-draw-lg {
  display: inline-flex; align-items: center; gap: 10px; margin-top: 8px;
  padding: 12px 28px; background: var(--color-green); color: white;
  border-radius: var(--radius-pill); font-size: 15px; font-weight: 700;
  border: none; cursor: pointer; transition: background 0.15s;
}
.btn-draw-lg:hover:not(:disabled) { background: var(--color-green-hover); }
.btn-draw-lg:disabled { opacity: 0.7; cursor: not-allowed; }

/* ── Main Grid ── */
.main-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 20px; margin-bottom: 24px;
}

/* ── Shared Table/Card Styles ── */
.card-header-table {
  padding: 20px 24px;
  display: flex; justify-content: space-between; align-items: flex-start;
  border-bottom: 1px solid var(--color-card-border); gap: 12px;
}
.card-inner-title    { font-size: 15px; font-weight: 700; color: var(--color-text-primary); }
.card-inner-subtitle { font-size: 13px; color: var(--color-text-secondary); margin-top: 2px; }

.count-badge {
  background: var(--color-chip-bg); color: var(--color-text-tertiary); padding: 4px 12px;
  border-radius: var(--radius-pill); font-size: 12px; font-weight: 700; white-space: nowrap;
}

.queue-list { padding: 4px 8px; }
.queue-row {
  display: flex;
  justify-content: space-between;
  padding: 11px 16px;
  border-bottom: 1px solid var(--color-divider);
  font-size: 13px;
}
.queue-row:last-child { border-bottom: none; }
.queue-row__name { font-weight: 600; color: var(--color-text-primary); }
.queue-row__meta { color: var(--color-text-secondary); }

.text-muted { color: var(--color-text-secondary); }
.text-sm    { font-size: 12px; }

/* ── History Panel ── */
.history-scroll { max-height: 400px; overflow-y: auto; }

.history-group { padding: 16px 24px; border-bottom: 1px solid var(--color-card-border); }
.history-group:last-child { border-bottom: none; }

.history-month-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
}
.history-month-label { font-size: 13px; font-weight: 700; color: var(--color-text-primary); }

.badge-current {
  background: var(--color-green-tint); color: var(--color-green);
  padding: 2px 8px; border-radius: var(--radius-pill); font-size: 10px; font-weight: 700;
}
.badge-history {
  background: var(--color-chip-bg); color: var(--color-chip-text);
  padding: 2px 8px; border-radius: var(--radius-pill); font-size: 10px; font-weight: 700;
}

.history-winners-row { display: flex; gap: 10px; flex-wrap: wrap; }

.history-winner-chip {
  display: flex; align-items: center; gap: 6px;
  background: var(--color-surface); border: 1px solid var(--color-card-border);
  border-radius: var(--radius-pill); padding: 6px 14px;
}
.chip-rank     { font-size: 14px; }
.chip-name     { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.chip-discount { font-size: 11px; color: var(--color-green); font-weight: 700; }

/* ── Empty State ── */
.empty-state { padding: 48px 20px !important; text-align: center; }
.empty-box   { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty-icon  { font-size: 40px; }

/* ── Settings Card ── */
.settings-card { padding: 24px; }
.settings-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 24px; margin-top: 16px;
}
.setting-item { display: flex; flex-direction: column; gap: 8px; }

.setting-input-row { display: flex; align-items: center; gap: 12px; }
.setting-input { width: 160px !important; font-weight: 700; }
.setting-hint  { font-size: 12px; color: var(--color-text-secondary); }

.setting-toggle-area {
  display: flex; align-items: center; gap: 14px; cursor: pointer;
  padding: 12px 16px; background: var(--color-surface); border-radius: 12px;
  border: 1px solid var(--color-card-border); transition: border-color 0.15s;
}
.setting-toggle-area:hover { border-color: var(--color-green); }
.toggle-status-text { font-size: 14px; font-weight: 700; color: var(--color-text-primary); }

/* ── Loading button state ── */
.btn-loading { opacity: 0.8; cursor: not-allowed !important; }
.loader-flex { display: flex; align-items: center; gap: 8px; }
.mini-spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(5,150,105,0.3); border-top-color: var(--color-green);
  border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0;
}
.mini-spinner.white {
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
}

.no-padding { padding: 0; }

/* ── Responsive ── */
@media (max-width: 1024px) {
  .stat-row   { grid-template-columns: repeat(2, 1fr); }
  .main-grid  { grid-template-columns: 1fr; }
  .settings-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .promo-header  { flex-direction: column; }
  .header-controls { flex-direction: column; align-items: flex-start; }
  .winners-grid  { grid-template-columns: 1fr; }
  .winner-name   { font-size: 22px; }
  .btn-draw-lg   { width: 100%; justify-content: center; }
}

@media (max-width: 480px) {
  .stat-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
