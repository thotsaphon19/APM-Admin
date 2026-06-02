import React, { useState, useMemo } from 'react'
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, parseISO, isWithinInterval,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
} from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { Avatar, Empty, StatCard } from '../../components/ui'
import {
  TrendingUp, HandMetal, Bot, XCircle, AlertCircle,
  ChevronDown, ChevronUp, Calendar, CalendarDays,
  BarChart3, Users, Download,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'

const TT = {
  contentStyle: {
    background: '#111827', border: '1px solid #1f2937',
    borderRadius: 10, color: '#f3f4f6', fontSize: 12,
  },
}

const PERIODS = [
  { key: 'day',   label: 'รายวัน',    icon: Calendar },
  { key: 'week',  label: 'รายสัปดาห์', icon: CalendarDays },
  { key: 'month', label: 'รายเดือน',  icon: CalendarDays },
  { key: 'year',  label: 'รายปี',     icon: BarChart3 },
]

function getPeriodRange(period, refDate) {
  const d = refDate ? parseISO(refDate) : new Date()
  switch (period) {
    case 'day':   return { start: d, end: d }
    case 'week':  return { start: startOfWeek(d, { weekStartsOn: 1 }), end: endOfWeek(d, { weekStartsOn: 1 }) }
    case 'month': return { start: startOfMonth(d), end: endOfMonth(d) }
    case 'year':  return { start: startOfYear(d), end: endOfYear(d) }
    default:      return { start: d, end: d }
  }
}

function inRange(dateStr, range) {
  try {
    return isWithinInterval(parseISO(dateStr), range)
  } catch { return false }
}

function fmtDate(d) { return format(d, 'yyyy-MM-dd') }
function fmtLabel(d, period) {
  if (period === 'day')   return format(d, 'd MMM', { locale: th })
  if (period === 'week')  return `สัปดาห์ ${format(d, 'w')} (${format(d, 'd MMM', { locale: th })})`
  if (period === 'month') return format(d, 'MMM yy', { locale: th })
  if (period === 'year')  return format(d, 'yyyy')
  return fmtDate(d)
}

export default function Payroll() {
  const { profile } = useAuth()
  const { commissions, users, pages, getUserName, getPageName } = useData()

  const [period,      setPeriod]      = useState('month')
  const [refDate,     setRefDate]     = useState(format(new Date(), 'yyyy-MM'))
  const [selectedUid, setSelectedUid] = useState(null) // null = overview

  // Only superadmin and assistant
  if (!['superadmin', 'assistant'].includes(profile?.role)) {
    return (
      <div className="card flex items-center gap-3 text-orange-400">
        <AlertCircle size={20} />
        <span>เฉพาะผู้ดูแลสูงสุดและผู้ช่วยเท่านั้นที่เข้าถึงได้</span>
      </div>
    )
  }

  const admins = users.filter(u => ['admin', 'head_admin'].includes(u.role))

  // Parse refDate → actual date string
  const refDateStr = useMemo(() => {
    if (!refDate) return format(new Date(), 'yyyy-MM-dd')
    if (refDate.length === 7) return refDate + '-01'  // yyyy-MM
    if (refDate.length === 4) return refDate + '-01-01' // yyyy
    return refDate
  }, [refDate])

  const range = useMemo(() => getPeriodRange(period, refDateStr), [period, refDateStr])

  // All commissions in range
  const rangeComms = useMemo(() =>
    commissions.filter(c => inRange(c.date, range)),
    [commissions, range]
  )

  // Per-admin summary
  const adminSummary = useMemo(() => admins.map(u => {
    const cs = rangeComms.filter(c => c.adminId === u.id)
    return {
      ...u,
      manual:  cs.reduce((a, c) => a + (c.manualOrders || 0), 0),
      ai:      cs.reduce((a, c) => a + (c.aiOrders     || 0), 0),
      cancel:  cs.reduce((a, c) => a + (c.cancelOrders || 0), 0),
      unclear: cs.reduce((a, c) => a + (c.unclearOrders|| 0), 0),
      manualComm: cs.reduce((a, c) => a + (c.manualTotal || 0), 0),
      aiComm:     cs.reduce((a, c) => a + (c.aiTotal    || 0), 0),
      total:      cs.reduce((a, c) => a + (c.total      || 0), 0),
      entries: cs.length,
      records: cs,
    }
  }).sort((a, b) => b.total - a.total), [admins, rangeComms])

  const grandTotal = adminSummary.reduce((a, s) => a + s.total, 0)
  const grandManual = adminSummary.reduce((a, s) => a + s.manual, 0)
  const grandAI    = adminSummary.reduce((a, s) => a + s.ai, 0)

  // Chart data — breakdown by time bucket
  const chartData = useMemo(() => {
    const allDates = rangeComms.map(c => c.date).filter(Boolean)
    if (!allDates.length) return []

    if (period === 'day' || period === 'week') {
      // group by day
      const map = {}
      rangeComms.forEach(c => {
        if (!map[c.date]) map[c.date] = { date: c.date, label: '', มือ: 0, AI: 0, รวม: 0 }
        map[c.date].มือ  += c.manualTotal || 0
        map[c.date].AI   += c.aiTotal     || 0
        map[c.date].รวม  += c.total       || 0
      })
      return Object.values(map)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => ({ ...d, label: format(parseISO(d.date), 'd/M') }))
    }

    if (period === 'month') {
      // group by day inside month
      const map = {}
      rangeComms.forEach(c => {
        if (!map[c.date]) map[c.date] = { date: c.date, label: '', มือ: 0, AI: 0, รวม: 0 }
        map[c.date].มือ  += c.manualTotal || 0
        map[c.date].AI   += c.aiTotal     || 0
        map[c.date].รวม  += c.total       || 0
      })
      return Object.values(map)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => ({ ...d, label: format(parseISO(d.date), 'd') }))
    }

    if (period === 'year') {
      // group by month
      const map = {}
      rangeComms.forEach(c => {
        const mo = c.date?.slice(0, 7)
        if (!mo) return
        if (!map[mo]) map[mo] = { date: mo, label: '', มือ: 0, AI: 0, รวม: 0 }
        map[mo].มือ  += c.manualTotal || 0
        map[mo].AI   += c.aiTotal     || 0
        map[mo].รวม  += c.total       || 0
      })
      return Object.values(map)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => ({ ...d, label: format(parseISO(d.date + '-01'), 'MMM', { locale: th }) }))
    }
    return []
  }, [rangeComms, period])

  // Selected admin detail
  const selected = selectedUid ? adminSummary.find(a => a.id === selectedUid) : null

  // Export CSV
  const exportCSV = () => {
    const hdr = ['วันที่','แอดมิน','เพจ','ตอบมือ','ค่าคอมมือ','AI','ค่าคอม AI','ยกเลิก','ไม่ชัด','รวม','หมายเหตุ']
    const rows = rangeComms.map(c => [
      c.date, getUserName(c.adminId), getPageName(c.pageId),
      c.manualOrders||0, c.manualTotal||0,
      c.aiOrders||0, c.aiTotal||0,
      c.cancelOrders||0, c.unclearOrders||0,
      c.total||0, c.note||'',
    ])
    const csv = [hdr, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `payroll_${period}_${refDate}.csv`
    a.click()
  }

  const periodLabel = period === 'month' ? 'เดือน' : period === 'year' ? 'ปี' : period === 'week' ? 'สัปดาห์' : 'วัน'

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black">สรุปค่าคอมแอดมิน</h2>
          <p className="text-xs text-gray-500 mt-0.5">รายละเอียดค่าคอมแยกรายบุคคล</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* ── Period selector + date picker ── */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="tabs" style={{ marginBottom: 0 }}>
            {PERIODS.map(p => (
              <button key={p.key}
                className={`tab ${period === p.key ? 'active' : ''}`}
                onClick={() => {
                  setPeriod(p.key)
                  setRefDate(
                    p.key === 'year'  ? format(new Date(), 'yyyy') :
                    p.key === 'month' ? format(new Date(), 'yyyy-MM') :
                    format(new Date(), 'yyyy-MM-dd')
                  )
                }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Date picker */}
          {period === 'day' && (
            <input type="date" className="input" style={{ width: 'auto' }}
              value={refDate} onChange={e => setRefDate(e.target.value)} />
          )}
          {period === 'week' && (
            <input type="date" className="input" style={{ width: 'auto' }}
              value={refDate} onChange={e => setRefDate(e.target.value)} />
          )}
          {period === 'month' && (
            <input type="month" className="input" style={{ width: 'auto' }}
              value={refDate} onChange={e => setRefDate(e.target.value)} />
          )}
          {period === 'year' && (
            <input type="number" className="input" style={{ width: 120 }}
              min="2020" max="2099"
              value={refDate} onChange={e => setRefDate(e.target.value)} />
          )}

          <div className="text-xs text-gray-500 ml-auto">
            {format(range.start, 'd MMM yyyy', { locale: th })}
            {fmtDate(range.start) !== fmtDate(range.end) && ` – ${format(range.end, 'd MMM yyyy', { locale: th })}`}
          </div>
        </div>
      </div>

      {/* ── Grand summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card border-brand-500/30 bg-brand-500/5 text-center">
          <div className="text-xs text-gray-500 mb-1">ค่าคอมรวมทั้งหมด</div>
          <div className="text-3xl font-black text-brand-400">฿{grandTotal.toLocaleString()}</div>
          <div className="text-xs text-gray-600 mt-1">{rangeComms.length} รายการ</div>
        </div>
        <div className="card border-purple-500/30 bg-purple-500/5 text-center">
          <div className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1"><HandMetal size={10}/> ออเดอร์ตอบมือ</div>
          <div className="text-3xl font-black text-purple-400">{grandManual.toLocaleString()}</div>
          <div className="text-xs text-gray-600 mt-1">บ้าน</div>
        </div>
        <div className="card border-emerald-500/30 bg-emerald-500/5 text-center">
          <div className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1"><Bot size={10}/> ออเดอร์ AI</div>
          <div className="text-3xl font-black text-emerald-400">{grandAI.toLocaleString()}</div>
          <div className="text-xs text-gray-600 mt-1">บ้าน</div>
        </div>
        <div className="card border-gray-600/30 text-center">
          <div className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1"><Users size={10}/> แอดมินที่มีข้อมูล</div>
          <div className="text-3xl font-black">{adminSummary.filter(a => a.entries > 0).length}</div>
          <div className="text-xs text-gray-600 mt-1">จาก {admins.length} คน</div>
        </div>
      </div>

      {/* ── Chart ── */}
      {chartData.length > 0 && (
        <div className="card">
          <div className="text-sm font-bold mb-4 flex items-center gap-2">
            <BarChart3 size={15} className="text-brand-400" />
            กราฟค่าคอม{periodLabel === 'วัน' ? 'ตามวัน' : periodLabel === 'สัปดาห์' ? 'ตามวัน (สัปดาห์นี้)' : periodLabel === 'เดือน' ? 'รายวันในเดือนนี้' : 'รายเดือนในปีนี้'}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => `฿${(v/1000).toFixed(0)}k`} />
              <Tooltip {...TT}
                formatter={(v, n) => [`฿${v.toLocaleString()}`, n === 'มือ' ? 'ตอบมือ' : n === 'AI' ? 'AI' : 'รวม']} />
              <Bar dataKey="มือ" fill="#7c3aed" radius={[3,3,0,0]} />
              <Bar dataKey="AI"  fill="#10b981" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Admin list ── */}
      <div className="space-y-3">
        {adminSummary.length === 0
          ? <div className="card"><Empty icon={Users} title="ไม่มีแอดมินในระบบ" /></div>
          : adminSummary.map((a, idx) => (
            <AdminCard key={a.id} admin={a} rank={idx + 1}
              grandTotal={grandTotal}
              expanded={selectedUid === a.id}
              onToggle={() => setSelectedUid(selectedUid === a.id ? null : a.id)}
              getPageName={getPageName}
              period={period}
            />
          ))
        }
      </div>
    </div>
  )
}

// ── Admin Summary Card ────────────────────────────────
function AdminCard({ admin: a, rank, grandTotal, expanded, onToggle, getPageName, period }) {
  const pct = grandTotal > 0 ? (a.total / grandTotal * 100).toFixed(1) : 0
  const totalOrders = a.manual + a.ai
  const manualPct = totalOrders > 0 ? Math.round(a.manual / totalOrders * 100) : 0

  return (
    <div className="card p-0 overflow-hidden">
      {/* Summary row */}
      <div
        className="flex flex-wrap items-center gap-4 p-4 cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={onToggle}>

        {/* Rank + avatar */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-xl font-black text-gray-700 w-6 text-center flex-shrink-0">
            {rank <= 3
              ? ['🥇','🥈','🥉'][rank-1]
              : <span className="text-sm text-gray-600">#{rank}</span>
            }
          </div>
          <Avatar name={a.avatar || a.name} size="md" />
          <div className="min-w-0">
            <div className="font-bold truncate">{a.name}</div>
            <div className="text-xs text-gray-500">{ROLES[a.role]} · {a.entries} รายการ</div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 flex-1 justify-end items-center">
          {/* Mue */}
          <div className="text-center hidden sm:block">
            <div className="text-xs text-gray-500 flex items-center gap-1 justify-center mb-0.5">
              <HandMetal size={10} /> มือ
            </div>
            <div className="font-bold text-purple-400">{a.manual.toLocaleString()}</div>
            <div className="text-xs text-gray-600">฿{a.manualComm.toLocaleString()}</div>
          </div>
          {/* AI */}
          <div className="text-center hidden sm:block">
            <div className="text-xs text-gray-500 flex items-center gap-1 justify-center mb-0.5">
              <Bot size={10} /> AI
            </div>
            <div className="font-bold text-emerald-400">{a.ai.toLocaleString()}</div>
            <div className="text-xs text-gray-600">฿{a.aiComm.toLocaleString()}</div>
          </div>
          {/* Cancel */}
          <div className="text-center hidden lg:block">
            <div className="text-xs text-gray-500 flex items-center gap-1 justify-center mb-0.5">
              <XCircle size={10} /> ยกเลิก
            </div>
            <div className="font-bold text-red-400">{a.cancel}</div>
            <div className="text-xs text-gray-600">{a.unclear} ไม่ชัด</div>
          </div>
          {/* % of total */}
          <div className="text-center hidden lg:block" style={{ minWidth: 80 }}>
            <div className="text-xs text-gray-500 mb-1">% รวม</div>
            <div className="text-sm font-bold text-gray-300">{pct}%</div>
            <div className="progress-bar mt-1">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {/* Total */}
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-0.5">ค่าคอมรวม</div>
            <div className={`text-xl font-black ${a.total > 0 ? 'text-brand-400' : 'text-gray-600'}`}>
              ฿{a.total.toLocaleString()}
            </div>
          </div>
          {/* Expand */}
          <div className="text-gray-500">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <AdminDetail admin={a} getPageName={getPageName} period={period} />
      )}
    </div>
  )
}

// ── Admin Detail (expanded) ───────────────────────────
function AdminDetail({ admin: a, getPageName, period }) {
  const [detailTab, setDetailTab] = useState('records') // records | byday | bypage

  // Group by day
  const byDay = useMemo(() => {
    const map = {}
    a.records.forEach(c => {
      if (!map[c.date]) map[c.date] = { date: c.date, manual: 0, ai: 0, cancel: 0, unclear: 0, manualComm: 0, aiComm: 0, total: 0, count: 0 }
      map[c.date].manual    += c.manualOrders  || 0
      map[c.date].ai        += c.aiOrders      || 0
      map[c.date].cancel    += c.cancelOrders  || 0
      map[c.date].unclear   += c.unclearOrders || 0
      map[c.date].manualComm += c.manualTotal  || 0
      map[c.date].aiComm    += c.aiTotal       || 0
      map[c.date].total     += c.total         || 0
      map[c.date].count++
    })
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
  }, [a.records])

  // Group by page
  const byPage = useMemo(() => {
    const map = {}
    a.records.forEach(c => {
      if (!map[c.pageId]) map[c.pageId] = { pageId: c.pageId, manual: 0, ai: 0, manualComm: 0, aiComm: 0, total: 0, count: 0 }
      map[c.pageId].manual    += c.manualOrders  || 0
      map[c.pageId].ai        += c.aiOrders      || 0
      map[c.pageId].manualComm += c.manualTotal  || 0
      map[c.pageId].aiComm    += c.aiTotal       || 0
      map[c.pageId].total     += c.total         || 0
      map[c.pageId].count++
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [a.records])

  const totalOrders = a.manual + a.ai
  const manualPct = totalOrders > 0 ? Math.round(a.manual / totalOrders * 100) : 0

  return (
    <div className="border-t border-gray-800 bg-gray-900/60">
      {/* Mini stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-0 border-b border-gray-800">
        {[
          { label: 'ตอบมือ (บ้าน)', value: a.manual.toLocaleString(), sub: `฿${a.manualComm.toLocaleString()}`, color: 'text-purple-400' },
          { label: 'AI (บ้าน)',     value: a.ai.toLocaleString(),     sub: `฿${a.aiComm.toLocaleString()}`,     color: 'text-emerald-400' },
          { label: 'ยกเลิก',        value: a.cancel,                  sub: `${a.unclear} ไม่ชัดเจน`,           color: 'text-red-400' },
          { label: 'สัดส่วนมือ/AI',  value: `${manualPct}% / ${100-manualPct}%`, sub: `${totalOrders} บ้าน`, color: 'text-gray-200' },
          { label: 'ค่าคอมรวม',     value: `฿${a.total.toLocaleString()}`, sub: `${a.entries} รายการ`, color: 'text-brand-400', big: true },
        ].map((s, i) => (
          <div key={i} className="p-3 border-r border-gray-800 last:border-r-0">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`font-black ${s.big ? 'text-lg' : 'text-base'} ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tab */}
      <div className="px-4 pt-3">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab ${detailTab === 'records' ? 'active' : ''}`} onClick={() => setDetailTab('records')}>
            รายการทั้งหมด
          </button>
          <button className={`tab ${detailTab === 'byday' ? 'active' : ''}`} onClick={() => setDetailTab('byday')}>
            แยกตามวัน
          </button>
          <button className={`tab ${detailTab === 'bypage' ? 'active' : ''}`} onClick={() => setDetailTab('bypage')}>
            แยกตามเพจ
          </button>
        </div>
      </div>

      {/* Detail content */}
      <div className="p-4 pt-3">

        {/* ── All records ── */}
        {detailTab === 'records' && (
          a.records.length === 0
            ? <Empty icon={BarChart3} title="ไม่มีข้อมูลในช่วงเวลานี้" />
            : <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>เพจ</th>
                      <th className="text-right text-purple-400">มือ (บ้าน)</th>
                      <th className="text-right text-purple-400">฿มือ</th>
                      <th className="text-right text-emerald-400">AI (บ้าน)</th>
                      <th className="text-right text-emerald-400">฿AI</th>
                      <th className="text-right text-red-400">ยกเลิก</th>
                      <th className="text-right text-orange-400">ไม่ชัด</th>
                      <th className="text-right text-brand-400">รวม</th>
                      <th>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...a.records].sort((x,y) => y.date?.localeCompare(x.date)).map(c => (
                      <tr key={c.id}>
                        <td className="text-xs text-gray-400 whitespace-nowrap">{c.date}</td>
                        <td className="text-xs max-w-[140px] truncate">{getPageName(c.pageId)}</td>
                        <td className="text-right font-semibold text-purple-400">{c.manualOrders || 0}</td>
                        <td className="text-right text-xs text-purple-300">฿{(c.manualTotal||0).toLocaleString()}</td>
                        <td className="text-right font-semibold text-emerald-400">{c.aiOrders || 0}</td>
                        <td className="text-right text-xs text-emerald-300">฿{(c.aiTotal||0).toLocaleString()}</td>
                        <td className="text-right text-red-400">{c.cancelOrders || 0}</td>
                        <td className="text-right text-orange-400">{c.unclearOrders || 0}</td>
                        <td className="text-right font-black text-brand-400">฿{(c.total||0).toLocaleString()}</td>
                        <td className="text-xs text-gray-500 max-w-[120px] truncate">{c.note || '—'}</td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-gray-800/50">
                      <td colSpan={2} className="text-xs font-bold text-gray-400">รวม</td>
                      <td className="text-right font-black text-purple-400">{a.manual.toLocaleString()}</td>
                      <td className="text-right font-bold text-purple-300">฿{a.manualComm.toLocaleString()}</td>
                      <td className="text-right font-black text-emerald-400">{a.ai.toLocaleString()}</td>
                      <td className="text-right font-bold text-emerald-300">฿{a.aiComm.toLocaleString()}</td>
                      <td className="text-right font-bold text-red-400">{a.cancel}</td>
                      <td className="text-right font-bold text-orange-400">{a.unclear}</td>
                      <td className="text-right font-black text-brand-400 text-base">฿{a.total.toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
        )}

        {/* ── By day ── */}
        {detailTab === 'byday' && (
          byDay.length === 0
            ? <Empty icon={Calendar} title="ไม่มีข้อมูล" />
            : <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th className="text-right text-purple-400">มือ (บ้าน)</th>
                      <th className="text-right text-purple-400">฿มือ</th>
                      <th className="text-right text-emerald-400">AI (บ้าน)</th>
                      <th className="text-right text-emerald-400">฿AI</th>
                      <th className="text-right text-red-400">ยกเลิก</th>
                      <th className="text-right text-brand-400">รวม/วัน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDay.map(d => (
                      <tr key={d.date}>
                        <td className="text-xs font-semibold whitespace-nowrap">
                          {format(parseISO(d.date), 'EEE d MMM yyyy', { locale: th })}
                        </td>
                        <td className="text-right text-purple-400">{d.manual.toLocaleString()}</td>
                        <td className="text-right text-xs text-purple-300">฿{d.manualComm.toLocaleString()}</td>
                        <td className="text-right text-emerald-400">{d.ai.toLocaleString()}</td>
                        <td className="text-right text-xs text-emerald-300">฿{d.aiComm.toLocaleString()}</td>
                        <td className="text-right text-red-400">{d.cancel}</td>
                        <td className="text-right font-black text-brand-400">฿{d.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        )}

        {/* ── By page ── */}
        {detailTab === 'bypage' && (
          byPage.length === 0
            ? <Empty icon={BarChart3} title="ไม่มีข้อมูล" />
            : <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>เพจ</th>
                      <th className="text-right text-purple-400">มือ (บ้าน)</th>
                      <th className="text-right text-purple-400">฿มือ</th>
                      <th className="text-right text-emerald-400">AI (บ้าน)</th>
                      <th className="text-right text-emerald-400">฿AI</th>
                      <th className="text-right text-brand-400">รวม</th>
                      <th>สัดส่วน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byPage.map((p, i) => {
                      const pct = a.total > 0 ? (p.total / a.total * 100).toFixed(0) : 0
                      return (
                        <tr key={p.pageId}>
                          <td className="text-gray-600 text-xs">{i+1}</td>
                          <td className="font-semibold text-sm">{getPageName(p.pageId)}</td>
                          <td className="text-right text-purple-400">{p.manual.toLocaleString()}</td>
                          <td className="text-right text-xs text-purple-300">฿{p.manualComm.toLocaleString()}</td>
                          <td className="text-right text-emerald-400">{p.ai.toLocaleString()}</td>
                          <td className="text-right text-xs text-emerald-300">฿{p.aiComm.toLocaleString()}</td>
                          <td className="text-right font-black text-brand-400">฿{p.total.toLocaleString()}</td>
                          <td style={{ minWidth: 100 }}>
                            <div className="text-xs text-gray-500 mb-1">{pct}%</div>
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${pct}%` }} />
                            </div>
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
  )
}
