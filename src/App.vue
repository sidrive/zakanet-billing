<template>
  <div class="layout" :class="{ 'mobile-nav-active': isMobileMenuOpen }">
    <aside class="sidebar">
      <div class="logo-wrapper">
        <div class="logo-icon">B</div>
        <span class="logo-text">Billing<span class="text-green">ISP</span></span>
      </div>

      <nav class="nav-menu">
        <router-link to="/" class="nav-item">
          <i class="icon-dashboard"></i> <span>Dasbor</span>
        </router-link>
        <router-link to="/products" class="nav-item">
          <i class="icon-package"></i> <span>Paket Layanan</span>
        </router-link>
        <router-link to="/customers" class="nav-item">
          <i class="icon-users"></i> <span>Data Pelanggan</span>
        </router-link>
        <router-link to="/payments" class="nav-item">
          <i class="icon-wallet"></i> <span>Pembayaran</span>
        </router-link>
        <router-link to="/reports" class="nav-item">
          <i class="icon-chart"></i> <span>Laporan</span>
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
          <div class="user-avatar">JD</div>
        </div>
      </header>

      <section class="content">
        <router-view />
      </section>

      <nav class="bottom-nav">
        <router-link to="/" class="bnav-item">
          <span class="bnav-icon">🏠</span>
          <span class="bnav-label">Beranda</span>
        </router-link>
        <router-link to="/customers" class="bnav-item">
          <span class="bnav-icon">👥</span>
          <span class="bnav-label">Pelanggan</span>
        </router-link>
        <router-link to="/payments" class="bnav-item">
          <span class="bnav-icon">💸</span>
          <span class="bnav-label">Bayar</span>
        </router-link>
        <router-link to="/reports" class="bnav-item">
          <span class="bnav-icon">📊</span>
          <span class="bnav-label">Laporan</span>
        </router-link>
      </nav>
    </main>
  </div>
</template>