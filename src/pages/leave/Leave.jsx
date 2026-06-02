import React, { useState, useMemo } from 'react'
import { format, differenceInDays, parseISO, isToday, isFuture, isPast } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { Modal, Confirm, Empty, Alert, Avatar, FormGroup, Select } from '../../components/ui'
import {
  Plus, CheckCircle, XCircle, Clock, CalendarDays,
  Trash2, ChevronDown, ChevronUp, Calendar, FileText,
  AlertCircle, History, User,
} from 'lucide-react'

const today = format(new Date(), 'yyyy-MM-dd')
const thisMonth = format(new Date(), 'yyyy-MM')

const LEAVE_TYPES = [
  { value: 'personal',  label: '🏠 ธุระส่วนตัว' },
  { value: 'sick',      label: '🤒 ลาป่วย' },
  { value: 'vacation',  label: '🌴 ลาพักร้อน' },
  { value: 'emergency', label: '🚨 เหตุฉุกเฉิน' },
  { value: 'other',     label: '📝 อื่นๆ' },
]

const STATUS = {
  pending:  { label: 'รออนุมัติ',  cls: 'badge-orange', icon: Clock,        bg: 'bg-orange-500/8 border-orange-500/25' },
  approved: { label: 'อนุมัติแล้ว', cls: 'badge-green',  icon: CheckCircle,  bg: 'bg-emerald-500/8 border-emerald-500/25' },
  rejected: { label: 'ไม่อนุมัติ',  cls: 'badge-red',    icon: XCircle,      bg: 'bg-red-500/8 border-red-500/25' },
}

function countDays(start, end) {
  if (!start || !end) return 1
  return differenceInDays(parseISO(end), parseISO(start)) + 1
}

function leaveTypeLabel(type) {
  return LEAVE_TYPES.find(t => t.value === type)?.label || type || '📝 ไม่ระบุ'
}

