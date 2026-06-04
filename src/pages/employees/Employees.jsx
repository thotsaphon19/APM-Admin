import React, { useState } from 'react'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { updateUserDoc, deleteUserDoc } from '../../lib/db'
import { Modal, Confirm, Empty, Alert, RoleBadge, Avatar, FormGroup, Select } from '../../components/ui'
import { useNotify } from '../../hooks/useNotify'
import { Plus, Edit2, Trash2, Users, Shield, Key, Mail, UserCog, AlertTriangle } from 'lucide-react'

const ROLE_COLORS = {
  superadmin: { border: 'border-red-500/40',    bg: 'bg-red-500/5',    badge: 'badge-red',    icon: 'text-red-400'    },
  head_admin: { border: 'border-orange-500/40', bg: 'bg-orange-500/5', badge: 'badge-orange', icon: 'text-orange-400' },
  admin:      { border: 'border-brand-500/40',  bg: 'bg-brand-500/5',  badge: 'badge-blue',   icon: 'text-brand-400'  },
  assistant:  { border: 'border-emerald-500/40',bg: 'bg-emerald-500/5',badge: 'badge-green',  icon: 'text-emerald-400'},
  auditor:    { border: 'border-purple-500/40', bg: 'bg-purple-500/5', badge: 'badge-purple', icon: 'text-purple-500' },
}

