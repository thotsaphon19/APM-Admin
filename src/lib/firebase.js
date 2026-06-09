import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// ======================================================
// 🔥 PASTE YOUR FIREBASE CONFIG HERE
// ======================================================
// 1. ไปที่ https://console.firebase.google.com
// 2. สร้าง Project ใหม่ (หรือใช้ที่มีอยู่)
// 3. Project Settings → General → Your apps → Web app
// 4. กด </> เพื่อเพิ่ม Web App และคัดลอก firebaseConfig
// 5. วางแทนค่าด้านล่างนี้
// ======================================================

export const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "YOUR_API_KEY",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "YOUR_PROJECT.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "YOUR_PROJECT_ID",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "YOUR_PROJECT.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| "YOUR_SENDER_ID",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "YOUR_APP_ID",
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db   = getFirestore(app)
export default app
