import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import {
  subscribeUsers, subscribePages, subscribeCommissions, subscribeLeaves,
  subscribeCommissionRates, setCommissionRates as dbSetRates,
  addPage, updatePage as dbUpdatePage, deletePage as dbDeletePage,
  subscribeAuditOrders, addAuditOrder, updateAuditOrder, deleteAuditOrder,
  subscribeNightDuty, setNightDuty as dbSetNightDuty, getNightDuty,
  subscribeBackendOrders, addBackendOrder, addBackendOrdersBatch,
  subscribeCancelledOrders, addCancelledOrder, deleteCancelledOrder,
  subscribeCheckins, addCheckin, checkoutNow,
  subscribeSalaryConfigs, setSalaryConfig,
  subscribeParcels, addParcel, updateParcel, deleteParcel, addParcelsBatch,
  lockPayroll, getPayrollLock, subscribePayrollLocks,
  addCommission, updateCommission as dbUpdateCommission, deleteCommission as dbDeleteCommission,
  addLeave, updateLeave,
  subscribePayrollDaily, savePayrollDaily,
  updateUserDoc,
} from '../lib/db'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { profile, user } = useAuth()
  const [users,       setUsers]       = useState([])
  const [pages,       setPages]       = useState([])
  const [allCommissions, setAllCommissions] = useState([])
  const [auditOrders,    setAuditOrders]    = useState([])
  const [nightDuty,      setNightDuty]       = useState([])
  const [checkins,       setCheckins]        = useState([])
  const [salaryConfigs,  setSalaryConfigs]   = useState([])
  const [parcels,        setParcels]         = useState([])
  const [payrollLocks,   setPayrollLocks]    = useState([])
  const [backendOrders,  setBackendOrders]   = useState([])
  const [cancelledOrders,setCancelledOrders] = useState([])
  const [payrollDaily,   setPayrollDaily]    = useState([])
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
      subscribeCommissions(setAllCommissions, {}),
      subscribeAuditOrders(setAuditOrders),
      subscribeNightDuty(setNightDuty),
      subscribeCheckins(setCheckins),
      subscribeSalaryConfigs(setSalaryConfigs),
      subscribeParcels(setParcels),
      subscribePayrollLocks(setPayrollLocks),
      subscribeBackendOrders(setBackendOrders),
      subscribeCancelledOrders(setCancelledOrders),
      subscribeBackendOrders(setBackendOrders),
      subscribeCancelledOrders(setCancelledOrders),
      subscribePayrollDaily(setPayrollDaily),
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
  const saveCommissionRates = (manual, ai, extra = {}) =>
    dbSetRates(manual, ai, profile?.id, extra)

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

  // ── Backend Orders ──────────────────────────────
  const importBackendOrders = (list) => addBackendOrdersBatch(list)

  // ── Cancelled Orders ─────────────────────────────
  const addCancel   = (data) => addCancelledOrder(data)
  const removeCancel= (id)   => deleteCancelledOrder(id)

  // ── Check-in / Shift ─────────────────────────────
  const doCheckin  = (data) => addCheckin(data)
  const doCheckout = (id)   => checkoutNow(id)

  // ── Salary Config ─────────────────────────────────
  const saveSalary = (uid, base) => setSalaryConfig(uid, base)
  const getSalary  = (uid) => salaryConfigs.find(s => s.userId === uid)?.baseSalary || 0

  // ── Parcels ───────────────────────────────────────
  const createParcel  = (data)        => addParcel(data)
  const editParcel    = (id, data)    => updateParcel(id, data)
  const removeParcel  = (id)          => deleteParcel(id)
  const importParcels = (list)        => addParcelsBatch(list, profile?.id)

  // ── Backend Orders ───────────────────────────────
  // ── Payroll Daily ─────────────────────────────────
  const savePayroll = (date, records) => savePayrollDaily(date, records)

  // ── Payroll Lock ──────────────────────────────────
  const confirmPayroll = (month) => lockPayroll(month, profile?.id)
  const isPayrollLocked = (month) => payrollLocks.some(l => l.month === month)

  // ── Night Duty ───────────────────────────────────
  const saveNightDuty = (date, assignments) => dbSetNightDuty(date, assignments)

  // ── Audit Orders ─────────────────────────────────
  const createAuditOrder = (data) => addAuditOrder(data)
  const editAuditOrder   = (id, data) => updateAuditOrder(id, data)
  const removeAuditOrder = (id) => deleteAuditOrder(id)

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
  const getPage     = (id) => pages.find(p => p.id === id) || null

  // ── Update User ──────────────────────────────────
  const updateUser = (id, data) => updateUserDoc(id, data)

  return (
    <DataContext.Provider value={{
      users, pages, commissions, auditOrders, leaves, commRates, loadingData,
      createAuditOrder, editAuditOrder, removeAuditOrder,
      checkins, doCheckin, doCheckout,
      salaryConfigs, saveSalary, getSalary,
      parcels, createParcel, editParcel, removeParcel, importParcels,
      payrollLocks, confirmPayroll, isPayrollLocked,
      backendOrders, importBackendOrders,
      cancelledOrders, addCancel, removeCancel,
      nightDuty, saveNightDuty, getNightDuty,
      saveCommissionRates,
      createPage, editPage, removePage,
      createCommission, editCommission, removeCommission,
      createLeave, approveLeave, rejectLeave, removeLeave,
      updateUser,
      getCommStats, getUserName, getPageName, getPage,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)
