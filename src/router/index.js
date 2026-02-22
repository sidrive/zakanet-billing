import { createRouter, createWebHistory } from "vue-router"

import Dashboard from "../views/Dashboard.vue"
import Customers from "../views/Customers.vue"
import Payments from "../views/Payments.vue"
import Reports from "../views/Reports.vue"
import Products from "../views/Products.vue"

const routes = [
  { path: "/", component: Dashboard },
  { path: "/products", component: Products },
  { path: "/customers", component: Customers },
  { path: "/payments", component: Payments },
  { path: "/reports", component: Reports }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
