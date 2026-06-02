import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import {
  subscribeNotifications, addNotification,
  markNotificationRead, markAllRead, deleteNotification,
} from '../lib/db'

const NotiContext = createContext(null)

// ── Icon / color ตาม type ──────────────────────────────
export const NOTI_CONFIG = {
  commission: { emoji:'💰', color:'#4338ca', bg:'#eef2ff', border:'#c7d2fe', label:'ค่าคอม' },
  leave:      { emoji:'🌴', color:'#0f766e', bg:'#f0fdfa', border:'#99f6e4', label:'วันลา' },
  leave_approve:{ emoji:'✅', color:'#059669', bg:'#f0fdf4', border:'#bbf7d0', label:'อนุมัติลา' },
  leave_reject: { emoji:'❌', color:'#be123c', bg:'#fff1f2', border:'#fecdd3', label:'ไม่อนุมัติลา' },
  page:       { emoji:'📄', color:'#6d28d9', bg:'#f5f3ff', border:'#ddd6fe', label:'เพจ' },
  employee:   { emoji:'👥', color:'#b45309', bg:'#fffbeb', border:'#fde68a', label:'พนักงาน' },
  system:     { emoji:'⚙️', color:'#374151', bg:'#f9fafb', border:'#e5e7eb', label:'ระบบ' },
  mailbox:    { emoji:'📬', color:'#0284c7', bg:'#f0f9ff', border:'#bae6fd', label:'เมล' },
  verify:     { emoji:'🔍', color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe', label:'ตรวจสอบ' },
}

export function NotificationProvider({ children }) {
  const { profile, user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const uid = user?.uid || profile?.id || ''

  useEffect(() => {
    if (!uid || !profile?.role) return
    return subscribeNotifications(uid, profile.role, setNotifications)
  }, [uid, profile?.role])

  const unreadCount = notifications.filter(n => !n.readBy?.includes(uid)).length

  const markRead = useCallback((id) => {
    if (uid) markNotificationRead(id, uid)
  }, [uid])

  const markAllAsRead = useCallback(() => {
    if (uid) markAllRead(uid)
  }, [uid])

  const deleteNoti = useCallback((id) => deleteNotification(id), [])

  // ── Helper สร้าง notification ──────────────────────────
  const notify = useCallback(async (opts) => {
    if (!uid) return
    return addNotification({ ...opts, createdBy: uid })
  }, [uid])

  return (
    <NotiContext.Provider value={{
      notifications, unreadCount,
      markRead, markAllAsRead, deleteNoti, notify,
      uid,
    }}>
      {children}
    </NotiContext.Provider>
  )
}

export const useNotifications = () => useContext(NotiContext)
