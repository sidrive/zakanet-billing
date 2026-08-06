<script setup>
import { watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { PhHouse, PhPackage, PhUsers, PhWallet, PhChartBar, PhGift } from "@phosphor-icons/vue"
import Toast from "@/components/Toast.vue"
import { useAuth } from "@/composables/useAuth"

const route = useRoute()
const router = useRouter()
const { state, logout } = useAuth()

const navItems = [
  { to: "/", icon: PhHouse, label: "Dasbor", bnavLabel: "Beranda" },
  { to: "/products", icon: PhPackage, label: "Paket Layanan", bnavLabel: "Paket" },
  { to: "/customers", icon: PhUsers, label: "Data Pelanggan", bnavLabel: "Pelanggan" },
  { to: "/payments", icon: PhWallet, label: "Pembayaran", bnavLabel: "Bayar" },
  { to: "/reports", icon: PhChartBar, label: "Laporan", bnavLabel: "Laporan" },
  { to: "/promo", icon: PhGift, label: "Promo Bulanan", bnavLabel: "Promo" },
]

// Kalau sesi berakhir (logout di tab lain / token habis) saat sedang di
// halaman non-publik, langsung lempar ke /login tanpa nunggu navigasi berikutnya.
watch(() => state.user, (user) => {
  if (!user && state.ready && !route.meta.public) {
    router.replace("/login")
  }
})

async function handleLogout() {
  await logout()
  router.replace("/login")
}
</script>

<template>
  <div v-if="route.meta.public" class="auth-shell">
    <router-view />
  </div>

  <div v-else class="layout">
    <aside class="sidebar">
      <div class="logo-wrapper">
        <div class="logo-icon">Zn</div>
        <span class="logo-text">Billing<span class="text-green">Zakanet</span></span>
      </div>

      <nav class="nav-menu">
        <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="nav-item">
          <component :is="item.icon" size="18" weight="bold" /> <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <p class="admin-name">{{ state.user?.displayName || state.user?.email || 'Admin' }}</p>
        <button class="btn-logout" @click="handleLogout">Keluar</button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="topbar-left">
          <h3 class="page-title">{{ $route.meta.title || 'Billing ISP' }}</h3>
        </div>
        <div class="topbar-right">
          <div class="user-avatar">
            <img v-if="state.user?.photoURL" :src="state.user.photoURL" alt="" />
            <span v-else>{{ (state.user?.displayName || state.user?.email || '?').charAt(0).toUpperCase() }}</span>
          </div>
        </div>
      </header>

      <section class="content">
        <router-view />
      </section>

      <nav class="bottom-nav">
        <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="bnav-item">
          <component :is="item.icon" size="20" weight="bold" class="bnav-icon" />
          <span class="bnav-label">{{ item.bnavLabel }}</span>
        </router-link>
      </nav>
    </main>

    <Toast />
  </div>
</template>

<style scoped>
.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-chip-bg);
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  overflow: hidden;
  flex-shrink: 0;
}

.user-avatar img { width: 100%; height: 100%; object-fit: cover; }

.sidebar-footer {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--color-card-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-logout {
  align-self: flex-start;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-card-border);
  background: var(--color-card-bg);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition-card);
}

.btn-logout:hover { border-color: var(--color-red); color: var(--color-red); }
</style>