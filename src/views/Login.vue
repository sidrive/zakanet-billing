<script setup>
import { ref, watch } from "vue"
import { useRouter } from "vue-router"
import { useAuth } from "@/composables/useAuth"

const router = useRouter()
const { state, loginWithGoogle, logout, refreshAuthorization } = useAuth()

const isSigningIn = ref(false)
const isChecking = ref(false)
const errorMessage = ref("")

// Redirect ke dashboard begitu status jadi "approved" — dipasang sebagai
// watcher (bukan dicek sekali setelah await loginWithGoogle()) supaya tidak
// kena race condition: pengecekan authorized_users ke Firestore baru selesai
// SETELAH signInWithPopup resolve, jadi status bisa saja masih belum ter-update
// tepat di titik itu. Watcher ini menangkap perubahan status kapan pun terjadi.
watch(() => state.status, (status) => {
  if (status === "approved") {
    router.replace("/")
  }
}, { immediate: true })

async function handleGoogleLogin() {
  errorMessage.value = ""
  isSigningIn.value = true
  try {
    await loginWithGoogle()
  } catch (err) {
    console.error("Gagal login:", err)
    errorMessage.value = "Gagal masuk dengan Google. Coba lagi."
  } finally {
    isSigningIn.value = false
  }
}

async function handleRetry() {
  isChecking.value = true
  try {
    await refreshAuthorization()
  } finally {
    isChecking.value = false
  }
}

async function handleLogout() {
  await logout()
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-card__logo">Zakanet<span class="text-green">.</span></div>

      <!-- ── Belum login ── -->
      <template v-if="!state.user">
        <p class="login-card__subtitle">Masuk untuk mengelola billing pelanggan</p>
        <button class="btn-google" :disabled="isSigningIn" @click="handleGoogleLogin">
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16 4 9.1 8.5 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5c-2 1.4-4.6 2.3-7.5 2.3-5.2 0-9.6-3.3-11.3-8l-6.5 5C9 39.5 15.9 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C41.5 36.6 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"/>
          </svg>
          <span v-if="!isSigningIn">Masuk dengan Google</span>
          <span v-else>Memproses...</span>
        </button>
        <p v-if="errorMessage" class="login-card__error">{{ errorMessage }}</p>
      </template>

      <!-- ── Sedang memeriksa status akun (jeda setelah login Google) ── -->
      <template v-else-if="!state.status">
        <div class="login-card__spinner"></div>
        <p class="login-card__subtitle mt-12">Memeriksa akun...</p>
      </template>

      <!-- ── Menunggu persetujuan ── -->
      <template v-else-if="state.status === 'pending'">
        <div class="login-card__avatar">
          <img v-if="state.user.photoURL" :src="state.user.photoURL" alt="" />
          <span v-else>{{ (state.user.displayName || state.user.email).charAt(0).toUpperCase() }}</span>
        </div>
        <p class="login-card__title">Menunggu Persetujuan</p>
        <p class="login-card__subtitle">
          Akun <strong>{{ state.user.email }}</strong> sudah tercatat, tapi masih menunggu
          persetujuan admin. Hubungi admin untuk memverifikasi akun ini.
        </p>
        <button class="btn-green full-width" :disabled="isChecking" @click="handleRetry">
          <span v-if="!isChecking">Coba Lagi</span>
          <span v-else>Memeriksa...</span>
        </button>
        <button class="btn-text mt-8" @click="handleLogout">Keluar</button>
      </template>

      <!-- ── Status lain (error) ── -->
      <template v-else-if="state.status === 'error'">
        <p class="login-card__title">Terjadi Kesalahan</p>
        <p class="login-card__subtitle">Gagal memeriksa status akun. Periksa koneksi internet kamu.</p>
        <button class="btn-green full-width" :disabled="isChecking" @click="handleRetry">Coba Lagi</button>
        <button class="btn-text mt-8" @click="handleLogout">Keluar</button>
      </template>

      <!-- ── Approved: sekilas sebelum watcher redirect ke dashboard ── -->
      <template v-else>
        <div class="login-card__spinner"></div>
        <p class="login-card__subtitle mt-12">Berhasil masuk, mengarahkan...</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-page-bg);
  padding: 20px;
  box-sizing: border-box;
}

.login-card {
  width: 100%;
  max-width: 360px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card-lg);
  box-shadow: var(--shadow-card);
  padding: 32px 28px;
  text-align: center;
}

.login-card__logo {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-text-primary);
  margin-bottom: 20px;
}

.login-card__title {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.login-card__subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 20px;
  line-height: 1.6;
}

.login-card__avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-green-tint);
  color: var(--color-green);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 22px;
  margin: 0 auto 16px;
  overflow: hidden;
}

.login-card__avatar img { width: 100%; height: 100%; object-fit: cover; }

.login-card__error {
  font-size: 12px;
  color: var(--color-red);
  margin-top: 12px;
}

.login-card__spinner {
  width: 32px;
  height: 32px;
  margin: 8px auto 0;
  border: 3px solid var(--color-card-border);
  border-top-color: var(--color-green);
  border-radius: 50%;
  animation: login-spin 0.8s linear infinite;
}

@keyframes login-spin { to { transform: rotate(360deg); } }

.btn-google {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-card-border);
  background: #FFFFFF;
  color: var(--color-text-primary);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: var(--transition-input);
}

.btn-google:hover:not(:disabled) { border-color: var(--color-green-tint-border); background: var(--color-surface); }
.btn-google:disabled { opacity: 0.7; cursor: not-allowed; }

.btn-green {
  padding: 12px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--color-green);
  color: #FFFFFF;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}

.btn-green:hover:not(:disabled) { background: var(--color-green-hover); }
.btn-green:disabled { opacity: 0.7; cursor: not-allowed; }

.btn-text {
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  padding: 8px;
}

.full-width { width: 100%; }
.mt-8 { margin-top: 8px; }
.mt-12 { margin-top: 12px; }
</style>
