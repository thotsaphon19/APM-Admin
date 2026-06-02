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

export async function setCommissionRates(manualRate, aiRate, uid) {
  await setDoc(RATES_DOC, {
    manualRate: parseFloat(manualRate) || 0,
    aiRate:     parseFloat(aiRate)     || 0,
    updatedAt:  serverTimestamp(),
    updatedBy:  uid,
  }, { merge: true })
}

// ─── NOTIFICATIONS ────────────────────────────────────
export async function addNotification({ type, title, message, link, targetRoles, createdBy }) {
  return addDoc(col('notifications'), {
    type,        // 'commission' | 'leave' | 'page' | 'employee' | 'system'
    title,
    message,
    link,        // path เช่น '/commission' '/leave'
    targetRoles, // ['superadmin','head_admin'] หรือ ['all']
    createdBy,
    readBy: [],  // array of uid ที่อ่านแล้ว
    createdAt: serverTimestamp(),
  })
}

export function subscribeNotifications(uid, role, callback) {
  const q = query(col('notifications'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    const all = snap.docs.map(toData)
    // กรองตาม role
    const filtered = all.filter(n => {
      if (!n.targetRoles) return true
      return n.targetRoles.includes('all') || n.targetRoles.includes(role)
    })
    callback(filtered)
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