export default function Leave() {
  const { profile, canManage, isSuperAdmin } = useAuth()
  const { leaves, users, createLeave, approveLeave, rejectLeave, removeLeave, getUserName } = useData()

  const [modal,      setModal]      = useState(false)
  const [confirm,    setConfirm]    = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterUser,   setFilterUser]   = useState('')
  const [filterMonth,  setFilterMonth]  = useState(thisMonth)
  const [expandId,     setExpandId]     = useState(null)
  const [viewMode,     setViewMode]     = useState('cards') // 'cards' | 'timeline' | 'history'
  const [saving,       setSaving]       = useState(false)
  const [err,          setErr]          = useState('')

  const isAdmin = profile?.role === 'admin'

  // ── filtered ───────────────────────────────────────
  const filtered = useMemo(() => {
    let d = [...leaves].filter(l => !l.deleted)
    if (isAdmin) d = d.filter(l => l.employeeId === profile?.id)
    if (filterStatus) d = d.filter(l => l.status === filterStatus)
    if (filterUser)   d = d.filter(l => l.employeeId === filterUser)
    if (filterMonth)  d = d.filter(l => l.startDate?.startsWith(filterMonth))
    return d.sort((a, b) => {
      // pending first, then by date desc
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (a.status !== 'pending' && b.status === 'pending') return 1
      return b.startDate?.localeCompare(a.startDate)
    })
  }, [leaves, filterStatus, filterUser, filterMonth, isAdmin, profile?.id])

  // ── stats ──────────────────────────────────────────
  const myLeaves = useMemo(() =>
    leaves.filter(l => !l.deleted && l.employeeId === profile?.id),
    [leaves, profile?.id]
  )

  const stats = useMemo(() => {
    const base = isAdmin ? myLeaves : leaves.filter(l => !l.deleted)
    const monthBase = base.filter(l => l.startDate?.startsWith(thisMonth))
    return {
      total:    base.length,
      pending:  base.filter(l => l.status === 'pending').length,
      approved: base.filter(l => l.status === 'approved').length,
      rejected: base.filter(l => l.status === 'rejected').length,
      thisMonth: monthBase.filter(l => l.status === 'approved').length,
      totalDays: base.filter(l => l.status === 'approved')
        .reduce((a, l) => a + countDays(l.startDate, l.endDate), 0),
    }
  }, [leaves, isAdmin, myLeaves])

  // ── per-employee stats (for head) ─────────────────
  const employeeStats = useMemo(() => {
    if (isAdmin) return []
    const admins = users.filter(u => ['admin', 'head_admin'].includes(u.role))
    return admins.map(u => {
      const ul = leaves.filter(l => !l.deleted && l.employeeId === u.id)
      return {
        ...u,
        total:    ul.length,
        approved: ul.filter(l => l.status === 'approved').length,
        pending:  ul.filter(l => l.status === 'pending').length,
        totalDays: ul.filter(l => l.status === 'approved')
          .reduce((a, l) => a + countDays(l.startDate, l.endDate), 0),
      }
    }).sort((a, b) => b.total - a.total)
  }, [leaves, users, isAdmin])

  // ── handlers ───────────────────────────────────────
  const handleApprove = async (id) => {
    setSaving(true)
    try { await approveLeave(id, profile?.id) }
    catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const handleReject = async (id) => {
    setSaving(true)
    try { await rejectLeave(id, profile?.id) }
    catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    await removeLeave(id)
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black">ระบบวันลา</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isAdmin
              ? `คุณลาแล้ว ${stats.totalDays} วัน · รออนุมัติ ${stats.pending} รายการ`
              : `รออนุมัติ ${stats.pending} รายการ`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <button className={`btn btn-ghost btn-sm ${viewMode === 'history' ? 'bg-gray-700' : ''}`}
            onClick={() => setViewMode(v => v === 'history' ? 'cards' : 'history')}>
            <History size={14}/> ประวัติ
          </button>
          <button className="btn btn-primary" onClick={() => setModal(true)}>
            <Plus size={16}/> ขอลา
          </button>
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="card text-center">
          <div className="text-xs text-gray-500 flex items-center justify-center gap-1 mb-1">
            <CalendarDays size={11}/> รายการทั้งหมด
          </div>
          <div className="text-2xl font-black">{stats.total}</div>
        </div>
        <div className="card text-center bg-orange-500/5 border-orange-500/25">
          <div className="text-xs text-orange-400 flex items-center justify-center gap-1 mb-1">
            <Clock size={11}/> รออนุมัติ
          </div>
          <div className="text-2xl font-black text-orange-400">{stats.pending}</div>
        </div>
        <div className="card text-center bg-emerald-500/5 border-emerald-500/25">
          <div className="text-xs text-emerald-400 flex items-center justify-center gap-1 mb-1">
            <CheckCircle size={11}/> อนุมัติแล้ว
          </div>
          <div className="text-2xl font-black text-emerald-400">{stats.approved}</div>
        </div>
        <div className="card text-center bg-red-500/5 border-red-500/25">
          <div className="text-xs text-red-400 flex items-center justify-center gap-1 mb-1">
            <XCircle size={11}/> ไม่อนุมัติ
          </div>
          <div className="text-2xl font-black text-red-400">{stats.rejected}</div>
        </div>
        <div className="card text-center bg-brand-500/5 border-brand-500/25">
          <div className="text-xs text-brand-400 flex items-center justify-center gap-1 mb-1">
            <Calendar size={11}/> วันที่ใช้ไปแล้ว
          </div>
          <div className="text-2xl font-black text-brand-400">{stats.totalDays}</div>
          <div className="text-xs text-gray-600">วัน</div>
        </div>
      </div>

      {/* ── Pending alert banner (for head) ── */}
      {!isAdmin && stats.pending > 0 && (
        <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-orange-400 flex-shrink-0"/>
          <div className="flex-1">
            <span className="font-bold text-orange-400">{stats.pending} รายการ</span>
            <span className="text-sm text-gray-400 ml-1">รออนุมัติ — กรุณาตรวจสอบ</span>
          </div>
          <button className="btn btn-ghost btn-sm text-orange-400"
            onClick={() => setFilterStatus('pending')}>
            ดูรายการ
          </button>
        </div>
      )}

      {/* ── Employee stats (head view) ── */}
      {!isAdmin && viewMode === 'history' && (
        <div className="card">
          <div className="text-sm font-bold mb-4 flex items-center gap-2">
            <User size={15} className="text-brand-400"/> สถิติวันลารายบุคคล
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>#</th><th>พนักงาน</th><th>ตำแหน่ง</th>
                <th className="text-right">รวมครั้ง</th>
                <th className="text-right text-emerald-400">อนุมัติ</th>
                <th className="text-right text-orange-400">รออนุมัติ</th>
                <th className="text-right text-brand-400">วันที่ใช้ไป</th>
              </tr></thead>
              <tbody>
                {employeeStats.map((u, i) => (
                  <tr key={u.id}>
                    <td className="text-gray-600">{i+1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={u.avatar||u.name} size="sm"/>
                        <span className="font-semibold text-sm">{u.name}</span>
                      </div>
                    </td>
                    <td><span className="badge-gray text-xs">{ROLES[u.role]}</span></td>
                    <td className="text-right font-bold">{u.total}</td>
                    <td className="text-right text-emerald-400">{u.approved}</td>
                    <td className="text-right text-orange-400">{u.pending}</td>
                    <td className="text-right font-black text-brand-400">{u.totalDays} วัน</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="card">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">เดือน</label>
            <input type="month" className="input" value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}/>
          </div>
          <div>
            <label className="label">สถานะ</label>
            <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">ทั้งหมด</option>
              <option value="pending">รออนุมัติ</option>
              <option value="approved">อนุมัติแล้ว</option>
              <option value="rejected">ไม่อนุมัติ</option>
            </select>
          </div>
          {!isAdmin && (
            <div>
              <label className="label">พนักงาน</label>
              <select className="input" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                <option value="">ทั้งหมด</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button className="btn btn-ghost btn-sm w-full"
              onClick={() => { setFilterStatus(''); setFilterUser(''); setFilterMonth(thisMonth) }}>
              รีเซ็ต
            </button>
          </div>
        </div>
      </div>

      {/* ── Leave list ── */}
      {filtered.length === 0 ? (
        <div className="card">
          <Empty icon={CalendarDays} title="ไม่มีรายการวันลา"
            sub={isAdmin ? 'กด "ขอลา" เพื่อยื่นคำขอ' : 'ลองเปลี่ยนตัวกรอง'}/>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(l => (
            <LeaveCard key={l.id} leave={l}
              isAdmin={isAdmin} canManage={canManage} isSuperAdmin={isSuperAdmin}
              profile={profile}
              getName={getUserName}
              expanded={expandId === l.id}
              onToggle={() => setExpandId(expandId === l.id ? null : l.id)}
              onApprove={() => handleApprove(l.id)}
              onReject={() => handleReject(l.id)}
              onDelete={() => setConfirm({ id: l.id, name: getUserName(l.employeeId) })}
              saving={saving}
            />
          ))}
        </div>
      )}

      {/* ── Request Leave Modal ── */}
      {modal && (
        <LeaveModal
          onClose={() => setModal(false)}
          createLeave={createLeave}
          profile={profile}
          users={users}
          canManage={canManage}
        />
      )}

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} danger
        title="ลบรายการนี้?"
        message={`ลบคำขอลาของ ${confirm?.name}`}
        onConfirm={() => handleDelete(confirm.id)}/>
    </div>
  )
}

// ── Leave Card ────────────────────────────────────────
function LeaveCard({ leave: l, isAdmin, canManage, isSuperAdmin, profile,
  getName, expanded, onToggle, onApprove, onReject, onDelete, saving }) {

  const st = STATUS[l.status] || STATUS.pending
  const StatusIcon = st.icon
  const days = countDays(l.startDate, l.endDate)
  const isOwner = l.employeeId === profile?.id
  const isPendingMine = l.status === 'pending' && isOwner
  const canApprove = canManage && l.status === 'pending'
  const canDelete = isSuperAdmin || (isOwner && l.status === 'pending')

  // Date status
  const startD = parseISO(l.startDate)
  const isUpcoming = isFuture(startD)
  const isOngoing  = l.status === 'approved' &&
    !isFuture(startD) && !isPast(parseISO(l.endDate))

  return (
    <div className={`card p-0 overflow-hidden border ${st.bg} transition-all`}>
      {/* Main row */}
      <div className="flex flex-wrap items-center gap-4 p-4">

        {/* Avatar + name */}
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={l.employeeId === profile?.id
            ? (profile?.avatar || profile?.name)
            : getName(l.employeeId)} size="md"
            className={l.status === 'approved' ? '!from-emerald-500 !to-teal-500' :
                       l.status === 'rejected' ? '!from-red-500 !to-rose-600' : ''}/>
          <div className="min-w-0">
            <div className="font-bold text-sm flex items-center gap-1.5 flex-wrap">
              {getName(l.employeeId)}
              {isOwner && <span className="badge-blue text-[10px] px-1.5">ฉัน</span>}
              {isOngoing && <span className="badge-green text-[10px] px-1.5 animate-pulse-slow">🟢 กำลังลา</span>}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <Calendar size={10}/>
              {l.startDate === l.endDate
                ? format(parseISO(l.startDate), 'd MMMM yyyy', { locale: th })
                : `${format(parseISO(l.startDate), 'd MMM', { locale: th })} – ${format(parseISO(l.endDate), 'd MMM yyyy', { locale: th })}`
              }
              <span className="text-gray-600">·</span>
              <span className="font-semibold text-gray-400">{days} วัน</span>
            </div>
          </div>
        </div>

        {/* Leave type + reason */}
        <div className="flex-1 min-w-0 hidden sm:block">
          <div className="text-xs text-gray-400 font-semibold mb-0.5">{leaveTypeLabel(l.leaveType)}</div>
          <div className="text-sm text-gray-300 truncate">{l.reason}</div>
        </div>

        {/* Status + actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={st.cls}>
            <StatusIcon size={11}/>
            {st.label}
          </span>

          {canApprove && (
            <>
              <button className="btn btn-success btn-sm" onClick={onApprove} disabled={saving}>
                <CheckCircle size={13}/> อนุมัติ
              </button>
              <button className="btn btn-danger btn-sm" onClick={onReject} disabled={saving}>
                <XCircle size={13}/> ปฏิเสธ
              </button>
            </>
          )}

          {canDelete && (
            <button className="btn btn-ghost btn-icon btn-sm text-gray-500 hover:text-red-400"
              onClick={onDelete} title="ลบ">
              <Trash2 size={13}/>
            </button>
          )}

          <button className="btn btn-ghost btn-icon btn-sm text-gray-500"
            onClick={onToggle}>
            {expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-800/60 bg-gray-900/50 px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <DetailItem icon={<Calendar size={13}/>} label="วันที่เริ่ม" val={format(parseISO(l.startDate), 'EEEE d MMMM yyyy', { locale: th })}/>
          <DetailItem icon={<Calendar size={13}/>} label="วันที่สิ้นสุด" val={format(parseISO(l.endDate), 'EEEE d MMMM yyyy', { locale: th })}/>
          <DetailItem icon={<CalendarDays size={13}/>} label="จำนวนวัน" val={`${days} วัน`}/>
          <DetailItem icon={<FileText size={13}/>} label="ประเภทการลา" val={leaveTypeLabel(l.leaveType)}/>
          <div className="col-span-2 sm:col-span-4">
            <DetailItem icon={<FileText size={13}/>} label="เหตุผล" val={l.reason}/>
          </div>
          {l.approvedBy && (
            <div className="col-span-2 sm:col-span-4">
              <DetailItem
                icon={l.status === 'approved' ? <CheckCircle size={13} className="text-emerald-400"/> : <XCircle size={13} className="text-red-400"/>}
                label={l.status === 'approved' ? 'อนุมัติโดย' : 'ปฏิเสธโดย'}
                val={getName(l.approvedBy)}/>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DetailItem({ icon, label, val }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-0.5">{icon}{label}</div>
      <div className="text-sm font-semibold text-gray-200">{val || '—'}</div>
    </div>
  )
}

// ── Leave Request Modal ───────────────────────────────
function LeaveModal({ onClose, createLeave, profile, users, canManage }) {
  const [form, setForm] = useState({
    employeeId: profile?.id || '',
    leaveType: 'personal',
    startDate: today,
    endDate: today,
    reason: '',
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  const days = countDays(form.startDate, form.endDate)

  const handleSubmit = async () => {
    if (!form.startDate || !form.endDate || !form.reason.trim()) {
      setErr('กรุณากรอกข้อมูลให้ครบ'); return
    }
    if (form.endDate < form.startDate) {
      setErr('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม'); return
    }
    setSaving(true); setErr('')
    try {
      await createLeave({ ...form })
      onClose()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="ยื่นขอลา">
      {err && <Alert type="error">{err}</Alert>}

      {/* ถ้าเป็น head/superadmin เลือกพนักงานได้ */}
      {canManage && (
        <FormGroup label="พนักงาน" required>
          <select className="input" value={form.employeeId} onChange={set('employeeId')}>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({ROLES[u.role]})</option>
            ))}
          </select>
        </FormGroup>
      )}

      <FormGroup label="ประเภทการลา" required>
        <Select value={form.leaveType} onChange={set('leaveType')}
          options={LEAVE_TYPES}/>
      </FormGroup>

      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="วันที่เริ่มลา" required>
          <input type="date" className="input" value={form.startDate}
            onChange={set('startDate')} min={today}/>
        </FormGroup>
        <FormGroup label="วันที่สิ้นสุด" required>
          <input type="date" className="input" value={form.endDate}
            onChange={set('endDate')} min={form.startDate}/>
        </FormGroup>
      </div>

      {/* Day count preview */}
      <div className={`rounded-xl border p-3 mb-4 flex items-center gap-3 text-sm ${
        days > 3 ? 'bg-orange-500/8 border-orange-500/25' : 'bg-brand-500/8 border-brand-500/25'}`}>
        <CalendarDays size={16} className={days > 3 ? 'text-orange-400' : 'text-brand-400'}/>
        <span className="text-gray-400">จำนวนวันลา:</span>
        <span className={`font-black text-lg ${days > 3 ? 'text-orange-400' : 'text-brand-400'}`}>
          {days} วัน
        </span>
        <span className="text-xs text-gray-500">
          {form.startDate === form.endDate
            ? format(parseISO(form.startDate), 'd MMMM yyyy', { locale: th })
            : `${format(parseISO(form.startDate), 'd MMM', { locale: th })} – ${format(parseISO(form.endDate), 'd MMM yyyy', { locale: th })}`
          }
        </span>
      </div>

      <FormGroup label="เหตุผลการลา" required>
        <textarea className="input" rows={3}
          placeholder="ระบุเหตุผลการลา..."
          value={form.reason} onChange={set('reason')}/>
      </FormGroup>

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-800">
        <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? 'กำลังส่ง...' : 'ส่งคำขอลา'}
        </button>
      </div>
    </Modal>
  )
}
