import { createRouter, createWebHistory } from "vue-router"

import Dashboard from "../views/Dashboard.vue"
import Customers from "../views/Customers.vue"
import Payments from "../views/Payments.vue"
import Reports from "../views/Reports.vue"
import Products from "../views/Products.vue"

const routes = [
  { path: "/", component: Dashboard, meta: { title: 'Dashboard'} },
  { path: "/products", component: Products, meta: { title: 'Paket Layanan'} },
  { path: "/customers", component: Customers, meta: { title: 'Pelanggan'} },
  { path: "/payments", component: Payments, meta: { title: 'Pembayaran'} },
  { path: "/reports", component: Reports, meta: { title: 'Laporan'} }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
