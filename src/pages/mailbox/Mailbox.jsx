import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useNotify } from '../../hooks/useNotify'
import { Mail, Plus, Eye, EyeOff, Copy, Check, Lock, Trash2, X, ShieldCheck, AlertTriangle, Clock, CheckCircle } from 'lucide-react'

export default function Mailbox() {
  const { profile, canManage, isSuperAdmin } = useAuth()
  const { users, pages } = useData()
  const { notifyMailbox } = useNotify()

  const [mailboxes, setMailboxes] = useState([])
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')
  const [showPw,    setShowPw]    = useState({})      // { id: bool }
  const [copied,    setCopied]    = useState({})      // { id_field: bool }
  const [confirm,   setConfirm]   = useState(null)   // id to delete

  const isAdmin = profile?.role === 'admin'
  const myUid   = profile?.id || ''

  // ── ตรวจสอบว่า admin คนนี้ลงทะเบียนแล้วหรือยัง ────
  // (status === 'pending' OR 'active' นับว่ามีแล้ว)
  const myRegistration = mailboxes.find(
    m => m.assignedTo === myUid && ['pending','active'].includes(m.status)
  )
  const hasRegistered = !!myRegistration

  // ── Blank form for new mailbox ──────────────────────
  const makeBlank = () => ({
    label:        '',
    email:        '',
    password:     '',
    assignedTo:   isAdmin ? myUid : '',
    assignedPages:[],
    note:         '',
    status:       'pending',  // pending = รอกรอกอีเมล
    emailLocked:  false,      // true = ล็อคแล้วแก้ไม่ได้
  })
  const [form, setForm] = useState(makeBlank)
  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const setFPages = (pageId) => setForm(p => ({
    ...p,
    assignedPages: p.assignedPages.includes(pageId)
      ? p.assignedPages.filter(id => id !== pageId)
      : [...p.assignedPages, pageId],
  }))

  // ── Realtime subscription ─────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'mailboxes'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap =>
      setMailboxes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
  }, [])

  // ── Filter: admin sees only their own ─────────────
  const visible = isAdmin
    ? mailboxes.filter(m => m.assignedTo === myUid)
    : mailboxes

  // ── Stats ─────────────────────────────────────────
  const stats = {
    total:   visible.length,
    active:  visible.filter(m => m.status === 'active').length,
    pending: visible.filter(m => m.status === 'pending').length,
    admins:  [...new Set(visible.map(m => m.assignedTo))].length,
  }

  // ── Save new mailbox (เปิดทะเบียน) ───────────────
  const handleCreate = async () => {
    if (!form.label.trim()) { setErr('กรุณากรอกชื่อเมลงาน'); return }
    if (!form.assignedTo)   { setErr('กรุณาเลือกแอดมินที่รับผิดชอบ'); return }

    // ── ตรวจสอบซ้ำ: แอดมินคนนี้มีเมลอยู่แล้วหรือยัง ──
    const targetUid = form.assignedTo
    const already   = mailboxes.find(
      m => m.assignedTo === targetUid && ['pending','active'].includes(m.status)
    )
    if (already) {
      const name = users.find(u=>u.id===targetUid)?.name || 'แอดมินคนนี้'
      setErr(
        already.status === 'active'
          ? `❌ ${name} มีเมลงานที่ใช้งานอยู่แล้ว (${already.label}) — ลงทะเบียนได้เพียง 1 เมลต่อคน`
          : `⏳ ${name} มีเมลงานที่รอกรอกข้อมูลอยู่แล้ว (${already.label}) — กรุณากรอกข้อมูลเมลเดิมก่อน`
      )
      setSaving(false)
      return
    }

    setSaving(true); setErr('')
    try {
      await addDoc(collection(db, 'mailboxes'), {
        ...form,
        email:       '',
        password:    '',
        emailLocked: false,
        status:      'pending',
        createdBy:   myUid,
        createdAt:   serverTimestamp(),
      })
      notifyMailbox('add', form.label)
      setShowForm(false); setForm(makeBlank())
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  // ── Submit email+password (ครั้งเดียว) ────────────
  const [fillId,    setFillId]   = useState(null)   // mailbox ที่กำลังกรอก
  const [fillEmail, setFillEmail]= useState('')
  const [fillPw,    setFillPw]   = useState('')
  const [fillErr,   setFillErr]  = useState('')
  const [fillSaving,setFillSaving]=useState(false)
  const [showFillPw,setShowFillPw]=useState(false)

  const openFill = (m) => {
    // เฉพาะแอดมินที่ assigned หรือ head/superadmin
    if (isAdmin && m.assignedTo !== myUid) return
    setFillId(m.id); setFillEmail(''); setFillPw(''); setFillErr(''); setShowFillPw(false)
  }

  const handleFill = async () => {
    if (!fillEmail.trim()) { setFillErr('กรุณากรอกอีเมล'); return }
    if (!fillPw.trim())    { setFillErr('กรุณากรอกรหัสผ่าน'); return }
    setFillSaving(true); setFillErr('')
    try {
      const mb = mailboxes.find(m=>m.id===fillId)
      await updateDoc(doc(db, 'mailboxes', fillId), {
        email:       fillEmail.trim(),
        password:    fillPw.trim(),
        emailLocked: true,
        status:      'active',
        filledBy:    myUid,
        filledAt:    serverTimestamp(),
      })
      // แจ้งแอดมินเจ้าของเมลว่าได้รับเมลแล้ว + แจ้ง head/super ด้วย
      notifyMailbox('fill', mb?.label||fillId, mb?.assignedTo)
      setFillId(null)
    } catch(e) { setFillErr(e.message) } finally { setFillSaving(false) }
  }

  // ── Copy to clipboard ─────────────────────────────
  const copyText = (id, field, text) => {
    navigator.clipboard.writeText(text || '')
    setCopied({ [id+'_'+field]: true })
    setTimeout(() => setCopied({}), 1800)
  }

  // ── Delete ────────────────────────────────────────
  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'mailboxes', id))
    setConfirm(null)
  }

  // ── Helpers ───────────────────────────────────────
  const getUserName = (uid) => users.find(u=>u.id===uid)?.name || uid
  const getPageName = (id)  => pages.find(p=>p.id===id)?.name  || id

  const S = { width:'100%', background:'#fff', border:'1.5px solid #dde3f5', borderRadius:10, color:'#1e1b4b', fontFamily:'inherit', fontSize:14, padding:'9px 12px', outline:'none' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:900, color:'#1e1b4b', marginBottom:3 }}>📬 รับเมลงาน</h2>
          <p style={{ fontSize:12.5, color:'#6b7280' }}>
            ลงทะเบียนอีเมล+รหัสผ่าน <strong style={{ color:'#be123c' }}>ครั้งเดียวต่อคน</strong> — เมื่อกรอกแล้วล็อคถาวร
          </p>
        </div>
        {/* ปุ่มสำหรับ head/superadmin เท่านั้น */}
        {canManage && !isAdmin && (
          <button onClick={()=>{ setShowForm(true); setForm(makeBlank()) }}
            style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:12, padding:'10px 20px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:7, boxShadow:'0 4px 14px rgba(99,102,241,.3)' }}>
            <Plus size={15}/> + ลงทะเบียนรับเมล
          </button>
        )}
      </div>

      {/* ── RegisterBanner สำหรับ admin ── */}
      {isAdmin && <RegisterBanner
        hasRegistered={hasRegistered}
        registration={myRegistration}
        onRegister={() => { setShowForm(true); setForm({ ...makeBlank(), assignedTo: myUid }) }}
        onFill={myRegistration && !myRegistration.emailLocked ? () => openFill(myRegistration) : null}
      />}

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
        {[
          { e:'📬', l:'เมลของฉัน',    v:stats.total,   bg:'linear-gradient(135deg,#eef2ff,#e0e7ff)', c:'#4338ca', b:'#c7d2fe' },
          { e:'✅', l:'ใช้งานอยู่',   v:stats.active,  bg:'linear-gradient(135deg,#f0fdf4,#dcfce7)', c:'#059669', b:'#bbf7d0' },
          { e:'⏳', l:'รอกำหนดข้อมูล',v:stats.pending, bg:'linear-gradient(135deg,#fffbeb,#fef3c7)', c:'#b45309', b:'#fde68a' },
          { e:'👥', l:'แอดมินทั้งหมด', v:stats.admins,  bg:'linear-gradient(135deg,#f5f3ff,#ede9fe)', c:'#7c3aed', b:'#ddd6fe' },
        ].map((k,i)=>(
          <div key={i} style={{ background:k.bg, border:`1.5px solid ${k.b}`, borderRadius:14, padding:'16px 18px' }}>
            <div style={{ fontSize:26, marginBottom:8 }}>{k.e}</div>
            <div style={{ fontSize:24, fontWeight:900, color:k.c }}>{k.v}</div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:5, fontWeight:600 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* ── Create form (inline) ── */}
      {showForm && isAdmin && hasRegistered && (
        /* Admin พยายามเปิดฟอร์มซ้ำ — บล็อคทันที */
        <div style={{ background:'#fff1f2', border:'2px solid #fca5a5', borderRadius:16, padding:'18px 22px', display:'flex', alignItems:'center', gap:14 }}>
          <AlertTriangle size={22} style={{ color:'#be123c', flexShrink:0 }}/>
          <div>
            <div style={{ fontSize:15, fontWeight:900, color:'#be123c', marginBottom:4 }}>ไม่สามารถลงทะเบียนซ้ำได้</div>
            <div style={{ fontSize:13, color:'#9f1239' }}>
              คุณมีเมลงาน <strong>"{myRegistration?.label}"</strong> อยู่แล้ว — ระบบอนุญาตเพียง 1 เมลต่อแอดมิน 1 คน
            </div>
          </div>
          <button onClick={()=>setShowForm(false)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#be123c', flexShrink:0 }}><X size={18}/></button>
        </div>
      )}
      {showForm && !(isAdmin && hasRegistered) && (
        <div style={{ background:'#fff', border:'2px solid #6366f1', borderRadius:20, padding:26, boxShadow:'0 8px 32px rgba(99,102,241,.12)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:44, height:44, borderRadius:14, background:'linear-gradient(135deg,#6366f1,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📬</div>
              <div>
                <div style={{ fontSize:17, fontWeight:900, color:'#1e1b4b' }}>ลงทะเบียนรับเมลใหม่</div>
                <div style={{ fontSize:12, color:'#9ca3af' }}>จะขออีเมล+รหัสผ่าน 1 ครั้งเดียว แล้วล็อคทันที</div>
              </div>
            </div>
            <button onClick={()=>setShowForm(false)} style={{ background:'#f1f5f9', border:'none', borderRadius:9, width:33, height:33, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}><X size={15}/></button>
          </div>
          {err && <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:10, padding:'10px 14px', color:'#be123c', fontSize:13.5, marginBottom:14 }}>❌ {err}</div>}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📬 ชื่อเมลงาน *</label>
              <input style={S} placeholder="เช่น เมลงานเพจขายออนไลน์1" value={form.label} onChange={setF('label')} autoFocus/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>👤 แอดมินที่รับผิดชอบ *</label>
              <select style={S} value={form.assignedTo} onChange={setF('assignedTo')} disabled={isAdmin}>
                <option value="">-- เลือกแอดมิน --</option>
                {users.filter(u=>['admin','head_admin'].includes(u.role)).map(u=>(
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* เพจที่ผูกกับเมลนี้ */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
              📄 เพจที่รับผิดชอบ (เลือกได้หลายเพจ)
            </label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {pages.filter(p=>p.status==='active').map(p=>{
                const sel = form.assignedPages.includes(p.id)
                return (
                  <button key={p.id} type="button" onClick={()=>setFPages(p.id)}
                    style={{ padding:'7px 14px', borderRadius:10, cursor:'pointer', border:`1.5px solid ${sel?'#6366f1':'#dde3f5'}`, background:sel?'linear-gradient(135deg,#eef2ff,#e0e7ff)':'#fff', fontFamily:'inherit', fontSize:13, fontWeight:sel?700:500, color:sel?'#4338ca':'#6b7280', transition:'all .15s', display:'flex', alignItems:'center', gap:5 }}>
                    {p.type==='main'?'⭐':'🧪'} {p.name}
                    {sel&&<span style={{ marginLeft:4, color:'#6366f1' }}>✓</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ marginBottom:18 }}>
            <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📝 หมายเหตุ</label>
            <input style={S} placeholder="หมายเหตุ..." value={form.note} onChange={setF('note')}/>
          </div>

          {/* Info box */}
          <div style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', border:'1.5px solid #fde68a', borderRadius:12, padding:'12px 16px', marginBottom:18, display:'flex', gap:10 }}>
            <span style={{ fontSize:18 }}>🔒</span>
            <div style={{ fontSize:13, color:'#92400e', lineHeight:1.7 }}>
              <strong>การทำงาน:</strong> สร้างรายการนี้ก่อน แล้วแอดมินที่รับผิดชอบจะเห็น card นี้<br/>
              กด <strong>"กรอกอีเมล+รหัสผ่าน"</strong> → กรอกครั้งเดียว → <strong>ระบบล็อคทันที ไม่สามารถแก้ไขได้อีก</strong>
            </div>
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={()=>setShowForm(false)} style={{ background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontSize:14, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>ยกเลิก</button>
            <button onClick={handleCreate} disabled={saving}
              style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:10, padding:'9px 24px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', opacity:saving?0.6:1 }}>
              {saving?'⏳ กำลังสร้าง...':'📬 สร้างรายการเมล'}
            </button>
          </div>
        </div>
      )}  {/* end !(isAdmin && hasRegistered) */}

      {/* ── Fill email modal ── */}
      {fillId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(99,102,241,.25)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:22, padding:30, maxWidth:440, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,.15)', border:'1.5px solid #e0e7ff' }}>

            {/* One-time warning */}
            <div style={{ background:'linear-gradient(135deg,#fff1f2,#ffe4e6)', border:'2px solid #fca5a5', borderRadius:14, padding:'14px 18px', marginBottom:22, textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🔒</div>
              <div style={{ fontSize:16, fontWeight:900, color:'#be123c', marginBottom:6 }}>กรอกได้ครั้งเดียวเท่านั้น!</div>
              <div style={{ fontSize:13, color:'#9f1239', lineHeight:1.7 }}>
                เมื่อกด <strong>"บันทึกและล็อค"</strong><br/>
                ระบบจะ<strong>ล็อคอีเมลและรหัสผ่านทันที</strong><br/>
                ไม่สามารถแก้ไขได้อีกเด็ดขาด
              </div>
            </div>

            <div style={{ fontSize:15, fontWeight:900, color:'#1e1b4b', marginBottom:16 }}>
              📬 {mailboxes.find(m=>m.id===fillId)?.label || 'เมลงาน'}
            </div>

            {fillErr && <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:9, padding:'9px 13px', color:'#be123c', fontSize:13, marginBottom:14 }}>❌ {fillErr}</div>}

            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📧 อีเมล *</label>
              <input type="email" style={S} placeholder="example@gmail.com"
                value={fillEmail} onChange={e=>setFillEmail(e.target.value)} autoFocus/>
            </div>
            <div style={{ marginBottom:22 }}>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>🔑 รหัสผ่าน *</label>
              <div style={{ position:'relative' }}>
                <input type={showFillPw?'text':'password'} style={{ ...S, paddingRight:44 }}
                  placeholder="รหัสผ่าน"
                  value={fillPw} onChange={e=>setFillPw(e.target.value)}/>
                <button type="button" onClick={()=>setShowFillPw(v=>!v)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:4 }}>
                  {showFillPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setFillId(null)}
                style={{ flex:1, background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:'11px 0', cursor:'pointer', fontSize:14, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>
                ยกเลิก
              </button>
              <button onClick={handleFill} disabled={fillSaving}
                style={{ flex:2, background:'linear-gradient(135deg,#e11d48,#f43f5e)', border:'none', borderRadius:10, padding:'11px 0', cursor:'pointer', fontSize:14, fontWeight:900, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:7, opacity:fillSaving?0.6:1, boxShadow:'0 4px 14px rgba(225,29,72,.35)' }}>
                <Lock size={15}/> {fillSaving?'กำลังล็อค...':'🔒 บันทึกและล็อค'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mailbox cards ── */}
      {visible.length === 0 ? (
        <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:40, textAlign:'center', color:'#9ca3af' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#6b7280', marginBottom:6 }}>ยังไม่มีเมลงาน</div>
          <div style={{ fontSize:13, marginBottom:20 }}>{canManage?'กด "+ ลงทะเบียนรับเมล" เพื่อเริ่มต้น':'รอหัวหน้าสร้างรายการให้'}</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
          {visible.map(m => {
            const locked  = m.emailLocked
            const pending = m.status === 'pending'
            const isOwner = m.assignedTo === myUid
            const canFill = !locked && (isOwner || !isAdmin)

            return (
              <div key={m.id} style={{
                background:'#fff',
                border:`1.5px solid ${locked?'#e0e7ff':pending?'#fde68a':'#e0e7ff'}`,
                borderTop:`4px solid ${locked?'#6366f1':pending?'#f59e0b':'#d1d5db'}`,
                borderRadius:18,
                padding:22,
                boxShadow:'0 2px 12px rgba(0,0,0,.05)',
                display:'flex', flexDirection:'column', gap:14,
              }}>

                {/* Card header */}
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:44, height:44, borderRadius:14, background: locked?'linear-gradient(135deg,#6366f1,#7c3aed)':'linear-gradient(135deg,#f59e0b,#fbbf24)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                      {locked ? '📬' : '📭'}
                    </div>
                    <div>
                      <div style={{ fontSize:16, fontWeight:900, color:'#1e1b4b' }}>{m.label}</div>
                      {/* Status badge */}
                      {locked ? (
                        <span style={{ background:'#f0fdf4', color:'#059669', border:'1.5px solid #bbf7d0', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700, display:'inline-flex', alignItems:'center', gap:4 }}>
                          <ShieldCheck size={11}/> ล็อคแล้ว
                        </span>
                      ) : (
                        <span style={{ background:'#fffbeb', color:'#b45309', border:'1.5px solid #fde68a', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
                          ⏳ รอกำหนดข้อมูล
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{ display:'flex', gap:6 }}>
                    {isSuperAdmin && (
                      <button onClick={()=>setConfirm(m.id)}
                        style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:8, width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#be123c' }}>
                        <Trash2 size={13}/>
                      </button>
                    )}
                  </div>
                </div>

                {/* Owner */}
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>
                    {getUserName(m.assignedTo).slice(0,2)}
                  </div>
                  <span style={{ fontSize:13, color:'#4b5563' }}>รับผิดชอบโดย: <strong style={{ color:'#1e1b4b' }}>{getUserName(m.assignedTo)}</strong></span>
                </div>

                {/* Pages */}
                {m.assignedPages?.length > 0 && (
                  <div>
                    <div style={{ fontSize:12, color:'#9ca3af', fontWeight:700, marginBottom:6 }}>เพจที่รับผิดชอบ</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {m.assignedPages.map(pid=>(
                        <span key={pid} style={{ background:'#eef2ff', color:'#4338ca', border:'1.5px solid #c7d2fe', borderRadius:99, padding:'3px 10px', fontSize:12.5, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                          {pages.find(p=>p.id===pid)?.type==='main'?'⭐':'🧪'} {pages.find(p=>p.id===pid)?.name||pid}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ borderTop:'1.5px solid #f0f4ff', paddingTop:14 }}>

                  {/* Email row */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:12, color:'#9ca3af', fontWeight:700, marginBottom:5, display:'flex', alignItems:'center', gap:5 }}>
                      📧 อีเมล {locked && <Lock size={10} style={{ color:'#6366f1' }}/>}
                    </div>
                    {locked && m.email ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f8f9ff', border:'1px solid #e0e7ff', borderRadius:9, padding:'9px 12px' }}>
                        <span style={{ flex:1, fontFamily:'monospace', fontSize:14, color:'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.email}</span>
                        <button onClick={()=>copyText(m.id,'email',m.email)}
                          style={{ background:'none', border:'none', cursor:'pointer', color: copied[m.id+'_email']?'#059669':'#9ca3af', padding:3 }}>
                          {copied[m.id+'_email']?<Check size={14}/>:<Copy size={14}/>}
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontStyle:'italic', color:'#d1d5db', fontSize:13 }}>ยังไม่กำหนด</div>
                    )}
                  </div>

                  {/* Password row */}
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:12, color:'#9ca3af', fontWeight:700, marginBottom:5, display:'flex', alignItems:'center', gap:5 }}>
                      🔑 รหัสผ่าน {locked && <Lock size={10} style={{ color:'#6366f1' }}/>}
                    </div>
                    {locked && m.password ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f8f9ff', border:'1px solid #e0e7ff', borderRadius:9, padding:'9px 12px' }}>
                        <span style={{ flex:1, fontFamily:'monospace', fontSize:14, color:'#1e1b4b', letterSpacing: showPw[m.id]?0:'.2em' }}>
                          {showPw[m.id] ? m.password : '••••••••••••'}
                        </span>
                        <button onClick={()=>setShowPw(p=>({...p,[m.id]:!p[m.id]}))}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:3 }}>
                          {showPw[m.id]?<EyeOff size={14}/>:<Eye size={14}/>}
                        </button>
                        <button onClick={()=>copyText(m.id,'pw',m.password)}
                          style={{ background:'none', border:'none', cursor:'pointer', color: copied[m.id+'_pw']?'#059669':'#9ca3af', padding:3 }}>
                          {copied[m.id+'_pw']?<Check size={14}/>:<Copy size={14}/>}
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontStyle:'italic', color:'#d1d5db', fontSize:13 }}>ยังไม่กำหนด</div>
                    )}
                  </div>

                  {/* Fill button OR locked badge */}
                  {!locked ? (
                    canFill ? (
                      <button onClick={()=>openFill(m)}
                        style={{ width:'100%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:12, padding:'12px 0', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 14px rgba(99,102,241,.3)' }}>
                        <Mail size={15}/> ✍️ กรอกอีเมล + รหัสผ่าน (ครั้งเดียว)
                      </button>
                    ) : (
                      <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#92400e', textAlign:'center' }}>
                        ⏳ รอแอดมินที่รับผิดชอบกรอกข้อมูล
                      </div>
                    )
                  ) : (
                    <div style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'1.5px solid #bbf7d0', borderRadius:12, padding:'11px 14px', display:'flex', alignItems:'center', gap:10 }}>
                      <ShieldCheck size={16} style={{ color:'#059669', flexShrink:0 }}/>
                      <div>
                        <div style={{ fontSize:13, fontWeight:800, color:'#059669' }}>ล็อคเรียบร้อย</div>
                        <div style={{ fontSize:11.5, color:'#6b7280', marginTop:1 }}>
                          {m.filledAt ? `กรอกโดย ${getUserName(m.filledBy||'')}` : 'ไม่สามารถแก้ไขข้อมูลนี้ได้'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  {m.note && (
                    <div style={{ marginTop:10, fontSize:12.5, color:'#9ca3af', borderTop:'1px solid #f0f4ff', paddingTop:10 }}>
                      📝 {m.note}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── RegisterBanner (admin only) ── */}

      {/* Delete confirm */}
      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(99,102,241,.2)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:20, padding:28, maxWidth:360, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,.15)', border:'1.5px solid #e0e7ff' }}>
            <div style={{ fontSize:40, textAlign:'center', marginBottom:12 }}>🗑️</div>
            <div style={{ fontSize:17, fontWeight:900, textAlign:'center', marginBottom:6 }}>ลบเมลงานนี้?</div>
            <div style={{ fontSize:13, color:'#6b7280', textAlign:'center', marginBottom:20 }}>ข้อมูลอีเมล+รหัสผ่านจะหายถาวร</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setConfirm(null)} style={{ flex:1, background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:10, fontSize:14, fontWeight:700, color:'#6b7280', cursor:'pointer', fontFamily:'inherit' }}>ยกเลิก</button>
              <button onClick={()=>handleDelete(confirm)} style={{ flex:1, background:'linear-gradient(135deg,#e11d48,#f43f5e)', border:'none', borderRadius:10, padding:10, fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>🗑️ ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── RegisterBanner ────────────────────────────────────────
// แสดงสถานะการลงทะเบียนของแอดมินคนนั้น ๆ
function RegisterBanner({ hasRegistered, registration, onRegister, onFill }) {

  // ── ยังไม่ลงทะเบียน ──────────────────────────────
  if (!hasRegistered) {
    return (
      <div style={{
        background:'linear-gradient(135deg,#fafbff,#f0f4ff)',
        border:'2px dashed #c7d2fe',
        borderRadius:18,
        padding:'24px 28px',
        display:'flex', alignItems:'center', gap:20, flexWrap:'wrap',
      }}>
        <div style={{ fontSize:48 }}>📭</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:900, color:'#1e1b4b', marginBottom:6 }}>
            คุณยังไม่มีเมลงาน
          </div>
          <div style={{ fontSize:13.5, color:'#6b7280', lineHeight:1.7 }}>
            กด <strong>"ลงทะเบียนรับเมล"</strong> เพื่อขอรับอีเมล + รหัสผ่านจากผู้ดูแล<br/>
            <span style={{ color:'#be123c', fontWeight:700 }}>ลงทะเบียนได้เพียง 1 ครั้งเท่านั้น</span>
          </div>
        </div>
        <button onClick={onRegister}
          style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:12, padding:'12px 24px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 14px rgba(99,102,241,.3)', whiteSpace:'nowrap' }}>
          <Plus size={15}/> ลงทะเบียนรับเมล
        </button>
      </div>
    )
  }

  // ── ลงทะเบียนแล้ว รอกรอกข้อมูล (pending) ─────────
  if (registration?.status === 'pending') {
    return (
      <div style={{
        background:'linear-gradient(135deg,#fffbeb,#fef3c7)',
        border:'2px solid #fde68a',
        borderRadius:18,
        padding:'20px 24px',
        display:'flex', alignItems:'center', gap:16, flexWrap:'wrap',
      }}>
        <div style={{ width:52, height:52, borderRadius:16, background:'linear-gradient(135deg,#f59e0b,#fbbf24)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>
          ⏳
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
            <div style={{ fontSize:16, fontWeight:900, color:'#92400e' }}>
              ลงทะเบียนแล้ว — รอกรอกข้อมูล
            </div>
            <span style={{ background:'#fde68a', color:'#92400e', border:'1.5px solid #f59e0b', borderRadius:99, padding:'2px 9px', fontSize:11.5, fontWeight:800, display:'inline-flex', alignItems:'center', gap:4 }}>
              <Clock size={10}/> ล็อคสล็อตแล้ว
            </span>
          </div>
          <div style={{ fontSize:13, color:'#92400e', lineHeight:1.6 }}>
            เมลงาน <strong>"{registration.label}"</strong> ถูกสร้างแล้ว<br/>
            กด <strong>"กรอกอีเมล + รหัสผ่าน"</strong> เพื่อกรอกข้อมูล — ทำได้ครั้งเดียวเท่านั้น
          </div>
        </div>
        {onFill && (
          <button onClick={onFill}
            style={{ background:'linear-gradient(135deg,#d97706,#f59e0b)', border:'none', borderRadius:12, padding:'11px 22px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 12px rgba(217,119,6,.3)', whiteSpace:'nowrap' }}>
            <Mail size={14}/> ✍️ กรอกอีเมล + รหัสผ่าน
          </button>
        )}
      </div>
    )
  }

  // ── ได้รับและล็อคแล้ว (active + emailLocked) ──────
  return (
    <div style={{
      background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',
      border:'2px solid #86efac',
      borderRadius:18,
      padding:'20px 24px',
      display:'flex', alignItems:'center', gap:16, flexWrap:'wrap',
    }}>
      <div style={{ width:52, height:52, borderRadius:16, background:'linear-gradient(135deg,#059669,#10b981)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>
        ✅
      </div>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
          <div style={{ fontSize:16, fontWeight:900, color:'#065f46' }}>
            พร้อมใช้งาน
          </div>
          <span style={{ background:'#bbf7d0', color:'#065f46', border:'1.5px solid #6ee7b7', borderRadius:99, padding:'2px 9px', fontSize:11.5, fontWeight:800, display:'inline-flex', alignItems:'center', gap:4 }}>
            <Lock size={10}/> ล็อคแล้ว
          </span>
        </div>
        <div style={{ fontSize:13, color:'#047857', lineHeight:1.6 }}>
          เมลงาน <strong>"{registration?.label}"</strong> พร้อมใช้งาน<br/>
          <span style={{ color:'#6b7280', fontSize:12.5 }}>อีเมลและรหัสผ่านถูกล็อคถาวร — ดูข้อมูลได้ในการ์ดด้านล่าง</span>
        </div>
      </div>
      <div style={{ background:'#bbf7d0', border:'1.5px solid #6ee7b7', borderRadius:12, padding:'10px 18px', display:'flex', alignItems:'center', gap:8 }}>
        <CheckCircle size={18} style={{ color:'#059669' }}/>
        <span style={{ fontSize:14, fontWeight:800, color:'#065f46' }}>เมลงานของคุณพร้อมใช้</span>
      </div>
    </div>
  )
}