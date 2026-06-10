import React, { useState, useMemo } from 'react'
import { format, addDays, subDays, parseISO, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isToday as dfIsToday } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { Modal, Confirm, Empty, Alert, FormGroup, Select } from '../../components/ui'
import { useNotify } from '../../hooks/useNotify'
import {

  Plus, Edit2, Trash2, Check, X, Star, TestTube,
  Moon, Sun, ChevronLeft, ChevronRight, Users, BookOpen, Calendar, Bell, Power,
} from 'lucide-react'

// ── ช่องทาง + SVG Icon ───────────────────────────────
const CHANNELS = {
  facebook: {
    label:'Facebook', color:'#1877F2', bg:'#E7F0FF', border:'#B3CFFF',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
  },
  line: {
    label:'LINE', color:'#06C755', bg:'#E6FFF0', border:'#A3E8BC',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386a.631.631 0 0 1-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016a.631.631 0 0 1-.627.629.614.614 0 0 1-.49-.247l-2.38-3.239v2.857c0 .346-.283.629-.631.629a.631.631 0 0 1-.627-.629V8.108c0-.345.282-.63.63-.63.172 0 .333.074.451.203l2.39 3.252V8.108c0-.345.282-.63.63-.63.346 0 .626.285.626.63v4.771zm-5.741 0a.63.63 0 0 1-.627.629.631.631 0 0 1-.63-.629V8.108c0-.345.283-.63.63-.63a.63.63 0 0 1 .627.63v4.771zm-2.466.629H4.917a.631.631 0 0 1-.63-.629V8.108c0-.345.283-.63.63-.63.346 0 .627.285.627.63v4.141h1.885c.348 0 .63.283.63.629 0 .346-.282.63-.63.63M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
  },
  instagram: {
    label:'Instagram', color:'#E1306C', bg:'#FFE8F0', border:'#F4B3CB',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>
  },
  tiktok: {
    label:'TikTok', color:'#010101', bg:'#F2F2F2', border:'#CCCCCC',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.31 6.31 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.82a8.16 8.16 0 0 0 4.77 1.52V6.89a4.85 4.85 0 0 1-1-.2z"/></svg>
  },
  website: {
    label:'เว็บไซต์', color:'#6366F1', bg:'#EEEEFF', border:'#C7C9FA',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  },
  other: {
    label:'อื่นๆ', color:'#6B7280', bg:'#F3F4F6', border:'#D1D5DB',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  },
}

// Helper: render channel badge
const ChannelBadge = ({channel, channelNote, size='sm'}) => {
  const ch = CHANNELS[channel]
  if (!ch) return null
  const fs = size==='sm' ? 11 : 13
  const pad = size==='sm' ? '2px 8px' : '4px 12px'
  const displayLabel = channel === 'other' && channelNote ? channelNote : ch.label
  return (
    <span style={{ background:ch.bg, color:ch.color, border:`1px solid ${ch.border}`, borderRadius:99, padding:pad, fontSize:fs, fontWeight:700, display:'inline-flex', alignItems:'center', gap:4 }}>
      <span style={{ color:ch.color, display:'flex', alignItems:'center' }}>{ch.icon}</span>
      {displayLabel}
    </span>
  )
}


const todayStr = format(new Date(), 'yyyy-MM-dd')

const S = {
  width:'100%', background:'#fff', border:'1.5px solid #dde3f5',
  borderRadius:10, color:'#1e1b4b', fontFamily:'inherit',
  fontSize:14, padding:'9px 12px', outline:'none',
}

