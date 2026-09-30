# Public Billing API — untuk landing page "Cek Tagihan"

> **⚠️ Status implementasi (terbaru)**: endpoint yang **benar-benar dipakai production** adalah
> server Node/Express self-hosted di `sidrive/landingpage-zknet-frontend`'s `server/` folder
> (jalan di STB Armbian milik ISP, bukan Firebase Cloud Functions — lihat repo itu untuk kode &
> panduan deploy lengkap, `server/README.md`). Kode `functions/` di repo **ini**
> (`zakanet-billing`) adalah versi Cloud Function dari fitur yang sama — ditulis lebih dulu,
> lengkap dan valid, tapi **tidak di-deploy** (Cloud Functions generasi ini wajib plan Firebase
> Blaze, sementara server self-hosted tidak). Disimpan di sini sebagai referensi/fallback kalau
> suatu saat mau pindah balik ke Cloud Functions — jangan bingung kalau ada dua implementasi:
> keduanya **logic-nya identik** (server/ di repo landing page adalah port apa adanya dari
> `functions/` di repo ini), yang beda hanya tempat jalannya.
>
> Kontrak API, rate limiting, dan aturan "field apa yang boleh/tidak boleh direspons" di bawah ini
> **berlaku sama** untuk kedua implementasi — dokumen ini tetap jadi sumber kebenaran kontraknya.

Fitur ini adalah satu-satunya jalur baca publik ke data billing. Ditulis supaya landing page
(`sidrive/landingpage-zknet-frontend`) bisa mengecek status tagihan pelanggan **tanpa** pernah
diberi akses langsung ke Firestore — `firestore.rules` tetap seperti semula (hanya
`isApproved()` admin yang bisa baca `customers`/`invoices` langsung). Baik versi Cloud Function
maupun versi self-hosted sama-sama jalan dengan Firebase Admin SDK, yang selalu bypass Security
Rules by design, jadi tidak perlu mengubah `firestore.rules` sama sekali untuk fitur ini.

## Cara isi `password_hash` pelanggan

**Setiap dokumen `customers/{id}` butuh field `password_hash` (string, bcrypt hash)** supaya
pelanggan itu bisa cek tagihan mandiri lewat fitur ini.

- **Cara resmi (dipakai sekarang)**: isi lewat field **"Password Cek Tagihan"** di form Edit
  Pelanggan pada aplikasi admin ini (`src/views/Customers.vue`) — wajib diisi untuk pelanggan
  baru, dan otomatis diminta saat admin membuka form edit pelanggan lama yang belum punya
  password. Hash bcrypt-nya dibuat otomatis oleh app (`src/services/customerService.js`),
  admin tidak perlu urus hash secara manual.
- **Cara manual (fallback)**: `scripts/hash-password.js` masih ada dan tetap valid kalau suatu
  saat perlu isi/reset password langsung lewat Firestore Console tanpa lewat UI:
  ```bash
  cd scripts && npm install   # sekali saja
  node hash-password.js "kata sandi pelanggan"
  ```
  Lalu paste output-nya (string panjang berawalan `$2...`) ke field `password_hash` pelanggan
  yang bersangkutan di Firestore Console.
- Pelanggan yang belum punya `password_hash` akan selalu gagal verifikasi (endpoint
  memperlakukannya seperti kredensial salah, bukan error — supaya tidak membocorkan siapa saja
  yang sudah/belum di-setup).

## Kontrak API

```
POST <VITE_BILLING_API_URL>   # mis. https://check-tagihan-api.zknet.my.id/check-billing
Content-Type: application/json

{ "name": "Budi Santoso", "password": "..." }
```

(URL di atas dikonfigurasi di sisi landing page lewat env var `VITE_BILLING_API_URL` — lihat
`sidrive/landingpage-zknet-frontend`'s README. Path/nama endpoint boleh beda antara versi
self-hosted [`/check-billing`] dan versi Cloud Function [`/checkBilling`]; yang penting body
request & response-nya ikuti kontrak di bawah ini.)

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

Ada di `lib/cors.js` (baik versi `functions/` di sini maupun versi `server/` di repo landing
page — isinya sama). Berisi daftar origin yang diizinkan. **Update `ALLOWED_ORIGINS` dengan
domain produksi landing page yang sebenarnya sebelum/saat deploy** — saat ini masih placeholder
(`https://zakainternet.id`) + port dev lokal Vite.

## Deploy

**Yang benar-benar dipakai sekarang**: self-hosted di STB Armbian milik ISP. Lihat
`sidrive/landingpage-zknet-frontend`'s `server/README.md` untuk langkah lengkap (generate
service account key, systemd, reverse proxy HTTPS, sambungkan `VITE_BILLING_API_URL`).

**Alternatif (kalau suatu saat mau pindah ke Cloud Functions)** — kode di `functions/` folder ini
sudah siap deploy, tinggal (butuh project Firebase di plan Blaze):

```bash
npm install --prefix functions
firebase login
firebase deploy --only functions
```

Setelah deploy, catat URL function yang tercetak (formatnya
`https://asia-southeast1-zakanet-billing.cloudfunctions.net/checkBilling`) dan set sebagai
`VITE_BILLING_API_URL` di environment landing page. Kalau pindah ke opsi ini, matikan server
self-hosted-nya — jangan jalankan dua-duanya sekaligus sebagai sumber kebenaran.
