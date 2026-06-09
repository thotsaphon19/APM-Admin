import React, { useState, useMemo } from 'react'
import { format, parseISO, differenceInDays, isToday, isFuture, isPast } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import PageBadge from '../../components/ui/PageBadge'
import { Avatar, Empty, Alert } from '../../components/ui'
import {
  Users, CalendarDays, TrendingUp, BookOpen,
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  HandMetal, Bot, AlertCircle, Eye, Calendar,
  BarChart3, Shield, Star, TestTube, History,
} from 'lucide-react'

const today = format(new Date(), 'yyyy-MM-dd')
const thisMonth = format(new Date(), 'yyyy-MM')
const todayLabel = format(new Date(), 'EEEE d MMMM yyyy', { locale: th })

function countDays(s, e) {
  if (!s || !e) return 1
  return differenceInDays(parseISO(e), parseISO(s)) + 1
}

const TABS = [
  { key: 'overview',    label: 'ภาพรวมทีม',      icon: Users },
  { key: 'leave',       label: 'วันลา',            icon: CalendarDays },
  { key: 'commission',  label: 'ค่าคอมรายวัน',   icon: TrendingUp },
  { key: 'pages',       label: 'สถานะเพจ',        icon: BookOpen },
  { key: 'leaveHistory',label: 'ประวัติการลา',   icon: History },
]

