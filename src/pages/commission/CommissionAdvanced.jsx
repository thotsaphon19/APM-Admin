import React, { useState, useMemo } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { useNotify } from '../../hooks/useNotify'
import { Alert, Avatar } from '../../components/ui'
import {
  Scale, AlertTriangle, CheckCircle2, Upload, Plus,
  Trash2, ChevronDown, ChevronUp, X, RefreshCw, Calculator,
  ArrowRight, TrendingDown, Moon, Download,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { computeDailyPayroll, calcMissingDeduction } from '../../lib/commissionEngine'

const today = format(new Date(), 'yyyy-MM-dd')
const S = { background:'#fff', border:'1.5px solid #dde3f5', borderRadius:10, color:'#1e1b4b', fontFamily:'inherit', fontSize:13.5, padding:'9px 12px', outline:'none', width:'100%' }

export default function CommissionAdvanced() {
  const { profile, user, isSuperAdmin, canManage } = useAuth()
  const {
    commissions, backendOrders, cancelledOrders, commRates,
    pages, users, importBackendOrders, createCancelledOrder, removeCancelledOrder,
    savePayroll, getUserName, getPageName,
  } = useData()
  const { notifyCustom } = useNotify()

  const [tab,         setTab]         = useState('compare')
  const [calcDate,    setCalcDate]    = useState(today)
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState('')
  const [expandRow,   setExpandRow]   = useState(null)

  // Backend import form
  const [backendForm, setBackendForm] = useState({ pageId:'', date:today, actualCount:'', source:'manual' })
  const setBF = k => e => setBackendForm(p => ({...p, [k]: e.target.value}))

  // Cancel order form
  const [cancelForm,  setCancelForm]  = useState({ originalDate:today, pageId:'', amount:'', cancelType:'manual', note:'' })
  const setCF = k => e => setCancelForm(p => ({...p, [k]: e.target.value}))

  // Night shift form for cross-midnight split
  const [nightForm, setNightForm] = useState({ pageId:'', shiftDate:today, beforeMidnight:0, afterMidnight:0, adminId:'', rate: commRates.manualRate })
  const setNF = k => e => setNightForm(p => ({...p, [k]: e.target.value}))

  // ── Computed payroll ──────────────────────────────
  const payrollResults = useMemo(() =>
    computeDailyPayroll({
      date: calcDate,
      commissions,
      backendOrders,
      cancelledOrders,
      commRates,
    }),
    [calcDate, commissions, backendOrders, cancelledOrders, commRates]
  )

  // Group by admin for summary
  const adminSummary = useMemo(() => {
    const map = {}
    payrollResults.forEach(r => {
      if (!map[r.adminId]) map[r.adminId] = { adminId:r.adminId, pages:[], gross:0, totalDed:0, net:0, missingOrders:0, cancelDed:0 }
      map[r.adminId].pages.push(r)
      map[r.adminId].gross       += r.gross
      map[r.adminId].totalDed    += r.totalDeductions
      map[r.adminId].net         += r.net
      map[r.adminId].missingOrders += r.missingOrders
      map[r.adminId].cancelDed   += r.cancelDeduction
    })
    return Object.values(map).sort((a,b) => b.net - a.net)
  }, [payrollResults])

  // Page comparison
  const pageCompare = useMemo(() => {
    const dayComms   = commissions.filter(c => c.date === calcDate)
    const dayBackend = backendOrders.filter(b => b.date === calcDate)
    const pagesWithData = [...new Set([
      ...dayComms.map(c=>c.pageId),
      ...dayBackend.map(b=>b.pageId),
    ])]
    return pagesWithData.map(pageId => {
      const admitted  = dayComms.filter(c=>c.pageId===pageId)
      const submitted = admitted.reduce((s,a)=>s+(a.manualOrders||0)+(a.aiOrders||0),0)
      const backend   = dayBackend.find(b=>b.pageId===pageId)
      const actual    = backend?.actualCount || 0
      const missing   = actual > 0 ? Math.max(0, actual - submitted) : 0
      const excess    = actual > 0 ? Math.max(0, submitted - actual) : 0
      return { pageId, submitted, actual, missing, excess, admins: admitted }
    })
  }, [commissions, backendOrders, calcDate])

  // Cancelled orders for date
  const dayCancel = cancelledOrders.filter(c => c.originalDate === calcDate)

  // ── Night shift submit ────────────────────────────
  const handleNightShift = async () => {
    const bf = parseFloat(nightForm.beforeMidnight) || 0
    const af = parseFloat(nightForm.afterMidnight)  || 0
    const rate = parseFloat(nightForm.rate) || commRates.manualRate
    const nextDate = format(addDays(parseISO(nightForm.shiftDate), 1), 'yyyy-MM-dd')

    if (!nightForm.adminId || !nightForm.pageId || (bf+af) === 0) {
      setErr('กรอกข้อมูลให้ครบ'); return
    }
    // This would normally call createCommission twice
    notifyCustom({ type:'commission', title:'🌙 บันทึกกะกลางคืนข้ามวัน', message:`${profile?.name} บันทึก ${bf} บ้าน (${nightForm.shiftDate}) + ${af} บ้าน (${nextDate})`, link:'/commission-advanced', targetRoles:['superadmin','head_admin','assistant'] })
    alert(`✅ แยกบันทึก:\n• ก่อน 00:00 → ${bf} บ้าน (${nightForm.shiftDate})\n• หลัง 00:00 → ${af} บ้าน (${nextDate})\n\nกรุณาไปที่หน้า "ค่าคอมมิชชั่น" แล้วลง 2 รายการตามนี้`)
  }

  // ── Save payroll snapshot ─────────────────────────
  const handleSavePayroll = async () => {
    if (!payrollResults.length) return
    setSaving(true)
    try {
      await savePayroll(calcDate, payrollResults)
      notifyCustom({ type:'system', title:'💾 บันทึก Payroll', message:`${profile?.name} บันทึกยอดค่าคอมวันที่ ${calcDate}`, link:'/commission-advanced', targetRoles:['superadmin'] })
      setErr('')
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  // ── Import backend orders ─────────────────────────
  const handleImportBackend = async () => {
    if (!backendForm.pageId || !backendForm.actualCount) { setErr('กรอกข้อมูลให้ครบ'); return }
    setSaving(true)
    try {
      await importBackendOrders({
        pageId:      backendForm.pageId,
        date:        backendForm.date,
        actualCount: parseInt(backendForm.actualCount)||0,
        source:      backendForm.source,
        importedBy:  user?.uid || profile?.id,
      })
      notifyCustom({ type:'verify', title:'📥 นำเข้าออเดอร์จากหลังบ้าน', message:`${getPageName(backendForm.pageId)} วันที่ ${backendForm.date}: ${backendForm.actualCount} บ้าน`, link:'/commission-advanced', targetRoles:['superadmin','head_admin'] })
      setBackendForm(p=>({...p, actualCount:''}))
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  // ── Add cancelled order ───────────────────────────
  const handleAddCancel = async () => {
    if (!cancelForm.pageId || !cancelForm.amount) { setErr('กรอกข้อมูลให้ครบ'); return }
    setSaving(true)
    try {
      await createCancelledOrder({
        originalDate: cancelForm.originalDate,
        pageId:       cancelForm.pageId,
        amount:       parseFloat(cancelForm.amount)||0,
        cancelType:   cancelForm.cancelType,
        note:         cancelForm.note,
        createdBy:    user?.uid || profile?.id,
      })
      notifyCustom({ type:'commission', title:`❌ ออเดอร์ยกเลิก`, message:`เพจ ${getPageName(cancelForm.pageId)} วันที่ ${cancelForm.originalDate}: ฿${cancelForm.amount}`, link:'/commission-advanced', targetRoles:['superadmin','head_admin','assistant'] })
      setCancelForm(p=>({...p, amount:'', note:''}))
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  // ── Export ────────────────────────────────────────
  const exportPayroll = () => {
    const wb = XLSX.utils.book_new()
    const rows = [
      ['แอดมิน','เพจ','สัดส่วน','ออเดอร์มือ','ออเดอร์ AI','รวมออเดอร์','ค่าคอมรวม','หักออเดอร์หาย','หักยกเลิก','รวมหัก','ค่าคอมสุทธิ'],
      ...payrollResults.map(r=>[
        getUserName(r.adminId), getPageName(r.pageId),
        `${Math.round(r.ratio*100)}%`,
        r.manualOrders, r.aiOrders, r.totalOrders,
        r.gross, r.missingDeduction, r.cancelDeduction, r.totalDeductions, r.net,
      ])
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'ค่าคอมสุทธิ')

    // Summary sheet
    const sumRows = [
      ['แอดมิน','ค่าคอมรวม','รวมหัก','สุทธิ','ออเดอร์หาย'],
      ...adminSummary.map(a=>[getUserName(a.adminId), a.gross, a.totalDed, a.net, a.missingOrders])
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumRows), 'สรุปรายคน')

    XLSX.writeFile(wb, `payroll_${calcDate}.xlsx`)
  }

  const admins = users.filter(u => ['admin','head_admin'].includes(u.role))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:900, color:'#1e1b4b', marginBottom:3 }}>⚖️ คำนวณค่าคอมขั้นสูง</h2>
          <p style={{ fontSize:12.5, color:'#6b7280' }}>
            เทียบหลังบ้าน · หักออเดอร์หาย/ยกเลิก · เฉลี่ยหลายแอดมินต่อเพจ · กะกลางคืนข้ามวัน
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={exportPayroll} style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:10, padding:'8px 16px', cursor:'pointer', fontSize:13, fontWeight:700, color:'#c2410c', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
            <Download size={14}/> Export Excel
          </button>
          {isSuperAdmin && payrollResults.length > 0 && (
            <button onClick={handleSavePayroll} disabled={saving} style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:10, padding:'8px 18px', cursor:'pointer', fontSize:13.5, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 12px rgba(99,102,241,.3)' }}>
              💾 {saving?'กำลังบันทึก...':'บันทึก Snapshot'}
            </button>
          )}
        </div>
      </div>

      {err && <Alert type="error">{err}</Alert>}

      {/* Date selector */}
      <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:14, padding:'14px 20px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <div style={{ fontSize:14, fontWeight:800, color:'#1e1b4b' }}>📅 คำนวณสำหรับวันที่</div>
        <input type="date" style={{ ...S, width:'auto' }} value={calcDate} onChange={e=>setCalcDate(e.target.value)}/>
        <div style={{ fontSize:13, color:'#6b7280', fontWeight:600 }}>
          {format(parseISO(calcDate),'EEEE d MMMM yyyy',{locale:th})}
        </div>
        <span style={{ marginLeft:'auto', background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:99, padding:'4px 14px', fontSize:13, fontWeight:700, color:'#4338ca' }}>
          {payrollResults.length} รายการ
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:12, padding:4, gap:3, width:'fit-content', flexWrap:'wrap' }}>
        {[
          { k:'compare',  label:'🔍 เทียบหลังบ้าน' },
          { k:'result',   label:'💎 ผลคำนวณ' },
          { k:'cancel',   label:`❌ ยกเลิก (${dayCancel.length})` },
          { k:'night',    label:'🌙 กะข้ามวัน' },
          { k:'backend',  label:'📥 นำเข้าหลังบ้าน' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding:'8px 16px', borderRadius:9, border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', whiteSpace:'nowrap',
              background: tab===t.k ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : 'transparent',
              color: tab===t.k ? '#fff' : '#6366f1',
              boxShadow: tab===t.k ? '0 3px 10px rgba(99,102,241,.3)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: COMPARE ═══ */}
      {tab === 'compare' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:12, padding:'12px 16px', fontSize:13, color:'#92400e', display:'flex', gap:8 }}>
            <AlertTriangle size={16} style={{ flexShrink:0, marginTop:1 }}/>
            เปรียบเทียบยอดที่แอดมินลง vs ยอดจริงจากหลังบ้าน ถ้าหาย → หักค่าคอมตามสัดส่วน
          </div>

          {pageCompare.length === 0 ? (
            <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:40, textAlign:'center', color:'#9ca3af' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>🔍</div>
              <div style={{ fontSize:14, color:'#6b7280', fontWeight:600 }}>ยังไม่มีข้อมูลวันที่เลือก</div>
              <div style={{ fontSize:12.5, marginTop:4 }}>ลงข้อมูลค่าคอมก่อน แล้วนำเข้ายอดหลังบ้านในแท็บ "นำเข้าหลังบ้าน"</div>
            </div>
          ) : pageCompare.map((p, i) => {
            const hasBackend = p.actual > 0
            const isOk     = hasBackend && p.missing === 0 && p.excess === 0
            const hasMiss  = hasBackend && p.missing > 0
            const hasExcess= hasBackend && p.excess  > 0
            const cardBorder = isOk?'#bbf7d0':hasMiss?'#fecdd3':hasExcess?'#fde68a':'#e0e7ff'
            const cardBg    = isOk?'#f0fdf4':hasMiss?'#fff1f2':hasExcess?'#fffbeb':'#fafbff'

            return (
              <div key={p.pageId} style={{ background:cardBg, border:`1.5px solid ${cardBorder}`, borderRadius:16, padding:18, boxShadow:'0 2px 8px rgba(0,0,0,.04)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10 }}>
                  <div style={{ fontWeight:900, fontSize:16, color:'#1e1b4b' }}>
                    {pages.find(pg=>pg.id===p.pageId)?.type==='main'?'⭐':'🧪'} {getPageName(p.pageId)}
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {!hasBackend && <span style={{ background:'#f1f5f9', color:'#9ca3af', border:'1.5px solid #e5e7eb', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:700 }}>➖ ยังไม่มีข้อมูลหลังบ้าน</span>}
                    {isOk     && <span style={{ background:'#dcfce7', color:'#059669', border:'1.5px solid #bbf7d0', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:800 }}>✅ ตรงกัน</span>}
                    {hasMiss  && <span style={{ background:'#fee2e2', color:'#be123c', border:'1.5px solid #fca5a5', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:800 }}>⚠️ หาย {p.missing} บ้าน</span>}
                    {hasExcess&& <span style={{ background:'#fef9c3', color:'#854d0e', border:'1.5px solid #fde68a', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:800 }}>❓ เกิน {p.excess} บ้าน</span>}
                  </div>
                </div>

                {/* Comparison row */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:12, alignItems:'center', marginBottom: hasMiss ? 14 : 0 }}>
                  <div style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:12, padding:14, textAlign:'center' }}>
                    <div style={{ fontSize:12, color:'#6b7280', marginBottom:4, fontWeight:600 }}>💼 แอดมินลง</div>
                    <div style={{ fontSize:26, fontWeight:900, color:'#4338ca' }}>{p.submitted}</div>
                    <div style={{ fontSize:12, color:'#9ca3af' }}>บ้าน</div>
                    <div style={{ fontSize:11.5, color:'#6b7280', marginTop:8 }}>
                      {p.admins.map(a => (
                        <div key={a.id} style={{ marginBottom:3 }}>
                          {getUserName(a.adminId)}: {(a.manualOrders||0)+(a.aiOrders||0)} บ้าน
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ textAlign:'center' }}>
                    <ArrowRight size={20} style={{ color:hasMiss?'#be123c':'#9ca3af' }}/>
                    {hasMiss && <div style={{ fontSize:22, marginTop:4 }}>⬇️</div>}
                  </div>

                  <div style={{ background: hasBackend?(isOk?'#f0fdf4':'#fff1f2'):'#f9fafb', border:`1.5px solid ${hasBackend?(isOk?'#bbf7d0':'#fca5a5'):'#e5e7eb'}`, borderRadius:12, padding:14, textAlign:'center' }}>
                    <div style={{ fontSize:12, color:'#6b7280', marginBottom:4, fontWeight:600 }}>🖥️ ข้อมูลหลังบ้าน</div>
                    <div style={{ fontSize:26, fontWeight:900, color:hasBackend?(isOk?'#059669':'#be123c'):'#9ca3af' }}>
                      {hasBackend ? p.actual : '?'}
                    </div>
                    <div style={{ fontSize:12, color:'#9ca3af' }}>บ้าน</div>
                    {hasBackend && (
                      <div style={{ fontSize:11.5, color:'#6b7280', marginTop:8 }}>
                        {backendOrders.find(b=>b.pageId===p.pageId&&b.date===calcDate)?.source || 'manual'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Missing deduction breakdown */}
                {hasMiss && p.admins.length > 0 && (
                  <div style={{ background:'#fee2e2', border:'1.5px solid #fca5a5', borderRadius:12, padding:14, marginTop:10 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#be123c', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                      <TrendingDown size={15}/> หักค่าคอมตามสัดส่วน — หาย {p.missing} บ้าน
                    </div>
                    {calcMissingDeduction(
                      p.actual, p.submitted,
                      p.admins.map(a=>({ adminId:a.adminId, manualOrders:a.manualOrders||0, aiOrders:a.aiOrders||0, manualRate:a.manualRate||commRates.manualRate, aiRate:a.aiRate||commRates.aiRate }))
                    ).map((d,j) => (
                      <div key={j} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, fontSize:13.5 }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>
                          {getUserName(d.adminId).slice(0,2)}
                        </div>
                        <span style={{ flex:1, fontWeight:600 }}>{getUserName(d.adminId)}</span>
                        <span style={{ color:'#9ca3af', fontSize:12 }}>หายส่วนของ {d.missingOrders} บ้าน</span>
                        <span style={{ fontWeight:900, color:'#be123c' }}>−฿{d.deduction.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ TAB: RESULT ═══ */}
      {tab === 'result' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {adminSummary.length === 0 ? (
            <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:40, textAlign:'center', color:'#9ca3af' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>💎</div>
              <div style={{ fontSize:14, color:'#6b7280', fontWeight:600 }}>ยังไม่มีข้อมูลวันที่เลือก</div>
            </div>
          ) : adminSummary.map(a => (
            <div key={a.adminId} style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,.04)' }}>
              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', cursor:'pointer', background: expandRow===a.adminId?'#fafbff':'#fff' }}
                onClick={() => setExpandRow(expandRow===a.adminId?null:a.adminId)}>
                <div style={{ width:42, height:42, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, flexShrink:0 }}>
                  {getUserName(a.adminId).slice(0,2)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:'#1e1b4b' }}>{getUserName(a.adminId)}</div>
                  <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>{a.pages.length} เพจ</div>
                </div>

                {/* Mini stats */}
                <div style={{ display:'flex', gap:20, alignItems:'center' }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>ค่าคอมรวม</div>
                    <div style={{ fontSize:16, fontWeight:900, color:'#4338ca' }}>฿{a.gross.toLocaleString()}</div>
                  </div>
                  {a.totalDed > 0 && (
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>หัก</div>
                      <div style={{ fontSize:16, fontWeight:900, color:'#be123c' }}>−฿{a.totalDed.toLocaleString()}</div>
                    </div>
                  )}
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>สุทธิ</div>
                    <div style={{ fontSize:22, fontWeight:900, color:'#059669' }}>฿{a.net.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ color:'#c7d2fe' }}>{expandRow===a.adminId?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</div>
              </div>

              {/* Expanded: per-page breakdown */}
              {expandRow === a.adminId && (
                <div style={{ borderTop:'1.5px solid #f0f4ff', background:'#fafbff' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom:'1.5px solid #e0e7ff' }}>
                        {['เพจ','สัดส่วน','ออเดอร์มือ','ออเดอร์ AI','฿ค่าคอม','หักหาย','หักยกเลิก','สุทธิ'].map((h,i)=>(
                          <th key={i} style={{ padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {a.pages.map((r,i) => (
                        <tr key={i} style={{ borderBottom:'1px solid #f0f4ff' }}>
                          <td style={{ padding:'10px 14px', fontSize:13.5, fontWeight:700, color:'#1e1b4b' }}>{getPageName(r.pageId)}</td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{ background:'#eef2ff', color:'#4338ca', border:'1.5px solid #c7d2fe', borderRadius:99, padding:'2px 9px', fontSize:12, fontWeight:700 }}>
                              {Math.round(r.ratio*100)}%
                            </span>
                          </td>
                          <td style={{ padding:'10px 14px', fontSize:13.5, fontWeight:700, color:'#7c3aed' }}>{r.manualOrders}</td>
                          <td style={{ padding:'10px 14px', fontSize:13.5, fontWeight:700, color:'#0f766e' }}>{r.aiOrders}</td>
                          <td style={{ padding:'10px 14px', fontSize:13.5, fontWeight:700, color:'#4338ca' }}>฿{r.gross.toLocaleString()}</td>
                          <td style={{ padding:'10px 14px', fontSize:13.5, fontWeight:700, color:r.missingDeduction>0?'#be123c':'#9ca3af' }}>
                            {r.missingDeduction > 0 ? `−฿${r.missingDeduction.toLocaleString()}` : '—'}
                          </td>
                          <td style={{ padding:'10px 14px', fontSize:13.5, fontWeight:700, color:r.cancelDeduction>0?'#be123c':'#9ca3af' }}>
                            {r.cancelDeduction > 0 ? `−฿${r.cancelDeduction.toLocaleString()}` : '—'}
                          </td>
                          <td style={{ padding:'10px 14px', fontSize:15, fontWeight:900, color:'#059669' }}>฿{r.net.toLocaleString()}</td>
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderTop:'2px solid #c7d2fe' }}>
                        <td colSpan={4} style={{ padding:'10px 14px', fontWeight:800, color:'#4338ca', fontSize:13 }}>รวม</td>
                        <td style={{ padding:'10px 14px', fontWeight:900, color:'#4338ca', fontSize:15 }}>฿{a.gross.toLocaleString()}</td>
                        <td style={{ padding:'10px 14px', fontWeight:900, color:'#be123c', fontSize:15 }}>−฿{a.pages.reduce((s,r)=>s+r.missingDeduction,0).toLocaleString()}</td>
                        <td style={{ padding:'10px 14px', fontWeight:900, color:'#be123c', fontSize:15 }}>−฿{a.cancelDed.toLocaleString()}</td>
                        <td style={{ padding:'10px 14px', fontWeight:900, color:'#059669', fontSize:18 }}>฿{a.net.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ TAB: CANCEL ═══ */}
      {tab === 'cancel' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Add cancel form */}
          {canManage && (
            <div style={{ background:'#fff', border:'2px solid #fca5a5', borderRadius:16, padding:22 }}>
              <div style={{ fontSize:15, fontWeight:900, color:'#be123c', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                ❌ บันทึกออเดอร์ยกเลิก
              </div>
              <div style={{ fontSize:13, color:'#6b7280', marginBottom:14, background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:10, padding:'10px 14px' }}>
                💡 ระบบจะหักค่าคอมตามสัดส่วนจากแอดมินทุกคนที่อยู่เพจนั้น วันที่ระบุ
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:14 }}>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📅 วันที่ออเดอร์นั้น</label>
                  <input type="date" style={S} value={cancelForm.originalDate} onChange={setCF('originalDate')}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📄 เพจ</label>
                  <select style={S} value={cancelForm.pageId} onChange={setCF('pageId')}>
                    <option value="">-- เลือกเพจ --</option>
                    {pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>💰 มูลค่าออเดอร์ (฿)</label>
                  <input type="number" style={S} placeholder="249" value={cancelForm.amount} onChange={setCF('amount')}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>ประเภท</label>
                  <select style={S} value={cancelForm.cancelType} onChange={setCF('cancelType')}>
                    <option value="manual">🖐 ตอบมือ</option>
                    <option value="ai">🤖 AI</option>
                  </select>
                </div>
                <div style={{ gridColumn:'span 2' }}>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📝 หมายเหตุ</label>
                  <input style={S} placeholder="เหตุผลยกเลิก..." value={cancelForm.note} onChange={setCF('note')}/>
                </div>
              </div>
              <button onClick={handleAddCancel} disabled={saving}
                style={{ background:'linear-gradient(135deg,#e11d48,#f43f5e)', border:'none', borderRadius:10, padding:'10px 22px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                ❌ {saving?'กำลังบันทึก...':'บันทึกออเดอร์ยกเลิก'}
              </button>
            </div>
          )}

          {/* List of cancelled orders */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(135deg,#fff1f2,#ffe4e6)', padding:'12px 18px', borderBottom:'1.5px solid #fecdd3', fontSize:14, fontWeight:800, color:'#be123c' }}>
              ❌ รายการออเดอร์ยกเลิก ({cancelledOrders.length} รายการ)
            </div>
            {cancelledOrders.length === 0 ? (
              <div style={{ textAlign:'center', padding:28, color:'#9ca3af' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
                <div>ไม่มีออเดอร์ยกเลิก</div>
              </div>
            ) : (
              <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1.5px solid #fecdd3', background:'#fff1f2' }}>
                      {['วันที่ออเดอร์','เพจ','ประเภท','มูลค่า','หมายเหตุ',''].map((h,i)=>(
                        <th key={i} style={{ padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cancelledOrders.map(c => (
                      <tr key={c.id} style={{ borderBottom:'1px solid #fff1f2' }}>
                        <td style={{ padding:'10px 14px', fontSize:13.5, color:'#4b5563', fontWeight:600 }}>{c.originalDate}</td>
                        <td style={{ padding:'10px 14px', fontSize:13.5, fontWeight:700, color:'#1e1b4b' }}>{getPageName(c.pageId)}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ background:'#f5f3ff', color:'#7c3aed', border:'1.5px solid #ddd6fe', borderRadius:99, padding:'2px 9px', fontSize:12, fontWeight:700 }}>
                            {c.cancelType==='manual'?'🖐 มือ':'🤖 AI'}
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:14, fontWeight:800, color:'#be123c' }}>−฿{(c.amount||0).toLocaleString()}</td>
                        <td style={{ padding:'10px 14px', fontSize:12.5, color:'#6b7280' }}>{c.note||'—'}</td>
                        <td style={{ padding:'8px 10px' }}>
                          {isSuperAdmin && (
                            <button onClick={()=>removeCancelledOrder(c.id)} style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:7, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#be123c' }}>
                              <Trash2 size={12}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: NIGHT SHIFT ═══ */}
      {tab === 'night' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', border:'none', borderRadius:18, padding:22, color:'#fff' }}>
            <div style={{ fontSize:16, fontWeight:900, marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
              🌙 กะกลางคืนข้ามวัน
            </div>
            <div style={{ fontSize:13.5, color:'rgba(255,255,255,.75)', lineHeight:1.8 }}>
              ตามข้อกำหนด: ออเดอร์ <strong>ก่อน 00:00</strong> → บันทึกใต้<strong>วันที่เริ่มกะ</strong> |
              ออเดอร์ <strong>หลัง 00:00</strong> → บันทึกใต้<strong>วันถัดไป</strong>
            </div>
          </div>

          <div style={{ background:'#fff', border:'2px solid #4338ca', borderRadius:16, padding:22, boxShadow:'0 4px 16px rgba(67,56,202,.1)' }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#4338ca', marginBottom:18 }}>📋 คำนวณการแบ่งออเดอร์ข้ามวัน</div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14, marginBottom:20 }}>
              <div>
                <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#4338ca', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📅 วันที่เริ่มกะ</label>
                <input type="date" style={S} value={nightForm.shiftDate} onChange={setNF('shiftDate')}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#4338ca', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>👤 แอดมิน</label>
                <select style={S} value={nightForm.adminId} onChange={setNF('adminId')}>
                  <option value="">-- เลือก --</option>
                  {admins.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#4338ca', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📄 เพจ</label>
                <select style={S} value={nightForm.pageId} onChange={setNF('pageId')}>
                  <option value="">-- เลือก --</option>
                  {pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:14, alignItems:'center', marginBottom:20 }}>
              <div style={{ background:'#fffbeb', border:'2px solid #fde68a', borderRadius:14, padding:16, textAlign:'center' }}>
                <div style={{ fontSize:30, marginBottom:6 }}>☀️</div>
                <div style={{ fontSize:13, fontWeight:700, color:'#92400e', marginBottom:8 }}>ก่อน 00:00 ({nightForm.shiftDate})</div>
                <input type="number" min="0" style={{ ...S, textAlign:'center', fontSize:20, fontWeight:900, color:'#b45309', border:'2px solid #fde68a' }}
                  placeholder="0" value={nightForm.beforeMidnight} onChange={setNF('beforeMidnight')}/>
                <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>บ้าน</div>
              </div>
              <div style={{ textAlign:'center', fontSize:20 }}>+</div>
              <div style={{ background:'#eef2ff', border:'2px solid #c7d2fe', borderRadius:14, padding:16, textAlign:'center' }}>
                <div style={{ fontSize:30, marginBottom:6 }}>🌙</div>
                <div style={{ fontSize:13, fontWeight:700, color:'#4338ca', marginBottom:8 }}>
                  หลัง 00:00 ({nightForm.shiftDate ? format(addDays(parseISO(nightForm.shiftDate),1),'dd/MM/yyyy') : '??'})
                </div>
                <input type="number" min="0" style={{ ...S, textAlign:'center', fontSize:20, fontWeight:900, color:'#4338ca', border:'2px solid #c7d2fe' }}
                  placeholder="0" value={nightForm.afterMidnight} onChange={setNF('afterMidnight')}/>
                <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>บ้าน</div>
              </div>
            </div>

            {/* Preview */}
            {(parseFloat(nightForm.beforeMidnight)||0) + (parseFloat(nightForm.afterMidnight)||0) > 0 && nightForm.shiftDate && (
              <div style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', borderRadius:12, padding:'14px 18px', marginBottom:16 }}>
                <div style={{ fontSize:13, color:'rgba(255,255,255,.8)', marginBottom:8 }}>📊 สรุปการบันทึก</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div style={{ background:'rgba(255,255,255,.15)', borderRadius:10, padding:'12px' }}>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,.7)', marginBottom:4 }}>ลงในวันที่ {nightForm.shiftDate}</div>
                    <div style={{ fontSize:20, fontWeight:900, color:'#fff' }}>{parseFloat(nightForm.beforeMidnight)||0} บ้าน</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,.6)', marginTop:3 }}>ค่าคอม ฿{((parseFloat(nightForm.beforeMidnight)||0)*(parseFloat(nightForm.rate)||commRates.manualRate)).toLocaleString()}</div>
                  </div>
                  <div style={{ background:'rgba(255,255,255,.15)', borderRadius:10, padding:'12px' }}>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,.7)', marginBottom:4 }}>ลงในวันที่ {nightForm.shiftDate ? format(addDays(parseISO(nightForm.shiftDate),1),'yyyy-MM-dd') : '??'}</div>
                    <div style={{ fontSize:20, fontWeight:900, color:'#fff' }}>{parseFloat(nightForm.afterMidnight)||0} บ้าน</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,.6)', marginTop:3 }}>ค่าคอม ฿{((parseFloat(nightForm.afterMidnight)||0)*(parseFloat(nightForm.rate)||commRates.manualRate)).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            <button onClick={handleNightShift} style={{ background:'linear-gradient(135deg,#4338ca,#6366f1)', border:'none', borderRadius:11, padding:'11px 24px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:7 }}>
              <Moon size={15}/> คำนวณและดูวิธีบันทึก
            </button>
          </div>
        </div>
      )}

      {/* ═══ TAB: BACKEND IMPORT ═══ */}
      {tab === 'backend' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {canManage && (
            <div style={{ background:'#fff', border:'2px solid #6366f1', borderRadius:16, padding:22, boxShadow:'0 4px 16px rgba(99,102,241,.1)' }}>
              <div style={{ fontSize:15, fontWeight:900, color:'#4338ca', marginBottom:14 }}>📥 นำเข้ายอดจริงจากหลังบ้าน</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:16 }}>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📅 วันที่</label>
                  <input type="date" style={S} value={backendForm.date} onChange={setBF('date')}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📄 เพจ</label>
                  <select style={S} value={backendForm.pageId} onChange={setBF('pageId')}>
                    <option value="">-- เลือกเพจ --</option>
                    {pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>🔢 ยอดออเดอร์จริง</label>
                  <input type="number" min="0" style={S} placeholder="150" value={backendForm.actualCount} onChange={setBF('actualCount')}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>แหล่งข้อมูล</label>
                  <select style={S} value={backendForm.source} onChange={setBF('source')}>
                    <option value="manual">ลงมือ</option>
                    <option value="export">Export จากระบบ</option>
                    <option value="api">API</option>
                  </select>
                </div>
              </div>
              <button onClick={handleImportBackend} disabled={saving}
                style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:10, padding:'10px 22px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                <Upload size={14}/> {saving?'กำลังบันทึก...':'บันทึกยอดหลังบ้าน'}
              </button>
            </div>
          )}

          {/* Existing backend orders */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', padding:'12px 18px', borderBottom:'1.5px solid #e0e7ff', fontSize:14, fontWeight:800, color:'#4338ca' }}>
              📊 ยอดหลังบ้านที่บันทึกแล้ว ({backendOrders.length} รายการ)
            </div>
            {backendOrders.length === 0 ? (
              <div style={{ textAlign:'center', padding:28, color:'#9ca3af' }}>ยังไม่มีข้อมูล</div>
            ) : (
              <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1.5px solid #e0e7ff' }}>
                      {['วันที่','เพจ','ยอดจริง','ที่แอดมินลง','ผลต่าง','แหล่งข้อมูล'].map((h,i)=>(
                        <th key={i} style={{ padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.05em', background:'linear-gradient(135deg,#eef2ff,#f5f3ff)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {backendOrders.map(b => {
                      const subm = commissions.filter(c=>c.pageId===b.pageId&&c.date===b.date).reduce((s,c)=>s+(c.manualOrders||0)+(c.aiOrders||0),0)
                      const diff = b.actualCount - subm
                      return (
                        <tr key={b.id} style={{ borderBottom:'1px solid #f0f4ff' }}>
                          <td style={{ padding:'10px 14px', fontSize:13.5, color:'#4b5563', fontWeight:600 }}>{b.date}</td>
                          <td style={{ padding:'10px 14px', fontSize:13.5, fontWeight:700, color:'#1e1b4b' }}>{getPageName(b.pageId)}</td>
                          <td style={{ padding:'10px 14px', fontSize:15, fontWeight:900, color:'#4338ca' }}>{b.actualCount}</td>
                          <td style={{ padding:'10px 14px', fontSize:15, fontWeight:700, color:'#6b7280' }}>{subm}</td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{
                              background: diff===0?'#f0fdf4':diff<0?'#fff1f2':'#fef9c3',
                              color: diff===0?'#059669':diff<0?'#be123c':'#854d0e',
                              border: `1.5px solid ${diff===0?'#bbf7d0':diff<0?'#fca5a5':'#fef08a'}`,
                              borderRadius:99, padding:'3px 10px', fontSize:13, fontWeight:800,
                            }}>
                              {diff===0?'✅ ตรง':diff>0?`+${diff} เกิน`:`${diff} หาย`}
                            </span>
                          </td>
                          <td style={{ padding:'10px 14px', fontSize:12.5, color:'#9ca3af' }}>{b.source||'—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
