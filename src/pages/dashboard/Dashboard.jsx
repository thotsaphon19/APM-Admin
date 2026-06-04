import React, { useMemo } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
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

const KPI_CARDS = [
  { key:'todayComm',  emoji:'💰', label:'ค่าคอมวันนี้',    suffix:'฿', colorClass:'grad-card-indigo', valueColor:'#4338ca' },
  { key:'todayOrders',emoji:'📦', label:'ออเดอร์วันนี้',   suffix:'',  colorClass:'grad-card-teal',   valueColor:'#0f766e' },
  { key:'monthComm',  emoji:'📊', label:'ค่าคอมเดือนนี้',  suffix:'฿', colorClass:'grad-card-pink',   valueColor:'#be185d' },
  { key:'cancelOrders',emoji:'❌',label:'ออเดอร์ยกเลิก',   suffix:'',  colorClass:'grad-card-amber',  valueColor:'#b45309' },
]

export default function Dashboard() {
  const { profile } = useAuth()
  const { commissions, pages, leaves, users, checkins, getCommStats, getUserName, getPageName } = useData()

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

  const kpiValues = {
    todayComm:   todayComm.reduce((a,c)=>a+(c.total||0),0),
    todayOrders: todayComm.reduce((a,c)=>a+(c.manualOrders||0)+(c.aiOrders||0),0),
    monthComm:   monthComm.reduce((a,c)=>a+(c.total||0),0),
    cancelOrders:todayComm.reduce((a,c)=>a+(c.cancelOrders||0),0),
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

      {/* KPI cards */}
      <div className="grid grid-4" style={{ gap:14 }}>
        {KPI_CARDS.map((k,i)=>(
          <div key={i} className={`card ${k.colorClass}`} style={{ borderRadius:16, padding:'18px 20px' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>{k.emoji}</div>
            <div style={{ fontSize:26, fontWeight:900, color:k.valueColor, lineHeight:1 }}>
              {k.suffix}{typeof kpiValues[k.key]==='number'&&kpiValues[k.key]>0
                ? kpiValues[k.key].toLocaleString()
                : kpiValues[k.key]}
            </div>
            <div style={{ fontSize:12.5, color:'#6b7280', marginTop:6, fontWeight:600 }}>{k.label}</div>
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
                      {p.type==='main'?'⭐':'🧪'} {p.name}
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
    </div>
  )
}