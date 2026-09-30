# PRD — Modul Pendapatan Lain, Pengeluaran, dan Piutang (Non-Internet)

Status: **Draft siap eksekusi** — ditulis supaya bisa langsung dikerjakan oleh sesi Claude Code
lain tanpa perlu konteks percakapan yang menghasilkan dokumen ini. Semua keputusan cakupan di
bawah sudah dikonfirmasi pemilik produk (lihat "Keputusan yang sudah diambil").

## 1. Latar Belakang & Tujuan

Aplikasi `zakanet-billing` saat ini hanya mencatat satu jenis pendapatan: tagihan langganan
internet pelanggan (`invoices`/`payments`), dan tidak punya pencatatan pengeluaran sama sekali
(Dashboard cuma menaksir `ispCost` sebagai 50% dari total tagihan — `Math.round(totalBillableAmount / 2)`
di `src/composables/useDashboard.js:148`, murni tebakan kasar, bukan data riil).

Pemilik bisnis butuh tiga modul baru untuk mencatat sisi keuangan **di luar** tagihan internet
pelanggan:

1. **Pendapatan Lain** — pemasukan yang bukan dari tagihan langganan internet (mis. jual
   perangkat/router, biaya instalasi, jasa teknisi, dll).
2. **Pengeluaran** — biaya operasional bisnis (gaji, sewa, listrik, maintenance, pembelian
   perangkat, dll).
3. **Piutang (non-internet)** — uang yang masih harus ditagih dari pihak lain, **di luar**
   piutang tagihan internet pelanggan yang sudah ada di sistem (bukan `invoices` yang belum
   lunas — itu konsep terpisah yang sudah ditangani Dashboard/Reports yang ada).

## 2. Keputusan yang Sudah Diambil (jangan tanya ulang ke user untuk hal ini)

Dikonfirmasi lewat `AskUserQuestion` sebelum PRD ini ditulis:

1. **Cakupan Piutang**: piutang di luar tagihan internet — collection baru `receivables`,
   terpisah total dari `invoices`. **Tidak** menyentuh/menggabungkan data piutang tagihan
   internet yang sudah ada.
2. **Integrasi laporan**: ketiga modul ini **berdiri sendiri (standalone)** di fase ini — cuma
   CRUD (tambah/lihat/edit/hapus). **Tidak** ada perubahan ke `Dashboard.vue`, `Reports.vue`,
   atau `useDashboard.js`/`reportService.js` di fase ini. Integrasi jadi Laba Rugi gabungan
   adalah **Fase 2**, di luar scope breakdown tugas di dokumen ini (lihat §7).

## 3. Konteks Sistem Saat Ini (untuk orientasi cepat)

Stack: Vue 3 (`<script setup>`, Composition API) + Vite + Firebase (Firestore client SDK +
Firebase Auth). Tidak ada backend selain Firestore langsung dari klien (kecuali fitur cek-tagihan
publik yang terpisah, lihat `docs/PUBLIC_BILLING_API.md` — tidak relevan untuk PRD ini).

**Pola yang harus diikuti** (konsisten dengan 6 modul yang sudah ada — Dashboard, Produk,
Pelanggan, Pembayaran, Laporan, Promo):

- **Auth & permission**: satu level akses saja (approved/tidak, lihat `firestore.rules` &
  `src/composables/useAuth.js`) — tidak ada role granular. Modul baru **reuse** mekanisme yang
  sama, tidak perlu bikin role baru.
- **Service layer**: satu file per modul di `src/services/`, fungsi murni (`getX`, `addX`,
  `updateX`, `deleteX`) yang langsung panggil Firestore SDK (`collection`, `addDoc`, `getDocs`,
  `updateDoc`, `deleteDoc`, `serverTimestamp`). Contoh acuan: `src/services/customerService.js`,
  `src/services/paymentService.js`.
- **View layer**: satu file per modul di `src/views/` (`<script setup>` di atas, `<template>` di
  tengah, `<style scoped>` di bawah — semua styling inline di file yang sama, tidak ada file CSS
  terpisah per view). Pola list + toolbar (search/filter) + sheet modal tambah/edit sudah mapan,
  contoh acuan: `src/views/Customers.vue`.
