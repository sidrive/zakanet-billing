import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, setDoc,
  query, where, Timestamp
} from "firebase/firestore"
import { db } from "../firebase"

const PROMO_DISCOUNT_PCT = 50  // 50% dari tagihan per pemenang
const SETTINGS_REF       = doc(db, "promo_settings", "config")

// Riwayat pemenang awal — dimasukkan satu kali secara otomatis
const SEED_HISTORY = [
  { month: "2026-01", winners: ["Pak Joko RT 7", "Mbak Yuni"] },
  { month: "2026-02", winners: ["Ria Pak Sapto", "Pak Sugeng"] },
  { month: "2026-03", winners: ["Mas Dwi", "Sahid"] },
  { month: "2026-04", winners: ["Alfa", "Pak Wagiya"] },
  { month: "2026-05", winners: ["Rafa", "Pak Jam"] }
]

// ── Settings ───────────────────────────────────────────────

export async function getPromoSettings() {
  const snap = await getDoc(SETTINGS_REF)
  if (snap.exists()) return { id: snap.id, ...snap.data() }

  const initial = {
    auto_draw_enabled: true,
    last_draw_month: "",
    current_batch: 1,
    discount_percent: PROMO_DISCOUNT_PCT,
    seeded: false
  }
  await setDoc(SETTINGS_REF, initial)
  return initial
}

export async function updatePromoSettings(data) {
  await updateDoc(SETTINGS_REF, data)
}

export async function toggleAutoDraw(enabled) {
  await updateDoc(SETTINGS_REF, { auto_draw_enabled: enabled })
}

// ── Seed riwayat awal (idempoten — hanya berjalan sekali) ───

export async function seedPromoHistory() {
  const settings = await getPromoSettings()
  if (settings.seeded) return false

  for (const { month, winners } of SEED_HISTORY) {
    for (const name of winners) {
      await addDoc(collection(db, "promo_winners"), {
        customer_id: null,
        customer_name: name,
        month,
        batch: 0,            // batch 0 = data historis
        discount_percent: PROMO_DISCOUNT_PCT,
        discount_amount: 0,  // tidak diketahui untuk data historis
        invoice_updated: false,
        seeded: true,
        created_at: Timestamp.fromDate(new Date(`${month}-15T00:00:00`))
      })
    }
  }

  // Tandai last_draw_month ke bulan terakhir seed agar auto-draw
  // tidak mencoba mengundi ulang bulan-bulan yang sudah ada datanya
  const latestSeeded = SEED_HISTORY[SEED_HISTORY.length - 1].month
  await updatePromoSettings({ seeded: true, last_draw_month: latestSeeded })
  return true
}

// ── Internal: daftar pelanggan eligible ────────────────────
// Kriteria: Aktif, join >= 4 bulan lalu, bebas tunggakan,
//           belum menang di batch berjalan

async function getEligibleCustomers(month, batch) {
  const [year, mo] = month.split("-").map(Number)
  // Tanggal potong: bulan pertama setelah "4 bulan lalu" (mo-4 = Feb untuk May → Jan masih masuk)
  const cutoff = new Date(year, mo - 4, 1)

  // Batch 1 = siklus pertama nyata. Pemenang batch 0 (seed historis Jan–Mei)
  // baru saja menang → ikut dieksklusi. Batch 2+ hanya cek batch berjalan
  // agar pemenang lama bisa ikut rotasi kembali.
  const batchFilter = batch <= 1 ? [0, 1] : [batch]

  const [custSnap, debtSnap, wonSnap] = await Promise.all([
    getDocs(query(collection(db, "customers"), where("is_active", "==", true))),
    getDocs(query(collection(db, "invoices"), where("status", "in", ["unpaid", "partial"]))),
    getDocs(query(collection(db, "promo_winners"), where("batch", "in", batchFilter)))
  ])

  // Tunggakan = invoice BULAN LALU yang belum lunas.
  // Invoice bulan berjalan bukan tunggakan (tagihan baru terbit).
  const hasDebt  = new Set(
    debtSnap.docs
      .filter(d => d.data().month < month)
      .map(d => d.data().customer_id)
  )
  const wonBatch = new Set(wonSnap.docs.map(d => d.data().customer_id).filter(Boolean))

  return custSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => {
      // Jika ada join_date: harus sudah bergabung >= 4 bulan lalu
      if (c.join_date) {
        const jd = c.join_date.toDate ? c.join_date.toDate() : new Date(c.join_date)
        if (jd >= cutoff) return false
      }
      // Tidak boleh punya tunggakan bulan-bulan sebelumnya
      if (hasDebt.has(c.id)) return false
      // Belum menang di batch berjalan
      if (wonBatch.has(c.id)) return false
      return true
    })
}

