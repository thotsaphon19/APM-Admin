import React, { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { Modal, Confirm, Empty, Alert, Avatar, FormGroup, Select } from '../../components/ui'
import {
  Plus, Edit2, Trash2, BookOpen, Tag, Users, Check,
  Eye, Shield, Star, TestTube, LayoutGrid, List,
  ChevronDown, ChevronUp, Calendar, User,
} from 'lucide-react'

const today = format(new Date(), 'yyyy-MM-dd')
const todayLabel = format(new Date(), 'EEEE d MMMM yyyy', { locale: th })

export default function PagesManagement() {
  const { profile, canManage, isSuperAdmin } = useAuth()
  const { pages, users, createPage, editPage, removePage } = useData()

  const [modal,    setModal]    = useState(null)   // 'add' | 'edit' | 'assign'
  const [current,  setCurrent]  = useState(null)
  const [confirm,  setConfirm]  = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [tabView,  setTabView]  = useState('all')  // 'all' | 'mine' | 'today'
  const [expandUid,setExpandUid]= useState(null)   // for head view: which admin expanded

  const isAdmin    = profile?.role === 'admin'
  const isHead     = ['head_admin','superadmin'].includes(profile?.role)
  const admins     = users.filter(u => ['admin','head_admin'].includes(u.role))
  const myPages    = pages.filter(p => p.assignedTo?.includes(profile?.id))
  const todayPages = pages.filter(p => p.assignedTo?.includes(profile?.id) && p.status === 'active')

  // Tab filtering
  const displayPages = useMemo(() => {
    if (tabView === 'mine')  return myPages
    if (tabView === 'today') return todayPages
    return pages
  }, [tabView, pages, myPages, todayPages])

  // Per-admin page map (for head view)
  const adminPageMap = useMemo(() =>
    admins.map(u => ({
      ...u,
      pages: pages.filter(p => p.assignedTo?.includes(u.id)),
      mainPages: pages.filter(p => p.assignedTo?.includes(u.id) && p.type === 'main'),
      testPages: pages.filter(p => p.assignedTo?.includes(u.id) && p.type === 'test'),
    })).sort((a,b) => b.pages.length - a.pages.length),
    [admins, pages]
  )

  const getAdminNames = (ids = []) =>
    ids.map(id => users.find(u => u.id === id)?.name || '?').join(', ') || '—'

  // ── CRUD ────────────────────────────────────────────
  const openAdd  = () => { setCurrent({ name:'', type:'main', status:'active', note:'' }); setModal('add'); setErr('') }
  const openEdit = (p) => { setCurrent({...p}); setModal('edit'); setErr('') }
  const openAssign = (p) => { setCurrent({...p}); setModal('assign'); setErr('') }
  const close    = () => { setModal(null); setCurrent(null); setErr('') }
  const set      = (k) => (e) => setCurrent(p => ({...p, [k]: e.target.value}))

  const handleSave = async () => {
    if (!current.name?.trim()) { setErr('กรุณากรอกชื่อเพจ'); return }
    setSaving(true); setErr('')
    try {
      if (modal === 'edit') await editPage(current.id, current)
      else await createPage({ ...current, assignedTo: [] })
      close()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const handleAssign = async (pageId, adminIds) => {
    setSaving(true)
    try { await editPage(pageId, { assignedTo: adminIds }); close() }
    catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  // ── Stats ────────────────────────────────────────────
  const stats = {
    total:    pages.length,
    main:     pages.filter(p => p.type === 'main').length,
    test:     pages.filter(p => p.type === 'test').length,
    active:   pages.filter(p => p.status === 'active').length,
    mine:     myPages.length,
    today:    todayPages.length,
    unassigned: pages.filter(p => !p.assignedTo?.length).length,
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black">ระบบเพจ</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isAdmin
              ? `คุณรับผิดชอบ ${myPages.length} เพจ · วันนี้เฝ้า ${todayPages.length} เพจ`
              : `เพจทั้งหมด ${pages.length} เพจ`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* view toggle */}
          <button onClick={() => setViewMode(v => v==='grid'?'list':'grid')}
            className="btn btn-ghost btn-icon btn-sm" title="เปลี่ยนมุมมอง">
            {viewMode === 'grid' ? <List size={16}/> : <LayoutGrid size={16}/>}
          </button>
          {canManage && (
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16}/> เพิ่มเพจ
            </button>
          )}
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard val={stats.total}      label="เพจทั้งหมด"     color="text-gray-200"    icon={<BookOpen size={14}/>} />
        <KpiCard val={stats.main}       label="เพจหลัก"        color="text-brand-400"   icon={<Star size={14}/>} />
        <KpiCard val={stats.test}       label="เพจทดสอบ"       color="text-amber-400"   icon={<TestTube size={14}/>} />
        <KpiCard val={stats.active}     label="ใช้งานอยู่"      color="text-emerald-400" icon={<Eye size={14}/>} />
        {isAdmin && <KpiCard val={stats.mine}  label="เพจของฉัน"     color="text-purple-400"  icon={<Shield size={14}/>} />}
        {isAdmin && <KpiCard val={stats.today} label="เฝ้าวันนี้"     color="text-pink-400"    icon={<Calendar size={14}/>} />}
        {isHead  && <KpiCard val={stats.unassigned} label="ยังไม่มอบหมาย" color="text-red-400"  icon={<Users size={14}/>} />}
      </div>

      {/* ── Today banner (admin only) ── */}
      {isAdmin && todayPages.length > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-brand-500/15 to-purple-500/10 border border-brand-500/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={15} className="text-brand-400"/>
            <span className="font-bold text-sm text-brand-400">วันนี้คุณเฝ้าเพจ</span>
            <span className="text-xs text-gray-500">{todayLabel}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {todayPages.map(p => (
              <div key={p.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold ${
                p.type === 'main'
                  ? 'bg-brand-500/15 border-brand-500/30 text-brand-300'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              }`}>
                {p.type === 'main' ? <Star size={12}/> : <TestTube size={12}/>}
                {p.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-3">
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab ${tabView==='all'?'active':''}`} onClick={()=>setTabView('all')}>
            ทั้งหมด ({pages.length})
          </button>
          {isAdmin && (
            <button className={`tab ${tabView==='mine'?'active':''}`} onClick={()=>setTabView('mine')}>
              เพจของฉัน ({myPages.length})
            </button>
          )}
          {isAdmin && (
            <button className={`tab ${tabView==='today'?'active':''}`} onClick={()=>setTabView('today')}>
              วันนี้ ({todayPages.length})
            </button>
          )}
          {isHead && (
            <button className={`tab ${tabView==='byAdmin'?'active':''}`} onClick={()=>setTabView('byAdmin')}>
              แยกตามแอดมิน
            </button>
          )}
        </div>
      </div>

      {/* ══════════ VIEW: แยกตามแอดมิน (head only) ══════════ */}
      {tabView === 'byAdmin' && isHead && (
        <div className="space-y-3">
          {adminPageMap.map(u => (
            <div key={u.id} className="card p-0 overflow-hidden">
              {/* Admin row header */}
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-800/20 transition-colors"
                onClick={() => setExpandUid(expandUid === u.id ? null : u.id)}>
                <Avatar name={u.avatar || u.name} size="md"/>
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{u.name}</div>
                  <div className="text-xs text-gray-500">{ROLES[u.role]}</div>
                </div>
                {/* mini stats */}
                <div className="flex gap-4 items-center">
                  <div className="text-center hidden sm:block">
                    <div className="text-xs text-gray-500 mb-0.5">รวม</div>
                    <div className="font-black text-gray-200">{u.pages.length} เพจ</div>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="text-xs text-gray-500 mb-0.5">หลัก</div>
                    <div className="font-black text-brand-400">{u.mainPages.length}</div>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="text-xs text-gray-500 mb-0.5">ทดสอบ</div>
                    <div className="font-black text-amber-400">{u.testPages.length}</div>
                  </div>
                  {/* page badge pills */}
                  <div className="hidden md:flex flex-wrap gap-1 max-w-xs">
                    {u.pages.slice(0,3).map(p => (
                      <span key={p.id} className={`text-xs px-2 py-0.5 rounded-full border ${
                        p.type==='main'
                          ?'bg-brand-500/10 border-brand-500/30 text-brand-400'
                          :'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}>{p.name.length>10?p.name.slice(0,10)+'…':p.name}</span>
                    ))}
                    {u.pages.length > 3 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
                        +{u.pages.length-3}
                      </span>
                    )}
                  </div>
                  {expandUid === u.id ? <ChevronUp size={16} className="text-gray-500"/> : <ChevronDown size={16} className="text-gray-500"/>}
                </div>
              </div>

              {/* Expanded: pages of this admin */}
              {expandUid === u.id && (
                <div className="border-t border-gray-800 bg-gray-900/50 p-4">
                  {u.pages.length === 0
                    ? <p className="text-sm text-gray-500 text-center py-4">ยังไม่ได้รับมอบหมายเพจ</p>
                    : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {u.pages.map(p => (
                          <PageCard key={p.id} page={p}
                            assignedAdmins={getAdminNames(p.assignedTo)}
                            canManage={canManage} isSuperAdmin={isSuperAdmin}
                            onEdit={() => openEdit(p)}
                            onAssign={() => openAssign(p)}
                            onDelete={() => setConfirm({ id: p.id, name: p.name })}
                            compact />
                        ))}
                      </div>
                    )
                  }
                  {canManage && (
                    <div className="mt-3 pt-3 border-t border-gray-800 flex justify-end">
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => { setCurrent(u); setModal('bulkAssign') }}>
                        <Users size={13}/> จัดเพจให้ {u.name}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══════════ VIEW: Grid / List ══════════ */}
      {tabView !== 'byAdmin' && (
        <>
          {displayPages.length === 0 ? (
            <div className="card">
              <Empty icon={BookOpen}
                title={tabView==='mine'?'คุณยังไม่ได้รับมอบหมายเพจ':tabView==='today'?'ไม่มีเพจที่เฝ้าวันนี้':'ยังไม่มีเพจ'}
                sub={canManage ? 'กด "เพิ่มเพจ" เพื่อเริ่มต้น' : undefined} />
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayPages.map(p => (
                <PageCard key={p.id} page={p}
                  assignedAdmins={getAdminNames(p.assignedTo)}
                  assignedIds={p.assignedTo || []}
                  users={users}
                  isMyPage={p.assignedTo?.includes(profile?.id)}
                  canManage={canManage} isSuperAdmin={isSuperAdmin}
                  onEdit={() => openEdit(p)}
                  onAssign={() => openAssign(p)}
                  onDelete={() => setConfirm({ id: p.id, name: p.name })} />
              ))}
            </div>
          ) : (
            /* List view */
            <div className="card p-0 overflow-hidden">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ชื่อเพจ</th>
                      <th>ประเภท</th>
                      <th>สถานะ</th>
                      <th>รับผิดชอบโดย</th>
                      <th className="text-center">จำนวนแอดมิน</th>
                      {canManage && <th>จัดการ</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {displayPages.map(p => (
                      <tr key={p.id}
                        className={p.assignedTo?.includes(profile?.id) ? 'bg-brand-500/5' : ''}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              p.status==='active'?'bg-emerald-500':'bg-gray-600'}`}/>
                            <span className="font-semibold text-sm">{p.name}</span>
                            {p.assignedTo?.includes(profile?.id) && (
                              <span className="badge-blue text-[10px] px-1.5 py-0">ของฉัน</span>
                            )}
                          </div>
                          {p.note && <div className="text-xs text-gray-500 ml-4 mt-0.5">{p.note}</div>}
                        </td>
                        <td>
                          <span className={p.type==='main'?'badge-blue':'badge-orange'}>
                            {p.type==='main'?'เพจหลัก':'เพจทดสอบ'}
                          </span>
                        </td>
                        <td>
                          <span className={p.status==='active'?'badge-green':'badge-gray'}>
                            {p.status==='active'?'ใช้งาน':'ปิด'}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {(p.assignedTo||[]).slice(0,3).map(id => {
                              const u = users.find(u=>u.id===id)
                              return u ? (
                                <div key={id} className="flex items-center gap-1 text-xs bg-gray-800 px-2 py-0.5 rounded-full">
                                  <span>{u.name}</span>
                                </div>
                              ) : null
                            })}
                            {(p.assignedTo||[]).length > 3 && (
                              <span className="text-xs text-gray-500">+{p.assignedTo.length-3}</span>
                            )}
                            {!(p.assignedTo||[]).length && (
                              <span className="text-xs text-red-400">ยังไม่มอบหมาย</span>
                            )}
                          </div>
                        </td>
                        <td className="text-center font-bold">{(p.assignedTo||[]).length}</td>
                        {canManage && (
                          <td>
                            <div className="flex gap-1">
                              <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openAssign(p)} title="มอบหมาย">
                                <Users size={13}/>
                              </button>
                              <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>openEdit(p)} title="แก้ไข">
                                <Edit2 size={13}/>
                              </button>
                              {isSuperAdmin && (
                                <button className="btn btn-danger btn-icon btn-sm"
                                  onClick={()=>setConfirm({id:p.id,name:p.name})}>
                                  <Trash2 size={13}/>
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Add/Edit Modal ── */}
      <Modal open={modal==='add'||modal==='edit'} onClose={close}
        title={modal==='edit'?'แก้ไขเพจ':'เพิ่มเพจใหม่'}>
        {err && <Alert type="error">{err}</Alert>}
        <FormGroup label="ชื่อเพจ" required>
          <input className="input" placeholder="ชื่อเพจ..."
            value={current?.name||''} onChange={set('name')} autoFocus/>
        </FormGroup>
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="ประเภท">
            <Select value={current?.type||'main'} onChange={set('type')}
              options={[{value:'main',label:'⭐ เพจหลัก'},{value:'test',label:'🧪 เพจทดสอบ'}]}/>
          </FormGroup>
          <FormGroup label="สถานะ">
            <Select value={current?.status||'active'} onChange={set('status')}
              options={[{value:'active',label:'✅ ใช้งาน'},{value:'inactive',label:'⏸ ปิด'}]}/>
          </FormGroup>
        </div>
        <FormGroup label="หมายเหตุ">
          <input className="input" placeholder="หมายเหตุ (ถ้ามี)"
            value={current?.note||''} onChange={set('note')}/>
        </FormGroup>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-800">
          <button className="btn btn-ghost" onClick={close}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving?'กำลังบันทึก...':modal==='edit'?'บันทึก':'เพิ่มเพจ'}
          </button>
        </div>
      </Modal>

      {/* ── Assign Modal ── */}
      {modal==='assign' && current && (
        <AssignModal page={current} admins={admins}
          onClose={close} onSave={handleAssign} saving={saving}/>
      )}

      {/* ── Bulk assign for head (จัดเพจให้แอดมินคนนึง) ── */}
      {modal==='bulkAssign' && current && (
        <BulkAssignModal admin={current} pages={pages}
          onClose={close} editPage={editPage}/>
      )}

      <Confirm open={!!confirm} onClose={()=>setConfirm(null)} danger
        title="ลบเพจนี้?" message={`ลบ "${confirm?.name}" ออกจากระบบ`}
        onConfirm={()=>removePage(confirm.id)}/>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────
function KpiCard({ val, label, color, icon }) {
  return (
    <div className="card text-center py-3">
      <div className={`flex items-center justify-center gap-1 text-xs text-gray-500 mb-1 ${color}`}>
        {icon} {label}
      </div>
      <div className={`text-2xl font-black ${color}`}>{val}</div>
    </div>
  )
}

// ── Page Card ─────────────────────────────────────────
function PageCard({ page: p, assignedAdmins, assignedIds=[], users=[], isMyPage,
  canManage, isSuperAdmin, onEdit, onAssign, onDelete, compact }) {
  return (
    <div className={`card hover:border-gray-700 transition-all ${
      isMyPage ? 'border-brand-500/40 bg-brand-500/5' : ''
    } ${compact ? 'p-3' : ''}`}>
      {/* Top row */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2 flex-wrap">
          <span className={p.type==='main'?'badge-blue':'badge-orange'}>
            {p.type==='main'?'⭐ เพจหลัก':'🧪 เพจทดสอบ'}
          </span>
          <span className={p.status==='active'?'badge-green':'badge-gray'}>
            {p.status==='active'?'ใช้งาน':'ปิด'}
          </span>
          {isMyPage && <span className="badge-purple">ของฉัน</span>}
        </div>
        {canManage && (
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onAssign} title="มอบหมาย">
              <Users size={13}/>
            </button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit} title="แก้ไข">
              <Edit2 size={13}/>
            </button>
            {isSuperAdmin && (
              <button className="btn btn-danger btn-icon btn-sm" onClick={onDelete}>
                <Trash2 size={13}/>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Page name */}
      <div className="font-bold text-base mb-2">{p.name}</div>

      {/* Assigned avatars */}
      <div className="flex items-center gap-2 mb-2">
        {assignedIds.length > 0 ? (
          <div className="flex -space-x-2">
            {assignedIds.slice(0,4).map(id => {
              const u = users.find(u => u.id === id)
              return u ? (
                <div key={id} title={u.name}
                  className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 border-2 border-gray-900 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {(u.avatar||u.name||'?').slice(0,2)}
                </div>
              ) : null
            })}
            {assignedIds.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-xs text-gray-400">
                +{assignedIds.length-4}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <User size={11}/> ยังไม่มอบหมาย
          </span>
        )}
        {assignedIds.length > 0 && (
          <span className="text-xs text-gray-500 truncate">{assignedAdmins}</span>
        )}
      </div>

      {p.note && !compact && (
        <div className="text-xs text-gray-500 border-t border-gray-800 pt-2 mt-2">
          📝 {p.note}
        </div>
      )}
    </div>
  )
}

// ── Assign Modal ──────────────────────────────────────
function AssignModal({ page, admins, onClose, onSave, saving }) {
  const [sel, setSel] = useState(page.assignedTo || [])
  const toggle = (id) => setSel(p => p.includes(id) ? p.filter(i=>i!==id) : [...p, id])

  return (
    <Modal open onClose={onClose} title={`มอบหมายแอดมิน — ${page.name}`}>
      <p className="text-sm text-gray-400 mb-1">
        เลือกแอดมินที่รับผิดชอบเพจนี้ (เลือกได้หลายคน)
      </p>
      <div className="flex items-center gap-2 mb-4">
        <span className={page.type==='main'?'badge-blue':'badge-orange'}>
          {page.type==='main'?'เพจหลัก':'เพจทดสอบ'}
        </span>
        <span className="text-xs text-gray-500">{sel.length} คนที่เลือก</span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto mb-4">
        {admins.map(u => {
          const checked = sel.includes(u.id)
          return (
            <label key={u.id} onClick={()=>toggle(u.id)}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                checked
                  ?'bg-brand-500/10 border-brand-500/35'
                  :'bg-gray-800/40 border-gray-700/50 hover:border-gray-600'
              }`}>
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white`}>
                {(u.avatar||u.name||'?').slice(0,2)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{u.name}</div>
                <div className="text-xs text-gray-500">{ROLES[u.role]}</div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                checked?'bg-brand-500 border-brand-500':'border-gray-600'}`}>
                {checked && <Check size={12} className="text-white"/>}
              </div>
            </label>
          )
        })}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-800">
        <button className="btn btn-ghost btn-sm" onClick={()=>setSel([])}>ล้างทั้งหมด</button>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" disabled={saving}
            onClick={()=>onSave(page.id, sel)}>
            {saving?'กำลังบันทึก...':'บันทึก'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Bulk Assign: จัดเพจทั้งหมดให้แอดมินคนนึง ────────
function BulkAssignModal({ admin, pages, onClose, editPage }) {
  const [saving, setSaving] = useState(false)
  // เพจที่แอดมินคนนี้รับอยู่แล้ว
  const [sel, setSel] = useState(
    pages.filter(p => p.assignedTo?.includes(admin.id)).map(p => p.id)
  )
  const toggle = (id) => setSel(p => p.includes(id) ? p.filter(i=>i!==id) : [...p, id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all(pages.map(p => {
        const was  = p.assignedTo || []
        const want = sel.includes(p.id)
        const nowIn = want && !was.includes(admin.id)
        const nowOut= !want && was.includes(admin.id)
        if (nowIn)  return editPage(p.id, { assignedTo: [...was, admin.id] })
        if (nowOut) return editPage(p.id, { assignedTo: was.filter(id=>id!==admin.id) })
        return null
      }).filter(Boolean))
      onClose()
    } catch(e) { console.error(e) } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={`จัดเพจให้ ${admin.name}`} size="lg">
      <p className="text-sm text-gray-400 mb-4">
        เลือกเพจที่ต้องการให้ <strong className="text-gray-200">{admin.name}</strong> รับผิดชอบ
      </p>
      <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto mb-4">
        {pages.map(p => {
          const checked = sel.includes(p.id)
          return (
            <label key={p.id} onClick={()=>toggle(p.id)}
              className={`flex items-center gap-2.5 p-3 rounded-xl cursor-pointer border transition-all ${
                checked
                  ?'bg-brand-500/10 border-brand-500/35'
                  :'bg-gray-800/40 border-gray-700/50 hover:border-gray-600'
              }`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                checked?'bg-brand-500 border-brand-500':'border-gray-600'}`}>
                {checked && <Check size={10} className="text-white"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{p.name}</div>
                <div className="flex gap-1 mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0 rounded border ${
                    p.type==='main'?'badge-blue':'badge-orange'}`}>
                    {p.type==='main'?'หลัก':'ทดสอบ'}
                  </span>
                </div>
              </div>
            </label>
          )
        })}
      </div>
      <div className="flex justify-between items-center pt-4 border-t border-gray-800">
        <span className="text-xs text-gray-500">{sel.length} เพจที่เลือก</span>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving?'กำลังบันทึก...':'บันทึก'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