- **Komponen shared** (jangan bikin ulang, import dari `src/components/`):
  `SheetModal.vue` (modal geser dari kanan/bawah untuk form tambah/edit), `SearchInput.vue`,
  `FilterChips.vue`, `StatusBadge.vue` (badge warna untuk status), `Toast.vue` (lewat
  `useToast()` composable di `src/composables/useToast.js`, `showToast(message)`).
- **Routing**: daftar route ada satu tempat, `src/router/index.js` (array `routes`, tiap entry
  `{ path, component, meta: { title } }`). Guard auth (`router.beforeEach`) sudah generik, tidak
  perlu diubah untuk route baru.
- **Navigasi**: menu sidebar (desktop) & bottom-nav (mobile) didefinisikan satu array `navItems`
  di `src/App.vue` (`{ to, icon, label, bnavLabel }`), pakai ikon dari `@phosphor-icons/vue`.
- **Format angka & tanggal**: currency selalu `Number(x).toLocaleString('id-ID')` dengan prefix
  manual `"Rp "` di template (tidak ada helper terpusat, tiap file redefine sendiri — boleh
  ikuti pola ini, boleh juga extract helper baru ke `src/utils/format.ts`/`.js` kalau mau
  merapikan, tapi **jangan wajibkan** refactor file lama untuk pakai helper baru itu — di luar
  scope PRD ini).
- **Desain visual**: token CSS di `src/styles/tokens.css` (variabel `--color-*`, `--radius-*`,
  `--shadow-*`, `--transition-*`) — semua styling baru **wajib** pakai token yang sudah ada,
  jangan hardcode warna/radius baru.
- **Build & deploy**: `npm run build` → commit folder `dist/` ke `main` dengan pesan
  `"release staging: ..."`. Alur kerja: branch `claude/zakanet-billing-analysis-yvwf1m` (restart
  dari `main` terbaru tiap sesi baru) → implementasi → `npm run build` (pastikan sukses) → commit
  → push → buat PR ke `main` → merge → `checkout main` → `pull` → `npm run build` lagi → commit
  `dist/` → push. **Jangan** commit file `.zip`.

**Collection Firestore yang sudah ada** (jangan diubah oleh PRD ini): `customers`, `invoices`,
`payments`, `products`, `promo_settings`, `promo_winners`, `authorized_users`,
`public_login_attempts`.

## 4. Model Data Baru

Tiga collection Firestore baru, independen satu sama lain (tidak ada foreign key wajib antar
modul baru ini di Fase 1).

### 4.1 `expenses` (Pengeluaran)

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `category` | string | ya | Salah satu dari daftar kategori tetap (lihat §5.1) |
| `description` | string | ya | Deskripsi singkat |
| `amount` | number | ya | Nominal (Rupiah, bulat) |
| `date` | Timestamp | ya | Tanggal pengeluaran (bisa beda dari tanggal input) |
| `payment_method` | string | ya | `"Tunai"` \| `"Transfer"` \| `"Lainnya"` |
| `note` | string | tidak | Catatan tambahan opsional |
| `created_by` | string | ya (auto) | Email admin yang input, dari `state.user.email` (`useAuth`) |
| `created_at` | Timestamp (`serverTimestamp()`) | ya (auto) | |
| `updated_at` | Timestamp (`serverTimestamp()`) | ya (auto, saat edit) | |

### 4.2 `revenues` (Pendapatan Lain)

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `category` | string | ya | Salah satu dari daftar kategori tetap (lihat §5.2) |
| `description` | string | ya | Deskripsi singkat |
| `amount` | number | ya | Nominal (Rupiah, bulat) |
| `date` | Timestamp | ya | Tanggal transaksi |
| `payer_name` | string | tidak | Nama pembeli/pihak yang bayar — teks bebas, **bukan** relasi ke `customers` |
| `payment_method` | string | ya | `"Tunai"` \| `"Transfer"` \| `"Lainnya"` |
| `note` | string | tidak | Catatan tambahan opsional |
| `created_by` | string | ya (auto) | |
| `created_at` | Timestamp | ya (auto) | |
| `updated_at` | Timestamp | ya (auto, saat edit) | |

