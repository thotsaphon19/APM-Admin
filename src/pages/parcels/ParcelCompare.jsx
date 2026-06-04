import React, { useState, useMemo, useRef } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import {
  Upload, Search, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Download, RefreshCw, Eye,
} from 'lucide-react'

// ─── Utility ─────────────────────────────────────────────
const today = format(new Date(), 'yyyy-MM-dd')

/** ทำ key สำหรับ match: lowercase, ลบ special chars, trim */
function normalizeName(str) {
  if (!str) return ''
  return String(str)
    .toLowerCase()
    .replace(/[_\-\.\/\\,;:!?@#$%^&*()+=\[\]{}|<>~`'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** ตัดคำ stopwords ออกเพื่อ fuzzy match */
function nameTokens(str) {
  const stops = new Set(['mr','mrs','ms','นาย','นาง','นางสาว','น.ส.','ด.ช.','ด.ญ.','คุณ'])
  return normalizeName(str).split(' ').filter(t => t.length > 1 && !stops.has(t))
}

/** คะแนน similarity 0-1 */
function similarity(a, b) {
  const ta = nameTokens(a)
  const tb = nameTokens(b)
  if (!ta.length || !tb.length) return 0
  // exact normalized match
  if (normalizeName(a) === normalizeName(b)) return 1
  // token overlap
  const set = new Set([...ta, ...tb])
  const inter = ta.filter(t => tb.some(bt => bt.includes(t) || t.includes(bt)))
  return inter.length / Math.max(ta.length, tb.length)
}

/**
 * Auto-detect columns จาก header row
 * Returns { nameCol, trackingCol, statusCol, qtyCol, productCol, phoneCol, adminCol, pageCol, dateCol, codCol }
 */
function detectColumns(headers) {
  const h = headers.map(c => (c||'').toString().toLowerCase())
  const find = (...keywords) => h.findIndex(c => keywords.some(k => c.includes(k)))
  return {
    nameCol:     find('ชื่อลูกค้า','ชื่อ','customer','name','ผู้รับ','ลูกค้า'),
    trackingCol: find('tracking','หมายเลขพัสดุ','เลขพัสดุ','หมายเลข','พัสดุ','track'),
    statusCol:   find('สถานะ','status','state'),
    qtyCol:      find('จำนวน','qty','quantity','amount'),
    productCol:  find('สินค้า','product','item','รายการ'),
    phoneCol:    find('เบอร์','โทร','phone','tel','mobile'),
    adminCol:    find('แอดมิน','admin','สร้างโดย','created by','ตอบโดย','รับค่าคอม','commby','comm_by','ผู้บันทึก'),
    pageCol:     find('เพจ','page','ช่องทาง','channel','shop','ร้าน'),
    dateCol:     find('วันที่จัดส่ง','ship','วันส่ง','shipped','delivery','จัดส่ง','วันที่'),
    codCol:      find('cod','ยอด','amount','ราคา','price','มูลค่า'),
    orderIdCol:  find('คำสั่งซื้อ','orderid','order_id','order id','รหัส'),
    addressCol:  find('ที่อยู่','address','addr'),
  }
}

/** Parse ค่าวันที่หลายรูปแบบ */
function parseAnyDate(val) {
  if (!val) return ''
  try {
    if (val instanceof Date) return format(val, 'dd/MM/yyyy')
    const s = String(val)
    // dd/MM/yyyy HH:mm or dd/MM/yyyy
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0,10)
    // yyyy-MM-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y,m,d] = s.slice(0,10).split('-')
      return `${d}/${m}/${y}`
    }
    return s.slice(0,10)
  } catch { return String(val||'').slice(0,10) }
}

/** อ่าน Excel/CSV → array of objects */
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const wb = XLSX.read(evt.target.result, { type:'binary', cellDates:false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:false })

        // หา header row (row แรกที่มี column มากกว่า 3 ช่อง)
        let headerIdx = rows.findIndex(r => r.filter(c=>String(c).trim()).length >= 3)
        if (headerIdx < 0) headerIdx = 0

        const headers = rows[headerIdx].map(c => String(c||'').trim())
        const cols = detectColumns(headers)
        const data = rows.slice(headerIdx + 1)
          .filter(r => r.some(c => String(c||'').trim()))
          .map((r, i) => ({
            _row:      headerIdx + 2 + i,
            _raw:      headers.reduce((a, h, j) => ({ ...a, [h||`col${j}`]: r[j] }), {}),
            name:      String(r[cols.nameCol] ?? '').trim(),
            tracking:  String(r[cols.trackingCol] ?? '').trim(),
            status:    String(r[cols.statusCol] ?? '').trim(),
            qty:       parseInt(r[cols.qtyCol]) || 1,
            product:   String(r[cols.productCol] ?? '').trim().replace(/\s+/g,' '),
            phone:     String(r[cols.phoneCol] ?? '').trim(),
            admin:     String(r[cols.adminCol] ?? '').trim(),
            page:      String(r[cols.pageCol] ?? '').trim(),
            date:      parseAnyDate(r[cols.dateCol]),
            cod:       parseFloat(String(r[cols.codCol]||'0').replace(/[^0-9.]/g,'')) || 0,
            orderId:   String(r[cols.orderIdCol] ?? '').trim(),
            address:   String(r[cols.addressCol] ?? '').trim(),
          }))
          .filter(r => r.name || r.tracking)

        resolve({ headers, cols, data, filename: file.name, totalRows: rows.length - headerIdx - 1 })
      } catch(e) { reject(e) }
    }
    reader.onerror = reject
    reader.readAsBinaryString(file)
  })
}

