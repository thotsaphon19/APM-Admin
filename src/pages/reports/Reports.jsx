import React, { useState, useMemo, useCallback } from 'react'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { Avatar, Empty, StatCard } from '../../components/ui'
import {
  BarChart3, TrendingUp, Users, BookOpen, HandMetal, Bot,
  XCircle, AlertCircle, Download, FileSpreadsheet, FileText,
  ChevronDown, ChevronUp, Award, Zap,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from 'recharts'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const TT = {
  contentStyle: {
    background: '#111827', border: '1px solid #1f2937',
    borderRadius: 10, color: '#f3f4f6', fontSize: 12,
  },
}
const COLORS = ['#4f7cff','#10b981','#7c3aed','#f97316','#ef4444','#eab308','#06b6d4','#ec4899']
const today = format(new Date(), 'yyyy-MM-dd')
const thisMonth = format(new Date(), 'yyyy-MM')

const TABS = [
  { key: 'overview',  label: 'ภาพรวม' },
  { key: 'daily',     label: 'ค่าคอมรายวัน' },
  { key: 'monthly',   label: 'ค่าคอมรายเดือน' },
  { key: 'byAdmin',   label: 'รายบุคคล' },
  { key: 'byPage',    label: 'รายเพจ' },
  { key: 'orders',    label: 'สถิติออเดอร์' },
]

export default function Reports() {
  const { profile } = useAuth()
  const { commissions, pages, users, getUserName, getPageName } = useData()

  const [tab,         setTab]         = useState('overview')
  const [filterMonth, setFilterMonth] = useState(thisMonth)
  const [filterYear,  setFilterYear]  = useState(format(new Date(), 'yyyy'))
  const [filterAdmin, setFilterAdmin] = useState('')
  const [filterPage,  setFilterPage]  = useState('')
  const [expandAdmin, setExpandAdmin] = useState(null)

  const admins = users.filter(u => ['admin','head_admin'].includes(u.role))

  // ── filtered base ──────────────────────────────────
  const monthComms = useMemo(() =>
    commissions.filter(c => c.date?.startsWith(filterMonth)),
    [commissions, filterMonth])

  const yearComms = useMemo(() =>
    commissions.filter(c => c.date?.startsWith(filterYear)),
    [commissions, filterYear])

  const allComms = useMemo(() => {
    let d = commissions
    if (filterAdmin) d = d.filter(c => c.adminId === filterAdmin)
    if (filterPage)  d = d.filter(c => c.pageId  === filterPage)
    return d
  }, [commissions, filterAdmin, filterPage])

  // ── Grand totals ───────────────────────────────────
  const grand = useMemo(() => monthComms.reduce((a, c) => ({
    total:         a.total         + (c.total         || 0),
    manualOrders:  a.manualOrders  + (c.manualOrders  || 0),
    aiOrders:      a.aiOrders      + (c.aiOrders      || 0),
    cancelOrders:  a.cancelOrders  + (c.cancelOrders  || 0),
    unclearOrders: a.unclearOrders + (c.unclearOrders || 0),
    manualTotal:   a.manualTotal   + (c.manualTotal   || 0),
    aiTotal:       a.aiTotal       + (c.aiTotal       || 0),
  }), { total:0,manualOrders:0,aiOrders:0,cancelOrders:0,unclearOrders:0,manualTotal:0,aiTotal:0 }),
  [monthComms])

  const totalOrders = grand.manualOrders + grand.aiOrders

  // ── Daily chart data ───────────────────────────────
  const dailyData = useMemo(() => {
    const start = startOfMonth(parseISO(filterMonth + '-01'))
    const end   = endOfMonth(start)
    const days  = eachDayOfInterval({ start, end })
    return days.map(d => {
      const ds = format(d, 'yyyy-MM-dd')
      const cs = monthComms.filter(c => c.date === ds)
      return {
        date:  format(d, 'd'),
        มือ:   cs.reduce((a,c) => a+(c.manualTotal||0), 0),
        AI:    cs.reduce((a,c) => a+(c.aiTotal    ||0), 0),
        รวม:   cs.reduce((a,c) => a+(c.total      ||0), 0),
        orders:cs.reduce((a,c) => a+(c.manualOrders||0)+(c.aiOrders||0), 0),
      }
    }).filter(d => d.รวม > 0)
  }, [monthComms, filterMonth])

  // ── Monthly chart data ─────────────────────────────
  const monthlyData = useMemo(() => {
    const months = Array.from({length:12},(_,i)=> {
      const m = `${filterYear}-${String(i+1).padStart(2,'0')}`
      const cs = yearComms.filter(c => c.date?.startsWith(m))
      return {
        label: format(parseISO(m+'-01'), 'MMM', {locale:th}),
        มือ:   cs.reduce((a,c)=>a+(c.manualTotal||0),0),
        AI:    cs.reduce((a,c)=>a+(c.aiTotal    ||0),0),
        รวม:   cs.reduce((a,c)=>a+(c.total      ||0),0),
      }
    })
    return months
  }, [yearComms, filterYear])

  // ── Per-admin summary ──────────────────────────────
  const adminSummary = useMemo(() => admins.map(u => {
    const cs = monthComms.filter(c => c.adminId === u.id)
    const manual = cs.reduce((a,c)=>a+(c.manualOrders||0),0)
    const ai     = cs.reduce((a,c)=>a+(c.aiOrders    ||0),0)
    const total  = cs.reduce((a,c)=>a+(c.total       ||0),0)
    return {
      ...u,
      manual, ai, total,
      cancel:       cs.reduce((a,c)=>a+(c.cancelOrders ||0),0),
      unclear:      cs.reduce((a,c)=>a+(c.unclearOrders||0),0),
      manualComm:   cs.reduce((a,c)=>a+(c.manualTotal  ||0),0),
      aiComm:       cs.reduce((a,c)=>a+(c.aiTotal      ||0),0),
      entries: cs.length,
      records: cs,
      dominantMode: manual >= ai ? 'มือ' : 'AI',
      manualPct: (manual+ai)>0 ? Math.round(manual/(manual+ai)*100) : 0,
    }
  }).sort((a,b)=>b.total-a.total), [admins, monthComms])

  // ── Per-page summary ───────────────────────────────
  const pageSummary = useMemo(() => pages.map(p => {
    const cs = monthComms.filter(c => c.pageId === p.id)
    return {
      ...p,
      manual:  cs.reduce((a,c)=>a+(c.manualOrders||0),0),
      ai:      cs.reduce((a,c)=>a+(c.aiOrders    ||0),0),
      total:   cs.reduce((a,c)=>a+(c.total       ||0),0),
      cancel:  cs.reduce((a,c)=>a+(c.cancelOrders||0),0),
      entries: cs.length,
    }
  }).sort((a,b)=>b.total-a.total), [pages, monthComms])

  // ── Pie data ───────────────────────────────────────
  const pieOrders = [
    { name:'ตอบมือ', value: grand.manualOrders },
    { name:'AI',     value: grand.aiOrders },
    { name:'ยกเลิก', value: grand.cancelOrders },
    { name:'ไม่ชัด', value: grand.unclearOrders },
  ].filter(d=>d.value>0)

  const pieComm = [
    { name:'ค่าคอมมือ', value: grand.manualTotal },
    { name:'ค่าคอม AI', value: grand.aiTotal },
  ].filter(d=>d.value>0)

  // ── EXPORT EXCEL ──────────────────────────────────
  const exportExcel = useCallback(() => {
    const wb = XLSX.utils.book_new()

    // Sheet 1: รายการทั้งหมด
    const rows1 = [
      ['วันที่','แอดมิน','เพจ','ตอบมือ(บ้าน)','ค่าคอมมือ(฿)','AI(บ้าน)','ค่าคอม AI(฿)','ยกเลิก','ไม่ชัดเจน','รวม(฿)','หมายเหตุ'],
      ...monthComms.map(c=>[
        c.date, getUserName(c.adminId), getPageName(c.pageId),
        c.manualOrders||0, c.manualTotal||0,
        c.aiOrders||0, c.aiTotal||0,
        c.cancelOrders||0, c.unclearOrders||0,
        c.total||0, c.note||'',
      ])
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows1), 'รายการทั้งหมด')

    // Sheet 2: รายบุคคล
    const rows2 = [
      ['ลำดับ','ชื่อแอดมิน','ตำแหน่ง','ตอบมือ(บ้าน)','ค่าคอมมือ(฿)','AI(บ้าน)','ค่าคอม AI(฿)','ยกเลิก','ไม่ชัดเจน','รวม(฿)','สัดส่วนมือ','โหมดหลัก'],
      ...adminSummary.map((a,i)=>[
        i+1, a.name, ROLES[a.role]||a.role,
        a.manual, a.manualComm,
        a.ai, a.aiComm,
        a.cancel, a.unclear,
        a.total,
        `${a.manualPct}% มือ / ${100-a.manualPct}% AI`,
        a.dominantMode,
      ])
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows2), 'รายบุคคล')

    // Sheet 3: รายเพจ
    const rows3 = [
      ['ลำดับ','ชื่อเพจ','ประเภท','ตอบมือ(บ้าน)','AI(บ้าน)','รวมออเดอร์','รวม(฿)'],
      ...pageSummary.map((p,i)=>[
        i+1, p.name, p.type==='main'?'หลัก':'ทดสอบ',
        p.manual, p.ai, p.manual+p.ai, p.total,
      ])
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows3), 'รายเพจ')

    // Sheet 4: รายวัน
    const rows4 = [
      ['วัน','ค่าคอมมือ(฿)','ค่าคอม AI(฿)','รวม(฿)'],
      ...dailyData.map(d=>[d.date, d.มือ, d.AI, d.รวม])
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows4), 'รายวัน')

    XLSX.writeFile(wb, `รายงานค่าคอม_${filterMonth}.xlsx`)
  }, [monthComms, adminSummary, pageSummary, dailyData, filterMonth, getUserName, getPageName])

  // ── EXPORT PDF ────────────────────────────────────
  const exportPDF = useCallback(() => {
    const doc = new jsPDF({ orientation: 'landscape' })

    // Title
    doc.setFontSize(16)
    doc.text(`รายงานค่าคอมมิชชั่น เดือน ${filterMonth}`, 14, 16)
    doc.setFontSize(10)
    doc.text(`สร้างเมื่อ ${format(new Date(),'dd/MM/yyyy HH:mm')}`, 14, 22)

    // Summary box
    doc.setFontSize(11)
    doc.text([
      `ค่าคอมรวม: ${grand.total.toLocaleString()} บาท`,
      `ออเดอรทั้งหมด: ${totalOrders.toLocaleString()} บ้าน  (มือ ${grand.manualOrders} / AI ${grand.aiOrders})`,
      `ยกเลิก: ${grand.cancelOrders}  ไม่ชัดเจน: ${grand.unclearOrders}`,
    ], 14, 30)

    // Per-admin table
    doc.setFontSize(12)
    doc.text('สรุปรายบุคคล', 14, 50)
    autoTable(doc, {
      startY: 54,
      head: [['#','ชื่อ','ตำแหน่ง','มือ(บ้าน)','฿มือ','AI(บ้าน)','฿AI','ยกเลิก','รวม(฿)','โหมดหลัก']],
      body: adminSummary.map((a,i) => [
        i+1, a.name, ROLES[a.role]||a.role,
        a.manual, a.manualComm.toLocaleString(),
        a.ai, a.aiComm.toLocaleString(),
        a.cancel, a.total.toLocaleString(),
        a.dominantMode,
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30,40,80] },
      alternateRowStyles: { fillColor: [245,247,255] },
    })

    // Per-page table
    const y2 = doc.lastAutoTable.finalY + 10
    doc.setFontSize(12)
    doc.text('สรุปรายเพจ', 14, y2)
    autoTable(doc, {
      startY: y2 + 4,
      head: [['#','เพจ','ประเภท','มือ(บ้าน)','AI(บ้าน)','รวมออเดอร์','รวม(฿)']],
      body: pageSummary.map((p,i) => [
        i+1, p.name, p.type==='main'?'หลัก':'ทดสอบ',
        p.manual, p.ai, p.manual+p.ai,
        p.total.toLocaleString(),
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [20,80,60] },
      alternateRowStyles: { fillColor: [245,255,250] },
    })

    doc.save(`รายงานค่าคอม_${filterMonth}.pdf`)
  }, [grand, totalOrders, adminSummary, pageSummary, filterMonth])

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black">รายงาน & สถิติ</h2>
          <p className="text-xs text-gray-500 mt-0.5">วิเคราะห์ข้อมูลค่าคอมและการทำงานครบทุกมิติ</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={exportExcel}>
            <FileSpreadsheet size={14} className="text-emerald-400" /> Excel
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exportPDF}>
            <FileText size={14} className="text-red-400" /> PDF
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">เดือน</label>
            <input type="month" className="input" style={{width:'auto'}}
              value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} />
          </div>
          <div>
            <label className="label">ปี (สำหรับกราฟรายเดือน)</label>
            <input type="number" className="input" style={{width:100}}
              min="2020" max="2099"
              value={filterYear} onChange={e=>setFilterYear(e.target.value)} />
          </div>
          <div>
            <label className="label">แอดมิน</label>
            <select className="input" value={filterAdmin} onChange={e=>setFilterAdmin(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {admins.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">เพจ</label>
            <select className="input" value={filterPage} onChange={e=>setFilterPage(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        {TABS.map(t=>(
          <button key={t.key} className={`tab ${tab===t.key?'active':''}`}
            onClick={()=>setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ═══════════════ OVERVIEW ═══════════════ */}
      {tab==='overview' && (
        <div className="space-y-5">
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card border-brand-500/30 bg-brand-500/5 text-center">
              <div className="text-xs text-gray-500 mb-1">ค่าคอมรวมเดือนนี้</div>
              <div className="text-3xl font-black text-brand-400">฿{grand.total.toLocaleString()}</div>
              <div className="text-xs text-gray-600 mt-1">{monthComms.length} รายการ</div>
            </div>
            <div className="card border-purple-500/30 bg-purple-500/5 text-center">
              <div className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1"><HandMetal size={10}/>ค่าคอมตอบมือ</div>
              <div className="text-3xl font-black text-purple-400">฿{grand.manualTotal.toLocaleString()}</div>
              <div className="text-xs text-gray-600 mt-1">{grand.manualOrders.toLocaleString()} บ้าน</div>
            </div>
            <div className="card border-emerald-500/30 bg-emerald-500/5 text-center">
              <div className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1"><Bot size={10}/>ค่าคอม AI</div>
              <div className="text-3xl font-black text-emerald-400">฿{grand.aiTotal.toLocaleString()}</div>
              <div className="text-xs text-gray-600 mt-1">{grand.aiOrders.toLocaleString()} บ้าน</div>
            </div>
            <div className="card border-red-500/30 bg-red-500/5 text-center">
              <div className="text-xs text-gray-500 mb-1">ออเดอร์มีปัญหา</div>
              <div className="text-3xl font-black text-red-400">{grand.cancelOrders + grand.unclearOrders}</div>
              <div className="text-xs text-gray-600 mt-1">{grand.cancelOrders} ยกเลิก / {grand.unclearOrders} ไม่ชัด</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pie: orders */}
            {pieOrders.length>0 && (
              <div className="card">
                <div className="text-sm font-bold mb-3 flex items-center gap-2">
                  <BarChart3 size={15} className="text-brand-400"/> สัดส่วนออเดอร์
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieOrders} cx="50%" cy="50%"
                      innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieOrders.map((_,i)=><Cell key={i} fill={COLORS[i]}/>)}
                    </Pie>
                    <Tooltip {...TT} formatter={v=>[`${v.toLocaleString()} บ้าน`]}/>
                    <Legend formatter={v=><span style={{color:'#9ca3af',fontSize:12}}>{v}</span>}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Pie: commission split */}
            {pieComm.length>0 && (
              <div className="card">
                <div className="text-sm font-bold mb-3 flex items-center gap-2">
                  <TrendingUp size={15} className="text-brand-400"/> สัดส่วนค่าคอม
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieComm} cx="50%" cy="50%"
                      innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieComm.map((_,i)=><Cell key={i} fill={[COLORS[2],COLORS[1]][i]}/>)}
                    </Pie>
                    <Tooltip {...TT} formatter={v=>[`฿${v.toLocaleString()}`]}/>
                    <Legend formatter={v=><span style={{color:'#9ca3af',fontSize:12}}>{v}</span>}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top 3 admin */}
          {adminSummary.filter(a=>a.total>0).length>0 && (
            <div className="card">
              <div className="text-sm font-bold mb-4 flex items-center gap-2">
                <Award size={15} className="text-amber-400"/> Top แอดมินเดือนนี้
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {adminSummary.filter(a=>a.total>0).slice(0,3).map((a,i)=>(
                  <div key={a.id} className={`rounded-xl p-4 border text-center ${
                    i===0?'bg-amber-500/10 border-amber-500/30':
                    i===1?'bg-gray-500/10 border-gray-500/30':
                          'bg-orange-700/10 border-orange-700/30'}`}>
                    <div className="text-2xl mb-2">{['🥇','🥈','🥉'][i]}</div>
                    <Avatar name={a.avatar||a.name} size="md" className="mx-auto mb-2"/>
                    <div className="font-bold text-sm truncate">{a.name}</div>
                    <div className={`text-xl font-black mt-1 ${
                      i===0?'text-amber-400':i===1?'text-gray-400':'text-orange-600'}`}>
                      ฿{a.total.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {a.manual+a.ai} บ้าน · {a.dominantMode}หลัก
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ DAILY ═══════════════ */}
      {tab==='daily' && (
        <div className="space-y-4">
          {dailyData.length===0
            ? <div className="card"><Empty icon={TrendingUp} title="ไม่มีข้อมูลในเดือนนี้"/></div>
            : <>
              <div className="card">
                <div className="text-sm font-bold mb-4">กราฟค่าคอมรายวัน — {filterMonth}</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dailyData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                    <XAxis dataKey="date" tick={{fill:'#6b7280',fontSize:11}}/>
                    <YAxis tick={{fill:'#6b7280',fontSize:11}} tickFormatter={v=>`฿${(v/1000).toFixed(0)}k`}/>
                    <Tooltip {...TT} formatter={(v,n)=>[`฿${v.toLocaleString()}`,n==='มือ'?'ตอบมือ':n==='AI'?'AI':'รวม']}/>
                    <Legend formatter={v=><span style={{color:'#9ca3af',fontSize:12}}>{v==='มือ'?'ตอบมือ':v==='AI'?'AI':v}</span>}/>
                    <Bar dataKey="มือ" fill="#7c3aed" radius={[3,3,0,0]}/>
                    <Bar dataKey="AI"  fill="#10b981" radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-0 overflow-hidden">
                <div className="table-wrap">
                  <table>
                    <thead><tr>
                      <th>วัน</th>
                      <th className="text-right text-purple-400">฿มือ</th>
                      <th className="text-right text-emerald-400">฿AI</th>
                      <th className="text-right">ออเดอร์</th>
                      <th className="text-right text-brand-400">รวม</th>
                    </tr></thead>
                    <tbody>
                      {dailyData.map(d=>(
                        <tr key={d.date}>
                          <td className="text-xs font-semibold">วันที่ {d.date}</td>
                          <td className="text-right text-purple-400">฿{d.มือ.toLocaleString()}</td>
                          <td className="text-right text-emerald-400">฿{d.AI.toLocaleString()}</td>
                          <td className="text-right text-gray-400">{d.orders}</td>
                          <td className="text-right font-black text-brand-400">฿{d.รวม.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-800/50">
                        <td className="font-bold text-xs text-gray-400">รวมเดือน</td>
                        <td className="text-right font-bold text-purple-400">฿{grand.manualTotal.toLocaleString()}</td>
                        <td className="text-right font-bold text-emerald-400">฿{grand.aiTotal.toLocaleString()}</td>
                        <td className="text-right font-bold">{totalOrders.toLocaleString()}</td>
                        <td className="text-right font-black text-brand-400 text-base">฿{grand.total.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          }
        </div>
      )}

      {/* ═══════════════ MONTHLY ═══════════════ */}
      {tab==='monthly' && (
        <div className="space-y-4">
          <div className="card">
            <div className="text-sm font-bold mb-4">กราฟค่าคอมรายเดือน — ปี {filterYear}</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                <XAxis dataKey="label" tick={{fill:'#6b7280',fontSize:11}}/>
                <YAxis tick={{fill:'#6b7280',fontSize:11}} tickFormatter={v=>`฿${(v/1000).toFixed(0)}k`}/>
                <Tooltip {...TT} formatter={(v,n)=>[`฿${v.toLocaleString()}`,n==='มือ'?'ตอบมือ':'AI']}/>
                <Bar dataKey="มือ" fill="#7c3aed" radius={[3,3,0,0]}/>
                <Bar dataKey="AI"  fill="#10b981" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>เดือน</th>
                  <th className="text-right text-purple-400">฿มือ</th>
                  <th className="text-right text-emerald-400">฿AI</th>
                  <th className="text-right text-brand-400">รวม</th>
                </tr></thead>
                <tbody>
                  {monthlyData.map((d,i)=>(
                    <tr key={i}>
                      <td className="font-semibold text-sm">{d.label}</td>
                      <td className="text-right text-purple-400">฿{d.มือ.toLocaleString()}</td>
                      <td className="text-right text-emerald-400">฿{d.AI.toLocaleString()}</td>
                      <td className="text-right font-black text-brand-400">฿{d.รวม.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-800/50">
                    <td className="font-bold text-xs text-gray-400">รวมทั้งปี</td>
                    <td className="text-right font-bold text-purple-400">
                      ฿{monthlyData.reduce((a,d)=>a+d.มือ,0).toLocaleString()}
                    </td>
                    <td className="text-right font-bold text-emerald-400">
                      ฿{monthlyData.reduce((a,d)=>a+d.AI,0).toLocaleString()}
                    </td>
                    <td className="text-right font-black text-brand-400 text-base">
                      ฿{monthlyData.reduce((a,d)=>a+d.รวม,0).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ BY ADMIN ═══════════════ */}
      {tab==='byAdmin' && (
        <div className="space-y-3">
          {adminSummary.length===0
            ? <div className="card"><Empty icon={Users} title="ไม่มีแอดมิน"/></div>
            : adminSummary.map((a,idx)=>(
              <div key={a.id} className="card p-0 overflow-hidden">
                {/* Summary row */}
                <div className="flex flex-wrap items-center gap-4 p-4 cursor-pointer hover:bg-gray-800/20 transition-colors"
                  onClick={()=>setExpandAdmin(expandAdmin===a.id?null:a.id)}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-lg font-black text-gray-700 w-6 flex-shrink-0 text-center">
                      {idx<3?['🥇','🥈','🥉'][idx]:`#${idx+1}`}
                    </span>
                    <Avatar name={a.avatar||a.name} size="md"/>
                    <div className="min-w-0">
                      <div className="font-bold truncate">{a.name}</div>
                      <div className="text-xs text-gray-500">{ROLES[a.role]} · {a.entries} วัน</div>
                    </div>
                  </div>
                  {/* Mini stats */}
                  <div className="flex flex-wrap gap-6 items-center justify-end flex-1">
                    <MiniStat label="ตอบมือ" val={`${a.manual} บ้าน`} sub={`฿${a.manualComm.toLocaleString()}`} color="text-purple-400"/>
                    <MiniStat label="AI" val={`${a.ai} บ้าน`} sub={`฿${a.aiComm.toLocaleString()}`} color="text-emerald-400"/>
                    <MiniStat label="ยกเลิก/ไม่ชัด" val={`${a.cancel}/${a.unclear}`} color="text-red-400"/>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-0.5">ค่าคอมรวม</div>
                      <div className={`text-xl font-black ${a.total>0?'text-brand-400':'text-gray-600'}`}>
                        ฿{a.total.toLocaleString()}
                      </div>
                      {/* dominant badge */}
                      <span className={`text-xs font-bold ${a.dominantMode==='มือ'?'text-purple-400':'text-emerald-400'}`}>
                        {a.dominantMode==='มือ'?'🖐 มือหลัก':'🤖 AI หลัก'}
                      </span>
                    </div>
                    <span className="text-gray-500">{expandAdmin===a.id?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</span>
                  </div>
                </div>

                {/* Expanded: full breakdown */}
                {expandAdmin===a.id && (
                  <div className="border-t border-gray-800 bg-gray-900/50">
                    {/* Progress bar mue vs AI */}
                    <div className="px-5 py-3 border-b border-gray-800">
                      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                        <span className="text-purple-400 font-semibold">🖐 ตอบมือ {a.manualPct}%</span>
                        <span className="text-emerald-400 font-semibold">🤖 AI {100-a.manualPct}%</span>
                      </div>
                      <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden flex">
                        <div className="bg-purple-500 rounded-l-full transition-all duration-500"
                          style={{width:`${a.manualPct}%`}}/>
                        <div className="bg-emerald-500 rounded-r-full flex-1"/>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600 mt-1">
                        <span>{a.manual.toLocaleString()} บ้าน · ฿{a.manualComm.toLocaleString()}</span>
                        <span>{a.ai.toLocaleString()} บ้าน · ฿{a.aiComm.toLocaleString()}</span>
                      </div>
                    </div>
                    {/* Records table */}
                    <div className="table-wrap px-2 pb-3">
                      <table>
                        <thead><tr>
                          <th>วันที่</th><th>เพจ</th>
                          <th className="text-right text-purple-400">มือ</th>
                          <th className="text-right text-purple-400">฿มือ</th>
                          <th className="text-right text-emerald-400">AI</th>
                          <th className="text-right text-emerald-400">฿AI</th>
                          <th className="text-right text-red-400">ยกเลิก</th>
                          <th className="text-right text-orange-400">ไม่ชัด</th>
                          <th className="text-right text-brand-400">รวม</th>
                          <th>หมายเหตุ</th>
                        </tr></thead>
                        <tbody>
                          {[...a.records].sort((x,y)=>y.date?.localeCompare(x.date)).map(c=>(
                            <tr key={c.id}>
                              <td className="text-xs text-gray-400">{c.date}</td>
                              <td className="text-xs max-w-[120px] truncate">{getPageName(c.pageId)}</td>
                              <td className="text-right text-purple-400">{c.manualOrders||0}</td>
                              <td className="text-right text-xs text-purple-300">฿{(c.manualTotal||0).toLocaleString()}</td>
                              <td className="text-right text-emerald-400">{c.aiOrders||0}</td>
                              <td className="text-right text-xs text-emerald-300">฿{(c.aiTotal||0).toLocaleString()}</td>
                              <td className="text-right text-red-400">{c.cancelOrders||0}</td>
                              <td className="text-right text-orange-400">{c.unclearOrders||0}</td>
                              <td className="text-right font-black text-brand-400">฿{(c.total||0).toLocaleString()}</td>
                              <td className="text-xs text-gray-500 max-w-[100px] truncate">{c.note||'—'}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-800/60">
                            <td colSpan={2} className="font-bold text-xs text-gray-400">รวม</td>
                            <td className="text-right font-black text-purple-400">{a.manual}</td>
                            <td className="text-right font-bold text-purple-300">฿{a.manualComm.toLocaleString()}</td>
                            <td className="text-right font-black text-emerald-400">{a.ai}</td>
                            <td className="text-right font-bold text-emerald-300">฿{a.aiComm.toLocaleString()}</td>
                            <td className="text-right font-bold text-red-400">{a.cancel}</td>
                            <td className="text-right font-bold text-orange-400">{a.unclear}</td>
                            <td className="text-right font-black text-brand-400 text-base">฿{a.total.toLocaleString()}</td>
                            <td/>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))
          }
        </div>
      )}

      {/* ═══════════════ BY PAGE ═══════════════ */}
      {tab==='byPage' && (
        <div className="card p-0 overflow-hidden">
          {pageSummary.length===0
            ? <Empty icon={BookOpen} title="ไม่มีเพจ"/>
            : <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>#</th><th>เพจ</th><th>ประเภท</th>
                    <th className="text-right text-purple-400">มือ (บ้าน)</th>
                    <th className="text-right text-purple-400">฿มือ</th>
                    <th className="text-right text-emerald-400">AI (บ้าน)</th>
                    <th className="text-right text-emerald-400">฿AI</th>
                    <th className="text-right">รวมออเดอร์</th>
                    <th className="text-right text-brand-400">รวม(฿)</th>
                    <th>สัดส่วน</th>
                  </tr></thead>
                  <tbody>
                    {pageSummary.map((p,i)=>{
                      const pct = grand.total>0?(p.total/grand.total*100).toFixed(1):0
                      return (
                        <tr key={p.id}>
                          <td className="text-gray-600">{i+1}</td>
                          <td className="font-semibold">{p.name}</td>
                          <td><span className={p.type==='main'?'badge-blue':'badge-orange'}>
                            {p.type==='main'?'หลัก':'ทดสอบ'}
                          </span></td>
                          <td className="text-right text-purple-400">{p.manual.toLocaleString()}</td>
                          <td className="text-right text-xs text-purple-300">
                            ฿{monthComms.filter(c=>c.pageId===p.id).reduce((a,c)=>a+(c.manualTotal||0),0).toLocaleString()}
                          </td>
                          <td className="text-right text-emerald-400">{p.ai.toLocaleString()}</td>
                          <td className="text-right text-xs text-emerald-300">
                            ฿{monthComms.filter(c=>c.pageId===p.id).reduce((a,c)=>a+(c.aiTotal||0),0).toLocaleString()}
                          </td>
                          <td className="text-right font-semibold">{(p.manual+p.ai).toLocaleString()}</td>
                          <td className="text-right font-black text-brand-400">฿{p.total.toLocaleString()}</td>
                          <td style={{minWidth:120}}>
                            <div className="text-xs text-gray-500 mb-1">{pct}%</div>
                            <div className="progress-bar"><div className="progress-fill" style={{width:`${pct}%`}}/></div>
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-gray-800/50">
                      <td colSpan={3} className="font-bold text-xs text-gray-400">รวมทุกเพจ</td>
                      <td className="text-right font-black text-purple-400">{grand.manualOrders.toLocaleString()}</td>
                      <td className="text-right font-bold text-purple-300">฿{grand.manualTotal.toLocaleString()}</td>
                      <td className="text-right font-black text-emerald-400">{grand.aiOrders.toLocaleString()}</td>
                      <td className="text-right font-bold text-emerald-300">฿{grand.aiTotal.toLocaleString()}</td>
                      <td className="text-right font-black">{totalOrders.toLocaleString()}</td>
                      <td className="text-right font-black text-brand-400 text-base">฿{grand.total.toLocaleString()}</td>
                      <td/>
                    </tr>
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* ═══════════════ ORDERS ═══════════════ */}
      {tab==='orders' && (
        <div className="space-y-4">
          {/* Order KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label:'ออเดอร์รวม',     val: totalOrders.toLocaleString(),          color:'text-gray-200',    icon:<Zap size={14}/> },
              { label:'ตอบมือ',         val: grand.manualOrders.toLocaleString(),   color:'text-purple-400',  icon:<HandMetal size={14}/> },
              { label:'ตอบด้วย AI',     val: grand.aiOrders.toLocaleString(),       color:'text-emerald-400', icon:<Bot size={14}/> },
              { label:'ยกเลิก',         val: grand.cancelOrders.toLocaleString(),   color:'text-red-400',     icon:<XCircle size={14}/> },
              { label:'ที่อยู่ไม่ชัดเจน',val: grand.unclearOrders.toLocaleString(), color:'text-orange-400',  icon:<AlertCircle size={14}/> },
            ].map((s,i)=>(
              <div key={i} className="card text-center">
                <div className={`flex items-center justify-center gap-1 text-xs text-gray-500 mb-1 ${s.color}`}>
                  {s.icon}{s.label}
                </div>
                <div className={`text-2xl font-black ${s.color}`}>{s.val}</div>
                <div className="text-xs text-gray-600 mt-1">บ้าน</div>
              </div>
            ))}
          </div>

          {/* สรุปว่าแต่ละคนใช้มือหรือ AI มากกว่า */}
          <div className="card">
            <div className="text-sm font-bold mb-4 flex items-center gap-2">
              <Zap size={15} className="text-amber-400"/> สรุปโหมดหลักของแต่ละแอดมิน
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {adminSummary.filter(a=>a.entries>0).map(a=>(
                <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                  a.dominantMode==='มือ'
                    ?'bg-purple-500/5 border-purple-500/25'
                    :'bg-emerald-500/5 border-emerald-500/25'}`}>
                  <Avatar name={a.avatar||a.name} size="sm"/>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{a.name}</div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden flex mt-1.5">
                      <div className="bg-purple-500 rounded-l-full"
                        style={{width:`${a.manualPct}%`, transition:'width .5s'}}/>
                      <div className="bg-emerald-500 rounded-r-full flex-1"/>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs font-black ${a.dominantMode==='มือ'?'text-purple-400':'text-emerald-400'}`}>
                      {a.dominantMode==='มือ'?'🖐 มือ':'🤖 AI'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {a.manualPct}% / {100-a.manualPct}%
                    </div>
                  </div>
                </div>
              ))}
              {adminSummary.filter(a=>a.entries===0).length>0 && (
                <div className="col-span-2 text-xs text-gray-600 text-center py-2">
                  {adminSummary.filter(a=>a.entries===0).map(a=>a.name).join(', ')} — ไม่มีข้อมูลในเดือนนี้
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, val, sub, color }) {
  return (
    <div className="text-center">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`font-bold text-sm ${color}`}>{val}</div>
      {sub && <div className="text-xs text-gray-600">{sub}</div>}
    </div>
  )
}
