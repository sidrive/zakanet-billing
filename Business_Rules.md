# BUSINESS RULES — ISP BILLING

## 1. Penagihan Customer Baru
Jika customer memiliki join_date:

- Tidak ditagih di bulan join
- Tidak ditagih di bulan berikutnya
- Mulai ditagih bulan ke-2 setelah join

Contoh:
Join Januari → Tagihan mulai Maret

---

## 2. Customer Lama
Jika tidak memiliki join_date:
→ langsung ikut penagihan bulanan

---

## 3. Customer Nonaktif
Jika is_active = false:
- Tidak dibuatkan invoice baru
- Data lama tetap ada

---

## 4. Invoice Rules
- 1 customer hanya boleh punya 1 invoice per bulan
- Tidak boleh duplicate
- Format month: YYYY-MM

---

## 5. Auto Subscribe (Saldo)
Jika:
balance >= tagihan

Maka:
- invoice otomatis PAID
- balance dikurangi
- auto_subscribed = true

---

## 6. Partial Payment
Jika:
pembayaran < tagihan

Maka:
- status = partial
- sisa menjadi hutang

---

## 7. Perhitungan Hutang
outstanding = amount - paid_amount

---

## 8. Prioritas Pembayaran
Pembayaran harus:
1. Melunasi hutang bulan paling lama
2. Baru ke bulan berikutnya

(Tidak boleh loncat bulan)

---

## 9. Dashboard Rules

- Total tagihan = akumulasi semua hutang customer
- Status tetap mengikuti invoice bulan berjalan
- Partial tetap ditampilkan sebagai partial

---

## 10. Auto Generate Invoice

Dilakukan:
- saat dashboard dibuka
- atau manual trigger

---

## 11. Auto Subscribe Execution

Dilakukan:
- setelah invoice dibuat
- otomatis tanpa interaksi admin