export default function PagesManagement() {
  const { profile, canManage, isSuperAdmin } = useAuth()
  const { pages, users, nightDuty, createPage, editPage, removePage, saveNightDuty } = useData()
  const { notifyPage, notifyCustom, notifyDutyAssigned, notifyWeekDuty } = useNotify()

  // ── ข้อมูลพื้นฐาน (ต้อง declare ก่อน canEditPage) ──
  const isAdmin = profile?.role === 'admin'
  const isHead  = ['head_admin','superadmin'].includes(profile?.role)
  const myUid   = profile?.id || user?.uid || ''

  // ── สิทธิ์แก้ไขเพจ ────────────────────────────────
  const canEditPage   = (page) => canManage || (isAdmin && page.assignedTo?.includes(myUid))
  const canDeletePage = (page) => isSuperAdmin || (isAdmin && page.assignedTo?.includes(myUid))
  const canAssign     = () => canManage

  const [tab,        setTab]        = useState('duty')   // 'duty' | 'pages'
  const [dutyDate,   setDutyDate]   = useState(todayStr)
  const [modal,      setModal]      = useState(null)
  const [current,    setCurrent]    = useState(null)
  const [confirm,    setConfirm]    = useState(null)
  const [assign,     setAssign]     = useState(null)     // page for assign modal
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')
  const [dutyEdit,   setDutyEdit]   = useState(false)
  const [weekView,   setWeekView]   = useState(false)  // toggle week planning view
  const [weekStart,  setWeekStart]  = useState(() => format(startOfWeek(new Date(),{weekStartsOn:1}),'yyyy-MM-dd'))
  const [weekDrafts, setWeekDrafts] = useState({})     // { 'yyyy-MM-dd': { adminId:[pageId,...] } }
  const [savingWeek, setSavingWeek] = useState(false)
  const [dutyDraft,  setDutyDraft]  = useState({})       // { adminId: [pageId,...] }
  const [alertCounts, setAlertCounts] = useState({})    // { pageId: count }

  const admins   = users.filter(u => ['admin','head_admin'].includes(u.role))
  const myPages  = isAdmin
    ? pages.filter(p => p.assignedTo?.includes(myUid) && p.status === 'active')
    : pages.filter(p => p.status === 'active')
  const testPages  = pages.filter(p => p.type === 'test'  && p.status === 'active')
  const mainPages  = pages.filter(p => p.type === 'main'  && p.status === 'active')

  // ── night duty for selected date ──────────────────────
  const dutyRecord = useMemo(() =>
    nightDuty.find(d => d.date === dutyDate),
    [nightDuty, dutyDate]
  )
  const dutyAssignments = dutyRecord?.assignments || []

  // my duty tonight
  const myDuty = dutyAssignments.find(a => a.adminId === myUid)
  const myDutyPages = (myDuty?.pageIds || [])
    .map(id => pages.find(p => p.id === id)).filter(Boolean)

  // init draft when entering edit mode
  const startDutyEdit = () => {
    const draft = {}
    admins.forEach(u => {
      const existing = dutyAssignments.find(a => a.adminId === u.id)
      draft[u.id] = existing?.pageIds || []
    })
    setDutyDraft(draft)
    setDutyEdit(true)
  }

  const toggleDutyPage = (adminId, pageId) => {
    setDutyDraft(prev => {
      const cur = prev[adminId] || []
      return {
        ...prev,
        [adminId]: cur.includes(pageId)
          ? cur.filter(id => id !== pageId)
          : [...cur, pageId],
      }
    })
  }

  const saveDuty = async () => {
    setSaving(true)
    try {
      const assignments = Object.entries(dutyDraft)
        .map(([adminId, pageIds]) => ({ adminId, pageIds }))
        .filter(a => a.pageIds.length > 0)
      await saveNightDuty(dutyDate, assignments)

      // แจ้งเฉพาะแอดมินที่ได้รับมอบหมาย
      const dateLabel   = format(parseISO(dutyDate), 'EEEE d MMM', { locale: th })
      const assignedIds = assignments.map(a => a.adminId)
      const pageNameStr = assignments
        .flatMap(a => a.pageIds.map(pid => pages.find(p=>p.id===pid)?.name||pid))
        .filter((v,i,arr) => arr.indexOf(v)===i)
        .join(', ')
      notifyDutyAssigned(assignedIds, dateLabel, pageNameStr || 'เพจทดสอบ')
      setDutyEdit(false)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  // ── Page CRUD ──────────────────────────────────────────
  const openAdd  = () => { setCurrent({ name:'', type:'test', channel:'facebook', channelNote:'', status:'active', note:'' }); setModal('add'); setErr('') }
  const openEdit = (p) => { setCurrent({...p}); setModal('edit'); setErr('') }
  const close    = () => { setModal(null); setCurrent(null); setErr('') }
  const set      = k => e => setCurrent(p => ({...p, [k]: e.target.value}))

  const handleSave = async () => {
    if (!current.name?.trim()) { setErr('กรุณากรอกชื่อเพจ'); return }
    setSaving(true); setErr('')
    try {
      if (modal === 'edit') {
        await editPage(current.id, current)
        notifyPage('edit', current.name)
      } else {
        // admin เพิ่มเพจ → มอบหมายตัวเองอัตโนมัติ
        const assignedTo = isAdmin ? [myUid] : []
        await createPage({ ...current, assignedTo })
        notifyPage('add', current.name)
      }
      close()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const handleAssignSave = async (pageId, adminIds) => {
    const pg = pages.find(p => p.id === pageId)
    await editPage(pageId, { assignedTo: adminIds })
    notifyPage('assign', pg?.name || '')
  }

  const dateLabel = format(parseISO(dutyDate), 'EEEE d MMMM yyyy', { locale: th })

  // ── Week planning ─────────────────────────────────
  const weekDays = useMemo(() => {
    const start = parseISO(weekStart)
    const end   = endOfWeek(start, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'))
  }, [weekStart])

  const prevWeek = () => setWeekStart(format(subDays(parseISO(weekStart), 7), 'yyyy-MM-dd'))
  const nextWeek = () => setWeekStart(format(addDays(parseISO(weekStart), 7), 'yyyy-MM-dd'))

  const initWeekDrafts = () => {
    const drafts = {}
    weekDays.forEach(date => {
      const existing = nightDuty.find(d => d.date === date)
      if (existing?.assignments) {
        const obj = {}
        existing.assignments.forEach(a => { obj[a.adminId] = a.pageIds || [] })
        drafts[date] = obj
      } else {
        drafts[date] = {}
      }
    })
    setWeekDrafts(drafts)
  }

  const toggleWeekPage = (date, adminId, pageId) => {
    setWeekDrafts(prev => {
      const day     = { ...(prev[date] || {}) }
      const current = day[adminId] || []
      day[adminId]  = current.includes(pageId)
        ? current.filter(id => id !== pageId)
        : [...current, pageId]
      return { ...prev, [date]: day }
    })
  }

  const saveWeekDuty = async () => {
    setSavingWeek(true)
    try {
      for (const date of weekDays) {
        const draft = weekDrafts[date] || {}
        const assignments = Object.entries(draft)
          .filter(([,pages]) => pages.length > 0)
          .map(([adminId, pageIds]) => ({ adminId, pageIds }))
        await saveNightDuty(date, assignments)
      }
      const weekLabel = format(parseISO(weekStart), 'd MMM', { locale: th }) + ' – ' + format(parseISO(weekDays[6]), 'd MMM yyyy', { locale: th })
      // แจ้งแอดมินทุกคนที่ได้รับมอบหมายตลอดทั้งสัปดาห์
      const allAssignedIds = [...new Set(
        weekDays.flatMap(date =>
          Object.keys(weekDrafts[date] || {})
            .filter(uid => (weekDrafts[date][uid]||[]).length > 0)
        )
      )]
      notifyWeekDuty(allAssignedIds, weekLabel)
      setWeekView(false)
    } catch(e) { console.error(e) } finally { setSavingWeek(false) }
  }
  const isToday   = dutyDate === todayStr
  const isTomorrow = dutyDate === format(addDays(new Date(), 1), 'yyyy-MM-dd')

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:900, color:'#1e1b4b', marginBottom:3 }}>📄 ระบบเพจ</h2>
          <p style={{ fontSize:12.5, color:'#6b7280' }}>
            จัดการเพจ · มอบหมาย · จัดเวรเฝ้าเพจทดสอบรายคืน
          </p>
        </div>
        {/* admin สามารถเพิ่มเพจได้ด้วย */}
        {(canManage || isAdmin) && (
          <button onClick={openAdd} className="btn btn-primary"><Plus size={15}/> เพิ่มเพจ</button>
        )}
      </div>

      {/* แบนเนอร์แจ้งสิทธิ์สำหรับ admin */}
      {isAdmin && myPages.length > 0 && (
        <div style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', border:'1.5px solid #c4b5fd', borderRadius:13, padding:'11px 18px', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>🛡️</span>
          <span style={{ fontSize:13.5, color:'#6d28d9', fontWeight:600 }}>
            คุณสามารถ <strong>เพิ่ม แก้ไข และลบ</strong> เพจที่คุณรับผิดชอบได้ — การเปลี่ยนแปลงจะแสดงต่อทุกคนทันที
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:12, padding:4, width:'fit-content', gap:3 }}>
        {[
          { k:'duty',  label:'🌙 เวรเฝ้าเพจ', show: true },
          { k:'pages', label:'📄 จัดการเพจ',  show: true },
        ].filter(t=>t.show).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding:'8px 18px', borderRadius:9, border:'none', cursor:'pointer', fontSize:13.5, fontWeight:700, fontFamily:'inherit',
              background: tab===t.k ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : 'transparent',
              color: tab===t.k ? '#fff' : '#6366f1',
              boxShadow: tab===t.k ? '0 4px 12px rgba(99,102,241,.3)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════ TAB: NIGHT DUTY ═══════════ */}
      {tab === 'duty' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Date navigator */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <button onClick={() => setDutyDate(format(subDays(parseISO(dutyDate),1),'yyyy-MM-dd'))}
                style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6366f1' }}>
                <ChevronLeft size={16}/>
              </button>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontWeight:900, fontSize:16, color:'#1e1b4b' }}>
                  🌙 {isToday ? 'คืนนี้' : isTomorrow ? 'พรุ่งนี้คืน' : dateLabel}
                </div>
                <div style={{ fontSize:12, color:'#9ca3af', marginTop:1 }}>{dateLabel}</div>
              </div>
              <button onClick={() => setDutyDate(format(addDays(parseISO(dutyDate),1),'yyyy-MM-dd'))}
                style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6366f1' }}>
                <ChevronRight size={16}/>
              </button>
              <input type="date" style={{ ...S, width:'auto', fontSize:13 }}
                value={dutyDate} onChange={e => setDutyDate(e.target.value)}/>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {isHead && !dutyEdit && (
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => { setWeekView(true); initWeekDrafts() }}
                    style={{ background:'linear-gradient(135deg,#0f766e,#0d9488)', border:'none', borderRadius:10, padding:'9px 16px', cursor:'pointer', fontSize:13, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                    <Calendar size={14}/> จัดเวรทั้งอาทิตย์
                  </button>
                  <button onClick={startDutyEdit}
                    style={{ background:'linear-gradient(135deg,#7c3aed,#6d28d9)', border:'none', borderRadius:10, padding:'9px 18px', cursor:'pointer', fontSize:13.5, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                    <Moon size={15}/> จัดเวรคืนนี้
                  </button>
                </div>
              )}
              {isHead && dutyEdit && (
                <>
                  <button onClick={() => setDutyEdit(false)}
                    style={{ background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:'9px 16px', cursor:'pointer', fontSize:13.5, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>
                    ยกเลิก
                  </button>
                  <button onClick={saveDuty} disabled={saving}
                    style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontSize:13.5, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                    <Check size={15}/> {saving ? 'กำลังบันทึก...' : 'บันทึกเวร'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── My duty banner (admin) ── */}
          {isAdmin && (
            <div style={{
              background: myDutyPages.length > 0
                ? 'linear-gradient(135deg,#f5f3ff,#ede9fe)'
                : 'linear-gradient(135deg,#f9fafb,#f1f5f9)',
              border: myDutyPages.length > 0 ? '2px solid #c4b5fd' : '1.5px solid #e5e7eb',
              borderRadius:16, padding:20,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: myDutyPages.length > 0 ? 14 : 0 }}>
                <div style={{ fontSize:28 }}>{myDutyPages.length > 0 ? '🌙' : '😴'}</div>
                <div>
                  <div style={{ fontSize:16, fontWeight:900, color: myDutyPages.length > 0 ? '#6d28d9' : '#6b7280' }}>
                    {myDutyPages.length > 0 ? `คืนนี้คุณเฝ้า ${myDutyPages.length} เพจ` : 'คืนนี้ไม่มีเวรของคุณ'}
                  </div>
                  <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>{dateLabel}</div>
                </div>
              </div>
              {myDutyPages.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {myDutyPages.map(p => (
                    <div key={p.id} style={{
                      background:'linear-gradient(135deg,#7c3aed,#6d28d9)',
                      borderRadius:12, padding:'10px 16px',
                      display:'flex', alignItems:'center', gap:8,
                      boxShadow:'0 4px 14px rgba(124,58,237,.3)',
                    }}>
                      <span style={{ fontSize:18 }}>🧪</span>
                      <div>
                        <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{p.name}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,.7)' }}>เพจทดสอบ · {isToday ? 'คืนนี้' : dateLabel}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Edit mode: จัดเวร (head only) ── */}
          {isHead && dutyEdit && (
            <div style={{ background:'#fff', border:'2px solid #7c3aed', borderRadius:18, padding:22, boxShadow:'0 8px 32px rgba(124,58,237,.12)' }}>
              <div style={{ fontSize:15, fontWeight:900, color:'#6d28d9', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                <Moon size={17}/> จัดเวรเฝ้าเพจทดสอบ — {isToday ? 'คืนนี้' : dateLabel}
                <span style={{ fontSize:11, background:'#ede9fe', color:'#6d28d9', padding:'2px 8px', borderRadius:99, fontWeight:600 }}>
                  {testPages.length} เพจทดสอบ
                </span>
              </div>

              {testPages.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:'#9ca3af' }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🧪</div>
                  <div>ยังไม่มีเพจทดสอบ</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {admins.map(u => (
                    <div key={u.id} style={{ background:'#fafbff', border:'1.5px solid #e0e7ff', borderRadius:14, padding:16 }}>
                      {/* Admin header */}
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                        <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800 }}>
                          {(u.avatar||u.name||'?').slice(0,2)}
                        </div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:800, color:'#1e1b4b' }}>{u.name}</div>
                          <div style={{ fontSize:11, color:'#9ca3af' }}>{ROLES[u.role]}</div>
                        </div>
                        <div style={{ marginLeft:'auto', fontSize:12, color:'#7c3aed', fontWeight:700 }}>
                          {(dutyDraft[u.id]||[]).length} เพจ
                        </div>
                      </div>

                      {/* Page checkboxes */}
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                        {testPages.map(p => {
                          const selected = (dutyDraft[u.id]||[]).includes(p.id)
                          // check who else has this page
                          const otherHas = Object.entries(dutyDraft)
                            .filter(([aid]) => aid !== u.id)
                            .some(([, pids]) => pids.includes(p.id))
                          return (
                            <button key={p.id}
                              onClick={() => toggleDutyPage(u.id, p.id)}
                              style={{
                                display:'flex', alignItems:'center', gap:7,
                                padding:'8px 14px', borderRadius:10, cursor:'pointer',
                                border: selected ? '2px solid #7c3aed' : '1.5px solid #dde3f5',
                                background: selected ? 'linear-gradient(135deg,#ede9fe,#ddd6fe)' : '#fff',
                                fontFamily:'inherit', fontSize:13, fontWeight: selected ? 800 : 600,
                                color: selected ? '#6d28d9' : '#6b7280',
                                transition:'all .15s',
                                position:'relative',
                              }}>
                              <span style={{ fontSize:15 }}>🧪</span>
                              {p.name}
                              {selected && <Check size={13} style={{ color:'#7c3aed' }}/>}
                              {otherHas && selected && (
                                <span style={{ position:'absolute', top:-5, right:-5, background:'#f59e0b', color:'#fff', fontSize:9, fontWeight:900, borderRadius:99, padding:'1px 4px', border:'2px solid #fff' }}>2+</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── View mode: แสดงเวรที่จัดแล้ว ── */}
          {isHead && !dutyEdit && (
            <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
              <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', padding:'14px 20px', display:'flex', alignItems:'center', gap:8 }}>
                <Moon size={16} style={{ color:'#a5b4fc' }}/>
                <span style={{ fontSize:14, fontWeight:800, color:'#fff' }}>ตารางเวรเฝ้าเพจ — {isToday ? 'คืนนี้' : dateLabel}</span>
              </div>

              {dutyAssignments.length === 0 ? (
                <div style={{ textAlign:'center', padding:'36px 20px', color:'#9ca3af' }}>
                  <div style={{ fontSize:40, marginBottom:10 }}>🌙</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#6b7280', marginBottom:4 }}>ยังไม่ได้จัดเวร</div>
                  <div style={{ fontSize:12 }}>กด "จัดเวรคืนนี้" เพื่อมอบหมายเพจทดสอบ</div>
                </div>
              ) : (
                <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
                  {dutyAssignments.map(a => {
                    const admin = users.find(u => u.id === a.adminId)
                    const dutyPgs = (a.pageIds||[]).map(id => pages.find(p=>p.id===id)).filter(Boolean)
                    if (!admin || !dutyPgs.length) return null
                    return (
                      <div key={a.adminId} style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'14px 16px', background:'#fafbff', border:'1.5px solid #e0e7ff', borderRadius:14 }}>
                        <div style={{ width:42, height:42, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, flexShrink:0 }}>
                          {(admin.avatar||admin.name||'?').slice(0,2)}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:800, color:'#1e1b4b', marginBottom:8 }}>
                            {admin.name}
                            <span style={{ fontSize:11, color:'#9ca3af', fontWeight:400, marginLeft:8 }}>{ROLES[admin.role]}</span>
                          </div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                            {dutyPgs.map(p => (
                              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', border:'1.5px solid #ddd6fe', borderRadius:9, padding:'6px 12px' }}>
                                <span style={{ fontSize:14 }}>🧪</span>
                                <span style={{ fontSize:13, fontWeight:700, color:'#6d28d9' }}>{p.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div style={{ background:'#ede9fe', border:'1.5px solid #ddd6fe', borderRadius:9, padding:'4px 12px', fontSize:12, fontWeight:800, color:'#7c3aed', flexShrink:0 }}>
                          {dutyPgs.length} เพจ
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* All pages with duty status */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', padding:'12px 20px', borderBottom:'1.5px solid #e0e7ff', display:'flex', alignItems:'center', gap:8 }}>
              <BookOpen size={15} style={{ color:'#6366f1' }}/>
              <span style={{ fontSize:14, fontWeight:800, color:'#4338ca' }}>เพจทดสอบทั้งหมด</span>
              <span style={{ background:'#c7d2fe', color:'#4338ca', fontSize:11, fontWeight:800, padding:'2px 8px', borderRadius:99 }}>{testPages.length}</span>
            </div>
            {testPages.length === 0 ? (
              <div style={{ textAlign:'center', padding:'28px 20px', color:'#9ca3af' }}>
                <div style={{ fontSize:36, marginBottom:8 }}>🧪</div>
                <div>ยังไม่มีเพจทดสอบ</div>
              </div>
            ) : (
              <div style={{ padding:16, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:12 }}>
                {testPages.map(p => {
                  const guardAdmin = dutyAssignments
                    .filter(a => (a.pageIds||[]).includes(p.id))
                    .map(a => users.find(u => u.id === a.adminId)?.name || '?')
                  return (
                    <div key={p.id} style={{
                      background:'linear-gradient(135deg,#fafbff,#f5f3ff)',
                      border:`1.5px solid ${p.status==='active'?'#ddd6fe':'#e5e7eb'}`, borderRadius:14, padding:16,
                      opacity: p.status==='active' ? 1 : 0.65,
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <div style={{ fontSize:22 }}>🧪</div>
                        <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:800, color:'#1e1b4b' }}>{p.name}</div>
                          {p.channel && <ChannelBadge channel={p.channel} channelNote={p.channelNote} size='sm'/>}
                        </div>
                        {/* สถานะ + ปุ่มเปิด/ปิด */}
                        {canManage && (
                          <button onClick={async()=>{ await editPage(p.id,{...p,status:p.status==='active'?'inactive':'active'}) }}
                            title={p.status==='active'?'ปิดเพจ':'เปิดเพจ'}
                            style={{ background:p.status==='active'?'#f0fdf4':'#fff1f2', border:`1.5px solid ${p.status==='active'?'#bbf7d0':'#fecdd3'}`, borderRadius:8, width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:p.status==='active'?'#059669':'#be123c', flexShrink:0 }}>
                            <Power size={12}/>
                          </button>
                        )}
                      </div>

                      <div style={{ fontSize:12, color:'#9ca3af', marginBottom:6 }}>เฝ้าคืนนี้โดย</div>
                      {guardAdmin.length > 0 ? (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                          {guardAdmin.map((name,i) => (
                            <span key={i} style={{ background:'#ede9fe', color:'#6d28d9', border:'1.5px solid #ddd6fe', borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:700 }}>
                              🌙 {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ background:'#fff7ed', color:'#c2410c', border:'1.5px solid #fed7aa', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700, display:'inline-block', marginBottom:10 }}>
                          ⚠️ ยังไม่มีคนเฝ้า
                        </span>
                      )}

                      {/* ปุ่มแจ้งเตือน แชทค้าง */}
                      {canManage && (
                        <button onClick={async()=>{
                          const cnt = (alertCounts[p.id]||0) + 1
                          setAlertCounts(prev=>({...prev,[p.id]:cnt}))
                          // แจ้งเตือนคนที่เฝ้าคืนนี้ (dutyAssignments) + คนที่รับผิดชอบ (assignedTo)
                          const targets = new Set([
                            ...(p.assignedTo||[]),
                            ...dutyAssignments.filter(a=>(a.pageIds||[]).includes(p.id)).map(a=>a.adminId)
                          ])
                          if (targets.size === 0) {
                            // ถ้าไม่มีใคร แจ้งทุก admin
                            users.filter(u=>u.role==='admin'||u.role==='head_admin').forEach(u=>{
                              notifyCustom({ type:'alert', title:`🔔 มีแชทค้าง! — ${p.name}`, message:`ตรวจสอบแชทค้างด่วน (ครั้งที่ ${cnt})`, link:'/commission', targetUid:u.id })
                            })
                          } else {
                            targets.forEach(uid=>{
                              notifyCustom({ type:'alert', title:`🔔 มีแชทค้าง! — ${p.name}`, message:`ตรวจสอบแชทค้างด่วน (ครั้งที่ ${cnt})`, link:'/commission', targetUid:uid })
                            })
                          }
                        }}
                        style={{ width:'100%', background:'linear-gradient(135deg,#fffbeb,#fef3c7)', border:'1.5px solid #fde68a', borderRadius:9, padding:'7px 0', cursor:'pointer', fontSize:12, fontWeight:800, color:'#b45309', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                          <Bell size={12}/>
                          แจ้ง "มีแชทค้าง"
                          {alertCounts[p.id]>0 && (
                            <span style={{ background:'#ef4444', color:'#fff', borderRadius:99, padding:'0 6px', fontSize:10, fontWeight:900 }}>×{alertCounts[p.id]}</span>
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ TAB: MANAGE PAGES ═══════════ */}
      {tab === 'pages' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12 }}>
            {[
              { emoji:'📄', label:'เพจทั้งหมด', val:pages.length,      bg:'linear-gradient(135deg,#eef2ff,#e0e7ff)', color:'#4338ca', border:'#c7d2fe' },
              { emoji:'⭐', label:'เพจหลัก',    val:mainPages.length,   bg:'linear-gradient(135deg,#fffbeb,#fef3c7)', color:'#b45309', border:'#fde68a' },
              { emoji:'🧪', label:'เพจทดสอบ',   val:testPages.length,   bg:'linear-gradient(135deg,#f5f3ff,#ede9fe)', color:'#6d28d9', border:'#ddd6fe' },
              { emoji:'🔴', label:'ยังไม่มอบหมาย',val:pages.filter(p=>!p.assignedTo?.length).length, bg:'linear-gradient(135deg,#fff1f2,#ffe4e6)', color:'#be123c', border:'#fecdd3' },
            ].map((s,i)=>(
              <div key={i} style={{ background:s.bg, border:`1.5px solid ${s.border}`, borderRadius:14, padding:'14px 16px' }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{s.emoji}</div>
                <div style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:11.5, color:'#6b7280', marginTop:4, fontWeight:600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Page grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
            {pages.length===0 ? (
              <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, gridColumn:'1/-1' }}>
                <Empty title="ยังไม่มีเพจ" sub={canManage?'กด "เพิ่มเพจ" เพื่อเริ่มต้น':undefined}/>
              </div>
            ) : pages.map(p => {
              const isMain = p.type === 'main'
              const isMyPage = p.assignedTo?.includes(myUid)
              const assignedNames = (p.assignedTo||[]).map(id=>users.find(u=>u.id===id)?.name||'?')
              const tonightGuard = dutyAssignments
                .filter(a=>(a.pageIds||[]).includes(p.id))
                .map(a=>users.find(u=>u.id===a.adminId)?.name||'?')

              return (
                <div key={p.id} style={{
                  background:'#fff', borderRadius:16,
                  border: isMyPage ? '2px solid #6366f1' : '1.5px solid #e0e7ff',
                  borderTop: `4px solid ${isMain?'#f59e0b':'#7c3aed'}`,
                  padding:18, boxShadow:'0 2px 8px rgba(0,0,0,.04)',
                  display:'flex', flexDirection:'column', gap:10,
                }}>
                  {/* Top badges */}
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <span style={{ background:isMain?'#fffbeb':'#f5f3ff', color:isMain?'#b45309':'#6d28d9', border:`1.5px solid ${isMain?'#fde68a':'#ddd6fe'}`, borderRadius:99, padding:'3px 9px', fontSize:11.5, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                      {isMain?'⭐ เพจหลัก':'🧪 เพจทดสอบ'}
                    </span>
                    <span style={{ background:p.status==='active'?'#f0fdf4':'#f9fafb', color:p.status==='active'?'#059669':'#6b7280', border:`1.5px solid ${p.status==='active'?'#bbf7d0':'#e5e7eb'}`, borderRadius:99, padding:'3px 9px', fontSize:11.5, fontWeight:700 }}>
                      {p.status==='active'?'✅ ใช้งาน':'⏸ ปิด'}
                    </span>
                    {isMyPage && <span style={{ background:'#eef2ff', color:'#4338ca', border:'1.5px solid #c7d2fe', borderRadius:99, padding:'3px 9px', fontSize:11.5, fontWeight:700 }}>👤 ของฉัน</span>}
                  </div>

                  {/* Name */}
                  <div style={{ fontSize:16, fontWeight:900, color:'#1e1b4b' }}>{p.name}</div>

                  {/* Assigned */}
                  <div style={{ fontSize:12.5, color:'#6b7280' }}>
                    <span style={{ fontWeight:700 }}>👥 รับผิดชอบ: </span>
                    {assignedNames.length>0 ? assignedNames.join(', ') : <span style={{ color:'#ef4444' }}>ยังไม่มี</span>}
                  </div>

                  {/* Tonight guard */}
                  {!isMain && (
                    <div style={{ background: tonightGuard.length>0?'#f5f3ff':'#fff7ed', border:`1.5px solid ${tonightGuard.length>0?'#ddd6fe':'#fde68a'}`, borderRadius:10, padding:'8px 12px', fontSize:12.5 }}>
                      <span style={{ fontWeight:700, color: tonightGuard.length>0?'#7c3aed':'#b45309' }}>
                        🌙 คืนนี้: {tonightGuard.length>0 ? tonightGuard.join(', ') : 'ยังไม่มีคนเฝ้า'}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  {(canEditPage(p) || canAssign() || canManage) && (
                    <div style={{ display:'flex', flexDirection:'column', gap:7, paddingTop:6, borderTop:'1px solid #f0f4ff' }}>
                      <div style={{ display:'flex', gap:7 }}>
                        {canAssign() && (
                          <button onClick={() => setAssign(p)}
                            style={{ flex:1, background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:9, padding:'7px 0', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#4338ca', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                            <Users size={13}/> มอบหมาย
                          </button>
                        )}
                        {canEditPage(p) && (
                          <button onClick={() => openEdit(p)}
                            style={{ flex: canAssign() ? 'none' : 1, background:'#f0fdf4', border:'1.5px solid #bbf7d0', borderRadius:9, width: canAssign() ? 34 : 'auto', height:34, padding: canAssign() ? 0 : '0 14px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#059669', gap:5, fontSize:12.5, fontWeight:700, fontFamily:'inherit' }}>
                            <Edit2 size={13}/>{!canAssign() && ' แก้ไข'}
                          </button>
                        )}
                        {/* ปุ่มเปิด/ปิดเพจ */}
                        {canManage && (
                          <button onClick={async()=>{ await editPage(p.id,{...p,status:p.status==='active'?'inactive':'active'}) }}
                            title={p.status==='active'?'ปิดเพจ':'เปิดเพจ'}
                            style={{ background:p.status==='active'?'#fff1f2':'#f0fdf4', border:`1.5px solid ${p.status==='active'?'#fecdd3':'#bbf7d0'}`, borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:p.status==='active'?'#be123c':'#059669' }}>
                            <Power size={13}/>
                          </button>
                        )}
                        {canDeletePage(p) && (
                          <button onClick={() => setConfirm({id:p.id,name:p.name})}
                            style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#be123c' }}>
                            <Trash2 size={13}/>
                          </button>
                        )}
                      </div>

                      {/* ปุ่มแจ้งเตือน "มีแชทค้าง" — เฉพาะเพจทดสอบ + superadmin/assistant */}
                      {(isSuperAdmin || profile?.role==='assistant') && p.type==='test' && (p.assignedTo||[]).length > 0 && (
                        <button onClick={async () => {
                          const cnt = (alertCounts[p.id]||0) + 1
                          setAlertCounts(prev => ({...prev, [p.id]: cnt}))
                          const targets = (p.assignedTo||[])
                          // ส่งแจ้งเตือนแต่ละคนที่เฝ้าเพจ
                          targets.forEach(uid => {
                            notifyCustom({
                              type: 'alert',
                              title: `🔔 มีแชทค้าง! — ${p.name}`,
                              message: `ตรวจสอบแชทค้างด่วน (แจ้งเตือนครั้งที่ ${cnt})`,
                              link: '/commission',
                              targetUid: uid,
                            })
                          })
                        }}
                        style={{ width:'100%', background:'linear-gradient(135deg,#fffbeb,#fef3c7)', border:'1.5px solid #fde68a', borderRadius:9, padding:'8px 0', cursor:'pointer', fontSize:12.5, fontWeight:800, color:'#b45309', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                          <Bell size={13}/>
                          แจ้งเตือน "มีแชทค้าง"
                          {alertCounts[p.id] > 0 && (
                            <span style={{ background:'#ef4444', color:'#fff', borderRadius:99, padding:'0px 6px', fontSize:10.5, fontWeight:900 }}>
                              ×{alertCounts[p.id]}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {(modal==='add'||modal==='edit') && (
        <div style={{ position:'fixed', inset:0, background:'rgba(99,102,241,.2)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:20, padding:28, maxWidth:480, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,.15)', border:'1.5px solid #e0e7ff' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
              <div style={{ fontSize:18, fontWeight:900, color:'#1e1b4b' }}>{modal==='edit'?'✏️ แก้ไขเพจ':'📄 เพิ่มเพจใหม่'}</div>
              <button onClick={close} style={{ background:'#f1f5f9', border:'none', borderRadius:9, width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}><X size={15}/></button>
            </div>
            {err && <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:10, padding:'10px 14px', color:'#be123c', fontSize:13.5, marginBottom:14 }}>❌ {err}</div>}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>ชื่อเพจ *</label>
              <input className="input" placeholder="ชื่อเพจ..." value={current?.name||''} onChange={set('name')} autoFocus/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <div>
                <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>ประเภท</label>
                <select className="input" value={current?.type||'main'} onChange={set('type')}>
                  <option value="main">⭐ เพจหลัก</option>
                  <option value="test">🧪 เพจทดสอบ</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>สถานะ</label>
                <select className="input" value={current?.status||'active'} onChange={set('status')}>
                  <option value="active">✅ ใช้งาน</option>
                  <option value="inactive">⏸ ปิด</option>
                </select>
              </div>
            </div>
            {/* ── ช่องทาง ── */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>📣 ช่องทาง</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {Object.entries(CHANNELS).map(([v,ch]) => {
                  const sel = (current?.channel||'facebook') === v
                  return (
                    <button key={v} type="button"
                      onClick={()=>setCurrent(p=>({...p,channel:v}))}
                      style={{ background:sel?ch.color:ch.bg, border:`2px solid ${sel?ch.color:ch.border}`, borderRadius:10, padding:'9px 8px', cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:sel?800:600, color:sel?'#fff':ch.color, transition:'all .15s', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                      <span style={{ color:sel?'#fff':ch.color }}>{ch.icon}</span>
                      {ch.label}
                    </button>
                  )
                })}
              </div>
              {/* ระบุช่องทาง ถ้าเลือก "อื่นๆ" */}
              {(current?.channel === 'other' || (current?.channel && !CHANNELS[current.channel])) && (
                <div style={{ marginTop:8 }}>
                  <input
                    placeholder="ระบุช่องทาง เช่น Shopee, Lazada, Twitter..."
                    style={{ width:'100%', padding:'8px 12px', borderRadius:9, border:'1.5px solid #D1D5DB', background:'#F9FAFB', fontSize:13.5, color:'#374151', fontFamily:'inherit', boxSizing:'border-box' }}
                    value={current?.channelNote||''}
                    onChange={e=>setCurrent(p=>({...p,channelNote:e.target.value}))}
                  />
                </div>
              )}
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>หมายเหตุ</label>
              <input className="input" placeholder="หมายเหตุ..." value={current?.note||''} onChange={set('note')}/>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={close} style={{ background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:'9px 18px', fontSize:14, fontWeight:700, color:'#6b7280', cursor:'pointer', fontFamily:'inherit' }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:10, padding:'9px 22px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
                {saving?'กำลังบันทึก...':modal==='edit'?'✅ บันทึก':'➕ เพิ่มเพจ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Modal ── */}
      {assign && (
        <AssignModal page={assign} admins={admins} onClose={()=>setAssign(null)} onSave={handleAssignSave}/>
      )}

      {/* Confirm delete */}
      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(99,102,241,.2)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:20, padding:28, maxWidth:360, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,.15)' }}>
            <div style={{ fontSize:40, textAlign:'center', marginBottom:12 }}>🗑️</div>
            <div style={{ fontSize:17, fontWeight:900, textAlign:'center', marginBottom:20 }}>ลบเพจ "{confirm.name}"?</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setConfirm(null)} style={{ flex:1, background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:10, fontSize:14, fontWeight:700, color:'#6b7280', cursor:'pointer', fontFamily:'inherit' }}>ยกเลิก</button>
              <button onClick={async()=>{ await removePage(confirm.id); setConfirm(null) }} style={{ flex:1, background:'linear-gradient(135deg,#e11d48,#f43f5e)', border:'none', borderRadius:10, padding:10, fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>🗑️ ลบ</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Week Planning Modal ── */}
      {weekView && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.5)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:500, padding:'16px', overflowY:'auto' }}>
          <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:900, boxShadow:'0 24px 60px rgba(0,0,0,.2)', border:'1.5px solid #e0e7ff', marginTop:16 }}>

            {/* Header */}
            <div style={{ background:'linear-gradient(135deg,#0f766e,#0d9488)', borderRadius:'18px 18px 0 0', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:18, fontWeight:900, color:'#fff', display:'flex', alignItems:'center', gap:8 }}>
                  <Calendar size={18}/> จัดเวรประจำสัปดาห์
                </div>
                <div style={{ fontSize:12.5, color:'rgba(255,255,255,.7)', marginTop:3 }}>
                  {format(parseISO(weekStart),'d MMM',{locale:th})} – {format(parseISO(weekDays[6]||weekStart),'d MMM yyyy',{locale:th})}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button onClick={prevWeek}
                  style={{ background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.3)', borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
                  <ChevronLeft size={16}/>
                </button>
                <button onClick={nextWeek}
                  style={{ background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.3)', borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
                  <ChevronRight size={16}/>
                </button>
                <button onClick={() => setWeekView(false)}
                  style={{ background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
                  <X size={15}/>
                </button>
              </div>
            </div>

            {/* Week grid */}
            <div style={{ padding:20, overflowX:'auto' }}>
              <div style={{ display:'grid', gridTemplateColumns:`160px repeat(${weekDays.length},1fr)`, gap:8, minWidth:700 }}>

                {/* Header row: วันที่ */}
                <div style={{ padding:'8px 10px', fontSize:11.5, fontWeight:800, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.06em' }}>แอดมิน / เพจ</div>
                {weekDays.map(date => {
                  const isT = date === todayStr
                  const dayName = format(parseISO(date),'EEE',{locale:th})
                  const dayNum  = format(parseISO(date),'d',{locale:th})
                  const existing = nightDuty.find(d => d.date === date)
                  return (
                    <div key={date} style={{ textAlign:'center', padding:'8px 6px', background:isT?'linear-gradient(135deg,#eef2ff,#e0e7ff)':'#f8faff', borderRadius:10, border:`1.5px solid ${isT?'#6366f1':'#e0e7ff'}` }}>
                      <div style={{ fontSize:11.5, fontWeight:800, color:isT?'#4338ca':'#9ca3af', textTransform:'uppercase' }}>{dayName}</div>
                      <div style={{ fontSize:20, fontWeight:900, color:isT?'#4338ca':'#1e1b4b', marginTop:2 }}>{dayNum}</div>
                      {isT && <div style={{ fontSize:10, color:'#6366f1', fontWeight:700 }}>วันนี้</div>}
                      {existing?.assignments?.length > 0 && (
                        <div style={{ fontSize:10, color:'#059669', fontWeight:700, marginTop:2 }}>✅ จัดแล้ว</div>
                      )}
                    </div>
                  )
                })}

                {/* Admin rows */}
                {admins.map(u => (
                  <React.Fragment key={u.id}>
                    {/* Admin name column */}
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#fafbff', borderRadius:10, border:'1px solid #f0f4ff' }}>
                      <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>
                        {(u.name||'?').slice(0,2)}
                      </div>
                      <div style={{ fontSize:12.5, fontWeight:700, color:'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name}</div>
                    </div>

                    {/* Day cells */}
                    {weekDays.map(date => {
                      const assignedPages = (weekDrafts[date] || {})[u.id] || []
                      return (
                        <div key={date} style={{ background:'#f8faff', borderRadius:10, border:'1px solid #e0e7ff', padding:6, display:'flex', flexDirection:'column', gap:4, minHeight:60 }}>
                          {testPages.map(p => {
                            const sel = assignedPages.includes(p.id)
                            // check if another admin has this page on this date
                            const otherHas = Object.entries(weekDrafts[date]||{})
                              .some(([uid,pids]) => uid !== u.id && pids.includes(p.id))
                            return (
                              <button key={p.id}
                                onClick={() => toggleWeekPage(date, u.id, p.id)}
                                disabled={otherHas && !sel}
                                style={{
                                  border:`1.5px solid ${sel?'#7c3aed':otherHas?'#e5e7eb':'#dde3f5'}`,
                                  background: sel?'linear-gradient(135deg,#6366f1,#7c3aed)':otherHas?'#f1f5f9':'#fff',
                                  borderRadius:7, padding:'3px 6px', cursor:otherHas&&!sel?'not-allowed':'pointer',
                                  fontSize:10.5, fontWeight:700, color:sel?'#fff':otherHas?'#9ca3af':'#4b5563',
                                  fontFamily:'inherit', textAlign:'center', lineHeight:1.3,
                                  opacity:otherHas&&!sel?0.5:1, width:'100%',
                                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                                }}>
                                {sel ? '✓ ' : ''}{p.name}
                              </button>
                            )
                          })}
                          {testPages.length === 0 && (
                            <div style={{ fontSize:10, color:'#d1d5db', textAlign:'center', padding:'4px 0' }}>ไม่มีเพจทดสอบ</div>
                          )}
                        </div>
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* Legend */}
              <div style={{ display:'flex', gap:12, marginTop:16, flexWrap:'wrap', alignItems:'center' }}>
                <div style={{ fontSize:12, color:'#6b7280', fontWeight:700 }}>คำอธิบาย:</div>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:28, height:18, background:'linear-gradient(135deg,#6366f1,#7c3aed)', borderRadius:5 }}/>
                  <span style={{ fontSize:12, color:'#4b5563' }}>มอบหมายแล้ว</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:28, height:18, background:'#f1f5f9', border:'1.5px solid #e5e7eb', borderRadius:5 }}/>
                  <span style={{ fontSize:12, color:'#6b7280' }}>คนอื่นรับแล้ว</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:28, height:18, background:'#fff', border:'1.5px solid #dde3f5', borderRadius:5 }}/>
                  <span style={{ fontSize:12, color:'#6b7280' }}>ว่างอยู่</span>
                </div>
                <div style={{ marginLeft:'auto', fontSize:12, color:'#9ca3af' }}>
                  คลิกที่ปุ่มเพื่อมอบหมาย/ยกเลิก
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding:'16px 24px', borderTop:'1.5px solid #f0f4ff', display:'flex', gap:10, justifyContent:'flex-end', alignItems:'center' }}>
              <div style={{ flex:1, fontSize:13, color:'#6b7280' }}>
                จัดเวร {weekDays.length} วัน · แอดมิน {admins.length} คน · เพจทดสอบ {testPages.length} เพจ
              </div>
              <button onClick={() => setWeekView(false)}
                style={{ background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontSize:14, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>
                ยกเลิก
              </button>
              <button onClick={saveWeekDuty} disabled={savingWeek}
                style={{ background:'linear-gradient(135deg,#0f766e,#0d9488)', border:'none', borderRadius:10, padding:'9px 24px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:7, opacity:savingWeek?0.6:1, boxShadow:'0 4px 14px rgba(15,118,110,.3)' }}>
                <Calendar size={15}/> {savingWeek ? 'กำลังบันทึก...' : '💾 บันทึกเวรทั้งอาทิตย์'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ── Assign Modal ──────────────────────────────────────────
function AssignModal({ page, admins, onClose, onSave }) {
  const [sel, setSel] = useState(page.assignedTo || [])
  const [saving, setSaving] = useState(false)
  const toggle = id => setSel(p => p.includes(id) ? p.filter(i=>i!==id) : [...p, id])
  const save = async () => { setSaving(true); await onSave(page.id, sel); setSaving(false); onClose() }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(99,102,241,.2)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:28, maxWidth:480, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,.15)', border:'1.5px solid #e0e7ff', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div style={{ fontSize:17, fontWeight:900, color:'#1e1b4b' }}>👥 มอบหมายแอดมิน</div>
          <button onClick={onClose} style={{ background:'#f1f5f9', border:'none', borderRadius:9, width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}><X size={15}/></button>
        </div>
        <div style={{ fontSize:13, color:'#6b7280', marginBottom:16 }}>
          เพจ: <strong style={{ color:'#1e1b4b' }}>{page.name}</strong> · {page.type==='main'?'⭐ เพจหลัก':'🧪 เพจทดสอบ'}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
          {admins.map(u => {
            const checked = sel.includes(u.id)
            return (
              <label key={u.id} onClick={() => toggle(u.id)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, cursor:'pointer', border:`1.5px solid ${checked?'#6366f1':'#e0e7ff'}`, background:checked?'#eef2ff':'#fff', transition:'all .15s' }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800 }}>
                  {(u.avatar||u.name||'?').slice(0,2)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1e1b4b' }}>{u.name}</div>
                  <div style={{ fontSize:11.5, color:'#9ca3af' }}>{ROLES[u.role]}</div>
                </div>
                <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${checked?'#6366f1':'#d1d5db'}`, background:checked?'#6366f1':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {checked && <Check size={13} style={{ color:'#fff' }}/>}
                </div>
              </label>
            )
          })}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:10, fontSize:14, fontWeight:700, color:'#6b7280', cursor:'pointer', fontFamily:'inherit' }}>ยกเลิก</button>
          <button onClick={save} disabled={saving} style={{ flex:2, background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:10, padding:10, fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
            {saving?'กำลังบันทึก...':'✅ บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}
