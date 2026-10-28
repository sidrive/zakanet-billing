# Plan: Fitur Pelunasan & Penandaan Otomatis Kewajiban ke ISP Pusat pada Dashboard

## Context
Saat ini, Kalkulator Pembayaran ISP di Dashboard baru berfungsi sebagai referensi pembacaan total. Pengguna ingin agar kalkulator ini juga dapat **secara nyata mengeksekusi pelunasan/penandaan lunas** pada item-item yang dicentang setelah tombol "Bayar / Lunasi Terpilih" ditekan, disertai popup konfirmasi.

Komponen yang perlu dilunasi/ditandai:
1. **Bagi Hasil Omzet Bulanan (50% omzet)**: 
   - Perlu dicatat/ditandai sebagai terbayar (misal dicatat sebagai pengeluaran khusus dengan kategori "Bagi Hasil ISP" atau di-track via status pembayaran bulan tersebut, atau dicatat sebagai pengeluaran dengan flag khusus / `is_isp_bill`).
   - *Analisis*: Saat ini pengeluaran operasional (seperti jasa teknisi) menggunakan field `is_isp_bill: true`. Untuk "Bagi Hasil Omzet", kita bisa mencatatnya ke koleksi `expenses` dengan kategori "Bagi Hasil Omzet" atau "Setoran ISP" dan `is_isp_bill: true` (atau flag `is_isp_share: true`), sehingga di bulan berikutnya atau setelah dibayar, item tersebut tidak muncul lagi sebagai kewajiban aktif di dashboard.
2. **Jasa Teknisi & Operasional ISP**: 
   - Item pengeluaran dengan `is_isp_bill: true` yang belum lunas/belum ditandai dibayar. Saat ini pengeluaran langsung masuk ketika dicatat. Agar bisa "ditandai lunas" atau "disetorkan", kita bisa menambahkan field `is_paid` atau `paid_at` pada dokumen `expenses` yang bertipe `is_isp_bill: true`.
3. **Hutang Material / Perangkat (Payables)**: 
   - Sudah memiliki sistem `recordPayablePayment` atau update status lunas. Kita bisa menggunakan fungsi pembayaran payables secara otomatis untuk item yang dicentang.

---

## Langkah Perubahan

### 1. Penyesuaian Model Data & Service
- **Pengeluaran ISP & Bagi Hasil (`expenses`)**:
  - Tambahkan field `is_paid` (boolean) atau gunakan mekanisme pencatatan setoran.
  - Untuk 50% Omzet Share, ketika tombol "Bayar" ditekan, buat dokumen pengeluaran baru bertipe setoran/bagi hasil omzet (atau tandai periode tersebut sudah dibayar).
  - Untuk Jasa Teknisi (`is_isp_bill: true`), tambahkan opsi/field `is_paid` sehingga saat dibayar, `is_paid: true` dan item tersebut tidak muncul lagi di kalkulator kewajiban dashboard.
- **Hutang Material (`payables`)**:
  - Gunakan `recordPayablePayment` untuk melunasi sisa hutang material yang dicentang.

### 2. Penyesuaian Composable `useDashboard.js`
- Modifikasi query `ispExpenseList` agar hanya mengambil pengeluaran ISP (`is_isp_bill: true`) yang **belum dibayar** (`is_paid !== true`).
- Tambahkan status/logic untuk melacak apakah "50% Omzet Share" bulan ini sudah dibayar atau belum (misal dengan mengecek apakah ada pengeluaran dengan kategori/flag bagi hasil omzet di bulan tersebut).

### 3. Penyesuaian UI Dashboard (`src/views/Dashboard.vue`)
- Tambahkan tombol **"Bayar / Lunasi Terpilih (Rp X)"** di bagian bawah modal kalkulator.
- Tambahkan state popup konfirmasi pembayaran.
- Saat dikonfirmasi:
  - Melunasi hutang material terpilih (lewat `recordPayablePayment`).
  - Menandai pengeluaran teknisi terpilih sebagai lunas (`is_paid: true`).
  - Mencatat setoran bagi hasil omzet jika dicentang.
  - Menampilkan toast sukses dan merefresh dashboard.
