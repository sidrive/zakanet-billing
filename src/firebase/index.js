import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
 apiKey: "AIzaSyCuZC25ZR4wDmDFa3fig1ig-2vSSfdFtdI",
 authDomain: "zakanet-billing.firebaseapp.com",
 projectId: "zakanet-billing",
 storageBucket: "zakanet-billing.firebasestorage.app",
 messagingSenderId: "984708956908",
 appId: "1:984708956908:web:758f5f9db979a1f0405bc9"
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const auth = getAuth(app)
