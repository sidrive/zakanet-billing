# ARCHITECTURE

## 🖥️ Frontend
- Vue 3
- Vite

---

## 📁 Struktur

src/
- views/
- composables/
- services/
- utils/

---

## 🔑 File Penting

### composables
- useDashboard.js

### services
- paymentService.js

### utils
- billingRules.js (canGenerateInvoice)

---

## 🔄 Flow

Firestore → service → composable → UI

---

## ⚙️ Core Logic Placement

- billingRules.js → semua aturan billing
- paymentService.js → transaksi & invoice
- composables → agregasi data untuk UI

---

## ⚠️ Rules Arsitektur

- Tidak boleh duplikasi logic billing
- Semua validasi invoice harus lewat helper
- Service hanya handle data, bukan UI logic