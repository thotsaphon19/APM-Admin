import React, { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { Empty, Alert } from '../../components/ui'
import { Edit2, Trash2, ChevronDown, ChevronUp, RefreshCw, Plus, X } from 'lucide-react'

const today = format(new Date(), 'yyyy-MM-dd')

export default function Commission() {
  const { profile, user, canEdit, isAdmin, isSuperAdmin } = useAuth()
  const { commissions, pages, users, commRates, createCommission, editCommission, removeCommission, getUserName, getPageName } = useData()

  const [showForm,   setShowForm]   = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [confirm,    setConfirm]    = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')
  const [expandRow,  setExpandRow]  = useState(null)
  const [filters,    setFilters]    = useState({ date: today, adminId: '', pageId: '', month: '' })

  const makeBlank = () => ({
    date: today,
    adminId: isAdmin ? (user?.uid || profile?.id || '') : '',
    pageId: '',
    manualOrders: '', manualRate: commRates.manualRate ?? 5,
    aiOrders: '',    aiRate: commRates.aiRate ?? 2,
    cancelOrders: '', unclearOrders: '', note: '',
  })

  const [form, setForm] = useState(makeBlank)
  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const admins  = users.filter(u => ['admin','head_admin'].includes(u.role))
  const myUid   = user?.uid || profile?.id || ''
  const myPages = isAdmin
    ? pages.filter(p =>
        p.assignedTo?.includes(myUid) ||
        p.assignedTo?.includes(profile?.id)
      )
    : pages

  const filtered = useMemo(() => {
    let d = commissions
    // commissions already filtered by DataContext for admin
    // no extra filter needed here
    if (filters.date && !filters.month) d = d.filter(c => c.date === filters.date)
    if (filters.month) d = d.filter(c => c.date?.startsWith(filters.month))
    if (filters.adminId) d = d.filter(c => c.adminId === filters.adminId)
    if (filters.pageId)  d = d.filter(c => c.pageId  === filters.pageId)
    return [...d].sort((a, b) => b.date?.localeCompare(a.date))
  }, [commissions, filters, isAdmin, profile?.id])

  const totals = useMemo(() => filtered.reduce((a, c) => ({
    manualOrders:  a.manualOrders  + (c.manualOrders  || 0),
    aiOrders:      a.aiOrders      + (c.aiOrders      || 0),
    cancelOrders:  a.cancelOrders  + (c.cancelOrders  || 0),
    unclearOrders: a.unclearOrders + (c.unclearOrders || 0),
    manualTotal:   a.manualTotal   + (c.manualTotal   || 0),
    aiTotal:       a.aiTotal       + (c.aiTotal       || 0),
    total:         a.total         + (c.total         || 0),
  }), { manualOrders:0, aiOrders:0, cancelOrders:0, unclearOrders:0, manualTotal:0, aiTotal:0, total:0 }), [filtered])

  const manual  = (parseFloat(form.manualOrders)||0) * (parseFloat(form.manualRate)||0)
  const ai      = (parseFloat(form.aiOrders)||0)     * (parseFloat(form.aiRate)||0)
  const grandPv = manual + ai

  const openAdd = () => {
    setForm(makeBlank()); setEditItem(null); setErr(''); setShowForm(true)
    setTimeout(() => document.getElementById('comm-form-top')?.scrollIntoView({ behavior:'smooth' }), 100)
  }

  const openEdit = item => {
    setForm({ ...item }); setEditItem(item); setErr(''); setShowForm(true)
    setTimeout(() => document.getElementById('comm-form-top')?.scrollIntoView({ behavior:'smooth' }), 100)
  }

  const handleSave = async () => {
    if (!form.adminId || !form.pageId || !form.date) { setErr('กรุณากรอก วันที่ / แอดมิน / เพจ ให้ครบ'); return }
    setSaving(true); setErr('')
    try {
      const data = {
        ...form,
        manualOrders:  parseInt(form.manualOrders)  || 0,
        manualRate:    parseFloat(form.manualRate)   || 0,
        aiOrders:      parseInt(form.aiOrders)       || 0,
        aiRate:        parseFloat(form.aiRate)       || 0,
        cancelOrders:  parseInt(form.cancelOrders)   || 0,
        unclearOrders: parseInt(form.unclearOrders)  || 0,
      }
      if (editItem) await editCommission(editItem.id, data)
      else await createCommission(data)
      setShowForm(false); setForm(makeBlank()); setEditItem(null)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const S = { // shared input style
    width:'100%', background:'#fff', border:'1.5px solid #dde3f5',
    borderRadius:10, color:'#1e1b4b', fontFamily:'inherit',
    fontSize:14, padding:'9px 12px', outline:'none',
    transition:'border-color .18s',
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:900, color:'#1e1b4b', marginBottom:3 }}>💰 ค่าคอมมิชชั่น</h2>
          <p style={{ fontSize:12.5, color:'#6b7280' }}>
            ลงข้อมูลรายวัน แยก 🖐 ตอบมือ / 🤖 AI &nbsp;·&nbsp;
            <span style={{ color:'#7c3aed', fontWeight:700 }}>มือ ฿{commRates.manualRate}/บ้าน</span>
            &nbsp;·&nbsp;
            <span style={{ color:'#0d9488', fontWeight:700 }}>AI ฿{commRates.aiRate}/บ้าน</span>
          </p>
        </div>
        {canEdit && !showForm && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16}/> ✏️ ลงข้อมูลวันนี้
          </button>
        )}
      </div>

      {/* ── Summary KPI ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
        {[
          { emoji:'💎', label:'ค่าคอมรวม',       val:`฿${totals.total.toLocaleString()}`,            bg:'linear-gradient(135deg,#eef2ff,#e0e7ff)', valColor:'#4338ca', border:'#c7d2fe' },
          { emoji:'🖐',  label:'ตอบมือ (บ้าน)',   val:`${totals.manualOrders.toLocaleString()} บ้าน`, bg:'linear-gradient(135deg,#f5f3ff,#ede9fe)', valColor:'#6d28d9', border:'#ddd6fe', sub:`฿${totals.manualTotal.toLocaleString()}` },
          { emoji:'🤖', label:'AI (บ้าน)',         val:`${totals.aiOrders.toLocaleString()} บ้าน`,    bg:'linear-gradient(135deg,#f0fdfa,#ccfbf1)', valColor:'#0f766e', border:'#99f6e4', sub:`฿${totals.aiTotal.toLocaleString()}` },
          { emoji:'❌', label:'ยกเลิก / ไม่ชัด',  val:totals.cancelOrders,                          bg:'linear-gradient(135deg,#fff1f2,#ffe4e6)', valColor:'#be123c', border:'#fecdd3', sub:`${totals.unclearOrders} ไม่ชัดเจน` },
        ].map((k,i) => (
          <div key={i} style={{ background:k.bg, border:`1.5px solid ${k.border}`, borderRadius:16, padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:26, marginBottom:8 }}>{k.emoji}</div>
            <div style={{ fontSize:22, fontWeight:900, color:k.valColor, lineHeight:1 }}>{k.val}</div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:5, fontWeight:600 }}>{k.label}</div>
            {k.sub && <div style={{ fontSize:11, color:'#9ca3af', marginTop:3 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── FORM (inline, not modal) ── */}
      {showForm && (
        <div id="comm-form-top" style={{
          background:'#fff', border:'2px solid #6366f1',
          borderRadius:20, padding:28, boxShadow:'0 8px 32px rgba(99,102,241,.15)',
          position:'relative',
        }}>
          {/* Form header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:44, height:44, borderRadius:14, background:'linear-gradient(135deg,#6366f1,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                {editItem ? '✏️' : '📝'}
              </div>
              <div>
                <div style={{ fontSize:18, fontWeight:900, color:'#1e1b4b' }}>
                  {editItem ? 'แก้ไขข้อมูลค่าคอม' : 'ลงข้อมูลค่าคอม'}
                </div>
                <div style={{ fontSize:12, color:'#9ca3af' }}>กรอกข้อมูลให้ครบทุกช่อง</div>
              </div>
            </div>
            <button onClick={() => setShowForm(false)}
              style={{ background:'#f1f5f9', border:'none', borderRadius:10, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}>
              <X size={16}/>
            </button>
          </div>

          {err && (
            <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:10, padding:'10px 14px', color:'#be123c', fontSize:13.5, marginBottom:18, display:'flex', gap:8 }}>
              <span>❌</span>{err}
            </div>
          )}

          {/* Row 1: วันที่ + แอดมิน */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
                📅 วันที่ทำงาน *
              </label>
              <input type="date" style={S} value={form.date} onChange={setF('date')} required/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
                👤 ชื่อแอดมิน *
              </label>
              <select style={S} value={form.adminId} onChange={setF('adminId')} disabled={isAdmin} required>
                <option value="">-- เลือกแอดมิน --</option>
                {admins.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          {/* เพจ */}
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
              📄 เพจที่รับผิดชอบ *
            </label>
            {myPages.length === 0 ? (
              <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:10, padding:'12px 14px', color:'#9a3412', fontSize:13, display:'flex', gap:8 }}>
                ⚠️ ยังไม่ได้รับมอบหมายเพจ — กรุณาติดต่อหัวหน้าแอดมิน
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
                {myPages.map(p => {
                  const selected = form.pageId === p.id
                  return (
                    <label key={p.id}
                      onClick={() => setForm(prev => ({ ...prev, pageId: p.id }))}
                      style={{
                        display:'flex', alignItems:'center', gap:10,
                        padding:'10px 14px', borderRadius:12, cursor:'pointer',
                        border: selected ? '2px solid #6366f1' : '1.5px solid #dde3f5',
                        background: selected ? 'linear-gradient(135deg,#eef2ff,#e0e7ff)' : '#fff',
                        transition:'all .15s', boxShadow: selected ? '0 2px 12px rgba(99,102,241,.2)' : 'none',
                      }}>
                      <div style={{
                        width:32, height:32, borderRadius:9, flexShrink:0,
                        background: p.type==='main' ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : 'linear-gradient(135deg,#d97706,#f59e0b)',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
                      }}>
                        {p.type==='main' ? '⭐' : '🧪'}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color: selected?'#4338ca':'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize:11, color: p.type==='main'?'#6d28d9':'#b45309', fontWeight:600 }}>
                          {p.type==='main'?'เพจหลัก':'เพจทดสอบ'} · {p.status==='active'?'✅ ใช้งาน':'⏸ ปิด'}
                        </div>
                      </div>
                      {selected && (
                        <div style={{ width:20, height:20, borderRadius:'50%', background:'#6366f1', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <span style={{ color:'#fff', fontSize:12, fontWeight:900 }}>✓</span>
                        </div>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
            {form.pageId && (() => {
              const pg = myPages.find(p => p.id === form.pageId)
              return pg ? (
                <div style={{ marginTop:8, background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:9, padding:'8px 12px', fontSize:12.5, color:'#4338ca', display:'flex', gap:6 }}>
                  ✅ เลือก: <strong>{pg.name}</strong>
                </div>
              ) : null
            })()}
          </div>

          {/* ── ตอบมือ block ── */}
          <div style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', border:'2px solid #ddd6fe', borderRadius:16, padding:18, marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#6d28d9', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
              🖐 ตอบมือ
              <span style={{ fontSize:11, fontWeight:600, color:'#8b5cf6', background:'#ede9fe', padding:'2px 8px', borderRadius:99 }}>
                แอดมินตอบเอง — ค่าคอมสูงกว่า
              </span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#7c3aed', marginBottom:5 }}>จำนวนออเดอร์ (บ้าน)</label>
                <input type="number" min="0" style={{ ...S, textAlign:'center', fontSize:16, fontWeight:800, color:'#6d28d9' }}
                  placeholder="0" value={form.manualOrders} onChange={setF('manualOrders')}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#7c3aed', marginBottom:5 }}>ค่าคอม / บ้าน (฿)</label>
                <input type="number" min="0" step="0.5" style={{ ...S, textAlign:'center' }}
                  value={form.manualRate} onChange={setF('manualRate')}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#7c3aed', marginBottom:5 }}>ยอดค่าคอมตอบมือ</label>
                <div style={{ ...S, background:'#ede9fe', border:'2px solid #c4b5fd', textAlign:'center', fontSize:17, fontWeight:900, color:'#6d28d9' }}>
                  ฿{manual.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* ── AI block ── */}
          <div style={{ background:'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border:'2px solid #99f6e4', borderRadius:16, padding:18, marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#0f766e', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
              🤖 ตอบด้วย AI
              <span style={{ fontSize:11, fontWeight:600, color:'#0d9488', background:'#ccfbf1', padding:'2px 8px', borderRadius:99 }}>
                AI ตอบแทน — ค่าคอมน้อยกว่า
              </span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#0d9488', marginBottom:5 }}>จำนวนออเดอร์ (บ้าน)</label>
                <input type="number" min="0" style={{ ...S, textAlign:'center', fontSize:16, fontWeight:800, color:'#0f766e' }}
                  placeholder="0" value={form.aiOrders} onChange={setF('aiOrders')}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#0d9488', marginBottom:5 }}>ค่าคอม / บ้าน (฿)</label>
                <input type="number" min="0" step="0.5" style={{ ...S, textAlign:'center' }}
                  value={form.aiRate} onChange={setF('aiRate')}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#0d9488', marginBottom:5 }}>ยอดค่าคอม AI</label>
                <div style={{ ...S, background:'#ccfbf1', border:'2px solid #5eead4', textAlign:'center', fontSize:17, fontWeight:900, color:'#0f766e' }}>
                  ฿{ai.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* ── ออเดอร์มีปัญหา ── */}
          <div style={{ background:'linear-gradient(135deg,#fff1f2,#ffe4e6)', border:'2px solid #fecdd3', borderRadius:16, padding:18, marginBottom:20 }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#be123c', marginBottom:14 }}>
              ⚠️ ออเดอร์มีปัญหา
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#e11d48', marginBottom:5 }}>❌ จำนวนออเดอร์ยกเลิก (บ้าน)</label>
                <input type="number" min="0" style={{ ...S, textAlign:'center', color:'#be123c', fontWeight:700 }}
                  placeholder="0" value={form.cancelOrders} onChange={setF('cancelOrders')}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#e11d48', marginBottom:5 }}>🔍 ชื่อ/ที่อยู่ไม่ชัดเจน (บ้าน)</label>
                <input type="number" min="0" style={{ ...S, textAlign:'center', color:'#d97706', fontWeight:700 }}
                  placeholder="0" value={form.unclearOrders} onChange={setF('unclearOrders')}/>
              </div>
            </div>
          </div>

          {/* หมายเหตุ */}
          <div style={{ marginBottom:22 }}>
            <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
              📝 หมายเหตุ
            </label>
            <textarea style={{ ...S, minHeight:70, resize:'vertical' }}
              placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
              value={form.note} onChange={setF('note')}/>
          </div>

          {/* ── Summary preview ── */}
          <div style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', borderRadius:14, padding:'16px 22px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div style={{ color:'rgba(255,255,255,.85)', fontSize:13 }}>
              <div style={{ fontWeight:700, marginBottom:4 }}>📊 สรุปรายการนี้</div>
              <div style={{ fontSize:12 }}>
                🖐 {form.manualOrders||0} บ้าน + 🤖 {form.aiOrders||0} บ้าน
                {' = '}{(parseInt(form.manualOrders)||0)+(parseInt(form.aiOrders)||0)} บ้านรวม
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.7)', marginBottom:2 }}>ค่าคอมรวม</div>
              <div style={{ fontSize:28, fontWeight:900, color:'#fff' }}>฿{grandPv.toLocaleString()}</div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={() => setShowForm(false)}
              style={{ background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:'9px 20px', fontSize:14, fontWeight:700, color:'#6b7280', cursor:'pointer', fontFamily:'inherit' }}>
              ยกเลิก
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:10, padding:'9px 24px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 14px rgba(99,102,241,.35)', opacity:saving?.6:1 }}>
              {saving ? '⏳ กำลังบันทึก...' : editItem ? '✅ บันทึกการแก้ไข' : '💾 บันทึกข้อมูล'}
            </button>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:'16px 20px', boxShadow:'0 2px 8px rgba(99,102,241,.06)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, alignItems:'end' }}>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>📅 วันที่</label>
            <input type="date" style={S} value={filters.date}
              onChange={e => setFilters(p=>({...p, date:e.target.value, month:''}))}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>📆 หรือเดือน</label>
            <input type="month" style={S} value={filters.month}
              onChange={e => setFilters(p=>({...p, month:e.target.value, date:''}))}/>
          </div>
          {!isAdmin && (
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>👤 แอดมิน</label>
              <select style={S} value={filters.adminId} onChange={e=>setFilters(p=>({...p,adminId:e.target.value}))}>
                <option value="">ทั้งหมด</option>
                {admins.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>📄 เพจ</label>
            <select style={S} value={filters.pageId} onChange={e=>setFilters(p=>({...p,pageId:e.target.value}))}>
              <option value="">ทั้งหมด</option>
              {(isAdmin ? myPages : pages).map(p=>(
                <option key={p.id} value={p.id}>{p.type==='main'?'⭐':'🧪'} {p.name}</option>
              ))}
            </select>
          </div>
          <button onClick={()=>setFilters({date:today,adminId:'',pageId:'',month:''})}
            style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:10, padding:'9px 14px', cursor:'pointer', fontSize:13, fontWeight:700, color:'#4338ca', display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' }}>
            <RefreshCw size={13}/> รีเซ็ต
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 8px rgba(99,102,241,.06)' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom:'2px solid #e0e7ff' }}>
                {['📅 วันที่','👤 แอดมิน','📄 เพจ','🖐 มือ (บ้าน)','฿มือ','🤖 AI (บ้าน)','฿AI','❌ ยกเลิก','🔍 ไม่ชัด','💎 รวม',''].map((h,i)=>(
                  <th key={i} style={{ padding:'11px 13px', textAlign:i>=3?'center':'left', fontSize:11, fontWeight:800, color:'#6366f1', letterSpacing:'.06em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={10}><Empty title="ไม่มีข้อมูล" sub="ลองเปลี่ยนตัวกรอง หรือกด ลงข้อมูลวันนี้"/></td></tr>
              ) : filtered.map(c => (
                <React.Fragment key={c.id}>
                  <tr style={{ borderBottom:'1px solid #f0f4ff', transition:'background .15s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#fafbff'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'12px 13px', fontSize:13, color:'#4b5563', whiteSpace:'nowrap' }}>📅 {c.date}</td>
                    <td style={{ padding:'12px 13px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                          {getUserName(c.adminId).slice(0,2)}
                        </div>
                        <span style={{ fontSize:13, fontWeight:600, color:'#1e1b4b' }}>{getUserName(c.adminId)}</span>
                      </div>
                    </td>
                    <td style={{ padding:'12px 13px', fontSize:13, color:'#4b5563', maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{getPageName(c.pageId)}</td>

                    <td style={{ textAlign:'center', padding:'12px 8px' }}>
                      <span style={{ fontSize:15, fontWeight:800, color:'#6d28d9' }}>{c.manualOrders||0}</span>
                    </td>
                    <td style={{ textAlign:'center', padding:'12px 8px', fontSize:12, color:'#7c3aed', fontWeight:600 }}>฿{(c.manualTotal||0).toLocaleString()}</td>

                    <td style={{ textAlign:'center', padding:'12px 8px' }}>
                      <span style={{ fontSize:15, fontWeight:800, color:'#0f766e' }}>{c.aiOrders||0}</span>
                    </td>
                    <td style={{ textAlign:'center', padding:'12px 8px', fontSize:12, color:'#0d9488', fontWeight:600 }}>฿{(c.aiTotal||0).toLocaleString()}</td>

                    <td style={{ textAlign:'center', padding:'12px 8px' }}>
                      <span style={{ fontSize:14, fontWeight:700, color:(c.cancelOrders||0)>0?'#be123c':'#9ca3af' }}>{c.cancelOrders||0}</span>
                    </td>
                    <td style={{ textAlign:'center', padding:'12px 8px' }}>
                      <span style={{ fontSize:14, fontWeight:700, color:(c.unclearOrders||0)>0?'#d97706':'#9ca3af' }}>{c.unclearOrders||0}</span>
                    </td>

                    <td style={{ textAlign:'right', padding:'12px 13px' }}>
                      <span style={{ fontSize:16, fontWeight:900, color:'#4338ca' }}>฿{(c.total||0).toLocaleString()}</span>
                    </td>
                    <td style={{ padding:'8px 10px' }}>
                      <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                        <button onClick={()=>setExpandRow(expandRow===c.id?null:c.id)}
                          style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:8, width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6366f1' }}>
                          {expandRow===c.id?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
                        </button>
                        {canEdit && (profile?.role!=='admin'||c.adminId===profile?.id) && (
                          <button onClick={()=>openEdit(c)}
                            style={{ background:'#f0fdf4', border:'1.5px solid #bbf7d0', borderRadius:8, width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#059669' }}>
                            <Edit2 size={12}/>
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button onClick={()=>setConfirm(c.id)}
                            style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:8, width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#be123c' }}>
                            <Trash2 size={12}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expand detail */}
                  {expandRow===c.id && (
                    <tr>
                      <td colSpan={11} style={{ padding:0 }}>
                        <div style={{ background:'linear-gradient(135deg,#fafbff,#f5f3ff)', borderTop:'1px solid #e0e7ff', borderBottom:'1px solid #e0e7ff', padding:'16px 20px' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                            {[
                              { emoji:'🖐', label:'ตอบมือ', items:[`จำนวน: ${c.manualOrders||0} บ้าน`,`ค่าคอม/บ้าน: ฿${c.manualRate||0}`,`รวม: ฿${(c.manualTotal||0).toLocaleString()}`], color:'#6d28d9', bg:'#f5f3ff', border:'#ddd6fe' },
                              { emoji:'🤖', label:'AI',     items:[`จำนวน: ${c.aiOrders||0} บ้าน`,`ค่าคอม/บ้าน: ฿${c.aiRate||0}`,`รวม: ฿${(c.aiTotal||0).toLocaleString()}`], color:'#0f766e', bg:'#f0fdfa', border:'#99f6e4' },
                              { emoji:'⚠️', label:'ปัญหา', items:[`ยกเลิก: ${c.cancelOrders||0} บ้าน`,`ไม่ชัดเจน: ${c.unclearOrders||0} บ้าน`], color:'#be123c', bg:'#fff1f2', border:'#fecdd3' },
                              { emoji:'💎', label:'รวม',    items:[`ออเดอร์ทั้งหมด: ${(c.manualOrders||0)+(c.aiOrders||0)} บ้าน`, c.note?`หมายเหตุ: ${c.note}`:'ไม่มีหมายเหตุ'], color:'#4338ca', bg:'#eef2ff', border:'#c7d2fe' },
                            ].map((d,i)=>(
                              <div key={i} style={{ background:d.bg, border:`1.5px solid ${d.border}`, borderRadius:12, padding:14 }}>
                                <div style={{ fontSize:13, fontWeight:800, color:d.color, marginBottom:8 }}>{d.emoji} {d.label}</div>
                                {d.items.map((it,j)=>(
                                  <div key={j} style={{ fontSize:12.5, color:'#4b5563', marginBottom:4 }}>{it}</div>
                                ))}
                                {d.label==='รวม'&&(
                                  <div style={{ fontSize:20, fontWeight:900, color:'#4338ca', marginTop:8 }}>฿{(c.total||0).toLocaleString()}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}

              {/* Footer totals */}
              {filtered.length>0&&(
                <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderTop:'2px solid #c7d2fe' }}>
                  <td colSpan={3} style={{ padding:'12px 13px', fontSize:12, fontWeight:800, color:'#4338ca' }}>
                    รวม {filtered.length} รายการ
                  </td>
                  <td style={{ textAlign:'center', padding:'12px 8px', fontSize:15, fontWeight:900, color:'#6d28d9' }}>{totals.manualOrders.toLocaleString()}</td>
                  <td style={{ textAlign:'center', fontSize:12, fontWeight:700, color:'#7c3aed' }}>฿{totals.manualTotal.toLocaleString()}</td>
                  <td style={{ textAlign:'center', fontSize:15, fontWeight:900, color:'#0f766e' }}>{totals.aiOrders.toLocaleString()}</td>
                  <td style={{ textAlign:'center', fontSize:12, fontWeight:700, color:'#0d9488' }}>฿{totals.aiTotal.toLocaleString()}</td>
                  <td style={{ textAlign:'center', fontSize:14, fontWeight:800, color:'#be123c' }}>{totals.cancelOrders}</td>
                  <td style={{ textAlign:'center', fontSize:14, fontWeight:800, color:'#d97706' }}>{totals.unclearOrders}</td>
                  <td style={{ textAlign:'right', padding:'12px 13px', fontSize:18, fontWeight:900, color:'#4338ca' }}>฿{totals.total.toLocaleString()}</td>
                  <td/>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm delete */}
      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(99,102,241,.25)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:20, padding:28, maxWidth:380, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,.15)', border:'1.5px solid #e0e7ff' }}>
            <div style={{ fontSize:40, textAlign:'center', marginBottom:14 }}>🗑️</div>
            <div style={{ fontSize:18, fontWeight:900, color:'#1e1b4b', marginBottom:8, textAlign:'center' }}>ลบรายการนี้?</div>
            <div style={{ fontSize:13.5, color:'#6b7280', textAlign:'center', marginBottom:22 }}>การลบไม่สามารถย้อนกลับได้</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setConfirm(null)}
                style={{ flex:1, background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:'10px', fontSize:14, fontWeight:700, color:'#6b7280', cursor:'pointer', fontFamily:'inherit' }}>
                ยกเลิก
              </button>
              <button onClick={async()=>{ await removeCommission(confirm); setConfirm(null) }}
                style={{ flex:1, background:'linear-gradient(135deg,#e11d48,#f43f5e)', border:'none', borderRadius:10, padding:'10px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
                🗑️ ลบ
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
