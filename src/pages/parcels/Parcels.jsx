import React, { useState, useMemo, useRef } from 'react'
import { format, differenceInDays, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import PageBadge from '../../components/ui/PageBadge'
import { addDoc, collection } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useNotify } from '../../hooks/useNotify'
import { Plus, Edit2, Trash2, Upload, AlertTriangle, X, Download, RefreshCw, Truck, Search, Eye, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import * as XLSX from 'xlsx'

const today     = format(new Date(), 'yyyy-MM-dd')
const thisMonth = format(new Date(), 'yyyy-MM')

// ─── Carrier config ───────────────────────────────────
const CARRIERS = {
  flash:  { label:'⚡ Flash Express', color:'#ea580c', bg:'#fff7ed', border:'#fed7aa' },
  jt:     { label:'🟡 J&T Express',   color:'#ca8a04', bg:'#fefce8', border:'#fef08a' },
  kerry:  { label:'🔴 Kerry',          color:'#dc2626', bg:'#fff1f2', border:'#fecdd3' },
  thpost: { label:'📮 ไปรษณีย์ไทย',   color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe' },
  other:  { label:'📦 อื่นๆ',          color:'#6b7280', bg:'#f9fafb', border:'#e5e7eb' },
}

// ─── Status config ────────────────────────────────────
const STATUS = {
  pending:    { label:'⏳ รอจัดส่ง',      bg:'#fffbeb', color:'#b45309', border:'#fde68a' },
  hold:       { label:'⚠️ รอสินค้า/ค้าง', bg:'#fff7ed', color:'#c2410c', border:'#fed7aa' },
  shipped:    { label:'✈️ ส่งออกแล้ว',    bg:'#eff6ff', color:'#1d4ed8', border:'#bfdbfe' },
  shipping:   { label:'🚚 ระหว่างขนส่ง',  bg:'#f0f9ff', color:'#0284c7', border:'#bae6fd' },
  delivered:  { label:'✅ ส่งถึงแล้ว',    bg:'#f0fdf4', color:'#059669', border:'#bbf7d0' },
  returned:   { label:'🔄 คืนสินค้า',     bg:'#fff7ed', color:'#c2410c', border:'#fed7aa' },
  cancelled:  { label:'❌ ยกเลิก',        bg:'#fff1f2', color:'#be123c', border:'#fecdd3' },
}

// ─── Status map from Thai text ────────────────────────
const STATUS_TH = {
  'รอจัดส่ง':'pending','รอการส่ง':'pending','รออยู่ที่สาขา':'pending',
  'ระหว่างขนส่ง':'shipping','อยู่ระหว่างการนำส่ง':'shipping','นำส่ง':'shipping',
  'นำจ่ายสำเร็จ':'delivered','ส่งสำเร็จ':'delivered','ได้รับสินค้าแล้ว':'delivered','delivery success':'delivered',
  'คืนสินค้า':'returned','คืนพัสดุ':'returned',
  'ยกเลิก':'cancelled',
  'รอรับที่จุด':'pending','รอรับสินค้า':'pending',
}

const CARRIER_MATCH = {
  'flash express':'flash','flash':'flash','flashexpress':'flash',
  'j&t':'jt','j&t express':'jt','jt express':'jt','jandt':'jt',
  'kerry':'kerry','kerry express':'kerry',
  'ไปรษณีย์ไทย':'thpost','thailand post':'thpost','thai post':'thpost','ems':'thpost',
}

function parseCarrierRaw(s='') { return CARRIER_MATCH[s.toLowerCase().trim()] || 'other' }
function parseStatusRaw(s='')  { return STATUS_TH[s.trim()] || 'shipping' }
function parseDate(v) {
  if (!v) return ''
  if (v instanceof Date) return format(v,'yyyy-MM-dd')
  const s = String(v)
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { const [d,m,y]=s.slice(0,10).split('/'); return `${y}-${m}-${d}` }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10)
  return s.slice(0,10)
}
function daysOverdue(printDate, today, status) {
  if (['delivered','cancelled','returned'].includes(status)) return 0
  try { return Math.max(0, differenceInDays(new Date(today), parseISO(printDate))) } catch { return 0 }
}

// ─── Parse Excel row from shipping file ──────────────
function parseShippingRow(row, headers) {
  const h   = headers.map(c => String(c||'').toLowerCase().trim())
  const get = (...kw) => {
    const i = h.findIndex(c => kw.some(k => c.includes(k)))
    return i >= 0 ? String(row[i]||'').trim() : ''
  }
  const getDate = (...kw) => {
    const i = h.findIndex(c => kw.some(k => c.includes(k)))
    return i >= 0 ? parseDate(row[i]) : ''
  }
  return {
    status:       parseStatusRaw(get('สถานะ','status','state')),
    orderId:      get('รหัสคำสั่งซื้อ','orderid','order','คำสั่งซื้อ'),
    trackingNo:   get('หมายเลขพัสดุ','tracking','เลขพัสดุ','barcode'),
    carrier:      parseCarrierRaw(get('ขนส่ง','carrier','courier')),
    customerName: get('ชื่อลูกค้า','ชื่อผู้รับ','customer','name','ผู้รับ'),
    phone:        get('เบอร์โทร','เบอร์','phone','tel'),
    address:      get('ที่อยู่','address'),
    social:       get('social','ไอดี','facebook','line'),
    qty:          parseInt(get('จำนวน','qty','quantity'))||1,
    product:      get('สินค้า','product','item','รายการ'),
    cod:          parseFloat(String(get('cod','ยอด','amount')||'0').replace(/[^0-9.]/g,''))||0,
    transfer:     parseFloat(String(get('โอน','transfer','bank')||'0').replace(/[^0-9.]/g,''))||0,
    createdBy:    get('สร้างคำสั่งซื้อโดย','created by','สร้างโดย'),
    commBy:       get('รับค่าคอมโดย','รับค่าคอม','commby','แอดมิน'),
    channel:      get('ช่องทางการขาย','ช่องทาง','channel','เพจ','page'),
    orderDate:    getDate('วันที่คำสั่งซื้อ','order date'),
    shipDate:     getDate('วันที่จัดส่ง','วันส่ง','ship'),
    note:         get('หมายเหตุ','note','remark'),
    printDate:    getDate('วันที่สร้าง','วันพิมพ์','created','print') || today,
    updatedDate:  getDate('วันที่อัพเดท','updated'),
    rawStatus:    get('สถานะ','status'),
  }
}

export default function Parcels() {
  const { profile, isSuperAdmin, canManage } = useAuth()
  const { pages, parcels, getPage, createParcel, editParcel, removeParcel, importParcels } = useData()
  const { notifyCustom } = useNotify()

  const fileRef     = useRef(null)
  const shpFileRef  = useRef(null)

  const [tab,           setTab]           = useState('list')   // list|report|compare
  const [showForm,      setShowForm]      = useState(false)
  const [editItem,      setEditItem]      = useState(null)
  const [confirm,       setConfirm]       = useState(null)
  const [saving,        setSaving]        = useState(false)
  const [err,           setErr]           = useState('')
  const [preview,       setPreview]       = useState(null)    // import preview
  const [shpPreview,    setShpPreview]    = useState(null)    // shipping file preview
  const [expandRow,     setExpandRow]     = useState(null)
  const [overdueThresh, setOverdueThresh] = useState(2)       // ค้างเกิน X วัน

  // filters
  const [filterDate,    setFilterDate]    = useState(today)
  const [filterMonth,   setFilterMonth]   = useState('')
  const [filterCarrier, setFilterCarrier] = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [search,        setSearch]        = useState('')
  const [reportMonth,   setReportMonth]   = useState(thisMonth)

  const S = { background:'#fff', border:'1.5px solid #dde3f5', borderRadius:10, color:'#1e1b4b', fontFamily:'inherit', fontSize:13.5, padding:'8px 12px', outline:'none' }

  const makeBlank = () => ({
    trackingNo:'', orderId:'', carrier:'flash', status:'pending',
    customerName:'', phone:'', address:'', qty:1,
    product:'', cod:0, commBy:'', channel:'',
    printDate:today, shipDate:'', holdReason:'',
    pageId:'', note:'',
  })
  const [form, setForm] = useState(makeBlank)
  const setF  = k => e => setForm(p=>({...p,[k]:e.target.value}))

  // ── Filtered list ──────────────────────────────────
  const filtered = useMemo(() => {
    let d = [...parcels]
    if (!filterMonth && filterDate) d = d.filter(p=>p.printDate===filterDate||p.shipDate===filterDate)
    if (filterMonth) d = d.filter(p=>p.printDate?.startsWith(filterMonth)||p.shipDate?.startsWith(filterMonth))
    if (filterCarrier) d = d.filter(p=>p.carrier===filterCarrier)
    if (filterStatus)  d = d.filter(p=>p.status ===filterStatus)
    if (search.trim()) {
      const q = search.toLowerCase()
      d = d.filter(p=>
        p.trackingNo?.toLowerCase().includes(q) ||
        p.customerName?.toLowerCase().includes(q) ||
        p.phone?.includes(q) || p.orderId?.includes(q) ||
        p.commBy?.toLowerCase().includes(q) || p.product?.toLowerCase().includes(q)
      )
    }
    return d.sort((a,b)=>(b.printDate||'').localeCompare(a.printDate||''))
  }, [parcels, filterDate, filterMonth, filterCarrier, filterStatus, search])

  // ── Stats ──────────────────────────────────────────
  const stats = useMemo(() => {
    const all      = parcels
    const overdue  = all.filter(p => !['delivered','cancelled','returned'].includes(p.status) && daysOverdue(p.printDate,today,p.status) >= overdueThresh)
    const byCarrier = {}
    CARRIERS && Object.keys(CARRIERS).forEach(k => { byCarrier[k] = all.filter(p=>p.carrier===k).length })
    return {
      total:     all.length,
      pending:   all.filter(p=>p.status==='pending').length,
      shipped:   all.filter(p=>['shipped','shipping'].includes(p.status)).length,
      delivered: all.filter(p=>p.status==='delivered').length,
      hold:      all.filter(p=>p.status==='hold').length,
      overdue:   overdue.length,
      overdueList: overdue,
      byCarrier,
      totalCOD:  all.reduce((a,p)=>a+(p.cod||0),0),
    }
  }, [parcels, overdueThresh])

  // ── Report: daily/monthly print vs ship ───────────
  const reportData = useMemo(() => {
    const base = parcels.filter(p=>p.printDate?.startsWith(reportMonth))
    // Group by printDate
    const byDay = {}
    base.forEach(p => {
      const d = p.printDate || 'unknown'
      if (!byDay[d]) byDay[d] = { date:d, print:0, shipped:0, delivered:0, hold:0, overdue:0, cod:0 }
      byDay[d].print++
      if (['shipped','shipping'].includes(p.status)) byDay[d].shipped++
      if (p.status==='delivered') byDay[d].delivered++
      if (p.status==='hold') byDay[d].hold++
      if (daysOverdue(p.printDate,today,p.status) >= overdueThresh) byDay[d].overdue++
      byDay[d].cod += p.cod||0
    })
    return Object.values(byDay).sort((a,b)=>b.date.localeCompare(a.date))
  }, [parcels, reportMonth, overdueThresh])

  // ── Compare: our DB vs shipping file ──────────────
  const [compareSource, setCompareSource] = useState([])
  const compareResult = useMemo(() => {
    if (!compareSource.length) return []
    const inDB = new Map(parcels.filter(p=>p.trackingNo).map(p=>[p.trackingNo.trim(), p]))
    return compareSource.map(s => {
      const dbItem = inDB.get(s.trackingNo?.trim())
      const match = !!dbItem
      const statusMatch = match && (dbItem.status === s.status || ['shipped','shipping','delivered'].includes(s.status))
      return { ...s, dbItem, match, statusMatch }
    })
  }, [compareSource, parcels])

  // ── Quick status update ────────────────────────────
  const quickStatus = (id, status) => editParcel(id, { status, ...(status==='shipped'?{shipDate:today}:status==='delivered'?{shipDate:today}:{}) })

  // ── Save form ──────────────────────────────────────
  const handleSave = async () => {
    if (!form.trackingNo.trim()) { setErr('กรุณากรอก Tracking Number'); return }
    setSaving(true); setErr('')
    try {
      if (editItem) await editParcel(editItem.id, form)
      else {
        await createParcel(form)
        notifyCustom({ type:'system', title:`📦 พิมพ์ออเดอร์ใหม่`, message:`${profile?.name} บันทึก ${form.trackingNo} (${CARRIERS[form.carrier]?.label})`, link:'/parcels', targetRoles:['superadmin','head_admin'] })
      }
      setShowForm(false); setForm(makeBlank()); setEditItem(null)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  // ── Import order file ──────────────────────────────
  const handleOrderFile = (file) => {
    const r = new FileReader()
    r.onload = evt => {
      try {
        const wb   = XLSX.read(evt.target.result, { type:'binary', cellDates:false })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:false })
        // หา header row — ไฟล์นี้ row 1 = "ตาราง 1" (title), row 2 = headers จริง
        // logic: หา row ที่มี "หมายเลขพัสดุ" หรือ "tracking" หรือ "สถานะ"
        const hi = rows.findIndex(row =>
          row.some(c => {
            const s = String(c||'').toLowerCase().trim()
            return s.includes('หมายเลขพัสดุ') || s.includes('tracking') ||
                   s.includes('สถานะ') || s.includes('status') || s.includes('รหัสคำสั่งซื้อ')
          })
        )
        const headerIdx = hi >= 0 ? hi : 0
        const headers = (rows[headerIdx]||[]).map(c=>String(c||'').trim())
        const data = rows.slice(headerIdx+1)
          .filter(r=>r.some(c=>String(c||'').trim()))
          .map(r => parseShippingRow(r, headers))
          .filter(r => r.trackingNo)
        setPreview(data)
      } catch(e) { setErr('อ่านไฟล์ไม่สำเร็จ: '+e.message) }
    }
    r.readAsBinaryString(file)
  }

  // ── Import shipping status file ────────────────────
  const handleShippingFile = (file) => {
    const r = new FileReader()
    r.onload = evt => {
      try {
        const wb   = XLSX.read(evt.target.result, { type:'binary', cellDates:false })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:false })
        const hi = rows.findIndex(row =>
          row.some(c => {
            const s = String(c||'').toLowerCase().trim()
            return s.includes('หมายเลขพัสดุ') || s.includes('tracking') ||
                   s.includes('สถานะ') || s.includes('status') || s.includes('รหัสคำสั่งซื้อ')
          })
        )
        const headerIdx = hi >= 0 ? hi : 0
        const headers = (rows[headerIdx]||[]).map(c=>String(c||'').trim())
        const data = rows.slice(headerIdx+1)
          .filter(r=>r.some(c=>String(c||'').trim()))
          .map(r => parseShippingRow(r, headers))
          .filter(r => r.trackingNo)
        setShpPreview(data)
        setCompareSource(data)
        setTab('compare')
      } catch(e) { setErr('อ่านไฟล์ขนส่งไม่สำเร็จ: '+e.message) }
    }
    r.readAsBinaryString(file)
  }

  // ── Auto-update status from shipping file ──────────
  const applyShippingUpdate = async () => {
    setSaving(true)
    let updated = 0
    try {
      const inDB = new Map(parcels.filter(p=>p.trackingNo).map(p=>[p.trackingNo.trim(), p]))
      for (const s of compareSource) {
        const dbItem = inDB.get(s.trackingNo?.trim())
        if (dbItem && dbItem.status !== s.status) {
          await editParcel(dbItem.id, { status: s.status, shipDate: s.shipDate || dbItem.shipDate })
          updated++
        }
      }
      notifyCustom({ type:'system', title:`🚚 อัพเดทสถานะพัสดุ ${updated} รายการ`, message:`${profile?.name} อัพเดทสถานะจากไฟล์ขนส่ง`, link:'/parcels', targetRoles:['superadmin','head_admin'] })
      setShpPreview(null)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  // ── Confirm import ─────────────────────────────────
  const handleImportConfirm = async () => {
    if (!preview?.length) return
    setSaving(true); setErr('')
    try {
      const col = collection(db, 'parcels')
      let success = 0
      for (const item of preview) {
        try {
          await addDoc(col, { ...item, createdAt: new Date().toISOString() })
          success++
        } catch(e) {
          console.error('parcel write fail:', item.trackingNo, e.code, e.message)
        }
      }
      if (success > 0) {
        notifyCustom({ type:'system', title:`📦 Import พัสดุ ${success} รายการ`, message:`${profile?.name} import ${success} รายการ`, link:'/parcels', targetRoles:['superadmin','head_admin'] })
        setPreview(null)
      } else {
        setErr(`Import ไม่สำเร็จ (0/${preview.length}) — ตรวจสอบ Console และ Firestore Rules`)
      }
    } catch(e) {
      console.error('Import error:', e)
      setErr(e.code + ': ' + e.message)
    } finally { setSaving(false) }
  }

  // ── Export ─────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    // Sheet 1: รายการพัสดุทั้งหมด — ครบทุกคอลัมน์
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['สถานะ','รหัสคำสั่งซื้อ','หมายเลขพัสดุ','ขนส่ง','ชื่อลูกค้า','เบอร์โทร','ที่อยู่','social','จำนวน','สินค้า','COD','โอน','สร้างโดย','รับค่าคอมโดย','ช่องทางการขาย','วันที่คำสั่งซื้อ','วันที่จัดส่ง','หมายเหตุ','วันที่สร้าง','วันที่อัพเดท'],
      ...filtered.map(p=>[
        STATUS[p.status]?.label||p.status,
        p.orderId||'',
        p.trackingNo||'',
        CARRIERS[p.carrier]?.label||p.carrier||'',
        p.customerName||'',
        p.phone||'',
        p.address||'',
        p.social||'',
        p.qty||1,
        p.product||'',
        p.cod||0,
        p.transfer||0,
        p.createdBy||'',
        p.commBy||'',
        p.channel||pages.find(pg=>pg.id===p.pageId)?.name||'',
        p.orderDate||'',
        p.shipDate||'',
        p.note||p.holdReason||'',
        p.printDate||'',
        p.updatedDate||'',
      ]),
    ]), 'พัสดุทั้งหมด')
    // Sheet 2: พัสดุค้างส่ง
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Tracking','ขนส่ง','ชื่อลูกค้า','เบอร์','ที่อยู่','สินค้า','COD','วันพิมพ์','ค้าง(วัน)','สถานะ','หมายเหตุ'],
      ...stats.overdueList.map(p=>[
        p.trackingNo,
        CARRIERS[p.carrier]?.label||p.carrier,
        p.customerName,
        p.phone||'',
        p.address||'',
        p.product||'',
        p.cod||0,
        p.printDate,
        daysOverdue(p.printDate,today,p.status),
        STATUS[p.status]?.label||p.status,
        p.holdReason||p.note||'',
      ]),
    ]), `ค้างเกิน${overdueThresh}วัน`)
    XLSX.writeFile(wb, `parcels_${today}.xlsx`)
  }

  const TABS = [
    { k:'list',    label:'📦 รายการพัสดุ' },
    { k:'report',  label:`📊 รายงาน` },
    { k:'compare', label:`🔍 ชนออเดอร์ (${compareResult.length})` },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, overflow:'hidden', width:'100%', boxSizing:'border-box' }}>

      {/* Header */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <h2 style={{ fontSize:20, fontWeight:900, color:'#1e1b4b', marginBottom:0 }}>📦 ระบบพัสดุ / ขนส่ง</h2>
        <p style={{ fontSize:12.5, color:'#6b7280', margin:0 }}>Print order · ติดตามสถานะ · ชนไฟล์ขนส่ง · ตรวจค้าง</p>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center' }}>
          <input ref={fileRef}    type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&handleOrderFile(e.target.files[0])}/>
          <input ref={shpFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&handleShippingFile(e.target.files[0])}/>
          <button onClick={()=>shpFileRef.current?.click()}
            style={{ background:'linear-gradient(135deg,#0284c7,#0ea5e9)', border:'none', borderRadius:9, padding:'7px 11px', cursor:'pointer', fontSize:12, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
            <Upload size={13}/> Import สถานะขนส่ง
          </button>
          <button onClick={()=>fileRef.current?.click()}
            style={{ background:'linear-gradient(135deg,#059669,#10b981)', border:'none', borderRadius:9, padding:'7px 11px', cursor:'pointer', fontSize:12, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
            <Upload size={13}/> Import ออเดอร์
          </button>
          <button onClick={exportExcel}
            style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:9, padding:'7px 11px', cursor:'pointer', fontSize:12, fontWeight:700, color:'#c2410c', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
            <Download size={13}/> Export
          </button>
          {canManage && (
            <button onClick={()=>{ setShowForm(true); setEditItem(null); setForm(makeBlank()) }}
              style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:9, padding:'7px 11px', cursor:'pointer', fontSize:12, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
              <Plus size={13}/> เพิ่มรายการ
            </button>
          )}
        </div>
      </div>

      {err && <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:12, padding:'10px 16px', color:'#be123c', fontSize:13.5, display:'flex', gap:8 }}>❌ {err}<button onClick={()=>setErr('')} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#be123c' }}>✕</button></div>}

      {/* ── Overdue alert ── */}
      {stats.overdue > 0 && (
        <div style={{ background:'#fff1f2', border:'2px solid #fca5a5', borderRadius:14, padding:'14px 18px', display:'flex', flexWrap:'wrap', alignItems:'center', gap:12 }}>
          <AlertTriangle size={17} style={{ color:'#be123c', flexShrink:0 }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:900, color:'#be123c' }}>⚠️ พัสดุค้างส่ง {stats.overdue} รายการ (เกิน {overdueThresh} วัน)</div>
            <div style={{ fontSize:12, color:'#9f1239', marginTop:3 }}>Print แล้วแต่ยังไม่ถูกส่งออก</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:12, color:'#9f1239' }}>เกณฑ์:</span>
            <input type="number" min="1" max="30" style={{ ...S, width:60, textAlign:'center', fontWeight:800, color:'#be123c' }}
              value={overdueThresh} onChange={e=>setOverdueThresh(parseInt(e.target.value)||2)}/>
            <span style={{ fontSize:12, color:'#9f1239' }}>วัน</span>
          </div>
          <button onClick={()=>{ setFilterStatus(''); setTab('list'); setSearch('') }}
            style={{ background:'#fff', border:'1.5px solid #fca5a5', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#be123c', fontFamily:'inherit' }}>
            ดูรายการ
          </button>
        </div>
      )}

      {/* ── KPI stats ── */}
      {parcels.length === 0 && !preview && (
        <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:12, padding:'10px 16px', fontSize:13, color:'#92400e', display:'flex', alignItems:'center', gap:8 }}>
          ⚠️ <span>ยังไม่มีข้อมูล — กด <strong>"Import ออเดอร์"</strong> เพื่อนำเข้าข้อมูลพัสดุ หรือตรวจสอบ <strong>Firestore Rules</strong></span>
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))', gap:11 }}>
        {[
          { e:'📦', l:'ทั้งหมด',        v:stats.total,     bg:'linear-gradient(135deg,#eef2ff,#e0e7ff)', c:'#4338ca', b:'#c7d2fe' },
          { e:'⏳', l:'รอจัดส่ง',       v:stats.pending,   bg:'linear-gradient(135deg,#fffbeb,#fef3c7)', c:'#b45309', b:'#fde68a' },
          { e:'🚚', l:'ระหว่างขนส่ง',  v:stats.shipped,   bg:'linear-gradient(135deg,#eff6ff,#dbeafe)', c:'#1d4ed8', b:'#bfdbfe' },
          { e:'✅', l:'ส่งถึงแล้ว',     v:stats.delivered, bg:'linear-gradient(135deg,#f0fdf4,#dcfce7)', c:'#059669', b:'#bbf7d0' },
          { e:'⚠️', l:'รอสินค้า/ค้าง', v:stats.hold,      bg:'linear-gradient(135deg,#fff7ed,#ffedd5)', c:'#c2410c', b:'#fed7aa' },
          { e:'🚨', l:`ค้างเกิน${overdueThresh}วัน`, v:stats.overdue, bg:'linear-gradient(135deg,#fff1f2,#ffe4e6)', c:'#be123c', b:'#fecdd3' },
          { e:'💰', l:'COD รวม',          v:`฿${stats.totalCOD.toLocaleString()}`, bg:'linear-gradient(135deg,#fefce8,#fef9c3)', c:'#854d0e', b:'#fde68a' },
        ].map((k,i)=>(
          <div key={i} style={{ background:k.bg, border:`1.5px solid ${k.b}`, borderRadius:13, padding:'13px 14px' }}>
            <div style={{ fontSize:20, marginBottom:5 }}>{k.e}</div>
            <div style={{ fontSize:18, fontWeight:900, color:k.c }}>{k.v}</div>
            <div style={{ fontSize:11, color:'#6b7280', marginTop:3, fontWeight:600 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Carrier breakdown */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
        {Object.entries(CARRIERS).map(([k,c])=>{
          const cnt = stats.byCarrier[k]||0
          if (!cnt) return null
          return (
            <button key={k} onClick={()=>setFilterCarrier(filterCarrier===k?'':k)}
              style={{ background: filterCarrier===k?c.bg:'#fff', border:`1.5px solid ${filterCarrier===k?c.border:'#e0e7ff'}`, borderRadius:11, padding:'10px 14px', cursor:'pointer', textAlign:'left', fontFamily:'inherit', transition:'all .15s', display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:filterCarrier===k?c.color:'#4b5563' }}>{c.label}</div>
                <div style={{ fontSize:16, fontWeight:900, color:filterCarrier===k?c.color:'#1e1b4b', marginTop:2 }}>{cnt}</div>
              </div>
              {filterCarrier===k && <span style={{ fontSize:11, color:c.color, fontWeight:700 }}>✓ กรอง</span>}
            </button>
          )
        })}
      </div>

      {/* ── Import preview (order file) ── */}
      {preview && (
        <div style={{ background:'#f0fdf4', border:'2px solid #86efac', borderRadius:18, padding:14, overflow:'hidden', width:'100%', boxSizing:'border-box' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ fontSize:16, fontWeight:900, color:'#059669', display:'flex', alignItems:'center', gap:8 }}>
              <CheckCircle2 size={18}/> พร้อม Import ออเดอร์ {preview.length} รายการ
            </div>
            <button onClick={()=>setPreview(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280' }}><X size={18}/></button>
          </div>
          {/* Status summary */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
            {Object.entries(preview.reduce((a,p)=>{ a[p.status]=(a[p.status]||0)+1; return a }, {})).map(([k,v])=>(
              <span key={k} style={{ background:STATUS[k]?.bg||'#f1f5f9', color:STATUS[k]?.color||'#6b7280', border:`1.5px solid ${STATUS[k]?.border||'#e5e7eb'}`, borderRadius:99, padding:'4px 12px', fontSize:13, fontWeight:700 }}>
                {STATUS[k]?.label||k}: {v}
              </span>
            ))}
          </div>
          {/* Preview table */}
          <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #bbf7d0', maxHeight:300, marginBottom:14, overflow:'hidden' }}>
            <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:300, WebkitOverflowScrolling:'touch', width:'100%' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1400 }}>
              <thead>
                <tr style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', position:'sticky', top:0, zIndex:2, borderBottom:'1.5px solid #bbf7d0' }}>
                  {['สถานะ','รหัสออเดอร์','Tracking','ขนส่ง','ชื่อลูกค้า','เบอร์','ที่อยู่','สินค้า','จำนวน','COD','รับค่าคอมโดย','ช่องทาง','วันที่ออเดอร์','วันส่ง','หมายเหตุ'].map((h,i)=>(
                    <th key={i} style={{ padding:'9px 12px', textAlign:'left', fontSize:11, fontWeight:800, color:'#059669', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0,50).map((p,i)=>{
                  const st=STATUS[p.status]||STATUS.pending
                  const cr=CARRIERS[p.carrier]||CARRIERS.other
                  return (
                    <tr key={i} style={{ borderBottom:'1px solid #f0fdf4' }}>
                      <td style={{ padding:'7px 10px' }}><span style={{ background:st.bg, color:st.color, border:`1px solid ${st.border}`, borderRadius:99, padding:'2px 7px', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>{st.label}</span></td>
                      <td style={{ padding:'7px 10px', fontSize:11.5, color:'#6366f1', fontWeight:600 }}>{p.orderId||'—'}</td>
                      <td style={{ padding:'7px 10px', fontFamily:'monospace', fontSize:12, fontWeight:700 }}>{p.trackingNo}</td>
                      <td style={{ padding:'7px 10px' }}><span style={{ background:cr.bg, color:cr.color, border:`1px solid ${cr.border}`, borderRadius:99, padding:'2px 7px', fontSize:11, fontWeight:700 }}>{cr.label}</span></td>
                      <td style={{ padding:'7px 10px', fontSize:12.5, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.customerName}</td>
                      <td style={{ padding:'7px 10px', fontSize:12, color:'#6b7280', whiteSpace:'nowrap' }}>{p.phone||'—'}</td>
                      <td style={{ padding:'7px 10px', fontSize:11.5, color:'#4b5563', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={p.address}>{p.address||'—'}</td>
                      <td style={{ padding:'7px 10px', fontSize:11.5, color:'#6b7280', maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.product||'—'}</td>
                      <td style={{ padding:'7px 10px', fontSize:12.5, textAlign:'center', fontWeight:700 }}>{p.qty||1}</td>
                      <td style={{ padding:'7px 10px', fontSize:12.5, fontWeight:700, color:'#b45309', whiteSpace:'nowrap' }}>{p.cod>0?`฿${p.cod.toLocaleString()}`:'—'}</td>
                      <td style={{ padding:'7px 10px', fontSize:11.5, color:'#6b7280', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.commBy||'—'}</td>
                      <td style={{ padding:'7px 10px', fontSize:11.5, color:'#4338ca', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.channel||'—'}</td>
                      <td style={{ padding:'7px 10px', fontSize:11.5, color:'#6b7280', whiteSpace:'nowrap' }}>{p.orderDate||'—'}</td>
                      <td style={{ padding:'7px 10px', fontSize:11.5, color:'#059669', whiteSpace:'nowrap' }}>{p.shipDate||'—'}</td>
                      <td style={{ padding:'7px 10px', fontSize:11.5, color:'#6b7280', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.note||'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
          {preview.length>50&&<p style={{ fontSize:12, color:'#9ca3af', textAlign:'center', marginBottom:12 }}>แสดง 50 / {preview.length} รายการ</p>}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={()=>setPreview(null)} style={{ background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:'9px 18px', cursor:'pointer', fontSize:14, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>ยกเลิก</button>
            <button onClick={handleImportConfirm} disabled={saving}
              style={{ background:'linear-gradient(135deg,#059669,#10b981)', border:'none', borderRadius:10, padding:'9px 22px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', opacity:saving?0.6:1 }}>
              {saving?'⏳ กำลัง Import...': `✅ Import ${preview.length} รายการ`}
            </button>
          </div>
        </div>
      )}

      {/* ── Shipping file update preview ── */}
      {shpPreview && (
        <div style={{ background:'#eff6ff', border:'2px solid #bfdbfe', borderRadius:18, padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#1d4ed8', display:'flex', alignItems:'center', gap:8 }}>
              🚚 ไฟล์ขนส่ง {shpPreview.length} รายการ — จะอัพเดทสถานะในระบบ
            </div>
            <button onClick={()=>setShpPreview(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280' }}><X size={16}/></button>
          </div>
          <div style={{ fontSize:13, color:'#1e40af', marginBottom:14 }}>
            ระบบจะค้นหา Tracking ในฐานข้อมูลและอัพเดทสถานะให้อัตโนมัติ
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>setShpPreview(null)} style={{ background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:9, padding:'8px 16px', cursor:'pointer', fontSize:13, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>ยกเลิก</button>
            <button onClick={applyShippingUpdate} disabled={saving}
              style={{ background:'linear-gradient(135deg,#1d4ed8,#3b82f6)', border:'none', borderRadius:9, padding:'8px 20px', cursor:'pointer', fontSize:13, fontWeight:800, color:'#fff', fontFamily:'inherit' }}>
              {saving?'⏳ กำลังอัพเดท...':'🚚 อัพเดทสถานะเลย'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:12, padding:4, width:'fit-content', gap:3, flexWrap:'wrap' }}>
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:'8px 16px', borderRadius:9, border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', background:tab===t.k?'linear-gradient(135deg,#6366f1,#7c3aed)':'transparent', color:tab===t.k?'#fff':'#6366f1', whiteSpace:'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════ TAB: LIST ══════ */}
      {tab === 'list' && (
        <>
          {/* Form */}
          {showForm && (
            <div style={{ background:'#fff', border:'2px solid #6366f1', borderRadius:18, padding:24, boxShadow:'0 8px 32px rgba(99,102,241,.12)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                <div style={{ fontSize:16, fontWeight:900, color:'#1e1b4b' }}>{editItem?'✏️ แก้ไขพัสดุ':'📦 เพิ่มพัสดุใหม่'}</div>
                <button onClick={()=>{setShowForm(false);setEditItem(null);setErr('')}} style={{ background:'#f1f5f9', border:'none', borderRadius:9, width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}><X size={15}/></button>
              </div>
              {err && <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:9, padding:'8px 12px', color:'#be123c', fontSize:13, marginBottom:12 }}>❌ {err}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:12, marginBottom:14 }}>
                {[
                  { l:'📦 Tracking Number *', k:'trackingNo', placeholder:'TH1234567890' },
                  { l:'🔢 รหัสคำสั่งซื้อ',    k:'orderId',   placeholder:'6141328' },
                  { l:'👤 ชื่อลูกค้า',         k:'customerName',placeholder:'ชื่อ นามสกุล' },
                  { l:'📞 เบอร์โทร',            k:'phone',     placeholder:'0812345678' },
                  { l:'💰 COD (฿)',             k:'cod',       placeholder:'249', type:'number' },
                  { l:'🎯 แอดมิน/รับค่าคอม',   k:'commBy',    placeholder:'username' },
                ].map(f=>(
                  <div key={f.k}>
                    <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>{f.l}</label>
                    <input type={f.type||'text'} style={S} placeholder={f.placeholder} value={form[f.k]||''} onChange={setF(f.k)}/>
                  </div>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>🚚 ขนส่ง</label>
                  <select style={S} value={form.carrier} onChange={setF('carrier')}>
                    {Object.entries(CARRIERS).map(([k,c])=><option key={k} value={k}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>สถานะ</label>
                  <select style={S} value={form.status} onChange={setF('status')}>
                    {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>📅 วันพิมพ์</label>
                  <input type="date" style={S} value={form.printDate} onChange={setF('printDate')}/>
                </div>
              </div>
              {form.status === 'hold' && (
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#c2410c', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>⚠️ เหตุผลที่ค้าง/รอสินค้า</label>
                  <input style={{ ...S, border:'1.5px solid #fed7aa' }} placeholder="สินค้าขาด / ผลิตไม่ทัน / รอลูกค้ายืนยัน..." value={form.holdReason||''} onChange={setF('holdReason')}/>
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>🛍 สินค้า</label>
                  <input style={S} placeholder="ชื่อสินค้า..." value={form.product||''} onChange={setF('product')}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>📤 วันส่งออก</label>
                  <input type="date" style={S} value={form.shipDate||''} onChange={setF('shipDate')}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={()=>{setShowForm(false);setEditItem(null)}} style={{ background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:'9px 18px', cursor:'pointer', fontSize:14, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>ยกเลิก</button>
                <button onClick={handleSave} disabled={saving} style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:10, padding:'9px 22px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', opacity:saving?0.6:1 }}>
                  {saving?'กำลังบันทึก...':editItem?'✅ บันทึก':'➕ เพิ่ม'}
                </button>
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:14, padding:'14px 18px' }}>
            <div style={{ position:'relative', marginBottom:12 }}>
              <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}/>
              <input style={{ ...S, width:'100%', paddingLeft:36 }} placeholder="ค้นหา Tracking, ชื่อ, เบอร์, สินค้า, แอดมิน..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
              <input type="date" style={{ ...S, width:'auto' }} value={filterDate} onChange={e=>{setFilterDate(e.target.value);setFilterMonth('')}}/>
              <input type="month" style={{ ...S, width:'auto' }} value={filterMonth} onChange={e=>{setFilterMonth(e.target.value);setFilterDate('')}}/>
              <select style={{ ...S, width:'auto' }} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                <option value="">ทุกสถานะ</option>
                {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
              <button onClick={()=>{setFilterDate(today);setFilterMonth('');setFilterCarrier('');setFilterStatus('');setSearch('')}}
                style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:9, padding:'8px 13px', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#4338ca', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                <RefreshCw size={12}/> รีเซ็ต
              </button>
              <span style={{ fontSize:12, color:'#9ca3af', marginLeft:'auto' }}>{filtered.length} รายการ</span>
            </div>
          </div>

          {/* Table */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
            <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:'65vh', WebkitOverflowScrolling:"touch" }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1300 }}>
                <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                  <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom:'2px solid #e0e7ff' }}>
                    {['สถานะ','📦 Tracking','🚚 ขนส่ง','👤 ลูกค้า','📞 เบอร์','🛍 สินค้า','💰 COD','🎯 รับค่าคอม','📣 ช่องทาง','🖨️ วันสร้าง','📤 วันส่ง','⏰ ค้าง',''].map((h,i)=>(
                      <th key={i} style={{ padding:'11px 12px', textAlign:'left', fontSize:10.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length===0 ? (
                    <tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:'#9ca3af' }}>
                      <div style={{ fontSize:40, marginBottom:10 }}>📭</div>
                      <div style={{ fontSize:14, fontWeight:600 }}>ไม่มีข้อมูลพัสดุ</div>
                    </td></tr>
                  ) : filtered.map(p => {
                    const st    = STATUS[p.status]||STATUS.pending
                    const cr    = CARRIERS[p.carrier]||CARRIERS.other
                    const od    = daysOverdue(p.printDate,today,p.status)
                    const isExp = expandRow===p.id
                    return (
                      <React.Fragment key={p.id}>
                        <tr style={{ borderBottom:'1px solid #f0f4ff', background:od>=overdueThresh?'#fffafb':'transparent' }}>
                          <td style={{ padding:'10px 12px' }}>
                            <span style={{ background:st.bg, color:st.color, border:`1.5px solid ${st.border}`, borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>{st.label}</span>
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color:'#1e1b4b' }}>{p.trackingNo}</div>
                            {p.orderId&&<div style={{ fontSize:11, color:'#9ca3af' }}>{p.orderId}</div>}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <span style={{ background:cr.bg, color:cr.color, border:`1.5px solid ${cr.border}`, borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>{cr.label}</span>
                          </td>
                          <td style={{ padding:'10px 12px', maxWidth:120 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.customerName||'—'}</div>
                          </td>
                          <td style={{ padding:'10px 12px', fontSize:12.5, color:'#6b7280', whiteSpace:'nowrap' }}>{p.phone||'—'}</td>
                          <td style={{ padding:'10px 12px', maxWidth:130 }}>
                            <div style={{ fontSize:12, color:'#4b5563', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.product||'—'}</div>
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            {p.cod>0?<span style={{ fontSize:13, fontWeight:800, color:'#b45309' }}>฿{p.cod.toLocaleString()}</span>:<span style={{ color:'#d1d5db' }}>—</span>}
                          </td>
                          <td style={{ padding:'10px 12px', fontSize:12, color:'#4b5563', maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.commBy||'—'}</td>
                          <td style={{ padding:'10px 12px' }}>{(() => { const pg=pages.find(x=>x.id===p.pageId); if(pg) return <PageBadge page={pg} size='xs'/>; return <span style={{fontSize:12,color:'#4338ca'}}>{p.channel||'—'}</span> })()} </td>
                          <td style={{ padding:'10px 12px', fontSize:12.5, color:'#6b7280', whiteSpace:'nowrap' }}>{p.printDate||p.orderDate||'—'}</td>
                          <td style={{ padding:'10px 12px', fontSize:12.5, color:'#059669', fontWeight:600, whiteSpace:'nowrap' }}>{p.shipDate||'—'}</td>
                          <td style={{ padding:'10px 12px' }}>
                            {od>=overdueThresh
                              ?<span style={{ fontSize:12, fontWeight:800, color:'#be123c', background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:99, padding:'2px 8px' }}>🚨 {od}วัน</span>
                              :od>0
                                ?<span style={{ fontSize:12, color:'#b45309' }}>{od}วัน</span>
                                :<span style={{ color:'#d1d5db' }}>—</span>
                            }
                          </td>
                          <td style={{ padding:'8px 8px' }}>
                            <div style={{ display:'flex', gap:4 }}>
                              {/* Quick ship */}
                              {['pending','hold'].includes(p.status)&&(
                                <button onClick={()=>quickStatus(p.id,'shipped')} title="ส่งออกแล้ว"
                                  style={{ background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:7, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700, color:'#1d4ed8', fontFamily:'inherit', display:'flex', alignItems:'center', gap:3 }}>
                                  <Truck size={11}/> ส่ง
                                </button>
                              )}
                              {p.status==='shipped'&&(
                                <button onClick={()=>quickStatus(p.id,'delivered')} title="ส่งถึงแล้ว"
                                  style={{ background:'#f0fdf4', border:'1.5px solid #bbf7d0', borderRadius:7, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700, color:'#059669', fontFamily:'inherit', display:'flex', alignItems:'center', gap:3 }}>
                                  ✅
                                </button>
                              )}
                              <button onClick={()=>setExpandRow(isExp?null:p.id)}
                                style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:7, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6366f1' }}>
                                {isExp?<ChevronUp size={12}/>:<Eye size={12}/>}
                              </button>
                              {canManage&&(
                                <button onClick={()=>{setEditItem(p);setForm({...p});setShowForm(true)}}
                                  style={{ background:'#f5f3ff', border:'1.5px solid #ddd6fe', borderRadius:7, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#7c3aed' }}>
                                  <Edit2 size={12}/>
                                </button>
                              )}
                              {isSuperAdmin&&(
                                <button onClick={()=>setConfirm(p.id)}
                                  style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:7, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#be123c' }}>
                                  <Trash2 size={12}/>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Expand detail */}
                        {isExp&&(
                          <tr><td colSpan={10} style={{ padding:0 }}>
                            <div style={{ background:'linear-gradient(135deg,#fafbff,#f5f3ff)', borderTop:'1px solid #e0e7ff', padding:'14px 18px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
                              {[
                                ['📦 Tracking',     p.trackingNo],
                                ['🔢 รหัสออเดอร์',  p.orderId],
                                ['👤 ชื่อลูกค้า',   p.customerName],
                                ['📞 เบอร์โทร',      p.phone],
                                ['📍 ที่อยู่',        p.address],
                                ['🛍 สินค้า',        p.product],
                                ['💰 COD',           p.cod>0?`฿${p.cod}`:'—'],
                                ['🎯 แอดมิน',        p.commBy],
                                ['📣 เพจ/ช่องทาง',  p.channel||pages.find(pg=>pg.id===p.pageId)?.name||'—'],
                                ['⚠️ เหตุผลค้าง',   p.holdReason||'—'],
                              ].map(([k,v])=>v&&v!=='—'?(
                                <div key={k} style={{ background:'#fff', border:'1px solid #e0e7ff', borderRadius:9, padding:'9px 12px' }}>
                                  <div style={{ fontSize:11, color:'#9ca3af', fontWeight:700, marginBottom:3 }}>{k}</div>
                                  <div style={{ fontSize:13, fontWeight:600, color:'#1e1b4b', wordBreak:'break-all' }}>{v}</div>
                                </div>
                              ):null)}
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══════ TAB: REPORT ══════ */}
      {tab === 'report' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <label style={{ fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em' }}>📆 เดือน</label>
            <input type="month" style={{ ...S, width:'auto' }} value={reportMonth} onChange={e=>setReportMonth(e.target.value)}/>
          </div>
          {/* Monthly totals */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12 }}>
            {[
              { e:'🖨️', l:'Print รวม',    v:reportData.reduce((a,d)=>a+d.print,0),     bg:'linear-gradient(135deg,#eef2ff,#e0e7ff)', c:'#4338ca', b:'#c7d2fe' },
              { e:'✈️', l:'ส่งออกแล้ว',  v:reportData.reduce((a,d)=>a+d.shipped,0),   bg:'linear-gradient(135deg,#eff6ff,#dbeafe)', c:'#1d4ed8', b:'#bfdbfe' },
              { e:'✅', l:'ส่งถึงแล้ว',  v:reportData.reduce((a,d)=>a+d.delivered,0), bg:'linear-gradient(135deg,#f0fdf4,#dcfce7)', c:'#059669', b:'#bbf7d0' },
              { e:'⚠️', l:'รอสินค้า',    v:reportData.reduce((a,d)=>a+d.hold,0),      bg:'linear-gradient(135deg,#fff7ed,#ffedd5)', c:'#c2410c', b:'#fed7aa' },
              { e:'🚨', l:'ค้างเกิน',     v:reportData.reduce((a,d)=>a+d.overdue,0),   bg:'linear-gradient(135deg,#fff1f2,#ffe4e6)', c:'#be123c', b:'#fecdd3' },
              { e:'💰', l:'COD รวม',       v:`฿${reportData.reduce((a,d)=>a+d.cod,0).toLocaleString()}`, bg:'linear-gradient(135deg,#fefce8,#fef9c3)', c:'#854d0e', b:'#fde68a' },
            ].map((k,i)=>(
              <div key={i} style={{ background:k.bg, border:`1.5px solid ${k.b}`, borderRadius:13, padding:'13px 15px' }}>
                <div style={{ fontSize:20, marginBottom:5 }}>{k.e}</div>
                <div style={{ fontSize:18, fontWeight:900, color:k.c }}>{k.v}</div>
                <div style={{ fontSize:11, color:'#6b7280', marginTop:3, fontWeight:600 }}>{k.l}</div>
              </div>
            ))}
          </div>
          {/* Daily breakdown table */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
            <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', width:'100%' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                  <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom:'2px solid #e0e7ff' }}>
                    {['วันที่','🖨️ Print','✈️ ส่งออก','✅ ส่งถึง','⚠️ ค้าง/รอ','🚨 เกินเกณฑ์','💰 COD','% ส่งออก'].map((h,i)=>(
                      <th key={i} style={{ padding:'10px 12px', textAlign:i>=1?'center':'left', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.length===0?(
                    <tr><td colSpan={8} style={{ textAlign:'center', padding:28, color:'#9ca3af' }}>ไม่มีข้อมูลเดือนนี้</td></tr>
                  ):reportData.map(d=>{
                    const pct = d.print>0?Math.round((d.shipped+d.delivered)/d.print*100):0
                    return (
                      <tr key={d.date} style={{ borderBottom:'1px solid #f0f4ff', background:d.overdue>0?'#fffafb':'transparent' }}>
                        <td style={{ padding:'10px 12px', fontSize:13, color:'#4b5563', fontWeight:600 }}>{d.date}</td>
                        <td style={{ textAlign:'center', fontSize:14, fontWeight:800, color:'#4338ca' }}>{d.print}</td>
                        <td style={{ textAlign:'center', fontSize:14, fontWeight:800, color:'#1d4ed8' }}>{d.shipped}</td>
                        <td style={{ textAlign:'center', fontSize:14, fontWeight:800, color:'#059669' }}>{d.delivered}</td>
                        <td style={{ textAlign:'center', fontSize:14, fontWeight:800, color:d.hold>0?'#c2410c':'#d1d5db' }}>{d.hold||'—'}</td>
                        <td style={{ textAlign:'center', fontSize:14, fontWeight:800, color:d.overdue>0?'#be123c':'#d1d5db' }}>{d.overdue||'—'}</td>
                        <td style={{ textAlign:'center', fontSize:13, fontWeight:700, color:'#b45309' }}>{d.cod>0?`฿${d.cod.toLocaleString()}`:'—'}</td>
                        <td style={{ textAlign:'center', padding:'10px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}>
                            <div style={{ width:60, height:6, background:'#f1f5f9', borderRadius:99, overflow:'hidden' }}>
                              <div style={{ width:`${pct}%`, height:'100%', background:pct>=80?'#22c55e':pct>=50?'#f59e0b':'#ef4444', borderRadius:99 }}/>
                            </div>
                            <span style={{ fontSize:12, fontWeight:800, color:pct>=80?'#059669':pct>=50?'#b45309':'#be123c' }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════ TAB: COMPARE ══════ */}
      {tab === 'compare' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {compareResult.length===0 ? (
            <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:36, textAlign:'center', color:'#9ca3af' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
              <div style={{ fontSize:15, fontWeight:700, color:'#6b7280', marginBottom:6 }}>ยังไม่ได้ import ไฟล์ขนส่ง</div>
              <div style={{ fontSize:13, marginBottom:18 }}>กด "Import สถานะขนส่ง" เพื่อชนกับข้อมูลในระบบ</div>
              <button onClick={()=>shpFileRef.current?.click()}
                style={{ background:'linear-gradient(135deg,#0284c7,#0ea5e9)', border:'none', borderRadius:12, padding:'11px 24px', cursor:'pointer', fontSize:14, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:7 }}>
                <Upload size={15}/> 🚚 Import ไฟล์ขนส่ง
              </button>
            </div>
          ) : (
            <>
              {/* ── Summary KPI ── */}
              {(() => {
                const total       = compareResult.length
                const matched     = compareResult.filter(r=>r.match)
                const notFound    = compareResult.filter(r=>!r.match)
                const delivered   = compareResult.filter(r=>r.status==='delivered')
                const shipping    = compareResult.filter(r=>['shipped','shipping'].includes(r.status))
                const pending     = compareResult.filter(r=>r.status==='pending')
                const returned    = compareResult.filter(r=>r.status==='returned')
                const cancelled   = compareResult.filter(r=>r.status==='cancelled')
                const needUpdate  = compareResult.filter(r=>r.match&&!r.statusMatch)
                const totalCOD    = compareResult.reduce((a,r)=>a+(r.cod||0),0)
                const matchRate   = total>0?Math.round(matched.length/total*100):0
                const deliverRate = total>0?Math.round(delivered.length/total*100):0
                return (
                  <>
                    {/* Row 1: สรุปหลัก */}
                    <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', borderRadius:18, padding:'20px 24px' }}>
                      <div style={{ fontSize:15, fontWeight:900, color:'#fff', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                        📊 สรุปผลการเทียบออเดอร์ — {total} รายการ
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
                        {[
                          { e:'📋', l:'ทั้งหมด',          v:total,               pct:null,       c:'#c7d2fe', bg:'rgba(255,255,255,.1)' },
                          { e:'✅', l:'พบในระบบ',          v:matched.length,      pct:matchRate,   c:'#86efac', bg:'rgba(34,197,94,.15)' },
                          { e:'❌', l:'ไม่พบในระบบ',       v:notFound.length,     pct:null,        c:'#fca5a5', bg:'rgba(239,68,68,.15)' },
                          { e:'🔄', l:'ต้องอัพเดทสถานะ',   v:needUpdate.length,   pct:null,        c:'#fde68a', bg:'rgba(234,179,8,.15)' },
                          { e:'💰', l:'COD รวม',            v:`฿${totalCOD.toLocaleString()}`, pct:null, c:'#fcd34d', bg:'rgba(234,179,8,.15)' },
                        ].map((k,i)=>(
                          <div key={i} style={{ background:k.bg, borderRadius:12, padding:'12px 14px', border:'1px solid rgba(255,255,255,.1)' }}>
                            <div style={{ fontSize:22, marginBottom:6 }}>{k.e}</div>
                            <div style={{ fontSize:17, fontWeight:900, color:k.c }}>{k.v}</div>
                            {k.pct!==null && <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginTop:2 }}>{k.pct}% ของทั้งหมด</div>}
                            <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginTop:2 }}>{k.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Row 2: สถานะขนส่ง breakdown */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:12 }}>
                      {[
                        { e:'✈️', l:'ส่งออกแล้ว/ระหว่างทาง', v:shipping.length,  bg:'linear-gradient(135deg,#eff6ff,#dbeafe)', c:'#1d4ed8', b:'#bfdbfe',
                          bar: total>0?Math.round(shipping.length/total*100):0 },
                        { e:'✅', l:'ส่งถึงแล้ว',             v:delivered.length, bg:'linear-gradient(135deg,#f0fdf4,#dcfce7)', c:'#059669', b:'#bbf7d0',
                          bar: deliverRate },
                        { e:'⏳', l:'รอจัดส่ง',               v:pending.length,   bg:'linear-gradient(135deg,#fffbeb,#fef3c7)', c:'#b45309', b:'#fde68a',
                          bar: total>0?Math.round(pending.length/total*100):0 },
                        { e:'🔄', l:'คืนสินค้า',              v:returned.length,  bg:'linear-gradient(135deg,#fff7ed,#ffedd5)', c:'#c2410c', b:'#fed7aa',
                          bar: total>0?Math.round(returned.length/total*100):0 },
                        { e:'❌', l:'ยกเลิก',                  v:cancelled.length, bg:'linear-gradient(135deg,#fff1f2,#ffe4e6)', c:'#be123c', b:'#fecdd3',
                          bar: total>0?Math.round(cancelled.length/total*100):0 },
                        { e:'❓', l:'ไม่พบในระบบเรา',          v:notFound.length,  bg:'linear-gradient(135deg,#f9fafb,#f3f4f6)', c:'#6b7280', b:'#e5e7eb',
                          bar: total>0?Math.round(notFound.length/total*100):0 },
                      ].map((k,i)=>(
                        <div key={i} style={{ background:k.bg, border:`1.5px solid ${k.b}`, borderRadius:14, padding:'14px 16px' }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                            <span style={{ fontSize:20 }}>{k.e}</span>
                            <span style={{ fontSize:12, fontWeight:800, color:k.c, background:'rgba(255,255,255,.6)', borderRadius:99, padding:'2px 8px' }}>{k.bar}%</span>
                          </div>
                          <div style={{ fontSize:22, fontWeight:900, color:k.c, marginBottom:4 }}>{k.v}</div>
                          {/* Progress bar */}
                          <div style={{ height:5, background:'rgba(0,0,0,.08)', borderRadius:99, overflow:'hidden', marginBottom:6 }}>
                            <div style={{ height:'100%', width:`${k.bar}%`, background:k.c, borderRadius:99, transition:'width .5s' }}/>
                          </div>
                          <div style={{ fontSize:11, color:'#6b7280', fontWeight:600 }}>{k.l}</div>
                        </div>
                      ))}
                    </div>

                    {/* Row 3: ปุ่ม action */}
                    {needUpdate.length > 0 && (
                      <div style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', border:'2px solid #fde68a', borderRadius:14, padding:'14px 18px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:900, color:'#b45309' }}>🔄 พบ {needUpdate.length} รายการที่สถานะในระบบไม่ตรงกับขนส่ง</div>
                          <div style={{ fontSize:12.5, color:'#92400e', marginTop:3 }}>กดปุ่มด้านขวาเพื่ออัพเดทสถานะทั้งหมดให้ตรงกับไฟล์ขนส่ง</div>
                        </div>
                        <button onClick={applyShippingUpdate} disabled={saving}
                          style={{ background:'linear-gradient(135deg,#d97706,#f59e0b)', border:'none', borderRadius:10, padding:'10px 20px', cursor:'pointer', fontSize:13.5, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap', opacity:saving?0.6:1 }}>
                          🚚 อัพเดทสถานะ {needUpdate.length} รายการ
                        </button>
                      </div>
                    )}
                  </>
                )
              })()}
              <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
                <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', width:'100%' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom:'2px solid #e0e7ff' }}>
                        {['📦 Tracking','🚚 ขนส่ง','👤 ลูกค้า','📞 เบอร์','📍 ที่อยู่','📅 วันพิมพ์','📤 วันส่ง','สถานะ(ขนส่ง)','สถานะ(ระบบ)','ผล'].map((h,i)=>(
                          <th key={i} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compareResult.map((r,i)=>{
                        const extSt  = STATUS[r.status]||STATUS.pending
                        const dbSt   = r.dbItem ? (STATUS[r.dbItem.status]||STATUS.pending) : null
                        const cr     = CARRIERS[r.carrier]||CARRIERS.other
                        return (
                          <tr key={i} style={{ borderBottom:'1px solid #f0f4ff', background:!r.match?'#fff1f2':!r.statusMatch?'#fffbeb':'transparent' }}>
                            <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:13, fontWeight:700, color:'#1e1b4b' }}>{r.trackingNo}</td>
                            <td style={{ padding:'10px 12px' }}>
                              <span style={{ background:cr.bg, color:cr.color, border:`1.5px solid ${cr.border}`, borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:700 }}>{cr.label}</span>
                            </td>
                            <td style={{ padding:'10px 12px' }}>
                              <div style={{ fontSize:13, fontWeight:600, color:'#1e1b4b', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.customerName||'—'}</div>
                            </td>
                            <td style={{ padding:'10px 12px', fontSize:12.5, color:'#6b7280', whiteSpace:'nowrap' }}>{r.phone||'—'}</td>
                            <td style={{ padding:'10px 12px', fontSize:12, color:'#4b5563', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.address||r.dbItem?.address||''}>
                              {r.address || r.dbItem?.address || <span style={{ color:'#d1d5db' }}>—</span>}
                            </td>
                            <td style={{ padding:'10px 12px', fontSize:12.5, color:'#4338ca', fontWeight:600, whiteSpace:'nowrap' }}>{r.printDate || r.dbItem?.printDate || '—'}</td>
                            <td style={{ padding:'10px 12px', fontSize:12.5, color:'#059669', fontWeight:600, whiteSpace:'nowrap' }}>{r.shipDate || r.dbItem?.shipDate || '—'}</td>
                            <td style={{ padding:'10px 12px' }}>
                              <span style={{ background:extSt.bg, color:extSt.color, border:`1.5px solid ${extSt.border}`, borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:700 }}>{extSt.label}</span>
                            </td>
                            <td style={{ padding:'10px 12px' }}>
                              {dbSt
                                ?<span style={{ background:dbSt.bg, color:dbSt.color, border:`1.5px solid ${dbSt.border}`, borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:700 }}>{dbSt.label}</span>
                                :<span style={{ color:'#d1d5db', fontSize:12 }}>ไม่มีในระบบ</span>
                              }
                            </td>
                            <td style={{ padding:'10px 12px' }}>
                              {!r.match
                                ?<span style={{ background:'#fff1f2', color:'#be123c', border:'1.5px solid #fecdd3', borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:700 }}>❌ ไม่พบ</span>
                                :!r.statusMatch
                                  ?<span style={{ background:'#fffbeb', color:'#b45309', border:'1.5px solid #fde68a', borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:700 }}>🔄 อัพเดทได้</span>
                                  :<span style={{ background:'#f0fdf4', color:'#059669', border:'1.5px solid #bbf7d0', borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:700 }}>✅ ตรงกัน</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Confirm delete */}
      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(99,102,241,.2)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:20, padding:28, maxWidth:360, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,.15)', border:'1.5px solid #e0e7ff' }}>
            <div style={{ fontSize:40, textAlign:'center', marginBottom:12 }}>🗑️</div>
            <div style={{ fontSize:17, fontWeight:900, textAlign:'center', marginBottom:20 }}>ลบรายการนี้?</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setConfirm(null)} style={{ flex:1, background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:10, fontSize:14, fontWeight:700, color:'#6b7280', cursor:'pointer', fontFamily:'inherit' }}>ยกเลิก</button>
              <button onClick={async()=>{await removeParcel(confirm);setConfirm(null)}} style={{ flex:1, background:'linear-gradient(135deg,#e11d48,#f43f5e)', border:'none', borderRadius:10, padding:10, fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>🗑️ ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
