import React, { useState, useMemo } from 'react'
import {
  format, eachDayOfInterval, startOfMonth,
  endOfMonth, parseISO,
} from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { useNotify } from '../../hooks/useNotify'
import {
  Lock, Download, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { calcDailyPayroll, calcMonthlyPayroll, exportPayrollExcel } from './payrollEngine'

const thisMonth = format(new Date(), 'yyyy-MM')
const today     = format(new Date(), 'yyyy-MM-dd')
const DEFAULT_LOST_THRESHOLD = 0.1

export default function Payroll() {
  const { profile, isSuperAdmin } = useAuth()
  const {
    users, commissions, backendOrders, cancelledOrders, commRates,
    salaryConfigs, saveSalary,
    payrollLocks, confirmPayroll, isPayrollLocked,
    getUserName,
  } = useData()
  const { notifyCustom } = useNotify()

  const [month,         setMonth]           = useState(thisMonth)
  const [tab,           setTab]             = useState('monthly')
  const [selectedDate,  setSelectedDate]    = useState(today)
  const [expandAdmin,   setExpandAdmin]     = useState(null)
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [lostThreshold, setLostThreshold]   = useState(DEFAULT_LOST_THRESHOLD)
  const [absencePenalty,setAbsencePenalty]  = useState(0)
  const [saving,        setSaving]          = useState(false)

  const admins   = users.filter(u => ['admin','head_admin'].includes(u.role))
  const isLocked = isPayrollLocked(month)

  // ── Days in selected month ─────────────────────────
  const daysInMonth = useMemo(() => {
    try {
      const s = startOfMonth(parseISO(month + '-01'))
      const e = endOfMonth(s)
      return eachDayOfInterval({ start: s, end: e }).map(d => format(d, 'yyyy-MM-dd'))
    } catch { return [] }
  }, [month])

  // ── All daily payrolls for this month ─────────────
  const allDailyPayrolls = useMemo(() => {
    const result = []
    for (const admin of admins) {
      for (const date of daysInMonth) {
        const dp = calcDailyPayroll({
          adminId:        admin.id,
          adminName:      admin.name,
          date,
          commissions:    commissions.filter(c => c.date === date),
          backendOrders:  backendOrders.filter(b => b.date === date),
          cancelledOrders:cancelledOrders.filter(c => c.originalDate === date),
          commRates,
          absencePenalty,
          isAbsent:       false,
        })
        if (dp.records.length > 0 || dp.hasBackend) result.push(dp)
      }
    }
    return result
  }, [admins, daysInMonth, commissions, backendOrders, cancelledOrders, commRates, absencePenalty])

  // ── Monthly summaries ─────────────────────────────
  const monthlyPayrolls = useMemo(() => admins.map(admin => {
    const baseSalary = Array.isArray(salaryConfigs)
      ? (salaryConfigs.find(s => s.userId === admin.id)?.baseSalary || 0)
      : 0
    return {
      ...calcMonthlyPayroll(admin.id, admin.name, month, allDailyPayrolls, baseSalary),
      locked: isLocked,
    }
  }).sort((a, b) => b.grandTotal - a.grandTotal),
  [admins, allDailyPayrolls, month, salaryConfigs, isLocked])

  // ── Today's payrolls ──────────────────────────────
  const todayPayrolls = useMemo(() => admins.map(admin =>
    calcDailyPayroll({
      adminId:        admin.id,
      adminName:      admin.name,
      date:           selectedDate,
      commissions:    commissions.filter(c => c.date === selectedDate),
      backendOrders:  backendOrders.filter(b => b.date === selectedDate),
      cancelledOrders:cancelledOrders.filter(c => c.originalDate === selectedDate),
      commRates,
      absencePenalty,
      isAbsent:       false,
    })
  ).filter(d => d.records.length > 0 || d.hasBackend)
   .sort((a, b) => b.finalNet - a.finalNet),
  [admins, commissions, backendOrders, cancelledOrders, selectedDate, commRates, absencePenalty])

  // ── Compare data ──────────────────────────────────
  const compareData = useMemo(() => {
    const mc = commissions.filter(c => c.date?.startsWith(month))
    const mb = backendOrders.filter(b => b.date?.startsWith(month))
    const keys = new Set([
      ...mc.map(c => `${c.adminId}|${c.pageId}|${c.date}`),
      ...mb.flatMap(b => mc.filter(c => c.pageId === b.pageId && c.date === b.date).map(c => `${c.adminId}|${c.pageId}|${c.date}`)),
    ])
    return [...keys].map(key => {
      const [adminId, pageId, date] = key.split('|')
      const recs   = mc.filter(c => c.adminId === adminId && c.pageId === pageId && c.date === date)
      const bRec   = mb.find(b => b.pageId === pageId && b.date === date)
      const admin  = recs.reduce((a, c) => a + (c.manualOrders || 0) + (c.aiOrders || 0), 0)
      const backend = bRec?.actualCount ?? null
      const diff   = backend !== null ? admin - backend : null
      const pgName  = (window._pageNames || {})[pageId] || pageId
      return { adminId, pageId: pgName, date, adminOrders: admin, backendOrds: backend, diff, adminName: getUserName(adminId) }
    }).sort((a, b) => (Math.abs(b.diff) || 0) - (Math.abs(a.diff) || 0))
  }, [commissions, backendOrders, month, getUserName])

  // ── Alerts ────────────────────────────────────────
  const alerts = useMemo(() =>
    monthlyPayrolls.filter(m => m.lostRate > lostThreshold && m.orderTotal > 0),
    [monthlyPayrolls, lostThreshold])

  // ── Grand totals ──────────────────────────────────
  const grand = useMemo(() => ({
    pay:    monthlyPayrolls.reduce((a, m) => a + m.grandTotal, 0),
    net:    monthlyPayrolls.reduce((a, m) => a + m.totalNet, 0),
    base:   monthlyPayrolls.reduce((a, m) => a + m.baseSalary, 0),
    deduct: monthlyPayrolls.reduce((a, m) => a + m.totalDeductions, 0),
    lost:   monthlyPayrolls.reduce((a, m) => a + m.lostOrdersTotal, 0),
    orders: monthlyPayrolls.reduce((a, m) => a + m.orderTotal, 0),
  }), [monthlyPayrolls])

  // ── Lock ──────────────────────────────────────────
  const handleLock = async () => {
    setSaving(true)
    try {
      await confirmPayroll(month)
      notifyCustom({
        type: 'system', title: `🔒 ล็อคเงินเดือน ${month}`,
        message: `${profile?.name} ล็อคยอดเงินเดือนเดือน ${month} แล้ว`,
        link: '/payroll', targetRoles: ['all'],
      })
      setShowLockConfirm(false)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  // ── Save salary ───────────────────────────────────
  const handleSaveSalary = (uid, val) => saveSalary(uid, parseFloat(val) || 0)

  const S = { background: '#fff', border: '1.5px solid #dde3f5', borderRadius: 10, color: '#1e1b4b', fontFamily: 'inherit', fontSize: 13.5, padding: '8px 12px', outline: 'none' }

  const TABS = [
    { k: 'monthly',  label: '📆 สรุปรายเดือน' },
    { k: 'daily',    label: '📅 สรุปรายวัน' },
    { k: 'compare',  label: '🔍 เปรียบเทียบ' },
    { k: 'settings', label: '⚙️ ตั้งค่า' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1e1b4b', marginBottom: 3 }}>💵 ระบบเงินเดือน</h2>
          <p style={{ fontSize: 12.5, color: '#6b7280' }}>คำนวณค่าคอม · หักลด · ล็อคยอด · Export Excel</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="month" style={{ ...S, width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)} />
          {isSuperAdmin && !isLocked && (
            <button onClick={() => setShowLockConfirm(true)}
              style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#b45309', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={14} /> ล็อคเงินเดือน
            </button>
          )}
          {isLocked && (
            <div style={{ background: '#fff1f2', border: '1.5px solid #fecdd3', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, color: '#be123c', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={14} /> 🔒 ล็อคแล้ว
            </div>
          )}
          <button onClick={() => exportPayrollExcel(monthlyPayrolls, month)}
            style={{ background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontSize: 13.5, fontWeight: 800, color: '#fff', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 12px rgba(16,185,129,.3)' }}>
            <Download size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ background: '#fff1f2', border: '2px solid #fca5a5', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#be123c', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} /> ⚠️ ออเดอร์หายเกินเกณฑ์ {Math.round(lostThreshold * 100)}%
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {alerts.map(a => (
              <div key={a.adminId} style={{ background: '#fff', border: '1.5px solid #fecdd3', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                  {(a.adminName || '?').slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1e1b4b' }}>{a.adminName}</div>
                  <div style={{ fontSize: 12, color: '#be123c' }}>หาย {a.lostOrdersTotal} บ้าน ({Math.round(a.lostRate * 100)}%) — หัก ฿{a.totalLost.toFixed(0)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 12 }}>
        {[
          { e: '💰', l: 'ยอดจ่ายทั้งทีม',   v: `฿${grand.pay.toLocaleString()}`,    bg: 'linear-gradient(135deg,#eef2ff,#e0e7ff)', c: '#4338ca', b: '#c7d2fe' },
          { e: '💵', l: 'ค่าคอมสุทธิ',        v: `฿${grand.net.toLocaleString()}`,    bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', c: '#059669', b: '#bbf7d0' },
          { e: '🏠', l: 'เงินเดือนฐาน',        v: `฿${grand.base.toLocaleString()}`,   bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', c: '#7c3aed', b: '#ddd6fe' },
          { e: '📉', l: 'หักทั้งหมด',          v: `฿${grand.deduct.toLocaleString()}`, bg: 'linear-gradient(135deg,#fff1f2,#ffe4e6)', c: '#be123c', b: '#fecdd3' },
          { e: '❓', l: 'ออเดอร์หาย (บ้าน)', v: grand.lost,                          bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', c: '#b45309', b: '#fde68a' },
          { e: '📦', l: 'ออเดอร์รวม',          v: grand.orders.toLocaleString(),       bg: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', c: '#0284c7', b: '#bae6fd' },
        ].map((k, i) => (
          <div key={i} style={{ background: k.bg, border: `1.5px solid ${k.b}`, borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{k.e}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: k.c }}>{k.v}</div>
            <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 4, fontWeight: 600 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#eef2ff', border: '1.5px solid #c7d2fe', borderRadius: 12, padding: 4, width: 'fit-content', gap: 3, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', background: tab === t.k ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : 'transparent', color: tab === t.k ? '#fff' : '#6366f1' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════ TAB: MONTHLY ══════ */}
      {tab === 'monthly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {monthlyPayrolls.filter(m => m.days.length > 0 || m.baseSalary > 0).length === 0 ? (
            <div style={{ background: '#fff', border: '1.5px solid #e0e7ff', borderRadius: 16, padding: 36, textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>💵</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>ไม่มีข้อมูลเดือนนี้</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>ลองเลือกเดือนอื่น หรือรอแอดมินลงข้อมูล</div>
            </div>
          ) : monthlyPayrolls.map((m, idx) => {
            const isExp = expandAdmin === m.adminId
            const hasAlert = m.lostRate > lostThreshold && m.orderTotal > 0
            return (
              <div key={m.adminId} style={{ background: '#fff', border: `1.5px solid ${hasAlert ? '#fca5a5' : '#e0e7ff'}`, borderRadius: 16, overflow: 'hidden' }}>
                {/* Row header */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}
                  onClick={() => setExpandAdmin(isExp ? null : m.adminId)}>

                  {/* Avatar + rank */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 170 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                      background: idx === 0 ? 'linear-gradient(135deg,#f59e0b,#fbbf24)' : idx === 1 ? 'linear-gradient(135deg,#94a3b8,#cbd5e1)' : idx === 2 ? 'linear-gradient(135deg,#b87333,#cd8b4e)' : 'linear-gradient(135deg,#6366f1,#7c3aed)',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900,
                    }}>
                      {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : (m.adminName || '?').slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#1e1b4b' }}>{m.adminName}</div>
                      <div style={{ fontSize: 11.5, color: '#9ca3af' }}>{m.workDays} วัน · {m.absentDays} ขาด · {m.orderTotal} บ้าน</div>
                    </div>
                  </div>

                  {/* Pills */}
                  <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
                    {m.baseSalary > 0 && <Pill e="🏠" l="ฐาน" v={`฿${m.baseSalary.toLocaleString()}`} c="#7c3aed" bg="#f5f3ff" b="#ddd6fe" />}
                    <Pill e="💎" l="ค่าคอม" v={`฿${m.totalNet.toLocaleString()}`} c="#4338ca" bg="#eef2ff" b="#c7d2fe" />
                    {m.totalDeductions > 0 && <Pill e="📉" l="หัก" v={`−฿${m.totalDeductions.toLocaleString()}`} c="#be123c" bg="#fff1f2" b="#fecdd3" />}
                    {hasAlert && (
                      <span style={{ background: '#fff1f2', color: '#be123c', border: '1.5px solid #fecdd3', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={11} /> หาย {Math.round(m.lostRate * 100)}%
                      </span>
                    )}
                    {m.locked && <span style={{ background: '#fff1f2', color: '#be123c', border: '1.5px solid #fecdd3', borderRadius: 99, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>🔒 ล็อค</span>}
                  </div>

                  {/* Grand total */}
                  <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>ยอดจ่ายสุทธิ</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#4338ca' }}>฿{m.grandTotal.toLocaleString()}</div>
                  </div>
                  <div style={{ color: '#c7d2fe' }}>{isExp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                </div>

                {/* Expanded */}
                {isExp && (
                  <div style={{ borderTop: '1.5px solid #f0f4ff' }}>
                    {/* Breakdown cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 12, padding: '16px 20px', borderBottom: '1px solid #f0f4ff' }}>
                      {[
                        { l: '📦 ออเดอร์รวม',       v: `${m.orderTotal} บ้าน`,              c: '#0284c7', bg: '#f0f9ff', b: '#bae6fd' },
                        { l: '💰 ค่าคอมตั้งต้น',   v: `฿${m.totalGross.toLocaleString()}`, c: '#4338ca', bg: '#eef2ff', b: '#c7d2fe' },
                        { l: '❓ หักออเดอร์หาย',   v: `−฿${m.totalLost.toFixed(2)}`,       c: '#b45309', bg: '#fffbeb', b: '#fde68a', sub: `${m.lostOrdersTotal} บ้าน` },
                        { l: '❌ หักยกเลิก',         v: `−฿${m.totalCancel.toFixed(2)}`,     c: '#be123c', bg: '#fff1f2', b: '#fecdd3' },
                        { l: '🏠 เงินเดือนฐาน',     v: `฿${m.baseSalary.toLocaleString()}`, c: '#7c3aed', bg: '#f5f3ff', b: '#ddd6fe' },
                        { l: '💵 ยอดจ่ายสุทธิ',    v: `฿${m.grandTotal.toLocaleString()}`, c: '#059669', bg: '#f0fdf4', b: '#bbf7d0', big: true },
                      ].map((d, i) => (
                        <div key={i} style={{ background: d.bg, border: `1.5px solid ${d.b}`, borderRadius: 12, padding: '12px 14px' }}>
                          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 5 }}>{d.l}</div>
                          <div style={{ fontSize: d.big ? 18 : 15, fontWeight: 900, color: d.c }}>{d.v}</div>
                          {d.sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{d.sub}</div>}
                        </div>
                      ))}
                    </div>
                    {/* Daily breakdown table */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                        <thead>
                          <tr style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom: '1.5px solid #e0e7ff' }}>
                            {['วันที่','มือ','AI','รวม','Backend','หาย','−฿หาย','−฿ยกเลิก','รายวัน','เกิน','สุทธิ'].map((h, i) => (
                              <th key={i} style={{ padding: '9px 11px', textAlign: i >= 3 ? 'center' : 'left', fontSize: 10.5, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {m.days.map(d => (
                            <tr key={d.date} style={{ borderBottom: '1px solid #f0f4ff', background: d.lostOrders > 0 ? '#fffafb' : 'transparent' }}>
                              <td style={{ padding: '8px 11px', fontSize: 12.5, color: '#6b7280' }}>{d.date}</td>
                              <td style={{ textAlign: 'center', fontSize: 13, color: '#6d28d9', fontWeight: 700 }}>{d.totalManual}</td>
                              <td style={{ textAlign: 'center', fontSize: 13, color: '#0f766e', fontWeight: 700 }}>{d.totalAI}</td>
                              <td style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#1e1b4b' }}>{d.totalAdminOrders}</td>
                              <td style={{ textAlign: 'center', fontSize: 13 }}>
                                {d.hasBackend
                                  ? <span style={{ color: d.lostOrders > 0 ? '#be123c' : '#059669', fontWeight: 700 }}>{d.backendTotal}</span>
                                  : <span style={{ color: '#d1d5db' }}>—</span>}
                              </td>
                              <td style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: d.lostOrders > 0 ? '#be123c' : '#d1d5db' }}>{d.lostOrders || '—'}</td>
                              <td style={{ textAlign: 'center', fontSize: 12, color: d.lostDeduction > 0 ? '#be123c' : '#d1d5db', fontWeight: 700 }}>
                                {d.lostDeduction > 0 ? `−฿${d.lostDeduction.toFixed(2)}` : '—'}
                              </td>
                              <td style={{ textAlign: 'center', fontSize: 12, color: d.cancelDeduction > 0 ? '#be123c' : '#d1d5db', fontWeight: 700 }}>
                                {d.cancelDeduction > 0 ? `−฿${d.cancelDeduction.toFixed(2)}` : '—'}
                              </td>
                              <td style={{ textAlign: 'center', fontSize: 12, color: '#7c3aed', fontWeight: 700 }}>
                                {d.dailySalary > 0 ? `฿${d.dailySalary}` : '—'}
                              </td>
                              <td style={{ textAlign: 'center', fontSize: 12, color: '#059669', fontWeight: 700 }}>
                                {d.overCommission > 0 ? `฿${d.overCommission.toFixed(2)}` : '—'}
                              </td>
                              <td style={{ textAlign: 'center', padding: '8px 11px', fontSize: 14, fontWeight: 900, color: '#4338ca' }}>
                                ฿{d.finalNet.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderTop: '1.5px solid #c7d2fe' }}>
                            <td colSpan={3} style={{ padding: '9px 11px', fontSize: 12, fontWeight: 800, color: '#4338ca' }}>รวม {m.days.length} วัน</td>
                            <td style={{ textAlign: 'center', fontWeight: 900, color: '#1e1b4b', fontSize: 13 }}>{m.orderTotal}</td>
                            <td />
                            <td style={{ textAlign: 'center', fontWeight: 800, color: '#be123c', fontSize: 13 }}>{m.lostOrdersTotal || '—'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 800, color: '#be123c', fontSize: 13 }}>−฿{m.totalLost.toFixed(0)}</td>
                            <td style={{ textAlign: 'center', fontWeight: 800, color: '#be123c', fontSize: 13 }}>−฿{m.totalCancel.toFixed(0)}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: '#7c3aed', fontSize: 13 }}>{m.totalDailySalary > 0 ? `฿${m.totalDailySalary}` : '—'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: '#059669', fontSize: 13 }}>{m.totalOver > 0 ? `฿${m.totalOver.toFixed(0)}` : '—'}</td>
                            <td style={{ textAlign: 'center', padding: '9px 11px', fontSize: 16, fontWeight: 900, color: '#4338ca' }}>฿{m.totalNet.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══════ TAB: DAILY ══════ */}
      {tab === 'daily' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#fff', border: '1.5px solid #e0e7ff', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 11.5, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '.06em' }}>📅 เลือกวัน</label>
            <input type="date" style={{ ...S, width: 'auto' }} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            <span style={{ fontSize: 13, color: '#6b7280' }}>{format(parseISO(selectedDate), 'EEEE d MMMM yyyy', { locale: th })}</span>
          </div>

          {todayPayrolls.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 12 }}>
              {[
                { e: '💰', l: 'รวมทั้งทีม',  v: `฿${todayPayrolls.reduce((a,d)=>a+d.finalNet,0).toFixed(2)}`,    bg:'linear-gradient(135deg,#eef2ff,#e0e7ff)', c:'#4338ca', b:'#c7d2fe' },
                { e: '📦', l: 'ออเดอร์รวม', v: `${todayPayrolls.reduce((a,d)=>a+d.totalAdminOrders,0)} บ้าน`,   bg:'linear-gradient(135deg,#f0f9ff,#e0f2fe)', c:'#0284c7', b:'#bae6fd' },
                { e: '❓', l: 'หายรวม',      v: `${todayPayrolls.reduce((a,d)=>a+d.lostOrders,0)} บ้าน`,         bg:'linear-gradient(135deg,#fffbeb,#fef3c7)', c:'#b45309', b:'#fde68a' },
                { e: '👥', l: 'แอดมิน',      v: `${todayPayrolls.length} คน`,                                   bg:'linear-gradient(135deg,#f5f3ff,#ede9fe)', c:'#7c3aed', b:'#ddd6fe' },
              ].map((k, i) => (
                <div key={i} style={{ background: k.bg, border: `1.5px solid ${k.b}`, borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{k.e}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: k.c }}>{k.v}</div>
                  <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 4, fontWeight: 600 }}>{k.l}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: '#fff', border: '1.5px solid #e0e7ff', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom: '2px solid #e0e7ff' }}>
                    {['#','👤 แอดมิน','📦 ออเดอร์','🖥️ Backend','❓ หาย','−฿หาย','−฿ยกเลิก','💵 รายวัน','⚡ เกิน','💎 สุทธิ'].map((h, i) => (
                      <th key={i} style={{ padding: '10px 12px', textAlign: i >= 2 ? 'center' : 'left', fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todayPayrolls.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 36, color: '#9ca3af' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
                      <div>ไม่มีข้อมูลวันที่เลือก</div>
                    </td></tr>
                  ) : todayPayrolls.map((d, i) => (
                    <tr key={d.adminId} style={{ borderBottom: '1px solid #f0f4ff', background: d.lostOrders > 0 ? '#fffafb' : 'transparent' }}>
                      <td style={{ padding: '11px 12px', color: '#9ca3af', fontSize: 13 }}>{i + 1}</td>
                      <td style={{ padding: '11px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                            {(d.adminName || '?').slice(0, 2)}
                          </div>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1e1b4b' }}>{d.adminName}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#1e1b4b' }}>{d.totalAdminOrders}</td>
                      <td style={{ textAlign: 'center', fontSize: 14 }}>
                        {d.hasBackend ? <span style={{ color: d.lostOrders > 0 ? '#be123c' : '#059669', fontWeight: 800 }}>{d.backendTotal}</span> : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 14, fontWeight: 800, color: d.lostOrders > 0 ? '#be123c' : '#d1d5db' }}>{d.lostOrders || '—'}</td>
                      <td style={{ textAlign: 'center', fontSize: 13, color: d.lostDeduction > 0 ? '#be123c' : '#d1d5db', fontWeight: 700 }}>{d.lostDeduction > 0 ? `−฿${d.lostDeduction.toFixed(2)}` : '—'}</td>
                      <td style={{ textAlign: 'center', fontSize: 13, color: d.cancelDeduction > 0 ? '#be123c' : '#d1d5db', fontWeight: 700 }}>{d.cancelDeduction > 0 ? `−฿${d.cancelDeduction.toFixed(2)}` : '—'}</td>
                      <td style={{ textAlign: 'center', fontSize: 13, color: '#7c3aed', fontWeight: 700 }}>{d.dailySalary > 0 ? `฿${d.dailySalary}` : '—'}</td>
                      <td style={{ textAlign: 'center', fontSize: 13, color: '#059669', fontWeight: 700 }}>{d.overCommission > 0 ? `฿${d.overCommission.toFixed(2)}` : '—'}</td>
                      <td style={{ textAlign: 'center', padding: '11px 12px', fontSize: 17, fontWeight: 900, color: '#4338ca' }}>฿{d.finalNet.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════ TAB: COMPARE ══════ */}
      {tab === 'compare' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 14, padding: '12px 18px', fontSize: 13.5, color: '#92400e', fontWeight: 600, display: 'flex', gap: 8 }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            เปรียบเทียบออเดอร์แอดมิน vs ข้อมูลจริงหลังบ้าน · เดือน {format(parseISO(month + '-01'), 'MMMM yyyy', { locale: th })} · {compareData.filter(r => r.diff > 0).length} รายการที่มีความต่าง
          </div>
          <div style={{ background: '#fff', border: '1.5px solid #e0e7ff', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom: '2px solid #e0e7ff' }}>
                    {['วันที่','แอดมิน','เพจ','แอดมินลง','Backend','ผลต่าง','สถานะ'].map((h, i) => (
                      <th key={i} style={{ padding: '10px 12px', textAlign: i >= 3 ? 'center' : 'left', fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareData.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>ไม่มีข้อมูลเปรียบเทียบ</td></tr>
                  ) : compareData.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f4ff', background: r.diff > 0 ? '#fffafb' : r.diff < 0 ? '#f0fdf4' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12.5, color: '#6b7280' }}>{r.date}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13.5, fontWeight: 600, color: '#1e1b4b' }}>{r.adminName}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#4b5563', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pageId}</td>
                      <td style={{ textAlign: 'center', fontSize: 15, fontWeight: 800, color: '#4338ca' }}>{r.adminOrders}</td>
                      <td style={{ textAlign: 'center', fontSize: 15 }}>
                        {r.backendOrds !== null
                          ? <span style={{ color: r.diff > 0 ? '#be123c' : '#059669', fontWeight: 800 }}>{r.backendOrds}</span>
                          : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                        {r.diff === null ? <span style={{ color: '#d1d5db' }}>—</span>
                          : r.diff === 0 ? <span style={{ color: '#059669', fontWeight: 800 }}>✅ ตรงกัน</span>
                          : r.diff > 0 ? <span style={{ color: '#be123c', fontWeight: 800, background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 99, padding: '2px 9px', fontSize: 13 }}>−{r.diff} หาย</span>
                          : <span style={{ color: '#059669', fontWeight: 800, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 99, padding: '2px 9px', fontSize: 13 }}>+{Math.abs(r.diff)} เกิน</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {r.diff === null ? <span style={{ color: '#9ca3af', fontSize: 12 }}>ไม่มีหลังบ้าน</span>
                          : r.diff === 0 ? null
                          : r.diff > 0 ? <span style={{ background: '#fff1f2', color: '#be123c', border: '1.5px solid #fecdd3', borderRadius: 99, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>⚠️ ออเดอร์หาย</span>
                          : <span style={{ background: '#f0fdf4', color: '#059669', border: '1.5px solid #bbf7d0', borderRadius: 99, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>✅ เกิน</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════ TAB: SETTINGS ══════ */}
      {tab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Alert threshold */}
          <div style={{ background: '#fff', border: '1.5px solid #e0e7ff', borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#1e1b4b', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} style={{ color: '#d97706' }} /> เกณฑ์แจ้งเตือนออเดอร์หาย
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>แจ้งเตือนเมื่อหายเกิน (%)</label>
                <input type="number" min="1" max="100" style={{ ...S, width: 100, textAlign: 'center', fontSize: 18, fontWeight: 800, color: '#b45309' }}
                  value={Math.round(lostThreshold * 100)} onChange={e => setLostThreshold((parseInt(e.target.value) || 10) / 100)} />
              </div>
              <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: '12px 16px', fontSize: 13.5, color: '#92400e' }}>
                แจ้งเตือนถ้าออเดอร์หาย &gt; <strong>{Math.round(lostThreshold * 100)}%</strong>
              </div>
            </div>
          </div>

          {/* Absence penalty */}
          <div style={{ background: '#fff', border: '1.5px solid #e0e7ff', borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#1e1b4b', marginBottom: 14 }}>📅 ค่าปรับขาดงาน (฿ / วัน)</div>
            <input type="number" min="0" style={{ ...S, width: 160, textAlign: 'center', fontSize: 18, fontWeight: 800, color: '#be123c' }}
              value={absencePenalty} onChange={e => setAbsencePenalty(parseFloat(e.target.value) || 0)} />
          </div>

          {/* Base salary */}
          {isSuperAdmin && (
            <div style={{ background: '#fff', border: '1.5px solid #e0e7ff', borderRadius: 16, padding: 22 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#1e1b4b', marginBottom: 14 }}>🏠 เงินเดือนฐานรายคน</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {admins.map(u => {
                  const current = Array.isArray(salaryConfigs) ? (salaryConfigs.find(s => s.userId === u.id)?.baseSalary || 0) : 0
                  return (
                    <SalaryRow key={u.id} user={u} current={current} S={S} onSave={handleSaveSalary} />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lock confirm modal */}
      {showLockConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(99,102,241,.25)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 30, maxWidth: 420, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,.15)', border: '1.5px solid #fecdd3', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 19, fontWeight: 900, color: '#1e1b4b', marginBottom: 8 }}>ล็อคเงินเดือนเดือนนี้?</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 14, lineHeight: 1.7 }}>
              เมื่อล็อคแล้ว <strong style={{ color: '#be123c' }}>ไม่สามารถแก้ไขได้</strong><br />
              เดือน <strong>{format(parseISO(month + '-01'), 'MMMM yyyy', { locale: th })}</strong>
            </div>
            <div style={{ background: '#eef2ff', border: '1.5px solid #c7d2fe', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13.5, color: '#4338ca' }}>
              💰 ยอดจ่ายรวม <strong>฿{grand.pay.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setShowLockConfirm(false)} style={{ background: '#f1f5f9', border: '1.5px solid #dde3f5', borderRadius: 10, padding: '10px 22px', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#6b7280', fontFamily: 'inherit' }}>ยกเลิก</button>
              <button onClick={handleLock} disabled={saving}
                style={{ background: 'linear-gradient(135deg,#e11d48,#f43f5e)', border: 'none', borderRadius: 10, padding: '10px 24px', cursor: 'pointer', fontSize: 14, fontWeight: 900, color: '#fff', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(225,29,72,.35)' }}>
                {saving ? '⏳ กำลังล็อค...' : '🔒 ยืนยันล็อค'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────
function Pill({ e, l, v, c, bg, b }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${b}`, borderRadius: 99, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 12 }}>{e}</span>
      <span style={{ fontSize: 11.5, color: '#6b7280' }}>{l}:</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: c }}>{v}</span>
    </div>
  )
}

function SalaryRow({ user, current, S, onSave }) {
  const [editing, setEditing] = React.useState(false)
  const [val, setVal] = React.useState(current)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: '#fafbff', border: '1.5px solid #e0e7ff', borderRadius: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#7c3aed)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
        {(user.avatar || user.name || '?').slice(0, 2)}
      </div>
      <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#1e1b4b' }}>{user.name}</div>
      {editing ? (
        <>
          <input type="number" min="0" style={{ ...S, width: 130, textAlign: 'center', fontWeight: 800, color: '#7c3aed' }}
            value={val} onChange={e => setVal(e.target.value)} />
          <button onClick={() => { onSave(user.id, val); setEditing(false) }}
            style={{ background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'inherit' }}>
            ✅ บันทึก
          </button>
          <button onClick={() => { setVal(current); setEditing(false) }}
            style={{ background: '#f1f5f9', border: '1.5px solid #dde3f5', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#6b7280', fontFamily: 'inherit' }}>
            ยกเลิก
          </button>
        </>
      ) : (
        <>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#7c3aed' }}>฿{(current || 0).toLocaleString()}</span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>/ เดือน</span>
          <button onClick={() => setEditing(true)}
            style={{ background: '#eef2ff', border: '1.5px solid #c7d2fe', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#4338ca', fontFamily: 'inherit' }}>
            ✏️ แก้ไข
          </button>
        </>
      )}
    </div>
  )
}
