import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import {
  subscribeUsers, subscribePages, subscribeCommissions, subscribeLeaves,
  subscribeCommissionRates, setCommissionRates as dbSetRates,
  addPage, updatePage as dbUpdatePage, deletePage as dbDeletePage,
  addCommission, updateCommission as dbUpdateCommission, deleteCommission as dbDeleteCommission,
  addLeave, updateLeave,
} from '../lib/db'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { profile, user } = useAuth()
  const [users,       setUsers]       = useState([])
  const [pages,       setPages]       = useState([])
  const [allCommissions, setAllCommissions] = useState([])
  const [leaves,      setLeaves]      = useState([])
  const [commRates,   setCommRates]   = useState({ manualRate: 5, aiRate: 2 })
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!profile) { setLoadingData(false); return }
    setLoadingData(true)
    const unsubs = [
      subscribeUsers(setUsers),
      subscribePages(setPages),
      subscribeLeaves(setLeaves),
      subscribeCommissionRates(setCommRates),
      // ดึงทั้งหมดไม่กรอง แล้วกรองใน client แทน
      // เพื่อหลีกเลี่ยงปัญหา Firestore index + UID mismatch
      subscribeCommissions(setAllCommissions, {}),
    ]
    setLoadingData(false)
    return () => unsubs.forEach(u => u())
  }, [profile?.role, profile?.id])

  // กรอง commission ตาม role ใน client
  const commissions = React.useMemo(() => {
    if (!profile) return []
    if (profile.role === 'admin') {
      const uid = profile.id || user?.uid || ''
      return allCommissions.filter(c => c.adminId === uid)
    }
    return allCommissions
  }, [allCommissions, profile, user?.uid])

  // ── Commission Rates ─────────────────────────────
  const saveCommissionRates = (manual, ai) =>
    dbSetRates(manual, ai, profile?.id)

  // ── Pages ────────────────────────────────────────
  const createPage = (data) => addPage(data)
  const editPage   = (id, data) => dbUpdatePage(id, data)
  const removePage = (id) => dbDeletePage(id)

  // ── Commissions ──────────────────────────────────
  const createCommission = (data) => addCommission(data)
  const editCommission   = (id, data) => dbUpdateCommission(id, data)
  const removeCommission = (id) => dbDeleteCommission(id)

  // ── Leaves ───────────────────────────────────────
  const createLeave  = (data) => addLeave(data)
  const approveLeave = (id, approverId) =>
    updateLeave(id, { status: 'approved', approvedBy: approverId, approvedAt: new Date().toISOString() })
  const rejectLeave  = (id, approverId) =>
    updateLeave(id, { status: 'rejected', approvedBy: approverId })
  const removeLeave  = (id) => updateLeave(id, { deleted: true })

  // ── Helpers ──────────────────────────────────────
  const getCommStats = (filters = {}) => {
    let data = commissions
    if (filters.adminId) data = data.filter(c => c.adminId === filters.adminId)
    if (filters.pageId)  data = data.filter(c => c.pageId  === filters.pageId)
    if (filters.date)    data = data.filter(c => c.date    === filters.date)
    if (filters.month)   data = data.filter(c => c.date?.startsWith(filters.month))
    return data
  }
  const getUserName = (id) => users.find(u => u.id === id)?.name || '—'
  const getPageName = (id) => pages.find(p => p.id === id)?.name || '—'

  return (
    <DataContext.Provider value={{
      users, pages, commissions, leaves, commRates, loadingData,
      saveCommissionRates,
      createPage, editPage, removePage,
      createCommission, editCommission, removeCommission,
      createLeave, approveLeave, rejectLeave, removeLeave,
      getCommStats, getUserName, getPageName,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)