// ── Draw Winners ───────────────────────────────────────────

export async function drawWinners(month) {
  const settings = await getPromoSettings()
  let { current_batch } = settings
  const discountPercent = settings.discount_percent || PROMO_DISCOUNT_PCT

  let eligible = await getEligibleCustomers(month, current_batch)

  // Jika semua sudah menang di batch ini → naikkan batch, reset antrian
  if (eligible.length === 0) {
    current_batch += 1
    await updatePromoSettings({ current_batch })
    eligible = await getEligibleCustomers(month, current_batch)
  }

  // Masih kosong (misal: semua pelanggan punya tunggakan)
  if (eligible.length === 0) {
    await updatePromoSettings({ last_draw_month: month })
    return []
  }

  // Acak dan ambil 2 pemenang
  const shuffled = [...eligible].sort(() => Math.random() - 0.5)
  const winners  = shuffled.slice(0, Math.min(2, shuffled.length))
  const saved    = []

  for (const w of winners) {
    const ref = await addDoc(collection(db, "promo_winners"), {
      customer_id:      w.id,
      customer_name:    w.name,
      month,
      batch:            current_batch,
      discount_percent: discountPercent,
      discount_amount:  0,  // diperbarui setelah invoice dihitung
      invoice_updated:  false,
      seeded:           false,
      created_at:       Timestamp.now()
    })
    const actualDiscount = await applyPromoDiscount(ref.id, w.id, month, discountPercent)
    saved.push({ id: ref.id, ...w, discount_percent: discountPercent, discount_amount: actualDiscount })
  }

  await updatePromoSettings({ last_draw_month: month })
  return saved
}

// ── Terapkan diskon ke invoice bulan berjalan ──────────────

async function applyPromoDiscount(winnerId, customerId, month, discountPercent) {
  const snap = await getDocs(query(
    collection(db, "invoices"),
    where("customer_id", "==", customerId),
    where("month",       "==", month)
  ))
  if (snap.empty) return 0

  const invDoc        = snap.docs[0]
  const inv           = invDoc.data()
  const invoiceAmount = Number(inv.amount) || 0
  const actualDiscount = Math.round(invoiceAmount * discountPercent / 100)
  const newPaid       = Math.min(
    (Number(inv.paid_amount) || 0) + actualDiscount,
    invoiceAmount
  )
  const newStatus = newPaid >= invoiceAmount
    ? "paid"
    : newPaid > 0 ? "partial" : inv.status

  await updateDoc(doc(db, "invoices", invDoc.id), {
    paid_amount:  newPaid,
    status:       newStatus,
    promo_winner: true,
    ...(newStatus === "paid" && !inv.paid_at ? { paid_at: Timestamp.now() } : {})
  })

  await updateDoc(doc(db, "promo_winners", winnerId), {
    invoice_updated: true,
    discount_amount: actualDiscount
  })

  return actualDiscount
}

// ── Auto-Draw (dipanggil dari Dashboard onMounted) ─────────

export async function checkAndAutoDraw(month) {
  try {
    const settings = await getPromoSettings()
    if (!settings.auto_draw_enabled)       return null
    if (settings.last_draw_month === month) return null
    return await drawWinners(month)
  } catch {
    return null // jangan crash dashboard jika promo gagal
  }
}

// ── Eligible Queue ─────────────────────────────────────────

export async function getEligibleQueue(month) {
  const settings = await getPromoSettings()
  return getEligibleCustomers(month, settings.current_batch)
}

// ── Queries pemenang ───────────────────────────────────────

export async function getWinnersForMonth(month) {
  const snap = await getDocs(query(
    collection(db, "promo_winners"),
    where("month", "==", month)
  ))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0))
}

export async function getAllWinners() {
  const snap = await getDocs(collection(db, "promo_winners"))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const md = b.month?.localeCompare(a.month ?? "") ?? 0
      return md !== 0 ? md : (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0)
    })
}
