import React, { useState, useMemo } from 'react'
import { format, parseISO, differenceInMinutes, startOfMonth, endOfMonth, eachDayOfInterval, addDays, subDays } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { useNotify } from '../../hooks/useNotify'
import { LogIn, LogOut, Sun, Moon, Clock, Users, CheckCircle2, History, BarChart3, ChevronLeft, ChevronRight, X } from 'lucide-react'

const todayStr   = format(new Date(), 'yyyy-MM-dd')
const nowHour    = new Date().getHours()
const nowMin     = new Date().getMinutes()
const nowTotal   = nowHour * 60 + nowMin  // นาทีตั้งแต่ 00:00

// กะกลางวัน 06:00–20:00 (360–1200), กะกลางคืน 20:00–06:00
const defaultShift = (nowTotal >= 360 && nowTotal < 1200) ? 'day' : 'night'

// ── กะ ──────────────────────────────────────────────
const SHIFTS = {
  day:   { label:'☀️ กะกลางวัน',  short:'กลางวัน',  range:'06:00–20:00', color:'#d97706', bg:'#fffbeb', border:'#fde68a', dark:'#92400e' },
  night: { label:'🌙 กะกลางคืน', short:'กลางคืน', range:'20:00–06:00', color:'#4338ca', bg:'#eef2ff', border:'#c7d2fe', dark:'#312e81' },
}

// ── Helpers ─────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return '—'
  try { return format(ts.toDate ? ts.toDate() : new Date(ts), 'HH:mm') } catch { return '—' }
}

function calcDuration(inTs, outTs) {
  if (!inTs || !outTs) return null
  try {
    const a = inTs.toDate  ? inTs.toDate()  : new Date(inTs)
    const b = outTs.toDate ? outTs.toDate() : new Date(outTs)
    const mins = differenceInMinutes(b, a)
    if (mins < 0) return null
    const h = Math.floor(mins / 60), m = mins % 60
    return { mins, label: h > 0 ? `${h}ชม.${m > 0 ? ` ${m}น.` : ''}` : `${m}น.` }
  } catch { return null }
}

function fmtDateTH(dateStr) {
  try { return format(parseISO(dateStr), 'd MMM yyyy', { locale: th }) } catch { return dateStr }
}

function fmtMonthTH(ym) {
  try { return format(parseISO(ym + '-01'), 'MMMM yyyy', { locale: th }) } catch { return ym }
}

