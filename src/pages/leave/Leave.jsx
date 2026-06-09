import React, { useState, useMemo } from 'react'
import { format, differenceInDays, parseISO, isFuture, isPast } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { useNotify } from '../../hooks/useNotify'
import { Plus, CheckCircle, XCircle, CalendarDays, Trash2, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'

const today     = format(new Date(), 'yyyy-MM-dd')
const thisMonth = format(new Date(), 'yyyy-MM')

// ── ประเภทลา ─────────────────────────────────────────
const LEAVE_TYPES = [
  { value:'personal',  label:'ธุระส่วนตัว',  emoji:'🏠', color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe', gradient:'linear-gradient(135deg,#f5f3ff,#ede9fe)', light:'#ede9fe' },
  { value:'sick',      label:'ลาป่วย',        emoji:'🤒', color:'#be123c', bg:'#fff1f2', border:'#fecdd3', gradient:'linear-gradient(135deg,#fff1f2,#ffe4e6)', light:'#ffe4e6' },
  { value:'vacation',  label:'ลาพักร้อน',     emoji:'🌴', color:'#059669', bg:'#f0fdf4', border:'#bbf7d0', gradient:'linear-gradient(135deg,#f0fdf4,#dcfce7)', light:'#dcfce7' },
  { value:'emergency', label:'เหตุฉุกเฉิน',   emoji:'🚨', color:'#b45309', bg:'#fffbeb', border:'#fde68a', gradient:'linear-gradient(135deg,#fffbeb,#fef3c7)', light:'#fef3c7' },
  { value:'no_page',   label:'ไม่มีเพจตอบ',   emoji:'📭', color:'#0284c7', bg:'#eff6ff', border:'#bfdbfe', gradient:'linear-gradient(135deg,#eff6ff,#dbeafe)', light:'#dbeafe' },
  { value:'other',     label:'อื่นๆ',         emoji:'📝', color:'#6b7280', bg:'#f9fafb', border:'#e5e7eb', gradient:'linear-gradient(135deg,#f9fafb,#f3f4f6)', light:'#f3f4f6' },
]

const STATUS = {
  pending:  { label:'รออนุมัติ',  emoji:'⏳', color:'#b45309', bg:'#fffbeb', border:'#fde68a', gradient:'linear-gradient(135deg,#fffbeb,#fef3c7)' },
  approved: { label:'อนุมัติแล้ว', emoji:'✅', color:'#059669', bg:'#f0fdf4', border:'#86efac', gradient:'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
  rejected: { label:'ปฏิเสธ',     emoji:'❌', color:'#be123c', bg:'#fff1f2', border:'#fca5a5', gradient:'linear-gradient(135deg,#fff1f2,#ffe4e6)' },
}

function countDays(s, e) { if (!s || !e) return 1; return differenceInDays(parseISO(e), parseISO(s)) + 1 }
function fmtDate(d) { try { return format(parseISO(d), 'd MMM yy', { locale: th }) } catch { return d } }
function getLT(v) { return LEAVE_TYPES.find(t => t.value === v) || LEAVE_TYPES[5] }

export default function Leave() {
  const { profile, canManage, isSuperAdmin, canAudit } = useAuth()
  const { leaves, users, createLeave, approveLeave, rejectLeave, removeLeave, getUserName } = useData()
  const { notifyLeaveRequest, notifyLeaveResult } = useNotify()

  const isAdmin = profile?.role === 'admin'
  const myUid   = profile?.id || ''
  const canSeeAllLeave = isSuperAdmin || canManage || canAudit || profile?.role === 'assistant'

  const [showForm,     setShowForm]     = useState(false)
  const [confirm,      setConfirm]      = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterUser,   setFilterUser]   = useState('')
  const [filterMonth,  setFilterMonth]  = useState(thisMonth)
  const [expandId,     setExpandId]     = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [err,          setErr]          = useState('')
  const [form,         setForm]         = useState({ startDate:today, endDate:today, leaveType:'personal', reason:'' })
  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const filtered = useMemo(() => {
    let d = [...leaves].filter(l => !l.deleted)
    if (isAdmin && !canSeeAllLeave) d = d.filter(l => l.employeeId === myUid)
    if (filterStatus) d = d.filter(l => l.status === filterStatus)
    if (filterUser)   d = d.filter(l => l.employeeId === filterUser)
    if (filterMonth)  d = d.filter(l => l.startDate?.startsWith(filterMonth))
    return d.sort((a, b) => {
      if (a.status==='pending' && b.status!=='pending') return -1
      if (a.status!=='pending' && b.status==='pending') return 1
      return (b.startDate||'').localeCompare(a.startDate||'')
    })
  }, [leaves, filterStatus, filterUser, filterMonth, isAdmin, canSeeAllLeave, myUid])

  const base  = (isAdmin && !canSeeAllLeave) ? leaves.filter(l=>!l.deleted&&l.employeeId===myUid) : leaves.filter(l=>!l.deleted)
  const stats = {
    pending:   base.filter(l=>l.status==='pending').length,
    approved:  base.filter(l=>l.status==='approved').length,
    rejected:  base.filter(l=>l.status==='rejected').length,
    totalDays: base.filter(l=>l.status==='approved').reduce((a,l)=>a+countDays(l.startDate,l.endDate),0),
  }

  const handleSubmit = async () => {
    if (!form.reason.trim()) { setErr('กรุณาระบุเหตุผล'); return }
    setSaving(true); setErr('')
    try {
      await createLeave({ ...form, employeeId:myUid, status:'pending', createdAt:new Date().toISOString() })
      notifyLeaveRequest(form.reason)
      setShowForm(false)
      setForm({ startDate:today, endDate:today, leaveType:'personal', reason:'' })
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const handleApprove = async (id) => {
    setSaving(true)
    try {
      const leave = leaves.find(l=>l.id===id)
      await approveLeave(id, myUid)
      notifyLeaveResult(leave?.employeeId, getUserName(leave?.employeeId), true, '')
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const handleReject = async (id) => {
    setSaving(true)
    try {
      const leave = leaves.find(l=>l.id===id)
      await rejectLeave(id, myUid)
      notifyLeaveResult(leave?.employeeId, getUserName(leave?.employeeId), false, '')
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const admins = users.filter(u=>['admin','head_admin'].includes(u.role))
  const IS = { width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid #e0e7ff', background:'#fafbff', fontSize:13.5, color:'#1e1b4b', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18, maxWidth:'100%' }}>

      {/* ══ HERO HEADER ═══════════════════════════════ */}
      <div style={{ background:'linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%)', borderRadius:22, padding:'22px 26px', position:'relative', overflow:'hidden' }}>
        {/* decorative circles */}
        <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,.07)' }}/>
        <div style={{ position:'absolute', bottom:-30, left:80, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,.05)' }}/>
        <div style={{ position:'absolute', top:20, right:120, width:60, height:60, borderRadius:'50%', background:'rgba(255,255,255,.06)' }}/>

        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:14, position:'relative' }}>
          <div>
            <div style={{ fontSize:26, fontWeight:900, color:'#fff', marginBottom:5, display:'flex', alignItems:'center', gap:10 }}>
              🌴 ระบบวันลา
            </div>
            <div style={{ fontSize:13.5, color:'rgba(255,255,255,.7)' }}>
              {isAdmin && !canSeeAllLeave
                ? `สะสม ${stats.totalDays} วัน · รออนุมัติ ${stats.pending} รายการ`
                : `รออนุมัติ ${stats.pending} · อนุมัติแล้ว ${stats.approved} รายการ`}
            </div>
          </div>
          {(isAdmin || canManage || profile?.role==='assistant') && (
            <button onClick={()=>setShowForm(true)}
              style={{ background:'rgba(255,255,255,.18)', border:'1.5px solid rgba(255,255,255,.35)', borderRadius:13, padding:'10px 20px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:7, backdropFilter:'blur(8px)', whiteSpace:'nowrap' }}>
              <Plus size={15}/> + ขอลา
            </button>
          )}
        </div>

        {/* KPI strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:18, position:'relative' }}>
          {[
            { emoji:'⏳', label:'รออนุมัติ', value:stats.pending,   color:'#fde68a' },
            { emoji:'✅', label:'อนุมัติ',   value:stats.approved,  color:'#86efac' },
            { emoji:'❌', label:'ปฏิเสธ',    value:stats.rejected,  color:'#fca5a5' },
            { emoji:'📅', label:'วันสะสม',   value:`${stats.totalDays} วัน`, color:'#c4b5fd' },
          ].map((k,i)=>(
            <div key={i} style={{ background:'rgba(255,255,255,.12)', borderRadius:14, padding:'12px 14px', border:'1px solid rgba(255,255,255,.15)', backdropFilter:'blur(4px)' }}>
              <div style={{ fontSize:22, marginBottom:5 }}>{k.emoji}</div>
              <div style={{ fontSize:20, fontWeight:900, color:k.color }}>{k.value}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:2 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ FORM ════════════════════════════════════ */}
      {showForm && (
        <div style={{ background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 4px 30px rgba(99,102,241,.12)', border:'1.5px solid #e0e7ff' }}>
          <div style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', padding:'14px 22px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:16, fontWeight:900, color:'#fff', display:'flex', alignItems:'center', gap:8 }}>🌴 ขอลา</div>
            <button onClick={()=>setShowForm(false)} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:8, width:30, height:30, cursor:'pointer', color:'#fff', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          </div>
          <div style={{ padding:22 }}>
            {err && <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:10, padding:'10px 14px', color:'#be123c', fontSize:13, marginBottom:14 }}>❌ {err}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📅 วันที่เริ่มลา</label>
                <input type="date" style={IS} value={form.startDate} onChange={setF('startDate')}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📅 วันที่กลับ</label>
                <input type="date" style={IS} value={form.endDate} min={form.startDate} onChange={setF('endDate')}/>
              </div>
            </div>

            {/* leave type buttons */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>🏷️ ประเภทการลา</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {LEAVE_TYPES.map(lt=>{
                  const sel = form.leaveType===lt.value
                  return (
                    <button key={lt.value} type="button" onClick={()=>setForm(p=>({...p,leaveType:lt.value}))}
                      style={{ background:sel?lt.gradient:'#fafbff', border:`2px solid ${sel?lt.color:'#e5e7eb'}`, borderRadius:12, padding:'10px 8px', cursor:'pointer', fontFamily:'inherit', transition:'all .15s', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:22 }}>{lt.emoji}</span>
                      <span style={{ fontSize:12, fontWeight:sel?800:600, color:sel?lt.color:'#374151' }}>{lt.label}</span>
                      {sel && <span style={{ fontSize:10, color:lt.color }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* days preview */}
            {form.startDate && form.endDate && (
              <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', border:'1.5px solid #c7d2fe', borderRadius:12, padding:'11px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:10 }}>
                <CalendarDays size={17} style={{ color:'#6366f1', flexShrink:0 }}/>
                <span style={{ fontSize:13.5, color:'#4338ca', fontWeight:700 }}>
                  {fmtDate(form.startDate)} — {fmtDate(form.endDate)} · <strong>{countDays(form.startDate,form.endDate)} วัน</strong>
                </span>
              </div>
            )}

            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📝 เหตุผล</label>
              <textarea style={{ ...IS, minHeight:80, resize:'vertical' }} placeholder="กรอกเหตุผล..." value={form.reason} onChange={setF('reason')}/>
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={()=>setShowForm(false)} style={{ background:'#f1f5f9', border:'1.5px solid #e0e7ff', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontSize:13.5, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>ยกเลิก</button>
              <button onClick={handleSubmit} disabled={saving}
                style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:10, padding:'9px 24px', cursor:'pointer', fontSize:13.5, fontWeight:800, color:'#fff', fontFamily:'inherit', opacity:saving?.6:1, display:'flex', alignItems:'center', gap:7, boxShadow:'0 4px 14px rgba(99,102,241,.3)' }}>
                {saving ? '⏳ กำลังส่ง...' : <><Plus size={14}/> ส่งคำขอ</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ FILTER BAR ════════════════════════════════ */}
      <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:'12px 16px', display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
        <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
          style={{ padding:'7px 11px', borderRadius:9, border:'1.5px solid #c7d2fe', background:'#fafbff', fontSize:13, color:'#4338ca', fontFamily:'inherit' }}/>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {[{v:'',l:'ทั้งหมด'},{v:'pending',l:'⏳ รอ'},{v:'approved',l:'✅ อนุมัติ'},{v:'rejected',l:'❌ ปฏิเสธ'}].map(opt=>(
            <button key={opt.v} onClick={()=>setFilterStatus(opt.v)}
              style={{ background:filterStatus===opt.v?'linear-gradient(135deg,#6366f1,#7c3aed)':'#f1f5f9', border:`1.5px solid ${filterStatus===opt.v?'#6366f1':'#e0e7ff'}`, borderRadius:9, padding:'6px 13px', cursor:'pointer', fontSize:12.5, fontWeight:700, color:filterStatus===opt.v?'#fff':'#6b7280', fontFamily:'inherit' }}>
              {opt.l}
            </button>
          ))}
        </div>
        {canSeeAllLeave && (
          <select value={filterUser} onChange={e=>setFilterUser(e.target.value)}
            style={{ padding:'7px 11px', borderRadius:9, border:'1.5px solid #e0e7ff', background:'#fafbff', fontSize:12.5, color:'#374151', fontFamily:'inherit' }}>
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
        <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:20, padding:'52px 24px', textAlign:'center' }}>
          <div style={{ fontSize:56, marginBottom:14 }}>🌴</div>
          <div style={{ fontSize:17, fontWeight:900, color:'#1e1b4b', marginBottom:6 }}>ยังไม่มีรายการวันลา</div>
          <div style={{ fontSize:13, color:'#9ca3af' }}>กด "+ ขอลา" เพื่อสร้างคำขอใหม่</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {filtered.map(l => {
            const st  = STATUS[l.status] || STATUS.pending
            const lt  = getLT(l.leaveType)
            const days = countDays(l.startDate, l.endDate)
            const isOwner = l.employeeId === myUid
            const isExp = expandId === l.id
            const canApprove = canManage && l.status === 'pending'
            const canDel = isSuperAdmin || (isOwner && l.status === 'pending')

            return (
              <div key={l.id} style={{
                background:'#fff',
                border:`1.5px solid ${st.border}`,
                borderLeft:`5px solid ${st.color}`,
                borderRadius:18,
                overflow:'hidden',
                boxShadow: l.status==='pending'?'0 3px 16px rgba(180,83,9,.08)':'0 1px 8px rgba(99,102,241,.05)',
              }}>
                {/* ── card top strip (leave type color) ── */}
                <div style={{ height:4, background:lt.gradient }}/>

                {/* ── main row ── */}
                <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>

                  {/* emoji avatar */}
                  <div style={{ width:46, height:46, borderRadius:'50%', background:lt.gradient, border:`2px solid ${lt.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                    {lt.emoji}
                  </div>

                  {/* info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:5 }}>
                      <span style={{ fontSize:15, fontWeight:900, color:'#1e1b4b' }}>{getUserName(l.employeeId)}</span>
                      {isOwner && <span style={{ background:'#eef2ff', color:'#4338ca', border:'1px solid #c7d2fe', borderRadius:99, padding:'1px 8px', fontSize:10.5, fontWeight:800 }}>ฉัน</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                      {/* type badge */}
                      <span style={{ background:lt.gradient, color:lt.color, border:`1.5px solid ${lt.border}`, borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700, display:'inline-flex', alignItems:'center', gap:4 }}>
                        {lt.emoji} {lt.label}
                      </span>
                      {/* status badge */}
                      <span style={{ background:st.gradient, color:st.color, border:`1.5px solid ${st.border}`, borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
                        {st.emoji} {st.label}
                      </span>
                    </div>
                  </div>

                  {/* date + days */}
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:800, color:'#1e1b4b', marginBottom:5 }}>
                      {l.startDate === l.endDate ? fmtDate(l.startDate) : `${fmtDate(l.startDate)} – ${fmtDate(l.endDate)}`}
                    </div>
                    <span style={{ background:lt.gradient, color:lt.color, border:`1.5px solid ${lt.border}`, borderRadius:99, padding:'3px 10px', fontSize:12.5, fontWeight:900, display:'inline-flex', alignItems:'center', gap:4 }}>
                      <CalendarDays size={12}/> {days} วัน
                    </span>
                  </div>

                  {/* actions */}
                  <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                    {canApprove && (
                      <>
                        <button onClick={()=>handleApprove(l.id)} disabled={saving}
                          style={{ background:'linear-gradient(135deg,#059669,#10b981)', border:'none', borderRadius:10, padding:'7px 14px', cursor:'pointer', fontSize:12.5, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, boxShadow:'0 2px 8px rgba(5,150,105,.25)' }}>
                          <CheckCircle size={13}/> อนุมัติ
                        </button>
                        <button onClick={()=>handleReject(l.id)} disabled={saving}
                          style={{ background:'linear-gradient(135deg,#be123c,#e11d48)', border:'none', borderRadius:10, padding:'7px 14px', cursor:'pointer', fontSize:12.5, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, boxShadow:'0 2px 8px rgba(190,18,60,.25)' }}>
                          <XCircle size={13}/> ปฏิเสธ
                        </button>
                      </>
                    )}
                    {canDel && (
                      <button onClick={()=>setConfirm(l.id)}
                        style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#be123c' }}>
                        <Trash2 size={14}/>
                      </button>
                    )}
                    <button onClick={()=>setExpandId(isExp?null:l.id)}
                      style={{ background:'#f1f5f9', border:'1.5px solid #e0e7ff', borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}>
                      {isExp ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                    </button>
                  </div>
                </div>

                {/* ── expand: reason ── */}
                {isExp && (
                  <div style={{ padding:'12px 18px 16px', borderTop:`1px solid ${lt.border}`, background:lt.gradient }}>
                    <div style={{ fontSize:11.5, fontWeight:800, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:7, display:'flex', alignItems:'center', gap:5 }}>
                      📝 เหตุผล
                    </div>
                    <div style={{ fontSize:13.5, color:'#1e1b4b', background:'rgba(255,255,255,.7)', backdropFilter:'blur(4px)', border:`1px solid ${lt.border}`, borderRadius:10, padding:'10px 14px', lineHeight:1.9 }}>
                      {l.reason || '—'}
                    </div>
                    {l.approvedBy && (
                      <div style={{ fontSize:12, color:'#6b7280', marginTop:9, display:'flex', alignItems:'center', gap:5 }}>
                        {l.status==='approved'?'✅':'🔄'} ดำเนินการโดย: <strong>{getUserName(l.approvedBy)}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══ TEAM SUMMARY ════════════════════════════ */}
      {canSeeAllLeave && (
        <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:20, overflow:'hidden' }}>
          <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', padding:'14px 20px', borderBottom:'1px solid #e0e7ff', display:'flex', alignItems:'center', gap:8 }}>
            <TrendingUp size={17} style={{ color:'#6366f1' }}/>
            <div style={{ fontSize:15, fontWeight:900, color:'#1e1b4b' }}>📊 สรุปวันลาของทีม</div>
          </div>
          <div style={{ fontSize:15, fontWeight:900, color:'#1e1b4b', padding:'0 4px 4px' }}>🗂️ สถิติวันลารายคน</div>
          <div style={{ padding:'0 4px 16px', display:'flex', flexDirection:'column', gap:12 }}>
            {admins.map(u => {
              const ul = leaves.filter(l=>!l.deleted&&l.employeeId===u.id)
              const aw = ul.filter(l=>l.status==='approved')
              const pd = ul.filter(l=>l.status==='pending').length
              const rj = ul.filter(l=>l.status==='rejected').length
              const totalDays = aw.reduce((a,l)=>a+countDays(l.startDate,l.endDate),0)
              const colors = ['#6366f1','#8b5cf6','#ec4899','#0284c7','#059669','#d97706']
              const col = colors[(u.name||'').charCodeAt(0)%colors.length]
              const byType = LEAVE_TYPES.map(lt=>({
                ...lt,
                count: aw.filter(l=>l.leaveType===lt.value).length,
                days:  aw.filter(l=>l.leaveType===lt.value).reduce((a,l)=>a+countDays(l.startDate,l.endDate),0),
              })).filter(lt=>lt.count>0)
              return (
                <div key={u.id} style={{ background:'linear-gradient(135deg,#fafbff,#f0f4ff)', border:'1.5px solid #e0e7ff', borderRadius:16, padding:'14px 18px' }}>
                  {/* header row */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:byType.length>0?12:0 }}>
                    <div style={{ width:40, height:40, borderRadius:'50%', background:`linear-gradient(135deg,${col},${col}cc)`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, flexShrink:0 }}>
                      {(u.name||'?').slice(0,2)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:'#1e1b4b' }}>{u.name}</div>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>{u.role}</div>
                    </div>
                    <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                      <span style={{ background:'#f0fdf4', color:'#059669', border:'1px solid #bbf7d0', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
                        ✅ {aw.length} ครั้ง · {totalDays} วัน
                      </span>
                      {pd>0 && <span style={{ background:'#fffbeb', color:'#b45309', border:'1px solid #fde68a', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>⏳ {pd} รอ</span>}
                      {rj>0 && <span style={{ background:'#fff1f2', color:'#be123c', border:'1px solid #fecdd3', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>❌ {rj} ปฏิเสธ</span>}
                    </div>
                  </div>
                  {/* breakdown by leave type */}
                  {byType.length>0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:7, paddingTop:10, borderTop:'1px solid #e0e7ff' }}>
                      {byType.map((lt,i)=>(
                        <span key={i} style={{ background:lt.gradient, color:lt.color, border:`1.5px solid ${lt.border}`, borderRadius:99, padding:'3px 11px', fontSize:12, fontWeight:700, display:'inline-flex', alignItems:'center', gap:4 }}>
                          {lt.emoji} {lt.label}: {lt.count} ครั้ง ({lt.days} วัน)
                        </span>
                      ))}
                    </div>
                  )}
                  {byType.length===0 && <div style={{ fontSize:12, color:'#9ca3af' }}>ยังไม่มีการอนุมัติ</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ CONFIRM DELETE ═══════════════════════════ */}
      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }}>
          <div style={{ background:'#fff', borderRadius:20, padding:28, maxWidth:360, width:'100%', textAlign:'center', boxShadow:'0 20px 50px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize:50, marginBottom:12 }}>🗑️</div>
            <div style={{ fontSize:17, fontWeight:900, color:'#1e1b4b', marginBottom:8 }}>ลบคำขอลา?</div>
            <div style={{ fontSize:13.5, color:'#6b7280', marginBottom:22 }}>ไม่สามารถย้อนกลับได้</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={()=>setConfirm(null)} style={{ background:'#f1f5f9', border:'1.5px solid #e0e7ff', borderRadius:10, padding:'9px 22px', cursor:'pointer', fontSize:14, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>ยกเลิก</button>
              <button onClick={async()=>{ await removeLeave(confirm); setConfirm(null) }}
                style={{ background:'linear-gradient(135deg,#be123c,#e11d48)', border:'none', borderRadius:10, padding:'9px 22px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit' }}>
                ลบเลย
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
