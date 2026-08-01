<script setup>
import { PhHouse, PhPackage, PhUsers, PhWallet, PhChartBar, PhGift } from "@phosphor-icons/vue"
import Toast from "@/components/Toast.vue"

const navItems = [
  { to: "/", icon: PhHouse, label: "Dasbor", bnavLabel: "Beranda" },
  { to: "/products", icon: PhPackage, label: "Paket Layanan", bnavLabel: "Paket" },
  { to: "/customers", icon: PhUsers, label: "Data Pelanggan", bnavLabel: "Pelanggan" },
  { to: "/payments", icon: PhWallet, label: "Pembayaran", bnavLabel: "Bayar" },
  { to: "/reports", icon: PhChartBar, label: "Laporan", bnavLabel: "Laporan" },
  { to: "/promo", icon: PhGift, label: "Promo Bulanan", bnavLabel: "Promo" },
]
</script>

<template>
  <div class="layout">
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
        <p class="admin-name">Admin Pusat</p>
        <button class="btn-logout">Keluar</button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="topbar-left">
          <h3 class="page-title">{{ $route.meta.title || 'Billing ISP' }}</h3>
        </div>
        <div class="topbar-right">
          <div class="user-avatar">Ikun</div>
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