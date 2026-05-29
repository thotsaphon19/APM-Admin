# 🚀 Admin Page Manager v2
ระบบบริหารจัดการแอดมินเพจ — React + Google Apps Script + Google Sheets
**ระบบ Login ด้วย Email + Password พร้อม OTP ยืนยันอีเมล**

---

## 📦 ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|------|---------|
| `Code.gs` | Google Apps Script — Auth + CRUD ทั้งหมด |
| `src/pages/LoginPage.js` | Login / Forgot Password / OTP Verify |
| `src/pages/UsersPage.js` | เพิ่ม/แก้ไข/ลบผู้ใช้ + ส่ง OTP |
| `src/components/Layout.js` | Sidebar + เปลี่ยนรหัสผ่านตัวเอง |
| `src/utils/api.js` | เรียก GAS API |
| `src/utils/pdfExport.js` | Export PDF |

---

## ⚡ ขั้นตอน Deploy

### ขั้น 1 — Google Spreadsheet + Apps Script

1. ไปที่ [sheets.google.com](https://sheets.google.com) → สร้าง Spreadsheet ใหม่
2. **Extensions → Apps Script**
3. ลบ code เดิม → วาง code ทั้งหมดจากไฟล์ `Code.gs`
4. **บันทึก** (Ctrl+S)
5. เลือก function `setupSheets` → กด **Run** → อนุญาต Permission
6. **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - คลิก **Deploy** → คัดลอก **Web App URL**

> ⚠️ ทุกครั้งที่แก้ไข Code.gs ต้อง Deploy ใหม่ (New deployment หรือ Deploy existing)

### ขั้น 2 — ตั้งค่า .env

```bash
cp .env.example .env
# แก้ไข REACT_APP_GAS_URL ใส่ URL จากขั้น 1
```

### ขั้น 3 — รัน Local

```bash
npm install
npm start
```

### ขั้น 4 — Deploy บน Vercel

```bash
npm install -g vercel
vercel --prod
# เพิ่ม REACT_APP_GAS_URL ใน Vercel → Settings → Environment Variables
```

### ขั้น 5 — สร้าง Admin คนแรก

เนื่องจากระบบไม่มี self-register ให้ **เพิ่มผู้ใช้แรกผ่าน Google Sheet โดยตรง**:

1. เปิด Google Sheet → Sheet `Users`
2. เพิ่มแถวข้อมูล:

| email | firstName | lastName | displayName | role | pages | passwordHash | emailVerified | active | createdAt | lastLogin | createdBy |
|-------|-----------|----------|-------------|------|-------|-------------|---------------|--------|-----------|-----------|-----------|
| admin@example.com | Admin | User | Admin User | executive | [] | (ดูด้านล่าง) | true | true | 2025-01-01T00:00:00Z | | system |

3. หา `passwordHash`:
   - เปิด Apps Script → ใส่ code ชั่วคราว: `function test(){Logger.log(hashPassword('รหัสผ่านที่ต้องการ'))}`
   - Run → ดู Log → คัดลอก hash ใส่คอลัมน์ `passwordHash`

---

## 👤 ระบบสิทธิ์

| สิทธิ์ | บันทึกรายวัน | จัดการเพจ | จัดการผู้ใช้ | ดูรายงาน | ลบผู้ใช้ | เปลี่ยน Role |
|--------|------------|---------|------------|---------|---------|------------|
| ผู้บริหาร | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| หัวหน้า | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| แอดมิน | ✅ (ตัวเอง) | ❌ | ❌ | ✅ | ❌ | ❌ |

---

## 🔐 ระบบ Auth

### การสร้างผู้ใช้ใหม่ (Admin เท่านั้น)
1. ผู้บริหาร/หัวหน้าเข้าหน้า **จัดการผู้ใช้** → เพิ่มผู้ใช้
2. กรอก ชื่อ, อีเมล, รหัสผ่านเริ่มต้น, บทบาท, เพจ
3. ระบบส่ง **OTP 6 หลัก** ไปที่อีเมลอัตโนมัติ
4. ผู้ใช้ต้องยืนยัน OTP ก่อน login ได้

### ลืมรหัสผ่าน
1. หน้า Login → "ลืมรหัสผ่าน"
2. กรอกอีเมล → รับ OTP ทางอีเมล
3. กรอก OTP + รหัสผ่านใหม่

### เปลี่ยนรหัสผ่าน (ผู้ใช้เปลี่ยนเอง)
- Sidebar → ไอคอน 🔑 → กรอกรหัสผ่านปัจจุบัน + ใหม่

### Admin รีเซ็ตรหัสผ่านให้ผู้ใช้
- หน้าจัดการผู้ใช้ → ปุ่ม 🔑 ข้างชื่อผู้ใช้

---

## 📊 Google Sheet Tabs

| Sheet | คอลัมน์หลัก |
|-------|------------|
| Users | email, firstName, lastName, role, passwordHash, emailVerified, active |
| Pages | id, name, description, followers, category, active |
| DailyEntries | id, date, userEmail, pageId, messageCount, … |
| OTP_Tokens | email, otp, type, expiresAt, used |
