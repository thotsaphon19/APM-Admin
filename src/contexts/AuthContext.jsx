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
      if (firebaseUser) {
        setUser(firebaseUser)
        const prof = await getUserById(firebaseUser.uid)
        setProfile(prof)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const prof = await getUserById(cred.user.uid)
    setProfile(prof)
    return prof
  }

  const logout = () => signOut(auth)

  // Create employee (called by superadmin)
  const createEmployee = async ({ email, password, name, role, avatar }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await createUserDoc(cred.user.uid, {
      email, name, role,
      avatar: avatar || name.slice(0, 2),
      username: email.split('@')[0],
    })
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
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
