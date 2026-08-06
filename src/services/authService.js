import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "../firebase"

// Login memakai akun Google (Gmail)
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return result.user
}

export async function signOutUser() {
  await signOut(auth)
}

// Ambil status otorisasi user dari koleksi `authorized_users` (doc id = email).
// Kalau belum pernah login sebelumnya, buat dokumen baru berstatus "pending" —
// Firestore Rules hanya mengizinkan create (bukan update) dari klien, jadi
// approval sesungguhnya harus dilakukan admin langsung lewat Firestore Console.
export async function getOrCreateAuthorization(user) {
  const ref = doc(db, "authorized_users", user.email)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    return snap.data().status || "pending"
  }

  await setDoc(ref, {
    email: user.email,
    name: user.displayName || "",
    photo_url: user.photoURL || "",
    status: "pending",
    requested_at: serverTimestamp()
  })

  return "pending"
}
