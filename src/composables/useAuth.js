import { reactive } from "vue"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "../firebase"
import { signInWithGoogle, signOutUser, getOrCreateAuthorization } from "../services/authService"

// Singleton reactive state — sama pola dengan useToast.js, supaya router guard
// dan halaman manapun berbagi state auth yang sama tanpa perlu provide/inject.
const state = reactive({
  user: null,     // Firebase user object, atau null kalau belum login
  status: null,   // "pending" | "approved" | "error" | null
  ready: false,   // true setelah pengecekan auth awal selesai
})

let initPromise = null

async function refreshAuthorization() {
  if (!state.user) return
  try {
    state.status = await getOrCreateAuthorization(state.user)
  } catch (err) {
    console.error("Gagal memeriksa status otorisasi:", err)
    state.status = "error"
  }
}

function initAuth() {
  if (initPromise) return initPromise

  initPromise = new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      state.user = user
      if (user) {
        await refreshAuthorization()
      } else {
        state.status = null
      }
      state.ready = true
      resolve()
    })
  })

  return initPromise
}

async function loginWithGoogle() {
  await signInWithGoogle()
  // onAuthStateChanged di atas otomatis memperbarui state.user & state.status
}

async function logout() {
  await signOutUser()
}

export function useAuth() {
  return { state, initAuth, loginWithGoogle, logout, refreshAuthorization }
}
