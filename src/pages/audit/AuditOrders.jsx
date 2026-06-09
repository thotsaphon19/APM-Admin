import React, { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { useNotify } from '../../hooks/useNotify'
import { Trash2, ChevronDown, ChevronUp, Plus, RefreshCw, BarChart2 } from 'lucide-react'
import PageBadge from '../../components/ui/PageBadge'

const today     = format(new Date(), 'yyyy-MM-dd')
const thisMonth = format(new Date(), 'yyyy-MM')

export default function AuditOrders() {
  const { profile, user, canAudit, isSuperAdmin, canManage } = useAuth()
  const { commissions, auditOrders, pages, users, commRates,
          createAuditOrder, editAuditOrder, removeAuditOrder,
          getUserName, getPageName, getPage } = useData()
  const { notifyCustom } = useNotify()

  const myUid   = user?.uid || profile?.id || ''
  const canEdit = isSuperAdmin || canManage || canAudit

  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [confirm,  setConfirm]  = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')
  const [expandId, setExpandId] = useState(null)
  const [viewMode, setViewMode] = useState('compare')
  const [filters,  setFilters]  = useState({ date: today, month: '', adminId: '', pageId: '' })

  const makeBlank = () => ({
    date: today, pageId: '',
    totalOrders: '',   // จำนวนบ้านรวม (ไม่แยก AI/มือ)
    promos: [],        // [{name, qty}]
    saleAmount: '',
    note: '',
  })
  const [form, setForm] = useState(makeBlank)
  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const admins  = users.filter(u => ['admin','head_admin'].includes(u.role))

  // Filter commissions (แอดมิน) — สำหรับ compare
  const filteredAdmin = useMemo(() => {
    let d = commissions
    if (filters.date && !filters.month) d = d.filter(c => c.date === filters.date)
    if (filters.month) d = d.filter(c => c.date?.startsWith(filters.month))
    if (filters.adminId) d = d.filter(c => c.adminId === filters.adminId)
    if (filters.pageId)  d = d.filter(c => c.pageId  === filters.pageId)
    return d
  }, [commissions, filters])

  // Filter auditOrders (หลังบ้านกรอก)
  const filteredAudit = useMemo(() => {
    let d = auditOrders || []
    if (filters.date && !filters.month) d = d.filter(c => c.date === filters.date)
    if (filters.month) d = d.filter(c => c.date?.startsWith(filters.month))
    if (filters.pageId)  d = d.filter(c => c.pageId  === filters.pageId)
    return d
  }, [auditOrders, filters])

  // Build compare rows: group admin by pageId+date, join with audit
  const compareRows = useMemo(() => {
    const pageDate = new Set([
      ...filteredAdmin.map(c => `${c.pageId}|${c.date}`),
      ...filteredAudit.map(c => `${c.pageId}|${c.date}`),
    ])
    return [...pageDate].map(key => {
      const [pageId, date] = key.split('|')
      const admins = filteredAdmin.filter(c => c.pageId===pageId && c.date===date)
      const audit  = filteredAudit.find(c => c.pageId===pageId && c.date===date)
      const adminTotal = admins.reduce((a,c)=>a+(parseInt(c.manualOrders)||0)+(parseInt(c.aiOrders)||0),0)
      const auditTotal = parseInt(audit?.totalOrders||audit?.actualCount) || 0
      const diff = auditTotal - adminTotal
      const match = audit && Math.abs(diff) <= 2
      return { key, pageId, date, admins, audit, adminTotal, auditTotal, diff, match,
        hasAudit: !!audit, hasAdmin: admins.length > 0 }
    }).sort((a,b) => b.date.localeCompare(a.date))
  }, [filteredAdmin, filteredAudit])

  const stats = useMemo(() => ({
    total:   compareRows.length,
    matched: compareRows.filter(r=>r.match).length,
    differ:  compareRows.filter(r=>r.hasAdmin&&r.hasAudit&&!r.match).length,
    pending: compareRows.filter(r=>!r.hasAudit).length,
    noAdmin: compareRows.filter(r=>!r.hasAdmin).length,
  }), [compareRows])

  const openAdd = () => { setForm(makeBlank()); setEditItem(null); setErr(''); setShowForm(true) }
  const openEdit = item => {
    setForm({
      date: item.date, pageId: item.pageId,
      totalOrders: item.totalOrders || item.actualCount || '',
      promos: item.promos || [],
      saleAmount: item.saleAmount || '',
      note: item.note || '',
    })
    setEditItem(item); setErr(''); setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.pageId || !form.date) { setErr('กรุณาเลือกเพจและวันที่'); return }
    setSaving(true); setErr('')
    try {
      const payload = {
        pageId: form.pageId,
        date: form.date,
        totalOrders: parseInt(form.totalOrders) || 0,
        actualCount: parseInt(form.totalOrders) || 0,
        promos: form.promos || [],
        saleAmount: parseFloat(form.saleAmount) || 0,
        note: form.note || '',
        updatedBy: myUid,
      }
      if (editItem) await editAuditOrder(editItem.id, payload)
      else          await createAuditOrder({ ...payload, createdBy: myUid })
      setShowForm(false); setForm(makeBlank())
    } catch(e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const S = { width:'100%', padding:'8px 12px', borderRadius:9, border:'1.5px solid #e0e7ff', background:'#fafbff', fontSize:13.5, color:'#1e1b4b', fontFamily:'inherit', boxSizing:'border-box' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* ══ HEADER ══════════════════════════════════════ */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:900, color:'#1e1b4b', margin:0, display:'flex', alignItems:'center', gap:8 }}>
            🔍 ตรวจสอบออเดอร์หลังบ้าน
          </h2>
          <p style={{ fontSize:12.5, color:'#6b7280', margin:'4px 0 0' }}>
            กรอกข้อมูลจริงจากหลังบ้าน · เปรียบเทียบกับที่แอดมินกรอก
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {[{v:'compare',l:'📊 เปรียบเทียบ'},{v:'audit',l:'🖥️ ข้อมูลหลังบ้าน'}].map(m=>(
            <button key={m.v} onClick={()=>setViewMode(m.v)}
              style={{ background:viewMode===m.v?'linear-gradient(135deg,#6366f1,#7c3aed)':'#f1f5f9', border:`1.5px solid ${viewMode===m.v?'#6366f1':'#e0e7ff'}`, borderRadius:9, padding:'8px 16px', cursor:'pointer', fontSize:13, fontWeight:700, color:viewMode===m.v?'#fff':'#6b7280', fontFamily:'inherit' }}>
              {m.l}
            </button>
          ))}
          {canEdit && (
            <button onClick={openAdd}
              style={{ background:'linear-gradient(135deg,#d97706,#f59e0b)', border:'none', borderRadius:9, padding:'8px 16px', cursor:'pointer', fontSize:13, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6, boxShadow:'0 3px 10px rgba(217,119,6,.3)' }}>
              <Plus size={14}/> กรอกข้อมูลหลังบ้าน
            </button>
          )}
        </div>
      </div>

      {/* ══ KPI CARDS ═══════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
        {[
          { e:'📋', l:'รายการทั้งหมด', v:stats.total,   bg:'linear-gradient(135deg,#eef2ff,#e0e7ff)', c:'#4338ca', b:'#c7d2fe' },
          { e:'✅', l:'ตรงกัน',        v:stats.matched, bg:'linear-gradient(135deg,#f0fdf4,#dcfce7)', c:'#059669', b:'#bbf7d0' },
          { e:'❌', l:'ไม่ตรง',        v:stats.differ,  bg:'linear-gradient(135deg,#fff1f2,#ffe4e6)', c:'#be123c', b:'#fecdd3' },
          { e:'⏳', l:'รอหลังบ้านกรอก', v:stats.pending, bg:'linear-gradient(135deg,#fffbeb,#fef3c7)', c:'#b45309', b:'#fde68a' },
          { e:'⚠️', l:'ไม่มีข้อมูลแอดมิน', v:stats.noAdmin, bg:'linear-gradient(135deg,#fff7ed,#ffedd5)', c:'#c2410c', b:'#fed7aa' },
        ].map((k,i)=>(
          <div key={i} style={{ background:k.bg, border:`1.5px solid ${k.b}`, borderRadius:16, padding:'16px 18px' }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{k.e}</div>
            <div style={{ fontSize:24, fontWeight:900, color:k.c }}>{k.v}</div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:4, fontWeight:600 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* ══ FORM ════════════════════════════════════════ */}
      {showForm && (
        <div id="audit-form-top" style={{ background:'#fff', border:'2px solid #fde68a', borderRadius:18, overflow:'hidden', boxShadow:'0 4px 20px rgba(217,119,6,.12)' }}>
          <div style={{ background:'linear-gradient(135deg,#d97706,#f59e0b)', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', display:'flex', alignItems:'center', gap:8 }}>
              🖥️ {editItem ? 'แก้ไข' : 'กรอก'}ข้อมูลหลังบ้าน
            </div>
            <button onClick={()=>setShowForm(false)} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:8, width:30, height:30, cursor:'pointer', color:'#fff', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          </div>
          <div style={{ padding:22 }}>
            {err && <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:10, padding:'10px 14px', color:'#be123c', fontSize:13, marginBottom:14 }}>❌ {err}</div>}

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14, marginBottom:16 }}>
              {/* วันที่ */}
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
                  📅 วันที่ <span style={{ color:'#059669', fontSize:10, fontWeight:600, textTransform:'none' }}>ย้อนหลังได้</span>
                </label>
                <input type="date" style={S} value={form.date} onChange={setF('date')}/>
              </div>
              {/* เพจ */}
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📄 เพจ *</label>
                <select style={S} value={form.pageId} onChange={setF('pageId')}>
                  <option value="">เลือกเพจ</option>
                  {pages.filter(p=>p.status==='active').map(p=>(
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {/* ออเดอร์รวม */}
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>🏠 ออเดอร์รวม (บ้าน)</label>
                <input type="number" min="0" style={{ ...S, fontSize:18, fontWeight:900, color:'#b45309', textAlign:'center' }}
                  value={form.totalOrders} onChange={setF('totalOrders')} placeholder="0"/>
              </div>
              {/* ยอดขาย */}
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>💵 ยอดขาย (฿)</label>
                <input type="number" min="0" style={S} value={form.saleAmount} onChange={setF('saleAmount')} placeholder="0"/>
              </div>
            </div>

            {/* โปรโมชั่น */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>🎯 โปรโมชั่น</label>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {(form.promos||[]).map((pr,pi)=>(
                  <div key={pi} style={{ display:'grid', gridTemplateColumns:'1fr 110px 32px', gap:8, alignItems:'center' }}>
                    <input value={pr.name||''} placeholder="ชื่อโปร เช่น โปร A, Flash Sale"
                      onChange={e=>setForm(p=>{ const ps=[...(p.promos||[])]; ps[pi]={...ps[pi],name:e.target.value}; return {...p,promos:ps} })}
                      style={{ ...S, fontSize:13 }}/>
                    <input type="number" min="0" value={pr.qty||''} placeholder="บ้าน"
                      onChange={e=>setForm(p=>{ const ps=[...(p.promos||[])]; ps[pi]={...ps[pi],qty:parseInt(e.target.value)||0}; return {...p,promos:ps} })}
                      style={{ ...S, fontSize:13, textAlign:'center', fontWeight:800, color:'#b45309' }}/>
                    <button type="button" onClick={()=>setForm(p=>({...p,promos:(p.promos||[]).filter((_,i)=>i!==pi)}))}
                      style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:7, width:32, height:32, cursor:'pointer', color:'#be123c', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>×</button>
                  </div>
                ))}
                <button type="button"
                  onClick={()=>setForm(p=>({...p,promos:[...(p.promos||[]),{name:'',qty:0}]}))}
                  style={{ background:'#fffbeb', border:'1.5px dashed #fde68a', borderRadius:9, padding:'7px', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#b45309', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                  + เพิ่มโปรโมชั่น
                </button>
                {(form.promos||[]).filter(p=>p.qty>0).length > 0 && (
                  <div style={{ textAlign:'right', fontSize:13, fontWeight:800, color:'#b45309' }}>
                    โปรรวม: {(form.promos||[]).reduce((a,p)=>a+(p.qty||0),0)} บ้าน
                  </div>
                )}
              </div>
            </div>

            {/* หมายเหตุ */}
            <div style={{ marginBottom:18 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📝 หมายเหตุ</label>
              <input style={S} value={form.note} onChange={setF('note')} placeholder="หมายเหตุ (ถ้ามี)"/>
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={()=>setShowForm(false)} style={{ background:'#f1f5f9', border:'1.5px solid #e0e7ff', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontSize:13.5, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>ยกเลิก</button>
              <button onClick={handleSubmit} disabled={saving||!form.pageId}
                style={{ background:form.pageId?'linear-gradient(135deg,#d97706,#f59e0b)':'#e5e7eb', border:'none', borderRadius:10, padding:'9px 24px', cursor:form.pageId?'pointer':'not-allowed', fontSize:13.5, fontWeight:800, color:'#fff', fontFamily:'inherit', boxShadow:form.pageId?'0 3px 10px rgba(217,119,6,.3)':'none' }}>
                {saving ? '⏳ กำลังบันทึก...' : `🖥️ ${editItem?'บันทึกการแก้ไข':'บันทึกข้อมูลหลังบ้าน'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ FILTER BAR ══════════════════════════════════ */}
      <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:14, padding:'12px 18px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'160px 160px 1fr 1fr auto', gap:10, alignItems:'end', flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:10.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>📅 วันที่</div>
            <input type="date" style={{ ...S, padding:'7px 10px' }} value={filters.date}
              onChange={e=>setFilters(p=>({...p,date:e.target.value,month:''}))}/>
          </div>
          <div>
            <div style={{ fontSize:10.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>🗓️ เดือน</div>
            <input type="month" style={{ ...S, padding:'7px 10px' }} value={filters.month}
              onChange={e=>setFilters(p=>({...p,month:e.target.value,date:''}))}/>
          </div>
          <div>
            <div style={{ fontSize:10.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>👤 แอดมิน</div>
            <select style={{ ...S, padding:'7px 10px' }} value={filters.adminId} onChange={e=>setFilters(p=>({...p,adminId:e.target.value}))}>
              <option value="">ทั้งหมด</option>
              {admins.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:10.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>📄 เพจ</div>
            <select style={{ ...S, padding:'7px 10px' }} value={filters.pageId} onChange={e=>setFilters(p=>({...p,pageId:e.target.value}))}>
              <option value="">ทั้งหมด</option>
              {pages.filter(p=>p.status==='active').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={()=>setFilters({date:today,month:'',adminId:'',pageId:''})}
            style={{ background:'#f1f5f9', border:'1.5px solid #e0e7ff', borderRadius:9, padding:'7px 14px', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#6b7280', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
            <RefreshCw size={12}/> รีเซ็ต
          </button>
        </div>
      </div>

      {/* ══ VIEW: เปรียบเทียบ ════════════════════════════ */}
      {viewMode === 'compare' && (
        <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
          <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', padding:'12px 18px', borderBottom:'1.5px solid #e0e7ff', fontSize:14, fontWeight:800, color:'#1e1b4b' }}>
            📊 เปรียบเทียบออเดอร์แอดมิน vs หลังบ้าน
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:650 }}>
              <thead>
                <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom:'2px solid #e0e7ff' }}>
                  {['วันที่','เพจ','🖐 แอดมินลง','🖥️ หลังบ้าน','ผลต่าง','โปรโมชั่น','สถานะ',''].map((h,i)=>(
                    <th key={i} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows.length===0
                  ? <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'#9ca3af' }}>
                      <div style={{ fontSize:40, marginBottom:10 }}>🔍</div>
                      <div style={{ fontWeight:700 }}>ยังไม่มีข้อมูลหลังบ้าน</div>
                    </td></tr>
                  : compareRows.map((r,i)=>{
                    const st = r.hasAudit
                      ? r.match ? {bg:'#f0fdf4',bc:'#bbf7d0',label:'✅ ตรงกัน',c:'#059669'}
                                : {bg:'#fff1f2',bc:'#fecdd3',label:'❌ ไม่ตรง',c:'#be123c'}
                      : {bg:'#fffbeb',bc:'#fde68a',label:'⏳ รอหลังบ้าน',c:'#b45309'}
                    const isExp = expandId === r.key
                    return (
                      <React.Fragment key={r.key}>
                        <tr style={{ borderBottom:'1px solid #f0f4ff', background:i%2===0?'#fff':'#fafbff' }}>
                          <td style={{ padding:'10px 12px', fontSize:13, color:'#6b7280', whiteSpace:'nowrap' }}>{r.date}</td>
                          <td style={{ padding:'10px 12px' }}><PageBadge page={getPage(r.pageId)} size='sm'/></td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ fontSize:16, fontWeight:900, color:'#4338ca' }}>{r.adminTotal}</div>
                            <div style={{ fontSize:10.5, color:'#9ca3af' }}>{r.admins.length} คน</div>
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            {r.hasAudit
                              ? <div style={{ fontSize:16, fontWeight:900, color:'#b45309' }}>{r.auditTotal}</div>
                              : <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>}
                          </td>
                          <td style={{ padding:'10px 12px', fontSize:15, fontWeight:900,
                            color: r.diff===0?'#059669':r.diff>0?'#0284c7':'#be123c' }}>
                            {r.hasAudit ? (r.diff===0?'±0':r.diff>0?`+${r.diff}`:r.diff) : '—'}
                          </td>
                          <td style={{ padding:'10px 12px', fontSize:12 }}>
                            {(r.audit?.promos||[]).filter(p=>p.qty>0).map((p,pi)=>(
                              <span key={pi} style={{ background:'#fef3c7', color:'#92400e', border:'1px solid #fde68a', borderRadius:99, padding:'1px 8px', fontSize:11.5, fontWeight:700, marginRight:4, display:'inline-block' }}>
                                {p.name}: {p.qty}
                              </span>
                            ))}
                            {!(r.audit?.promos||[]).filter(p=>p.qty>0).length && '—'}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <span style={{ background:st.bg, color:st.c, border:`1.5px solid ${st.bc}`, borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
                              {st.label}
                            </span>
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <button onClick={()=>setExpandId(isExp?null:r.key)}
                              style={{ background:'#f1f5f9', border:'1px solid #e0e7ff', borderRadius:8, width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}>
                              {isExp?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                            </button>
                          </td>
                        </tr>
                        {isExp && (
                          <tr style={{ background:'#f8f9ff' }}>
                            <td colSpan={8} style={{ padding:'14px 18px' }}>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                                {/* แอดมิน */}
                                <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderRadius:12, padding:14 }}>
                                  <div style={{ fontSize:12, fontWeight:800, color:'#4338ca', marginBottom:10 }}>👥 แอดมินกรอก</div>
                                  {r.admins.map((a,ai)=>(
                                    <div key={ai} style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:13 }}>
                                      <span style={{ fontWeight:600 }}>{getUserName(a.adminId)}</span>
                                      <span style={{ color:'#4338ca', fontWeight:800 }}>
                                        {(parseInt(a.manualOrders)||0)+(parseInt(a.aiOrders)||0)} บ้าน
                                        <span style={{ fontSize:11, color:'#6b7280', marginLeft:6 }}>
                                          (มือ {a.manualOrders||0} · AI {a.aiOrders||0})
                                        </span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {/* หลังบ้าน */}
                                <div style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', borderRadius:12, padding:14 }}>
                                  <div style={{ fontSize:12, fontWeight:800, color:'#b45309', marginBottom:10 }}>🖥️ หลังบ้านกรอก</div>
                                  {r.hasAudit ? (
                                    <>
                                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                                        <span style={{ fontSize:13 }}>ออเดอร์รวม</span>
                                        <span style={{ fontWeight:900, color:'#b45309', fontSize:15 }}>{r.auditTotal} บ้าน</span>
                                      </div>
                                      {(r.audit?.promos||[]).filter(p=>p.qty>0).map((p,pi)=>(
                                        <div key={pi} style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, color:'#92400e', marginBottom:4 }}>
                                          <span>{p.name}</span><span style={{ fontWeight:700 }}>{p.qty} บ้าน</span>
                                        </div>
                                      ))}
                                      {isSuperAdmin && r.audit?.saleAmount>0 && (
                                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginTop:6, paddingTop:6, borderTop:'1px solid #fde68a' }}>
                                          <span>💵 ยอดขาย</span>
                                          <span style={{ fontWeight:800, color:'#059669' }}>฿{parseFloat(r.audit.saleAmount).toLocaleString()}</span>
                                        </div>
                                      )}
                                      {r.audit?.note && <div style={{ fontSize:12, color:'#6b7280', marginTop:6 }}>📝 {r.audit.note}</div>}
                                    </>
                                  ) : (
                                    <div style={{ fontSize:13, color:'#9ca3af' }}>ยังไม่มีข้อมูลหลังบ้าน</div>
                                  )}
                                </div>
                              </div>
                              {canEdit && r.hasAudit && (
                                <div style={{ display:'flex', gap:8, marginTop:10, justifyContent:'flex-end' }}>
                                  <button onClick={()=>openEdit(r.audit)}
                                    style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#4338ca', fontFamily:'inherit' }}>
                                    ✏️ แก้ไข
                                  </button>
                                  <button onClick={()=>setConfirm(r.audit.id)}
                                    style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#be123c', fontFamily:'inherit' }}>
                                    🗑️ ลบ
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ VIEW: ข้อมูลหลังบ้านอย่างเดียว ══════════════ */}
      {viewMode === 'audit' && (
        <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
          <div style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', padding:'12px 18px', borderBottom:'1.5px solid #fde68a', fontSize:14, fontWeight:800, color:'#b45309' }}>
            🖥️ ข้อมูลหลังบ้าน ({filteredAudit.length} รายการ)
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#fef9ec', borderBottom:'1.5px solid #fde68a' }}>
                  {['วันที่','เพจ','ออเดอร์รวม','โปรโมชั่น',isSuperAdmin?'ยอดขาย':'','หมายเหตุ',''].filter(Boolean).map((h,i)=>(
                    <th key={i} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAudit.length===0
                  ? <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'#9ca3af' }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
                      <div style={{ fontWeight:700 }}>ยังไม่มีข้อมูลหลังบ้าน</div>
                    </td></tr>
                  : [...filteredAudit].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map((a,i)=>(
                    <tr key={a.id||i} style={{ borderBottom:'1px solid #fef3c7' }}>
                      <td style={{ padding:'10px 12px', fontSize:13, color:'#6b7280' }}>{a.date}</td>
                      <td style={{ padding:'10px 12px' }}><PageBadge page={getPage(a.pageId)} size='sm'/></td>
                      <td style={{ padding:'10px 12px', fontSize:17, fontWeight:900, color:'#b45309' }}>{a.totalOrders||a.actualCount||0}</td>
                      <td style={{ padding:'10px 12px', fontSize:12 }}>
                        {(a.promos||[]).filter(p=>p.qty>0).map((p,pi)=>(
                          <span key={pi} style={{ background:'#fef3c7', color:'#92400e', border:'1px solid #fde68a', borderRadius:99, padding:'1px 8px', fontSize:11.5, fontWeight:700, marginRight:4, display:'inline-block' }}>
                            {p.name}: {p.qty}
                          </span>
                        ))}
                        {!(a.promos||[]).filter(p=>p.qty>0).length && '—'}
                      </td>
                      {isSuperAdmin && <td style={{ padding:'10px 12px', fontSize:13, fontWeight:700, color:'#059669' }}>
                        {a.saleAmount>0?`฿${parseFloat(a.saleAmount).toLocaleString()}`:'—'}
                      </td>}
                      <td style={{ padding:'10px 12px', fontSize:12.5, color:'#6b7280' }}>{a.note||'—'}</td>
                      <td style={{ padding:'10px 12px', display:'flex', gap:6 }}>
                        {canEdit && <>
                          <button onClick={()=>openEdit(a)}
                            style={{ background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:7, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#4338ca', fontSize:12 }}>✏️</button>
                          <button onClick={()=>setConfirm(a.id)}
                            style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:7, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#be123c' }}>
                            <Trash2 size={12}/>
                          </button>
                        </>}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ CONFIRM DELETE ══════════════════════════════ */}
      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }}>
          <div style={{ background:'#fff', borderRadius:20, padding:28, maxWidth:340, width:'100%', textAlign:'center', boxShadow:'0 20px 50px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🗑️</div>
            <div style={{ fontSize:17, fontWeight:900, color:'#1e1b4b', marginBottom:8 }}>ลบข้อมูลหลังบ้าน?</div>
            <div style={{ fontSize:13, color:'#6b7280', marginBottom:22 }}>ไม่สามารถย้อนกลับได้</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={()=>setConfirm(null)} style={{ background:'#f1f5f9', border:'1.5px solid #e0e7ff', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontSize:14, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>ยกเลิก</button>
              <button onClick={async()=>{ await removeAuditOrder(confirm); setConfirm(null) }}
                style={{ background:'linear-gradient(135deg,#be123c,#e11d48)', border:'none', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit' }}>
                ลบเลย
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
