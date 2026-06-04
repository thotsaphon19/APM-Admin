# 🚀 AdminSys — React + Vite + Firebase + Tailwind

## Stack ที่ใช้
- **React 18** + **Vite** — Fast build tool
- **Firebase** — Auth + Firestore (real-time database)
- **Tailwind CSS v3** — Utility-first styling
- **Recharts** — Charts & graphs
- **React Router v6** — Routing
- **Lucide React** — Icons
- **Vercel** — Hosting (zero config)

---

## ขั้นตอน Setup Firebase (ต้องทำก่อน)

### 1. สร้าง Firebase Project
```
https://console.firebase.google.com → Add project
```

### 2. เปิด Authentication
```
Authentication → Sign-in method → Email/Password → Enable
```

### 3. สร้าง Firestore Database
```
Firestore Database → Create database → Start in production mode
→ เลือก Region (asia-southeast1 แนะนำสำหรับ TH)
```

### 4. ตั้ง Firestore Rules
```js
// Firestore → Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && (
        request.auth.uid == userId ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superadmin'
      );
    }
    match /{collection}/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. คัดลอก Firebase Config
```
Project Settings → General → Your apps → Add Web App
```
คัดลอก firebaseConfig มาใส่ไฟล์ `.env.local`:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 6. สร้างบัญชีผู้ดูแลสูงสุดครั้งแรก
```
Firebase Console → Authentication → Add user
→ Email: super@yourcompany.com
→ Password: ตั้งเอง

จากนั้นไป Firestore → users → Add document
Document ID: [UID ที่ได้จาก Authentication]
Fields:
  name: "ชื่อของคุณ"
  email: "super@yourcompany.com"
  role: "superadmin"
  avatar: "สด" (2 ตัวอักษร)
```

---

## รันบน Local

```bash
# ติดตั้ง dependencies
npm install

# สร้างไฟล์ .env.local แล้วใส่ Firebase config
cp .env.example .env.local

# รัน dev server
npm run dev
# เปิด http://localhost:5173
```

---

## Deploy บน Vercel ✅

### วิธีที่ 1: Vercel CLI (แนะนำ)
```bash
npm install -g vercel
vercel login
vercel --prod
```
ระหว่าง deploy จะถามให้ใส่ Environment Variables — ใส่ค่าจาก `.env.example`

### วิธีที่ 2: GitHub + Vercel Dashboard
1. `git init && git add . && git commit -m "init"`
2. Push ไป GitHub repo ใหม่
3. ไป https://vercel.com → New Project → Import repo นั้น
4. ใส่ Environment Variables ทั้งหมด
5. กด Deploy

> `vercel.json` ถูก config ให้ SPA routing ทำงานถูกต้องแล้ว

---

## โครงสร้างไฟล์

```
src/
├── contexts/
│   ├── AuthContext.jsx   # Firebase Auth + roles
│   └── DataContext.jsx   # Firestore real-time listeners
├── lib/
│   ├── firebase.js       # Firebase init
│   └── db.js             # Firestore CRUD helpers
├── components/
│   ├── ui/index.jsx      # Reusable components
│   └── layout/Layout.jsx # Sidebar + topbar
└── pages/
    ├── auth/Login.jsx
    ├── dashboard/Dashboard.jsx
    ├── commission/Commission.jsx
    ├── pages-mgmt/PagesManagement.jsx
    ├── leave/Leave.jsx
    ├── employees/Employees.jsx
    └── reports/Reports.jsx
```

---

## สิทธิ์การใช้งาน

| ตำแหน่ง | สิทธิ์ |
|---------|--------|
| superadmin | ทุกอย่าง รวมถึงเพิ่ม/ลบพนักงาน |
| head_admin | จัดเพจ, อนุมัติลา, ดูรายงาน |
| admin | ลงค่าคอม, ดูเพจตัวเอง, ขอลา |
| assistant | ดูค่าคอม, ดูรายงาน |

---

## Firestore Collections

| Collection | ข้อมูล |
|-----------|--------|
| `users` | ข้อมูลพนักงาน + role |
| `pages` | ข้อมูลเพจ + assignedTo |
| `commissions` | ค่าคอมรายวัน |
| `leaves` | วันลา + สถานะ |