Catatan: di Fase 1, `revenues` **selalu dianggap lunas saat dicatat** (tidak ada status
lunas/belum). Kalau sebagian pendapatan belum dibayar tunai (mis. jual barang dicicil), itu
dicatat manual & terpisah sebagai entri di modul Piutang (§4.3) — **tidak ada linking otomatis**
antara `revenues` dan `receivables` di Fase 1 (lihat §7, Fase 2, untuk penggabungan ini).

### 4.3 `receivables` (Piutang non-internet)

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `debtor_name` | string | ya | Nama pihak yang berhutang — teks bebas |
| `description` | string | ya | Keterangan/alasan piutang |
| `amount` | number | ya | Total piutang saat dibuat |
| `paid_amount` | number | ya (auto, default `0`) | Terupdate tiap ada pencatatan pembayaran |
| `due_date` | Timestamp \| `null` | tidak | Jatuh tempo (opsional) |
| `status` | string | ya (auto, computed) | `"unpaid"` (paid_amount `0`) \| `"partial"` (`0 < paid_amount < amount`) \| `"paid"` (`paid_amount >= amount`) — pakai istilah yang **sama persis** dengan `invoices.status` yang sudah ada, supaya bisa langsung pakai `StatusBadge` tanpa varian baru (lihat catatan di Tiket 8) |
| `note` | string | tidak | |
| `created_by` | string | ya (auto) | |
| `created_at` | Timestamp | ya (auto) | |
| `updated_at` | Timestamp | ya (auto, tiap ada perubahan `paid_amount`) | |

Pencatatan pelunasan (cicilan) di Fase 1 **cukup update field `paid_amount` & `status`** pada
dokumen yang sama — **tidak perlu** sub-collection riwayat transaksi terpisah (itu Fase 2 kalau
memang dibutuhkan nanti, mirip pola `payments` untuk `invoices`).

## 5. Kategori (Fase 1: daftar tetap, bukan CRUD)

Supaya scope Fase 1 tetap kecil, kategori **hardcode sebagai array konstanta** di masing-masing
service/view (pola sama seperti `filterOptions` di `Customers.vue`) — **bukan** collection
Firestore baru dengan CRUD kategori sendiri. Menjadikan kategori bisa-diedit-user adalah
kandidat Fase 2 kalau memang dibutuhkan (lihat §7).

### 5.1 Kategori Pengeluaran (`expenses.category`)
`"Operasional"`, `"Gaji"`, `"Sewa Tempat"`, `"Listrik & Internet"`, `"Perawatan Perangkat"`,
`"Pembelian Perangkat"`, `"Lainnya"`

### 5.2 Kategori Pendapatan Lain (`revenues.category`)
`"Penjualan Perangkat"`, `"Biaya Instalasi"`, `"Jasa Teknisi"`, `"Lainnya"`

(Daftar di atas adalah usulan awal masuk akal untuk ISP kecil — **boleh dikonfirmasi ulang ke
pemilik produk saat mengerjakan tiket terkait**, kalau ternyata daftarnya perlu disesuaikan,
karena ini bukan bagian dari keputusan yang sudah dikonfirmasi di §2.)

## 6. Firestore Security Rules

Tambahkan 3 baris ke `firestore.rules`, pola identik dengan collection yang sudah ada (pakai
fungsi `isApproved()` yang sudah ada, jangan bikin fungsi baru):

```
match /expenses/{id}     { allow read, write: if isApproved(); }
match /revenues/{id}     { allow read, write: if isApproved(); }
match /receivables/{id}  { allow read, write: if isApproved(); }
```

Ini perlu di-deploy manual oleh admin (`firebase deploy --only firestore:rules` atau paste ke
Firebase Console → Firestore → Rules), persis seperti alur setup auth sebelumnya — **flag ini ke
user di akhir tiket terkait**, jangan asumsikan otomatis aktif.

