# Public Billing API — untuk landing page "Cek Tagihan"

Cloud Function `checkBilling` (di `functions/index.js`) adalah satu-satunya jalur baca publik ke
data billing. Ditulis supaya landing page (`sidrive/landingpage-zknet-frontend`) bisa mengecek
status tagihan pelanggan **tanpa** pernah diberi akses langsung ke Firestore — `firestore.rules`
tetap seperti semula (hanya `isApproved()` admin yang bisa baca `customers`/`invoices` langsung).
Function ini jalan dengan Admin SDK, yang selalu bypass Security Rules by design, jadi tidak perlu
mengubah `firestore.rules` sama sekali untuk fitur ini.

## ⚠️ Yang harus dikerjakan sebelum fitur ini bisa dipakai

**Tambahkan field `password_hash` (string) ke setiap dokumen `customers/{id}`** yang perlu bisa
cek tagihan mandiri. Field ini **tidak** ada di skema saat ini — ditambahkan khusus untuk fitur
publik ini.

- Pelanggan yang belum punya `password_hash` akan selalu gagal verifikasi (function
  memperlakukannya seperti kredensial salah, bukan error — supaya tidak membocorkan siapa saja
  yang sudah/belum di-setup).
- **Jangan pernah simpan password plaintext** — field ini harus selalu berisi hash bcrypt.

### Cara mengisi — banyak pelanggan sekaligus (`scripts/generate-passwords.js`)

Untuk mengisi seluruh basis pelanggan yang sudah ada sekaligus, tanpa isi manual satu-satu:

```bash
cd scripts && npm install   # sekali saja

# Preview dulu — tidak menulis apa pun, hanya menghitung berapa pelanggan yang eligible:
node generate-passwords.js --service-account=/path/to/serviceAccountKey.json --dry-run

# Eksekusi:
node generate-passwords.js --service-account=/path/to/serviceAccountKey.json
```

- Ambil `serviceAccountKey.json` dari Firebase Console → Project Settings → Service Accounts →
  Generate new private key. **Jangan pernah commit file ini** (sudah di-gitignore lewat pola
  `*serviceAccount*.json`, tapi tetap hati-hati).
- **Idempotent** — hanya menyentuh pelanggan yang belum punya `password_hash`. Aman dijalankan
  ulang; tidak akan menimpa password yang sudah pernah di-set (baik lewat script ini maupun lewat
  `hash-password.js` manual).
- Password digenerate acak (8 karakter, huruf+angka, karakter ambigu seperti `0/O/1/l/I` sengaja
  dihindari), lalu di-hash sebelum ditulis ke Firestore.
- Karena bcrypt tidak bisa dibalik, plaintext-nya **hanya ada sekali** — tersimpan di
  `scripts/output/passwords-<timestamp>.csv` (git-ignored). **Segera distribusikan satu-per-satu
  ke tiap pelanggan (mis. lewat WhatsApp) lalu hapus file itu.** Jangan bagikan CSV-nya sekaligus
  ke siapa pun di luar admin.

### Cara mengisi — satu pelanggan (`scripts/hash-password.js`)

Untuk pelanggan baru atau reset password satu-satu (misalnya pelanggan lupa password):

```bash
cd scripts && npm install   # sekali saja (kalau belum)
node hash-password.js "kata sandi pelanggan"
```

Lalu paste output-nya (string panjang berawalan `$2...`) ke field `password_hash` pelanggan yang
bersangkutan di Firestore Console.

### Ke depan

Pertimbangkan menambahkan alur "atur/reset kata sandi" langsung di aplikasi admin ini (generate
password acak untuk pelanggan baru saat didaftarkan, kirim via WhatsApp otomatis) — di luar scope
perubahan ini, tapi kedua script di atas bisa jadi referensi logikanya.

## Kontrak API

```
POST https://asia-southeast1-zakanet-billing.cloudfunctions.net/checkBilling
Content-Type: application/json

{ "name": "Budi Santoso", "password": "..." }
```

Respons sukses (200):
```jsonc
// Lunas
{ "success": true, "status": "lunas", "lastPaidMonth": "2026-07", "lastPaidDate": "2026-07-03T..." }

// Belum lunas (satu entri per bulan yang masih ada sisa)
{
  "success": true,
  "status": "belum-lunas",
  "unpaidMonths": [
    { "month": "2026-06", "due": 165000, "paid": 0, "remaining": 165000 },
    { "month": "2026-07", "due": 165000, "paid": 65000, "remaining": 100000 }
  ]
}

// Belum pernah ada invoice tercatat
{ "success": true, "status": "tidak-ada-tagihan" }
```

Respons gagal:
| Status | Kapan | Body |
|---|---|---|
| 400 | `name`/`password` kosong atau bukan string | `{ success: false, message: "Nama dan kata sandi wajib diisi." }` |
| 401 | Nama tidak ditemukan, atau password salah, atau belum punya `password_hash` | `{ success: false, message: "Nama atau kata sandi salah. ..." }` |
| 429 | Lebih dari 5 percobaan gagal dalam 15 menit dari IP yang sama | `{ success: false, message: "Terlalu banyak percobaan. ..." }` |
| 405 | Method selain POST/OPTIONS | `{ success: false, message: "Method not allowed." }` |

**Sengaja tidak pernah mengembalikan**: `balance`, `address`, `phone`, `product_id`,
`password_hash`, atau Firestore document ID — hanya status tagihan yang perlu ditampilkan ke
publik. Jangan tambah field ke response tanpa mempertimbangkan ulang apakah itu aman untuk
diketahui publik.

## Rate limiting

`functions/lib/rateLimit.js` — fixed window 15 menit, maksimal 5 percobaan gagal per IP, disimpan
di koleksi `public_login_attempts`. Ini mitigasi dasar terhadap brute force, bukan pengganti
Firebase App Check — pertimbangkan menambah App Check kalau lalu lintas publik ke endpoint ini
signifikan.

## CORS

`functions/lib/cors.js` berisi daftar origin yang diizinkan. **Update `ALLOWED_ORIGINS` dengan
domain produksi landing page yang sebenarnya sebelum/saat deploy** — saat ini masih placeholder
(`https://zakainternet.id`) + port dev lokal Vite.

## Deploy

Dijalankan manual oleh admin yang punya akses ke project Firebase `zakanet-billing` (di luar
mandat sesi yang membuat perubahan ini):

```bash
npm install --prefix functions
firebase login
firebase deploy --only functions
```

Setelah deploy, catat URL function yang tercetak (`https://asia-southeast1-zakanet-billing.cloudfunctions.net/checkBilling`)
dan set sebagai `VITE_BILLING_API_URL` di environment landing page.
