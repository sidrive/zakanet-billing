# PROJECT CONTEXT — ISP BILLING APP

## 🧩 Overview
Aplikasi web untuk pencatatan langganan internet (ISP billing system).

- Frontend: Vue 3 + Vite
- Database: Firebase Firestore
- Arsitektur: composables + services

---

## 👥 Customer (Collection: customers)

Fields:
- name: string
- custom_price: number
- balance: number (saldo customer)
- is_active: boolean
- join_date: Timestamp (optional)
- created_at: Timestamp

---

## 🧾 Invoice (Collection: invoices)

Fields:
- customer_id: string
- customer_name: string
- month: "YYYY-MM"
- amount: number
- paid_amount: number
- status: "paid" | "partial" | "unpaid"
- auto_subscribed: boolean
- paid_at: Timestamp | null
- created_at: Timestamp

---

## 💰 Payment (Collection: payments)

Fields:
- customer_id: string
- amount: number
- discount_amount: number
- note: string
- created_at: Timestamp

---

## 🔄 Data Flow

Firestore → services → composables → UI

---

## ⚙️ Core Functions

- canGenerateInvoice(customer, month)
- ensureMonthlyInvoices(month)
- ensureInvoiceThisMonth(customer)
- applyAutoSubscribe(customer, invoices)

---

## ⚠️ Important Notes

- Semua logic billing HARUS pakai helper (tidak boleh duplikasi)
- Jangan generate invoice tanpa validasi
- Gunakan serverTimestamp() untuk waktu