## 7. Fase 2 (di luar scope breakdown tiket §8 — dicatat supaya tidak terlupa, jangan dikerjakan sekarang kecuali diminta eksplisit)

- Linking otomatis: opsi "belum lunas sepenuhnya" di form Pendapatan Lain yang auto-membuat
  entri di `receivables`.
- Riwayat cicilan piutang sebagai sub-collection/collection terpisah (`receivable_payments`),
  bukan cuma update `paid_amount` di tempat.
- Upload bukti struk/nota (perlu Firebase Storage — **belum pernah dipakai di app ini**,
  `getStorage` tidak ada di `src/firebase/index.js` saat ini, jadi ini nambah dependency infra
  baru, bukan sekadar field baru).
- Laporan Laba Rugi gabungan: `Pendapatan Internet (invoices) + Pendapatan Lain (revenues) −
  Pengeluaran (expenses)`, ditampilkan di `Dashboard.vue`/`Reports.vue`. Termasuk mengganti
  `ispCost` yang sekarang cuma tebakan 50% di `useDashboard.js:148` dengan data riil dari
  `expenses`.
- Kategori jadi collection ter-manage (CRUD kategori sendiri), bukan array hardcode.
- Aging report piutang (0-30/31-60/60+ hari).

## 8. Breakdown Tiket (Fase 1 — siap dikerjakan)

Setiap tiket ditulis mandiri (bisa dikerjakan sesi Claude Code terpisah tanpa baca tiket lain
secara detail, cukup baca §1-§6 di atas untuk konteks). Urutan disusun supaya **3 modul bisa
dikerjakan paralel** di sesi berbeda — tidak ada dependency lintas-modul di Fase 1, hanya
dependency di dalam modul yang sama (data layer → UI → rules bisa digabung jadi satu PR per
modul, atau dipecah sesuai preferensi sesi yang mengerjakan).

---

### Tiket 1 — Modul Pengeluaran: data layer

**Tujuan**: fungsi CRUD Firestore untuk collection `expenses`.

**File baru**: `src/services/expenseService.js`

**Fungsi yang harus ada**:
- `getExpenses()` — ambil semua, `orderBy("date", "desc")`.
- `addExpense(data)` — `{ category, description, amount, date, payment_method, note }` →
  tambahkan `created_by` (dari `useAuth().state.user.email`), `created_at`/`updated_at`
  (`serverTimestamp()`), simpan `amount: Number(data.amount)`, `date` di-convert ke
  `Timestamp.fromDate(new Date(data.date))`.
- `updateExpense(id, data)` — field sama seperti `addExpense` kecuali `created_by`/`created_at`;
  update `updated_at`.
- `deleteExpense(id)` — `deleteDoc`.

**Acceptance criteria**:
- [ ] Semua fungsi async, pola sama seperti `customerService.js` (named export per fungsi, tidak
      ada default export).
- [ ] `amount` selalu disimpan sebagai `number`, bukan string.
- [ ] Tidak ada field lain selain yang didefinisikan di §4.1 yang tertulis ke Firestore.

---

### Tiket 2 — Modul Pengeluaran: UI

**Dependency**: Tiket 1 selesai (butuh `expenseService.js`).

**File baru**: `src/views/Expenses.vue`
**File diubah**: `src/router/index.js` (tambah route), `src/App.vue` (tambah ke `navItems`)

**Kebutuhan UI** (ikuti pola `Customers.vue` — toolbar + grid card + sheet tambah/edit):
- Toolbar: `SearchInput` (cari by `description`), `FilterChips` untuk filter kategori (opsi:
  "Semua" + semua kategori §5.1), tombol "Tambah" buka `SheetModal`.
- Daftar: card per pengeluaran menampilkan kategori, deskripsi, tanggal (format `d MMMM yyyy` ala
  Indonesia, pola sama seperti `MONTHS_FULL_ID` di `Customers.vue`), nominal (`Rp
  {{amount.toLocaleString('id-ID')}}`), metode pembayaran. Klik card → buka sheet edit.
