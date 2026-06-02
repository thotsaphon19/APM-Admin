import React, { useState, useEffect } from 'react'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { Modal, Confirm, Empty, Alert, Avatar, FormGroup, Select } from '../../components/ui'
import {
  Mail, Plus, Edit2, Trash2, Eye, EyeOff, Copy, Check,
  Lock, User, BookOpen, Star, TestTube, X,
} from 'lucide-react'

export default function Mailbox() {
  const { profile, canManage, isSuperAdmin } = useAuth()
  const { users, pages, getUserName, getPageName } = useData()

  const [mailboxes,  setMailboxes]  = useState([])
  const [modal,      setModal]      = useState(null)
  const [current,    setCurrent]    = useState(null)
  const [confirm,    setConfirm]    = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')
  const [showPw,     setShowPw]     = useState({})
  const [copied,     setCopied]     = useState({})
  const [filterUser, setFilterUser] = useState('')
  const [filterPage, setFilterPage] = useState('')

  const isAdmin = profile?.role === 'admin'

  // Real-time subscription
  useEffect(() => {
    const q = query(collection(db, 'mailboxes'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap =>
      setMailboxes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
  }, [])

  const BLANK = {
    email: '', password: '', label: '',
    assignedTo: isAdmin ? profile?.id : '',
    assignedPages: [],   // ← เพจที่ผูกกับเมลนี้
    note: '', status: 'active',
  }

  // Filter logic
  const myMailboxes = isAdmin
    ? mailboxes.filter(m => m.assignedTo === profile?.id)
    : mailboxes
        .filter(m => filterUser ? m.assignedTo === filterUser : true)
        .filter(m => filterPage ? (m.assignedPages || []).includes(filterPage) : true)

  const openAdd  = () => { setCurrent({ ...BLANK }); setModal('add');  setErr('') }
  const openEdit = (m) => { setCurrent({ ...m, assignedPages: m.assignedPages || [] }); setModal('edit'); setErr('') }
  const close    = () => { setModal(null); setCurrent(null); setErr('') }
  const set      = (k) => (e) => setCurrent(p => ({ ...p, [k]: e.target.value }))

  // Toggle page selection in form
  const togglePage = (pageId) => {
    setCurrent(p => {
      const list = p.assignedPages || []
      return {
        ...p,
        assignedPages: list.includes(pageId)
          ? list.filter(id => id !== pageId)
          : [...list, pageId],
      }
    })
  }

  const handleSave = async () => {
    if (!current.email || !current.password) { setErr('กรุณากรอกอีเมลและรหัสผ่าน'); return }
    setSaving(true); setErr('')
    try {
      const data = {
        ...current,
        assignedPages: current.assignedPages || [],
        updatedAt: serverTimestamp(),
      }
      if (modal === 'edit') {
        await updateDoc(doc(db, 'mailboxes', current.id), data)
      } else {
        await addDoc(collection(db, 'mailboxes'), {
          ...data,
          createdAt: serverTimestamp(),
          createdBy: profile?.id,
        })
      }
      close()
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const handleDelete = async (id) => deleteDoc(doc(db, 'mailboxes', id))

  const handleRegister = async () => {
    await addDoc(collection(db, 'mailboxes'), {
      email: '', password: '', label: 'เมลงานของฉัน',
      assignedTo: profile?.id, assignedPages: [],
      status: 'pending', note: '',
      createdAt: serverTimestamp(), createdBy: profile?.id,
    })
  }

  const toggleShowPw = (id) => setShowPw(p => ({ ...p, [id]: !p[id] }))

  const copyText = (key, text) => {
    navigator.clipboard.writeText(text)
    setCopied(p => ({ ...p, [key]: true }))
    setTimeout(() => setCopied(p => ({ ...p, [key]: false })), 2000)
  }

  const admins = users.filter(u => ['admin','head_admin'].includes(u.role))

  // Pages available: admin sees only their pages
  const availablePages = isAdmin
    ? pages.filter(p => p.assignedTo?.includes(profile?.id))
    : pages

  // Stats
  const stats = {
    total:   mailboxes.length,
    active:  mailboxes.filter(m => m.status === 'active').length,
    pending: mailboxes.filter(m => m.status === 'pending').length,
    mine:    mailboxes.filter(m => m.assignedTo === profile?.id).length,
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 3 }}>ระบบรับเมลงาน</h2>
          <p style={{ fontSize: 12.5, color:'var(--c-text2)' }}>
            จัดการอีเมล รหัสผ่าน และเพจที่ผูกกับแต่ละเมล
          </p>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          {isAdmin && (
            <button className="btn btn-ghost" onClick={handleRegister}>
              <Plus size={15}/> ลงทะเบียนรับเมล
            </button>
          )}
          {canManage && (
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={15}/> เพิ่มเมล
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-4" style={{ gap: 12 }}>
        {[
          { label: isAdmin?'เมลของฉัน':'เมลทั้งหมด', val: isAdmin?stats.mine:stats.total, icon:'📬', color:'var(--c-primary)' },
          { label:'ใช้งานอยู่',      val: stats.active,  icon:'✅', color:'var(--c-green)'  },
          { label:'รอกำหนดข้อมูล',  val: stats.pending, icon:'⏳', color:'var(--c-amber)'  },
          { label:'แอดมินทั้งหมด',  val: admins.length, icon:'👥', color:'var(--c-teal)'   },
        ].map((s,i) => (
          <div key={i} className="card" style={{ textAlign:'center', padding:'16px 12px' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11.5, color:'var(--c-text3)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters (head/superadmin) */}
      {!isAdmin && (
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap: 12, alignItems:'end' }}>
            <div>
              <label className="label">กรองตามแอดมิน</label>
              <select className="input" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                <option value="">ทั้งหมด</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({ROLES[u.role]})</option>)}
              </select>
            </div>
            <div>
              <label className="label">กรองตามเพจ</label>
              <select className="input" value={filterPage} onChange={e => setFilterPage(e.target.value)}>
                <option value="">ทั้งหมด</option>
                {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button className="btn btn-ghost btn-sm"
              onClick={() => { setFilterUser(''); setFilterPage('') }}>
              รีเซ็ต
            </button>
          </div>
        </div>
      )}

      {/* Mailbox grid */}
      {myMailboxes.length === 0 ? (
        <div className="card"><Empty icon={Mail} title="ยังไม่มีเมลงาน"
          sub={isAdmin ? 'กด "ลงทะเบียนรับเมล" เพื่อแจ้งความประสงค์' : 'กด "เพิ่มเมล" เพื่อเพิ่มอีเมล'}/>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {myMailboxes.map(m => (
            <MailCard key={m.id} mailbox={m}
              canManage={canManage} isSuperAdmin={isSuperAdmin}
              isOwner={m.assignedTo === profile?.id}
              showPw={showPw[m.id]}
              copiedKey={(field) => copied[`${m.id}-${field}`]}
              onTogglePw={() => toggleShowPw(m.id)}
              onCopy={(field, val) => copyText(`${m.id}-${field}`, val)}
              onEdit={() => openEdit(m)}
              onDelete={() => setConfirm({ id: m.id, email: m.email || m.label })}
              getUserName={getUserName}
              getPageName={getPageName}
              pages={pages}
            />
          ))}
        </div>
      )}

      {/* Modal Add/Edit */}
      {modal && (
        <MailModal
          modal={modal} current={current}
          onClose={close} onSave={handleSave}
          set={set} togglePage={togglePage}
          admins={admins} availablePages={availablePages}
          isAdmin={isAdmin} saving={saving} err={err}
          pages={pages}
        />
      )}

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} danger
        title="ลบเมลนี้?"
        message={`ลบ ${confirm?.email || 'เมลนี้'} ออกจากระบบ`}
        onConfirm={() => handleDelete(confirm.id)}/>
    </div>
  )
}

/* ── Mail Card ─────────────────────────────────────────── */
function MailCard({
  mailbox: m, canManage, isSuperAdmin, isOwner,
  showPw, copiedKey, onTogglePw, onCopy, onEdit, onDelete,
  getUserName, getPageName, pages,
}) {
  const STATUS = {
    active:  { label:'ใช้งาน',         cls:'badge-green'  },
    inactive:{ label:'ปิด',            cls:'badge-gray'   },
    pending: { label:'รอกำหนดข้อมูล', cls:'badge-orange' },
  }
  const st = STATUS[m.status] || STATUS.pending
  const canSeePassword = isSuperAdmin || canManage || isOwner
  const assignedPageObjs = (m.assignedPages || [])
    .map(id => pages.find(p => p.id === id))
    .filter(Boolean)

  return (
    <div className="card" style={{
      borderTop: `3px solid ${
        m.status==='active' ? 'var(--c-primary)' :
        m.status==='pending'? 'var(--c-amber)'  : 'var(--c-border2)'
      }`,
      display:'flex', flexDirection:'column', gap: 0,
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom: 12 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background:'linear-gradient(135deg, rgba(99,102,241,.2), rgba(139,92,246,.2))',
            border:'1px solid rgba(99,102,241,.3)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Mail size={17} style={{ color:'var(--c-primary)' }}/>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{m.label || 'เมลงาน'}</div>
            <span className={`badge ${st.cls}`} style={{ fontSize: 11 }}>{st.label}</span>
          </div>
        </div>
        {(canManage || isOwner) && (
          <div style={{ display:'flex', gap: 4 }}>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit}><Edit2 size={13}/></button>
            {(isSuperAdmin || canManage) && (
              <button className="btn btn-danger btn-icon btn-sm" onClick={onDelete}><Trash2 size={13}/></button>
            )}
          </div>
        )}
      </div>

      {/* Assigned to */}
      <div style={{ display:'flex', alignItems:'center', gap: 6, marginBottom: 10, fontSize: 12.5, color:'var(--c-text2)' }}>
        <User size={12}/>
        <span>รับผิดชอบโดย: <strong style={{ color:'var(--c-text1)' }}>{getUserName(m.assignedTo) || 'ยังไม่มอบหมาย'}</strong></span>
      </div>

      {/* Assigned pages */}
      {assignedPageObjs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color:'var(--c-text3)', marginBottom: 5, textTransform:'uppercase', letterSpacing:'.05em', fontWeight: 700 }}>
            เพจที่รับผิดชอบ
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap: 5 }}>
            {assignedPageObjs.map(p => (
              <span key={p.id} className={`badge ${p.type==='main'?'badge-blue':'badge-orange'}`}
                style={{ fontSize: 11, display:'flex', alignItems:'center', gap: 4 }}>
                {p.type==='main' ? <Star size={9}/> : <TestTube size={9}/>}
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Email field */}
      <div style={{
        background:'var(--c-elevated)', borderRadius: 8, border:'1px solid var(--c-border)',
        padding:'10px 12px', marginBottom: 8,
      }}>
        <div style={{ fontSize: 11, color:'var(--c-text3)', marginBottom: 4, fontWeight: 600 }}>อีเมล</div>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <span style={{ flex:1, fontSize: 13.5, fontFamily:'monospace', color:'var(--c-text1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {m.email || <span style={{ color:'var(--c-text3)', fontStyle:'italic' }}>ยังไม่กำหนด</span>}
          </span>
          {m.email && (
            <button onClick={() => onCopy('email', m.email)} className="btn btn-ghost btn-icon btn-sm" style={{ flexShrink:0 }}>
              {copiedKey('email') ? <Check size={12} style={{ color:'var(--c-green)' }}/> : <Copy size={12}/>}
            </button>
          )}
        </div>
      </div>

      {/* Password field */}
      <div style={{
        background:'var(--c-elevated)', borderRadius: 8, border:'1px solid var(--c-border)',
        padding:'10px 12px',
      }}>
        <div style={{ fontSize: 11, color:'var(--c-text3)', marginBottom: 4, fontWeight: 600, display:'flex', alignItems:'center', gap: 4 }}>
          <Lock size={10}/> รหัสผ่าน
        </div>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <span style={{ flex:1, fontSize: 13.5, fontFamily:'monospace', color:'var(--c-text1)' }}>
            {canSeePassword && m.password
              ? (showPw ? m.password : '••••••••••••')
              : <span style={{ color:'var(--c-text3)', fontStyle:'italic' }}>{m.password?'ไม่มีสิทธิ์ดู':'ยังไม่กำหนด'}</span>
            }
          </span>
          {canSeePassword && m.password && (
            <div style={{ display:'flex', gap: 4, flexShrink:0 }}>
              <button onClick={onTogglePw} className="btn btn-ghost btn-icon btn-sm">
                {showPw ? <EyeOff size={12}/> : <Eye size={12}/>}
              </button>
              <button onClick={() => onCopy('pw', m.password)} className="btn btn-ghost btn-icon btn-sm">
                {copiedKey('pw') ? <Check size={12} style={{ color:'var(--c-green)' }}/> : <Copy size={12}/>}
              </button>
            </div>
          )}
        </div>
      </div>

      {m.note && (
        <div style={{ marginTop: 10, fontSize: 12, color:'var(--c-text3)', display:'flex', gap: 6 }}>
          <span>📝</span><span>{m.note}</span>
        </div>
      )}
    </div>
  )
}

/* ── Mail Modal ────────────────────────────────────────── */
function MailModal({
  modal, current, onClose, onSave, set, togglePage,
  admins, availablePages, isAdmin, saving, err, pages,
}) {
  if (!current) return null

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">
            {modal==='edit' ? 'แก้ไขข้อมูลเมล' : 'เพิ่มเมลงาน'}
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={15}/></button>
        </div>

        {err && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            {err}
          </div>
        )}

        {/* Basic info */}
        <div className="form-group">
          <label className="label">ชื่อเมล / ป้ายกำกับ</label>
          <input className="input" placeholder="เช่น เมลหลัก, เมลเพจ A"
            value={current.label || ''} onChange={set('label')} autoFocus/>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="label">อีเมล <span style={{ color:'var(--c-red)' }}>*</span></label>
            <input type="email" className="input" placeholder="work@example.com"
              value={current.email || ''} onChange={set('email')}/>
          </div>
          <div className="form-group">
            <label className="label">รหัสผ่าน <span style={{ color:'var(--c-red)' }}>*</span></label>
            <input type="text" className="input" placeholder="รหัสผ่านอีเมล"
              value={current.password || ''} onChange={set('password')}/>
          </div>
        </div>

        {/* Assign to admin */}
        {!isAdmin && (
          <div className="form-group">
            <label className="label">มอบหมายให้แอดมิน</label>
            <select className="input" value={current.assignedTo || ''} onChange={set('assignedTo')}>
              <option value="">-- เลือกแอดมิน --</option>
              {admins.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({ROLES[u.role]})</option>
              ))}
            </select>
          </div>
        )}

        {/* Assign pages */}
        <div className="form-group">
          <label className="label" style={{ display:'flex', alignItems:'center', gap: 6 }}>
            <BookOpen size={12}/> เพจที่รับผิดชอบด้วยเมลนี้
            <span style={{ color:'var(--c-text3)', fontWeight:400, textTransform:'none', fontSize:11, marginLeft:4 }}>
              (เลือกได้หลายเพจ)
            </span>
          </label>
          {availablePages.length === 0 ? (
            <div style={{ padding:'12px', color:'var(--c-text3)', fontSize:13, background:'var(--c-elevated)', borderRadius:8, border:'1px solid var(--c-border)' }}>
              ยังไม่มีเพจในระบบ
            </div>
          ) : (
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 8, maxHeight: 260, overflowY:'auto',
              background:'var(--c-elevated)', border:'1px solid var(--c-border)',
              borderRadius: 10, padding: 10,
            }}>
              {availablePages.map(p => {
                const selected = (current.assignedPages || []).includes(p.id)
                return (
                  <label key={p.id} onClick={() => togglePage(p.id)}
                    style={{
                      display:'flex', alignItems:'center', gap: 10,
                      padding:'9px 12px', borderRadius: 8, cursor:'pointer',
                      border:`1px solid ${selected ? 'rgba(99,102,241,.4)' : 'var(--c-border)'}`,
                      background: selected ? 'rgba(99,102,241,.12)' : 'transparent',
                      transition:'all .15s',
                    }}>
                    {/* Checkbox */}
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      border: `2px solid ${selected ? 'var(--c-primary)' : 'var(--c-border2)'}`,
                      background: selected ? 'var(--c-primary)' : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all .15s',
                    }}>
                      {selected && <Check size={11} style={{ color:'#fff' }}/>}
                    </div>
                    {/* Page icon */}
                    <div style={{
                      width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                      background: p.type==='main' ? 'rgba(99,102,241,.15)' : 'rgba(245,158,11,.15)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      {p.type==='main'
                        ? <Star size={12} style={{ color:'var(--c-primary)' }}/>
                        : <TestTube size={12} style={{ color:'var(--c-amber)' }}/>
                      }
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize:11, color:'var(--c-text3)' }}>
                        {p.type==='main' ? 'เพจหลัก' : 'เพจทดสอบ'} · {p.status==='active'?'ใช้งาน':'ปิด'}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
          {/* Selected summary */}
          {(current.assignedPages || []).length > 0 && (
            <div style={{ marginTop: 8, display:'flex', flexWrap:'wrap', gap: 5 }}>
              {(current.assignedPages || []).map(id => {
                const p = pages.find(p => p.id === id)
                return p ? (
                  <span key={id} className={`badge ${p.type==='main'?'badge-blue':'badge-orange'}`}
                    style={{ fontSize:11, cursor:'pointer' }}
                    onClick={() => togglePage(id)}>
                    {p.name} <X size={9} style={{ marginLeft:2 }}/>
                  </span>
                ) : null
              })}
            </div>
          )}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="label">สถานะ</label>
            <select className="input" value={current.status || 'active'} onChange={set('status')}>
              <option value="active">✅ ใช้งาน</option>
              <option value="inactive">⏸ ปิด</option>
              <option value="pending">⏳ รอกำหนด</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="label">หมายเหตุ</label>
          <textarea className="input" rows={2} placeholder="หมายเหตุเพิ่มเติม..."
            value={current.note || ''} onChange={set('note')}/>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : modal==='edit' ? 'บันทึกการแก้ไข' : 'เพิ่มเมล'}
          </button>
        </div>
      </div>
    </div>
  )
}