export default function TeamDashboard() {
  const { profile } = useAuth()
  const { users, leaves, commissions, pages, approveLeave, rejectLeave, getUserName, getPageName } = useData()

  const [tab,          setTab]          = useState('overview')
  const [expandUid,    setExpandUid]    = useState(null)
  const [filterDate,   setFilterDate]   = useState(today)
  const [filterMonth,  setFilterMonth]  = useState(thisMonth)
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState('')

  if (!['head_admin', 'superadmin'].includes(profile?.role)) {
    return (
      <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:14, padding:'20px 24px', display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:28 }}>🔒</span>
        <span style={{ fontSize:14, color:'#9a3412', fontWeight:700 }}>เฉพาะหัวหน้าแอดมินและผู้ดูแลสูงสุดเท่านั้น</span>
      </div>
    )
  }

  const admins = users.filter(u => ['admin', 'head_admin'].includes(u.role))

  const activeLeaves  = leaves.filter(l => !l.deleted && l.status === 'approved'
    && l.startDate <= today && l.endDate >= today)
  const pendingLeaves = leaves.filter(l => !l.deleted && l.status === 'pending')
  const monthLeaves   = leaves.filter(l => !l.deleted && l.startDate?.startsWith(filterMonth))
  const onLeaveToday  = new Set(activeLeaves.map(l => l.employeeId))
  const dayComms      = commissions.filter(c => c.date === filterDate)

  const adminCommMap = {}
  admins.forEach(u => {
    const cs = dayComms.filter(c => c.adminId === u.id)
    adminCommMap[u.id] = {
      manual: cs.reduce((a,c)=>a+(c.manualOrders||0),0),
      ai:     cs.reduce((a,c)=>a+(c.aiOrders||0),0),
      total:  cs.reduce((a,c)=>a+(c.total||0),0),
      entries:cs.length,
      records:cs,
    }
  })

  const adminLeaveMap = {}
  admins.forEach(u => {
    const ul = leaves.filter(l=>!l.deleted&&l.employeeId===u.id)
    adminLeaveMap[u.id] = {
      isOnLeaveToday: onLeaveToday.has(u.id),
      pending: ul.filter(l=>l.status==='pending').length,
      approved: ul.filter(l=>l.status==='approved').length,
    }
  })

  const adminPageMap = {}
  admins.forEach(u => {
    adminPageMap[u.id] = {
      all:  pages.filter(p=>p.assignedTo?.includes(u.id)),
      main: pages.filter(p=>p.assignedTo?.includes(u.id)&&p.type==='main'),
      test: pages.filter(p=>p.assignedTo?.includes(u.id)&&p.type==='test'),
    }
  })

  const grandDay = Object.values(adminCommMap)
    .reduce((a,v)=>({ total:a.total+v.total, manual:a.manual+v.manual, ai:a.ai+v.ai }), {total:0,manual:0,ai:0})

  const handleApprove = async (id) => {
    setSaving(true)
    try { await approveLeave(id, profile?.id); setMsg('อนุมัติแล้ว') }
    catch(e) {} finally { setSaving(false); setTimeout(()=>setMsg(''),2500) }
  }
  const handleReject = async (id) => {
    setSaving(true)
    try { await rejectLeave(id, profile?.id); setMsg('ปฏิเสธแล้ว') }
    catch(e) {} finally { setSaving(false); setTimeout(()=>setMsg(''),2500) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ══ HERO HEADER ══════════════════════════════════ */}
      <div style={{ background:'linear-gradient(135deg,#1e1b4b,#4338ca,#6366f1)', borderRadius:22, padding:'22px 26px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,.07)' }}/>
        <div style={{ position:'absolute', bottom:-25, left:80, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,.05)' }}/>
        <div style={{ position:'relative' }}>
          <div style={{ fontSize:22, fontWeight:900, color:'#fff', marginBottom:4, display:'flex', alignItems:'center', gap:10 }}>
            🛡️ ศูนย์บัญชาการทีม
          </div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.7)' }}>
            {todayLabel}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10, marginTop:16 }}>
            {[
              { e:'👥', l:'คนในทีม',         v:`${admins.length} คน`,             c:'#c4b5fd' },
              { e:'🌴', l:'ลาวันนี้',         v:`${onLeaveToday.size} คน`,         c:'#fde68a' },
              { e:'⏳', l:'รออนุมัติลา',      v:`${pendingLeaves.length} รายการ`,  c:'#fca5a5' },
              { e:'💰', l:'ค่าคอมวันนี้',     v:`฿${grandDay.total.toLocaleString()}`, c:'#86efac' },
            ].map((k,i)=>(
              <div key={i} style={{ background:'rgba(255,255,255,.12)', borderRadius:14, padding:'12px 14px', border:'1px solid rgba(255,255,255,.12)', backdropFilter:'blur(4px)' }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{k.e}</div>
                <div style={{ fontSize:17, fontWeight:900, color:k.c }}>{k.v}</div>
                <div style={{ fontSize:10.5, color:'rgba(255,255,255,.55)', marginTop:2 }}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {msg && (
        <div style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'1.5px solid #86efac', borderRadius:12, padding:'10px 16px', fontSize:13.5, fontWeight:700, color:'#059669' }}>
          ✅ {msg}
        </div>
      )}

      {/* ── รออนุมัติลา alert ── */}
      {pendingLeaves.length > 0 && (
        <div onClick={() => setTab('leave')}
          style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', border:'2px solid #fde68a', borderRadius:14, padding:'14px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
          <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#d97706,#f59e0b)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>⏳</div>
          <div>
            <div style={{ fontSize:14, fontWeight:900, color:'#b45309' }}>{pendingLeaves.length} รายการรออนุมัติวันลา</div>
            <div style={{ fontSize:12, color:'#92400e', marginTop:2 }}>กดเพื่อดูและอนุมัติ →</div>
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display:'flex', background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', border:'1.5px solid #c7d2fe', borderRadius:14, padding:4, gap:3, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'9px 16px', borderRadius:11, border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit',
              background: tab===t.key ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : 'transparent',
              color: tab===t.key ? '#fff' : '#6366f1',
              display:'flex', alignItems:'center', gap:6, transition:'all .2s',
              boxShadow: tab===t.key ? '0 3px 10px rgba(99,102,241,.3)' : 'none' }}>
            <t.icon size={13}/> {t.label}
            {t.key === 'leave' && pendingLeaves.length > 0 && (
              <span style={{ background:'#ef4444', color:'#fff', borderRadius:99, padding:'1px 7px', fontSize:10, fontWeight:900 }}>
                {pendingLeaves.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW ══════════════════════════════════════ */}
      {tab === 'overview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
            {admins.map((u,ui) => {
              const lv = adminLeaveMap[u.id]
              const cm = adminCommMap[u.id]
              const pg = adminPageMap[u.id]
              const isLeave = lv.isOnLeaveToday
              const gradients = ['linear-gradient(135deg,#6366f1,#7c3aed)','linear-gradient(135deg,#0284c7,#0ea5e9)','linear-gradient(135deg,#059669,#10b981)','linear-gradient(135deg,#d97706,#f59e0b)','linear-gradient(135deg,#be123c,#e11d48)','linear-gradient(135deg,#7c3aed,#a855f7)']
              const grad = gradients[ui % gradients.length]
              return (
                <div key={u.id} style={{ background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 4px 20px rgba(99,102,241,.08)', border:`1.5px solid ${isLeave?'#fde68a':'#e0e7ff'}` }}>
                  {/* color top bar */}
                  <div style={{ height:5, background:isLeave?'linear-gradient(90deg,#d97706,#f59e0b)':grad }}/>
                  <div style={{ padding:'16px 18px' }}>
                    {/* profile row */}
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                      <div style={{ position:'relative' }}>
                        <div style={{ width:48, height:48, borderRadius:'50%', background:grad, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900 }}>
                          {(u.avatar||u.name||'?').slice(0,2)}
                        </div>
                        <div style={{ position:'absolute', bottom:0, right:0, width:13, height:13, borderRadius:'50%', background:isLeave?'#f59e0b':'#22c55e', border:'2px solid #fff' }}/>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:15, fontWeight:900, color:'#1e1b4b' }}>{u.name}</div>
                        <div style={{ fontSize:11.5, color:u.role==='head_admin'?'#d97706':'#6366f1', fontWeight:700, marginTop:2 }}>
                          {u.role==='head_admin'?'👔 หัวหน้าแอดมิน':'👤 แอดมิน'}
                        </div>
                        {isLeave && <div style={{ fontSize:11, color:'#b45309', fontWeight:700, marginTop:2 }}>🟠 ลาวันนี้</div>}
                      </div>
                    </div>

                    {/* KPI strip */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 }}>
                      {[
                        { l:'📄 เพจ',         v:pg.all.length },
                        { l:'💰 ค่าคอมวันนี้', v:`฿${(cm.total||0).toLocaleString()}` },
                        { l:'⏳ รอลา',         v:lv.pending },
                      ].map((k,i)=>(
                        <div key={i} style={{ background:'linear-gradient(135deg,#fafbff,#f0f4ff)', border:'1px solid #e0e7ff', borderRadius:10, padding:'8px 10px', textAlign:'center' }}>
                          <div style={{ fontSize:11, color:'#6b7280', marginBottom:3 }}>{k.l}</div>
                          <div style={{ fontSize:15, fontWeight:900, color:'#1e1b4b' }}>{k.v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Pages */}
                    {pg.all.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
                        {pg.all.map(p=>(
                          <span key={p.id} style={{ background:'#eef2ff', color:'#4338ca', border:'1px solid #c7d2fe', borderRadius:99, padding:'2px 9px', fontSize:11.5, fontWeight:600 }}>
                            {p.type==='main'?'⭐':'🧪'} {p.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {pg.all.length === 0 && (
                      <div style={{ fontSize:12, color:'#9ca3af', marginBottom:12 }}>ยังไม่มีเพจ</div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <button onClick={() => { setTab('commission'); setExpandUid(u.id) }}
                        style={{ background:'linear-gradient(135deg,#eef2ff,#e0e7ff)', border:'1.5px solid #c7d2fe', borderRadius:10, padding:'8px 0', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#4338ca', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                        <TrendingUp size={13}/> ค่าคอม
                      </button>
                      <button onClick={() => { setTab('leave'); setExpandUid(u.id) }}
                        style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', border:'1.5px solid #fde68a', borderRadius:10, padding:'8px 0', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#b45309', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                        <CalendarDays size={13}/> ประวัติลา
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Grand total commission */}
          <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', borderRadius:18, padding:'20px 24px' }}>
            <div style={{ fontSize:14, fontWeight:900, color:'rgba(255,255,255,.8)', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
              💰 ยอดค่าคอมวันนี้ (รวมทีม)
              <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)}
                style={{ marginLeft:'auto', padding:'5px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,.2)', background:'rgba(255,255,255,.1)', color:'#fff', fontSize:12.5, fontFamily:'inherit' }}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[
                { e:'💎', l:'รวมทั้งหมด', v:`฿${grandDay.total.toLocaleString()}`,  c:'#fde68a' },
                { e:'🖐',  l:'ตอบมือ',    v:`${grandDay.manual} บ้าน`,              c:'#c4b5fd' },
                { e:'🤖', l:'AI',         v:`${grandDay.ai} บ้าน`,                  c:'#86efac' },
              ].map((k,i)=>(
                <div key={i} style={{ background:'rgba(255,255,255,.1)', borderRadius:12, padding:'14px', border:'1px solid rgba(255,255,255,.1)' }}>
                  <div style={{ fontSize:22, marginBottom:6 }}>{k.e}</div>
                  <div style={{ fontSize:20, fontWeight:900, color:k.c }}>{k.v}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginTop:3 }}>{k.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ LEAVE ════════════════════════════════════════ */}
      {tab === 'leave' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {pendingLeaves.length === 0 && monthLeaves.length === 0 ? (
            <div style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'1.5px solid #bbf7d0', borderRadius:18, padding:'48px 24px', textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🌴</div>
              <div style={{ fontSize:17, fontWeight:900, color:'#1e1b4b', marginBottom:6 }}>ไม่มีรายการลา</div>
              <div style={{ fontSize:13, color:'#9ca3af' }}>เดือนนี้ยังไม่มีการขอลา</div>
            </div>
          ) : (
            <>
              {pendingLeaves.length > 0 && (
                <div style={{ background:'#fff', borderRadius:18, border:'1.5px solid #fde68a', overflow:'hidden' }}>
                  <div style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', padding:'12px 18px', borderBottom:'1.5px solid #fde68a', fontSize:14, fontWeight:900, color:'#b45309' }}>
                    ⏳ รออนุมัติ ({pendingLeaves.length})
                  </div>
                  <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
                    {pendingLeaves.map(l => (
                      <div key={l.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'linear-gradient(135deg,#fffbeb,#fef9ec)', border:'1.5px solid #fde68a', borderRadius:14, flexWrap:'wrap' }}>
                        <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#d97706,#f59e0b)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, flexShrink:0 }}>
                          {getUserName(l.employeeId).slice(0,2)}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:800, color:'#1e1b4b' }}>{getUserName(l.employeeId)}</div>
                          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                            {l.startDate} — {l.endDate} · {l.reason||'ไม่ระบุเหตุผล'}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:8 }}>
                          <button onClick={() => handleApprove(l.id)} disabled={saving}
                            style={{ background:'linear-gradient(135deg,#059669,#10b981)', border:'none', borderRadius:9, padding:'7px 14px', cursor:'pointer', fontSize:12.5, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                            <CheckCircle size={13}/> อนุมัติ
                          </button>
                          <button onClick={() => handleReject(l.id)} disabled={saving}
                            style={{ background:'linear-gradient(135deg,#be123c,#e11d48)', border:'none', borderRadius:9, padding:'7px 14px', cursor:'pointer', fontSize:12.5, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                            <XCircle size={13}/> ปฏิเสธ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {monthLeaves.filter(l=>l.status!=='pending').length > 0 && (
                <div style={{ background:'#fff', borderRadius:18, border:'1.5px solid #e0e7ff', overflow:'hidden' }}>
                  <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', padding:'12px 18px', borderBottom:'1.5px solid #e0e7ff', fontSize:14, fontWeight:900, color:'#4338ca' }}>
                    📋 ประวัติการลาเดือนนี้
                  </div>
                  <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                    {monthLeaves.filter(l=>l.status!=='pending').map(l => {
                      const st = l.status==='approved'
                        ? {bg:'#f0fdf4',border:'#bbf7d0',c:'#059669',label:'✅ อนุมัติ'}
                        : {bg:'#fff1f2',border:'#fecdd3',c:'#be123c',label:'❌ ปฏิเสธ'}
                      return (
                        <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:st.bg, border:`1.5px solid ${st.border}`, borderRadius:12, flexWrap:'wrap' }}>
                          <div style={{ width:34, height:34, borderRadius:'50%', background:`linear-gradient(135deg,${st.c},${st.c}cc)`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, flexShrink:0 }}>
                            {getUserName(l.employeeId).slice(0,2)}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13.5, fontWeight:700, color:'#1e1b4b' }}>{getUserName(l.employeeId)}</div>
                            <div style={{ fontSize:11.5, color:'#6b7280', marginTop:2 }}>{l.startDate} – {l.endDate}</div>
                          </div>
                          <span style={{ background:st.bg, color:st.c, border:`1px solid ${st.border}`, borderRadius:99, padding:'2px 10px', fontSize:12, fontWeight:700 }}>{st.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ COMMISSION ═══════════════════════════════════ */}
      {tab === 'commission' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:14, fontWeight:900, color:'#1e1b4b' }}>💰 ค่าคอมรายวัน</div>
            <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)}
              style={{ marginLeft:'auto', padding:'7px 11px', borderRadius:9, border:'1.5px solid #c7d2fe', background:'#fafbff', fontSize:13.5, color:'#1e1b4b', fontFamily:'inherit' }}/>
          </div>
          {admins.map(u => {
            const cm = adminCommMap[u.id]
            const isExpand = expandUid === u.id
            return (
              <div key={u.id} style={{ background:'#fff', borderRadius:18, border:'1.5px solid #e0e7ff', overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }} onClick={()=>setExpandUid(isExpand?null:u.id)}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, flexShrink:0 }}>
                    {(u.avatar||u.name||'?').slice(0,2)}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:'#1e1b4b' }}>{u.name}</div>
                    <div style={{ fontSize:12, color:'#6b7280' }}>{cm.entries} รายการ · มือ {cm.manual} · AI {cm.ai}</div>
                  </div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#4338ca' }}>฿{(cm.total||0).toLocaleString()}</div>
                  {isExpand ? <ChevronUp size={16} style={{color:'#9ca3af'}}/> : <ChevronDown size={16} style={{color:'#9ca3af'}}/>}
                </div>
                {isExpand && cm.records.length > 0 && (
                  <div style={{ borderTop:'1px solid #f0f4ff', padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                    {cm.records.map((c,ci)=>(
                      <div key={ci} style={{ background:'linear-gradient(135deg,#fafbff,#f0f4ff)', borderRadius:12, padding:'10px 14px', display:'flex', gap:10, flexWrap:'wrap' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12.5, fontWeight:700, color:'#4338ca' }}>{getPageName(c.pageId)}</div>
                          <div style={{ fontSize:11.5, color:'#6b7280', marginTop:2 }}>มือ {c.manualOrders||0} · AI {c.aiOrders||0} · {c.shift==='night'?'🌙 กะดึก':'☀️ กลางวัน'}</div>
                        </div>
                        <div style={{ fontSize:15, fontWeight:900, color:'#6366f1' }}>฿{(c.total||0).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══ PAGES ════════════════════════════════════════ */}
      {tab === 'pages' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
          {admins.map((u,ui) => {
            const pg = adminPageMap[u.id]
            const colors = ['#6366f1','#0284c7','#059669','#d97706','#be123c','#7c3aed']
            const col = colors[ui%colors.length]
            return (
              <div key={u.id} style={{ background:'#fff', borderRadius:18, border:`1.5px solid ${col}22`, borderLeft:`5px solid ${col}`, overflow:'hidden', boxShadow:`0 2px 12px ${col}12` }}>
                <div style={{ padding:'14px 16px', borderBottom:'1px solid #f0f4ff', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg,${col},${col}cc)`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900 }}>
                    {(u.avatar||u.name||'?').slice(0,2)}
                  </div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800, color:'#1e1b4b' }}>{u.name}</div>
                    <div style={{ fontSize:11.5, color:'#6b7280' }}>{pg.all.length} เพจ</div>
                  </div>
                </div>
                <div style={{ padding:'12px 14px' }}>
                  {pg.all.length === 0
                    ? <div style={{ fontSize:12.5, color:'#9ca3af', textAlign:'center', padding:'12px 0' }}>ยังไม่มีเพจที่รับผิดชอบ</div>
                    : <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                        {pg.all.map(p=>(
                          <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', background:'linear-gradient(135deg,#fafbff,#f0f4ff)', borderRadius:12, border:'1px solid #e0e7ff' }}>
                            <PageBadge page={p} size='sm'/>
                            <span style={{ marginLeft:'auto', background:p.status==='active'?'#f0fdf4':'#fff1f2', color:p.status==='active'?'#059669':'#be123c', border:`1px solid ${p.status==='active'?'#bbf7d0':'#fecdd3'}`, borderRadius:99, padding:'2px 9px', fontSize:11.5, fontWeight:700, flexShrink:0 }}>
                              {p.status==='active'?'🟢 ใช้งาน':'🔴 ปิด'}
                            </span>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══ LEAVE HISTORY ════════════════════════════════ */}
      {tab === 'leaveHistory' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:14, fontWeight:900, color:'#1e1b4b' }}>📋 ประวัติการลาทั้งหมด</div>
            <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
              style={{ marginLeft:'auto', padding:'7px 11px', borderRadius:9, border:'1.5px solid #c7d2fe', background:'#fafbff', fontSize:13.5, color:'#1e1b4b', fontFamily:'inherit' }}/>
          </div>
          {admins.map((u,ui)=>{
            const ul = monthLeaves.filter(l=>l.employeeId===u.id)
            if (ul.length===0) return null
            const colors = ['#6366f1','#0284c7','#059669','#d97706','#be123c','#7c3aed']
            const col = colors[ui%colors.length]
            return (
              <div key={u.id} style={{ background:'#fff', borderRadius:18, border:'1.5px solid #e0e7ff', overflow:'hidden' }}>
                <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', padding:'12px 18px', borderBottom:'1.5px solid #e0e7ff', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${col},${col}cc)`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900 }}>
                    {(u.avatar||u.name).slice(0,2)}
                  </div>
                  <span style={{ fontSize:14, fontWeight:800, color:'#1e1b4b' }}>{u.name}</span>
                  <span style={{ background:'#eef2ff', color:'#4338ca', border:'1px solid #c7d2fe', borderRadius:99, padding:'1px 8px', fontSize:12, fontWeight:700, marginLeft:'auto' }}>{ul.length} รายการ</span>
                </div>
                <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
                  {ul.map(l=>{
                    const st = l.status==='approved'?{c:'#059669',bg:'#f0fdf4',b:'#bbf7d0',e:'✅'}:l.status==='pending'?{c:'#b45309',bg:'#fffbeb',b:'#fde68a',e:'⏳'}:{c:'#be123c',bg:'#fff1f2',b:'#fecdd3',e:'❌'}
                    return (
                      <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:st.bg, border:`1px solid ${st.b}`, borderRadius:11 }}>
                        <span style={{ fontSize:16 }}>{st.e}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12.5, fontWeight:700, color:'#1e1b4b' }}>{l.startDate}{l.startDate!==l.endDate?` – ${l.endDate}`:''}</div>
                          <div style={{ fontSize:11.5, color:'#6b7280', marginTop:1 }}>{l.reason||'ไม่ระบุ'}</div>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color:st.c }}>{l.status==='approved'?'อนุมัติ':l.status==='pending'?'รอ':'ปฏิเสธ'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