// ─── Match engine ─────────────────────────────────────────
function matchOrders(orderFile, shippingFile, threshold = 0.5) {
  const orders   = orderFile.data
  const shipping = shippingFile.data

  // Pre-build shipping lookup by tracking
  const trackingMap = {}
  shipping.forEach(s => {
    if (s.tracking) trackingMap[s.tracking.trim()] = s
  })

  return orders.map(order => {
    // 1. Exact tracking match
    if (order.tracking && trackingMap[order.tracking]) {
      const match = trackingMap[order.tracking]
      return { ...order, matchType:'tracking', matched:true, shippingRow:match, score:1 }
    }

    // 2. Name similarity match
    let bestScore = 0
    let bestMatch = null
    for (const s of shipping) {
      const score = similarity(order.name, s.name)
      if (score > bestScore) { bestScore = score; bestMatch = s }
    }

    if (bestScore >= threshold) {
      return { ...order, matchType:'name', matched:true, shippingRow:bestMatch, score:bestScore }
    }

    // 3. Phone match (fallback)
    if (order.phone) {
      const phoneClean = order.phone.replace(/\D/g,'').slice(-9)
      const byPhone = shipping.find(s => s.phone?.replace(/\D/g,'').slice(-9) === phoneClean)
      if (byPhone) {
        return { ...order, matchType:'phone', matched:true, shippingRow:byPhone, score:0.9 }
      }
    }

    return { ...order, matchType:'none', matched:false, shippingRow:null, score:0 }
  })
}

