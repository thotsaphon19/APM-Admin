import React, { useState, useMemo } from 'react'
import { format, parseISO, differenceInDays, isToday, isFuture, isPast } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
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
      <div className="card flex items-center gap-3 text-orange-400">
        <AlertCircle size={20}/>
        <span>เฉพาะหัวหน้าแอดมินและผู้ดูแลสูงสุดเท่านั้น</span>
      </div>
    )
  }

  const admins = users.filter(u => ['admin', 'head_admin'].includes(u.role))

  // ── Leave data ─────────────────────────────────────
  const activeLeaves  = leaves.filter(l => !l.deleted && l.status === 'approved'
    && l.startDate <= today && l.endDate >= today)
  const pendingLeaves = leaves.filter(l => !l.deleted && l.status === 'pending')
  const monthLeaves   = leaves.filter(l => !l.deleted && l.startDate?.startsWith(filterMonth))

  // who is on leave today
  const onLeaveToday = new Set(activeLeaves.map(l => l.employeeId))

  // ── Commission data ────────────────────────────────
  const dayComms   = commissions.filter(c => c.date === filterDate)
  const monthComms = commissions.filter(c => c.date?.startsWith(filterMonth))

  // per-admin commission summary
  const adminCommMap = useMemo(() => {
    const map = {}
    admins.forEach(u => {
      const cs = dayComms.filter(c => c.adminId === u.id)
      map[u.id] = {
        manual:     cs.reduce((a, c) => a + (c.manualOrders || 0), 0),
        ai:         cs.reduce((a, c) => a + (c.aiOrders     || 0), 0),
        manualComm: cs.reduce((a, c) => a + (c.manualTotal  || 0), 0),
        aiComm:     cs.reduce((a, c) => a + (c.aiTotal      || 0), 0),
        total:      cs.reduce((a, c) => a + (c.total        || 0), 0),
        cancel:     cs.reduce((a, c) => a + (c.cancelOrders || 0), 0),
        unclear:    cs.reduce((a, c) => a + (c.unclearOrders|| 0), 0),
        entries:    cs.length,
        records:    cs,
      }
    })
    return map
  }, [dayComms, admins])

  // per-admin leave stats
  const adminLeaveMap = useMemo(() => {
    const map = {}
    admins.forEach(u => {
      const ul = leaves.filter(l => !l.deleted && l.employeeId === u.id)
      map[u.id] = {
        total:     ul.length,
        approved:  ul.filter(l => l.status === 'approved').length,
        pending:   ul.filter(l => l.status === 'pending').length,
        rejected:  ul.filter(l => l.status === 'rejected').length,
        totalDays: ul.filter(l => l.status === 'approved')
          .reduce((a, l) => a + countDays(l.startDate, l.endDate), 0),
        isOnLeaveToday: onLeaveToday.has(u.id),
        records: ul.sort((a, b) => b.startDate?.localeCompare(a.startDate)),
      }
    })
    return map
  }, [leaves, admins, onLeaveToday])

  // per-admin page
  const adminPageMap = useMemo(() => {
    const map = {}
    admins.forEach(u => {
      map[u.id] = {
        all:  pages.filter(p => p.assignedTo?.includes(u.id)),
        main: pages.filter(p => p.assignedTo?.includes(u.id) && p.type === 'main'),
        test: pages.filter(p => p.assignedTo?.includes(u.id) && p.type === 'test'),
      }
    })
    return map
  }, [pages, admins])

  const handleApprove = async (id) => {
    setSaving(true)
    try { await approveLeave(id, profile?.id); setMsg('อนุมัติแล้ว ✅') }
    catch(e) { } finally { setSaving(false); setTimeout(() => setMsg(''), 2500) }
  }
  const handleReject = async (id) => {
    setSaving(true)
    try { await rejectLeave(id, profile?.id); setMsg('ปฏิเสธแล้ว') }
    catch(e) { } finally { setSaving(false); setTimeout(() => setMsg(''), 2500) }
  }

  // grand totals
  const grandDay = Object.values(adminCommMap)
    .reduce((a, v) => ({ total: a.total + v.total, manual: a.manual + v.manual, ai: a.ai + v.ai }), { total: 0, manual: 0, ai: 0 })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-black">ศูนย์บัญชาการทีม</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {todayLabel} · {admins.length} คนในทีม · ลาวันนี้ {onLeaveToday.size} คน · รออนุมัติลา {pendingLeaves.length} รายการ
        </p>
      </div>

      {msg && <Alert type="success">{msg}</Alert>}

      {/* Alert: pending leaves */}
      {pendingLeaves.length > 0 && (
        <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-3 flex items-center gap-3 cursor-pointer"
          onClick={() => setTab('leave')}>
          <AlertCircle size={16} className="text-orange-400 flex-shrink-0"/>
          <span className="text-sm text-gray-300">
            <strong className="text-orange-400">{pendingLeaves.length} รายการ</strong> รออนุมัติวันลา — กดเพื่อดู
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs flex-wrap">
        {TABS.map(t => (
          <button key={t.key} className={`tab flex items-center gap-1.5 ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}>
            <t.icon size={13}/> {t.label}
            {t.key === 'leave' && pendingLeaves.length > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {pendingLeaves.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════ OVERVIEW ══════════════ */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Team member cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {admins.map(u => {
              const lv = adminLeaveMap[u.id]
              const cm = adminCommMap[u.id]
              const pg = adminPageMap[u.id]
              return (
                <div key={u.id} className={`card hover:border-gray-700 transition-all ${lv.isOnLeaveToday ? 'border-orange-500/40 bg-orange-500/5' : ''}`}>
                  {/* Top */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar name={u.avatar || u.name} size="lg"/>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${lv.isOnLeaveToday ? 'bg-orange-500' : 'bg-emerald-500'}`}/>
                      </div>
                      <div>
                        <div className="font-bold">{u.name}</div>
                        <span className={`text-xs ${
                          u.role === 'head_admin' ? 'text-orange-400' : 'text-brand-400'
                        }`}>{ROLES[u.role]}</span>
                        {lv.isOnLeaveToday && (
                          <div className="text-xs text-orange-400 font-semibold mt-0.5">🟠 ลาวันนี้</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <MiniBox label="เพจ" val={pg.all.length} color="text-brand-400" icon={<BookOpen size={10}/>}/>
                    <MiniBox label="ค่าคอมวันนี้" val={`฿${cm.total.toLocaleString()}`} color="text-emerald-400" icon={<TrendingUp size={10}/>}/>
                    <MiniBox label="รอลา" val={lv.pending} color={lv.pending > 0 ? 'text-orange-400' : 'text-gray-500'} icon={<Clock size={10}/>}/>
                  </div>

                  {/* Pages preview */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {pg.all.slice(0, 3).map(p => (
                      <span key={p.id} className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        p.type === 'main'
                          ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}>{p.name.length > 10 ? p.name.slice(0, 10) + '…' : p.name}</span>
                    ))}
                    {pg.all.length > 3 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">+{pg.all.length - 3}</span>
                    )}
                    {pg.all.length === 0 && (
                      <span className="text-[10px] text-red-400">ยังไม่มีเพจ</span>
                    )}
                  </div>

                  {/* Quick links */}
                  <div className="flex gap-2 border-t border-gray-800 pt-3">
                    <button className="btn btn-ghost btn-sm flex-1 text-xs"
                      onClick={() => { setTab('commission'); setExpandUid(u.id) }}>
                      <TrendingUp size={11}/> ค่าคอม
                    </button>
                    <button className="btn btn-ghost btn-sm flex-1 text-xs"
                      onClick={() => { setTab('leaveHistory'); setExpandUid(u.id) }}>
                      <History size={11}/> ประวัติลา
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Today commission summary */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold flex items-center gap-2">
                <TrendingUp size={15} className="text-brand-400"/> ยอดค่าคอมวันนี้ (รวมทีม)
              </div>
              <input type="date" className="input" style={{ width: 'auto' }}
                value={filterDate} onChange={e => setFilterDate(e.target.value)}/>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">รวมทั้งหมด</div>
                <div className="text-2xl font-black text-brand-400">฿{grandDay.total.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1"><HandMetal size={10}/> ตอบมือ</div>
                <div className="text-xl font-black text-purple-400">{grandDay.manual.toLocaleString()}</div>
                <div className="text-xs text-gray-600">บ้าน</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1"><Bot size={10}/> AI</div>
                <div className="text-xl font-black text-emerald-400">{grandDay.ai.toLocaleString()}</div>
                <div className="text-xs text-gray-600">บ้าน</div>
              </div>
            </div>
            {/* per-admin mini table */}
            <div className="space-y-2">
              {admins.map(u => {
                const cm = adminCommMap[u.id]
                const hasData = cm.entries > 0
                return (
                  <div key={u.id} className={`flex items-center gap-3 p-2.5 rounded-lg ${hasData ? 'bg-gray-800/60' : 'bg-gray-800/20 opacity-50'}`}>
                    <Avatar name={u.avatar || u.name} size="sm"/>
                    <span className="text-sm font-semibold flex-1 truncate">{u.name}</span>
                    {hasData ? (
                      <>
                        <span className="text-xs text-purple-400">{cm.manual} มือ</span>
                        <span className="text-xs text-emerald-400">{cm.ai} AI</span>
                        <span className="font-black text-brand-400">฿{cm.total.toLocaleString()}</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-600">ยังไม่ลงข้อมูล</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ LEAVE ══════════════ */}
      {tab === 'leave' && (
        <div className="space-y-4">
          {/* filter month */}
          <div className="card flex items-center gap-3">
            <label className="label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>เดือน</label>
            <input type="month" className="input" style={{ width: 'auto' }}
              value={filterMonth} onChange={e => setFilterMonth(e.target.value)}/>
            <div className="text-xs text-gray-500 ml-auto">
              {monthLeaves.length} รายการ · อนุมัติ {monthLeaves.filter(l => l.status === 'approved').length} · รอ {monthLeaves.filter(l => l.status === 'pending').length}
            </div>
          </div>

          {/* Pending approval */}
          {pendingLeaves.length > 0 && (
            <div className="card border-orange-500/30">
              <div className="text-sm font-bold text-orange-400 mb-3 flex items-center gap-2">
                <Clock size={15}/> รออนุมัติ ({pendingLeaves.length} รายการ)
              </div>
              <div className="space-y-2">
                {pendingLeaves.map(l => (
                  <LeaveRow key={l.id} leave={l} getName={getUserName}
                    onApprove={() => handleApprove(l.id)}
                    onReject={() => handleReject(l.id)}
                    saving={saving} showActions/>
                ))}
              </div>
            </div>
          )}

          {/* Approved this month */}
          <div className="card">
            <div className="text-sm font-bold mb-3 flex items-center gap-2">
              <CheckCircle size={15} className="text-emerald-400"/> ลาที่อนุมัติ — {filterMonth}
            </div>
            {monthLeaves.filter(l => l.status === 'approved').length === 0
              ? <Empty icon={CalendarDays} title="ไม่มีรายการลาในเดือนนี้"/>
              : <div className="space-y-2">
                  {monthLeaves.filter(l => l.status === 'approved').map(l => (
                    <LeaveRow key={l.id} leave={l} getName={getUserName}/>
                  ))}
                </div>
            }
          </div>

          {/* On leave today */}
          {activeLeaves.length > 0 && (
            <div className="card border-orange-500/30 bg-orange-500/5">
              <div className="text-sm font-bold text-orange-400 mb-3 flex items-center gap-2">
                <Calendar size={15}/> ลาวันนี้ ({activeLeaves.length} คน)
              </div>
              <div className="flex flex-wrap gap-2">
                {activeLeaves.map(l => {
                  const u = users.find(u => u.id === l.employeeId)
                  return (
                    <div key={l.id} className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2">
                      <Avatar name={u?.avatar || u?.name || '?'} size="sm"/>
                      <div>
                        <div className="text-sm font-semibold">{u?.name || '?'}</div>
                        <div className="text-xs text-gray-500">ถึง {format(parseISO(l.endDate), 'd MMM', { locale: th })}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ COMMISSION ══════════════ */}
      {tab === 'commission' && (
        <div className="space-y-4">
          <div className="card flex items-center gap-3 flex-wrap">
            <div>
              <label className="label" style={{ marginBottom: 0 }}>วันที่</label>
              <input type="date" className="input mt-1" style={{ width: 'auto' }}
                value={filterDate} onChange={e => setFilterDate(e.target.value)}/>
            </div>
            <div>
              <label className="label" style={{ marginBottom: 0 }}>หรือเดือน</label>
              <input type="month" className="input mt-1" style={{ width: 'auto' }}
                value={filterMonth} onChange={e => setFilterMonth(e.target.value)}/>
            </div>
          </div>

          <div className="space-y-3">
            {admins.map(u => {
              const cm = adminCommMap[u.id]
              const exp = expandUid === u.id
              return (
                <div key={u.id} className="card p-0 overflow-hidden">
                  {/* Summary row */}
                  <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-800/20"
                    onClick={() => setExpandUid(exp ? null : u.id)}>
                    <Avatar name={u.avatar || u.name} size="md"/>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold">{u.name}</div>
                      <div className="text-xs text-gray-500">{ROLES[u.role]}</div>
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="text-center hidden sm:block">
                        <div className="text-xs text-gray-500 mb-0.5 flex items-center gap-1 justify-center"><HandMetal size={9}/> มือ</div>
                        <div className="font-bold text-purple-400">{cm.manual}</div>
                      </div>
                      <div className="text-center hidden sm:block">
                        <div className="text-xs text-gray-500 mb-0.5 flex items-center gap-1 justify-center"><Bot size={9}/> AI</div>
                        <div className="font-bold text-emerald-400">{cm.ai}</div>
                      </div>
                      <div className="text-center hidden md:block">
                        <div className="text-xs text-gray-500 mb-0.5">ยกเลิก</div>
                        <div className="font-bold text-red-400">{cm.cancel}</div>
                      </div>
                      <div className="text-right">
                        {cm.entries > 0
                          ? <div className="text-xl font-black text-brand-400">฿{cm.total.toLocaleString()}</div>
                          : <div className="text-sm text-gray-600">ยังไม่ลงข้อมูล</div>
                        }
                      </div>
                      {exp ? <ChevronUp size={16} className="text-gray-500"/> : <ChevronDown size={16} className="text-gray-500"/>}
                    </div>
                  </div>

                  {/* Expanded records */}
                  {exp && (
                    <div className="border-t border-gray-800 bg-gray-900/50">
                      {cm.records.length === 0
                        ? <div className="py-8"><Empty icon={TrendingUp} title="ยังไม่มีข้อมูลวันที่เลือก"/></div>
                        : <div className="table-wrap">
                            <table>
                              <thead><tr>
                                <th>วันที่</th><th>เพจ</th>
                                <th className="text-right text-purple-400">มือ (บ้าน)</th>
                                <th className="text-right text-purple-400">฿มือ</th>
                                <th className="text-right text-emerald-400">AI (บ้าน)</th>
                                <th className="text-right text-emerald-400">฿AI</th>
                                <th className="text-right text-red-400">ยกเลิก</th>
                                <th className="text-right text-orange-400">ไม่ชัด</th>
                                <th className="text-right text-brand-400">รวม</th>
                                <th>หมายเหตุ</th>
                              </tr></thead>
                              <tbody>
                                {cm.records.map(c => (
                                  <tr key={c.id}>
                                    <td className="text-xs text-gray-400">{c.date}</td>
                                    <td className="text-xs max-w-[120px] truncate">{getPageName(c.pageId)}</td>
                                    <td className="text-right text-purple-400">{c.manualOrders || 0}</td>
                                    <td className="text-right text-xs text-purple-300">฿{(c.manualTotal || 0).toLocaleString()}</td>
                                    <td className="text-right text-emerald-400">{c.aiOrders || 0}</td>
                                    <td className="text-right text-xs text-emerald-300">฿{(c.aiTotal || 0).toLocaleString()}</td>
                                    <td className="text-right text-red-400">{c.cancelOrders || 0}</td>
                                    <td className="text-right text-orange-400">{c.unclearOrders || 0}</td>
                                    <td className="text-right font-black text-brand-400">฿{(c.total || 0).toLocaleString()}</td>
                                    <td className="text-xs text-gray-500 max-w-[100px] truncate">{c.note || '—'}</td>
                                  </tr>
                                ))}
                                <tr className="bg-gray-800/50">
                                  <td colSpan={2} className="text-xs font-bold text-gray-400">รวม</td>
                                  <td className="text-right font-black text-purple-400">{cm.manual}</td>
                                  <td className="text-right font-bold text-purple-300">฿{cm.manualComm.toLocaleString()}</td>
                                  <td className="text-right font-black text-emerald-400">{cm.ai}</td>
                                  <td className="text-right font-bold text-emerald-300">฿{cm.aiComm.toLocaleString()}</td>
                                  <td className="text-right font-bold text-red-400">{cm.cancel}</td>
                                  <td className="text-right font-bold text-orange-400">{cm.unclear}</td>
                                  <td className="text-right font-black text-brand-400 text-base">฿{cm.total.toLocaleString()}</td>
                                  <td/>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                      }
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════ PAGES STATUS ══════════════ */}
      {tab === 'pages' && (
        <div className="space-y-4">
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatBox val={pages.length} label="เพจทั้งหมด" color="text-gray-200" icon={<BookOpen size={14}/>}/>
            <StatBox val={pages.filter(p => p.type === 'main').length} label="เพจหลัก" color="text-brand-400" icon={<Star size={14}/>}/>
            <StatBox val={pages.filter(p => p.type === 'test').length} label="เพจทดสอบ" color="text-amber-400" icon={<TestTube size={14}/>}/>
            <StatBox val={pages.filter(p => !p.assignedTo?.length).length} label="ยังไม่มอบหมาย" color="text-red-400" icon={<AlertCircle size={14}/>}/>
          </div>

          {/* Per-admin page status */}
          <div className="space-y-3">
            {admins.map(u => {
              const pg = adminPageMap[u.id]
              const lv = adminLeaveMap[u.id]
              return (
                <div key={u.id} className={`card ${lv.isOnLeaveToday ? 'border-orange-500/30 bg-orange-500/5' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className="relative flex-shrink-0">
                      <Avatar name={u.avatar || u.name} size="md"/>
                      {lv.isOnLeaveToday && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[8px]">ลา</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-bold">{u.name}</span>
                        <span className="text-xs text-gray-500">{ROLES[u.role]}</span>
                        {lv.isOnLeaveToday && <span className="badge-orange text-[10px]">ลาวันนี้</span>}
                        <span className="badge-gray text-[10px]">{pg.all.length} เพจ</span>
                      </div>
                      {pg.all.length === 0 ? (
                        <p className="text-sm text-red-400">ยังไม่ได้รับมอบหมายเพจ</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {pg.all.map(p => (
                            <div key={p.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                              p.type === 'main'
                                ? 'bg-brand-500/10 border-brand-500/30 text-brand-300'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            }`}>
                              {p.type === 'main' ? <Star size={10}/> : <TestTube size={10}/>}
                              {p.name}
                              <span className={`ml-1 text-[10px] ${p.status === 'active' ? 'text-emerald-400' : 'text-gray-600'}`}>
                                {p.status === 'active' ? '●' : '○'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════ LEAVE HISTORY ══════════════ */}
      {tab === 'leaveHistory' && (
        <div className="space-y-3">
          {/* Leave frequency ranking */}
          <div className="card">
            <div className="text-sm font-bold mb-4 flex items-center gap-2">
              <BarChart3 size={15} className="text-brand-400"/> อันดับการลา (ลาบ่อยสุด)
            </div>
            <div className="space-y-2.5">
              {admins
                .map(u => ({ ...u, ...adminLeaveMap[u.id] }))
                .sort((a, b) => b.totalDays - a.totalDays)
                .map((u, i) => (
                  <div key={u.id} className="flex items-center gap-3">
                    <span className="text-base w-6 text-center">{i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}`}</span>
                    <Avatar name={u.avatar || u.name} size="sm"/>
                    <span className="flex-1 text-sm font-semibold">{u.name}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-400">{u.total} ครั้ง</span>
                      <span className="text-emerald-400">{u.approved} อนุมัติ</span>
                      <span className={`font-black ${u.totalDays > 5 ? 'text-orange-400' : 'text-gray-300'}`}>
                        {u.totalDays} วัน
                      </span>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Per-admin leave history */}
          <div className="space-y-3">
            {admins.map(u => {
              const lv = adminLeaveMap[u.id]
              const exp = expandUid === u.id
              return (
                <div key={u.id} className="card p-0 overflow-hidden">
                  <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-800/20"
                    onClick={() => setExpandUid(exp ? null : u.id)}>
                    <Avatar name={u.avatar || u.name} size="md"/>
                    <div className="flex-1">
                      <div className="font-bold">{u.name}</div>
                      <div className="text-xs text-gray-500">{ROLES[u.role]}</div>
                    </div>
                    <div className="flex gap-4 items-center">
                      <MiniStat label="รวม"      val={lv.total}    color="text-gray-300"/>
                      <MiniStat label="อนุมัติ"  val={lv.approved} color="text-emerald-400"/>
                      <MiniStat label="รอ"       val={lv.pending}  color={lv.pending > 0 ? 'text-orange-400' : 'text-gray-600'}/>
                      <MiniStat label="วันที่ใช้" val={`${lv.totalDays}วัน`} color={lv.totalDays > 5 ? 'text-orange-400' : 'text-brand-400'}/>
                      {exp ? <ChevronUp size={16} className="text-gray-500"/> : <ChevronDown size={16} className="text-gray-500"/>}
                    </div>
                  </div>

                  {exp && (
                    <div className="border-t border-gray-800 bg-gray-900/50">
                      {lv.records.length === 0
                        ? <div className="py-6"><Empty icon={CalendarDays} title="ไม่มีประวัติการลา"/></div>
                        : <div className="table-wrap">
                            <table>
                              <thead><tr>
                                <th>วันที่เริ่ม</th><th>วันที่สิ้นสุด</th>
                                <th className="text-right">จำนวนวัน</th>
                                <th>ประเภท</th><th>เหตุผล</th>
                                <th>สถานะ</th><th>อนุมัติโดย</th>
                              </tr></thead>
                              <tbody>
                                {lv.records.map(l => {
                                  const days = countDays(l.startDate, l.endDate)
                                  const st = { pending:'badge-orange', approved:'badge-green', rejected:'badge-red' }
                                  const stLabel = { pending:'รออนุมัติ', approved:'อนุมัติ', rejected:'ไม่อนุมัติ' }
                                  return (
                                    <tr key={l.id}>
                                      <td className="text-xs">{l.startDate}</td>
                                      <td className="text-xs">{l.endDate}</td>
                                      <td className="text-right font-bold text-brand-400">{days}</td>
                                      <td className="text-xs">{l.leaveType || '—'}</td>
                                      <td className="text-xs max-w-[150px] truncate">{l.reason}</td>
                                      <td><span className={st[l.status] || 'badge-gray'}>{stLabel[l.status] || l.status}</span></td>
                                      <td className="text-xs">{l.approvedBy ? getUserName(l.approvedBy) : '—'}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                      }
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helper components ─────────────────────────────────
function MiniBox({ val, label, color, icon }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-2 text-center">
      <div className={`flex items-center justify-center gap-0.5 text-[10px] text-gray-500 mb-0.5 ${color}`}>{icon}{label}</div>
      <div className={`font-black text-sm ${color}`}>{val}</div>
    </div>
  )
}

function StatBox({ val, label, color, icon }) {
  return (
    <div className="card text-center py-3">
      <div className={`flex items-center justify-center gap-1 text-xs text-gray-500 mb-1 ${color}`}>{icon}{label}</div>
      <div className={`text-2xl font-black ${color}`}>{val}</div>
    </div>
  )
}

function MiniStat({ label, val, color }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
      <div className={`font-black text-sm ${color}`}>{val}</div>
    </div>
  )
}

function LeaveRow({ leave: l, getName, onApprove, onReject, saving, showActions }) {
  const days = countDays(l.startDate, l.endDate)
  const ST = { pending: 'badge-orange', approved: 'badge-green', rejected: 'badge-red' }
  const STL = { pending: 'รออนุมัติ', approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ' }
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-gray-800/50 border border-gray-700/50">
      <Avatar name={getName(l.employeeId).slice(0, 2)} size="sm"/>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold">{getName(l.employeeId)}</div>
        <div className="text-xs text-gray-500">
          {l.startDate === l.endDate
            ? format(parseISO(l.startDate), 'd MMM yyyy', { locale: th })
            : `${format(parseISO(l.startDate), 'd MMM', { locale: th })} – ${format(parseISO(l.endDate), 'd MMM yyyy', { locale: th })}`
          } · {days} วัน · {l.reason}
        </div>
      </div>
      <span className={ST[l.status] || 'badge-gray'}>{STL[l.status] || l.status}</span>
      {showActions && l.status === 'pending' && (
        <div className="flex gap-1.5">
          <button className="btn btn-success btn-sm" onClick={onApprove} disabled={saving}>
            <CheckCircle size={13}/> อนุมัติ
          </button>
          <button className="btn btn-danger btn-sm" onClick={onReject} disabled={saving}>
            <XCircle size={13}/> ปฏิเสธ
          </button>
        </div>
      )}
    </div>
  )
}
