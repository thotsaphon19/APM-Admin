import React, { useState, useMemo } from 'react'
import { format, parseISO, startOfYear, eachMonthOfInterval, endOfYear } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { Avatar, Empty } from '../../components/ui'
import {
  Building2, TrendingUp, Users, BookOpen, CalendarDays,
  HandMetal, Bot, XCircle, AlertCircle, BarChart3,
  Star, TestTube, Award, Zap, ArrowUpRight, Download,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts'
import * as XLSX from 'xlsx'

const today      = format(new Date(), 'yyyy-MM-dd')
const thisMonth  = format(new Date(), 'yyyy-MM')
const thisYear   = format(new Date(), 'yyyy')

const TT = {
  contentStyle: {
    background: '#111827', border: '1px solid #1f2937',
    borderRadius: 10, color: '#f3f4f6', fontSize: 12,
  },
}
const COLORS = ['#4f7cff','#10b981','#7c3aed','#f97316','#ef4444','#eab308','#06b6d4','#ec4899']

export default function CompanyOverview() {
  const { profile, isSuperAdmin } = useAuth()
  const { commissions, pages, users, leaves, commRates, getUserName, getPageName } = useData()
  const [filterYear,  setFilterYear]  = useState(thisYear)
  const [filterMonth, setFilterMonth] = useState(thisMonth)

  if (!isSuperAdmin) {
    return (
      <div className="card flex items-center gap-3 text-orange-400">
        <AlertCircle size={20}/>
        <span>เฉพาะผู้ดูแลสูงสุดเท่านั้น</span>
      </div>
    )
  }

  const admins = users.filter(u => ['admin','head_admin'].includes(u.role))

  // ── Year data ──────────────────────────────────────
  const yearComms = useMemo(() =>
    commissions.filter(c => c.date?.startsWith(filterYear)),
    [commissions, filterYear])

  // ── Month data ─────────────────────────────────────
  const monthComms = useMemo(() =>
    commissions.filter(c => c.date?.startsWith(filterMonth)),
    [commissions, filterMonth])

  // ── Grand company totals (year) ────────────────────
  const yearTotal = useMemo(() => yearComms.reduce((a, c) => ({
    commission:   a.commission   + (c.total        || 0),
    manualOrders: a.manualOrders + (c.manualOrders || 0),
    aiOrders:     a.aiOrders     + (c.aiOrders     || 0),
    cancelOrders: a.cancelOrders + (c.cancelOrders || 0),
    unclear:      a.unclear      + (c.unclearOrders|| 0),
    manualComm:   a.manualComm   + (c.manualTotal  || 0),
    aiComm:       a.aiComm       + (c.aiTotal      || 0),
    entries:      a.entries      + 1,
  }), { commission:0,manualOrders:0,aiOrders:0,cancelOrders:0,unclear:0,manualComm:0,aiComm:0,entries:0 }),
  [yearComms])

  const monthTotal = useMemo(() => monthComms.reduce((a, c) => ({
    commission: a.commission + (c.total || 0),
    orders:     a.orders     + (c.manualOrders||0) + (c.aiOrders||0),
  }), { commission: 0, orders: 0 }), [monthComms])

  // ── Monthly trend (12 months) ──────────────────────
  const monthlyTrend = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = `${filterYear}-${String(i+1).padStart(2,'0')}`
      const cs = commissions.filter(c => c.date?.startsWith(m))
      return {
        label:   format(parseISO(m+'-01'), 'MMM', { locale: th }),
        ค่าคอม:  cs.reduce((a,c) => a+(c.total||0), 0),
        ออเดอร์: cs.reduce((a,c) => a+(c.manualOrders||0)+(c.aiOrders||0), 0),
        มือ:     cs.reduce((a,c) => a+(c.manualTotal||0), 0),
        AI:      cs.reduce((a,c) => a+(c.aiTotal||0), 0),
      }
    })
  }, [commissions, filterYear])

  // ── Per-admin year summary ─────────────────────────
  const adminYear = useMemo(() => admins.map(u => {
    const cs = yearComms.filter(c => c.adminId === u.id)
    const manual = cs.reduce((a,c) => a+(c.manualOrders||0), 0)
    const ai     = cs.reduce((a,c) => a+(c.aiOrders    ||0), 0)
    const total  = cs.reduce((a,c) => a+(c.total       ||0), 0)
    return {
      ...u,
      manual, ai, total,
      cancel:     cs.reduce((a,c) => a+(c.cancelOrders ||0), 0),
      unclear:    cs.reduce((a,c) => a+(c.unclearOrders||0), 0),
      manualComm: cs.reduce((a,c) => a+(c.manualTotal  ||0), 0),
      aiComm:     cs.reduce((a,c) => a+(c.aiTotal      ||0), 0),
      entries: cs.length,
      manualPct: (manual+ai)>0 ? Math.round(manual/(manual+ai)*100) : 0,
      leaveCount: leaves.filter(l => !l.deleted && l.employeeId === u.id && l.status === 'approved').length,
    }
  }).sort((a,b) => b.total-a.total), [admins, yearComms, leaves])

  // ── Per-page year summary ──────────────────────────
  const pageYear = useMemo(() => pages.map(p => {
    const cs = yearComms.filter(c => c.pageId === p.id)
    return {
      ...p,
      manual:  cs.reduce((a,c) => a+(c.manualOrders||0), 0),
      ai:      cs.reduce((a,c) => a+(c.aiOrders    ||0), 0),
      total:   cs.reduce((a,c) => a+(c.total       ||0), 0),
      entries: cs.length,
    }
  }).sort((a,b) => b.total-a.total), [pages, yearComms])

  // ── Leave stats ────────────────────────────────────
  const leaveStats = useMemo(() => ({
    total:    leaves.filter(l=>!l.deleted).length,
    approved: leaves.filter(l=>!l.deleted&&l.status==='approved').length,
    pending:  leaves.filter(l=>!l.deleted&&l.status==='pending').length,
    totalDays: leaves.filter(l=>!l.deleted&&l.status==='approved')
      .reduce((a,l) => a + (l.startDate && l.endDate
        ? Math.abs(new Date(l.endDate)-new Date(l.startDate))/(1000*60*60*24)+1 : 1), 0),
  }), [leaves])

  // ── Pie data ───────────────────────────────────────
  const pieAdmin = adminYear.filter(a=>a.total>0).map(a=>({
    name: a.name.split(' ')[0], value: a.total,
  }))

  const piePage = pageYear.filter(p=>p.total>0).map(p=>({
    name: p.name.length>10?p.name.slice(0,10)+'…':p.name, value: p.total,
  }))

  // ── Export company report ──────────────────────────
  const exportCompanyReport = () => {
    const wb = XLSX.utils.book_new()

    // Sheet: Company summary
    const summary = [
      ['รายงานภาพรวมบริษัท', '', `ปี ${filterYear}`],
      [],
      ['ค่าคอมรวมทั้งปี', `฿${yearTotal.commission.toLocaleString()}`],
      ['ออเดอร์ตอบมือ', yearTotal.manualOrders, 'ออเดอร์'],
      ['ออเดอร์ AI', yearTotal.aiOrders, 'ออเดอร์'],
      ['ออเดอร์ยกเลิก', yearTotal.cancelOrders],
      ['ยอดพนักงาน', admins.length, 'คน'],
      ['ยอดเพจ', pages.length, 'เพจ'],
      [],
      ['รายเดือน', 'ค่าคอมรวม(฿)', 'มือ(฿)', 'AI(฿)', 'ออเดอร์'],
      ...monthlyTrend.map(m=>[m.label, m.ค่าคอม, m.มือ, m.AI, m.ออเดอร์]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'ภาพรวมบริษัท')

    // Sheet: Per-admin
    const adminRows = [
      ['#','ชื่อ','ตำแหน่ง','มือ(บ้าน)','AI(บ้าน)','ค่าคอมมือ(฿)','ค่าคอม AI(฿)','รวม(฿)','ยกเลิก','วันลา','โหมดหลัก'],
      ...adminYear.map((a,i)=>[
        i+1, a.name, ROLES[a.role]||a.role,
        a.manual, a.ai, a.manualComm, a.aiComm, a.total,
        a.cancel, a.leaveCount,
        a.manualPct >= 50 ? 'ตอบมือ' : 'AI',
      ]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(adminRows), 'รายบุคคล')

    // Sheet: Per-page
    const pageRows = [
      ['#','เพจ','ประเภท','มือ','AI','รวมออเดอร์','รวม(฿)'],
      ...pageYear.map((p,i)=>[i+1, p.name, p.type==='main'?'หลัก':'ทดสอบ', p.manual, p.ai, p.manual+p.ai, p.total]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pageRows), 'รายเพจ')

    XLSX.writeFile(wb, `รายงานบริษัท_${filterYear}.xlsx`)
  }

  const totalOrders = yearTotal.manualOrders + yearTotal.aiOrders

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <Building2 size={20} className="text-brand-400"/> ภาพรวมบริษัท
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">สถิติทั้งหมด · ผู้ดูแลสูงสุดเท่านั้น</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" className="input" style={{ width: 90 }}
            min="2020" max="2099" value={filterYear}
            onChange={e => setFilterYear(e.target.value)}/>
          <button className="btn btn-ghost btn-sm" onClick={exportCompanyReport}>
            <Download size={14}/> Excel
          </button>
        </div>
      </div>

      {/* ── KPI Hero ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-purple-500/5 col-span-2 lg:col-span-1">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingUp size={11}/> ค่าคอมรวมปีนี้</div>
          <div className="text-4xl font-black text-brand-400">฿{(yearTotal.commission/1000).toFixed(1)}K</div>
          <div className="text-xs text-gray-500 mt-1">฿{yearTotal.commission.toLocaleString()}</div>
          <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
            <ArrowUpRight size={11}/> เดือนนี้ ฿{monthTotal.commission.toLocaleString()}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Zap size={11}/> ออเดอร์ทั้งปี</div>
          <div className="text-3xl font-black">{totalOrders.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">บ้าน</div>
          <div className="flex gap-3 mt-2">
            <span className="text-xs text-purple-400">มือ {yearTotal.manualOrders.toLocaleString()}</span>
            <span className="text-xs text-emerald-400">AI {yearTotal.aiOrders.toLocaleString()}</span>
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Users size={11}/> พนักงาน</div>
          <div className="text-3xl font-black">{users.length}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(ROLES).map(([r, l]) => (
              <span key={r} className="text-[10px] text-gray-500">
                {l} {users.filter(u=>u.role===r).length}
              </span>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><BookOpen size={11}/> เพจ</div>
          <div className="text-3xl font-black">{pages.length}</div>
          <div className="flex gap-3 mt-2">
            <span className="text-xs text-brand-400">หลัก {pages.filter(p=>p.type==='main').length}</span>
            <span className="text-xs text-amber-400">ทดสอบ {pages.filter(p=>p.type==='test').length}</span>
          </div>
        </div>
      </div>

      {/* ── Secondary KPI ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'ค่าคอมมือรวม',  val: `฿${yearTotal.manualComm.toLocaleString()}`,  color: 'text-purple-400',  icon: <HandMetal size={12}/> },
          { label: 'ค่าคอม AI รวม', val: `฿${yearTotal.aiComm.toLocaleString()}`,      color: 'text-emerald-400', icon: <Bot size={12}/> },
          { label: 'ออเดอร์ยกเลิก', val: yearTotal.cancelOrders.toLocaleString(),      color: 'text-red-400',     icon: <XCircle size={12}/> },
          { label: 'ที่อยู่ไม่ชัด',  val: yearTotal.unclear.toLocaleString(),           color: 'text-orange-400',  icon: <AlertCircle size={12}/> },
          { label: 'วันลารวม',       val: `${leaveStats.totalDays} วัน`,               color: 'text-brand-400',   icon: <CalendarDays size={12}/> },
        ].map((s, i) => (
          <div key={i} className="card text-center py-3">
            <div className={`flex items-center justify-center gap-1 text-xs text-gray-500 mb-1 ${s.color}`}>{s.icon}{s.label}</div>
            <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── Trend Chart ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-bold flex items-center gap-2">
            <BarChart3 size={15} className="text-brand-400"/> แนวโน้มรายเดือน — ปี {filterYear}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={monthlyTrend}>
            <defs>
              <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f7cff" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#4f7cff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
            <XAxis dataKey="label" tick={{ fill:'#6b7280', fontSize:11 }}/>
            <YAxis tick={{ fill:'#6b7280', fontSize:11 }} tickFormatter={v=>`฿${(v/1000).toFixed(0)}k`}/>
            <Tooltip {...TT} formatter={(v,n)=>[`฿${v.toLocaleString()}`, n==='มือ'?'ตอบมือ':n==='AI'?'AI':'ค่าคอมรวม']}/>
            <Area type="monotone" dataKey="ค่าคอม" stroke="#4f7cff" fill="url(#colorComm)" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Pie charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieAdmin.length > 0 && (
          <div className="card">
            <div className="text-sm font-bold mb-3 flex items-center gap-2">
              <Users size={14} className="text-brand-400"/> สัดส่วนค่าคอมรายบุคคล
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieAdmin} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                  paddingAngle={3} dataKey="value">
                  {pieAdmin.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip {...TT} formatter={v=>[`฿${v.toLocaleString()}`]}/>
                <Legend formatter={v=><span style={{color:'#9ca3af',fontSize:11}}>{v}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {piePage.length > 0 && (
          <div className="card">
            <div className="text-sm font-bold mb-3 flex items-center gap-2">
              <BookOpen size={14} className="text-brand-400"/> สัดส่วนค่าคอมรายเพจ
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={piePage} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                  paddingAngle={3} dataKey="value">
                  {piePage.map((_,i)=><Cell key={i} fill={COLORS[(i+3)%COLORS.length]}/>)}
                </Pie>
                <Tooltip {...TT} formatter={v=>[`฿${v.toLocaleString()}`]}/>
                <Legend formatter={v=><span style={{color:'#9ca3af',fontSize:11}}>{v}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Top performers ── */}
      {adminYear.filter(a=>a.total>0).length > 0 && (
        <div className="card">
          <div className="text-sm font-bold mb-4 flex items-center gap-2">
            <Award size={15} className="text-amber-400"/> Top Performance ปี {filterYear}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {adminYear.filter(a=>a.total>0).slice(0,3).map((a,i)=>(
              <div key={a.id} className={`rounded-xl p-4 border text-center ${
                i===0?'bg-amber-500/10 border-amber-500/30':
                i===1?'bg-gray-500/10 border-gray-500/30':
                      'bg-orange-700/10 border-orange-700/30'}`}>
                <div className="text-3xl mb-2">{['🥇','🥈','🥉'][i]}</div>
                <Avatar name={a.avatar||a.name} size="lg" className="mx-auto mb-2"/>
                <div className="font-bold">{a.name}</div>
                <div className="text-xs text-gray-500">{ROLES[a.role]}</div>
                <div className={`text-2xl font-black mt-2 ${
                  i===0?'text-amber-400':i===1?'text-gray-500':'text-orange-500'}`}>
                  ฿{a.total.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {a.manual+a.ai} บ้าน · {a.manualPct>=50?'🖐 มือหลัก':'🤖 AI หลัก'}
                </div>
              </div>
            ))}
          </div>

          {/* Full admin table */}
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>#</th><th>แอดมิน</th><th>ตำแหน่ง</th>
                <th className="text-right text-purple-400">มือ(บ้าน)</th>
                <th className="text-right text-purple-400">฿มือ</th>
                <th className="text-right text-emerald-400">AI(บ้าน)</th>
                <th className="text-right text-emerald-400">฿AI</th>
                <th className="text-right text-red-400">ยกเลิก</th>
                <th className="text-right text-brand-400">รวม(฿)</th>
                <th>สัดส่วน</th>
                <th>โหมดหลัก</th>
              </tr></thead>
              <tbody>
                {adminYear.map((a,i)=>(
                  <tr key={a.id} className={a.total===0?'opacity-40':''}>
                    <td className="text-gray-500">
                      {i<3?['🥇','🥈','🥉'][i]:`#${i+1}`}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={a.avatar||a.name} size="sm"/>
                        <span className="font-semibold text-sm">{a.name}</span>
                      </div>
                    </td>
                    <td><span className="badge-gray text-xs">{ROLES[a.role]}</span></td>
                    <td className="text-right text-purple-400">{a.manual.toLocaleString()}</td>
                    <td className="text-right text-xs text-purple-300">฿{a.manualComm.toLocaleString()}</td>
                    <td className="text-right text-emerald-400">{a.ai.toLocaleString()}</td>
                    <td className="text-right text-xs text-emerald-300">฿{a.aiComm.toLocaleString()}</td>
                    <td className="text-right text-red-400">{a.cancel}</td>
                    <td className="text-right font-black text-brand-400">฿{a.total.toLocaleString()}</td>
                    <td style={{minWidth:120}}>
                      <div className="flex gap-1 text-[10px] text-gray-500 mb-0.5">
                        <span className="text-purple-400">{a.manualPct}%</span>
                        <span>/</span>
                        <span className="text-emerald-400">{100-a.manualPct}%</span>
                      </div>
                      <div className="h-1.5 bg-indigo-50 rounded-full overflow-hidden flex">
                        <div className="bg-purple-500" style={{width:`${a.manualPct}%`}}/>
                        <div className="bg-emerald-500 flex-1"/>
                      </div>
                    </td>
                    <td>
                      <span className={`text-xs font-bold ${a.manualPct>=50?'text-purple-400':'text-emerald-400'}`}>
                        {a.manualPct>=50?'🖐 มือ':'🤖 AI'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Page performance ── */}
      <div className="card">
        <div className="text-sm font-bold mb-4 flex items-center gap-2">
          <BookOpen size={15} className="text-brand-400"/> ผลงานแยกตามเพจ — ปี {filterYear}
        </div>
        {pageYear.length === 0
          ? <Empty icon={BookOpen} title="ยังไม่มีเพจ"/>
          : <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>#</th><th>เพจ</th><th>ประเภท</th>
                  <th>มอบหมายให้</th>
                  <th className="text-right text-purple-400">มือ</th>
                  <th className="text-right text-emerald-400">AI</th>
                  <th className="text-right">รวมออเดอร์</th>
                  <th className="text-right text-brand-400">รวม(฿)</th>
                  <th>สัดส่วน</th>
                </tr></thead>
                <tbody>
                  {pageYear.map((p,i)=>{
                    const pct = yearTotal.commission>0?(p.total/yearTotal.commission*100).toFixed(1):0
                    const assignedNames = (p.assignedTo||[])
                      .map(id=>users.find(u=>u.id===id)?.name?.split(' ')[0]||'?')
                      .join(', ')
                    return (
                      <tr key={p.id} className={p.total===0?'opacity-40':''}>
                        <td className="text-gray-500">{i+1}</td>
                        <td className="font-semibold">{p.name}</td>
                        <td>
                          <span className={p.type==='main'?'badge-blue':'badge-orange'}>
                            {p.type==='main'?<Star size={9} className="inline"/>:<TestTube size={9} className="inline"/>}
                            {' '}{p.type==='main'?'หลัก':'ทดสอบ'}
                          </span>
                        </td>
                        <td className="text-xs text-gray-500">{assignedNames||'—'}</td>
                        <td className="text-right text-purple-400">{p.manual.toLocaleString()}</td>
                        <td className="text-right text-emerald-400">{p.ai.toLocaleString()}</td>
                        <td className="text-right font-semibold">{(p.manual+p.ai).toLocaleString()}</td>
                        <td className="text-right font-black text-brand-400">฿{p.total.toLocaleString()}</td>
                        <td style={{minWidth:100}}>
                          <div className="text-xs text-gray-500 mb-0.5">{pct}%</div>
                          <div className="progress-bar"><div className="progress-fill" style={{width:`${pct}%`}}/></div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* ── System info ── */}
      <div className="card border-indigo-200/50">
        <div className="text-sm font-bold mb-3 flex items-center gap-2">
          <Building2 size={14} className="text-gray-500"/> ข้อมูลระบบ
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          {[
            { label: 'พนักงานทั้งหมด', val: `${users.length} คน` },
            { label: 'เพจทั้งหมด', val: `${pages.length} เพจ` },
            { label: 'ข้อมูลค่าคอม', val: `${commissions.length} รายการ` },
            { label: 'รายการลา', val: `${leaves.filter(l=>!l.deleted).length} ครั้ง` },
            { label: 'ค่าคอมมือ (ปัจจุบัน)', val: `฿${commRates.manualRate}/บ้าน` },
            { label: 'ค่าคอม AI (ปัจจุบัน)', val: `฿${commRates.aiRate}/บ้าน` },
            { label: 'เพจใช้งาน', val: `${pages.filter(p=>p.status==='active').length} เพจ` },
            { label: 'เพจยังไม่มอบหมาย', val: `${pages.filter(p=>!p.assignedTo?.length).length} เพจ` },
          ].map((s,i)=>(
            <div key={i} className="flex flex-col">
              <span className="text-xs text-gray-500">{s.label}</span>
              <span className="font-bold text-gray-200 mt-0.5">{s.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
