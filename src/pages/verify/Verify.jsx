import React, { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { Avatar, Empty, StatCard } from '../../components/ui'
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle,
  HandMetal, Bot, Search, Filter, Calendar,
  ChevronDown, ChevronUp, Flag, Eye,
} from 'lucide-react'

const today = format(new Date(), 'yyyy-MM-dd')
const thisMonth = format(new Date(), 'yyyy-MM')

// ── ตรวจสอบความผิดปกติ ──────────────────────────────
function detectIssues(record) {
  const issues = []
  const manual = record.manualOrders || 0
  const ai     = record.aiOrders     || 0
  const cancel = record.cancelOrders || 0
  const unclear= record.unclearOrders|| 0
  const mRate  = record.manualRate   || 0
  const aRate  = record.aiRate       || 0
  const mTotal = record.manualTotal  || 0
  const aTotal = record.aiTotal      || 0
  const total  = record.total        || 0

  // คำนวณค่าคอมที่ควรได้
  const expectedManual = manual * mRate
  const expectedAi     = ai     * aRate
  const expectedTotal  = expectedManual + expectedAi

  if (Math.abs(expectedManual - mTotal) > 0.01)
    issues.push({ level: 'error', msg: `ค่าคอมมือไม่ตรง: ควรเป็น ฿${expectedManual} แต่บันทึก ฿${mTotal}` })

  if (Math.abs(expectedAi - aTotal) > 0.01)
    issues.push({ level: 'error', msg: `ค่าคอม AI ไม่ตรง: ควรเป็น ฿${expectedAi} แต่บันทึก ฿${aTotal}` })

  if (Math.abs(expectedTotal - total) > 0.01)
    issues.push({ level: 'error', msg: `ยอดรวมไม่ตรง: ควรเป็น ฿${expectedTotal} แต่บันทึก ฿${total}` })

  if (cancel > (manual + ai) * 0.3 && (manual + ai) > 0)
    issues.push({ level: 'warning', msg: `ออเดอร์ยกเลิกสูงผิดปกติ: ${cancel} จาก ${manual + ai} (${Math.round(cancel/(manual+ai)*100)}%)` })

  if (unclear > (manual + ai) * 0.2 && (manual + ai) > 0)
    issues.push({ level: 'warning', msg: `ออเดอร์ไม่ชัดเจนสูง: ${unclear} จาก ${manual + ai}` })

  if (manual === 0 && ai === 0 && total === 0)
    issues.push({ level: 'info', msg: 'ไม่มีออเดอร์ในรายการนี้' })

  if (mRate === 0 && manual > 0)
    issues.push({ level: 'warning', msg: 'ค่าคอมมือ/บ้าน = 0 แต่มีออเดอร์' })

  if (aRate === 0 && ai > 0)
    issues.push({ level: 'warning', msg: 'ค่าคอม AI/บ้าน = 0 แต่มีออเดอร์' })

  return issues
}

