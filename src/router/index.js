import { createRouter, createWebHistory } from "vue-router"

import Dashboard from "../views/Dashboard.vue"
import Customers from "../views/Customers.vue"
import Payments from "../views/Payments.vue"
import Reports from "../views/Reports.vue"
import Products from "../views/Products.vue"
import Promo from "../views/Promo.vue"
import Login from "../views/Login.vue"
import { useAuth } from "../composables/useAuth"

const routes = [
  { path: "/login", component: Login, meta: { public: true, title: "Masuk" } },
  { path: "/", component: Dashboard, meta: { title: 'Dashboard'} },
  { path: "/products", component: Products, meta: { title: 'Paket Layanan'} },
  { path: "/customers", component: Customers, meta: { title: 'Pelanggan'} },
  { path: "/payments", component: Payments, meta: { title: 'Pembayaran'} },
  { path: "/reports", component: Reports, meta: { title: 'Laporan'} },
  { path: "/promo", component: Promo, meta: { title: 'Promo Bulanan'} }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const { state, initAuth } = useAuth()
  await initAuth()

  if (to.meta.public) {
    // Sudah login & disetujui tapi buka /login manual → langsung ke dashboard
    if (state.user && state.status === "approved") {
      return "/"
    }
    return true
  }

  if (!state.user || state.status !== "approved") {
    return "/login"
  }

  return true
})

export default router
