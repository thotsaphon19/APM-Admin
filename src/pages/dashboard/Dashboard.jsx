import React, { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import PageBadge from '../../components/ui/PageBadge'
import { Avatar, Empty } from '../../components/ui'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'

const today     = format(new Date(), 'yyyy-MM-dd')
const thisMonth = format(new Date(), 'yyyy-MM')
const COLORS    = ['#6366f1','#14b8a6','#7c3aed','#f59e0b','#e11d48','#0284c7']

const TT = {
  contentStyle:{ background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:12, color:'#1e1b4b', fontSize:12, boxShadow:'0 4px 16px rgba(0,0,0,.1)' }
}

const KPI_CARD_DEFS = [
  { key:'todayComm',  emoji:'💰', labelDay:'ค่าคอมวันนี้', labelMonth:'ค่าคอมเดือนนี้', labelYear:'ค่าคอมปีนี้',  suffix:'฿', colorClass:'grad-card-indigo', valueColor:'#4338ca' },
  { key:'todayOrders',emoji:'📦', labelDay:'ออเดอร์วันนี้', labelMonth:'ออเดอร์เดือนนี้',labelYear:'ออเดอร์ปีนี้', suffix:'',  colorClass:'grad-card-teal',   valueColor:'#0f766e' },
  { key:'monthComm',  emoji:'📊', labelDay:'ค่าคอมเดือนนี้',labelMonth:'ค่าคอมเดือนที่เลือก',labelYear:'ค่าคอมเดือนนี้', suffix:'฿', colorClass:'grad-card-pink',   valueColor:'#be185d' },
  { key:'cancelOrders',emoji:'❌',labelDay:'ออเดอร์ยกเลิก',labelMonth:'ยกเลิกเดือนนี้', labelYear:'ยกเลิกปีนี้', suffix:'',  colorClass:'grad-card-amber',  valueColor:'#b45309' },
]

export default function Dashboard() {
  const { profile, isSuperAdmin, canManage, canAudit } = useAuth()
  const canSeeAll = !!(isSuperAdmin || canManage || canAudit || profile?.role === 'assistant')
  const { commissions, pages, leaves, users, checkins, getCommStats, getUserName, getPageName } = useData()

  // ── Period selector ──────────────────────────────
  const [period, setPeriod] = useState('day')  // day | month | year
  const [selDate,  setSelDate]  = useState(today)
  const [selMonth, setSelMonth] = useState(thisMonth)
  const [selYear,  setSelYear]  = useState(today.slice(0,4))

  // Build filter based on period
  const periodFilter = useMemo(() => {
    if (period === 'day')   return { date: selDate }
    if (period === 'month') return { month: selMonth }
    if (period === 'year')  return {}  // filter below by year
    return {}
  }, [period, selDate, selMonth, selYear])

  const todayComm = useMemo(()=>{
    const f={date:today}
    if(profile?.role==='admin') f.adminId=profile.id
    return getCommStats(f)
  },[commissions,profile])

  const monthComm = useMemo(()=>{
    const f={month:thisMonth}
    if(profile?.role==='admin') f.adminId=profile.id
    return getCommStats(f)
  },[commissions,profile])

  // Period-based stats
  const periodComm = useMemo(()=>{
    let base = commissions
    if(profile?.role==='admin') base = base.filter(c=>c.adminId===profile.id)
    if(period==='day')   base = base.filter(c=>c.date===selDate)
    if(period==='month') base = base.filter(c=>c.date?.startsWith(selMonth))
    if(period==='year')  base = base.filter(c=>c.date?.startsWith(selYear))
    return base
  },[commissions,profile,period,selDate,selMonth,selYear])

  const kpiValues = {
    todayComm:    periodComm.reduce((a,c)=>a+(c.total||(c.manualTotal||0)+(c.aiTotal||0)||((c.manualOrders||0)*(c.manualRate||5)+(c.aiOrders||0)*(c.aiRate||2))),0),
    todayOrders:  periodComm.reduce((a,c)=>a+(parseInt(c.manualOrders)||0)+(parseInt(c.aiOrders)||0),0),
    monthComm:    monthComm.reduce((a,c)=>a+(c.total||0),0),
    cancelOrders: periodComm.reduce((a,c)=>a+(c.cancelOrders||0),0),
  }


  // ── Live checkin data ─────────────────────────────
  const liveToday = useMemo(()=>
    checkins.filter(c => c.date === today && c.status === 'active'),
  [checkins])

  const liveByPage = useMemo(()=>
    pages.filter(p=>p.status==='active').map(p=>({
      ...p,
      active: liveToday.filter(c=>c.pageId===p.id)
    })).filter(p=>p.active.length>0),
  [pages, liveToday])

  const onlineCount = [...new Set(liveToday.map(c=>c.userId))].length

  const myPages       = pages.filter(p=>p.assignedTo?.includes(profile?.id))
  const pendingLeaves = leaves.filter(l=>!l.deleted&&l.status==='pending')

  const pageChart = useMemo(()=>pages.map(p=>{
    const cs=monthComm.filter(c=>c.pageId===p.id)
    return { name:p.name.length>8?p.name.slice(0,8)+'…':p.name,
      มือ:cs.reduce((a,c)=>a+(c.manualOrders||0),0),
      AI: cs.reduce((a,c)=>a+(c.aiOrders||0),0) }
  }).filter(d=>d.มือ+d.AI>0),[pages,monthComm])

  const pieData = useMemo(()=>[
    { name:'ตอบมือ', value:monthComm.reduce((a,c)=>a+(c.manualOrders||0),0) },
    { name:'AI',     value:monthComm.reduce((a,c)=>a+(c.aiOrders||0),0) },
    { name:'ยกเลิก', value:monthComm.reduce((a,c)=>a+(c.cancelOrders||0),0) },
  ].filter(d=>d.value>0),[monthComm])

  const recent = [...commissions]
    .filter(c=>profile?.role==='admin'?c.adminId===profile.id:true)
    .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
    .slice(0,5)

  const admins = users.filter(u=>['admin','head_admin'].includes(u.role))
  const onLeaveToday = new Set(
    leaves.filter(l=>!l.deleted&&l.status==='approved'&&l.startDate<=today&&l.endDate>=today)
      .map(l=>l.employeeId)
  )

  const isHead = ['superadmin','head_admin'].includes(profile?.role)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Hero greeting */}
      <div className="hero-card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontSize:28, fontWeight:900, marginBottom:4 }}>
              สวัสดี, {profile?.name?.split(' ')[0]}! 🎉
            </div>
            <div style={{ fontSize:13.5, opacity:.8 }}>
              📅 {format(new Date(),'EEEE d MMMM yyyy',{locale:th})}
            </div>
          </div>
          <div style={{ fontSize:48, opacity:.8 }} className="animate-float">
            {profile?.role==='superadmin'?'👑':profile?.role==='head_admin'?'⭐':profile?.role==='assistant'?'🤝':'💼'}
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:'12px 18px', display:'flex', flexWrap:'wrap', alignItems:'center', gap:12 }}>
        <div style={{ display:'flex', gap:6 }}>
          {[{v:'day',l:'📅 รายวัน'},{v:'month',l:'🗓️ รายเดือน'},{v:'year',l:'📊 รายปี'}].map(m=>(
            <button key={m.v} onClick={()=>setPeriod(m.v)}
              style={{ background:period===m.v?'linear-gradient(135deg,#6366f1,#7c3aed)':'#f1f5f9', border:`1.5px solid ${period===m.v?'#6366f1':'#e0e7ff'}`, borderRadius:9, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:700, color:period===m.v?'#fff':'#6b7280', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              {m.l}
            </button>
          ))}
        </div>
        {period==='day'   && <input type="date"  value={selDate}  onChange={e=>setSelDate(e.target.value)}  style={{ padding:'7px 12px', borderRadius:9, border:'1.5px solid #c7d2fe', background:'#fafbff', fontSize:13.5, color:'#4338ca', fontFamily:'inherit' }}/>}
        {period==='month' && <input type="month" value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={{ padding:'7px 12px', borderRadius:9, border:'1.5px solid #c7d2fe', background:'#fafbff', fontSize:13.5, color:'#4338ca', fontFamily:'inherit' }}/>}
        {period==='year'  && (
          <select value={selYear} onChange={e=>setSelYear(e.target.value)}
            style={{ padding:'7px 12px', borderRadius:9, border:'1.5px solid #c7d2fe', background:'#fafbff', fontSize:13.5, color:'#4338ca', fontFamily:'inherit' }}>
            {Array.from({length:5},(_,i)=>String(new Date().getFullYear()-i)).map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <div style={{ marginLeft:'auto', background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', border:'1px solid #c7d2fe', borderRadius:99, padding:'5px 14px', fontSize:12.5, fontWeight:700, color:'#4338ca' }}>
          {periodComm.length} รายการ · ฿{periodComm.reduce((a,c)=>a+(c.total||(c.manualTotal||0)+(c.aiTotal||0)),0).toLocaleString()}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-4" style={{ gap:14 }}>
        {KPI_CARD_DEFS.map((k,i)=>(
          <div key={i} className={`card ${k.colorClass}`} style={{ borderRadius:16, padding:'18px 20px' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>{k.emoji}</div>
            <div style={{ fontSize:26, fontWeight:900, color:k.valueColor, lineHeight:1 }}>
              {k.suffix}{typeof kpiValues[k.key]==='number'&&kpiValues[k.key]>0
                ? kpiValues[k.key].toLocaleString()
                : kpiValues[k.key]}
            </div>
            <div style={{ fontSize:12.5, color:'#6b7280', marginTop:6, fontWeight:600 }}>
              {period==='day'?k.labelDay:period==='month'?k.labelMonth:k.labelYear}
            </div>
          </div>
        ))}
      </div>

      {/* Secondary KPI */}
      <div className="grid grid-3" style={{ gap:14 }}>
        <div className="card grad-card-sky" style={{ borderRadius:16, padding:'16px 20px' }}>
          <div style={{ fontSize:24, marginBottom:6 }}>📄</div>
          <div style={{ fontSize:22, fontWeight:900, color:'#0369a1' }}>
            {profile?.role==='admin'?myPages.length:pages.length}
          </div>
          <div style={{ fontSize:12.5, color:'#6b7280', marginTop:4, fontWeight:600 }}>
            {profile?.role==='admin'?'เพจของฉัน':'เพจทั้งหมด'}
          </div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
            ⭐ {pages.filter(p=>p.type==='main').length} หลัก · 🧪 {pages.filter(p=>p.type==='test').length} ทดสอบ
          </div>
        </div>
        <div className="card grad-card-amber" style={{ borderRadius:16, padding:'16px 20px' }}>
          <div style={{ fontSize:24, marginBottom:6 }}>⏳</div>
          <div style={{ fontSize:22, fontWeight:900, color:'#b45309' }}>{pendingLeaves.length}</div>
          <div style={{ fontSize:12.5, color:'#6b7280', marginTop:4, fontWeight:600 }}>รออนุมัติวันลา</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>รายการที่ต้องตรวจสอบ</div>
        </div>
        <div className="card grad-card-green" style={{ borderRadius:16, padding:'16px 20px' }}>
          <div style={{ fontSize:24, marginBottom:6 }}>👥</div>
          <div style={{ fontSize:22, fontWeight:900, color:'#047857' }}>{users.length}</div>
          <div style={{ fontSize:12.5, color:'#6b7280', marginTop:4, fontWeight:600 }}>พนักงานทั้งหมด</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
            {admins.length} แอดมิน · {users.filter(u=>u.role==='assistant').length} ผู้ช่วย
          </div>
        </div>
      </div>


      {/* ── Live Status Section ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Live Online */}
        <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:18, overflow:'hidden', boxShadow:'0 2px 12px rgba(99,102,241,.06)' }}>
          <div style={{ background:'linear-gradient(135deg,#eef2ff,#f0fdf4)', padding:'14px 18px', borderBottom:'1.5px solid #e0e7ff', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:14, fontWeight:900, color:'#1e1b4b', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 0 3px rgba(34,197,94,.25)' }}/>
              Live Online
            </div>
            <span style={{ background:'#dcfce7', color:'#059669', border:'1.5px solid #bbf7d0', borderRadius:99, padding:'3px 12px', fontSize:13, fontWeight:800 }}>
              {onlineCount} คน
            </span>
          </div>
          <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
            {liveToday.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:'#9ca3af', fontSize:13 }}>
                ยังไม่มีใครเช็คอิน
              </div>
            ) : (
              [...new Set(liveToday.map(c=>c.userId))].map(uid=>{
                const myC = liveToday.filter(c=>c.userId===uid)
                const shift = myC[0]?.shift
                return (
                  <div key={uid} style={{ display:'flex', alignItems:'center', gap:10, background:'#f9fafb', borderRadius:10, padding:'9px 12px', border:'1px solid #f0f4ff' }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                      {getUserName(uid).slice(0,2)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13.5, fontWeight:700, color:'#1e1b4b' }}>{getUserName(uid)}</div>
                      <div style={{ fontSize:11.5, color:'#6b7280', marginTop:2 }}>
                        {shift==='night'?'🌙 กะกลางคืน':'☀️ กะกลางวัน'} · {myC.length} เพจ
                      </div>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, justifyContent:'flex-end' }}>
                      {myC.slice(0,3).map(c=>(
                        <span key={c.id} style={{ background:'#eef2ff', color:'#4338ca', border:'1px solid #c7d2fe', borderRadius:99, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
                          {getPageName(c.pageId)}
                        </span>
                      ))}
                      {myC.length>3 && <span style={{ fontSize:11, color:'#9ca3af' }}>+{myC.length-3}</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Live by Page */}
        <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:18, overflow:'hidden', boxShadow:'0 2px 12px rgba(99,102,241,.06)' }}>
          <div style={{ background:'linear-gradient(135deg,#eef2ff,#f0fdf4)', padding:'14px 18px', borderBottom:'1.5px solid #e0e7ff', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:14, fontWeight:900, color:'#1e1b4b' }}>📄 สถานะเพจตอนนี้</div>
            <span style={{ fontSize:12, color:'#6b7280' }}>{pages.filter(p=>p.status==='active').length} เพจทั้งหมด</span>
          </div>
          <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8, maxHeight:280, overflowY:'auto' }}>
            {pages.filter(p=>p.status==='active').length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:'#9ca3af', fontSize:13 }}>ยังไม่มีเพจ</div>
            ) : pages.filter(p=>p.status==='active').map(p=>{
              const active = liveToday.filter(c=>c.pageId===p.id)
              return (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background: active.length>0?'#f0fdf4':'#f9fafb', borderRadius:10, border:`1px solid ${active.length>0?'#bbf7d0':'#f0f4ff'}` }}>
                  <div style={{ width:9, height:9, borderRadius:'50%', background:active.length>0?'#22c55e':'#d1d5db', flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {(() => { return <PageBadge page={p} size='sm'/> })()} 
                    </div>
                  </div>
                  {active.length>0 ? (
                    <span style={{ background:'#dcfce7', color:'#059669', border:'1px solid #bbf7d0', borderRadius:99, padding:'2px 9px', fontSize:11.5, fontWeight:700 }}>
                      {active.length} คน
                    </span>
                  ) : (
                    <span style={{ background:'#f1f5f9', color:'#9ca3af', border:'1px solid #e5e7eb', borderRadius:99, padding:'2px 9px', fontSize:11.5 }}>
                      ว่าง
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Charts */}
      {(pageChart.length>0||pieData.length>0)&&(
        <div className="grid grid-2" style={{ gap:16 }}>
          {pageChart.length>0&&(
            <div className="card" style={{ borderRadius:16 }}>
              <div style={{ fontWeight:800, fontSize:15, color:'#1e1b4b', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                📊 ออเดอร์แยกตามเพจ (เดือนนี้)
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pageChart} barGap={2}>
                  <XAxis dataKey="name" tick={{ fill:'#9ca3af', fontSize:11 }}/>
                  <YAxis tick={{ fill:'#9ca3af', fontSize:11 }}/>
                  <Tooltip {...TT}/>
                  <Bar dataKey="มือ" fill="#7c3aed" radius={[6,6,0,0]}/>
                  <Bar dataKey="AI"  fill="#14b8a6" radius={[6,6,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {pieData.length>0&&(
            <div className="card" style={{ borderRadius:16 }}>
              <div style={{ fontWeight:800, fontSize:15, color:'#1e1b4b', marginBottom:16 }}>
                🍩 สัดส่วนออเดอร์ (เดือนนี้)
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={82} paddingAngle={4} dataKey="value">
                    {pieData.map((_,i)=><Cell key={i} fill={COLORS[i]}/>)}
                  </Pie>
                  <Tooltip {...TT} formatter={v=>[v.toLocaleString(),'บ้าน']}/>
                  <Legend formatter={v=><span style={{color:'#6b7280',fontSize:12}}>{v}</span>}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div className="grid grid-2" style={{ gap:16 }}>
        {/* Recent */}
        <div className="card" style={{ borderRadius:16 }}>
          <div style={{ fontWeight:800, fontSize:15, color:'#1e1b4b', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
            ⚡ กิจกรรมล่าสุด
          </div>
          {recent.length===0
            ?<Empty title="ยังไม่มีข้อมูล"/>
            :<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {recent.map(c=>(
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 13px', background:'#fafbff', borderRadius:12, border:'1.5px solid #e0e7ff' }}>
                  <div className="avatar avatar-sm">{getUserName(c.adminId).slice(0,2)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#1e1b4b' }}>{getUserName(c.adminId)}</div>
                    <div style={{ fontSize:11, color:'#9ca3af' }}>📄 {getPageName(c.pageId)} · 📅 {c.date}</div>
                  </div>
                  <div style={{ fontSize:14, fontWeight:900, color:'#4338ca' }}>฿{(c.total||0).toLocaleString()}</div>
                </div>
              ))}
            </div>
          }
        </div>

        {/* Team or pending */}
        <div className="card" style={{ borderRadius:16 }}>
          <div style={{ fontWeight:800, fontSize:15, color:'#1e1b4b', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
            {isHead?'👥 สถานะทีม':'⏳ รออนุมัติวันลา'}
          </div>
          {isHead?(
            admins.length===0?<Empty title="ไม่มีแอดมิน"/>:
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {admins.slice(0,5).map(u=>(
                <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 13px', background:onLeaveToday.has(u.id)?'#fffbeb':'#f0fdf4', borderRadius:12, border:`1.5px solid ${onLeaveToday.has(u.id)?'#fde68a':'#bbf7d0'}` }}>
                  <div style={{ position:'relative' }}>
                    <div className="avatar avatar-sm">{(u.avatar||u.name||'?').slice(0,2)}</div>
                    <div style={{ position:'absolute', bottom:-1, right:-1, width:10, height:10, borderRadius:'50%', border:'2px solid #fff', background:onLeaveToday.has(u.id)?'#f59e0b':'#22c55e' }}/>
                  </div>
                  <div style={{ flex:1, fontSize:13, fontWeight:700, color:'#1e1b4b' }}>{u.name}</div>
                  {onLeaveToday.has(u.id)
                    ?<span className="badge badge-orange" style={{ fontSize:11 }}>🌴 ลาวันนี้</span>
                    :<span className="badge badge-green" style={{ fontSize:11 }}>✅ ปกติ</span>
                  }
                </div>
              ))}
            </div>
          ):(
            pendingLeaves.length===0?<Empty title="ไม่มีรายการรออนุมัติ"/>:
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {pendingLeaves.slice(0,5).map(l=>(
                <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 13px', background:'#fffbeb', borderRadius:12, border:'1.5px solid #fde68a' }}>
                  <div className="avatar avatar-sm" style={{ background:'linear-gradient(135deg,#f59e0b,#fbbf24)' }}>{getUserName(l.employeeId).slice(0,2)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1e1b4b' }}>{getUserName(l.employeeId)}</div>
                    <div style={{ fontSize:11, color:'#9ca3af' }}>📅 {l.startDate}{l.startDate!==l.endDate?` – ${l.endDate}`:''}</div>
                  </div>
                  <span className="badge badge-orange" style={{ fontSize:11 }}>⏳ รอ</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ ไม่มีเพจตอบ วันนี้ + รอลา ══════════════════ */}
      {(() => {
        const noPageToday = leaves.filter(l =>
          l.leaveType === 'no_page' && l.startDate === today && !l.deleted
        )
        const pendingLeaves = leaves.filter(l =>
          l.status === 'pending' && !l.deleted
        )
        if (noPageToday.length === 0 && pendingLeaves.length === 0) return null
        return (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

            {/* ── ไม่มีเพจตอบวันนี้ ── */}
            {noPageToday.length > 0 && (
              <div style={{ background:'#fff', border:'1.5px solid #bfdbfe', borderRadius:18, overflow:'hidden', boxShadow:'0 2px 12px rgba(2,132,199,.07)' }}>
                <div style={{ background:'linear-gradient(135deg,#eff6ff,#dbeafe)', padding:'14px 18px', borderBottom:'1.5px solid #bfdbfe', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontSize:14, fontWeight:900, color:'#0284c7', display:'flex', alignItems:'center', gap:8 }}>
                    📭 ไม่มีเพจตอบวันนี้
                  </div>
                  <span style={{ background:'#dbeafe', color:'#0284c7', border:'1.5px solid #bfdbfe', borderRadius:99, padding:'3px 12px', fontSize:13, fontWeight:800 }}>
                    {noPageToday.length} คน
                  </span>
                </div>
                <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                  {noPageToday.map((l,i) => (
                    <div key={l.id||i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'linear-gradient(135deg,#eff6ff,#f0f9ff)', borderRadius:12, border:'1px solid #bfdbfe' }}>
                      <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#0284c7,#0ea5e9)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, flexShrink:0 }}>
                        {getUserName(l.employeeId).slice(0,2)}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13.5, fontWeight:700, color:'#1e1b4b' }}>{getUserName(l.employeeId)}</div>
                        {l.reason && l.reason !== 'ไม่มีเพจตอบ' && (
                          <div style={{ fontSize:11.5, color:'#6b7280', marginTop:2 }}>{l.reason}</div>
                        )}
                      </div>
                      <span style={{ background:'#eff6ff', color:'#0284c7', border:'1px solid #bfdbfe', borderRadius:99, padding:'2px 9px', fontSize:11.5, fontWeight:700 }}>
                        📭 ไม่มีเพจ
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── รอลา ── */}
            {pendingLeaves.length > 0 && (canSeeAll || isSuperAdmin) && (
              <div style={{ background:'#fff', border:'1.5px solid #fde68a', borderRadius:18, overflow:'hidden', boxShadow:'0 2px 12px rgba(180,83,9,.07)' }}>
                <div style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', padding:'14px 18px', borderBottom:'1.5px solid #fde68a', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontSize:14, fontWeight:900, color:'#b45309', display:'flex', alignItems:'center', gap:8 }}>
                    ⏳ รออนุมัติวันลา
                  </div>
                  <span style={{ background:'#fef3c7', color:'#b45309', border:'1.5px solid #fde68a', borderRadius:99, padding:'3px 12px', fontSize:13, fontWeight:800 }}>
                    {pendingLeaves.length} รายการ
                  </span>
                </div>
                <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                  {pendingLeaves.slice(0,5).map((l,i) => {
                    const lt = ['personal','sick','vacation','emergency','no_page','other']
                    const em = ['🏠','🤒','🌴','🚨','📭','📝']
                    const ei = lt.indexOf(l.leaveType)
                    return (
                      <div key={l.id||i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'linear-gradient(135deg,#fffbeb,#fefce8)', borderRadius:12, border:'1px solid #fde68a' }}>
                        <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#d97706,#f59e0b)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, flexShrink:0 }}>
                          {getUserName(l.employeeId).slice(0,2)}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13.5, fontWeight:700, color:'#1e1b4b' }}>{getUserName(l.employeeId)}</div>
                          <div style={{ fontSize:11.5, color:'#6b7280', marginTop:2 }}>
                            {em[ei]||'📝'} {l.startDate}{l.startDate!==l.endDate?` – ${l.endDate}`:''}
                          </div>
                        </div>
                        <a href="/leave" style={{ background:'#fef3c7', color:'#b45309', border:'1px solid #fde68a', borderRadius:8, padding:'3px 10px', fontSize:11.5, fontWeight:700, textDecoration:'none' }}>
                          ดู →
                        </a>
                      </div>
                    )
                  })}
                  {pendingLeaves.length > 5 && (
                    <div style={{ textAlign:'center', fontSize:12, color:'#9ca3af', padding:'4px 0' }}>
                      และอีก {pendingLeaves.length - 5} รายการ
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
