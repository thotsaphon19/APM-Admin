import React, { useState, useMemo } from 'react'
import { format, differenceInDays, parseISO, isFuture, isPast } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { useNotify } from '../../hooks/useNotify'
import {
  Plus, CheckCircle, XCircle, Clock, CalendarDays,
  Trash2, ChevronDown, ChevronUp, User, TrendingUp,
} from 'lucide-react'

const today     = format(new Date(), 'yyyy-MM-dd')
const thisMonth = format(new Date(), 'yyyy-MM')

const LEAVE_TYPES = [
  { value:'personal',  label:'🏠 ธุระส่วนตัว',  color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe', gradient:'linear-gradient(135deg,#f5f3ff,#ede9fe)' },
  { value:'sick',      label:'🤒 ลาป่วย',        color:'#be123c', bg:'#fff1f2', border:'#fecdd3', gradient:'linear-gradient(135deg,#fff1f2,#ffe4e6)' },
  { value:'vacation',  label:'🌴 ลาพักร้อน',     color:'#059669', bg:'#f0fdf4', border:'#bbf7d0', gradient:'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
  { value:'emergency', label:'🚨 เหตุฉุกเฉิน',   color:'#b45309', bg:'#fffbeb', border:'#fde68a', gradient:'linear-gradient(135deg,#fffbeb,#fef3c7)' },
  { value:'no_page',   label:'📭 ไม่มีเพจตอบ',   color:'#0284c7', bg:'#eff6ff', border:'#bfdbfe', gradient:'linear-gradient(135deg,#eff6ff,#dbeafe)' },
  { value:'other',     label:'📝 อื่นๆ',         color:'#6b7280', bg:'#f9fafb', border:'#e5e7eb', gradient:'linear-gradient(135deg,#f9fafb,#f3f4f6)' },
]

const STATUS = {
  pending:  { label:'⏳ รออนุมัติ',   color:'#b45309', bg:'#fffbeb', border:'#fde68a', gradient:'linear-gradient(135deg,#fffbeb,#fef3c7)' },
  approved: { label:'✅ อนุมัติแล้ว', color:'#059669', bg:'#f0fdf4', border:'#86efac', gradient:'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
  rejected: { label:'❌ ปฏิเสธ',      color:'#be123c', bg:'#fff1f2', border:'#fca5a5', gradient:'linear-gradient(135deg,#fff1f2,#ffe4e6)' },
}

function countDays(s, e) {
  if (!s || !e) return 1
  return differenceInDays(parseISO(e), parseISO(s)) + 1
}
function fmtDate(d) {
  try { return format(parseISO(d), 'd MMM yyyy', { locale: th }) } catch { return d }
}
function getLT(v) {
  return LEAVE_TYPES.find(t => t.value === v) || LEAVE_TYPES[5]
}

export default function Leave() {
  const { profile, canManage, isSuperAdmin } = useAuth()
  const { leaves, users, createLeave, approveLeave, rejectLeave, removeLeave, getUserName } = useData()
  const { notifyLeaveRequest, notifyLeaveResult } = useNotify()

  const isAdmin = profile?.role === 'admin'
  const myUid   = profile?.id || ''

  const [showForm,     setShowForm]     = useState(false)
  const [confirm,      setConfirm]      = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterUser,   setFilterUser]   = useState('')
  const [filterMonth,  setFilterMonth]  = useState(thisMonth)
  const [expandId,     setExpandId]     = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [err,          setErr]          = useState('')
  const [form,         setForm]         = useState({
    startDate:today, endDate:today, leaveType:'personal', reason:'',
  })
  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  // ── filtered ──────────────────────────────────────
  const filtered = useMemo(() => {
    let d = [...leaves].filter(l => !l.deleted)
    if (isAdmin)     d = d.filter(l => l.employeeId === myUid)
    if (filterStatus) d = d.filter(l => l.status === filterStatus)
    if (filterUser)   d = d.filter(l => l.employeeId === filterUser)
    if (filterMonth)  d = d.filter(l => l.startDate?.startsWith(filterMonth))
    return d.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (a.status !== 'pending' && b.status === 'pending') return 1
      return b.startDate?.localeCompare(a.startDate)
    })
  }, [leaves, filterStatus, filterUser, filterMonth, isAdmin, myUid])

  // ── stats ─────────────────────────────────────────
  const base  = isAdmin ? leaves.filter(l => !l.deleted && l.employeeId === myUid) : leaves.filter(l => !l.deleted)
  const stats = {
    pending:  base.filter(l => l.status === 'pending').length,
    approved: base.filter(l => l.status === 'approved').length,
    rejected: base.filter(l => l.status === 'rejected').length,
    totalDays: base.filter(l => l.status === 'approved').reduce((a, l) => a + countDays(l.startDate, l.endDate), 0),
  }

  // ── handlers ──────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.reason.trim()) { setErr('กรุณาระบุเหตุผล'); return }
    setSaving(true); setErr('')
    try {
      await createLeave({ ...form, employeeId: myUid, status:'pending', createdAt: new Date().toISOString() })
      notifyLeaveRequest(form.reason)
      setShowForm(false)
      setForm({ startDate:today, endDate:today, leaveType:'personal', reason:'' })
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const handleApprove = async (id) => {
    setSaving(true)
    try {
      const leave = leaves.find(l => l.id === id)
      await approveLeave(id, myUid)
      notifyLeaveResult(leave?.employeeId, getUserName(leave?.employeeId), true, '')
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const handleReject = async (id) => {
    setSaving(true)
    try {
      const leave = leaves.find(l => l.id === id)
      await rejectLeave(id, myUid)
      notifyLeaveResult(leave?.employeeId, getUserName(leave?.employeeId), false, '')
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const admins = users.filter(u => ['admin','head_admin'].includes(u.role))
  const IS = { width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #e0e7ff', background:'#fafbff', fontSize:13.5, color:'#1e1b4b', fontFamily:'inherit', outline:'none' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:'100%' }}>

      {/* ══ HEADER ════════════════════════════════════ */}
      <div style={{ background:'linear-gradient(135deg,#6366f1 0%,#7c3aed 60%,#a855f7 100%)', borderRadius:20, padding:'24px 28px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-30, right:-30, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,.08)' }}/>
        <div style={{ position:'absolute', bottom:-20, left:60, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,.05)' }}/>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16, position:'relative' }}>
          <div>
            <div style={{ fontSize:24, fontWeight:900, color:'#fff', marginBottom:4 }}>🌴 ระบบวันลา</div>
            <div style={{ fontSize:13.5, color:'rgba(255,255,255,.75)' }}>
              {isAdmin
                ? `ลาสะสม ${stats.totalDays} วัน · รออนุมัติ ${stats.pending} รายการ`
                : `ทีมรออนุมัติ ${stats.pending} รายการ · อนุมัติแล้ว ${stats.approved} รายการ`}
            </div>
          </div>
          {(isAdmin || canManage) && (
            <button onClick={() => setShowForm(true)}
              style={{ background:'rgba(255,255,255,.2)', border:'1.5px solid rgba(255,255,255,.35)', borderRadius:12, padding:'10px 20px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:7, backdropFilter:'blur(8px)' }}>
              <Plus size={15}/> + ขอลา
            </button>
          )}
        </div>

        {/* KPI Strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:10, marginTop:18, position:'relative' }}>
          {[
            { e:'⏳', l:'รออนุมัติ',   v:stats.pending,  c:'#fde68a' },
            { e:'✅', l:'อนุมัติ',      v:stats.approved, c:'#86efac' },
            { e:'❌', l:'ปฏิเสธ',       v:stats.rejected, c:'#fca5a5' },
            { e:'📅', l:'วันลาสะสม',    v:`${stats.totalDays} วัน`, c:'#c4b5fd' },
          ].map((k, i) => (
            <div key={i} style={{ background:'rgba(255,255,255,.12)', borderRadius:12, padding:'11px 14px', border:`1px solid rgba(255,255,255,.15)`, backdropFilter:'blur(4px)' }}>
              <div style={{ fontSize:18, marginBottom:4 }}>{k.e}</div>
              <div style={{ fontSize:18, fontWeight:900, color:k.c }}>{k.v}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:2 }}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ FORM ════════════════════════════════════ */}
      {showForm && (
        <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:20, overflow:'hidden', boxShadow:'0 4px 24px rgba(99,102,241,.1)' }}>
          <div style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', padding:'14px 22px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:16, fontWeight:900, color:'#fff', display:'flex', alignItems:'center', gap:8 }}>
              <Plus size={17}/> ขอลา
            </div>
            <button onClick={() => setShowForm(false)} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:8, width:30, height:30, cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>✕</button>
          </div>
          <div style={{ padding:22, display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {err && <div style={{ gridColumn:'1/-1', background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:10, padding:'10px 14px', color:'#be123c', fontSize:13 }}>❌ {err}</div>}

            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📅 วันที่เริ่มลา</label>
              <input type="date" style={IS} value={form.startDate} min={isAdmin?today:''} onChange={setF('startDate')}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📅 วันที่กลับ</label>
              <input type="date" style={IS} value={form.endDate} min={form.startDate} onChange={setF('endDate')}/>
            </div>

            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>🏷️ ประเภทการลา</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:8 }}>
                {LEAVE_TYPES.map(lt => (
                  <button key={lt.value} onClick={() => setForm(p=>({...p, leaveType:lt.value}))}
                    style={{ background:form.leaveType===lt.value ? lt.gradient : '#fafbff', border:`2px solid ${form.leaveType===lt.value ? lt.color : '#e0e7ff'}`, borderRadius:12, padding:'10px 12px', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:form.leaveType===lt.value?800:600, color:form.leaveType===lt.value?lt.color:'#6b7280', transition:'all .15s', textAlign:'left' }}>
                    {lt.label}
                    {form.leaveType===lt.value && <span style={{ float:'right' }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* ── ระยะเวลา preview ── */}
            {form.startDate && form.endDate && (
              <div style={{ gridColumn:'1/-1', background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', border:'1.5px solid #c7d2fe', borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                <CalendarDays size={18} style={{ color:'#6366f1', flexShrink:0 }}/>
                <span style={{ fontSize:13.5, color:'#4338ca', fontWeight:700 }}>
                  {fmtDate(form.startDate)} — {fmtDate(form.endDate)} · <strong>{countDays(form.startDate, form.endDate)} วัน</strong>
                </span>
              </div>
            )}

            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📝 เหตุผล</label>
              <textarea style={{ ...IS, minHeight:80, resize:'vertical' }} placeholder="กรอกเหตุผลการลา..." value={form.reason} onChange={setF('reason')}/>
            </div>

            <div style={{ gridColumn:'1/-1', display:'flex', gap:10, justifyContent:'flex-end', paddingTop:4 }}>
              <button onClick={() => setShowForm(false)} style={{ background:'#f1f5f9', border:'1.5px solid #e0e7ff', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontSize:13.5, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>ยกเลิก</button>
              <button onClick={handleSubmit} disabled={saving}
                style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:10, padding:'9px 24px', cursor:'pointer', fontSize:13.5, fontWeight:800, color:'#fff', fontFamily:'inherit', opacity:saving?0.6:1, display:'flex', alignItems:'center', gap:7, boxShadow:'0 4px 14px rgba(99,102,241,.3)' }}>
                {saving ? '⏳ กำลังส่ง...' : <><Plus size={14}/> ส่งคำขอ</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ FILTER BAR ════════════════════════════════ */}
      <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:'14px 18px', display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
        <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
          style={{ ...IS, width:'auto', flex:'0 0 auto' }}/>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {[{v:'',l:'ทั้งหมด'},{v:'pending',l:'⏳ รอ'},{v:'approved',l:'✅ อนุมัติ'},{v:'rejected',l:'❌ ปฏิเสธ'}].map(opt=>(
            <button key={opt.v} onClick={()=>setFilterStatus(opt.v)}
              style={{ background:filterStatus===opt.v?'linear-gradient(135deg,#6366f1,#7c3aed)':'#f1f5f9', border:`1.5px solid ${filterStatus===opt.v?'#6366f1':'#e0e7ff'}`, borderRadius:9, padding:'6px 13px', cursor:'pointer', fontSize:12.5, fontWeight:700, color:filterStatus===opt.v?'#fff':'#6b7280', fontFamily:'inherit' }}>
              {opt.l}
            </button>
          ))}
        </div>
        {!isAdmin && (
          <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} style={{ ...IS, width:'auto' }}>
            <option value="">👥 ทุกคน</option>
            {admins.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <button onClick={()=>{setFilterStatus('');setFilterUser('');setFilterMonth(thisMonth)}}
          style={{ background:'#f1f5f9', border:'1.5px solid #e0e7ff', borderRadius:9, padding:'6px 12px', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>
          รีเซ็ต
        </button>
        <div style={{ marginLeft:'auto', fontSize:13, color:'#6b7280', fontWeight:600 }}>{filtered.length} รายการ</div>
      </div>

      {/* ══ LEAVE CARDS ════════════════════════════════ */}
      {filtered.length === 0 ? (
        <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:20, padding:'48px 24px', textAlign:'center' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:16, fontWeight:800, color:'#1e1b4b', marginBottom:6 }}>ยังไม่มีรายการ</div>
          <div style={{ fontSize:13, color:'#9ca3af' }}>กด "+ ขอลา" เพื่อสร้างคำขอ</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {filtered.map(l => {
            const st  = STATUS[l.status] || STATUS.pending
            const lt  = getLT(l.leaveType)
            const days = countDays(l.startDate, l.endDate)
            const isOwner = l.employeeId === myUid
            const isOngoing = l.status === 'approved' && !isFuture(parseISO(l.startDate)) && !isPast(parseISO(l.endDate))
            const isExp = expandId === l.id
            const canApprove = canManage && l.status === 'pending'
            const canDel = isSuperAdmin || (isOwner && l.status === 'pending')

            return (
              <div key={l.id} style={{
                background:'#fff',
                border:`1.5px solid ${st.border}`,
                borderLeft:`5px solid ${st.color}`,
                borderRadius:16,
                overflow:'hidden',
                boxShadow: l.status==='pending'?'0 2px 12px rgba(180,83,9,.08)':'0 1px 6px rgba(99,102,241,.06)',
                transition:'box-shadow .2s',
              }}>
                {/* Card Header */}
                <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', background:l.status==='pending'?'linear-gradient(135deg,#fffbeb88,#fff)':'#fff' }}>

                  {/* Avatar */}
                  <div style={{ width:42, height:42, borderRadius:'50%', background:`linear-gradient(135deg,${lt.color},${st.color})`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, flexShrink:0 }}>
                    {getUserName(l.employeeId).slice(0,2) || '??'}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:4 }}>
                      <span style={{ fontSize:14.5, fontWeight:900, color:'#1e1b4b' }}>{getUserName(l.employeeId)}</span>
                      {isOwner && <span style={{ background:'#eef2ff', color:'#4338ca', border:'1px solid #c7d2fe', borderRadius:99, padding:'1px 8px', fontSize:10.5, fontWeight:800 }}>ฉัน</span>}
                      {isOngoing && <span style={{ background:'#f0fdf4', color:'#059669', border:'1px solid #bbf7d0', borderRadius:99, padding:'1px 8px', fontSize:10.5, fontWeight:800 }}>🟢 กำลังลา</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      {/* ประเภท */}
                      <span style={{ background:lt.gradient, color:lt.color, border:`1.5px solid ${lt.border}`, borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>{lt.label}</span>
                      {/* สถานะ */}
                      <span style={{ background:st.gradient, color:st.color, border:`1.5px solid ${st.border}`, borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>{st.label}</span>
                    </div>
                  </div>

                  {/* วันที่ + จำนวน */}
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:800, color:'#1e1b4b' }}>
                      {l.startDate === l.endDate ? fmtDate(l.startDate) : `${fmtDate(l.startDate)} – ${fmtDate(l.endDate)}`}
                    </div>
                    <div style={{ display:'inline-flex', alignItems:'center', gap:4, background:`linear-gradient(135deg,${lt.color}22,${lt.color}11)`, border:`1.5px solid ${lt.border}`, borderRadius:99, padding:'3px 10px', marginTop:4 }}>
                      <CalendarDays size={12} style={{ color:lt.color }}/>
                      <span style={{ fontSize:13, fontWeight:900, color:lt.color }}>{days} วัน</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                    {canApprove && (
                      <>
                        <button onClick={() => handleApprove(l.id)} disabled={saving}
                          style={{ background:'linear-gradient(135deg,#059669,#10b981)', border:'none', borderRadius:9, padding:'7px 14px', cursor:'pointer', fontSize:12.5, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                          <CheckCircle size={13}/> อนุมัติ
                        </button>
                        <button onClick={() => handleReject(l.id)} disabled={saving}
                          style={{ background:'linear-gradient(135deg,#be123c,#e11d48)', border:'none', borderRadius:9, padding:'7px 14px', cursor:'pointer', fontSize:12.5, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                          <XCircle size={13}/> ปฏิเสธ
                        </button>
                      </>
                    )}
                    {canDel && (
                      <button onClick={() => setConfirm(l.id)}
                        style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#be123c' }}>
                        <Trash2 size={14}/>
                      </button>
                    )}
                    <button onClick={() => setExpandId(isExp ? null : l.id)}
                      style={{ background:'#f1f5f9', border:'1.5px solid #e0e7ff', borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}>
                      {isExp ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                    </button>
                  </div>
                </div>

                {/* Expanded */}
                {isExp && (
                  <div style={{ padding:'14px 18px 18px', borderTop:`1px solid ${st.border}`, background:st.gradient }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>เหตุผล</div>
                    <div style={{ fontSize:13.5, color:'#1e1b4b', background:'#fff', border:`1px solid ${st.border}`, borderRadius:10, padding:'10px 14px', lineHeight:1.8 }}>
                      {l.reason || '—'}
                    </div>
                    {l.approvedBy && (
                      <div style={{ fontSize:12, color:'#6b7280', marginTop:10, display:'flex', alignItems:'center', gap:5 }}>
                        <User size={12}/>
                        {l.status === 'approved' ? `อนุมัติโดย: ${getUserName(l.approvedBy)}` : `ดำเนินการโดย: ${getUserName(l.approvedBy)}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══ TEAM SUMMARY (head_admin) ════════════════ */}
      {!isAdmin && (
        <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:20, overflow:'hidden' }}>
          <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', padding:'14px 20px', borderBottom:'1px solid #e0e7ff', display:'flex', alignItems:'center', gap:8 }}>
            <TrendingUp size={17} style={{ color:'#6366f1' }}/>
            <div style={{ fontSize:15, fontWeight:900, color:'#1e1b4b' }}>สรุปวันลาของทีม</div>
          </div>
          <div style={{ padding:16, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
            {users.filter(u => ['admin','head_admin'].includes(u.role)).map(u => {
              const ul = leaves.filter(l => !l.deleted && l.employeeId === u.id)
              const aw = ul.filter(l=>l.status==='approved')
              const pd = ul.filter(l=>l.status==='pending').length
              const totalDays = aw.reduce((a,l)=>a+countDays(l.startDate,l.endDate),0)
              return (
                <div key={u.id} style={{ background:'linear-gradient(135deg,#fafbff,#f0f4ff)', border:'1.5px solid #e0e7ff', borderRadius:14, padding:'12px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:8 }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                      {(u.name||'?').slice(0,2)}
                    </div>
                    <div>
                      <div style={{ fontSize:13.5, fontWeight:800, color:'#1e1b4b' }}>{u.name}</div>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>{u.role}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <span style={{ background:'#f0fdf4', color:'#059669', border:'1px solid #bbf7d0', borderRadius:99, padding:'2px 8px', fontSize:11.5, fontWeight:700 }}>✅ {aw.length} ครั้ง ({totalDays} วัน)</span>
                    {pd>0 && <span style={{ background:'#fffbeb', color:'#b45309', border:'1px solid #fde68a', borderRadius:99, padding:'2px 8px', fontSize:11.5, fontWeight:700 }}>⏳ {pd} รอ</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ CONFIRM DELETE ═══════════════════════════ */}
      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }}>
          <div style={{ background:'#fff', borderRadius:18, padding:28, maxWidth:360, width:'100%', textAlign:'center', boxShadow:'0 20px 50px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize:42, marginBottom:12 }}>🗑️</div>
            <div style={{ fontSize:16, fontWeight:900, color:'#1e1b4b', marginBottom:8 }}>ลบคำขอลา?</div>
            <div style={{ fontSize:13.5, color:'#6b7280', marginBottom:22 }}>การกระทำนี้ไม่สามารถย้อนกลับได้</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => setConfirm(null)} style={{ background:'#f1f5f9', border:'1.5px solid #e0e7ff', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontSize:14, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>ยกเลิก</button>
              <button onClick={async()=>{ await removeLeave(confirm); setConfirm(null) }}
                style={{ background:'linear-gradient(135deg,#be123c,#e11d48)', border:'none', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit' }}>
                ลบเลย
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