// ── Component ────────────────────────────────────────
export default function CheckIn() {
  const { profile, user } = useAuth()
  const { pages, checkins, users, doCheckin, doCheckout, getUserName } = useData()
  const { notifyCustom } = useNotify()

  const myUid  = user?.uid || profile?.id || ''
  const isHead = ['head_admin','superadmin'].includes(profile?.role)
  const isAdmin = profile?.role === 'admin'
  const myPages = isAdmin
    ? pages.filter(p => p.assignedTo?.includes(myUid) && p.status === 'active')
    : pages.filter(p => p.status === 'active')

  const [tab,          setTab]          = useState('checkin')
  const [selectedShift,setSelectedShift]= useState(defaultShift)
  const [selectedPages,setSelectedPages]= useState([])   // multi-page
  const [saving,       setSaving]       = useState(false)
  const [histDate,     setHistDate]     = useState(todayStr)
  const [histMonth,    setHistMonth]    = useState(format(new Date(), 'yyyy-MM'))
  const [summaryMode,  setSummaryMode]  = useState('day')  // day | month
  const [expandAdmin,  setExpandAdmin]  = useState(null)

  // ── My active checkins today ──────────────────────
  const myActive = checkins.filter(c =>
    c.userId === myUid && c.status === 'active' && c.date === todayStr
  )
  const myActivePageIds = new Set(myActive.map(c => c.pageId))

  // ── Live: all active checkins today ───────────────
  const liveToday = checkins.filter(c => c.date === todayStr && c.status === 'active')

  // ── Toggle page selection ─────────────────────────
  const togglePage = (pageId) => {
    if (myActivePageIds.has(pageId)) return  // already checked in
    setSelectedPages(p =>
      p.includes(pageId) ? p.filter(id => id !== pageId) : [...p, pageId]
    )
  }

  // ── Check-in (หลาย page พร้อมกัน) ────────────────
  const handleCheckin = async () => {
    if (!selectedPages.length) return
    setSaving(true)
    try {
      await Promise.all(selectedPages.map(pageId =>
        doCheckin({ userId: myUid, pageId, shift: selectedShift, date: todayStr })
      ))
      const names = selectedPages.map(id => pages.find(p => p.id === id)?.name || id).join(', ')
      notifyCustom({
        type: 'system',
        title: `${SHIFTS[selectedShift].label} ${profile?.name} เช็คอิน`,
        message: `${profile?.name} เช็คอิน ${selectedPages.length} เพจ: ${names}`,
        link: '/checkin',
        targetRoles: ['superadmin', 'head_admin'],
      })
      setSelectedPages([])
    } catch(e) { console.error(e) } finally { setSaving(false) }
  }

  // ── Check-out ─────────────────────────────────────
  const handleCheckout = async (checkinId, pageId) => {
    setSaving(true)
    try {
      await doCheckout(checkinId)
      notifyCustom({
        type: 'system',
        title: `🚪 ${profile?.name} เช็คเอาท์`,
        message: `${profile?.name} ออกจาก ${pages.find(p=>p.id===pageId)?.name || pageId}`,
        link: '/checkin',
        targetRoles: ['superadmin','head_admin'],
      })
    } catch(e) { console.error(e) } finally { setSaving(false) }
  }

  // ── History: checkins on selected date ────────────
  const histCheckins = useMemo(() => {
    const base = isAdmin
      ? checkins.filter(c => c.userId === myUid)
      : checkins
    return base.filter(c => c.date === histDate)
      .sort((a,b) => {
        const ta = a.checkinTime?.toDate?.() || new Date(a.checkinTime||0)
        const tb = b.checkinTime?.toDate?.() || new Date(b.checkinTime||0)
        return ta - tb
      })
  }, [checkins, histDate, isAdmin, myUid])

  // ── Summary: per-admin stats ──────────────────────
  const summaryData = useMemo(() => {
    const admins = users.filter(u => ['admin','head_admin'].includes(u.role))
    const base   = summaryMode === 'day'
      ? checkins.filter(c => c.date === histDate)
      : checkins.filter(c => c.date?.startsWith(histMonth))

    return admins.map(u => {
      const myC = base.filter(c => c.userId === u.id)
      const completed = myC.filter(c => c.checkoutTime)
      const totalMins = completed.reduce((acc, c) => {
        const d = calcDuration(c.checkinTime, c.checkoutTime)
        return acc + (d?.mins || 0)
      }, 0)
      const uniquePages = [...new Set(myC.map(c => c.pageId))]
      const dayShifts   = myC.filter(c => c.shift === 'day').length
      const nightShifts = myC.filter(c => c.shift === 'night').length
      return {
        ...u, myC, uniquePages,
        totalMins, dayShifts, nightShifts,
        totalHrs: totalMins > 0 ? `${Math.floor(totalMins/60)}ชม.${totalMins%60>0?` ${totalMins%60}น.`:''}` : '—',
      }
    }).filter(u => u.myC.length > 0 || isHead)
      .sort((a,b) => b.totalMins - a.totalMins)
  }, [checkins, users, summaryMode, histDate, histMonth, isHead])

  // ── Live page grid data ───────────────────────────
  const livePages = useMemo(() => pages
    .filter(p => p.status === 'active')
    .map(p => {
      const active = liveToday.filter(c => c.pageId === p.id)
      return { ...p, active }
    })
    .sort((a,b) => b.active.length - a.active.length),
    [pages, liveToday])

  const S = { background:'#fff', border:'1.5px solid #dde3f5', borderRadius:10, color:'#1e1b4b', fontFamily:'inherit', fontSize:13.5, padding:'9px 12px', outline:'none', width:'100%' }
  const TABS = [
    { k:'checkin',  label:'🏁 เช็คอิน/เอาท์' },
    { k:'live',     label:`🟢 Live (${liveToday.length})` },
    { k:'history',  label:'📜 ประวัติ' },
    { k:'summary',  label:'📊 สรุป' },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize:20, fontWeight:900, color:'#1e1b4b', marginBottom:3 }}>
          🏁 ระบบสถานะกะ / เพจ
        </h2>
        <p style={{ fontSize:12.5, color:'#6b7280' }}>
          📅 {format(new Date(), 'EEEE d MMMM yyyy', { locale:th })} ·
          ออนไลน์อยู่ {liveToday.length} คน
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:12, padding:4, gap:3, width:'fit-content', flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding:'8px 16px', borderRadius:9, border:'none', cursor:'pointer', fontSize:13.5, fontWeight:700, fontFamily:'inherit',
              background: tab===t.k ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : 'transparent',
              color: tab===t.k ? '#fff' : '#6366f1', whiteSpace:'nowrap',
              boxShadow: tab===t.k ? '0 3px 10px rgba(99,102,241,.3)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════ TAB: CHECK-IN ═══════════ */}
      {tab === 'checkin' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* My active sessions */}
          {myActive.length > 0 && (
            <div style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'2px solid #86efac', borderRadius:16, padding:18 }}>
              <div style={{ fontSize:14, fontWeight:900, color:'#059669', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                <CheckCircle2 size={17}/> กำลังทำงานอยู่ {myActive.length} เพจ
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                {myActive.map(c => {
                  const pg = pages.find(p => p.id === c.pageId)
                  const sh = SHIFTS[c.shift]
                  return (
                    <div key={c.id} style={{ background:'#fff', border:'1.5px solid #86efac', borderRadius:14, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, minWidth:200 }}>
                      <div>
                        <div style={{ fontSize:20 }}>{sh?.label.split(' ')[0]}</div>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:'#1e1b4b' }}>{pg?.name || '?'}</div>
                        <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>
                          {sh?.short} · เข้า {fmtTime(c.checkinTime)}
                        </div>
                      </div>
                      <button onClick={() => handleCheckout(c.id, c.pageId)} disabled={saving}
                        style={{ background:'linear-gradient(135deg,#e11d48,#f43f5e)', border:'none', borderRadius:9, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                        <LogOut size={13}/> เช็คเอาท์
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Check-in form */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:18, padding:22, boxShadow:'0 4px 16px rgba(99,102,241,.08)' }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#1e1b4b', marginBottom:18, display:'flex', alignItems:'center', gap:8 }}>
              <LogIn size={17} style={{ color:'#6366f1' }}/> เช็คอินเพจ
            </div>

            {/* Shift picker */}
            <div style={{ marginBottom:18 }}>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                เลือกกะการทำงาน
              </label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {Object.entries(SHIFTS).map(([k, sh]) => (
                  <button key={k} onClick={() => setSelectedShift(k)}
                    style={{ padding:'16px', borderRadius:13, cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                      border: `2px solid ${selectedShift===k ? sh.color : sh.border}`,
                      background: selectedShift===k ? sh.bg : '#fff',
                      transition:'all .15s' }}>
                    <div style={{ fontSize:22, marginBottom:6 }}>{sh.label.split(' ')[0]}</div>
                    <div style={{ fontSize:14, fontWeight:900, color:selectedShift===k ? sh.dark : '#6b7280' }}>{sh.label}</div>
                    <div style={{ fontSize:12, color:'#9ca3af', marginTop:3 }}>{sh.range}</div>
                    {k === 'night' && (
                      <div style={{ fontSize:11, color:'#6366f1', marginTop:5, fontWeight:600 }}>
                        💡 กะข้ามวัน บันทึกใต้วันที่เริ่มกะ
                      </div>
                    )}
                    {selectedShift===k && (
                      <div style={{ fontSize:11, color:sh.dark, fontWeight:800, marginTop:6 }}>✓ เลือกแล้ว</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Page multi-select */}
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                เลือกเพจ (เลือกได้หลายเพจพร้อมกัน)
              </label>
              {myPages.length === 0 ? (
                <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:10, padding:'12px 14px', color:'#9a3412', fontSize:13 }}>
                  ⚠️ ไม่มีเพจที่รับผิดชอบ — ติดต่อหัวหน้าแอดมิน
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
                  {myPages.map(p => {
                    const alreadyIn = myActivePageIds.has(p.id)
                    const selected  = selectedPages.includes(p.id)
                    return (
                      <button key={p.id}
                        onClick={() => !alreadyIn && togglePage(p.id)}
                        disabled={alreadyIn}
                        style={{
                          padding:'12px 14px', borderRadius:12, cursor:alreadyIn?'not-allowed':'pointer',
                          textAlign:'left', fontFamily:'inherit',
                          border:`1.5px solid ${selected?'#6366f1':alreadyIn?'#bbf7d0':'#dde3f5'}`,
                          background:selected?'linear-gradient(135deg,#eef2ff,#e0e7ff)':alreadyIn?'#f0fdf4':'#fff',
                          opacity:alreadyIn?.75:1, transition:'all .15s',
                          position:'relative',
                        }}>
                        <div style={{ fontSize:15, marginBottom:4 }}>
                          {p.type==='main'?'⭐':'🧪'}
                        </div>
                        <div style={{ fontSize:13.5, fontWeight:700, color:selected?'#4338ca':alreadyIn?'#059669':'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {p.name}
                        </div>
                        {alreadyIn && (
                          <div style={{ fontSize:11, color:'#059669', fontWeight:700, marginTop:3 }}>✅ ทำงานอยู่</div>
                        )}
                        {selected && !alreadyIn && (
                          <div style={{ fontSize:11, color:'#4338ca', fontWeight:700, marginTop:3 }}>☑️ เลือกแล้ว</div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
              {selectedPages.length > 0 && (
                <div style={{ marginTop:10, background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:9, padding:'8px 14px', fontSize:13, color:'#4338ca', fontWeight:600 }}>
                  เลือก {selectedPages.length} เพจ: {selectedPages.map(id=>pages.find(p=>p.id===id)?.name||id).join(', ')}
                </div>
              )}
            </div>

            <button onClick={handleCheckin}
              disabled={!selectedPages.length || saving}
              style={{
                background: selectedPages.length ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : '#e5e7eb',
                border:'none', borderRadius:12, padding:'12px 28px', cursor:selectedPages.length?'pointer':'not-allowed',
                fontSize:15, fontWeight:900, color:selectedPages.length?'#fff':'#9ca3af',
                fontFamily:'inherit', display:'flex', alignItems:'center', gap:8,
                boxShadow: selectedPages.length ? '0 4px 14px rgba(99,102,241,.35)' : 'none',
                transition:'all .2s',
              }}>
              <LogIn size={16}/>
              {saving ? 'กำลังเช็คอิน...' : `เช็คอิน ${selectedPages.length > 0 ? selectedPages.length+' เพจ' : ''}`}
            </button>
          </div>

          {/* Today's my checkin history */}
          {checkins.filter(c => c.userId === myUid && c.date === todayStr).length > 0 && (
            <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
              <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', padding:'12px 18px', borderBottom:'1.5px solid #e0e7ff', fontSize:14, fontWeight:800, color:'#4338ca' }}>
                📋 บันทึกวันนี้ของฉัน
              </div>
              <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1.5px solid #f0f4ff' }}>
                      {['เพจ','กะ','เวลาเข้า','เวลาออก','รวม','สถานะ'].map((h,i)=>(
                        <th key={i} style={{ padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {checkins.filter(c => c.userId === myUid && c.date === todayStr)
                      .sort((a,b)=>(a.checkinTime?.toDate?.()?.getTime()||0)-(b.checkinTime?.toDate?.()?.getTime()||0))
                      .map(c => {
                        const dur = calcDuration(c.checkinTime, c.checkoutTime)
                        const sh  = SHIFTS[c.shift]
                        return (
                          <tr key={c.id} style={{ borderBottom:'1px solid #f0f4ff' }}>
                            <td style={{ padding:'10px 14px', fontSize:13.5, fontWeight:700, color:'#1e1b4b' }}>
                              {pages.find(p=>p.id===c.pageId)?.name || '?'}
                            </td>
                            <td style={{ padding:'10px 14px' }}>
                              <span style={{ background:sh.bg, color:sh.dark, border:`1.5px solid ${sh.border}`, borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
                                {sh.label}
                              </span>
                            </td>
                            <td style={{ padding:'10px 14px', fontSize:14, fontWeight:700, color:'#059669' }}>{fmtTime(c.checkinTime)}</td>
                            <td style={{ padding:'10px 14px', fontSize:14, fontWeight:700, color:'#be123c' }}>{fmtTime(c.checkoutTime)}</td>
                            <td style={{ padding:'10px 14px', fontSize:13, fontWeight:700, color:'#4338ca' }}>{dur?.label || '—'}</td>
                            <td style={{ padding:'10px 14px' }}>
                              {c.status === 'active'
                                ? <span style={{ background:'#dcfce7', color:'#059669', border:'1.5px solid #bbf7d0', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:800 }}>🟢 ทำงานอยู่</span>
                                : <span style={{ background:'#f1f5f9', color:'#6b7280', border:'1.5px solid #e5e7eb', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>✅ เสร็จแล้ว</span>
                              }
                            </td>
                          </tr>
                        )
                      })
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB: LIVE ═══════════ */}
      {tab === 'live' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ fontSize:13, color:'#6b7280', display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 0 3px rgba(34,197,94,.2)', animation:'pulse 2s infinite' }}/>
            อัพเดทแบบเรียลไทม์ · {format(new Date(),'HH:mm:ss')}
            <style>{`@keyframes pulse{0%,100%{box-shadow:0 0 0 3px rgba(34,197,94,.2)}50%{box-shadow:0 0 0 6px rgba(34,197,94,.1)}}`}</style>
          </div>

          {/* Live page cards grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
            {livePages.map(p => (
              <div key={p.id} style={{
                background:'#fff', borderRadius:16,
                border:`1.5px solid ${p.active.length>0?'#86efac':'#e0e7ff'}`,
                borderTop:`4px solid ${p.active.length>0?'#22c55e':'#e0e7ff'}`,
                padding:18, boxShadow:'0 2px 8px rgba(0,0,0,.04)',
                transition:'all .2s',
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:900, color:'#1e1b4b' }}>{p.type==='main'?'⭐':'🧪'} {p.name}</div>
                    <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>
                      {p.type==='main'?'เพจหลัก':'เพจทดสอบ'}
                    </div>
                  </div>
                  <span style={{
                    background: p.active.length>0?'#dcfce7':'#f1f5f9',
                    color: p.active.length>0?'#059669':'#9ca3af',
                    border:`1.5px solid ${p.active.length>0?'#bbf7d0':'#e5e7eb'}`,
                    borderRadius:99, padding:'4px 12px', fontSize:12.5, fontWeight:800,
                  }}>
                    {p.active.length>0 ? `🟢 ${p.active.length} คน` : '⚫ ว่าง'}
                  </span>
                </div>

                {p.active.length > 0 ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {p.active.map(c => {
                      const sh = SHIFTS[c.shift]
                      return (
                        <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, background:'#f9fafb', borderRadius:10, padding:'9px 12px', border:'1px solid #f0f4ff' }}>
                          <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, flexShrink:0 }}>
                            {getUserName(c.userId).slice(0,2)}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13.5, fontWeight:700, color:'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {getUserName(c.userId)}
                            </div>
                            <div style={{ fontSize:11.5, color:'#9ca3af', display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
                              <span style={{ background:sh.bg, color:sh.dark, borderRadius:99, padding:'1px 7px', fontWeight:700, fontSize:11 }}>{sh.label.split(' ')[0]} {sh.short}</span>
                              เข้า {fmtTime(c.checkinTime)}
                            </div>
                          </div>
                          {(c.userId === myUid || isHead) && (
                            <button onClick={() => handleCheckout(c.id, c.pageId)} disabled={saving}
                              style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontSize:12, fontWeight:800, color:'#be123c', fontFamily:'inherit' }}>
                              ออก
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign:'center', padding:'12px 0', color:'#d1d5db', fontSize:13 }}>
                    ไม่มีแอดมิน
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Live summary strip */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:14, padding:'14px 20px' }}>
            <div style={{ fontSize:13.5, fontWeight:800, color:'#1e1b4b', marginBottom:10 }}>👥 สรุปแอดมินที่ Online ตอนนี้</div>
            {liveToday.length === 0 ? (
              <div style={{ color:'#9ca3af', fontSize:13 }}>ยังไม่มีใครเช็คอิน</div>
            ) : (
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {[...new Set(liveToday.map(c=>c.userId))].map(uid => {
                  const myC = liveToday.filter(c=>c.userId===uid)
                  return (
                    <div key={uid} style={{ background:'#f0fdf4', border:'1.5px solid #bbf7d0', borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>
                        {getUserName(uid).slice(0,2)}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'#1e1b4b' }}>{getUserName(uid)}</div>
                        <div style={{ fontSize:11, color:'#059669' }}>{myC.length} เพจ · {myC.map(c=>SHIFTS[c.shift]?.label.split(' ')[0]).join(' ')}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ TAB: HISTORY ═══════════ */}
      {tab === 'history' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Date picker + nav */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:14, padding:'14px 18px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <button onClick={() => setHistDate(format(subDays(parseISO(histDate),1),'yyyy-MM-dd'))}
              style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6366f1' }}>
              <ChevronLeft size={16}/>
            </button>
            <div style={{ textAlign:'center', flex:1 }}>
              <div style={{ fontSize:16, fontWeight:900, color:'#1e1b4b' }}>
                {histDate === todayStr ? '📅 วันนี้' : fmtDateTH(histDate)}
              </div>
            </div>
            <button onClick={() => setHistDate(format(addDays(parseISO(histDate),1),'yyyy-MM-dd'))}
              style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6366f1' }}>
              <ChevronRight size={16}/>
            </button>
            <input type="date" style={{ ...S, width:'auto' }} value={histDate} onChange={e=>setHistDate(e.target.value)}/>
            {histDate !== todayStr && (
              <button onClick={() => setHistDate(todayStr)}
                style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:9, padding:'8px 14px', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#4338ca', fontFamily:'inherit' }}>
                วันนี้
              </button>
            )}
          </div>

          {/* History table */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', padding:'12px 18px', borderBottom:'1.5px solid #e0e7ff', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:14, fontWeight:800, color:'#4338ca' }}>
                📜 ประวัติ {fmtDateTH(histDate)} — {histCheckins.length} รายการ
              </span>
            </div>
            {histCheckins.length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px 20px', color:'#9ca3af' }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📋</div>
                <div style={{ fontSize:14, color:'#6b7280', fontWeight:600 }}>ไม่มีข้อมูลวันที่เลือก</div>
              </div>
            ) : (
              <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'2px solid #e0e7ff' }}>
                      {['แอดมิน','เพจ','กะ','เวลาเข้า','เวลาออก','รวมเวลา','สถานะ'].map((h,i)=>(
                        <th key={i} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap', background:'linear-gradient(135deg,#eef2ff,#f5f3ff)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {histCheckins.map(c => {
                      const dur = calcDuration(c.checkinTime, c.checkoutTime)
                      const sh  = SHIFTS[c.shift]
                      return (
                        <tr key={c.id} style={{ borderBottom:'1px solid #f0f4ff' }}>
                          <td style={{ padding:'11px 14px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                                {getUserName(c.userId).slice(0,2)}
                              </div>
                              <span style={{ fontSize:13.5, fontWeight:700, color:'#1e1b4b' }}>{getUserName(c.userId)}</span>
                            </div>
                          </td>
                          <td style={{ padding:'11px 14px', fontSize:13.5, fontWeight:600, color:'#4b5563' }}>
                            {pages.find(p=>p.id===c.pageId)?.name || '?'}
                          </td>
                          <td style={{ padding:'11px 14px' }}>
                            <span style={{ background:sh.bg, color:sh.dark, border:`1.5px solid ${sh.border}`, borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
                              {sh.label}
                            </span>
                          </td>
                          <td style={{ padding:'11px 14px', fontSize:14, fontWeight:700, color:'#059669' }}>{fmtTime(c.checkinTime)}</td>
                          <td style={{ padding:'11px 14px', fontSize:14, fontWeight:700, color:'#be123c' }}>{fmtTime(c.checkoutTime)}</td>
                          <td style={{ padding:'11px 14px', fontSize:13.5, fontWeight:800, color:'#4338ca' }}>
                            {dur ? dur.label : c.status==='active'?<span style={{color:'#059669'}}>กำลังทำงาน...</span>:'—'}
                          </td>
                          <td style={{ padding:'11px 14px' }}>
                            {c.status==='active'
                              ? <span style={{ background:'#dcfce7', color:'#059669', border:'1.5px solid #bbf7d0', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:800 }}>🟢 Active</span>
                              : <span style={{ background:'#f1f5f9', color:'#6b7280', border:'1.5px solid #e5e7eb', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>✅ Done</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ TAB: SUMMARY ═══════════ */}
      {tab === 'summary' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Mode + date picker */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:14, padding:'14px 18px', display:'flex', flexWrap:'wrap', alignItems:'center', gap:12 }}>
            <div style={{ display:'flex', background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:10, padding:3, gap:3 }}>
              {[{k:'day',label:'📅 รายวัน'},{k:'month',label:'📆 รายเดือน'}].map(m=>(
                <button key={m.k} onClick={()=>setSummaryMode(m.k)}
                  style={{ padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', background:summaryMode===m.k?'linear-gradient(135deg,#6366f1,#7c3aed)':'transparent', color:summaryMode===m.k?'#fff':'#6366f1' }}>
                  {m.label}
                </button>
              ))}
            </div>
            {summaryMode === 'day' ? (
              <input type="date" style={{ ...S, width:'auto' }} value={histDate} onChange={e=>setHistDate(e.target.value)}/>
            ) : (
              <input type="month" style={{ ...S, width:'auto' }} value={histMonth} onChange={e=>setHistMonth(e.target.value)}/>
            )}
            <div style={{ fontSize:13, color:'#6b7280', fontWeight:600 }}>
              {summaryMode==='day' ? fmtDateTH(histDate) : fmtMonthTH(histMonth)}
            </div>
          </div>

          {/* Per-admin summary cards */}
          {summaryData.length === 0 ? (
            <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:36, textAlign:'center', color:'#9ca3af' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📊</div>
              <div style={{ fontSize:14, color:'#6b7280', fontWeight:600 }}>ไม่มีข้อมูลช่วงเวลานี้</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {summaryData.map(u => (
                <div key={u.id} style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
                  {/* Header row */}
                  <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:14, padding:'14px 18px', cursor:'pointer', background: expandAdmin===u.id?'#fafbff':'#fff' }}
                    onClick={() => setExpandAdmin(expandAdmin===u.id?null:u.id)}>
                    <div style={{ width:42, height:42, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, flexShrink:0 }}>
                      {(u.avatar||u.name||'?').slice(0,2)}
                    </div>
                    <div style={{ flex:1, minWidth:120 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:'#1e1b4b' }}>{u.name}</div>
                      <div style={{ fontSize:12, color:'#9ca3af', marginTop:1 }}>{ROLES[u.role]}</div>
                    </div>
                    {/* Mini stats */}
                    <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
                      {[
                        { label:'เพจที่ดูแล',   val:u.uniquePages.length, color:'#4338ca', suffix:'เพจ' },
                        { label:'กะกลางวัน',  val:u.dayShifts,  color:'#b45309', suffix:'กะ', icon:'☀️' },
                        { label:'กะกลางคืน', val:u.nightShifts, color:'#4338ca', suffix:'กะ', icon:'🌙' },
                        { label:'รวมเวลา',    val:u.totalHrs,    color:'#7c3aed', suffix:'' },
                      ].map((s,i) => (
                        <div key={i} style={{ textAlign:'center', minWidth:70 }}>
                          <div style={{ fontSize:11, color:'#9ca3af', marginBottom:3 }}>{s.icon||''} {s.label}</div>
                          <div style={{ fontSize:16, fontWeight:900, color:s.color }}>{s.val}<span style={{ fontSize:11, marginLeft:2 }}>{s.suffix}</span></div>
                        </div>
                      ))}
                    </div>
                    <div style={{ color:'#c7d2fe', fontSize:16 }}>{expandAdmin===u.id?'▲':'▼'}</div>
                  </div>

                  {/* Expanded: detail checkins */}
                  {expandAdmin === u.id && (
                    <div style={{ borderTop:'1.5px solid #f0f4ff', background:'#fafbff' }}>
                      <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
                        <table style={{ width:'100%', borderCollapse:'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom:'1.5px solid #e0e7ff' }}>
                              {['วันที่','เพจ','กะ','เข้า','ออก','รวม'].map((h,i)=>(
                                <th key={i} style={{ padding:'8px 14px', textAlign:'left', fontSize:11, fontWeight:800, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {u.myC.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(c => {
                              const dur = calcDuration(c.checkinTime, c.checkoutTime)
                              const sh  = SHIFTS[c.shift]
                              return (
                                <tr key={c.id} style={{ borderBottom:'1px solid #f0f4ff' }}>
                                  <td style={{ padding:'9px 14px', fontSize:13, color:'#6b7280' }}>{c.date}</td>
                                  <td style={{ padding:'9px 14px', fontSize:13.5, fontWeight:600, color:'#1e1b4b' }}>{pages.find(p=>p.id===c.pageId)?.name||'?'}</td>
                                  <td style={{ padding:'9px 14px' }}>
                                    <span style={{ background:sh.bg, color:sh.dark, borderRadius:99, padding:'2px 9px', fontSize:11.5, fontWeight:700 }}>{sh.label}</span>
                                  </td>
                                  <td style={{ padding:'9px 14px', fontSize:13.5, fontWeight:700, color:'#059669' }}>{fmtTime(c.checkinTime)}</td>
                                  <td style={{ padding:'9px 14px', fontSize:13.5, fontWeight:700, color:'#be123c' }}>{fmtTime(c.checkoutTime)}</td>
                                  <td style={{ padding:'9px 14px', fontSize:13.5, fontWeight:800, color:'#4338ca' }}>{dur?.label||'—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