export default function Employees() {
  const { profile, isSuperAdmin, createEmployee } = useAuth()
  const { users } = useData()

  const [modal,   setModal]   = useState(null)  // 'add' | 'edit' | 'role'
  const [current, setCurrent] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [filter,  setFilter]  = useState('')
  const [search,  setSearch]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')

  const filtered = users
    .filter(u => filter ? u.role === filter : true)
    .filter(u => !search || u.name?.toLowerCase().includes(search.toLowerCase()) ||
                            u.email?.toLowerCase().includes(search.toLowerCase()))

  const { notifyEmployee } = useNotify()
  const openAdd     = () => { setCurrent({ name:'', email:'', password:'', role:'admin', avatar:'' }); setModal('add'); setErr('') }
  const openEdit    = (u) => { setCurrent({ ...u, password:'' }); setModal('edit'); setErr('') }
  const openRole    = (u) => { setCurrent({ ...u }); setModal('role'); setErr('') }
  const close       = () => { setModal(null); setCurrent(null); setErr('') }
  const set = (k) => (e) => setCurrent(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async () => {
    if (!current.name || !current.email) { setErr('กรุณากรอกชื่อและอีเมล'); return }
    if (modal === 'add' && !current.password) { setErr('กรุณากรอกรหัสผ่าน'); return }
    setSaving(true); setErr('')
    try {
      if (modal === 'add') {
        const newUid = await createEmployee({ 
          name: current.name, email: current.email,
          password: current.password, role: current.role,
          avatar: current.avatar || current.name.slice(0,2),
        })
        notifyEmployee('add', current.name, newUid)  // แจ้งตัวพนักงานใหม่ด้วย
      } else {
        const { password: _, id, ...data } = current
        await updateUserDoc(current.id, { ...data, avatar: data.avatar || data.name.slice(0,2) })
        notifyEmployee('edit', current.name)
      }
      close()
    } catch(e) {
      const MAP = {
        'auth/email-already-in-use': 'อีเมลนี้ถูกใช้งานแล้ว',
        'auth/invalid-email':        'รูปแบบอีเมลไม่ถูกต้อง',
        'auth/weak-password':        'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
        'auth/operation-not-allowed':'กรุณาเปิดใช้ Email/Password ใน Firebase Console',
      }
      setErr(MAP[e.code] || e.message)
    } finally { setSaving(false) }
  }

  const handleChangeRole = async () => {
    setSaving(true); setErr('')
    try {
      await updateUserDoc(current.id, { role: current.role })
      notifyEmployee('role', current.name)
      close()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    await deleteUserDoc(id)
  }

  // ── Role summary ──────────────────────────────────
  const roleCounts = Object.keys(ROLES).map(r => ({
    role: r, label: ROLES[r], count: users.filter(u => u.role === r).length
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black">จัดการพนักงาน</h2>
          <p className="text-xs text-gray-500 mt-0.5">เพิ่ม ลบ แก้ไข และกำหนดสิทธิ์ผู้ใช้งาน</p>
        </div>
        {isSuperAdmin && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16}/> เพิ่มพนักงาน
          </button>
        )}
      </div>

      {/* Role KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {roleCounts.map(r => {
          const c = ROLE_COLORS[r.role]
          return (
            <div key={r.role}
              className={`card cursor-pointer border transition-all hover:shadow-lg ${
                filter === r.role ? `${c.border} ${c.bg}` : 'hover:border-indigo-200'
              }`}
              onClick={() => setFilter(f => f === r.role ? '' : r.role)}>
              <div className={`flex items-center gap-2 text-xs font-semibold mb-2 ${c.icon}`}>
                <Shield size={12}/> {r.label}
              </div>
              <div className="text-3xl font-black">{r.count}</div>
              <div className="text-xs text-gray-500 mt-1">คน</div>
            </div>
          )
        })}
      </div>

      {/* Permission matrix */}
      <div className="card border-indigo-200/50">
        <div className="text-sm font-bold mb-3 flex items-center gap-2">
          <UserCog size={14} className="text-brand-400"/> สิทธิ์การใช้งานแต่ละตำแหน่ง
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ฟีเจอร์</th>
                <th className="text-center text-red-400">ผู้ดูแลสูงสุด</th>
                <th className="text-center text-orange-400">หัวหน้าแอดมิน</th>
                <th className="text-center text-brand-400">แอดมิน</th>
                <th className="text-center text-emerald-400">ผู้ช่วย</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'ลงค่าคอมมิชชั่น',         sa: true,  ha: true,  ad: true,  as: false },
                { label: 'ตรวจสอบยอด',               sa: true,  ha: true,  ad: false, as: true  },
                { label: 'ศูนย์บัญชาการทีม',         sa: true,  ha: true,  ad: false, as: false },
                { label: 'สรุปค่าคอมรายคน',           sa: true,  ha: false, ad: false, as: true  },
                { label: 'จัดการเพจ',                 sa: true,  ha: true,  ad: 'ดูของตัวเอง', as: false },
                { label: 'มอบหมายเพจ',                sa: true,  ha: true,  ad: false, as: false },
                { label: 'วันลา',                     sa: true,  ha: true,  ad: 'ตัวเอง', as: 'ดูได้' },
                { label: 'อนุมัติวันลา',               sa: true,  ha: true,  ad: false, as: false },
                { label: 'รับเมลงาน',                 sa: true,  ha: true,  ad: true,  as: true  },
                { label: 'จัดการพนักงาน',             sa: true,  ha: 'ดูได้',ad: false, as: false },
                { label: 'กำหนดสิทธิ์',               sa: true,  ha: false, ad: false, as: false },
                { label: 'รายงาน & สถิติ',            sa: true,  ha: true,  ad: false, as: true  },
                { label: 'ภาพรวมบริษัท',              sa: true,  ha: false, ad: false, as: false },
                { label: 'ตั้งค่าค่าคอม',             sa: true,  ha: false, ad: false, as: false },
              ].map((row, i) => (
                <tr key={i}>
                  <td className="font-medium text-sm">{row.label}</td>
                  {[row.sa, row.ha, row.ad, row.as].map((v, j) => (
                    <td key={j} className="text-center">
                      {v === true  ? <span className="text-emerald-400">✅</span> :
                       v === false ? <span className="text-gray-600">—</span> :
                       <span className="text-xs text-orange-400">{v}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Search + filter tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <input className="input pl-8" placeholder="ค้นหาชื่อหรืออีเมล..."
            value={search} onChange={e => setSearch(e.target.value)}/>
          <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
        </div>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab ${!filter?'active':''}`} onClick={()=>setFilter('')}>ทั้งหมด ({users.length})</button>
          {roleCounts.map(r=>(
            <button key={r.role} className={`tab ${filter===r.role?'active':''}`}
              onClick={()=>setFilter(f=>f===r.role?'':r.role)}>
              {r.label} ({r.count})
            </button>
          ))}
        </div>
      </div>

      {/* Employee grid */}
      {filtered.length === 0
        ? <div className="card"><Empty icon={Users} title="ไม่พบพนักงาน" sub="ลองเปลี่ยนตัวกรอง"/></div>
        : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(emp => {
              const c = ROLE_COLORS[emp.role] || ROLE_COLORS.admin
              return (
                <div key={emp.id} className={`card border-t-2 hover:border-indigo-200 transition-all ${c.border}`}>
                  {/* Top */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={emp.avatar || emp.name} size="lg"/>
                      <div>
                        <div className="font-bold">{emp.name}</div>
                        <RoleBadge role={emp.role}/>
                        {emp.id === profile?.id && (
                          <span className="badge-blue text-[10px] ml-1">ฉัน</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                    {emp.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail size={11}/> {emp.email}
                      </div>
                    )}
                    {emp.username && (
                      <div className="flex items-center gap-1.5">
                        <Users size={11}/> @{emp.username}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {isSuperAdmin && emp.id !== profile?.id && (
                    <div className="flex gap-2 border-t border-indigo-100 pt-3">
                      <button className="btn btn-ghost btn-sm flex-1 text-xs" onClick={() => openEdit(emp)}>
                        <Edit2 size={12}/> แก้ไข
                      </button>
                      <button className={`btn btn-sm flex-1 text-xs ${c.badge === 'badge-red' ? 'btn-danger' : 'btn-ghost'}`}
                        onClick={() => openRole(emp)}>
                        <Shield size={12}/> สิทธิ์
                      </button>
                      <button className="btn btn-danger btn-icon btn-sm"
                        onClick={() => setConfirm({ id: emp.id, name: emp.name })}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  )}

                  {/* Self: can only view */}
                  {emp.id === profile?.id && (
                    <div className="flex gap-2 border-t border-indigo-100 pt-3">
                      <button className="btn btn-ghost btn-sm flex-1 text-xs" onClick={() => openEdit(emp)}>
                        <Edit2 size={12}/> แก้ไขข้อมูลตัวเอง
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      }

      {/* ── Add / Edit Modal ── */}
      <Modal open={modal === 'add' || modal === 'edit'} onClose={close}
        title={modal === 'edit' ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงานใหม่'}>
        {err && <Alert type="error">{err}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="ชื่อ-นามสกุล" required>
            <input className="input" placeholder="ชื่อ นามสกุล"
              value={current?.name || ''} onChange={set('name')} autoFocus/>
          </FormGroup>
          <FormGroup label="อีเมล" required>
            <input type="email" className="input" placeholder="email@example.com"
              value={current?.email || ''} onChange={set('email')}
              disabled={modal === 'edit'}/>
          </FormGroup>
        </div>
        {modal === 'add' && (
          <FormGroup label="รหัสผ่าน" required>
            <input type="password" className="input" placeholder="อย่างน้อย 6 ตัวอักษร"
              value={current?.password || ''} onChange={set('password')}/>
          </FormGroup>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="ตำแหน่ง" required>
            <Select value={current?.role || 'admin'} onChange={set('role')}
              options={Object.entries(ROLES).map(([v,l])=>({ value:v, label:l }))}/>
          </FormGroup>
          <FormGroup label="ตัวย่อ Avatar (2 ตัว)">
            <input className="input" placeholder="สด" maxLength={2}
              value={current?.avatar || ''} onChange={set('avatar')}/>
          </FormGroup>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-indigo-100">
          <button className="btn btn-ghost" onClick={close}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : modal === 'edit' ? 'บันทึก' : 'เพิ่มพนักงาน'}
          </button>
        </div>
      </Modal>

      {/* ── Change Role Modal ── */}
      <Modal open={modal === 'role'} onClose={close}
        title={`กำหนดสิทธิ์ — ${current?.name}`}>
        {err && <Alert type="error">{err}</Alert>}
        <div className="rounded-xl bg-orange-500/8 border border-orange-500/20 p-3 mb-4 flex items-start gap-2 text-sm text-orange-300">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5"/>
          การเปลี่ยนสิทธิ์มีผลทันที — ผู้ใช้จะต้อง logout แล้ว login ใหม่
        </div>

        <div className="space-y-2">
          {Object.entries(ROLES).map(([role, label]) => {
            const c = ROLE_COLORS[role]
            const selected = current?.role === role
            return (
              <label key={role} onClick={() => setCurrent(p => ({...p, role}))}
                className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer border transition-all ${
                  selected ? `${c.bg} ${c.border}` : 'bg-indigo-50 border-indigo-200/50 hover:border-gray-600'
                }`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selected ? 'bg-brand-500 border-brand-500' : 'border-gray-600'
                }`}>
                  {selected && <span className="text-white text-xs">✓</span>}
                </div>
                <Shield size={15} className={c.icon}/>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{label}</div>
                  <div className="text-xs text-gray-500">
                    {role === 'superadmin' ? 'เข้าถึงและแก้ไขได้ทุกอย่าง' :
                     role === 'head_admin' ? 'จัดเพจ อนุมัติลา ดูทีม' :
                     role === 'admin'      ? 'ลงค่าคอม ดูเพจตัวเอง' :
                                            'ตรวจสอบยอด ดูรายงาน'}
                  </div>
                </div>
              </label>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-indigo-100 mt-4">
          <button className="btn btn-ghost" onClick={close}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={handleChangeRole} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}
          </button>
        </div>
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} danger
        title="ลบพนักงานนี้?"
        message={`ลบ "${confirm?.name}" ออกจาก Firestore (ต้องลบบัญชี Auth แยกใน Firebase Console)`}
        onConfirm={() => handleDelete(confirm.id)}/>
    </div>
  )
}