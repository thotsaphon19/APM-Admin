import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { getUserById, createUserDoc, updateUserDoc } from '../lib/db'

export const ROLES = {
  superadmin: 'ผู้ดูแลสูงสุด',
  head_admin: 'หัวหน้าแอดมิน',
  admin:      'แอดมิน',
  assistant:  'ผู้ช่วย',
  auditor:    'ผู้ตรวจสอบหลังบ้าน',
}

export const ROLE_COLOR = {
  superadmin: { badge: 'badge-red',    text: 'text-red-400',    bg: 'bg-red-500/10'    },
  head_admin: { badge: 'badge-orange', text: 'text-orange-400', bg: 'bg-orange-500/10' },
  admin:      { badge: 'badge-blue',   text: 'text-brand-400',  bg: 'bg-brand-500/10'  },
  assistant:  { badge: 'badge-green',  text: 'text-emerald-400',bg: 'bg-emerald-500/10'},
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser)
          let prof = await getUserById(firebaseUser.uid)
          // ── Auto-heal: ถ้า login ผ่าน Auth ได้ แต่ไม่มี Firestore document
          // (เช่น user ถูกสร้างตรงจาก Firebase Console) ให้สร้าง document
          // เริ่มต้นให้อัตโนมัติ ป้องกันไม่ให้ user ค้างเข้าระบบไม่ได้
          if (!prof) {
            await createUserDoc(firebaseUser.uid, {
              email: firebaseUser.email || '',
              name: firebaseUser.email?.split('@')[0] || 'พนักงานใหม่',
              role: 'admin',
              avatar: (firebaseUser.email || '??').slice(0, 2),
              username: firebaseUser.email?.split('@')[0] || '',
            })
            prof = await getUserById(firebaseUser.uid)
          }
          setProfile(prof)
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('Auth state error:', err)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    })
    return unsub
  }, [])

  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    let prof = await getUserById(cred.user.uid)
    // ── Auto-heal เช่นเดียวกับ onAuthStateChanged ──────
    if (!prof) {
      await createUserDoc(cred.user.uid, {
        email: cred.user.email || email,
        name: email.split('@')[0],
        role: 'admin',
        avatar: email.slice(0, 2),
        username: email.split('@')[0],
      })
      prof = await getUserById(cred.user.uid)
    }
    setProfile(prof)
    return prof
  }

  const logout = () => signOut(auth)

  // Create employee (called by superadmin)
  // สร้าง Auth user ก่อน แล้วสร้าง Firestore document คู่กันทันที
  // ถ้าสร้าง document ไม่สำเร็จ จะ throw error ชัดเจนแทนที่จะปล่อยให้
  // Auth user ลอยค้างไม่มี document (กรณีนี้ระบบ auto-heal ตอน login จะช่วยแก้ให้เองในรอบถัดไป)
  const createEmployee = async ({ email, password, name, role, avatar }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    try {
      await createUserDoc(cred.user.uid, {
        email, name, role,
        avatar: avatar || name.slice(0, 2),
        username: email.split('@')[0],
      })
      // ยืนยันว่า document ถูกสร้างจริง ไม่ใช่แค่ promise resolve เฉยๆ
      const check = await getUserById(cred.user.uid)
      if (!check) throw new Error('สร้างข้อมูลพนักงานใน Firestore ไม่สำเร็จ กรุณาลองใหม่ หรือให้พนักงานลอง login เพื่อให้ระบบสร้างข้อมูลให้อัตโนมัติ')
    } catch (err) {
      // ไม่สามารถลบ Auth user จากฝั่ง client ได้ (ต้องใช้ Admin SDK)
      // แต่ไม่ต้องห่วง เพราะระบบ auto-heal ตอน login จะสร้าง document ให้เองในครั้งถัดไป
      throw err
    }
    return cred.user.uid
  }

  const updateProfile = async (data) => {
    if (!user) return
    await updateUserDoc(user.uid, data)
    setProfile(prev => ({ ...prev, ...data }))
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      login, logout, createEmployee, updateProfile,
      isAdmin:     profile?.role === 'admin',
      isHead:      profile?.role === 'head_admin',
      isSuperAdmin:profile?.role === 'superadmin',
      isAssistant: profile?.role === 'assistant',
      canManage:   ['superadmin','head_admin'].includes(profile?.role),
      canEdit:     ['superadmin','head_admin','admin'].includes(profile?.role),
      canAudit:    ['superadmin','head_admin','auditor'].includes(profile?.role),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