- Sheet tambah/edit: field kategori (`<select>`), deskripsi (`<textarea>` atau `<input>`),
  nominal (`<input type="number">`), tanggal (`<input type="date">`), metode pembayaran
  (`<select>` atau toggle group ala `status-toggle-group` di `Customers.vue`), catatan (opsional,
  `<textarea>`).
- Validasi wajib: kategori, deskripsi, nominal (`> 0`), tanggal. Tampilkan `alert(...)` untuk
  validasi gagal (pola sama seperti file lain — **jangan** ganti ke library validasi baru).
- Tombol hapus per item (di sheet edit atau card, ikuti judgement implementer, konsisten dengan
  pola yang ada — catatan: modul lain di app ini **belum ada** tombol hapus eksplisit di
  `Customers.vue`, jadi ini keputusan baru; taruh di sheet edit dengan konfirmasi
  `confirm(...)` sebelum `deleteExpense`).
- Toast sukses (`showToast(...)`) setelah tambah/edit/hapus, pola sama seperti file lain.
- Route: `{ path: "/expenses", component: Expenses, meta: { title: "Pengeluaran" } }`.
- Nav item: label `"Pengeluaran"`, `bnavLabel: "Belanja"` (atau serupa, singkat untuk mobile),
  ikon `PhTrendDown` dari `@phosphor-icons/vue` (**cek nama ikon yang benar-benar ter-export**
  dari paket versi yang terpasang sebelum commit — kalau nama beda, pilih ikon terdekat yang
  tersedia, mis. `PhReceipt`).

**Acceptance criteria**:
- [ ] `npm run build` sukses tanpa error.
- [ ] Halaman bisa diakses lewat sidebar (desktop) & bottom-nav (mobile), muncul di kedua tempat.
- [ ] Verifikasi visual (screenshot Playwright dengan data mock, ikuti pola verifikasi yang
      sudah dipakai di riwayat commit sebelumnya — mock `getExpenses`, jangan commit kode mock).
- [ ] Tambah, edit, hapus pengeluaran bekerja end-to-end melawan Firestore project yang benar
      (`zakanet-billing`) — verifikasi manual atau screenshot state loading/kosong/terisi.

---

### Tiket 3 — Modul Pengeluaran: security rules

**Dependency**: tidak ada (bisa dikerjakan kapan saja, tapi wajib sebelum Tiket 2 dipakai di
production sungguhan — kalau rules belum di-deploy, `read`/`write` ke `expenses` akan ditolak
Firestore).

**File diubah**: `firestore.rules` (root repo) — tambah baris dari §6.

**Acceptance criteria**:
- [ ] Baris `match /expenses/{id} { allow read, write: if isApproved(); }` ditambahkan tepat di
      bawah baris `match /products/{id}` yang sudah ada (menjaga urutan/pengelompokan yang
      konsisten dengan collection lain).
- [ ] Di akhir tiket, **beri tahu user eksplisit** bahwa rules baru ini perlu di-deploy manual
      (`firebase deploy --only firestore:rules` atau paste ke Firebase Console) — jangan
      asumsikan otomatis aktif setelah di-commit ke repo.

---

### Tiket 4 — Modul Pendapatan Lain: data layer

**Tujuan**: fungsi CRUD Firestore untuk collection `revenues`.

**File baru**: `src/services/revenueService.js`

Struktur identik Tiket 1, disesuaikan field §4.2 (`payer_name` opsional, boleh `""` kalau
kosong — jangan kirim `undefined` ke Firestore, itu akan error; kalau field opsional kosong,
kirim string kosong `""` atau `null`, konsisten, pilih salah satu dan pertahankan di seluruh
modul).

**Fungsi**: `getRevenues()`, `addRevenue(data)`, `updateRevenue(id, data)`, `deleteRevenue(id)`.

**Acceptance criteria**: sama seperti Tiket 1, field disesuaikan §4.2.

---

### Tiket 5 — Modul Pendapatan Lain: UI

**Dependency**: Tiket 4 selesai.

**File baru**: `src/views/Revenues.vue`
**File diubah**: `src/router/index.js`, `src/App.vue`

