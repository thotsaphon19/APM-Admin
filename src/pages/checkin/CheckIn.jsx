import React, { useState, useMemo } from 'react'
import { format, parseISO, differenceInMinutes, startOfMonth, endOfMonth, eachDayOfInterval, addDays, subDays } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import PageBadge from '../../components/ui/PageBadge'
import { useNotify } from '../../hooks/useNotify'
import { LogIn, LogOut, Sun, Moon, Clock, Users, CheckCircle2, History, BarChart3, ChevronLeft, ChevronRight, X } from 'lucide-react'

const todayStr   = format(new Date(), 'yyyy-MM-dd')
const nowHour    = new Date().getHours()
const nowMin     = new Date().getMinutes()
const nowTotal   = nowHour * 60 + nowMin  // นาทีตั้งแต่ 00:00

// กะกลางวัน 05:00–22:30 (300–1350), กะดึก 22:30–05:00
const defaultShift = (nowTotal >= 300 && nowTotal < 1350) ? 'day' : 'night'

// บล็อคเช็คอินหลัง 09:00 (540 นาที)
const CHECKIN_CUTOFF = 9 * 60  // 09:00

// ── กะ ──────────────────────────────────────────────
const SHIFTS = {
  day:   { label:'☀️ กะกลางวัน',  short:'กลางวัน',  range:'05:00–22:30', color:'#d97706', bg:'#fffbeb', border:'#fde68a', dark:'#92400e' },
  night: { label:'🌙 กะดึก',      short:'กะดึก',    range:'22:30–05:00', color:'#4338ca', bg:'#eef2ff', border:'#c7d2fe', dark:'#312e81' },
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
  const { profile, user, isSuperAdmin, canManage, canAudit } = useAuth()
  const canSeeAll2 = isSuperAdmin || canManage || canAudit || profile?.role === 'assistant'


  const { pages, checkins, users, doCheckin, doCheckout, getUserName } = useData()
  const { notifyCustom } = useNotify()

  const myUid  = user?.uid || profile?.id || ''
  const isHead = ['head_admin','superadmin'].includes(profile?.role)
  const isAdmin = profile?.role === 'admin'
  const myPages = isAdmin
    ? pages.filter(p => p.assignedTo?.includes(myUid) && p.status === 'active')
    : pages.filter(p => p.status === 'active')

  const [tab,          setTab]          = useState('checkin')
  // ── บล็อคเช็คอินหลัง 09:00 ──
  const isLateNow = (new Date().getHours() * 60 + new Date().getMinutes()) >= CHECKIN_CUTOFF
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
    // canSeeAll2: เห็นทุกคน, admin: เห็นเฉพาะตัวเอง
    const allCheck = canSeeAll2 ? checkins
      : checkins.filter(c => [myUid, profile?.id, user?.uid].filter(Boolean).includes(c.userId))
    const base   = summaryMode === 'day'
      ? allCheck.filter(c => c.date === histDate)
      : allCheck.filter(c => c.date?.startsWith(histMonth))

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
    { k:'checkin',  label:'🏁 เช็คอิน/เอาท์', show: !canSeeAll2 || isAdmin }, // admin เช็คอินเองได้
    { k:'live',     label:`🟢 Live (${liveToday.length})`, show: true },        // ทุกคนเห็น realtime
    { k:'history',  label:'📜 ประวัติ',         show: true },                   // ทุกคนเห็น
    { k:'summary',  label:'📊 สรุป',            show: true },                   // ทุกคนเห็น
  ].filter(t => t.show)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── HERO HEADER ────────────────────────────────── */}
      <div style={{ background:'linear-gradient(135deg,#312e81,#4338ca,#6366f1)', borderRadius:22, padding:'20px 26px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-30, right:-30, width:130, height:130, borderRadius:'50%', background:'rgba(255,255,255,.07)' }}/>
        <div style={{ position:'absolute', bottom:-20, left:100, width:90, height:90, borderRadius:'50%', background:'rgba(255,255,255,.05)' }}/>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12, position:'relative' }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:'#fff', display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              🏁 ระบบสถานะกะ / เพจ
            </div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.7)', display:'flex', alignItems:'center', gap:6 }}>
              📅 {format(new Date(), 'EEEE d MMMM yyyy', { locale:th })}
              <span style={{ background:'rgba(255,255,255,.15)', borderRadius:99, padding:'1px 10px', fontSize:12 }}>
                🟢 ออนไลน์ {liveToday.length} คน
              </span>
            </div>
          </div>
        </div>
        {/* KPI strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:16, position:'relative' }}>
          {[
            { e:'🟢', l:'Online ตอนนี้',   v:`${liveToday.length} คน`,             c:'#86efac' },
            { e:'📋', l:'เช็คอินวันนี้',   v:`${checkins.filter(c=>c.date===todayStr).length} ครั้ง`, c:'#c4b5fd' },
            { e:'✅', l:'เช็คเอาท์แล้ว',  v:`${checkins.filter(c=>c.date===todayStr&&c.status==='inactive').length} คน`, c:'#99f6e4' },
          ].map((k,i)=>(
            <div key={i} style={{ background:'rgba(255,255,255,.12)', borderRadius:14, padding:'12px 14px', border:'1px solid rgba(255,255,255,.12)', backdropFilter:'blur(4px)' }}>
              <div style={{ fontSize:18, marginBottom:4 }}>{k.e}</div>
              <div style={{ fontSize:18, fontWeight:900, color:k.c }}>{k.v}</div>
              <div style={{ fontSize:10.5, color:'rgba(255,255,255,.55)', marginTop:2 }}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS ─────────────────────────────────────────── */}
      <div style={{ display:'flex', background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', border:'1.5px solid #c7d2fe', borderRadius:14, padding:4, gap:3, width:'fit-content' }}>
        {TABS.filter(t=>t.show).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding:'9px 18px', borderRadius:11, border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit',
              background: tab===t.k ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : 'transparent',
              color: tab===t.k ? '#fff' : '#6366f1',
              display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
              boxShadow: tab===t.k ? '0 3px 10px rgba(99,102,241,.3)' : 'none',
              transition:'all .2s' }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ background:tab===t.k?'rgba(255,255,255,.3)':'#c7d2fe', color:tab===t.k?'#fff':'#4338ca', borderRadius:99, padding:'1px 7px', fontSize:11, fontWeight:900 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

{tab === 'checkin' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* ── กำลังทำงานอยู่ ─────────────────────────────── */}
          {myActive.length > 0 && (
            <div style={{ background:'linear-gradient(135deg,#059669,#10b981)', borderRadius:20, padding:20, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,.08)' }}/>
              <div style={{ fontSize:14, fontWeight:900, color:'#fff', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:20 }}>✅</span> กำลังทำงานอยู่ {myActive.length} เพจ
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                {myActive.map(c => {
                  const pg = pages.find(p => p.id === c.pageId)
                  const sh = SHIFTS[c.shift]
                  return (
                    <div key={c.id} style={{ background:'rgba(255,255,255,.15)', backdropFilter:'blur(8px)', border:'1.5px solid rgba(255,255,255,.3)', borderRadius:16, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, minWidth:210 }}>
                      <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                        {sh?.label.split(' ')[0]}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:900, color:'#fff' }}>{pg?.name || '?'}</div>
                        <div style={{ fontSize:12, color:'rgba(255,255,255,.7)', marginTop:2 }}>
                          {sh?.short} · เข้า {fmtTime(c.checkinTime)}
                        </div>
                      </div>
                      <button onClick={() => handleCheckout(c.id, c.pageId)} disabled={saving}
                        style={{ background:'rgba(255,255,255,.2)', border:'1.5px solid rgba(255,255,255,.4)', borderRadius:10, padding:'8px 14px', cursor:'pointer', fontSize:13, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, backdropFilter:'blur(4px)' }}>
                        <LogOut size={13}/> เช็คเอาท์
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── ฟอร์มเช็คอิน ───────────────────────────────── */}
          <div style={{ background:'#fff', borderRadius:22, overflow:'hidden', boxShadow:'0 4px 24px rgba(99,102,241,.1)', border:'1.5px solid #e0e7ff' }}>

            {/* Header */}
            <div style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed,#8b5cf6)', padding:'20px 24px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,.07)' }}/>
              <div style={{ position:'absolute', bottom:-20, left:60, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,.05)' }}/>
              <div style={{ fontSize:22, fontWeight:900, color:'#fff', display:'flex', alignItems:'center', gap:10, position:'relative' }}>
                <span style={{ fontSize:28 }}>🏁</span> เช็คอินเพจ
              </div>
              <div style={{ fontSize:12.5, color:'rgba(255,255,255,.7)', marginTop:4, position:'relative' }}>
                {format(new Date(), 'EEEE d MMMM yyyy · HH:mm', { locale: th })}
              </div>
            </div>

            <div style={{ padding:22 }}>
              {/* ── กะ ── */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  🕐 เลือกกะการทำงาน
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {Object.entries(SHIFTS).map(([k, sh]) => {
                    const sel = selectedShift === k
                    const gradients = {
                      day:   'linear-gradient(135deg,#fef3c7,#fde68a)',
                      night: 'linear-gradient(135deg,#eef2ff,#ddd6fe)',
                    }
                    const selGrad = {
                      day:   'linear-gradient(135deg,#d97706,#f59e0b)',
                      night: 'linear-gradient(135deg,#4338ca,#6366f1)',
                    }
                    return (
                      <button key={k} onClick={() => setSelectedShift(k)}
                        style={{ padding:'18px 16px', borderRadius:16, cursor:'pointer', textAlign:'left', fontFamily:'inherit', border:`2px solid ${sel ? sh.color : sh.border}`, background:sel ? selGrad[k] : gradients[k], transition:'all .2s', position:'relative', overflow:'hidden' }}>
                        <div style={{ position:'absolute', top:-10, right:-10, width:60, height:60, borderRadius:'50%', background:'rgba(255,255,255,.15)' }}/>
                        <div style={{ fontSize:32, marginBottom:8 }}>{k==='day'?'☀️':'🌙'}</div>
                        <div style={{ fontSize:15, fontWeight:900, color:sel?'#fff':sh.dark }}>{sh.label.replace(/[☀️🌙]\s*/,'')}</div>
                        <div style={{ fontSize:12, color:sel?'rgba(255,255,255,.8)':'#9ca3af', marginTop:3 }}>{sh.range}</div>
                        {k === 'night' && (
                          <div style={{ fontSize:10.5, color:sel?'rgba(255,255,255,.7)':'#6366f1', marginTop:5, fontWeight:600 }}>
                            💡 กะข้ามวัน บันทึกใต้วันที่เริ่มกะ
                          </div>
                        )}
                        {sel && (
                          <div style={{ position:'absolute', top:10, right:12, background:'rgba(255,255,255,.3)', borderRadius:99, padding:'2px 9px', fontSize:11, fontWeight:800, color:'#fff' }}>
                            ✓ เลือกแล้ว
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── เพจ ── */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  📄 เลือกเพจ <span style={{ fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'none' }}>(เลือกได้หลายเพจพร้อมกัน)</span>
                </div>
                {myPages.length === 0 ? (
                  <div style={{ background:'linear-gradient(135deg,#fff7ed,#ffedd5)', border:'2px solid #fed7aa', borderRadius:14, padding:'16px 18px', display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:28 }}>⚠️</span>
                    <div>
                      <div style={{ fontSize:14, fontWeight:800, color:'#9a3412' }}>ไม่มีเพจที่รับผิดชอบ</div>
                      <div style={{ fontSize:12.5, color:'#c2410c', marginTop:2 }}>ติดต่อหัวหน้าแอดมินเพื่อมอบหมายเพจ</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8 }}>
                    {myPages.map(p => {
                      const alreadyIn = myActivePageIds.has(p.id)
                      const selected  = selectedPages.includes(p.id)
                      return (
                        <button key={p.id} onClick={() => !alreadyIn && togglePage(p.id)} disabled={alreadyIn}
                          style={{ padding:'14px', borderRadius:14, cursor:alreadyIn?'not-allowed':'pointer', textAlign:'left', fontFamily:'inherit',
                            border:`2px solid ${selected?'#6366f1':alreadyIn?'#bbf7d0':'#e0e7ff'}`,
                            background:selected?'linear-gradient(135deg,#eef2ff,#ede9fe)':alreadyIn?'linear-gradient(135deg,#f0fdf4,#dcfce7)':'linear-gradient(135deg,#fafbff,#f5f3ff)',
                            opacity:alreadyIn?.8:1, transition:'all .15s', position:'relative', overflow:'hidden' }}>
                          {selected && <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#6366f1,#7c3aed)', borderRadius:'14px 14px 0 0' }}/>}
                          {alreadyIn && <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#059669,#10b981)', borderRadius:'14px 14px 0 0' }}/>}
                          <div style={{ fontSize:20, marginBottom:6 }}>
                            {alreadyIn ? '✅' : p.type==='main' ? '⭐' : '🧪'}
                          </div>
                          <div style={{ fontSize:13, fontWeight:700, color:selected?'#4338ca':alreadyIn?'#059669':'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {p.name}
                          </div>
                          {alreadyIn && <div style={{ fontSize:10.5, color:'#059669', marginTop:4, fontWeight:700 }}>🟢 กำลังทำงาน</div>}
                          {selected && !alreadyIn && <div style={{ fontSize:10.5, color:'#6366f1', marginTop:4, fontWeight:700 }}>✓ เลือกแล้ว</div>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Selected summary ── */}
              {selectedPages.length > 0 && (
                <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', border:'1.5px solid #c7d2fe', borderRadius:12, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:16 }}>📋</span>
                  <span style={{ fontSize:13, color:'#4338ca', fontWeight:700 }}>
                    เลือก {selectedPages.length} เพจ: {selectedPages.map(id=>pages.find(p=>p.id===id)?.name||id).join(', ')}
                  </span>
                </div>
              )}

              {/* ── บล็อคหลัง 09:00 ── */}
              {isLateNow ? (
                <div style={{ background:'linear-gradient(135deg,#fff1f2,#ffe4e6)', border:'2px solid #fca5a5', borderRadius:16, padding:'18px 20px', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg,#be123c,#e11d48)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>
                    🚫
                  </div>
                  <div>
                    <div style={{ fontSize:15, fontWeight:900, color:'#be123c', marginBottom:4 }}>หมดเวลาเช็คอินแล้ว</div>
                    <div style={{ fontSize:13, color:'#6b7280' }}>ระบบปิดรับเช็คอินหลัง 09:00 น.</div>
                  </div>
                </div>
              ) : (
                <button onClick={handleCheckin} disabled={!selectedPages.length || saving}
                  style={{
                    width:'100%', padding:'15px', borderRadius:16, border:'none',
                    cursor:selectedPages.length&&!saving?'pointer':'not-allowed',
                    background:selectedPages.length?'linear-gradient(135deg,#6366f1,#7c3aed)':'#e5e7eb',
                    color:'#fff', fontSize:16, fontWeight:900, fontFamily:'inherit',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                    boxShadow:selectedPages.length?'0 6px 20px rgba(99,102,241,.35)':'none',
                    transition:'all .2s', opacity:saving?.7:1,
                  }}>
                  {saving ? (
                    <><span style={{ fontSize:18 }}>⏳</span> กำลังเช็คอิน...</>
                  ) : (
                    <><span style={{ fontSize:20 }}>🏁</span> เช็คอิน {selectedPages.length > 0 ? `${selectedPages.length} เพจ` : 'เพจ'}</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'live' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* realtime badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:7, background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:99, padding:'6px 14px', width:'fit-content' }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 0 3px rgba(34,197,94,.25)', animation:'pulse 2s infinite' }}/>
            <span style={{ fontSize:13, fontWeight:700, color:'#059669' }}>อัพเดทแบบเรียลไทม์ · {format(new Date(),'HH:mm:ss')}</span>
          </div>

          {liveToday.length === 0 ? (
            <div style={{ background:'linear-gradient(135deg,#f8faff,#eef2ff)', border:'1.5px solid #e0e7ff', borderRadius:20, padding:'50px 24px', textAlign:'center' }}>
              <div style={{ fontSize:56, marginBottom:14 }}>😴</div>
              <div style={{ fontSize:17, fontWeight:900, color:'#1e1b4b', marginBottom:6 }}>ยังไม่มีใครออนไลน์</div>
              <div style={{ fontSize:13, color:'#9ca3af' }}>เมื่อมีการเช็คอิน จะแสดงที่นี่แบบ realtime</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
              {liveToday.map((c,i) => {
                const pg  = pages.find(p => p.id === c.pageId)
                const sh  = SHIFTS[c.shift]
                const dur = calcDuration(c.checkinTime, new Date())
                const colors = ['#6366f1','#8b5cf6','#0284c7','#059669','#d97706','#ec4899']
                const col = colors[i % colors.length]
                return (
                  <div key={c.id} style={{ background:'#fff', border:`2px solid ${col}22`, borderLeft:`5px solid ${col}`, borderRadius:18, padding:'16px 18px', boxShadow:`0 3px 14px ${col}12` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                      <div style={{ width:44, height:44, borderRadius:'50%', background:`linear-gradient(135deg,${col},${col}cc)`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, flexShrink:0 }}>
                        {getUserName(c.userId).slice(0,2)}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:900, color:'#1e1b4b' }}>{getUserName(c.userId)}</div>
                        <div style={{ display:'inline-flex', alignItems:'center', gap:4, background:`${col}15`, borderRadius:99, padding:'2px 9px', marginTop:3 }}>
                          <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e' }}/>
                          <span style={{ fontSize:11, fontWeight:700, color:col }}>ออนไลน์</span>
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:11, color:'#9ca3af' }}>เข้า</div>
                        <div style={{ fontSize:13, fontWeight:800, color:'#1e1b4b' }}>{fmtTime(c.checkinTime)}</div>
                        {dur && <div style={{ fontSize:11, color:col, fontWeight:700 }}>{dur.label}</div>}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <PageBadge page={pg} size='sm'/>
                      <span style={{ background:sh?.bg||'#f1f5f9', color:sh?.color||'#6b7280', border:`1px solid ${sh?.border||'#e0e7ff'}`, borderRadius:99, padding:'2px 9px', fontSize:11.5, fontWeight:700 }}>
                        {sh?.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Date picker + nav */}
          <div style={{ background:'linear-gradient(135deg,#fff,#fafbff)', border:'1.5px solid #e0e7ff', borderRadius:18, padding:'16px 20px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
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
                            {(() => { const pg = pages.find(p=>p.id===c.pageId); return pg ? <PageBadge page={pg} size='xs'/> : '?' })()} 
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
                                  <td style={{ padding:'9px 14px' }}>{(() => { const pg=pages.find(p=>p.id===c.pageId); return pg?<PageBadge page={pg} size='sm'/>:'?' })()} </td>
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