export default function Verify() {
  const { profile } = useAuth()
  const { commissions, users, pages, commRates, getUserName, getPageName } = useData()

  const [filterDate,  setFilterDate]  = useState(today)
  const [filterMonth, setFilterMonth] = useState('')
  const [filterAdmin, setFilterAdmin] = useState('')
  const [filterPage,  setFilterPage]  = useState('')
  const [showIssueOnly, setShowIssueOnly] = useState(false)
  const [expandId,    setExpandId]    = useState(null)
  const [search,      setSearch]      = useState('')

  const admins = users.filter(u => ['admin', 'head_admin'].includes(u.role))

  // ── filtered + annotated ───────────────────────────
  const annotated = useMemo(() => {
    let d = commissions
    if (filterDate && !filterMonth) d = d.filter(c => c.date === filterDate)
    if (filterMonth) d = d.filter(c => c.date?.startsWith(filterMonth))
    if (filterAdmin) d = d.filter(c => c.adminId === filterAdmin)
    if (filterPage)  d = d.filter(c => c.pageId  === filterPage)
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(c =>
        getUserName(c.adminId).toLowerCase().includes(q) ||
        getPageName(c.pageId).toLowerCase().includes(q) ||
        c.date?.includes(q) ||
        c.note?.toLowerCase().includes(q)
      )
    }
    return d
      .map(c => ({ ...c, issues: detectIssues(c) }))
      .sort((a, b) => {
        // sort: error first, then warning, then ok
        const aMax = a.issues.some(i => i.level === 'error') ? 2 : a.issues.some(i => i.level === 'warning') ? 1 : 0
        const bMax = b.issues.some(i => i.level === 'error') ? 2 : b.issues.some(i => i.level === 'warning') ? 1 : 0
        if (bMax !== aMax) return bMax - aMax
        return b.date?.localeCompare(a.date)
      })
  }, [commissions, filterDate, filterMonth, filterAdmin, filterPage, search, getUserName, getPageName])

  const displayed = showIssueOnly ? annotated.filter(c => c.issues.length > 0) : annotated

  // ── stats ──────────────────────────────────────────
  const stats = useMemo(() => {
    const errors   = annotated.filter(c => c.issues.some(i => i.level === 'error'))
    const warnings = annotated.filter(c => c.issues.some(i => i.level === 'warning') && !c.issues.some(i => i.level === 'error'))
    const ok       = annotated.filter(c => c.issues.length === 0)
    return { total: annotated.length, errors: errors.length, warnings: warnings.length, ok: ok.length }
  }, [annotated])

  // ── per-admin verify summary ───────────────────────
  const adminSummary = useMemo(() => admins.map(u => {
    const cs = annotated.filter(c => c.adminId === u.id)
    return {
      ...u,
      count:    cs.length,
      errors:   cs.filter(c => c.issues.some(i => i.level === 'error')).length,
      warnings: cs.filter(c => c.issues.some(i => i.level === 'warning')).length,
      total:    cs.reduce((a, c) => a + (c.total || 0), 0),
      manual:   cs.reduce((a, c) => a + (c.manualOrders || 0), 0),
      ai:       cs.reduce((a, c) => a + (c.aiOrders     || 0), 0),
    }
  }).filter(a => a.count > 0).sort((a, b) => b.errors - a.errors || b.warnings - a.warnings),
  [annotated, admins])

  const statusIcon = (issues) => {
    if (issues.some(i => i.level === 'error'))   return <XCircle size={15} className="text-red-400 flex-shrink-0"/>
    if (issues.some(i => i.level === 'warning')) return <AlertTriangle size={15} className="text-orange-400 flex-shrink-0"/>
    return <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0"/>
  }

  const statusBg = (issues) => {
    if (issues.some(i => i.level === 'error'))   return 'border-red-500/30 bg-red-500/5'
    if (issues.some(i => i.level === 'warning')) return 'border-orange-500/30 bg-orange-500/5'
    return 'border-emerald-500/20'
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black">ตรวจสอบยอดค่าคอม</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            ตรวจความถูกต้องของข้อมูลที่แอดมินกรอก · อัตราปัจจุบัน มือ ฿{commRates.manualRate}/บ้าน · AI ฿{commRates.aiRate}/บ้าน
          </p>
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card text-center">
          <div className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-1">
            <Eye size={11}/> รายการทั้งหมด
          </div>
          <div className="text-2xl font-black">{stats.total}</div>
        </div>
        <div className={`card text-center ${stats.errors > 0 ? 'border-red-500/30 bg-red-500/5' : ''}`}>
          <div className="text-xs text-red-400 flex items-center justify-center gap-1 mb-1">
            <XCircle size={11}/> ข้อมูลผิดพลาด
          </div>
          <div className={`text-2xl font-black ${stats.errors > 0 ? 'text-red-400' : 'text-gray-600'}`}>{stats.errors}</div>
        </div>
        <div className={`card text-center ${stats.warnings > 0 ? 'border-orange-500/30 bg-orange-500/5' : ''}`}>
          <div className="text-xs text-orange-400 flex items-center justify-center gap-1 mb-1">
            <AlertTriangle size={11}/> น่าสงสัย
          </div>
          <div className={`text-2xl font-black ${stats.warnings > 0 ? 'text-orange-400' : 'text-gray-600'}`}>{stats.warnings}</div>
        </div>
        <div className="card text-center border-emerald-500/20">
          <div className="text-xs text-emerald-400 flex items-center justify-center gap-1 mb-1">
            <CheckCircle2 size={11}/> ถูกต้อง
          </div>
          <div className="text-2xl font-black text-emerald-400">{stats.ok}</div>
        </div>
      </div>

      {/* ── Per-admin overview ── */}
      {adminSummary.length > 0 && (
        <div className="card">
          <div className="text-sm font-bold mb-3 flex items-center gap-2">
            <ShieldCheck size={15} className="text-brand-400"/> สถานะตรวจสอบรายคน
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {adminSummary.map(u => (
              <div key={u.id} className={`rounded-xl border p-3 ${
                u.errors   > 0 ? 'bg-red-500/8 border-red-500/25' :
                u.warnings > 0 ? 'bg-orange-500/8 border-orange-500/25' :
                                 'bg-emerald-500/5 border-emerald-500/20'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Avatar name={u.avatar || u.name} size="sm"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{u.name}</div>
                    <div className="text-xs text-gray-500">{u.count} รายการ</div>
                  </div>
                  {u.errors > 0
                    ? <XCircle size={16} className="text-red-400"/>
                    : u.warnings > 0
                      ? <AlertTriangle size={16} className="text-orange-400"/>
                      : <CheckCircle2 size={16} className="text-emerald-400"/>
                  }
                </div>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <div className="text-[10px] text-gray-500">ผิดพลาด</div>
                    <div className={`text-sm font-black ${u.errors > 0 ? 'text-red-400' : 'text-gray-600'}`}>{u.errors}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">น่าสงสัย</div>
                    <div className={`text-sm font-black ${u.warnings > 0 ? 'text-orange-400' : 'text-gray-600'}`}>{u.warnings}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">ค่าคอมรวม</div>
                    <div className="text-sm font-black text-brand-400">฿{u.total.toLocaleString()}</div>
                  </div>
                </div>
                {/* progress bar มือ vs AI */}
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                    <span className="text-purple-400">{u.manual} มือ</span>
                    <span className="text-emerald-400">{u.ai} AI</span>
                  </div>
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden flex">
                    {(u.manual + u.ai) > 0 && (
                      <>
                        <div className="bg-purple-500 rounded-l-full" style={{ width: `${u.manual/(u.manual+u.ai)*100}%` }}/>
                        <div className="bg-emerald-500 flex-1 rounded-r-full"/>
                      </>
                    )}
                  </div>
                </div>
                {/* filter shortcut */}
                <button className="btn btn-ghost btn-sm w-full mt-2 text-xs"
                  onClick={() => setFilterAdmin(filterAdmin === u.id ? '' : u.id)}>
                  {filterAdmin === u.id ? 'ดูทั้งหมด' : `กรองเฉพาะ ${u.name}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="card space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          <input className="input pl-8" placeholder="ค้นหาชื่อแอดมิน เพจ วันที่ หมายเหตุ..."
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="label">วันที่</label>
            <input type="date" className="input" value={filterDate}
              onChange={e => { setFilterDate(e.target.value); setFilterMonth('') }}/>
          </div>
          <div>
            <label className="label">หรือเดือน</label>
            <input type="month" className="input" value={filterMonth}
              onChange={e => { setFilterMonth(e.target.value); setFilterDate('') }}/>
          </div>
          <div>
            <label className="label">แอดมิน</label>
            <select className="input" value={filterAdmin} onChange={e => setFilterAdmin(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {admins.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">เพจ</label>
            <select className="input" value={filterPage} onChange={e => setFilterPage(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <label className="label">กรองเฉพาะ</label>
            <button className={`btn btn-sm ${showIssueOnly ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setShowIssueOnly(v => !v)}>
              <Flag size={13}/>
              {showIssueOnly ? 'แสดงทั้งหมด' : 'มีปัญหาเท่านั้น'}
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn btn-ghost btn-sm"
            onClick={() => { setFilterDate(today); setFilterMonth(''); setFilterAdmin(''); setFilterPage(''); setSearch(''); setShowIssueOnly(false) }}>
            รีเซ็ต
          </button>
        </div>
      </div>

      {/* ── Records list ── */}
      {displayed.length === 0 ? (
        <div className="card">
          <Empty icon={ShieldCheck} title="ไม่มีรายการ" sub="ลองเปลี่ยนตัวกรอง"/>
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayed.map(c => {
            const exp = expandId === c.id
            const hasError   = c.issues.some(i => i.level === 'error')
            const hasWarning = c.issues.some(i => i.level === 'warning')
            const expectedTotal = ((c.manualOrders || 0) * (c.manualRate || 0)) +
                                  ((c.aiOrders     || 0) * (c.aiRate     || 0))

            return (
              <div key={c.id} className={`card p-0 overflow-hidden border transition-all ${statusBg(c.issues)}`}>
                {/* Main row */}
                <div className="flex flex-wrap items-center gap-3 p-4 cursor-pointer hover:bg-white/5"
                  onClick={() => setExpandId(exp ? null : c.id)}>

                  {/* Status icon */}
                  {statusIcon(c.issues)}

                  {/* Admin + date */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={getUserName(c.adminId).slice(0, 2)} size="sm"/>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{getUserName(c.adminId)}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar size={9}/> {c.date} · {getPageName(c.pageId)}
                      </div>
                    </div>
                  </div>

                  {/* Order summary */}
                  <div className="flex items-center gap-4 flex-1 justify-end flex-wrap">
                    <div className="flex items-center gap-3 text-xs hidden sm:flex">
                      <span className="text-purple-400">
                        <HandMetal size={10} className="inline mr-0.5"/>
                        {c.manualOrders || 0} บ้าน · ฿{(c.manualTotal||0).toLocaleString()}
                      </span>
                      <span className="text-emerald-400">
                        <Bot size={10} className="inline mr-0.5"/>
                        {c.aiOrders || 0} บ้าน · ฿{(c.aiTotal||0).toLocaleString()}
                      </span>
                    </div>

                    {/* Total vs expected */}
                    <div className="text-right">
                      <div className={`text-lg font-black ${
                        hasError ? 'text-red-400' :
                        hasWarning ? 'text-orange-400' :
                        'text-brand-400'}`}>
                        ฿{(c.total || 0).toLocaleString()}
                      </div>
                      {Math.abs(expectedTotal - (c.total || 0)) > 0.01 && (
                        <div className="text-xs text-red-400">
                          ควร ฿{expectedTotal.toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* Issue badges */}
                    <div className="flex gap-1">
                      {hasError && (
                        <span className="badge-red text-[10px]">
                          <XCircle size={9}/> {c.issues.filter(i => i.level === 'error').length} ผิดพลาด
                        </span>
                      )}
                      {hasWarning && (
                        <span className="badge-orange text-[10px]">
                          <AlertTriangle size={9}/> {c.issues.filter(i => i.level === 'warning').length} น่าสงสัย
                        </span>
                      )}
                      {!hasError && !hasWarning && (
                        <span className="badge-green text-[10px]">
                          <CheckCircle2 size={9}/> ถูกต้อง
                        </span>
                      )}
                    </div>

                    {exp ? <ChevronUp size={15} className="text-gray-500"/> : <ChevronDown size={15} className="text-gray-500"/>}
                  </div>
                </div>

                {/* Expanded detail */}
                {exp && (
                  <div className="border-t border-gray-800/60 bg-gray-900/60 p-4 space-y-4">

                    {/* Issue list */}
                    {c.issues.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">ผลการตรวจสอบ</div>
                        {c.issues.map((issue, i) => (
                          <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg text-sm ${
                            issue.level === 'error'   ? 'bg-red-500/10 text-red-300' :
                            issue.level === 'warning' ? 'bg-orange-500/10 text-orange-300' :
                                                        'bg-gray-700/50 text-gray-400'
                          }`}>
                            {issue.level === 'error'   ? <XCircle size={14} className="flex-shrink-0 mt-0.5"/> :
                             issue.level === 'warning' ? <AlertTriangle size={14} className="flex-shrink-0 mt-0.5"/> :
                                                         <Flag size={14} className="flex-shrink-0 mt-0.5"/>}
                            {issue.msg}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Detail table */}
                    <div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">รายละเอียดข้อมูล</div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <VerifyBox
                          label="ตอบมือ (บ้าน)"
                          val={`${c.manualOrders || 0} บ้าน`}
                          sub={`× ฿${c.manualRate || 0} = ฿${(c.manualTotal || 0).toLocaleString()}`}
                          expected={`ควร ฿${((c.manualOrders||0)*(c.manualRate||0)).toLocaleString()}`}
                          hasError={Math.abs((c.manualOrders||0)*(c.manualRate||0) - (c.manualTotal||0)) > 0.01}
                          color="purple"/>
                        <VerifyBox
                          label="AI (บ้าน)"
                          val={`${c.aiOrders || 0} บ้าน`}
                          sub={`× ฿${c.aiRate || 0} = ฿${(c.aiTotal || 0).toLocaleString()}`}
                          expected={`ควร ฿${((c.aiOrders||0)*(c.aiRate||0)).toLocaleString()}`}
                          hasError={Math.abs((c.aiOrders||0)*(c.aiRate||0) - (c.aiTotal||0)) > 0.01}
                          color="emerald"/>
                        <VerifyBox
                          label="ออเดอร์มีปัญหา"
                          val={`ยกเลิก ${c.cancelOrders || 0}`}
                          sub={`ไม่ชัดเจน ${c.unclearOrders || 0}`}
                          hasError={false}
                          color="red"/>
                        <VerifyBox
                          label="ค่าคอมรวม"
                          val={`฿${(c.total || 0).toLocaleString()}`}
                          sub={`ควรเป็น ฿${expectedTotal.toLocaleString()}`}
                          hasError={Math.abs(expectedTotal - (c.total || 0)) > 0.01}
                          color="brand"/>
                      </div>
                    </div>

                    {/* Compared with global rates */}
                    <div className="rounded-lg bg-gray-800/50 border border-gray-700/50 p-3 text-xs text-gray-400">
                      <span className="font-semibold text-gray-300">อัตราที่ตั้งไว้:</span>
                      {' '}มือ ฿{commRates.manualRate}/บ้าน · AI ฿{commRates.aiRate}/บ้าน
                      {(c.manualRate !== commRates.manualRate || c.aiRate !== commRates.aiRate) && (
                        <span className="ml-2 text-orange-400">
                          ⚠ รายการนี้ใช้อัตราต่างกัน: มือ ฿{c.manualRate} · AI ฿{c.aiRate}
                        </span>
                      )}
                    </div>

                    {c.note && (
                      <div className="text-xs text-gray-500">
                        📝 หมายเหตุ: {c.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function VerifyBox({ label, val, sub, expected, hasError, color }) {
  const colors = {
    purple: { bg: 'bg-purple-500/8 border-purple-500/20', text: 'text-purple-400' },
    emerald: { bg: 'bg-emerald-500/8 border-emerald-500/20', text: 'text-emerald-400' },
    red:    { bg: 'bg-red-500/8 border-red-500/20', text: 'text-red-400' },
    brand:  { bg: hasError ? 'bg-red-500/10 border-red-500/30' : 'bg-brand-500/8 border-brand-500/20', text: hasError ? 'text-red-400' : 'text-brand-400' },
  }
  const c = colors[color] || colors.brand
  return (
    <div className={`rounded-xl border p-3 ${c.bg}`}>
      <div className={`text-xs font-semibold mb-1.5 ${c.text}`}>{label}</div>
      <div className={`text-base font-black ${c.text}`}>{val}</div>
      <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
      {hasError && expected && (
        <div className="text-xs text-red-400 mt-1 font-semibold">{expected}</div>
      )}
    </div>
  )
}