Struktur & requirement identik Tiket 2, disesuaikan:
- Field kategori dari §5.2, field tambahan `payer_name` (label "Nama Pembeli/Pelanggan
  (opsional)").
- Route: `{ path: "/revenues", component: Revenues, meta: { title: "Pendapatan Lain" } }`.
- Nav item: label `"Pendapatan Lain"`, `bnavLabel: "Pendapatan"`, ikon `PhTrendUp` (cek
  ketersediaan nama ikon yang sama seperti catatan di Tiket 2).

**Acceptance criteria**: sama seperti Tiket 2, disesuaikan modul ini.

---

### Tiket 6 — Modul Pendapatan Lain: security rules

**Dependency**: tidak ada (independen, sama seperti Tiket 3).

**File diubah**: `firestore.rules` — tambah baris `match /revenues/{id} { allow read, write: if isApproved(); }`.

**Acceptance criteria**: sama seperti Tiket 3, disesuaikan collection ini. (Kalau dikerjakan di
sesi yang sama dengan Tiket 3/9, gabungkan jadi satu perubahan `firestore.rules` sekali jalan,
tidak perlu 3 PR terpisah hanya untuk rules.)

---

### Tiket 7 — Modul Piutang (non-internet): data layer

**Tujuan**: fungsi CRUD + pencatatan pembayaran cicilan untuk collection `receivables`.

**File baru**: `src/services/receivableService.js`

**Fungsi yang harus ada**:
- `getReceivables()` — ambil semua, `orderBy("created_at", "desc")`.
- `addReceivable(data)` — `{ debtor_name, description, amount, due_date, note }` → tambahkan
  `paid_amount: 0`, `status: "unpaid"`, `created_by`, `created_at`/`updated_at`.
- `updateReceivable(id, data)` — update field dasar (`debtor_name`, `description`, `amount`,
  `due_date`, `note`) **tanpa** menyentuh `paid_amount`/`status` (itu lewat fungsi terpisah di
  bawah) — kalau `amount` berubah, **hitung ulang `status`** berdasarkan `paid_amount` yang ada
  sekarang (jangan biarkan `status` nyasar kalau admin mengubah total piutang setelah sebagian
  sudah dibayar).
- `recordPayment(id, paymentAmount)` — ambil dokumen, `newPaidAmount = paid_amount +
  paymentAmount` (clamp maksimal `amount`, jangan sampai lebih), hitung `status` baru
  (`"paid"` kalau `newPaidAmount >= amount`, `"partial"` kalau `0 < newPaidAmount < amount`,
  `"unpaid"` kalau `newPaidAmount === 0`), `updateDoc` dengan `paid_amount`, `status`,
  `updated_at`.
- `deleteReceivable(id)` — `deleteDoc`.

**Acceptance criteria**:
- [ ] `recordPayment` tidak boleh membuat `paid_amount` melebihi `amount` (clamp, jangan biarkan
      nilai negatif di sisa piutang).
- [ ] `status` selalu konsisten dengan `paid_amount` vs `amount` setiap kali salah satu berubah.
- [ ] Field sama seperti §4.3, tidak ada field ekstra.

---

### Tiket 8 — Modul Piutang (non-internet): UI

**Dependency**: Tiket 7 selesai.

**File baru**: `src/views/Receivables.vue`
**File diubah**: `src/router/index.js`, `src/App.vue`

**Kebutuhan UI** (pola sama seperti Tiket 2, dengan tambahan alur pencatatan pembayaran):
- Toolbar: `SearchInput` (cari by `debtor_name`), `FilterChips` filter status — opsi
  `{ key: "all", label: "Semua" }`, `{ key: "unpaid", label: "Belum Lunas" }`,
  `{ key: "partial", label: "Sebagian" }`, `{ key: "paid", label: "Lunas" }` (`key` cocok
  langsung dengan `status` §4.3, pola sama seperti `filterOptions` di `Customers.vue`), tombol
  "Tambah".
- Daftar: card per piutang — nama debitur, deskripsi, `StatusBadge` untuk status. `status`
  di §4.3 sengaja memakai istilah `"paid"`/`"partial"`/`"unpaid"` yang **sama persis** dengan
  yang sudah didukung `StatusBadge.vue` (`:variant="status"` langsung, tidak perlu varian baru,
  tidak perlu mapping manual — cukup pastikan `label` custom kalau teks default `"Lunas"`/
  `"Partial"`/`"Belum Bayar"` sudah pas untuk konteks piutang, kemungkinan besar sudah pas apa
  adanya), total piutang, sisa (`amount - paid_amount`), jatuh tempo kalau ada.
- Sheet tambah: field debitur, deskripsi, nominal, jatuh tempo (opsional), catatan.
- Sheet edit: field yang sama untuk edit data dasar, **plus** bagian terpisah "Catat Pembayaran"
  — input nominal cicilan + tombol "Catat" yang memanggil `recordPayment`. Tampilkan riwayat
  sisa/terbayar secara live setelah submit (refresh data). Kalau `status === "lunas"`,
  sembunyikan/nonaktifkan form catat pembayaran (tidak ada lagi yang perlu dicatat).
- Route: `{ path: "/receivables", component: Receivables, meta: { title: "Piutang" } }`.
- Nav item: label `"Piutang"`, `bnavLabel: "Piutang"`, ikon `PhHandCoins` (cek ketersediaan,
  sama seperti catatan di Tiket 2).

**Acceptance criteria**: sama seperti Tiket 2, ditambah:
- [ ] Pencatatan pembayaran cicilan bekerja & `status`/sisa piutang ter-update di UI tanpa perlu
      reload manual (panggil ulang `getReceivables()` setelah `recordPayment` sukses, pola sama
      seperti `loadCustomers()` dipanggil ulang setelah `submitEdit()` di `Customers.vue`).
- [ ] Validasi: nominal cicilan harus `> 0` dan tidak boleh melebihi sisa piutang saat ini
      (validasi di UI **dan** di service layer — jangan andalkan salah satu saja).

---

### Tiket 9 — Modul Piutang (non-internet): security rules

**Dependency**: tidak ada.

**File diubah**: `firestore.rules` — tambah baris `match /receivables/{id} { allow read, write: if isApproved(); }`.

**Acceptance criteria**: sama seperti Tiket 3, disesuaikan collection ini.

---

## 9. Urutan Pengerjaan yang Disarankan

Tidak ada dependency lintas-modul, jadi urutan bebas. Kalau dikerjakan satu sesi per giliran
(bukan paralel), urutan tersarankan berdasarkan kompleksitas naik:

1. **Pengeluaran** (Tiket 1-3) — paling sederhana, bagus untuk memvalidasi pola sebelum lanjut
   ke modul lain.
2. **Pendapatan Lain** (Tiket 4-6) — hampir identik strukturnya dengan Pengeluaran.
3. **Piutang** (Tiket 7-9) — paling kompleks (ada sub-alur pencatatan pembayaran cicilan +
   status computed).

Tiap modul: gabungkan data layer + UI + rules jadi satu PR (`claude/zakanet-billing-analysis-yvwf1m`
→ merge → build → commit `dist/`), sama seperti alur kerja fitur-fitur sebelumnya di repo ini —
**tidak perlu** menunggu ketiga modul selesai sebelum merge yang pertama.

## 10. Hal yang Perlu Dikonfirmasi Ulang Saat Eksekusi (bukan blocker, tapi dicatat)

- Daftar kategori final (§5) — usulan awal, boleh disesuaikan bersama pemilik produk saat
  Tiket 1/4 dikerjakan.
- Perlu tidaknya tombol hapus di modul-modul lain yang sudah ada (`Customers.vue` belum punya) —
  PRD ini menambahkan tombol hapus khusus untuk 3 modul baru, tidak retroaktif ke modul lama.
- Nama ikon Phosphor yang dipakai (`PhTrendUp`, `PhTrendDown`, `PhHandCoins`) — verifikasi
  ketersediaannya di versi `@phosphor-icons/vue` yang terpasang (`^2.2.1` per `package.json` saat
  PRD ini ditulis) sebelum commit, ganti ke ikon terdekat kalau tidak tersedia.
