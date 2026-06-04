import React, { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { useNotify } from '../../hooks/useNotify'
import { Edit2, Trash2, ChevronDown, ChevronUp, Plus, X, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Scale } from 'lucide-react'

const today    = format(new Date(), 'yyyy-MM-dd')
const thisMonth = format(new Date(), 'yyyy-MM')

// ── เปรียบเทียบ 2 record ──────────────────────────────
function compareRecords(admin, audit) {
  if (!admin || !audit) return null
  const diffs = []
  const checks = [
    { key:'manualOrders', label:'ออเดอร์ตอบมือ', unit:'บ้าน' },
    { key:'aiOrders',     label:'ออเดอร์ AI',     unit:'บ้าน' },
    { key:'cancelOrders', label:'ออเดอร์ยกเลิก',  unit:'บ้าน' },
    { key:'unclearOrders',label:'ไม่ชัดเจน',      unit:'บ้าน' },
    { key:'manualRate',   label:'ค่าคอมมือ/บ้าน', unit:'฿' },
    { key:'aiRate',       label:'ค่าคอม AI/บ้าน', unit:'฿' },
  ]
  checks.forEach(c => {
    const aVal = parseFloat(admin[c.key]) || 0
    const bVal = parseFloat(audit[c.key]) || 0
    if (aVal !== bVal) diffs.push({ ...c, adminVal: aVal, auditVal: bVal, diff: bVal - aVal })
  })
  return {
    match: diffs.length === 0,
    diffs,
    adminTotal: admin.total || 0,
    auditTotal: audit.total || 0,
    totalDiff:  (audit.total||0) - (admin.total||0),
  }
}

// ── Status badge ──────────────────────────────────────
function MatchBadge({ match, hasAudit, hasAdmin }) {
  if (!hasAudit)  return <span style={{ background:'#fef3c7', color:'#b45309', border:'1.5px solid #fde68a', borderRadius:99, padding:'3px 10px', fontSize:11.5, fontWeight:700 }}>⏳ รอหลังบ้านกรอก</span>
  if (!hasAdmin)  return <span style={{ background:'#fff7ed', color:'#c2410c', border:'1.5px solid #fed7aa', borderRadius:99, padding:'3px 10px', fontSize:11.5, fontWeight:700 }}>⚠️ ไม่มีข้อมูลแอดมิน</span>
  if (match)      return <span style={{ background:'#f0fdf4', color:'#059669', border:'1.5px solid #bbf7d0', borderRadius:99, padding:'3px 10px', fontSize:11.5, fontWeight:700 }}>✅ ตรงกัน</span>
  return <span style={{ background:'#fff1f2', color:'#be123c', border:'1.5px solid #fecdd3', borderRadius:99, padding:'3px 10px', fontSize:11.5, fontWeight:700 }}>❌ ไม่ตรง</span>
}

export default function AuditOrders() {
  const { profile, user, canAudit, isSuperAdmin } = useAuth()
  const { commissions, auditOrders, pages, users, commRates,
          createAuditOrder, editAuditOrder, removeAuditOrder,
          getUserName, getPageName } = useData()
  const { notifyCustom } = useNotify()

  const isAuditor  = profile?.role === 'auditor'
  const myUid      = user?.uid || profile?.id || ''

  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [confirm,  setConfirm]    = useState(null)
  const [saving,   setSaving]     = useState(false)
  const [err,      setErr]        = useState('')
  const [expandId, setExpandId]   = useState(null)
  const [viewMode, setViewMode]   = useState('compare') // 'compare' | 'audit'
  const [filters,  setFilters]    = useState({ date: today, month: '', adminId: '', pageId: '' })

  const makeBlank = () => ({
    date: today, adminId: '', pageId: '',
    manualOrders:'', manualRate: commRates.manualRate ?? 5,
    aiOrders:'',    aiRate: commRates.aiRate ?? 2,
    cancelOrders:'', unclearOrders:'', note:'',
  })
  const [form, setForm] = useState(makeBlank)
  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const admins  = users.filter(u => ['admin','head_admin'].includes(u.role))
  const myPages = isAuditor ? pages : pages

  // Filter commissions (แอดมิน)
  const filteredAdmin = useMemo(() => {
    let d = commissions
    if (filters.date && !filters.month) d = d.filter(c => c.date === filters.date)
    if (filters.month) d = d.filter(c => c.date?.startsWith(filters.month))
    if (filters.adminId) d = d.filter(c => c.adminId === filters.adminId)
    if (filters.pageId)  d = d.filter(c => c.pageId  === filters.pageId)
    return d
  }, [commissions, filters])

  // Filter auditOrders (หลังบ้าน)
  const filteredAudit = useMemo(() => {
    let d = auditOrders
    if (filters.date && !filters.month) d = d.filter(c => c.date === filters.date)
    if (filters.month) d = d.filter(c => c.date?.startsWith(filters.month))
    if (filters.adminId) d = d.filter(c => c.adminId === filters.adminId)
    if (filters.pageId)  d = d.filter(c => c.pageId  === filters.pageId)
    return d
  }, [auditOrders, filters])

  // Build comparison rows (join on adminId + pageId + date)
  const compareRows = useMemo(() => {
    const keys = new Set([
      ...filteredAdmin.map(c => `${c.adminId}|${c.pageId}|${c.date}`),
      ...filteredAudit.map(c => `${c.adminId}|${c.pageId}|${c.date}`),
    ])
    return [...keys].map(key => {
      const [adminId, pageId, date] = key.split('|')
      const admin = filteredAdmin.find(c => c.adminId===adminId && c.pageId===pageId && c.date===date)
      const audit = filteredAudit.find(c => c.adminId===adminId && c.pageId===pageId && c.date===date)
      const cmp   = compareRecords(admin, audit)
      return { key, adminId, pageId, date, admin, audit, cmp }
    }).sort((a,b) => b.date.localeCompare(a.date))
  }, [filteredAdmin, filteredAudit])

  // Stats
  const stats = useMemo(() => {
    const total   = compareRows.length
    const matched = compareRows.filter(r => r.cmp?.match).length
    const differ  = compareRows.filter(r => r.admin && r.audit && !r.cmp?.match).length
    const pending = compareRows.filter(r => !r.audit).length
    const noAdmin = compareRows.filter(r => !r.admin).length
    return { total, matched, differ, pending, noAdmin }
  }, [compareRows])

  // Manual + AI preview in form
  const manualPv = (parseFloat(form.manualOrders)||0) * (parseFloat(form.manualRate)||0)
  const aiPv     = (parseFloat(form.aiOrders)||0)     * (parseFloat(form.aiRate)||0)
  const grandPv  = manualPv + aiPv

  const openAdd = (prefill = {}) => {
    setForm({ ...makeBlank(), ...prefill })
    setEditItem(null); setErr(''); setShowForm(true)
    setTimeout(() => document.getElementById('audit-form-top')?.scrollIntoView({ behavior:'smooth' }), 100)
  }
  const openEdit = item => {
    setForm({ ...item }); setEditItem(item); setErr(''); setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.adminId || !form.pageId || !form.date) { setErr('กรุณากรอก วันที่ / แอดมิน / เพจ ให้ครบ'); return }
    setSaving(true); setErr('')
    try {
      const data = {
        ...form,
        manualOrders: parseInt(form.manualOrders)||0, manualRate: parseFloat(form.manualRate)||0,
        aiOrders:     parseInt(form.aiOrders)||0,     aiRate:     parseFloat(form.aiRate)||0,
        cancelOrders: parseInt(form.cancelOrders)||0, unclearOrders: parseInt(form.unclearOrders)||0,
        auditBy: myUid,
      }
      if (editItem) await editAuditOrder(editItem.id, data)
      else          await createAuditOrder(data)
      notifyCustom({
        type: 'verify',
        title: `🔍 ${editItem?'แก้ไข':'กรอก'}ข้อมูลหลังบ้าน`,
        message: `${profile?.name} กรอกข้อมูลตรวจสอบ ${getPageName(data.pageId)} · ${data.date}`,
        link: '/audit',
        targetRoles: ['superadmin','head_admin'],
      })
      setShowForm(false); setForm(makeBlank()); setEditItem(null)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const S = { width:'100%', background:'#fff', border:'1.5px solid #dde3f5', borderRadius:10, color:'#1e1b4b', fontFamily:'inherit', fontSize:14, padding:'9px 12px', outline:'none' }

  if (!canAudit) {
    return (
      <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:16, padding:24, display:'flex', gap:12 }}>
        <span style={{ fontSize:24 }}>🚫</span>
        <div>
          <div style={{ fontWeight:800, color:'#9a3412' }}>ไม่มีสิทธิ์เข้าถึง</div>
          <div style={{ fontSize:13, color:'#92400e', marginTop:4 }}>เฉพาะ ผู้ตรวจสอบหลังบ้าน, หัวหน้าแอดมิน, และผู้ดูแลสูงสุด</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:900, color:'#1e1b4b', marginBottom:3 }}>🔍 ตรวจสอบออเดอร์หลังบ้าน</h2>
          <p style={{ fontSize:12.5, color:'#6b7280' }}>
            กรอกข้อมูลจริงจากหลังบ้าน · เปรียบเทียบกับที่แอดมินกรอก · ตรวจค่าคอม
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {/* View toggle */}
          <div style={{ display:'flex', background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:10, overflow:'hidden' }}>
            {[
              { k:'compare', label:'📊 เปรียบเทียบ' },
              { k:'audit',   label:'📋 ข้อมูลหลังบ้าน' },
            ].map(v => (
              <button key={v.k} onClick={() => setViewMode(v.k)}
                style={{ padding:'7px 14px', border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit',
                  background: viewMode===v.k ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : 'transparent',
                  color: viewMode===v.k ? '#fff' : '#6366f1' }}>
                {v.label}
              </button>
            ))}
          </div>
          {canAudit && !showForm && (
            <button className="btn btn-primary" onClick={() => openAdd()}>
              <Plus size={15}/> ✏️ กรอกข้อมูลหลังบ้าน
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12 }}>
        {[
          { emoji:'📊', label:'รายการทั้งหมด', val:stats.total,   bg:'linear-gradient(135deg,#eef2ff,#e0e7ff)', color:'#4338ca', border:'#c7d2fe' },
          { emoji:'✅', label:'ตรงกัน',        val:stats.matched, bg:'linear-gradient(135deg,#f0fdf4,#dcfce7)', color:'#059669', border:'#bbf7d0' },
          { emoji:'❌', label:'ไม่ตรง',        val:stats.differ,  bg:'linear-gradient(135deg,#fff1f2,#ffe4e6)', color:'#be123c', border:'#fecdd3' },
          { emoji:'⏳', label:'รอหลังบ้านกรอก',val:stats.pending, bg:'linear-gradient(135deg,#fffbeb,#fef3c7)', color:'#b45309', border:'#fde68a' },
          { emoji:'⚠️', label:'ไม่มีข้อมูลแอดมิน',val:stats.noAdmin,bg:'linear-gradient(135deg,#fff7ed,#ffedd5)', color:'#c2410c', border:'#fed7aa' },
        ].map((s,i) => (
          <div key={i} style={{ background:s.bg, border:`1.5px solid ${s.border}`, borderRadius:14, padding:'14px 16px' }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{s.emoji}</div>
            <div style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:11.5, color:'#6b7280', marginTop:4, fontWeight:600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Form (inline) */}
      {showForm && (
        <div id="audit-form-top" style={{ background:'#fff', border:'2px solid #7c3aed', borderRadius:20, padding:28, boxShadow:'0 8px 32px rgba(124,58,237,.15)', position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:44, height:44, borderRadius:14, background:'linear-gradient(135deg,#7c3aed,#6d28d9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🔍</div>
              <div>
                <div style={{ fontSize:18, fontWeight:900, color:'#1e1b4b' }}>{editItem?'แก้ไขข้อมูลหลังบ้าน':'กรอกข้อมูลหลังบ้าน'}</div>
                <div style={{ fontSize:12, color:'#9ca3af' }}>ข้อมูลนี้จะนำมาเปรียบเทียบกับที่แอดมินกรอก</div>
              </div>
            </div>
            <button onClick={() => setShowForm(false)} style={{ background:'#f1f5f9', border:'none', borderRadius:10, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}>
              <X size={15}/>
            </button>
          </div>

          {err && <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:10, padding:'10px 14px', color:'#be123c', fontSize:13.5, marginBottom:16, display:'flex', gap:8 }}><span>❌</span>{err}</div>}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📅 วันที่</label>
              <input type="date" style={S} value={form.date} onChange={setF('date')} required/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>👤 แอดมินที่ตรวจ</label>
              <select style={S} value={form.adminId} onChange={setF('adminId')} required>
                <option value="">-- เลือกแอดมิน --</option>
                {admins.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📄 เพจ</label>
            <select style={S} value={form.pageId} onChange={setF('pageId')} required>
              <option value="">-- เลือกเพจ --</option>
              {pages.map(p => <option key={p.id} value={p.id}>{p.type==='main'?'⭐':'🧪'} {p.name}</option>)}
            </select>
          </div>

          {/* ตอบมือ */}
          <div style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', border:'2px solid #ddd6fe', borderRadius:14, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#6d28d9', marginBottom:12 }}>🖐 ตอบมือ (ข้อมูลจริงจากหลังบ้าน)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#7c3aed', marginBottom:5 }}>จำนวน (บ้าน)</label>
                <input type="number" min="0" style={{ ...S, textAlign:'center', fontWeight:800, color:'#6d28d9', fontSize:16 }} placeholder="0" value={form.manualOrders} onChange={setF('manualOrders')}/></div>
              <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#7c3aed', marginBottom:5 }}>ค่าคอม/บ้าน (฿)</label>
                <input type="number" min="0" step="0.5" style={{ ...S, textAlign:'center' }} value={form.manualRate} onChange={setF('manualRate')}/></div>
              <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#7c3aed', marginBottom:5 }}>ยอดค่าคอม</label>
                <div style={{ ...S, background:'#ede9fe', border:'2px solid #c4b5fd', textAlign:'center', fontSize:16, fontWeight:900, color:'#6d28d9' }}>฿{manualPv.toLocaleString()}</div></div>
            </div>
          </div>

          {/* AI */}
          <div style={{ background:'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border:'2px solid #99f6e4', borderRadius:14, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#0f766e', marginBottom:12 }}>🤖 AI (ข้อมูลจริงจากหลังบ้าน)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#0d9488', marginBottom:5 }}>จำนวน (บ้าน)</label>
                <input type="number" min="0" style={{ ...S, textAlign:'center', fontWeight:800, color:'#0f766e', fontSize:16 }} placeholder="0" value={form.aiOrders} onChange={setF('aiOrders')}/></div>
              <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#0d9488', marginBottom:5 }}>ค่าคอม/บ้าน (฿)</label>
                <input type="number" min="0" step="0.5" style={{ ...S, textAlign:'center' }} value={form.aiRate} onChange={setF('aiRate')}/></div>
              <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#0d9488', marginBottom:5 }}>ยอดค่าคอม</label>
                <div style={{ ...S, background:'#ccfbf1', border:'2px solid #5eead4', textAlign:'center', fontSize:16, fontWeight:900, color:'#0f766e' }}>฿{aiPv.toLocaleString()}</div></div>
            </div>
          </div>

          {/* ปัญหา */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div><label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>❌ ออเดอร์ยกเลิก</label>
              <input type="number" min="0" style={{ ...S, textAlign:'center', color:'#be123c', fontWeight:700 }} placeholder="0" value={form.cancelOrders} onChange={setF('cancelOrders')}/></div>
            <div><label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#d97706', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>🔍 ไม่ชัดเจน</label>
              <input type="number" min="0" style={{ ...S, textAlign:'center', color:'#d97706', fontWeight:700 }} placeholder="0" value={form.unclearOrders} onChange={setF('unclearOrders')}/></div>
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📝 หมายเหตุ</label>
            <textarea style={{ ...S, minHeight:60, resize:'vertical' }} placeholder="หมายเหตุ..." value={form.note} onChange={setF('note')}/>
          </div>

          {/* Summary */}
          <div style={{ background:'linear-gradient(135deg,#7c3aed,#6d28d9)', borderRadius:12, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
            <div style={{ color:'rgba(255,255,255,.8)', fontSize:13 }}>
              🔍 ข้อมูลหลังบ้าน · 🖐 {form.manualOrders||0} + 🤖 {form.aiOrders||0} = {(parseInt(form.manualOrders)||0)+(parseInt(form.aiOrders)||0)} บ้าน
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginBottom:2 }}>ค่าคอมที่ควรได้</div>
              <div style={{ fontSize:26, fontWeight:900, color:'#fff' }}>฿{grandPv.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:'9px 20px', fontSize:14, fontWeight:700, color:'#6b7280', cursor:'pointer', fontFamily:'inherit' }}>ยกเลิก</button>
            <button onClick={handleSave} disabled={saving} style={{ background:'linear-gradient(135deg,#7c3aed,#6d28d9)', border:'none', borderRadius:10, padding:'9px 24px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit', opacity:saving?0.6:1 }}>
              {saving?'⏳ กำลังบันทึก...':editItem?'✅ บันทึกการแก้ไข':'💾 บันทึกข้อมูลหลังบ้าน'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:14, padding:'14px 18px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12, alignItems:'end' }}>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>📅 วันที่</label>
            <input type="date" style={S} value={filters.date}
              onChange={e => setFilters(p => ({ ...p, date: e.target.value, month: '' }))}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>📆 เดือน</label>
            <input type="month" style={S} value={filters.month}
              onChange={e => setFilters(p => ({ ...p, month: e.target.value, date: '' }))}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>👤 แอดมิน</label>
            <select style={S} value={filters.adminId}
              onChange={e => setFilters(p => ({ ...p, adminId: e.target.value }))}>
              <option value="">ทั้งหมด</option>
              {admins.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>📄 เพจ</label>
            <select style={S} value={filters.pageId}
              onChange={e => setFilters(p => ({ ...p, pageId: e.target.value }))}>
              <option value="">ทั้งหมด</option>
              {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={()=>setFilters({date:today,month:'',adminId:'',pageId:''})}
            style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:10, padding:'9px 14px', cursor:'pointer', fontSize:13, fontWeight:700, color:'#4338ca', display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' }}>
            <RefreshCw size={13}/> รีเซ็ต
          </button>
        </div>
      </div>

      {/* ═══ VIEW: COMPARE ═══ */}
      {viewMode === 'compare' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {compareRows.length === 0 ? (
            <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:40, textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>⚖️</div>
              <div style={{ fontSize:15, fontWeight:700, color:'#6b7280' }}>ไม่มีข้อมูลเปรียบเทียบ</div>
              <div style={{ fontSize:13, color:'#9ca3af', marginTop:4 }}>ลองเปลี่ยนตัวกรอง หรือกรอกข้อมูลหลังบ้าน</div>
            </div>
          ) : compareRows.map(row => {
            const cfg = row.cmp
            const isOpen = expandId === row.key
            const matchStatus = !row.audit ? 'pending' : !row.admin ? 'no-admin' : row.cmp?.match ? 'match' : 'differ'
            const rowBg = matchStatus==='match' ? '#f0fdf4' : matchStatus==='differ' ? '#fff1f2' : matchStatus==='pending' ? '#fffbeb' : '#fff7ed'
            const rowBorder = matchStatus==='match' ? '#bbf7d0' : matchStatus==='differ' ? '#fecdd3' : matchStatus==='pending' ? '#fde68a' : '#fed7aa'

            return (
              <div key={row.key} style={{ background:'#fff', border:`1.5px solid ${rowBorder}`, borderRadius:16, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,.04)' }}>
                {/* Row header */}
                <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:12, padding:'14px 18px', background:rowBg, cursor:'pointer' }}
                  onClick={() => setExpandId(isOpen ? null : row.key)}>
                  <MatchBadge match={row.cmp?.match} hasAudit={!!row.audit} hasAdmin={!!row.admin}/>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                      {getUserName(row.adminId).slice(0,2)}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, color:'#1e1b4b' }}>{getUserName(row.adminId)}</div>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>📄 {getPageName(row.pageId)} · 📅 {row.date}</div>
                    </div>
                  </div>

                  {/* Comparison quick view */}
                  <div style={{ flex:1, display:'flex', flexWrap:'wrap', gap:16, justifyContent:'flex-end', alignItems:'center' }}>
                    {row.admin && row.audit && (
                      <>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10, color:'#9ca3af', marginBottom:2 }}>แอดมินกรอก</div>
                          <div style={{ fontSize:15, fontWeight:900, color:'#4338ca' }}>฿{(row.admin.total||0).toLocaleString()}</div>
                        </div>
                        <div style={{ fontSize:20, color:'#9ca3af' }}>⚡</div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10, color:'#9ca3af', marginBottom:2 }}>หลังบ้านตรวจ</div>
                          <div style={{ fontSize:15, fontWeight:900, color:'#7c3aed' }}>฿{(row.audit.total||0).toLocaleString()}</div>
                        </div>
                        {cfg && !cfg.match && (
                          <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:8, padding:'4px 10px', fontSize:12, fontWeight:800, color:'#be123c' }}>
                            {cfg.totalDiff > 0 ? '+' : ''}{cfg.totalDiff.toLocaleString()} ฿
                          </div>
                        )}
                      </>
                    )}
                    {!row.audit && (
                      <button onClick={e=>{e.stopPropagation(); openAdd({adminId:row.adminId, pageId:row.pageId, date:row.date})}}
                        style={{ background:'linear-gradient(135deg,#7c3aed,#6d28d9)', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:12, fontWeight:700, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                        <Plus size={12}/> กรอกหลังบ้าน
                      </button>
                    )}
                    {isOpen ? <ChevronUp size={16} style={{ color:'#9ca3af' }}/> : <ChevronDown size={16} style={{ color:'#9ca3af' }}/>}
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding:'18px 20px', borderTop:`1.5px solid ${rowBorder}` }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom: cfg && !cfg.match ? 16 : 0 }}>
                      {/* Admin data */}
                      <div style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:14, padding:16 }}>
                        <div style={{ fontSize:13, fontWeight:800, color:'#4338ca', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                          💼 ข้อมูลที่แอดมินกรอก
                          {row.admin && <span style={{ fontSize:11, color:'#6b7280', fontWeight:400 }}>by {getUserName(row.adminId)}</span>}
                        </div>
                        {row.admin ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                            {[
                              ['🖐 ตอบมือ',`${row.admin.manualOrders||0} บ้าน × ฿${row.admin.manualRate||0} = ฿${(row.admin.manualTotal||0).toLocaleString()}`,'#6d28d9'],
                              ['🤖 AI',    `${row.admin.aiOrders||0} บ้าน × ฿${row.admin.aiRate||0} = ฿${(row.admin.aiTotal||0).toLocaleString()}`,'#0f766e'],
                              ['❌ ยกเลิก',`${row.admin.cancelOrders||0} บ้าน`,'#be123c'],
                              ['🔍 ไม่ชัด', `${row.admin.unclearOrders||0} บ้าน`,'#d97706'],
                            ].map(([label,val,color],i) => (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                                <span style={{ color:'#6b7280' }}>{label}</span>
                                <span style={{ fontWeight:700, color }}>{val}</span>
                              </div>
                            ))}
                            <div style={{ borderTop:'1px solid #c7d2fe', paddingTop:8, display:'flex', justifyContent:'space-between' }}>
                              <span style={{ fontWeight:700, color:'#4338ca' }}>ค่าคอมรวม</span>
                              <span style={{ fontSize:17, fontWeight:900, color:'#4338ca' }}>฿{(row.admin.total||0).toLocaleString()}</span>
                            </div>
                            {row.admin.note && <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>📝 {row.admin.note}</div>}
                          </div>
                        ) : (
                          <div style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:'16px 0' }}>⚠️ ยังไม่มีข้อมูลจากแอดมิน</div>
                        )}
                      </div>

                      {/* Audit data */}
                      <div style={{ background:'#f5f3ff', border:'1.5px solid #ddd6fe', borderRadius:14, padding:16 }}>
                        <div style={{ fontSize:13, fontWeight:800, color:'#7c3aed', marginBottom:12, display:'flex', alignItems:'center', gap:6, justifyContent:'space-between' }}>
                          <span>🔍 ข้อมูลหลังบ้าน</span>
                          {row.audit && (
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={() => openEdit(row.audit)} style={{ background:'#ede9fe', border:'1.5px solid #c4b5fd', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:11, fontWeight:700, color:'#6d28d9', fontFamily:'inherit', display:'flex', alignItems:'center', gap:3 }}>
                                <Edit2 size={10}/> แก้ไข
                              </button>
                              {(isSuperAdmin || !isAuditor) && (
                                <button onClick={() => setConfirm(row.audit.id)} style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:11, fontWeight:700, color:'#be123c', fontFamily:'inherit', display:'flex', alignItems:'center', gap:3 }}>
                                  <Trash2 size={10}/> ลบ
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {row.audit ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                            {[
                              ['🖐 ตอบมือ',`${row.audit.manualOrders||0} บ้าน × ฿${row.audit.manualRate||0} = ฿${(row.audit.manualTotal||0).toLocaleString()}`,'#6d28d9'],
                              ['🤖 AI',    `${row.audit.aiOrders||0} บ้าน × ฿${row.audit.aiRate||0} = ฿${(row.audit.aiTotal||0).toLocaleString()}`,'#0f766e'],
                              ['❌ ยกเลิก',`${row.audit.cancelOrders||0} บ้าน`,'#be123c'],
                              ['🔍 ไม่ชัด', `${row.audit.unclearOrders||0} บ้าน`,'#d97706'],
                            ].map(([label,val,color],i) => (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                                <span style={{ color:'#6b7280' }}>{label}</span>
                                <span style={{ fontWeight:700, color }}>{val}</span>
                              </div>
                            ))}
                            <div style={{ borderTop:'1px solid #ddd6fe', paddingTop:8, display:'flex', justifyContent:'space-between' }}>
                              <span style={{ fontWeight:700, color:'#7c3aed' }}>ค่าคอมที่ควรได้</span>
                              <span style={{ fontSize:17, fontWeight:900, color:'#7c3aed' }}>฿{(row.audit.total||0).toLocaleString()}</span>
                            </div>
                            {row.audit.note && <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>📝 {row.audit.note}</div>}
                          </div>
                        ) : (
                          <div style={{ textAlign:'center', padding:'16px 0' }}>
                            <div style={{ color:'#9ca3af', fontSize:13, marginBottom:12 }}>ยังไม่มีข้อมูลจากหลังบ้าน</div>
                            <button onClick={()=>openAdd({adminId:row.adminId,pageId:row.pageId,date:row.date})}
                              style={{ background:'linear-gradient(135deg,#7c3aed,#6d28d9)', border:'none', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontSize:13, fontWeight:700, color:'#fff', fontFamily:'inherit' }}>
                              ✏️ กรอกข้อมูล
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Diff highlight */}
                    {cfg && !cfg.match && cfg.diffs.length > 0 && (
                      <div style={{ background:'#fff1f2', border:'2px solid #fecdd3', borderRadius:12, padding:16 }}>
                        <div style={{ fontSize:13, fontWeight:800, color:'#be123c', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                          ⚠️ พบความแตกต่าง {cfg.diffs.length} รายการ
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          {cfg.diffs.map((d,i) => (
                            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, alignItems:'center', padding:'8px 12px', background:'#fff', borderRadius:8, border:'1px solid #fecdd3' }}>
                              <div style={{ fontSize:13, fontWeight:600, color:'#1e1b4b' }}>{d.label}</div>
                              <div style={{ textAlign:'center' }}>
                                <div style={{ fontSize:10, color:'#9ca3af' }}>แอดมิน</div>
                                <div style={{ fontWeight:800, color:'#4338ca' }}>{d.adminVal} {d.unit}</div>
                              </div>
                              <div style={{ textAlign:'center' }}>
                                <div style={{ fontSize:10, color:'#9ca3af' }}>หลังบ้าน</div>
                                <div style={{ fontWeight:800, color:'#7c3aed' }}>{d.auditVal} {d.unit}</div>
                              </div>
                              <div style={{ textAlign:'right' }}>
                                <span style={{ background: d.diff>0?'#f0fdf4':'#fff1f2', color: d.diff>0?'#059669':'#be123c', border:`1px solid ${d.diff>0?'#bbf7d0':'#fecdd3'}`, borderRadius:6, padding:'3px 8px', fontSize:12, fontWeight:800 }}>
                                  {d.diff>0?'+':''}{d.diff} {d.unit}
                                </span>
                              </div>
                            </div>
                          ))}
                          {/* Total diff */}
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'#fff1f2', borderRadius:10, border:'1.5px solid #fca5a5', marginTop:4 }}>
                            <span style={{ fontWeight:800, color:'#be123c' }}>💰 ผลต่างค่าคอมรวม</span>
                            <span style={{ fontSize:18, fontWeight:900, color: cfg.totalDiff>0?'#059669':'#be123c' }}>
                              {cfg.totalDiff>0?'+':''}{cfg.totalDiff.toLocaleString()} ฿
                              <span style={{ fontSize:12, marginLeft:6, fontWeight:600, color:'#9ca3af' }}>
                                ({cfg.totalDiff>0?'หลังบ้านสูงกว่า':'หลังบ้านต่ำกว่า'})
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ VIEW: AUDIT ONLY ═══ */}
      {viewMode === 'audit' && (
        <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', borderBottom:'2px solid #e0e7ff' }}>
                  {['📅 วันที่','👤 แอดมิน','📄 เพจ','🖐 มือ','฿มือ','🤖 AI','฿AI','❌','🔍','💎 รวม','✍️ โดย',''].map((h,i)=>(
                    <th key={i} style={{ padding:'11px 13px', textAlign:i>=3?'center':'left', fontSize:11, fontWeight:800, color:'#7c3aed', letterSpacing:'.06em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAudit.length===0?(
                  <tr><td colSpan={12} style={{ textAlign:'center', padding:40, color:'#9ca3af' }}><div style={{ fontSize:40, marginBottom:10 }}>🔍</div><div>ยังไม่มีข้อมูลหลังบ้าน</div></td></tr>
                ):filteredAudit.map(a=>(
                  <tr key={a.id} style={{ borderBottom:'1px solid #f0f4ff' }}>
                    <td style={{ padding:'11px 13px', fontSize:13, color:'#4b5563' }}>{a.date}</td>
                    <td style={{ padding:'11px 13px', fontSize:13, fontWeight:600 }}>{getUserName(a.adminId)}</td>
                    <td style={{ padding:'11px 13px', fontSize:13, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{getPageName(a.pageId)}</td>
                    <td style={{ textAlign:'center', fontSize:15, fontWeight:800, color:'#6d28d9' }}>{a.manualOrders||0}</td>
                    <td style={{ textAlign:'center', fontSize:12, color:'#7c3aed', fontWeight:600 }}>฿{(a.manualTotal||0).toLocaleString()}</td>
                    <td style={{ textAlign:'center', fontSize:15, fontWeight:800, color:'#0f766e' }}>{a.aiOrders||0}</td>
                    <td style={{ textAlign:'center', fontSize:12, color:'#0d9488', fontWeight:600 }}>฿{(a.aiTotal||0).toLocaleString()}</td>
                    <td style={{ textAlign:'center', color:'#be123c', fontWeight:700 }}>{a.cancelOrders||0}</td>
                    <td style={{ textAlign:'center', color:'#d97706', fontWeight:700 }}>{a.unclearOrders||0}</td>
                    <td style={{ textAlign:'right', padding:'11px 13px', fontSize:16, fontWeight:900, color:'#7c3aed' }}>฿{(a.total||0).toLocaleString()}</td>
                    <td style={{ padding:'11px 10px', fontSize:12, color:'#9ca3af' }}>{getUserName(a.auditBy)}</td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={()=>openEdit(a)} style={{ background:'#f5f3ff', border:'1.5px solid #ddd6fe', borderRadius:7, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#7c3aed' }}><Edit2 size={12}/></button>
                        {isSuperAdmin&&<button onClick={()=>setConfirm(a.id)} style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:7, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#be123c' }}><Trash2 size={12}/></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(124,58,237,.2)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:20, padding:28, maxWidth:360, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,.15)', border:'1.5px solid #e0e7ff' }}>
            <div style={{ fontSize:40, textAlign:'center', marginBottom:12 }}>🗑️</div>
            <div style={{ fontSize:17, fontWeight:900, textAlign:'center', marginBottom:6 }}>ลบข้อมูลหลังบ้าน?</div>
            <div style={{ fontSize:13, color:'#6b7280', textAlign:'center', marginBottom:20 }}>ข้อมูลการเปรียบเทียบจะหายไป</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setConfirm(null)} style={{ flex:1, background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:10, fontSize:14, fontWeight:700, color:'#6b7280', cursor:'pointer', fontFamily:'inherit' }}>ยกเลิก</button>
              <button onClick={async()=>{await removeAuditOrder(confirm);setConfirm(null)}} style={{ flex:1, background:'linear-gradient(135deg,#e11d48,#f43f5e)', border:'none', borderRadius:10, padding:10, fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>🗑️ ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
