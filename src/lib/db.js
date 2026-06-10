import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, onSnapshot,
  serverTimestamp, writeBatch, Timestamp
} from 'firebase/firestore'
import { db } from './firebase'

// ─── helpers ──────────────────────────────────────────
const col = (path) => collection(db, path)
const toData = (snap) => ({ id: snap.id, ...snap.data() })
const toList = (snap) => snap.docs.map(toData)

// ─── USERS ────────────────────────────────────────────
export const usersRef = col('users')

export async function getUsers() {
  return toList(await getDocs(usersRef))
}

export async function getUserById(id) {
  const snap = await getDoc(doc(db, 'users', id))
  return snap.exists() ? toData(snap) : null
}

export async function createUserDoc(uid, data) {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateUserDoc(uid, data) {
  await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteUserDoc(uid) {
  await deleteDoc(doc(db, 'users', uid))
}

export function subscribeUsers(callback) {
  return onSnapshot(col('users'), (snap) => callback(toList(snap)))
}

// ─── PAGES ────────────────────────────────────────────
export function subscribePages(callback) {
  return onSnapshot(query(col('pages'), orderBy('createdAt', 'desc')), (snap) => callback(toList(snap)))
}

export async function addPage(data) {
  return addDoc(col('pages'), { ...data, createdAt: serverTimestamp() })
}

export async function updatePage(id, data) {
  return updateDoc(doc(db, 'pages', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deletePage(id) {
  return deleteDoc(doc(db, 'pages', id))
}

// ─── COMMISSIONS ─────────────────────────────────────
export function subscribeCommissions(callback, filters = {}) {
  // ดึงทั้งหมดโดยเรียงตาม date เพียงอย่างเดียว
  // การกรอง adminId ทำใน client (DataContext) เพื่อหลีกเลี่ยงปัญหา Firestore index
  const constraints = [orderBy('date', 'desc')]
  return onSnapshot(query(col('commissions'), ...constraints), (snap) => callback(toList(snap)))
}

export async function addCommission(data) {
  const manualTotal = (data.manualOrders || 0) * (data.manualRate || 0)
  const aiTotal     = (data.aiOrders    || 0) * (data.aiRate    || 0)
  return addDoc(col('commissions'), {
    ...data,
    manualTotal,
    aiTotal,
    total: manualTotal + aiTotal,
    createdAt: serverTimestamp(),
  })
}

export async function updateCommission(id, data) {
  const manualTotal = (data.manualOrders || 0) * (data.manualRate || 0)
  const aiTotal     = (data.aiOrders    || 0) * (data.aiRate    || 0)
  return updateDoc(doc(db, 'commissions', id), {
    ...data,
    manualTotal,
    aiTotal,
    total: manualTotal + aiTotal,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCommission(id) {
  return deleteDoc(doc(db, 'commissions', id))
}

// ─── LEAVES ──────────────────────────────────────────
export function subscribeLeaves(callback) {
  return onSnapshot(query(col('leaves'), orderBy('createdAt', 'desc')), (snap) => callback(toList(snap)))
}

export async function addLeave(data) {
  return addDoc(col('leaves'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

export async function updateLeave(id, data) {
  return updateDoc(doc(db, 'leaves', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteLeave(id) {
  return deleteDoc(doc(db, 'leaves', id))
}

// ─── COMMISSION RATES (settings) ─────────────────────
// เก็บใน Firestore: settings/commissionRates
const RATES_DOC = doc(db, 'settings', 'commissionRates')

export function subscribeCommissionRates(callback) {
  return onSnapshot(RATES_DOC, (snap) => {
    if (snap.exists()) {
      callback(snap.data())
    } else {
      // ค่า default ถ้ายังไม่เคยตั้ง
      callback({ manualRate: 5, aiRate: 2, updatedAt: null, updatedBy: null })
    }
  })
}

export async function setCommissionRates(manualRate, aiRate, uid, extra = {}) {
  await setDoc(RATES_DOC, {
    manualRate:  parseFloat(manualRate) || 0,
    aiRate:      parseFloat(aiRate)     || 0,
    useQuota:    extra.useQuota    ?? false,
    dailyQuota:  extra.dailyQuota  ?? 0,
    dailySalary: extra.dailySalary ?? 0,
    overRate:    extra.overRate != null ? extra.overRate : (parseFloat(manualRate) || 0),
    nightStart:  extra.nightStart  ?? '22:30',
    nightEnd:    extra.nightEnd    ?? '05:00',
    midnightCut: extra.midnightCut ?? true,
    updatedAt:   serverTimestamp(),
    updatedBy:   uid,
  }, { merge: true })
}

// ─── NOTIFICATIONS ────────────────────────────────────
export async function addNotification({ type, title, message, link, targetRoles, targetUserIds, createdBy }) {
  return addDoc(col('notifications'), {
    type,
    title,
    message,
    link,
    targetRoles:   targetRoles   || [],  // กรองด้วย role
    targetUserIds: targetUserIds || [],  // กรองด้วย uid เฉพาะคน (ถ้ามี)
    createdBy,
    readBy: [],
    createdAt: serverTimestamp(),
  })
}

export function subscribeNotifications(uid, role, callback) {
  const q = query(col('notifications'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    const all = snap.docs.map(toData)
    const filtered = all.filter(n => {
      const hasUserIds  = n.targetUserIds?.length > 0
      const hasRoles    = n.targetRoles?.length > 0

      // ถ้ามี targetUserIds และ uid อยู่ใน list → แสดง
      if (hasUserIds && n.targetUserIds.includes(uid)) return true

      // ถ้ามี targetUserIds แต่ uid ไม่อยู่ → ไม่แสดง (เฉพาะคนนั้น)
      if (hasUserIds && !n.targetUserIds.includes(uid)) return false

      // ไม่มี targetUserIds → ใช้ targetRoles
      if (!hasRoles) return true  // broadcast ทุกคน
      return n.targetRoles.includes('all') || n.targetRoles.includes(role)
    })
    callback(filtered.slice(0, 100))
  })
}

export async function markNotificationRead(notiId, uid) {
  const ref = doc(db, 'notifications', notiId)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    const readBy = snap.data().readBy || []
    if (!readBy.includes(uid)) {
      await updateDoc(ref, { readBy: [...readBy, uid] })
    }
  }
}

export async function markAllRead(uid) {
  const snap = await getDocs(col('notifications'))
  const batch = writeBatch(db)
  snap.docs.forEach(d => {
    const readBy = d.data().readBy || []
    if (!readBy.includes(uid)) {
      batch.update(d.ref, { readBy: [...readBy, uid] })
    }
  })
  await batch.commit()
}

export async function deleteNotification(id) {
  return deleteDoc(doc(db, 'notifications', id))
}

// ─── AUDIT ORDERS (หลังบ้าน) ──────────────────────────
export function subscribeAuditOrders(callback, filters = {}) {
  const constraints = [orderBy('date', 'desc')]
  return onSnapshot(query(col('auditOrders'), ...constraints), snap => callback(toList(snap)))
}

export async function addAuditOrder(data) {
  const manualTotal = (data.manualOrders || 0) * (data.manualRate || 0)
  const aiTotal     = (data.aiOrders    || 0) * (data.aiRate    || 0)
  return addDoc(col('auditOrders'), {
    ...data,
    manualTotal, aiTotal,
    total: manualTotal + aiTotal,
    createdAt: serverTimestamp(),
  })
}

export async function updateAuditOrder(id, data) {
  const manualTotal = (data.manualOrders || 0) * (data.manualRate || 0)
  const aiTotal     = (data.aiOrders    || 0) * (data.aiRate    || 0)
  return updateDoc(doc(db, 'auditOrders', id), {
    ...data, manualTotal, aiTotal,
    total: manualTotal + aiTotal,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteAuditOrder(id) {
  return deleteDoc(doc(db, 'auditOrders', id))
}

// ─── NIGHT DUTY (เวรเฝ้าเพจ) ──────────────────────────
export function subscribeNightDuty(callback) {
  return onSnapshot(
    query(col('nightDuty'), orderBy('date', 'desc')),
    snap => callback(toList(snap))
  )
}

export async function setNightDuty(date, assignments) {
  // assignments = [{ adminId, pageIds: [] }]
  const ref = doc(db, 'nightDuty', date)
  return setDoc(ref, {
    date,
    assignments,
    updatedAt: serverTimestamp(),
  }, { merge: false })
}

export async function getNightDuty(date) {
  const snap = await getDoc(doc(db, 'nightDuty', date))
  return snap.exists() ? toData(snap) : null
}

// ─── CHECK-IN / SHIFT ─────────────────────────────────
export function subscribeCheckins(callback, filters = {}) {
  const constraints = [orderBy('checkinTime', 'desc')]
  return onSnapshot(query(col('checkins'), ...constraints), snap => callback(toList(snap)))
}

export async function addCheckin(data) {
  return addDoc(col('checkins'), {
    ...data, // userId, pageId, shift (day/night), date
    checkinTime: serverTimestamp(),
    checkoutTime: null,
    status: 'active',
  })
}

export async function checkoutNow(checkinId) {
  return updateDoc(doc(db, 'checkins', checkinId), {
    checkoutTime: serverTimestamp(),
    status: 'completed',
  })
}

// ─── SALARY CONFIG ────────────────────────────────────
export async function setSalaryConfig(userId, baseSalary) {
  return setDoc(doc(db, 'salaryConfig', userId), {
    userId, baseSalary,
    updatedAt: serverTimestamp(),
  })
}

export function subscribeSalaryConfigs(callback) {
  return onSnapshot(col('salaryConfig'), snap => callback(toList(snap)))
}

// ─── PARCELS / SHIPPING ───────────────────────────────
export function subscribeParcels(callback, filters = {}) {
  const constraints = [orderBy('printDate', 'desc')]
  return onSnapshot(query(col('parcels'), ...constraints), snap => callback(toList(snap)))
}

export async function addParcel(data) {
  return addDoc(col('parcels'), { ...data, createdAt: serverTimestamp() })
}

export async function updateParcel(id, data) {
  return updateDoc(doc(db, 'parcels', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteParcel(id) {
  return deleteDoc(doc(db, 'parcels', id))
}

export async function addParcelsBatch(parcels, userId) {
  const batch = writeBatch(db)
  parcels.forEach(p => {
    const ref = doc(col('parcels'))
    batch.set(ref, { ...p, createdBy: userId, createdAt: serverTimestamp() })
  })
  return batch.commit()
}

// ─── PAYROLL LOCK ─────────────────────────────────────
export async function lockPayroll(month, userId) {
  return setDoc(doc(db, 'payrollLock', month), {
    month, lockedBy: userId, lockedAt: serverTimestamp(),
  })
}

export async function getPayrollLock(month) {
  const snap = await getDoc(doc(db, 'payrollLock', month))
  return snap.exists() ? toData(snap) : null
}

export function subscribePayrollLocks(callback) {
  return onSnapshot(col('payrollLock'), snap => callback(toList(snap)))
}

// ─── BACKEND ORDERS (หลังบ้านนำเข้า) ─────────────────
export async function addBackendOrders(data) {
  // data = { pageId, date, actualCount, importedBy, source }
  const ref = doc(db, 'backendOrders', `${data.pageId}_${data.date}`)
  return setDoc(ref, { ...data, importedAt: serverTimestamp() }, { merge: false })
}

export function subscribeBackendOrders(callback) {
  return onSnapshot(query(col('backendOrders'), orderBy('date','desc')), snap => callback(toList(snap)))
}
export async function addBackendOrder(data) {
  return addDoc(col('backendOrders'), { ...data, importedAt: serverTimestamp() })
}
export async function addBackendOrdersBatch(list) {
  const batch = writeBatch(db)
  list.forEach(item => batch.set(doc(col('backendOrders')), { ...item, importedAt: serverTimestamp() }))
  return batch.commit()
}

// ─── CANCELLED ORDERS ────────────────────────────────
export async function addCancelledOrder(data) {
  return addDoc(col('cancelledOrders'), { ...data, createdAt: serverTimestamp() })
}

export function subscribeCancelledOrders(callback) {
  return onSnapshot(query(col('cancelledOrders'), orderBy('originalDate','desc')), snap => callback(toList(snap)))
}

export async function deleteCancelledOrder(id) {
  return deleteDoc(doc(db, 'cancelledOrders', id))
}

// ─── PAYROLL DAILY SNAPSHOT ───────────────────────────
export async function savePayrollDaily(date, records) {
  // records = [{ userId, pageId, gross, deductions, net, breakdown }]
  return setDoc(doc(db, 'payrollDaily', date), {
    date, records, savedAt: serverTimestamp(),
  })
}

export function subscribePayrollDaily(callback) {
  return onSnapshot(query(col('payrollDaily'), orderBy('date','desc')), snap => callback(toList(snap)))
}

// ─── CREATE USER (Auth + Firestore) ──────────────────
export async function createUserWithEmail(email, password, profile) {
  const { initializeApp, getApps, deleteApp } = await import('firebase/app')
  const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth')
  const { firebaseConfig } = await import('./firebase')

  // ใช้ secondary app เพื่อไม่ให้กระทบ session superadmin ที่ login อยู่
  const secondaryAppName = 'secondary-create-' + Date.now()
  const secondaryApp  = initializeApp(firebaseConfig, secondaryAppName)
  const secondaryAuth = getAuth(secondaryApp)

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    await setDoc(doc(db, 'users', cred.user.uid), {
      ...profile,
      email,
      createdAt: serverTimestamp(),
    })
    return cred.user
  } finally {
    // ลบ secondary app ทันทีเพื่อไม่ให้ค้าง
    await signOut(secondaryAuth).catch(()=>{})
    await deleteApp(secondaryApp).catch(()=>{})
  }
}