// ─── Component ────────────────────────────────────────────
export default function ParcelCompare() {
  const orderFileRef    = useRef(null)
  const shippingFileRef = useRef(null)

  const [orderFile,    setOrderFile]    = useState(null)
  const [shippingFile, setShippingFile] = useState(null)
  const [loading,      setLoading]      = useState('')
  const [error,        setError]        = useState('')
  const [results,      setResults]      = useState(null)
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // all | shipped | unshipped | unknown
  const [filterAdmin,  setFilterAdmin]  = useState('')
  const [filterPage,   setFilterPage]   = useState('')
  const [expandRow,    setExpandRow]    = useState(null)
  const [threshold,    setThreshold]    = useState(0.5)

  const handleFile = async (file, type) => {
    setError('')
    setLoading(`กำลังอ่านไฟล์ ${file.name}...`)
    try {
      const parsed = await readFile(file)
      if (type === 'order')    { setOrderFile(parsed);    setResults(null) }
      if (type === 'shipping') { setShippingFile(parsed); setResults(null) }
    } catch(e) {
      setError(`อ่านไฟล์ไม่สำเร็จ: ${e.message}`)
    } finally { setLoading('') }
  }

  const runMatch = () => {
    if (!orderFile || !shippingFile) return
    setLoading('กำลังเปรียบเทียบข้อมูล...')
    setTimeout(() => {
      try {
        const r = matchOrders(orderFile, shippingFile, threshold)
        setResults(r)
        setFilterStatus('all')
        setSearch('')
      } catch(e) { setError(e.message) } finally { setLoading('') }
    }, 100)
  }

  // ── Filtered results ──────────────────────────────────
  const filtered = useMemo(() => {
    if (!results) return []
    let d = results
    if (filterStatus === 'shipped')   d = d.filter(r => r.matched)
    if (filterStatus === 'unshipped') d = d.filter(r => !r.matched)
    if (filterAdmin) d = d.filter(r => r.admin?.toLowerCase().includes(filterAdmin.toLowerCase()))
    if (filterPage)  d = d.filter(r => r.page?.toLowerCase().includes(filterPage.toLowerCase()))
    if (search.trim()) {
      const q = search.toLowerCase()
      d = d.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.tracking?.includes(q) ||
        r.phone?.includes(q) ||
        r.admin?.toLowerCase().includes(q) ||
        r.page?.toLowerCase().includes(q) ||
        r.product?.toLowerCase().includes(q)
      )
    }
    return d
  }, [results, filterStatus, filterAdmin, filterPage, search])

  // ── Stats ─────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!results) return {}
    const total    = results.length
    const shipped  = results.filter(r => r.matched)
    const unship   = results.filter(r => !r.matched)
    const byAdmin  = {}
    const byPage   = {}
    results.forEach(r => {
      if (r.admin) byAdmin[r.admin] = (byAdmin[r.admin]||{shipped:0,unshipped:0,total:0})
      if (r.admin) { byAdmin[r.admin].total++; if(r.matched) byAdmin[r.admin].shipped++; else byAdmin[r.admin].unshipped++ }
      if (r.page)  byPage[r.page]   = (byPage[r.page]||{shipped:0,unshipped:0,total:0})
      if (r.page)  { byPage[r.page].total++;  if(r.matched) byPage[r.page].shipped++;  else byPage[r.page].unshipped++ }
    })
    return {
      total, shipped:shipped.length, unshipped:unship.length,
      shippedRate: total > 0 ? Math.round(shipped.length/total*100) : 0,
      byAdmin, byPage,
      totalCOD: results.reduce((a,r) => a+(r.cod||0), 0),
    }
  }, [results])

  // ── Export ────────────────────────────────────────────
  const exportResult = () => {
    if (!results) return
    const wb = XLSX.utils.book_new()

    // Sheet 1: ทั้งหมด
    const rows1 = [
      ['สถานะ','ชื่อลูกค้า','เบอร์โทร','สินค้า','Tracking (ออเดอร์)','Tracking (ขนส่ง)','วิธี match','ความแม่น','แอดมิน','เพจ','COD','วันที่จัดส่ง','ที่อยู่'],
      ...results.map(r => [
        r.matched ? '✅ ส่งแล้ว' : '❌ ยังไม่ส่ง',
        r.name, r.phone, r.product,
        r.tracking, r.shippingRow?.tracking || '',
        r.matchType === 'tracking' ? 'Tracking ตรงกัน' : r.matchType === 'name' ? 'ชื่อใกล้เคียง' : r.matchType === 'phone' ? 'เบอร์โทรตรงกัน' : 'ไม่พบคู่',
        r.score > 0 ? `${Math.round(r.score*100)}%` : '—',
        r.admin, r.page, r.cod,
        r.shippingRow?.date || r.date || '',
        r.address,
      ])
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows1), 'ผลเปรียบเทียบ')

    // Sheet 2: ยังไม่ส่ง
    const rows2 = [
      ['ชื่อลูกค้า','เบอร์โทร','สินค้า','Tracking','แอดมิน','เพจ','COD'],
      ...results.filter(r=>!r.matched).map(r => [r.name, r.phone, r.product, r.tracking, r.admin, r.page, r.cod])
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows2), 'ยังไม่จัดส่ง')

    // Sheet 3: by admin
    const rows3 = [
      ['แอดมิน','ทั้งหมด','ส่งแล้ว','ยังไม่ส่ง','% ส่ง'],
      ...Object.entries(stats.byAdmin||{}).map(([k,v]) => [k, v.total, v.shipped, v.unshipped, `${Math.round(v.shipped/v.total*100)}%`])
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows3), 'สรุปแอดมิน')

    // Sheet 4: by page
    const rows4 = [
      ['เพจ','ทั้งหมด','ส่งแล้ว','ยังไม่ส่ง','% ส่ง'],
      ...Object.entries(stats.byPage||{}).map(([k,v]) => [k, v.total, v.shipped, v.unshipped, `${Math.round(v.shipped/v.total*100)}%`])
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows4), 'สรุปเพจ')

    XLSX.writeFile(wb, `parcel_compare_${today}.xlsx`)
  }

  const S = { background:'#fff', border:'1.5px solid #dde3f5', borderRadius:10, color:'#1e1b4b', fontFamily:'inherit', fontSize:13.5, padding:'8px 12px', outline:'none' }

  const MATCH_BADGE = {
    tracking:{ label:'🎯 Tracking',      bg:'#f0fdf4', color:'#059669', border:'#bbf7d0' },
    name:    { label:'👤 ชื่อใกล้เคียง', bg:'#eef2ff', color:'#4338ca', border:'#c7d2fe' },
    phone:   { label:'📞 เบอร์โทร',      bg:'#fefce8', color:'#854d0e', border:'#fde68a' },
    none:    { label:'❓ ไม่พบ',          bg:'#fff1f2', color:'#be123c', border:'#fecdd3' },
  }

  // Unique admins/pages for filter dropdowns
  const admins = useMemo(() => [...new Set((results||[]).map(r=>r.admin).filter(Boolean))].sort(), [results])
  const pagesU = useMemo(() => [...new Set((results||[]).map(r=>r.page).filter(Boolean))].sort(), [results])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize:20, fontWeight:900, color:'#1e1b4b', marginBottom:3 }}>📦 เปรียบเทียบออเดอร์ vs ขนส่ง</h2>
        <p style={{ fontSize:12.5, color:'#6b7280' }}>นำเข้า 2 ไฟล์ (ระบบออเดอร์ + ไฟล์ขนส่ง) → ระบบ match ชื่อลูกค้า / tracking อัตโนมัติ</p>
      </div>

      {error && (
        <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:12, padding:'12px 16px', color:'#be123c', fontSize:13.5, display:'flex', gap:8 }}>
          <span>❌</span><span>{error}</span>
          <button onClick={()=>setError('')} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#be123c' }}>✕</button>
        </div>
      )}

      {/* ── Upload section ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* File A: Order */}
        <FileDropZone
          label="📋 ไฟล์ออเดอร์จากระบบ"
          desc="ไฟล์ที่ export จาก admin system, Shopee, Lazada, TikTok ฯลฯ"
          color="#6366f1" bg="#eef2ff" border="#c7d2fe"
          file={orderFile}
          onFile={f => handleFile(f, 'order')}
          accept=".xlsx,.xls,.csv"
        />

        {/* File B: Shipping */}
        <FileDropZone
          label="🚚 ไฟล์จากขนส่ง"
          desc="ไฟล์จาก J&T, Flash Express, Kerry, ไปรษณีย์ไทย ฯลฯ"
          color="#059669" bg="#f0fdf4" border="#bbf7d0"
          file={shippingFile}
          onFile={f => handleFile(f, 'shipping')}
          accept=".xlsx,.xls,.csv"
        />
      </div>

      {/* Threshold + Run */}
      {orderFile && shippingFile && !results && (
        <div style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', border:'2px solid #c4b5fd', borderRadius:16, padding:20 }}>
          <div style={{ fontSize:15, fontWeight:900, color:'#6d28d9', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
            ⚙️ ตั้งค่าการเปรียบเทียบ
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
                ความเข้มในการ Match ชื่อ ({Math.round(threshold*100)}%)
              </label>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input type="range" min="30" max="90" value={Math.round(threshold*100)}
                  onChange={e => setThreshold(parseInt(e.target.value)/100)}
                  style={{ width:160, accentColor:'#7c3aed' }}/>
                <span style={{ fontSize:13, color:'#7c3aed', fontWeight:700 }}>
                  {threshold <= 0.4 ? '⚡ หลวม' : threshold <= 0.6 ? '⚖️ กลาง' : '🎯 เข้มงวด'}
                </span>
              </div>
              <p style={{ fontSize:11.5, color:'#9ca3af', marginTop:4 }}>
                ยิ่งสูง = match เฉพาะชื่อที่เหมือนมาก · ยิ่งต่ำ = match ได้กว้างกว่า
              </p>
            </div>
            <div style={{ marginLeft:'auto' }}>
              <button onClick={runMatch}
                style={{ background:'linear-gradient(135deg,#7c3aed,#6d28d9)', border:'none', borderRadius:12, padding:'12px 28px', cursor:'pointer', fontSize:15, fontWeight:900, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 16px rgba(124,58,237,.35)' }}>
                ⚡ เปรียบเทียบเลย
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:20, height:20, borderRadius:'50%', border:'3px solid #c7d2fe', borderTopColor:'#6366f1', animation:'spin 1s linear infinite' }}/>
          <span style={{ fontSize:14, color:'#4338ca', fontWeight:600 }}>{loading}</span>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ── Results ── */}
      {results && (
        <>
          {/* Summary KPI */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12 }}>
            {[
              { emoji:'📦', label:'ออเดอร์ทั้งหมด',  val:stats.total,        bg:'linear-gradient(135deg,#eef2ff,#e0e7ff)', color:'#4338ca', border:'#c7d2fe' },
              { emoji:'✅', label:'จัดส่งแล้ว',       val:stats.shipped,      bg:'linear-gradient(135deg,#f0fdf4,#dcfce7)', color:'#059669', border:'#bbf7d0' },
              { emoji:'❌', label:'ยังไม่จัดส่ง',     val:stats.unshipped,    bg:'linear-gradient(135deg,#fff1f2,#ffe4e6)', color:'#be123c', border:'#fecdd3' },
              { emoji:'📊', label:'% จัดส่งแล้ว',    val:`${stats.shippedRate}%`, bg:'linear-gradient(135deg,#fefce8,#fef9c3)', color:'#854d0e', border:'#fde68a' },
              { emoji:'💰', label:'COD รวม',           val:`฿${(stats.totalCOD||0).toLocaleString()}`, bg:'linear-gradient(135deg,#f5f3ff,#ede9fe)', color:'#7c3aed', border:'#ddd6fe' },
            ].map((s,i) => (
              <div key={i} style={{ background:s.bg, border:`1.5px solid ${s.border}`, borderRadius:14, padding:'14px 16px' }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{s.emoji}</div>
                <div style={{ fontSize:20, fontWeight:900, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:11.5, color:'#6b7280', marginTop:4, fontWeight:600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:14, padding:'14px 18px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, fontWeight:700, marginBottom:8 }}>
              <span style={{ color:'#059669' }}>✅ จัดส่งแล้ว {stats.shipped} รายการ</span>
              <span style={{ color:'#be123c' }}>❌ ยังไม่จัดส่ง {stats.unshipped} รายการ</span>
            </div>
            <div style={{ height:10, background:'#f1f5f9', borderRadius:99, overflow:'hidden', display:'flex' }}>
              <div style={{ width:`${stats.shippedRate}%`, background:'linear-gradient(90deg,#22c55e,#059669)', borderRadius:'99px 0 0 99px', transition:'width .5s ease' }}/>
              <div style={{ flex:1, background:'#fecdd3' }}/>
            </div>
          </div>

          {/* By Admin + By Page */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {/* By Admin */}
            {Object.keys(stats.byAdmin||{}).length > 0 && (
              <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:18 }}>
                <div style={{ fontSize:14, fontWeight:900, color:'#1e1b4b', marginBottom:14, display:'flex', alignItems:'center', gap:7 }}>
                  👤 สรุปแยกตามแอดมิน
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {Object.entries(stats.byAdmin).sort((a,b)=>b[1].total-a[1].total).map(([admin, v]) => (
                    <div key={admin} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                        {(admin||'?').slice(0,2)}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{admin}</div>
                        <div style={{ height:5, background:'#f1f5f9', borderRadius:99, marginTop:4, overflow:'hidden' }}>
                          <div style={{ width:`${Math.round(v.shipped/v.total*100)}%`, height:'100%', background:'linear-gradient(90deg,#22c55e,#059669)', borderRadius:99 }}/>
                        </div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:12, fontWeight:800, color:'#059669' }}>✅ {v.shipped}</div>
                        <div style={{ fontSize:11, color:'#be123c' }}>❌ {v.unshipped}</div>
                      </div>
                      <button onClick={() => { setFilterAdmin(admin); setFilterStatus('all') }}
                        style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:7, padding:'4px 8px', cursor:'pointer', fontSize:11.5, fontWeight:700, color:'#4338ca', fontFamily:'inherit' }}>
                        ดู
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Page */}
            {Object.keys(stats.byPage||{}).length > 0 && (
              <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:18 }}>
                <div style={{ fontSize:14, fontWeight:900, color:'#1e1b4b', marginBottom:14, display:'flex', alignItems:'center', gap:7 }}>
                  📄 สรุปแยกตามเพจ
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {Object.entries(stats.byPage).sort((a,b)=>b[1].total-a[1].total).map(([page, v]) => (
                    <div key={page} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ fontSize:16 }}>📄</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{page}</div>
                        <div style={{ height:5, background:'#f1f5f9', borderRadius:99, marginTop:4, overflow:'hidden' }}>
                          <div style={{ width:`${Math.round(v.shipped/v.total*100)}%`, height:'100%', background:'linear-gradient(90deg,#22c55e,#059669)', borderRadius:99 }}/>
                        </div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:12, fontWeight:800, color:'#059669' }}>✅ {v.shipped}</div>
                        <div style={{ fontSize:11, color:'#be123c' }}>❌ {v.unshipped}</div>
                      </div>
                      <button onClick={() => { setFilterPage(page); setFilterStatus('all') }}
                        style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:7, padding:'4px 8px', cursor:'pointer', fontSize:11.5, fontWeight:700, color:'#4338ca', fontFamily:'inherit' }}>
                        ดู
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Filter + Search bar */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:14, padding:'14px 18px' }}>
            <div style={{ position:'relative', marginBottom:12 }}>
              <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}/>
              <input style={{ ...S, width:'100%', paddingLeft:36 }}
                placeholder="ค้นหาชื่อลูกค้า, Tracking, เบอร์, แอดมิน, เพจ, สินค้า..."
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
              <div style={{ display:'flex', background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:12, padding:4, gap:3 }}>
                {[
                  { k:'all',        label:`ทั้งหมด (${stats.total})` },
                  { k:'shipped',    label:`✅ ส่งแล้ว (${stats.shipped})` },
                  { k:'unshipped',  label:`❌ ยังไม่ส่ง (${stats.unshipped})` },
                ].map(t => (
                  <button key={t.k} onClick={() => setFilterStatus(t.k)}
                    style={{ padding:'6px 13px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12.5, fontWeight:700, fontFamily:'inherit', background:filterStatus===t.k?'linear-gradient(135deg,#6366f1,#7c3aed)':'transparent', color:filterStatus===t.k?'#fff':'#6366f1', whiteSpace:'nowrap' }}>
                    {t.label}
                  </button>
                ))}
              </div>
              {admins.length > 0 && (
                <select style={{ ...S, width:'auto' }} value={filterAdmin} onChange={e=>setFilterAdmin(e.target.value)}>
                  <option value="">ทุกแอดมิน</option>
                  {admins.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              {pagesU.length > 0 && (
                <select style={{ ...S, width:'auto' }} value={filterPage} onChange={e=>setFilterPage(e.target.value)}>
                  <option value="">ทุกเพจ</option>
                  {pagesU.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              <button onClick={() => { setFilterStatus('all'); setFilterAdmin(''); setFilterPage(''); setSearch('') }}
                style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:9, padding:'7px 13px', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#4338ca', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                <RefreshCw size={12}/> รีเซ็ต
              </button>
              <button onClick={exportResult}
                style={{ marginLeft:'auto', background:'linear-gradient(135deg,#059669,#10b981)', border:'none', borderRadius:10, padding:'8px 18px', cursor:'pointer', fontSize:13, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                <Download size={14}/> Export Excel
              </button>
              <button onClick={() => { setResults(null); setOrderFile(null); setShippingFile(null) }}
                style={{ background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:'8px 16px', cursor:'pointer', fontSize:13, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>
                🔄 เริ่มใหม่
              </button>
            </div>
          </div>

          {/* Results table */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
            <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
                <thead>
                  <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom:'2px solid #e0e7ff' }}>
                    {['สถานะ','ชื่อลูกค้า','สินค้า','Tracking','วิธี match','แอดมิน','เพจ','COD','วันที่ส่ง',''].map((h,i)=>(
                      <th key={i} style={{ padding:'11px 12px', textAlign:'left', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:'#9ca3af' }}>ไม่มีข้อมูล</td></tr>
                  ) : filtered.map((r, i) => {
                    const mb = MATCH_BADGE[r.matchType]
                    const isExp = expandRow === i
                    return (
                      <React.Fragment key={i}>
                        <tr style={{ borderBottom:'1px solid #f0f4ff', background:r.matched?'transparent':'#fffafb' }}>
                          <td style={{ padding:'10px 12px' }}>
                            {r.matched
                              ? <span style={{ background:'#f0fdf4', color:'#059669', border:'1.5px solid #bbf7d0', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:800, whiteSpace:'nowrap' }}>✅ ส่งแล้ว</span>
                              : <span style={{ background:'#fff1f2', color:'#be123c', border:'1.5px solid #fecdd3', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:800, whiteSpace:'nowrap' }}>❌ ยังไม่ส่ง</span>
                            }
                          </td>
                          <td style={{ padding:'10px 12px', maxWidth:160 }}>
                            <div style={{ fontSize:13.5, fontWeight:700, color:'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name||'—'}</div>
                            {r.phone && <div style={{ fontSize:11, color:'#9ca3af' }}>{r.phone}</div>}
                          </td>
                          <td style={{ padding:'10px 12px', maxWidth:140 }}>
                            <div style={{ fontSize:12.5, color:'#4b5563', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.product||'—'}</div>
                            {r.qty > 1 && <div style={{ fontSize:11, color:'#9ca3af' }}>×{r.qty}</div>}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ fontFamily:'monospace', fontSize:12.5, fontWeight:600, color:'#1e1b4b' }}>{r.tracking||'—'}</div>
                            {r.matched && r.shippingRow?.tracking && r.shippingRow.tracking !== r.tracking && (
                              <div style={{ fontFamily:'monospace', fontSize:11, color:'#059669' }}>→ {r.shippingRow.tracking}</div>
                            )}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <span style={{ background:mb.bg, color:mb.color, border:`1.5px solid ${mb.border}`, borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>
                              {mb.label}
                              {r.score > 0 && r.matchType === 'name' && ` ${Math.round(r.score*100)}%`}
                            </span>
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            {r.admin
                              ? <span style={{ background:'#eef2ff', color:'#4338ca', border:'1.5px solid #c7d2fe', borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:700 }}>{r.admin}</span>
                              : <span style={{ color:'#d1d5db' }}>—</span>
                            }
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            {r.page
                              ? <span style={{ background:'#f5f3ff', color:'#7c3aed', border:'1.5px solid #ddd6fe', borderRadius:99, padding:'3px 9px', fontSize:12, fontWeight:700 }}>{r.page}</span>
                              : <span style={{ color:'#d1d5db' }}>—</span>
                            }
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            {r.cod > 0 ? <span style={{ fontSize:13, fontWeight:800, color:'#b45309' }}>฿{r.cod.toLocaleString()}</span> : <span style={{ color:'#d1d5db' }}>—</span>}
                          </td>
                          <td style={{ padding:'10px 12px', fontSize:12.5, color:'#6b7280' }}>
                            {r.shippingRow?.date || r.date || '—'}
                          </td>
                          <td style={{ padding:'8px 10px' }}>
                            <button onClick={() => setExpandRow(isExp ? null : i)}
                              style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:7, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6366f1' }}>
                              {isExp ? <ChevronUp size={13}/> : <Eye size={12}/>}
                            </button>
                          </td>
                        </tr>
                        {isExp && (
                          <tr>
                            <td colSpan={10} style={{ padding:0 }}>
                              <div style={{ background:'linear-gradient(135deg,#fafbff,#f5f3ff)', borderTop:'1px solid #e0e7ff', padding:'16px 20px' }}>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                                  {/* Order data */}
                                  <div style={{ background:'#eef2ff', borderRadius:12, border:'1.5px solid #c7d2fe', padding:14 }}>
                                    <div style={{ fontSize:13, fontWeight:800, color:'#4338ca', marginBottom:10 }}>📋 ข้อมูลออเดอร์</div>
                                    {[
                                      ['ชื่อลูกค้า', r.name], ['เบอร์โทร', r.phone],
                                      ['ที่อยู่', r.address], ['สินค้า', r.product],
                                      ['Tracking', r.tracking], ['รหัสออเดอร์', r.orderId],
                                      ['แอดมิน', r.admin], ['เพจ', r.page], ['COD', r.cod > 0 ? `฿${r.cod}` : '—'],
                                    ].map(([k,v]) => v ? (
                                      <div key={k} style={{ display:'flex', gap:8, marginBottom:5, fontSize:12.5 }}>
                                        <span style={{ color:'#9ca3af', minWidth:80 }}>{k}:</span>
                                        <span style={{ fontWeight:600, color:'#1e1b4b', wordBreak:'break-all' }}>{v}</span>
                                      </div>
                                    ) : null)}
                                  </div>
                                  {/* Shipping data */}
                                  <div style={{ background: r.matched ? '#f0fdf4' : '#fff1f2', borderRadius:12, border:`1.5px solid ${r.matched?'#bbf7d0':'#fecdd3'}`, padding:14 }}>
                                    <div style={{ fontSize:13, fontWeight:800, color:r.matched?'#059669':'#be123c', marginBottom:10 }}>
                                      {r.matched ? '🚚 ข้อมูลขนส่ง' : '⚠️ ไม่พบในไฟล์ขนส่ง'}
                                    </div>
                                    {r.shippingRow ? [
                                      ['ชื่อลูกค้า', r.shippingRow.name],
                                      ['Tracking', r.shippingRow.tracking],
                                      ['สถานะ', r.shippingRow.status],
                                      ['วันที่ส่ง', r.shippingRow.date],
                                      ['เบอร์โทร', r.shippingRow.phone],
                                    ].map(([k,v]) => v ? (
                                      <div key={k} style={{ display:'flex', gap:8, marginBottom:5, fontSize:12.5 }}>
                                        <span style={{ color:'#9ca3af', minWidth:80 }}>{k}:</span>
                                        <span style={{ fontWeight:600, color:'#1e1b4b', wordBreak:'break-all' }}>{v}</span>
                                      </div>
                                    ) : null) : (
                                      <p style={{ color:'#9ca3af', fontSize:13 }}>ไม่พบข้อมูลที่ตรงกันในไฟล์ขนส่ง</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
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
    </div>
  )
}

// ── File Drop Zone component ──────────────────────────────
function FileDropZone({ label, desc, color, bg, border, file, onFile, accept }) {
  const ref = useRef(null)
  const [drag, setDrag] = useState(false)

  const handleDrop = e => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => !file && ref.current?.click()}
      style={{
        background: file ? bg : drag ? bg : '#fafbff',
        border: `2px ${file||drag?'solid':'dashed'} ${file||drag?border:'#dde3f5'}`,
        borderRadius:16, padding:22, cursor:file?'default':'pointer',
        transition:'all .18s', textAlign:'center',
      }}>
      <input ref={ref} type="file" accept={accept} style={{ display:'none' }}
        onChange={e => { if(e.target.files?.[0]) onFile(e.target.files[0]); e.target.value='' }}/>

      {file ? (
        <div>
          <div style={{ fontSize:30, marginBottom:10 }}>✅</div>
          <div style={{ fontSize:14, fontWeight:900, color, marginBottom:4 }}>{label}</div>
          <div style={{ fontSize:13, fontWeight:700, color:'#1e1b4b', marginBottom:3 }}>📄 {file.filename}</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>{file.data.length} รายการ · {file.headers.length} columns</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, justifyContent:'center', marginTop:8 }}>
            {[
              file.cols.nameCol >= 0 ? '✅ ชื่อลูกค้า' : '⚠️ ไม่พบชื่อ',
              file.cols.trackingCol >= 0 ? '✅ Tracking' : '➖ ไม่มี Tracking',
              file.cols.adminCol >= 0 ? '✅ แอดมิน' : '➖ ไม่พบแอดมิน',
              file.cols.pageCol >= 0 ? '✅ เพจ' : '➖ ไม่พบเพจ',
            ].map((t,i) => (
              <span key={i} style={{ fontSize:11.5, fontWeight:700, color: t.startsWith('✅')?'#059669':t.startsWith('⚠️')?'#b45309':'#9ca3af', background:'#fff', border:'1px solid #e5e7eb', borderRadius:6, padding:'2px 7px' }}>{t}</span>
            ))}
          </div>
          <button onClick={e=>{ e.stopPropagation(); ref.current?.click() }}
            style={{ marginTop:10, background:'#fff', border:`1.5px solid ${border}`, borderRadius:8, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:700, color, fontFamily:'inherit' }}>
            🔄 เปลี่ยนไฟล์
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize:40, marginBottom:10 }}>📂</div>
          <div style={{ fontSize:14, fontWeight:900, color, marginBottom:5 }}>{label}</div>
          <div style={{ fontSize:12.5, color:'#9ca3af', marginBottom:12, lineHeight:1.6 }}>{desc}</div>
          <div style={{ background:bg, border:`1.5px solid ${border}`, borderRadius:99, padding:'8px 20px', display:'inline-block', fontSize:13, fontWeight:800, color }}>
            <Upload size={14} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>
            คลิกหรือลากไฟล์มาวาง
          </div>
          <div style={{ fontSize:11.5, color:'#d1d5db', marginTop:10 }}>รองรับ .xlsx .xls .csv ทุก format</div>
        </div>
      )}
    </div>
  )
}
