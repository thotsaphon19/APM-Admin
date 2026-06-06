import React, { useState, useMemo, useRef } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { useNotify } from '../../hooks/useNotify'
import { Edit2, Trash2, ChevronDown, ChevronUp, Plus, X, RefreshCw, Upload, AlertTriangle, Search } from 'lucide-react'
import * as XLSX from 'xlsx'
import { computeDailyCommissions, splitNightShiftOrders, calcFullCommission, calcDailyQuotaCommission } from './commissionEngine'

const today     = format(new Date(), 'yyyy-MM-dd')
const thisMonth = format(new Date(), 'yyyy-MM')

const S = { width:'100%', background:'#fff', border:'1.5px solid #dde3f5', borderRadius:10, color:'#1e1b4b', fontFamily:'inherit', fontSize:14, padding:'9px 12px', outline:'none' }

export default function Commission() {
  const { profile, user, canEdit, isAdmin, isSuperAdmin, canManage, canAudit } = useAuth()
  // สิทธิ์มองเห็นข้อมูลทั้งหมด: superadmin, head_admin, assistant, auditor
  const canSeeAll = !!(isSuperAdmin || canManage || canAudit || profile?.role === 'assistant')
  const {
    commissions, pages, users, commRates,
    createCommission, editCommission, removeCommission,
    backendOrders, importBackendOrders,
    cancelledOrders, addCancel, removeCancel,
    getUserName, getPageName,
  } = useData()
  const { notifyCommission } = useNotify()

  const myUid  = user?.uid || profile?.id || ''
  const myIds  = [user?.uid, profile?.id].filter(Boolean)

  // ── form state ────────────────────────────────────
  const [showForm,   setShowForm]   = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showBackend,setShowBackend]= useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')
  const [expandRow,  setExpandRow]  = useState(null)
  const [tab,        setTab]        = useState('orders') // orders | backend | cancelled | analysis
  const [filters,    setFilters]    = useState({ date:today, month:'', adminId:'', pageId:'' })
  const [search,     setSearch]     = useState('')
  // ── Summary state ──────────────────────────────
  const [sumMode,    setSumMode]    = useState('month') // day|week|month|year
  const [sumDate,    setSumDate]    = useState(today)
  const [sumMonth,   setSumMonth]   = useState(today.slice(0,7))
  const [sumYear,    setSumYear]    = useState(today.slice(0,4))

  const makeBlank = () => ({
    date:today, adminId: isAdmin ? myUid : '',
    pageId:'', shift:'day',
    manualOrders:'', manualRate: commRates.manualRate ?? 5,
    aiOrders:'',     aiRate:     commRates.aiRate     ?? 2,
    cancelOrders:'', unclearOrders:'',
    isNightSplit:false,
    manualBefore:'', aiBefore:'', manualAfter:'', aiAfter:'',
    proOrders:'',    // ออเดอร์โปร (ไม่นับในยอดรวม)
    saleAmount:'',   // ยอดขาย (แสดงเฉพาะเจ้าของ)
    note:'',
  })
  const [form, setForm] = useState(makeBlank)
  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const setFB = k => e => setForm(p => ({ ...p, [k]: e.target.checked }))

  // cancel form
  const [cancelForm, setCancelForm] = useState({ pageId:'', date:today, qty:1, amount:0, reason:'' })
  const setCF = k => e => setCancelForm(p => ({...p, [k]: e.target.value}))

  // backend import
  const backendFileRef = useRef(null)
  const [backendPreview,  setBackendPreview]  = useState(null)
  const [compareResult,   setCompareResult]   = useState(null) // null | []
  const [compareDate,     setCompareDate]     = useState(today)

  const admins  = users.filter(u => ['admin','head_admin'].includes(u.role))
  const myPages = isAdmin ? pages.filter(p => p.assignedTo?.includes(myUid) && p.status==='active') : pages

  // ── filtered commissions ──────────────────────────
  const filtered = useMemo(() => {
    // admin เห็นเฉพาะของตัวเอง, role อื่น เห็นทั้งหมด
    let d = isAdmin && !canSeeAll ? commissions.filter(c => myIds.includes(c.adminId)) : [...commissions]
    if (filters.date && !filters.month) d = d.filter(c => c.date === filters.date)
    if (filters.month) d = d.filter(c => c.date?.startsWith(filters.month))
    if (filters.adminId) d = d.filter(c => c.adminId === filters.adminId)
    if (filters.pageId)  d = d.filter(c => c.pageId  === filters.pageId)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      d = d.filter(c =>
        getUserName(c.adminId)?.toLowerCase().includes(q) ||
        getPageName(c.pageId)?.toLowerCase().includes(q)  ||
        c.date?.includes(q) ||
        c.note?.toLowerCase().includes(q)
      )
    }
    return d.sort((a,b) => (b.date||'').localeCompare(a.date||''))
  }, [commissions, filters, isAdmin, myUid])

  // ── analysis: compute full enriched commissions ───
  const analysisDate = filters.date || today
  const analysis = useMemo(() => {
    const dayComms   = commissions.filter(c => c.date === analysisDate)
    const dayBackend = backendOrders.filter(b => b.date === analysisDate)
    const dayCancel  = cancelledOrders.filter(c => c.originalDate === analysisDate)
    if (!dayComms.length) return []
    return computeDailyCommissions(dayComms, dayBackend, dayCancel, commRates.manualRate||5, commRates.aiRate||2)
  }, [commissions, backendOrders, cancelledOrders, analysisDate, commRates])

  // ── totals ────────────────────────────────────────
  const totals = useMemo(() => filtered.reduce((a,c) => ({
    manual:  a.manual  + (c.manualOrders  ||0),
    ai:      a.ai      + (c.aiOrders      ||0),
    mComm:   a.mComm   + (c.manualTotal   ||0),
    aComm:   a.aComm   + (c.aiTotal       ||0),
    cancel:  a.cancel  + (c.cancelOrders  ||0),
    unclear: a.unclear + (c.unclearOrders ||0),
    total:   a.total   + (c.total         ||0),
  }), { manual:0,ai:0,mComm:0,aComm:0,cancel:0,unclear:0,total:0 }), [filtered])

  // ── night split preview ───────────────────────────
  const previewManual = form.isNightSplit
    ? (parseInt(form.manualBefore)||0) + (parseInt(form.manualAfter)||0)
    : (parseInt(form.manualOrders)||0)
  const previewAI = form.isNightSplit
    ? (parseInt(form.aiBefore)||0) + (parseInt(form.aiAfter)||0)
    : (parseInt(form.aiOrders)||0)
  const previewBaseTotal = previewManual*(parseFloat(form.manualRate)||0) + previewAI*(parseFloat(form.aiRate)||0)

  // ── quota preview ─────────────────────────────────
  const useQuota    = commRates.useQuota    || false
  const dailyQuota  = commRates.dailyQuota  || 0
  const dailySalary = commRates.dailySalary || 0
  const overRate    = commRates.overRate    || commRates.manualRate || 5

  const quotaResult = useQuota && dailyQuota > 0
    ? calcDailyQuotaCommission(previewManual+previewAI, dailyQuota, dailySalary, overRate)
    : null

  const previewTotal = quotaResult ? quotaResult.totalPay : previewBaseTotal

  // ── save commission ───────────────────────────────
  const handleSave = async () => {
    if (!form.adminId || !form.pageId || !form.date) { setErr('กรุณากรอก วันที่ / แอดมิน / เพจ'); return }
    setSaving(true); setErr('')
    try {
      if (form.isNightSplit && form.shift === 'night') {
        // Rule 8: split into 2 records
        const splits = splitNightShiftOrders({
          adminId: form.adminId, pageId: form.pageId, startDate: form.date,
          manualBeforeMidnight: parseInt(form.manualBefore)||0,
          aiBeforeMidnight:     parseInt(form.aiBefore)||0,
          manualAfterMidnight:  parseInt(form.manualAfter)||0,
          aiAfterMidnight:      parseInt(form.aiAfter)||0,
          manualRate: parseFloat(form.manualRate)||0,
          aiRate:     parseFloat(form.aiRate)||0,
          cancelOrders:  parseInt(form.cancelOrders)||0,
          unclearOrders: parseInt(form.unclearOrders)||0,
          note: form.note,
        })
        for (const s of splits) {
          if (editItem) await editCommission(editItem.id, s)
          else await createCommission(s)
        }
      } else {
        const mTotal = (parseInt(form.manualOrders)||0) * (parseFloat(form.manualRate)||0)
        const aTotal = (parseInt(form.aiOrders)||0)     * (parseFloat(form.aiRate)||0)
        const data = {
          ...form,
          manualOrders:  parseInt(form.manualOrders)||0,
          manualRate:    parseFloat(form.manualRate)||0,
          aiOrders:      parseInt(form.aiOrders)||0,
          aiRate:        parseFloat(form.aiRate)||0,
          cancelOrders:  parseInt(form.cancelOrders)||0,
          unclearOrders: parseInt(form.unclearOrders)||0,
          manualTotal: mTotal, aiTotal: aTotal, total: mTotal+aTotal,
        }
        delete data.isNightSplit
        delete data.manualBefore; delete data.aiBefore
        delete data.manualAfter;  delete data.aiAfter
        if (editItem) await editCommission(editItem.id, data)
        else await createCommission(data)
      }
      notifyCommission(editItem?'edit':'add', getPageName(form.pageId)+' · '+form.date)
      setShowForm(false); setForm(makeBlank()); setEditItem(null)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  // ── save cancelled order ──────────────────────────
  const handleSaveCancel = async () => {
    if (!cancelForm.pageId || !cancelForm.date) { setErr('กรุณาระบุเพจและวันที่'); return }
    setSaving(true)
    try {
      await addCancel({
        pageId:       cancelForm.pageId,
        originalDate: cancelForm.date,
        qty:          parseInt(cancelForm.qty)||1,
        amount:       parseFloat(cancelForm.amount)||0,
        reason:       cancelForm.reason,
      })
      notifyCommission('edit', `ยกเลิก ${cancelForm.qty} บ้าน เพจ ${getPageName(cancelForm.pageId)}`)
      setShowCancel(false)
      setCancelForm({ pageId:'', date:today, qty:1, amount:0, reason:'' })
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  // ── import backend Excel ──────────────────────────
  const handleBackendFile = (file) => {
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const wb   = XLSX.read(evt.target.result, { type:'binary' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' })
        const headers = rows[0]?.map(h => String(h||'').toLowerCase()) || []
        const pageIdx  = headers.findIndex(h => h.includes('เพจ')||h.includes('page'))
        const dateIdx  = headers.findIndex(h => h.includes('วัน')||h.includes('date'))
        const countIdx = headers.findIndex(h => h.includes('จำนวน')||h.includes('count')||h.includes('actual'))
        const data = rows.slice(1).filter(r=>r.some(c=>c)).map(r => ({
          pageId:      String(r[pageIdx]||'').trim(),
          date:        String(r[dateIdx]||today).trim(),
          actualCount: parseInt(r[countIdx])||0,
        })).filter(r => r.pageId)
        setBackendPreview(data)
      } catch(e) { setErr('อ่านไฟล์ไม่สำเร็จ: '+e.message) }
    }
    reader.readAsBinaryString(file)
  }

  const handleImportBackend = async () => {
    if (!backendPreview?.length) return
    setSaving(true)
    try {
      await importBackendOrders(backendPreview)
      setBackendPreview(null); setShowBackend(false)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  // ── Compare: เพจของฉัน vs Backend ─────────────────
  const handleCompare = (date) => {
    const d = date || compareDate
    // ดึงเพจที่แอดมินคนนี้รับผิดชอบ
    const myPageIds = pages.filter(p => p.assignedTo?.includes(myUid)).map(p => p.id)
    // ดึง commission ที่ลงในวันนั้น
    const myDayComms = commissions.filter(c =>
      c.date === d && (isAdmin ? myIds.includes(c.adminId) : true)
    )
    // ดึง backend ของเพจที่เกี่ยวข้อง
    const dayBackend = backendOrders.filter(b => b.date === d)

    // สร้าง compare result ต่อเพจ
    const pageSet = [...new Set([
      ...myDayComms.map(c => c.pageId),
      ...dayBackend.map(b => b.pageId),
      ...myPageIds
    ])]

    const result = pageSet.map(pageId => {
      const comms   = myDayComms.filter(c => c.pageId === pageId)
      const backend = dayBackend.find(b => b.pageId === pageId)
      const declared = comms.reduce((a,c)=>a+(parseInt(c.manualOrders)||0)+(parseInt(c.aiOrders)||0),0)
      const actual   = backend?.actualCount || 0
      const diff     = actual - declared   // + = backend มากกว่า, - = แอดมินลงเกิน
      const totalComm = comms.reduce((a,c)=>a+(c.total||(c.manualTotal||0)+(c.aiTotal||0))||((parseInt(c.manualOrders)||0)*(c.manualRate||commRates.manualRate||5)+(parseInt(c.aiOrders)||0)*(c.aiRate||commRates.aiRate||2)),0)
      // คำนวณค่าคอมที่ควรได้จาก actual
      const avgRate  = declared > 0 ? totalComm/declared : (commRates.manualRate||5)
      const adjComm  = Math.round(Math.min(declared, actual) * avgRate)
      const status   = !backend ? 'no_backend'
                     : Math.abs(diff) <= 2 ? 'match'
                     : diff < 0 ? 'over'   // แอดมินลงเกิน backend
                     : 'under'              // backend มากกว่า
      return {
        pageId, declared, actual, diff, totalComm, adjComm,
        comms, status,
        adminNames: [...new Set(comms.map(c => getUserName(c.adminId)))],
      }
    }).filter(r => r.declared > 0 || r.actual > 0)

    setCompareResult(result)
    setCompareDate(d)
  }

  const openEdit = (item) => { setForm({...item, isNightSplit:false}); setEditItem(item); setErr(''); setShowForm(true) }
  const close    = () => { setShowForm(false); setEditItem(null); setErr('') }

  // ── tab items ─────────────────────────────────────
  // ── สรุปของฉัน ───────────────────────────────────
  // Filter แบบ loose: รองรับทั้ง Firebase uid และ Firestore doc id
  const myComm  = commissions.filter(c => myIds.includes(c.adminId))
  const myToday = myComm.filter(c => c.date === today)
  const myMonth = myComm.filter(c => c.date?.startsWith(today.slice(0,7)))
  const calcTotal = c => (c.total) || (c.manualTotal||0)+(c.aiTotal||0) || 
    ((c.manualOrders||0)*(c.manualRate||5))+((c.aiOrders||0)*(c.aiRate||2))
  const myTodayTotal  = myToday.reduce((a,c)=>a+calcTotal(c),0)
  const myMonthTotal  = myMonth.reduce((a,c)=>a+calcTotal(c),0)
  const myTotalOrders = myToday.reduce((a,c)=>a+(parseInt(c.manualOrders)||0)+(parseInt(c.aiOrders)||0),0)

  const TABS = [
    { k:'orders',    label:'💰 ออเดอร์',      count: filtered.length },
    { k:'mine',      label:'👤 สรุปของฉัน',   count: myMonth.length },
    { k:'analysis',  label:'🧮 คำนวณค่าคอม',  count: analysis.length },
    { k:'summary',   label:'📊 สรุปรายงาน',   count: null },
    ...(canSeeAll ? [{ k:'backend', label:'🖥️ หลังบ้าน', count: backendOrders.filter(b=>b.date===analysisDate).length }] : []),
    { k:'cancelled', label:'❌ ยกเลิก',        count: cancelledOrders.length },
  ]

  // ── Summary computation ──────────────────────────
  const summaryData = useMemo(() => {
    // กรองตาม mode
    let base = canSeeAll ? commissions : commissions.filter(c => myIds.includes(c.adminId))

    if (sumMode === 'day') {
      base = base.filter(c => c.date === sumDate)
    } else if (sumMode === 'week') {
      // หา start/end of week (Mon-Sun)
      const d = new Date(sumDate)
      const day = d.getDay()
      const mon = new Date(d); mon.setDate(d.getDate() - (day===0?6:day-1))
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      const monStr = mon.toISOString().slice(0,10)
      const sunStr = sun.toISOString().slice(0,10)
      base = base.filter(c => c.date >= monStr && c.date <= sunStr)
    } else if (sumMode === 'month') {
      base = base.filter(c => c.date?.startsWith(sumMonth))
    } else if (sumMode === 'year') {
      base = base.filter(c => c.date?.startsWith(sumYear))
    }

    // สรุปรายแอดมิน
    const adminMap = {}
    base.forEach(c => {
      const uid = c.adminId
      if (!adminMap[uid]) adminMap[uid] = {
        adminId:uid, manual:0, ai:0, orders:0,
        proOrders:0, saleAmount:0, total:0, days:new Set(), pages:new Set()
      }
      const r = adminMap[uid]
      const m = parseInt(c.manualOrders)||0
      const a = parseInt(c.aiOrders)||0
      const mr= c.manualRate||commRates.manualRate||5
      const ar= c.aiRate||commRates.aiRate||2
      const comm = c.total||(c.manualTotal||0)+(c.aiTotal||0)||(m*mr+a*ar)
      r.manual += m; r.ai += a; r.orders += m+a
      r.total  += comm
      r.proOrders   += parseInt(c.proOrders)||0
      r.saleAmount  += parseFloat(c.saleAmount)||0
      if (c.date)   r.days.add(c.date)
      if (c.pageId) r.pages.add(c.pageId)
    })

    const rows = Object.values(adminMap).map(r=>({
      ...r, days: r.days.size, pages: r.pages.size,
    })).sort((a,b)=>b.total-a.total)

    // สรุปรายวัน (สำหรับ chart)
    const byDate = {}
    base.forEach(c => {
      if (!byDate[c.date]) byDate[c.date] = { date:c.date, orders:0, total:0 }
      byDate[c.date].orders += (parseInt(c.manualOrders)||0)+(parseInt(c.aiOrders)||0)
      byDate[c.date].total  += c.total||(c.manualTotal||0)+(c.aiTotal||0)||
        ((parseInt(c.manualOrders)||0)*(c.manualRate||5)+(parseInt(c.aiOrders)||0)*(c.aiRate||2))
    })
    const byDateArr = Object.values(byDate).sort((a,b)=>a.date.localeCompare(b.date))

    // สรุปรวม
    const grand = rows.reduce((a,r)=>({
      manual:  a.manual+r.manual,
      ai:      a.ai+r.ai,
      orders:  a.orders+r.orders,
      total:   a.total+r.total,
      saleAmount: a.saleAmount+(r.saleAmount||0),
    }),{manual:0,ai:0,orders:0,total:0,saleAmount:0})

    return { rows, grand, byDateArr, count: base.length }
  }, [commissions, sumMode, sumDate, sumMonth, sumYear, myIds, canSeeAll, commRates])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:900, color:'#1e1b4b', marginBottom:3 }}>💰 ค่าคอมมิชชั่น</h2>
          <p style={{ fontSize:12.5, color:'#6b7280' }}>
            มือ ฿{commRates.manualRate}/บ้าน · AI ฿{commRates.aiRate}/บ้าน ·
            รองรับหลายคนต่อเพจ · ชนกับ Backend · ออเดอร์ยกเลิก
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {canEdit && (
            <>
              <button onClick={() => setShowCancel(true)}
                style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:10, padding:'9px 16px', cursor:'pointer', fontSize:13, fontWeight:700, color:'#be123c', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                <X size={14}/> บันทึกยกเลิก
              </button>
              <button onClick={() => setShowBackend(true)}
                style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:10, padding:'9px 16px', cursor:'pointer', fontSize:13, fontWeight:700, color:'#b45309', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                <Upload size={14}/> Import Backend
              </button>
              <button onClick={() => { setShowForm(true); setEditItem(null); setForm(makeBlank()) }}
                className="btn btn-primary">
                <Plus size={15}/> ✏️ ลงข้อมูล
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── KPI ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12 }}>
        {[
          { emoji:'💎', label:'ค่าคอมรวม',     val:`฿${totals.total.toLocaleString()}`,           bg:'linear-gradient(135deg,#eef2ff,#e0e7ff)', color:'#4338ca', border:'#c7d2fe' },
          { emoji:'🖐',  label:'ตอบมือ (บ้าน)', val:`${totals.manual.toLocaleString()} → ฿${totals.mComm.toLocaleString()}`, bg:'linear-gradient(135deg,#f5f3ff,#ede9fe)', color:'#6d28d9', border:'#ddd6fe' },
          { emoji:'🤖', label:'AI (บ้าน)',       val:`${totals.ai.toLocaleString()} → ฿${totals.aComm.toLocaleString()}`,    bg:'linear-gradient(135deg,#f0fdfa,#ccfbf1)', color:'#0f766e', border:'#99f6e4' },
          { emoji:'❌', label:'ยกเลิก / ไม่ชัด', val:`${totals.cancel} / ${totals.unclear}`,         bg:'linear-gradient(135deg,#fff1f2,#ffe4e6)', color:'#be123c', border:'#fecdd3' },
          { emoji:'🫟', label:'กดยอดไม่ได้',      val:filtered.reduce((a,c)=>a+(c.pendingOrders||0),0), bg:'linear-gradient(135deg,#f5f3ff,#ede9fe)', color:'#7c3aed', border:'#ddd6fe' },
        ].map((k,i) => (
          <div key={i} style={{ background:k.bg, border:`1.5px solid ${k.border}`, borderRadius:14, padding:'16px 18px' }}>
            <div style={{ fontSize:24, marginBottom:8 }}>{k.emoji}</div>
            <div style={{ fontSize:15, fontWeight:900, color:k.color, lineHeight:1.3 }}>{k.val}</div>
            <div style={{ fontSize:11.5, color:'#6b7280', marginTop:5, fontWeight:600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:12, padding:4, width:'fit-content', gap:3, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding:'8px 16px', borderRadius:9, border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit',
              background: tab===t.k ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : 'transparent',
              color: tab===t.k ? '#fff' : '#6366f1', display:'flex', alignItems:'center', gap:6 }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ background:tab===t.k?'rgba(255,255,255,.3)':'#c7d2fe', color:tab===t.k?'#fff':'#4338ca', borderRadius:99, padding:'1px 7px', fontSize:11, fontWeight:900 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:14, padding:'14px 18px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, alignItems:'end' }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>🔍 ค้นหา</label>
            <div style={{ position:'relative' }}>
              <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', pointerEvents:'none' }}/>
              <input
                style={{ ...S, paddingLeft:34 }}
                placeholder="ชื่อแอดมิน, เพจ, วันที่, หมายเหตุ..."
                value={search}
                onChange={e=>setSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>📅 วันที่</label>
            <input type="date" style={S} value={filters.date} onChange={e=>setFilters(p=>({...p,date:e.target.value,month:''}))}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>📆 เดือน</label>
            <input type="month" style={S} value={filters.month} onChange={e=>setFilters(p=>({...p,month:e.target.value,date:''}))}/>
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
              {(isAdmin?myPages:pages).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={()=>{ setFilters({date:today,month:'',adminId:'',pageId:''}); setSearch('') }}
            style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:10, padding:'9px 14px', cursor:'pointer', fontSize:13, fontWeight:700, color:'#4338ca', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
            <RefreshCw size={13}/> รีเซ็ต
          </button>
          <button onClick={()=>setFilters(p=>({...p}))}
            style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:10, padding:'9px 20px', cursor:'pointer', fontSize:13.5, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:7, boxShadow:'0 4px 12px rgba(99,102,241,.3)' }}>
            <Search size={14}/> ค้นหา
          </button>
        </div>
      </div>

      {/* ══════════ TAB: ORDERS ══════════ */}
      {tab === 'orders' && (
        <>
          {/* Inline form */}
          {showForm && (
            <div style={{ background:'#fff', border:'2px solid #6366f1', borderRadius:20, padding:26, boxShadow:'0 8px 32px rgba(99,102,241,.12)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:44, height:44, borderRadius:14, background:'linear-gradient(135deg,#6366f1,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                    {editItem?'✏️':'📝'}
                  </div>
                  <div>
                    <div style={{ fontSize:17, fontWeight:900, color:'#1e1b4b' }}>{editItem?'แก้ไขข้อมูล':'ลงข้อมูลค่าคอม'}</div>
                    <div style={{ fontSize:12, color:'#9ca3af' }}>รองรับหลายคนต่อเพจ · กะข้ามวัน</div>
                  </div>
                </div>
                <button onClick={close} style={{ background:'#f1f5f9', border:'none', borderRadius:9, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}><X size={15}/></button>
              </div>
              {err && <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:10, padding:'10px 14px', color:'#be123c', fontSize:13.5, marginBottom:14, display:'flex', gap:8 }}>❌ {err}</div>}

              {/* Row 1: วันที่ + แอดมิน + กะ */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:14 }}>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📅 วันที่ *</label>
                  <input type="date" style={S} value={form.date} onChange={setF('date')}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>👤 แอดมิน *</label>
                  <select style={S} value={form.adminId} onChange={setF('adminId')} disabled={isAdmin}>
                    <option value="">-- เลือก --</option>
                    {admins.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>🕐 กะ</label>
                  <select style={S} value={form.shift} onChange={setF('shift')}>
                    <option value="day">☀️ กะกลางวัน (05:00–20:00)</option>
                    <option value="night">🌙 กะดึก (20:00–05:00)</option>
                  </select>
                </div>
              </div>

              {/* เพจ */}
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>📄 เพจ *</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
                  {myPages.map(p => {
                    const sel = form.pageId === p.id
                    return (
                      <button key={p.id} onClick={()=>setForm(pv=>({...pv,pageId:p.id}))}
                        style={{ padding:'10px 14px', borderRadius:11, cursor:'pointer', textAlign:'left', fontFamily:'inherit', border:`1.5px solid ${sel?'#6366f1':'#dde3f5'}`, background:sel?'linear-gradient(135deg,#eef2ff,#e0e7ff)':'#fff', transition:'all .15s' }}>
                        <div style={{ fontSize:13, fontWeight:700, color:sel?'#4338ca':'#1e1b4b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {p.type==='main'?'⭐':'🧪'} {p.name}
                        </div>
                        {sel && <div style={{ fontSize:11, color:'#4338ca', fontWeight:700, marginTop:3 }}>✓ เลือกแล้ว</div>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Rule 8: Night shift split toggle */}
              {form.shift === 'night' && (
                <div style={{ background:'linear-gradient(135deg,#eef2ff,#e0e7ff)', border:'1.5px solid #c7d2fe', borderRadius:12, padding:'12px 16px', marginBottom:16 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:14, fontWeight:700, color:'#4338ca' }}>
                    <input type="checkbox" checked={form.isNightSplit} onChange={setFB('isNightSplit')} style={{ width:17, height:17, accentColor:'#6366f1' }}/>
                    🌙 กะข้ามวัน (แยกออเดอร์ก่อน/หลัง 00:00)
                  </label>
                  {form.isNightSplit && (
                    <div style={{ marginTop:12, fontSize:12, color:'#4338ca' }}>
                      ⚡ ออเดอร์ก่อน 00:00 บันทึกใต้วัน <strong>{form.date}</strong> · หลัง 00:00 บันทึกใต้วัน <strong>{form.date ? format(addDays(parseISO(form.date),1),'yyyy-MM-dd') : 'พรุ่งนี้'}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Orders input */}
              {form.isNightSplit ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                  {/* Before midnight */}
                  <div style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', border:'2px solid #ddd6fe', borderRadius:14, padding:16 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#6d28d9', marginBottom:12 }}>🌙 ก่อน 00:00 (นับวันนี้)</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#7c3aed', marginBottom:5 }}>🖐 มือ (บ้าน)</label>
                        <input type="number" min="0" style={{...S,textAlign:'center',fontWeight:800,color:'#6d28d9'}} placeholder="0" value={form.manualBefore} onChange={setF('manualBefore')}/></div>
                      <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#7c3aed', marginBottom:5 }}>🤖 AI (บ้าน)</label>
                        <input type="number" min="0" style={{...S,textAlign:'center',fontWeight:800,color:'#0f766e'}} placeholder="0" value={form.aiBefore} onChange={setF('aiBefore')}/></div>
                    </div>
                  </div>
                  {/* After midnight */}
                  <div style={{ background:'linear-gradient(135deg,#fefce8,#fef9c3)', border:'2px solid #fde68a', borderRadius:14, padding:16 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#854d0e', marginBottom:12 }}>🌅 หลัง 00:00 (นับวันพรุ่งนี้)</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#b45309', marginBottom:5 }}>🖐 มือ (บ้าน)</label>
                        <input type="number" min="0" style={{...S,textAlign:'center',fontWeight:800,color:'#b45309'}} placeholder="0" value={form.manualAfter} onChange={setF('manualAfter')}/></div>
                      <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#b45309', marginBottom:5 }}>🤖 AI (บ้าน)</label>
                        <input type="number" min="0" style={{...S,textAlign:'center',fontWeight:800,color:'#0f766e'}} placeholder="0" value={form.aiAfter} onChange={setF('aiAfter')}/></div>
                    </div>
                  </div>
                  {/* Rates */}
                  <div style={{ gridColumn:'1/-1', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#7c3aed', marginBottom:5 }}>฿มือ / บ้าน</label><input type="number" min="0" step="0.5" style={{...S,textAlign:'center'}} value={form.manualRate} onChange={setF('manualRate')}/></div>
                    <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#0d9488', marginBottom:5 }}>฿AI / บ้าน</label><input type="number" min="0" step="0.5" style={{...S,textAlign:'center'}} value={form.aiRate} onChange={setF('aiRate')}/></div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', border:'2px solid #ddd6fe', borderRadius:14, padding:16, marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#6d28d9', marginBottom:12 }}>🖐 ตอบมือ</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                      <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#7c3aed', marginBottom:5 }}>จำนวน (บ้าน)</label>
                        <input type="number" min="0" style={{...S,textAlign:'center',fontSize:16,fontWeight:800,color:'#6d28d9'}} placeholder="0" value={form.manualOrders} onChange={setF('manualOrders')}/></div>
                      <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#7c3aed', marginBottom:5 }}>฿ / บ้าน</label>
                        <input type="number" min="0" step="0.5" style={{...S,textAlign:'center'}} value={form.manualRate} onChange={setF('manualRate')}/></div>
                      <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#7c3aed', marginBottom:5 }}>ยอดค่าคอม</label>
                        <div style={{...S,background:'#ede9fe',border:'2px solid #c4b5fd',textAlign:'center',fontSize:16,fontWeight:900,color:'#6d28d9'}}>
                          ฿{((parseInt(form.manualOrders)||0)*(parseFloat(form.manualRate)||0)).toLocaleString()}
                        </div></div>
                    </div>
                  </div>
                  <div style={{ background:'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border:'2px solid #99f6e4', borderRadius:14, padding:16, marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#0f766e', marginBottom:12 }}>🤖 AI</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                      <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#0d9488', marginBottom:5 }}>จำนวน (บ้าน)</label>
                        <input type="number" min="0" style={{...S,textAlign:'center',fontSize:16,fontWeight:800,color:'#0f766e'}} placeholder="0" value={form.aiOrders} onChange={setF('aiOrders')}/></div>
                      <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#0d9488', marginBottom:5 }}>฿ / บ้าน</label>
                        <input type="number" min="0" step="0.5" style={{...S,textAlign:'center'}} value={form.aiRate} onChange={setF('aiRate')}/></div>
                      <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#0d9488', marginBottom:5 }}>ยอดค่าคอม</label>
                        <div style={{...S,background:'#ccfbf1',border:'2px solid #5eead4',textAlign:'center',fontSize:16,fontWeight:900,color:'#0f766e'}}>
                          ฿{((parseInt(form.aiOrders)||0)*(parseFloat(form.aiRate)||0)).toLocaleString()}
                        </div></div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
                    <div><label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>❌ ยกเลิก (บ้าน)</label>
                      <input type="number" min="0" style={{...S,textAlign:'center',color:'#be123c',fontWeight:700}} placeholder="0" value={form.cancelOrders} onChange={setF('cancelOrders')}/></div>
                    <div><label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#d97706', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>🔍 ไม่ชัดเจน (บ้าน)</label>
                      <input type="number" min="0" style={{...S,textAlign:'center',color:'#d97706',fontWeight:700}} placeholder="0" value={form.unclearOrders} onChange={setF('unclearOrders')}/></div>
                    <div>
                      <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>🫟 กดยอดไม่ได้ (บ้าน)</label>
                      <input type="number" min="0" style={{...S,textAlign:'center',color:'#7c3aed',fontWeight:700}} placeholder="0" value={form.pendingOrders||''} onChange={setF('pendingOrders')}/>
                      <div style={{ fontSize:10.5, color:'#9ca3af', marginTop:4 }}>รับแล้ว ยังไม่ส่ง</div>
                    </div>
                  </div>
                </>
              )}

              {/* ── โปร + ยอดขาย ── */}
              <div style={{ background:'#f0fdf4', border:'1.5px solid #bbf7d0', borderRadius:12, padding:'14px 16px', marginBottom:18 }}>
                <div style={{ fontSize:12, fontWeight:800, color:'#059669', marginBottom:10 }}>
                  📊 ข้อมูลเสริม — แสดงเฉพาะคุณ ไม่นับในยอดรวมทีม
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#059669', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>🎯 ออเดอร์โปร (บ้าน)</label>
                    <input type="number" style={{...S}} value={form.proOrders||''} onChange={setF('proOrders')} placeholder="0" min="0"/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#059669', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>💵 ยอดขาย (฿)</label>
                    <input type="number" style={{...S}} value={form.saleAmount||''} onChange={setF('saleAmount')} placeholder="0" min="0"/>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom:18 }}>
                <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>📝 หมายเหตุ</label>
                <textarea style={{...S,minHeight:60,resize:'vertical'}} placeholder="หมายเหตุ..." value={form.note} onChange={setF('note')}/>
              </div>

              {/* Summary */}
              <div style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', borderRadius:12, padding:'14px 20px', marginBottom:18 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                  <div style={{ color:'rgba(255,255,255,.85)', fontSize:13 }}>
                    🖐 {previewManual} + 🤖 {previewAI} = {previewManual+previewAI} บ้าน
                    {form.isNightSplit && form.shift==='night' && <span style={{ marginLeft:8, fontSize:11, opacity:.7 }}>· บันทึก 2 วัน</span>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginBottom:2 }}>
                      {quotaResult ? '💵 เงินรายวัน + ค่าคอมเกิน' : 'ค่าคอมรวม'}
                    </div>
                    <div style={{ fontSize:26, fontWeight:900, color:'#fff' }}>฿{previewTotal.toLocaleString()}</div>
                  </div>
                </div>
                {quotaResult && (
                  <div style={{ marginTop:10, borderTop:'1px solid rgba(255,255,255,.2)', paddingTop:10, display:'flex', flexWrap:'wrap', gap:12, fontSize:12 }}>
                    <span style={{ color:'rgba(255,255,255,.8)' }}>
                      🎯 โควต้า {dailyQuota} บ้าน: {quotaResult.quotaOrders} บ้านในโควต้า + {quotaResult.overOrders > 0 ? <><span style={{ color:'#fde68a', fontWeight:800 }}>{quotaResult.overOrders} บ้านที่เกิน → ฿{quotaResult.overCommission.toLocaleString()}</span></> : 'ไม่มีบ้านเกิน'}
                    </span>
                    <span style={{ color:'rgba(255,255,255,.8)' }}>
                      💵 เงินรายวัน: ฿{dailySalary.toLocaleString ? dailySalary.toLocaleString() : dailySalary}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={close} style={{ background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:10, padding:'9px 20px', fontSize:14, fontWeight:700, color:'#6b7280', cursor:'pointer', fontFamily:'inherit' }}>ยกเลิก</button>
                <button onClick={handleSave} disabled={saving} style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:10, padding:'9px 24px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit', opacity:saving?0.6:1 }}>
                  {saving?'⏳ กำลังบันทึก...':editItem?'✅ บันทึก':'💾 บันทึก'}
                </button>
              </div>
            </div>
          )}

          {/* Orders table */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
            <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom:'2px solid #e0e7ff' }}>
                    {['📅','👤 แอดมิน','📄 เพจ','กะ','🖐 มือ','฿มือ','🤖 AI','฿AI','❌','💎 รวม',''].map((h,i)=>(
                      <th key={i} style={{ padding:'10px 12px', textAlign:i>=4?'center':'left', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length===0 ? (
                    <tr><td colSpan={11} style={{ textAlign:'center', padding:36 }}>
                      <div style={{ fontSize:36, marginBottom:8 }}>📭</div>
                      <div style={{ color:'#9ca3af', fontWeight:600 }}>ยังไม่มีข้อมูล</div>
                    </td></tr>
                  ) : filtered.map(c => {
                    const sh = c.shift==='night' ? {bg:'#eef2ff',color:'#4338ca'} : {bg:'#fffbeb',color:'#b45309'}
                    const isExp = expandRow===c.id
                    return (
                      <React.Fragment key={c.id}>
                        <tr style={{ borderBottom:'1px solid #f0f4ff' }}>
                          <td style={{ padding:'10px 12px', fontSize:12.5, color:'#6b7280' }}>
                            {c.date}
                            {c.segment==='after_midnight' && <div style={{ fontSize:10, color:'#6366f1', fontWeight:700 }}>🌅 หลังเที่ยงคืน</div>}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                              <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>
                                {getUserName(c.adminId).slice(0,2)}
                              </div>
                              <span style={{ fontSize:13, fontWeight:600, color:'#1e1b4b' }}>{getUserName(c.adminId)}</span>
                            </div>
                          </td>
                          <td style={{ padding:'10px 12px', fontSize:13, color:'#4b5563', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {getPageName(c.pageId)}
                          </td>
                          <td style={{ padding:'10px 8px' }}>
                            <span style={{ background:sh.bg, color:sh.color, borderRadius:99, padding:'2px 8px', fontSize:11.5, fontWeight:700 }}>
                              {c.shift==='night'?'🌙 กะดึก':'☀️ กลางวัน'}
                            </span>
                          </td>
                          <td style={{ textAlign:'center', fontSize:15, fontWeight:800, color:'#6d28d9' }}>{c.manualOrders||0}</td>
                          <td style={{ textAlign:'center', fontSize:12, color:'#7c3aed', fontWeight:600 }}>฿{(c.manualTotal||0).toLocaleString()}</td>
                          <td style={{ textAlign:'center', fontSize:15, fontWeight:800, color:'#0f766e' }}>{c.aiOrders||0}</td>
                          <td style={{ textAlign:'center', fontSize:12, color:'#0d9488', fontWeight:600 }}>฿{(c.aiTotal||0).toLocaleString()}</td>
                          <td style={{ textAlign:'center', fontSize:13, fontWeight:700, color:(c.cancelOrders||0)>0?'#be123c':'#d1d5db' }}>{c.cancelOrders||0}</td>
                          <td style={{ textAlign:'right', padding:'10px 12px', fontSize:16, fontWeight:900, color:'#4338ca' }}>฿{(c.total||0).toLocaleString()}</td>
                          <td style={{ padding:'8px 8px' }}>
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={()=>setExpandRow(isExp?null:c.id)} style={{ background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:7, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6366f1' }}>
                                {isExp?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
                              </button>
                              {canEdit&&(profile?.role!=='admin'||c.adminId===myUid)&&(
                                <button onClick={()=>openEdit(c)} style={{ background:'#f0fdf4', border:'1.5px solid #bbf7d0', borderRadius:7, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#059669' }}>
                                  <Edit2 size={12}/>
                                </button>
                              )}
                              {isSuperAdmin&&(
                                <button onClick={async()=>{ await removeCommission(c.id); notifyCommission('delete','') }} style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:7, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#be123c' }}>
                                  <Trash2 size={12}/>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExp && (
                          <tr><td colSpan={11} style={{ padding:0 }}>
                            <div style={{ background:'linear-gradient(135deg,#fafbff,#f5f3ff)', borderTop:'1px solid #e0e7ff', padding:'14px 18px', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                              {[
                                {l:'🖐 มือ',v:`${c.manualOrders||0} บ้าน × ฿${c.manualRate||0} = ฿${(c.manualTotal||0).toLocaleString()}`,color:'#6d28d9',bg:'#f5f3ff',border:'#ddd6fe'},
                                {l:'🤖 AI', v:`${c.aiOrders||0} บ้าน × ฿${c.aiRate||0} = ฿${(c.aiTotal||0).toLocaleString()}`,color:'#0f766e',bg:'#f0fdfa',border:'#99f6e4'},
                                {l:'❌ ปัญหา',v:`ยกเลิก ${c.cancelOrders||0} · ไม่ชัด ${c.unclearOrders||0}`,color:'#be123c',bg:'#fff1f2',border:'#fecdd3'},
                                {l:'🫟 กดยอดไม่ได้',v:`${c.pendingOrders||0} บ้าน (รับแล้ว ยังไม่ส่ง)`,color:'#7c3aed',bg:'#f5f3ff',border:'#ddd6fe'},
                                {l:'💎 รวม',v:`฿${(c.total||0).toLocaleString()} · ${c.note||'ไม่มีหมายเหตุ'}`,color:'#4338ca',bg:'#eef2ff',border:'#c7d2fe'},
                              ].map((d,i)=>(
                                <div key={i} style={{ background:d.bg, border:`1.5px solid ${d.border}`, borderRadius:10, padding:12 }}>
                                  <div style={{ fontSize:12, fontWeight:800, color:d.color, marginBottom:6 }}>{d.l}</div>
                                  <div style={{ fontSize:13, color:'#4b5563' }}>{d.v}</div>
                                </div>
                              ))}
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                  {filtered.length>0&&(
                    <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderTop:'2px solid #c7d2fe' }}>
                      <td colSpan={4} style={{ padding:'11px 12px', fontSize:12, fontWeight:800, color:'#4338ca' }}>รวม {filtered.length} รายการ</td>
                      <td style={{ textAlign:'center', fontWeight:900, color:'#6d28d9', fontSize:15 }}>{totals.manual.toLocaleString()}</td>
                      <td style={{ textAlign:'center', fontWeight:700, color:'#7c3aed', fontSize:12 }}>฿{totals.mComm.toLocaleString()}</td>
                      <td style={{ textAlign:'center', fontWeight:900, color:'#0f766e', fontSize:15 }}>{totals.ai.toLocaleString()}</td>
                      <td style={{ textAlign:'center', fontWeight:700, color:'#0d9488', fontSize:12 }}>฿{totals.aComm.toLocaleString()}</td>
                      <td style={{ textAlign:'center', fontWeight:800, color:'#be123c' }}>{totals.cancel}</td>
                      <td style={{ textAlign:'right', padding:'11px 12px', fontSize:18, fontWeight:900, color:'#4338ca' }}>฿{totals.total.toLocaleString()}</td>
                      <td/>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══════════ TAB: ANALYSIS (คำนวณ) ══════════ */}
      {tab==='analysis' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:14, padding:'12px 18px', fontSize:13.5, color:'#92400e', fontWeight:600, display:'flex', alignItems:'flex-start', gap:8 }}>
            <AlertTriangle size={16} style={{ flexShrink:0, marginTop:1 }}/>
            <div>
              <strong>คำนวณค่าคอมสุทธิ</strong> วันที่ <strong>{analysisDate}</strong>
              <br/>รวม Rule 4 (หลายคนต่อเพจ), Rule 5-6 (ชนหลังบ้าน), Rule 7 (ออเดอร์ยกเลิก)
            </div>
          </div>

          {analysis.length===0 ? (
            <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:36, textAlign:'center', color:'#9ca3af' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>🧮</div>
              <div style={{ fontSize:14, color:'#6b7280', fontWeight:600 }}>ไม่มีข้อมูลออเดอร์วันที่เลือก</div>
            </div>
          ) : (
            <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
              <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom:'2px solid #e0e7ff' }}>
                      {['👤 แอดมิน','📄 เพจ','ค่าคอมตั้งต้น','สัดส่วน','หักออเดอร์หาย','หักยกเลิก','💎 สุทธิ','⚠️'].map((h,i)=>(
                        <th key={i} style={{ padding:'10px 13px', textAlign:i>=2?'center':'left', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.map((r,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid #f0f4ff', background:r.hasDeduction?'#fffafb':'transparent' }}>
                        <td style={{ padding:'11px 13px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                            <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>
                              {getUserName(r.adminId).slice(0,2)}
                            </div>
                            <span style={{ fontSize:13, fontWeight:600 }}>{getUserName(r.adminId)}</span>
                          </div>
                        </td>
                        <td style={{ padding:'11px 13px', fontSize:13, color:'#4b5563' }}>{getPageName(r.pageId)}</td>
                        <td style={{ textAlign:'center', fontSize:13, fontWeight:700, color:'#4338ca' }}>฿{(r.total||0).toLocaleString()}</td>
                        <td style={{ textAlign:'center', fontSize:13, color:'#6b7280' }}>
                          {r.pagePeers > 1
                            ? <span style={{ background:'#eef2ff', color:'#4338ca', borderRadius:99, padding:'2px 9px', fontSize:12, fontWeight:700 }}>
                                {Math.round((r.shareRatio||1)*100)}% ({r.pagePeers} คน)
                              </span>
                            : <span style={{ color:'#9ca3af', fontSize:12 }}>—</span>
                          }
                        </td>
                        <td style={{ textAlign:'center', fontSize:13, fontWeight:700, color:(r.lostDeduction||0)>0?'#be123c':'#9ca3af' }}>
                          {(r.lostDeduction||0)>0 ? `−฿${r.lostDeduction.toFixed(2)}` : '—'}
                          {r.lostOrders>0 && <div style={{ fontSize:10, color:'#9ca3af' }}>{r.lostOrders} บ้าน</div>}
                        </td>
                        <td style={{ textAlign:'center', fontSize:13, fontWeight:700, color:(r.cancelDeduction||0)>0?'#be123c':'#9ca3af' }}>
                          {(r.cancelDeduction||0)>0 ? `−฿${r.cancelDeduction.toFixed(2)}` : '—'}
                          {r.cancelQty>0 && <div style={{ fontSize:10, color:'#9ca3af' }}>{r.cancelQty} บ้าน</div>}
                        </td>
                        <td style={{ textAlign:'center', padding:'11px 13px', fontSize:17, fontWeight:900, color: r.hasDeduction?'#be123c':'#059669' }}>
                          ฿{(r.netTotal||0).toFixed(2)}
                        </td>
                        <td style={{ textAlign:'center', padding:'8px 10px' }}>
                          {r.hasDeduction
                            ? <span style={{ background:'#fff1f2', color:'#be123c', border:'1.5px solid #fecdd3', borderRadius:99, padding:'3px 9px', fontSize:11.5, fontWeight:700 }}>⚠️ มีหัก</span>
                            : <span style={{ background:'#f0fdf4', color:'#059669', border:'1.5px solid #bbf7d0', borderRadius:99, padding:'3px 9px', fontSize:11.5, fontWeight:700 }}>✅ ปกติ</span>
                          }
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderTop:'2px solid #c7d2fe' }}>
                      <td colSpan={6} style={{ padding:'11px 13px', fontSize:12, fontWeight:800, color:'#4338ca' }}>รวมทั้งหมด</td>
                      <td style={{ textAlign:'center', padding:'11px 13px', fontSize:18, fontWeight:900, color:'#4338ca' }}>
                        ฿{analysis.reduce((a,r)=>a+(r.netTotal||0),0).toFixed(2)}
                      </td>
                      <td/>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: BACKEND ══════════ */}
      
      {/* ══ TAB: สรุปของฉัน ══════════════════════════════════════ */}
      {tab === 'mine' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* KPI ของฉัน */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
            {[
              { e:'💎', l:'ค่าคอมวันนี้',   v:`฿${myTodayTotal.toLocaleString()}`, c:'#4338ca', bg:'linear-gradient(135deg,#eef2ff,#e0e7ff)', b:'#c7d2fe' },
              { e:'📦', l:'ออเดอร์วันนี้',   v:myTotalOrders, c:'#059669', bg:'linear-gradient(135deg,#f0fdf4,#dcfce7)', b:'#bbf7d0' },
              { e:'📅', l:'ค่าคอมเดือนนี้',  v:`฿${myMonthTotal.toLocaleString()}`, c:'#7c3aed', bg:'linear-gradient(135deg,#f5f3ff,#ede9fe)', b:'#ddd6fe' },
              { e:'📋', l:'ลงข้อมูลเดือนนี้', v:`${myMonth.length} ครั้ง`, c:'#b45309', bg:'linear-gradient(135deg,#fffbeb,#fef3c7)', b:'#fde68a' },
              { e:'🎯', l:'ออเดอร์โปร',      v:myComm.reduce((a,c)=>a+(parseInt(c.proOrders)||0),0), c:'#059669', bg:'linear-gradient(135deg,#f0fdf4,#dcfce7)', b:'#bbf7d0' },
              { e:'💵', l:'ยอดขายรวม',       v:`฿${myComm.filter(c=>c.adminId===myUid).reduce((a,c)=>a+(parseFloat(c.saleAmount)||0),0).toLocaleString()}`, c:'#0f766e', bg:'linear-gradient(135deg,#f0fdfa,#ccfbf1)', b:'#99f6e4' },
            ].map((k,i)=>(
              <div key={i} style={{ background:k.bg, border:`1.5px solid ${k.b}`, borderRadius:14, padding:'14px 16px' }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{k.e}</div>
                <div style={{ fontSize:20, fontWeight:900, color:k.c }}>{k.v}</div>
                <div style={{ fontSize:11.5, color:'#6b7280', marginTop:4, fontWeight:600 }}>{k.l}</div>
              </div>
            ))}
          </div>

          {/* ตารางรายการของฉัน */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #f0f4ff', display:'flex', alignItems:'center', justifyContent:'space-between', background:'linear-gradient(135deg,#f5f3ff,#eef2ff)' }}>
              <div style={{ fontSize:15, fontWeight:900, color:'#1e1b4b' }}>👤 รายการของฉัน</div>
              <div style={{ fontSize:12.5, color:'#6b7280' }}>{myComm.length} รายการทั้งหมด</div>
            </div>
            <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                <thead style={{ position:'sticky', top:0 }}>
                  <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom:'2px solid #e0e7ff' }}>
                    {['📅 วันที่','📄 เพจ','🌅 กะ','🖐 มือ','🤖 AI','🎯 โปร','💵 ยอดขาย','💎 รวม','📝 หมายเหตุ'].map((h,i)=>(
                      <th key={i} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myComm.slice().sort((a,b)=>b.date?.localeCompare(a.date||'')).map((c,i)=>(
                    <tr key={c.id||i} style={{ borderBottom:'1px solid #f0f4ff' }}>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:'#1e1b4b', whiteSpace:'nowrap' }}>{c.date}</td>
                      <td style={{ padding:'10px 12px', color:'#4338ca', fontWeight:600 }}>{getPageName(c.pageId)}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ background:c.shift==='night'?'#eef2ff':'#fffbeb', color:c.shift==='night'?'#4338ca':'#b45309', border:`1px solid ${c.shift==='night'?'#c7d2fe':'#fde68a'}`, borderRadius:99, padding:'2px 8px', fontSize:11.5, fontWeight:700 }}>
                          {c.shift==='night'?'🌙 ดึก':'☀️ กลางวัน'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px', color:'#7c3aed', fontWeight:700 }}>{c.manualOrders||0}</td>
                      <td style={{ padding:'10px 12px', color:'#0f766e', fontWeight:700 }}>{c.aiOrders||0}</td>
                      <td style={{ padding:'10px 12px', color:'#059669', fontWeight:700 }}>{c.proOrders||'—'}</td>
                      <td style={{ padding:'10px 12px', color:'#0f766e', fontWeight:700 }}>{c.saleAmount?`฿${parseFloat(c.saleAmount).toLocaleString()}`:'—'}</td>
                      <td style={{ padding:'10px 12px', fontSize:15, fontWeight:900, color:'#4338ca' }}>฿{calcTotal(c).toLocaleString()}</td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'#6b7280' }}>{c.note||'—'}</td>
                    </tr>
                  ))}
                  {myComm.length===0&&(
                    <tr><td colSpan={9} style={{ padding:'32px', textAlign:'center', color:'#9ca3af' }}>
                      <div style={{ fontSize:20, marginBottom:8 }}>📭</div>
                      <div style={{ fontWeight:700, color:'#6b7280', marginBottom:4 }}>ยังไม่มีข้อมูล</div>
                      <div style={{ fontSize:12, color:'#9ca3af' }}>
                        ลงข้อมูลค่าคอมในแท็บ "💰 ออเดอร์" แล้วกลับมาดูที่นี่
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* ══ TAB: สรุปรายงาน ══ */}
      {tab === 'summary' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Period Selector */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:'16px 20px' }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'flex-end' }}>
              <div>
                <div style={{ fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:7 }}>ช่วงเวลา</div>
                <div style={{ display:'flex', gap:6 }}>
                  {[{v:'day',l:'📅 รายวัน'},{v:'week',l:'📆 สัปดาห์'},{v:'month',l:'🗓️ รายเดือน'},{v:'year',l:'📊 รายปี'}].map(m=>(
                    <button key={m.v} onClick={()=>setSumMode(m.v)}
                      style={{ background:sumMode===m.v?'linear-gradient(135deg,#6366f1,#7c3aed)':'#f1f5f9', border:`1.5px solid ${sumMode===m.v?'#6366f1':'#e0e7ff'}`, borderRadius:9, padding:'7px 12px', cursor:'pointer', fontSize:12, fontWeight:700, color:sumMode===m.v?'#fff':'#6b7280', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>
              {sumMode==='day' && (
                <div>
                  <div style={{ fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:7 }}>วันที่</div>
                  <input type="date" value={sumDate} onChange={e=>setSumDate(e.target.value)}
                    style={{ padding:'8px 12px', borderRadius:9, border:'1.5px solid #c7d2fe', background:'#fafbff', fontSize:13.5, color:'#1e1b4b', fontFamily:'inherit' }}/>
                </div>
              )}
              {sumMode==='week' && (
                <div>
                  <div style={{ fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:7 }}>เลือกวันในสัปดาห์</div>
                  <input type="date" value={sumDate} onChange={e=>setSumDate(e.target.value)}
                    style={{ padding:'8px 12px', borderRadius:9, border:'1.5px solid #c7d2fe', background:'#fafbff', fontSize:13.5, color:'#1e1b4b', fontFamily:'inherit' }}/>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>ระบบแสดงข้อมูลทั้งสัปดาห์ที่วันนี้อยู่</div>
                </div>
              )}
              {sumMode==='month' && (
                <div>
                  <div style={{ fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:7 }}>เดือน</div>
                  <input type="month" value={sumMonth} onChange={e=>setSumMonth(e.target.value)}
                    style={{ padding:'8px 12px', borderRadius:9, border:'1.5px solid #c7d2fe', background:'#fafbff', fontSize:13.5, color:'#1e1b4b', fontFamily:'inherit' }}/>
                </div>
              )}
              {sumMode==='year' && (
                <div>
                  <div style={{ fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:7 }}>ปี</div>
                  <select value={sumYear} onChange={e=>setSumYear(e.target.value)}
                    style={{ padding:'8px 12px', borderRadius:9, border:'1.5px solid #c7d2fe', background:'#fafbff', fontSize:13.5, color:'#1e1b4b', fontFamily:'inherit' }}>
                    {Array.from({length:5},(_,i)=>String(new Date().getFullYear()-i)).map(y=>(
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Grand KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:12 }}>
            {[
              { e:'💰', l:'ค่าคอมรวม',   v:`฿${Math.round(summaryData.grand.total).toLocaleString()}`, c:'#4338ca', bg:'linear-gradient(135deg,#eef2ff,#e0e7ff)', b:'#c7d2fe' },
              { e:'📦', l:'ออเดอร์รวม', v:summaryData.grand.orders.toLocaleString(), c:'#059669', bg:'linear-gradient(135deg,#f0fdf4,#dcfce7)', b:'#bbf7d0' },
              { e:'🖐',  l:'ตอบมือ',    v:summaryData.grand.manual.toLocaleString(), c:'#7c3aed', bg:'linear-gradient(135deg,#f5f3ff,#ede9fe)', b:'#ddd6fe' },
              { e:'🤖', l:'AI',         v:summaryData.grand.ai.toLocaleString(),     c:'#0f766e', bg:'linear-gradient(135deg,#f0fdfa,#ccfbf1)', b:'#99f6e4' },
              { e:'👥', l:'แอดมิน',     v:`${summaryData.rows.length} คน`,          c:'#b45309', bg:'linear-gradient(135deg,#fffbeb,#fef3c7)', b:'#fde68a' },
              { e:'📋', l:'รายการ',     v:`${summaryData.count} รายการ`,            c:'#6b7280', bg:'linear-gradient(135deg,#f9fafb,#f3f4f6)', b:'#e5e7eb' },
            ].map((k,i)=>(
              <div key={i} style={{ background:k.bg, border:`1.5px solid ${k.b}`, borderRadius:14, padding:'13px 16px' }}>
                <div style={{ fontSize:20, marginBottom:5 }}>{k.e}</div>
                <div style={{ fontSize:19, fontWeight:900, color:k.c }}>{k.v}</div>
                <div style={{ fontSize:11.5, color:'#6b7280', marginTop:4, fontWeight:600 }}>{k.l}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          {summaryData.byDateArr.length > 1 && (
            <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, padding:'16px 20px' }}>
              <div style={{ fontSize:14, fontWeight:900, color:'#1e1b4b', marginBottom:14 }}>📈 แนวโน้มค่าคอม</div>
              <div style={{ display:'flex', gap:3, alignItems:'flex-end', overflowX:'auto', paddingBottom:6, minHeight:80 }}>
                {summaryData.byDateArr.map((d,i)=>{
                  const max = Math.max(...summaryData.byDateArr.map(x=>x.total),1)
                  const pct = Math.round(d.total/max*100)
                  return (
                    <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flex:1, minWidth:28 }}>
                      <div style={{ fontSize:9.5, color:'#4338ca', fontWeight:700, whiteSpace:'nowrap' }}>
                        ฿{d.total>=1000?`${(d.total/1000).toFixed(1)}k`:Math.round(d.total)}
                      </div>
                      <div style={{ width:'100%', background:'linear-gradient(180deg,#6366f1,#7c3aed)', borderRadius:'3px 3px 0 0', height:Math.max(6,pct)+'px' }}/>
                      <div style={{ fontSize:9, color:'#9ca3af', textAlign:'center' }}>{d.date.slice(5)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Per-admin table */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', padding:'13px 18px', borderBottom:'1.5px solid #e0e7ff', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:14, fontWeight:900, color:'#1e1b4b' }}>👥 สรุปรายแอดมิน</div>
              <div style={{ fontSize:12.5, color:'#6b7280' }}>{summaryData.rows.length} คน</div>
            </div>
            {summaryData.rows.length===0 ? (
              <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
                <div style={{ fontWeight:700 }}>ไม่มีข้อมูลในช่วงนี้</div>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:720 }}>
                  <thead style={{ position:'sticky', top:0 }}>
                    <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom:'2px solid #e0e7ff' }}>
                      {['#','แอดมิน','วัน','เพจ','🖐 มือ','🤖 AI','📦 รวม','💰 ค่าคอม','เฉลี่ย/วัน'].map((h,hi)=>(
                        <th key={hi} style={{ padding:'10px 12px', textAlign:hi<=1?'left':'right', fontSize:11, fontWeight:800, color:'#6366f1', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.rows.map((r,i)=>(
                      <tr key={r.adminId} style={{ borderBottom:'1px solid #f0f4ff', background:i%2===0?'#fff':'#fafbff' }}>
                        <td style={{ padding:'10px 12px', fontSize:14 }}>{['🥇','🥈','🥉'][i]||i+1}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>
                              {getUserName(r.adminId).slice(0,2)}
                            </div>
                            <span style={{ fontSize:13.5, fontWeight:700 }}>{getUserName(r.adminId)}</span>
                          </div>
                        </td>
                        <td style={{ padding:'10px 12px', textAlign:'right', color:'#6b7280', fontSize:13 }}>{r.days}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', color:'#6b7280', fontSize:13 }}>{r.pages}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color:'#7c3aed' }}>{r.manual.toLocaleString()}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color:'#0f766e' }}>{r.ai.toLocaleString()}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, color:'#1e1b4b' }}>{r.orders.toLocaleString()}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', fontSize:15, fontWeight:900, color:'#4338ca' }}>฿{Math.round(r.total).toLocaleString()}</td>
                        <td style={{ padding:'10px 12px', textAlign:'right', fontSize:13, fontWeight:700, color:'#059669' }}>฿{r.days>0?Math.round(r.total/r.days).toLocaleString():'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderTop:'2px solid #c7d2fe' }}>
                      <td colSpan={4} style={{ padding:'10px 12px', fontSize:13, fontWeight:900, color:'#4338ca' }}>∑ รวม</td>
                      <td style={{ padding:'10px 12px', textAlign:'right', fontSize:14, fontWeight:900, color:'#7c3aed' }}>{summaryData.grand.manual.toLocaleString()}</td>
                      <td style={{ padding:'10px 12px', textAlign:'right', fontSize:14, fontWeight:900, color:'#0f766e' }}>{summaryData.grand.ai.toLocaleString()}</td>
                      <td style={{ padding:'10px 12px', textAlign:'right', fontSize:14, fontWeight:900, color:'#1e1b4b' }}>{summaryData.grand.orders.toLocaleString()}</td>
                      <td style={{ padding:'10px 12px', textAlign:'right', fontSize:16, fontWeight:900, color:'#4338ca' }}>฿{Math.round(summaryData.grand.total).toLocaleString()}</td>
                      <td/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}


      {tab==='backend' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* ── ส่วนบน: Import + เลือกวันที่ ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

            {/* Import Backend */}
            <div style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', border:'2px solid #fde68a', borderRadius:16, padding:18 }}>
              <div style={{ fontSize:14, fontWeight:900, color:'#b45309', marginBottom:10, display:'flex', alignItems:'center', gap:7 }}>
                <span>🖥️</span> Import ออเดอร์จริงจาก Backend
              </div>
              <input ref={backendFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&handleBackendFile(e.target.files[0])}/>
              {!backendPreview ? (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ fontSize:12.5, color:'#92400e' }}>
                    ไฟล์ต้องมี column: <strong>เพจ/pageId</strong>, <strong>วันที่</strong>, <strong>จำนวนออเดอร์จริง</strong>
                  </div>
                  <button onClick={()=>backendFileRef.current?.click()}
                    style={{ background:'linear-gradient(135deg,#d97706,#f59e0b)', border:'none', borderRadius:10, padding:'10px 0', cursor:'pointer', fontSize:13.5, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                    <Upload size={14}/> เลือกไฟล์ Excel
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ background:'#fff', border:'1.5px solid #fde68a', borderRadius:10, overflow:'hidden', marginBottom:12, maxHeight:160, overflowY:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead><tr style={{ background:'#fef3c7' }}>
                        {['เพจ','วันที่','ออเดอร์จริง'].map((h,i)=><th key={i} style={{ padding:'7px 12px', textAlign:'left', fontSize:11, fontWeight:800, color:'#b45309' }}>{h}</th>)}
                      </tr></thead>
                      <tbody>{backendPreview.map((r,i)=>(
                        <tr key={i} style={{ borderBottom:'1px solid #fef3c7' }}>
                          <td style={{ padding:'7px 12px', fontSize:12.5 }}>{getPageName(r.pageId)||r.pageId}</td>
                          <td style={{ padding:'7px 12px', fontSize:12.5, color:'#6b7280' }}>{r.date}</td>
                          <td style={{ padding:'7px 12px', fontSize:13, fontWeight:800, color:'#b45309' }}>{r.actualCount}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>setBackendPreview(null)} style={{ flex:1, background:'#f1f5f9', border:'1.5px solid #e0e7ff', borderRadius:9, padding:'8px 0', cursor:'pointer', fontSize:13, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>ยกเลิก</button>
                    <button onClick={handleImportBackend} disabled={saving}
                      style={{ flex:2, background:'linear-gradient(135deg,#d97706,#f59e0b)', border:'none', borderRadius:9, padding:'8px 0', cursor:'pointer', fontSize:13, fontWeight:800, color:'#fff', fontFamily:'inherit' }}>
                      ✅ Import {backendPreview.length} รายการ
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Compare Panel */}
            <div style={{ background:'linear-gradient(135deg,#eef2ff,#f5f3ff)', border:'2px solid #c7d2fe', borderRadius:16, padding:18 }}>
              <div style={{ fontSize:14, fontWeight:900, color:'#4338ca', marginBottom:10, display:'flex', alignItems:'center', gap:7 }}>
                🔍 เปรียบเทียบ: เพจของฉัน vs Backend
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:800, color:'#6366f1', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>เลือกวันที่</div>
                  <input type="date" value={compareDate} onChange={e=>setCompareDate(e.target.value)}
                    style={{ width:'100%', padding:'8px 12px', borderRadius:9, border:'1.5px solid #c7d2fe', background:'#fff', fontSize:13.5, color:'#1e1b4b', fontFamily:'inherit' }}/>
                </div>
                <div style={{ fontSize:12, color:'#6b7280', background:'#fff', borderRadius:9, padding:'8px 12px', border:'1px solid #e0e7ff' }}>
                  เพจที่รับผิดชอบ: <strong style={{ color:'#4338ca' }}>
                    {pages.filter(p=>p.assignedTo?.includes(myUid)).length > 0
                      ? pages.filter(p=>p.assignedTo?.includes(myUid)).map(p=>p.name).join(', ')
                      : 'ทุกเพจ (superadmin/head)'}
                  </strong>
                </div>
                <button onClick={()=>handleCompare(compareDate)}
                  style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:10, padding:'10px 0', cursor:'pointer', fontSize:13.5, fontWeight:800, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:7, boxShadow:'0 4px 12px rgba(99,102,241,.25)' }}>
                  🔍 เปรียบเทียบเลย
                </button>
                {compareResult && (
                  <button onClick={()=>setCompareResult(null)}
                    style={{ background:'#f1f5f9', border:'1.5px solid #e0e7ff', borderRadius:9, padding:'7px 0', cursor:'pointer', fontSize:12.5, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>
                    ✕ ล้างผล
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Compare Result ── */}
          {compareResult && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                <div style={{ fontSize:16, fontWeight:900, color:'#1e1b4b' }}>
                  📊 ผลเปรียบเทียบ — {compareDate}
                </div>
                {/* Summary badges */}
                {[
                  { v:compareResult.filter(r=>r.status==='match').length,      l:'✅ ตรงกัน',  c:'#059669', b:'#bbf7d0', bg:'#f0fdf4' },
                  { v:compareResult.filter(r=>r.status==='over').length,       l:'⚠️ ลงเกิน',   c:'#b45309', b:'#fde68a', bg:'#fffbeb' },
                  { v:compareResult.filter(r=>r.status==='under').length,      l:'📉 Backend มากกว่า', c:'#0284c7', b:'#bfdbfe', bg:'#eff6ff' },
                  { v:compareResult.filter(r=>r.status==='no_backend').length, l:'❓ ไม่มีหลังบ้าน', c:'#6b7280', b:'#e5e7eb', bg:'#f9fafb' },
                ].filter(k=>k.v>0).map((k,i)=>(
                  <span key={i} style={{ background:k.bg, color:k.c, border:`1.5px solid ${k.b}`, borderRadius:99, padding:'4px 12px', fontSize:12.5, fontWeight:800 }}>
                    {k.l}: {k.v}
                  </span>
                ))}
              </div>

              {/* Compare cards per page */}
              {compareResult.map((r,ri)=>{
                const bgMap = { match:'#f0fdf4', over:'#fffbeb', under:'#eff6ff', no_backend:'#f9fafb' }
                const bdMap = { match:'#86efac', over:'#fde68a', under:'#bfdbfe', no_backend:'#e5e7eb' }
                const clMap = { match:'#059669', over:'#b45309', under:'#0284c7', no_backend:'#6b7280' }
                const iconMap = { match:'✅', over:'⚠️', under:'📉', no_backend:'❓' }
                const labelMap = { match:'ตรงกัน', over:'แอดมินลงเกิน Backend', under:'Backend มากกว่าที่ลง', no_backend:'ไม่มีข้อมูลหลังบ้าน' }
                return (
                  <div key={ri} style={{ background:'#fff', border:`2px solid ${bdMap[r.status]}`, borderLeft:`5px solid ${clMap[r.status]}`, borderRadius:16, overflow:'hidden' }}>
                    {/* Page header */}
                    <div style={{ background:bgMap[r.status], padding:'12px 18px', borderBottom:`1px solid ${bdMap[r.status]}`, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:15, fontWeight:900, color:'#1e1b4b', display:'flex', alignItems:'center', gap:8 }}>
                          📄 {getPageName(r.pageId)}
                          <span style={{ background:bgMap[r.status], color:clMap[r.status], border:`1.5px solid ${bdMap[r.status]}`, borderRadius:99, padding:'2px 10px', fontSize:12, fontWeight:700 }}>
                            {iconMap[r.status]} {labelMap[r.status]}
                          </span>
                        </div>
                        {r.adminNames.length > 0 && (
                          <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>
                            แอดมิน: {r.adminNames.join(', ')}
                          </div>
                        )}
                      </div>
                      {/* KPI row */}
                      <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10.5, color:'#6b7280', fontWeight:700, marginBottom:2 }}>ลงไว้</div>
                          <div style={{ fontSize:20, fontWeight:900, color:'#1e1b4b' }}>{r.declared}</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10.5, color:'#6b7280', fontWeight:700, marginBottom:2 }}>Backend จริง</div>
                          <div style={{ fontSize:20, fontWeight:900, color:r.status==='match'?'#059669':clMap[r.status] }}>{r.actual||'—'}</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10.5, color:'#6b7280', fontWeight:700, marginBottom:2 }}>ผลต่าง</div>
                          <div style={{ fontSize:20, fontWeight:900, color:r.diff===0?'#059669':r.diff<0?'#be123c':'#0284c7' }}>
                            {r.diff===0?'±0':r.diff>0?`+${r.diff}`:r.diff}
                          </div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10.5, color:'#6b7280', fontWeight:700, marginBottom:2 }}>ค่าคอมที่ลง</div>
                          <div style={{ fontSize:18, fontWeight:900, color:'#7c3aed' }}>฿{Math.round(r.totalComm).toLocaleString()}</div>
                        </div>
                        {r.status !== 'match' && r.status !== 'no_backend' && (
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:10.5, color:'#6b7280', fontWeight:700, marginBottom:2 }}>ค่าคอมที่ควรได้</div>
                            <div style={{ fontSize:18, fontWeight:900, color:'#059669' }}>฿{r.adjComm.toLocaleString()}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Per-admin breakdown */}
                    {r.comms.length > 0 && (
                      <div style={{ overflowX:'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
                          <thead>
                            <tr style={{ background:'#f8faff', borderBottom:`1.5px solid ${bdMap[r.status]}` }}>
                              {['แอดมิน','กะ','🖐 มือ','🤖 AI','ออเดอร์รวม','ค่าคอม','ปรับหลังหัก'].map((h,i)=>(
                                <th key={i} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:800, color:clMap[r.status], whiteSpace:'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {r.comms.map((c,ci)=>{
                              const orders = (parseInt(c.manualOrders)||0)+(parseInt(c.aiOrders)||0)
                              const comm = c.total||(c.manualTotal||0)+(c.aiTotal||0)||((parseInt(c.manualOrders)||0)*(c.manualRate||commRates.manualRate||5)+(parseInt(c.aiOrders)||0)*(c.aiRate||commRates.aiRate||2))
                              const ratio = r.declared>0 ? orders/r.declared : 0
                              const adjOrders = r.actual>0 ? Math.round(Math.min(r.declared,r.actual)*ratio*10)/10 : orders
                              const adjComm2 = r.actual>0 ? Math.round(adjOrders*(r.declared>0?comm/orders:0)*10)/10 : comm
                              return (
                                <tr key={ci} style={{ borderBottom:`1px solid ${bgMap[r.status]}` }}>
                                  <td style={{ padding:'9px 12px' }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                                      <div style={{ width:26, height:26, borderRadius:'50%', background:`linear-gradient(135deg,${clMap[r.status]},#7c3aed)`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800 }}>
                                        {getUserName(c.adminId).slice(0,2)}
                                      </div>
                                      <span style={{ fontSize:13, fontWeight:700 }}>{getUserName(c.adminId)}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding:'9px 12px' }}>
                                    <span style={{ background:c.shift==='night'?'#eef2ff':'#fffbeb', color:c.shift==='night'?'#4338ca':'#b45309', border:`1px solid ${c.shift==='night'?'#c7d2fe':'#fde68a'}`, borderRadius:99, padding:'2px 7px', fontSize:11, fontWeight:700 }}>
                                      {c.shift==='night'?'🌙 กลางคืน':'☀️ กลางวัน'}
                                    </span>
                                  </td>
                                  <td style={{ padding:'9px 12px', fontWeight:700, color:'#7c3aed' }}>{c.manualOrders||0}</td>
                                  <td style={{ padding:'9px 12px', fontWeight:700, color:'#0f766e' }}>{c.aiOrders||0}</td>
                                  <td style={{ padding:'9px 12px', fontWeight:800 }}>{orders}</td>
                                  <td style={{ padding:'9px 12px', fontWeight:900, color:'#7c3aed' }}>฿{Math.round(comm).toLocaleString()}</td>
                                  <td style={{ padding:'9px 12px' }}>
                                    {r.status==='match' ? (
                                      <span style={{ color:'#059669', fontWeight:700 }}>✅ ฿{Math.round(comm).toLocaleString()}</span>
                                    ) : r.status==='no_backend' ? (
                                      <span style={{ color:'#9ca3af' }}>—</span>
                                    ) : (
                                      <span style={{ color:'#059669', fontWeight:800 }}>฿{adjComm2.toLocaleString()}</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          {r.comms.length > 1 && (
                            <tfoot>
                              <tr style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', borderTop:'2px solid #ddd6fe' }}>
                                <td colSpan={4} style={{ padding:'9px 12px', fontSize:13, fontWeight:900, color:'#6d28d9' }}>รวม</td>
                                <td style={{ padding:'9px 12px', fontSize:14, fontWeight:900, color:'#1e1b4b' }}>{r.declared}</td>
                                <td style={{ padding:'9px 12px', fontSize:15, fontWeight:900, color:'#7c3aed' }}>฿{Math.round(r.totalComm).toLocaleString()}</td>
                                <td style={{ padding:'9px 12px', fontSize:15, fontWeight:900, color:'#059669' }}>฿{r.adjComm.toLocaleString()}</td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Backend list + grouped summary ── */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(135deg,#fffbeb,#fef3c7)', padding:'12px 18px', borderBottom:'1.5px solid #fde68a', fontSize:14, fontWeight:800, color:'#b45309' }}>
              🖥️ ออเดอร์จริงจากหลังบ้าน ({backendOrders.length} รายการ)
            </div>
            {/* ── สรุปรวมตามเพจ+วันที่ (หลายคนต่อเพจ) ── */}
            {(() => {
              // ── Primary source: commissions (ไม่ต้องมีไฟล์ backend) ──
              const commGrouped = {}
              commissions.forEach(c => {
                if (!c.date || !c.pageId) return
                const key = `${c.date}__${c.pageId}`
                if (!commGrouped[key]) commGrouped[key] = { date:c.date, pageId:c.pageId, actualTotal:0, count:0 }
                commGrouped[key].count += 1
              })
              // รวม backend ถ้ามี
              const grouped = { ...commGrouped }
              backendOrders.forEach(b => {
                const key = `${b.date}__${b.pageId}`
                if (!grouped[key]) grouped[key] = { date:b.date, pageId:b.pageId, actualTotal:0, count:0 }
                grouped[key].actualTotal += (b.actualCount||0)
              })

              const enriched = Object.values(grouped).map(g => {
                const dayComms = commissions.filter(c => c.date===g.date && c.pageId===g.pageId)
                const adminTotalOrders = dayComms.reduce((a,c)=>a+(parseInt(c.manualOrders)||0)+(parseInt(c.aiOrders)||0),0)
                const adminsDetail = dayComms.map(c => {
                  const manual  = parseInt(c.manualOrders)||0
                  const ai      = parseInt(c.aiOrders)||0
                  const orders  = manual + ai
                  const ratio   = adminTotalOrders>0 ? orders/adminTotalOrders : 0
                  const missing = Math.max(0, adminTotalOrders - g.actualTotal)
                  const deduct  = Math.round(missing * ratio * 10)/10
                  const adjOrders = Math.max(0, Math.round((orders - deduct)*10)/10)
                  const mRate   = c.manualRate||commRates.manualRate||5
                  const aRate   = c.aiRate||commRates.aiRate||2
                  const comm    = Math.round((manual*mRate + ai*aRate)*10)/10
                  const adjComm = orders>0 ? Math.round(adjOrders*(comm/orders)*10)/10 : 0
                  return { ...c, orders, ratio, adjOrders, comm, adjComm, deduct }
                })
                const totalComm = adminsDetail.reduce((a,d)=>a+d.comm,0)
                const avgComm   = adminsDetail.length>0 ? Math.round(totalComm/adminsDetail.length) : 0
                return { ...g, adminsDetail, adminTotalOrders, totalComm, avgComm }
              })

              // กรองตามวันที่ถ้าระบุ
              const filteredEnriched = analysisDate
                ? enriched.filter(g => g.date === analysisDate)
                : enriched.sort((a,b) => b.date?.localeCompare(a.date||''))

              if (!filteredEnriched.length) return (
                <div style={{ padding:'24px', textAlign:'center', color:'#9ca3af' }}>
                  <div style={{ fontSize:20, marginBottom:8 }}>📭</div>
                  <div style={{ fontWeight:700 }}>ยังไม่มีข้อมูล</div>
                  <div style={{ fontSize:12.5, marginTop:4 }}>ลงข้อมูลค่าคอมก่อน หรือเลือกวันที่อื่น</div>
                </div>
              )
              // use filteredEnriched instead of enriched below
              return (
                <div style={{ padding:'16px', borderBottom:'1.5px solid #fde68a', background:'linear-gradient(135deg,#fffbeb55,#fff)', display:'flex', flexDirection:'column', gap:14 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                    <div style={{ fontSize:14, fontWeight:900, color:'#b45309', display:'flex', alignItems:'center', gap:8 }}>
                      📊 สรุปค่าคอมตามเพจ
                      <span style={{ background:'#fde68a', color:'#92400e', borderRadius:99, padding:'2px 9px', fontSize:12, fontWeight:800 }}>
                        {(filteredEnriched||enriched).length} เพจ
                      </span>
                      {backendOrders.length===0 && (
                        <span style={{ background:'#eef2ff', color:'#4338ca', border:'1px solid #c7d2fe', borderRadius:99, padding:'2px 9px', fontSize:11, fontWeight:700 }}>
                          📊 จากระบบ (ยังไม่มี Backend)
                        </span>
                      )}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:12, color:'#6b7280' }}>กรองวันที่:</span>
                      <select value={analysisDate} onChange={e=>setFilters(p=>({...p,date:e.target.value}))}
                        style={{ padding:'5px 10px', borderRadius:8, border:'1.5px solid #fde68a', background:'#fff', fontSize:12.5, color:'#92400e', fontFamily:'inherit' }}>
                        {[...new Set(commissions.map(c=>c.date))].sort().reverse().slice(0,30).map(d=>(
                          <option key={d} value={d}>{d}</option>
                        ))}
                        <option value="">ทุกวัน</option>
                      </select>
                    </div>
                  </div>
                  {(filteredEnriched||enriched).map((g,gi)=>(
                    <div key={gi} style={{ background:'#fff', border:'2px solid #fde68a', borderRadius:14, overflow:'hidden' }}>
                      {/* Page header */}
                      <div style={{ background:'linear-gradient(135deg,#fef3c7,#fffbeb)', padding:'12px 18px', borderBottom:'1.5px solid #fde68a', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:15, fontWeight:900, color:'#92400e' }}>📄 {getPageName(g.pageId)}</div>
                          <div style={{ fontSize:12, color:'#b45309', marginTop:2 }}>{g.date} · {g.count} คนร่วม</div>
                        </div>
                        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                          {[
                            { l:'ออเดอร์ที่ลง',   v:g.adminTotalOrders, c:'#1e1b4b' },
                            { l:'ออเดอร์จริง',    v:g.actualTotal,      c:g.actualTotal<g.adminTotalOrders?'#be123c':g.actualTotal>g.adminTotalOrders?'#0284c7':'#059669' },
                            { l:'ออเดอร์หาย',     v:Math.max(0,g.adminTotalOrders-g.actualTotal)||'—', c:'#be123c', hide:g.actualTotal>=g.adminTotalOrders },
                            { l:'ค่าคอมรวม',      v:`฿${Math.round(g.totalComm).toLocaleString()}`, c:'#7c3aed' },
                            { l:'ค่าคอมเฉลี่ย',   v:`฿${g.avgComm.toLocaleString()}/คน`,            c:'#0f766e' },
                          ].filter(k=>!k.hide).map((k,ki)=>(
                            <div key={ki} style={{ textAlign:'center', minWidth:60 }}>
                              <div style={{ fontSize:10.5, color:'#6b7280', fontWeight:700, marginBottom:2 }}>{k.l}</div>
                              <div style={{ fontSize:17, fontWeight:900, color:k.c }}>{k.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Per-admin table */}
                      {g.adminsDetail.length>0 && (
                        <div style={{ overflowX:'auto' }}>
                          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
                            <thead>
                              <tr style={{ background:'#fef9ec', borderBottom:'1.5px solid #fde68a' }}>
                                {['แอดมิน','กะ','🖐 มือ','🤖 AI','ออเดอร์รวม','สัดส่วน','ออเดอร์หัก','ออเดอร์สุทธิ','ค่าคอม'].map((h,i)=>(
                                  <th key={i} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:800, color:'#b45309', whiteSpace:'nowrap' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {g.adminsDetail.map((d,di)=>(
                                <tr key={di} style={{ borderBottom:'1px solid #fef3c7', background:di%2===0?'#fffdf5':'#fff' }}>
                                  <td style={{ padding:'9px 12px' }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                                      <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#d97706,#f59e0b)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800 }}>
                                        {getUserName(d.adminId).slice(0,2)}
                                      </div>
                                      <span style={{ fontSize:13, fontWeight:700 }}>{getUserName(d.adminId)}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding:'9px 12px' }}>
                                    <span style={{ background:d.shift==='night'?'#eef2ff':'#fffbeb', color:d.shift==='night'?'#4338ca':'#b45309', border:`1px solid ${d.shift==='night'?'#c7d2fe':'#fde68a'}`, borderRadius:99, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
                                      {d.shift==='night'?'🌙 กลางคืน':'☀️ กลางวัน'}
                                    </span>
                                  </td>
                                  <td style={{ padding:'9px 12px', fontWeight:700, color:'#7c3aed' }}>{d.manualOrders||0}</td>
                                  <td style={{ padding:'9px 12px', fontWeight:700, color:'#0f766e' }}>{d.aiOrders||0}</td>
                                  <td style={{ padding:'9px 12px', fontWeight:800, color:'#1e1b4b' }}>{d.orders}</td>
                                  <td style={{ padding:'9px 12px' }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                      <div style={{ width:50, height:7, borderRadius:99, background:'#fde68a', overflow:'hidden' }}>
                                        <div style={{ height:'100%', width:`${Math.round(d.ratio*100)}%`, background:'#d97706', borderRadius:99 }}/>
                                      </div>
                                      <span style={{ fontSize:12, fontWeight:700, color:'#92400e' }}>{Math.round(d.ratio*100)}%</span>
                                    </div>
                                  </td>
                                  <td style={{ padding:'9px 12px', color:d.deduct>0?'#be123c':'#9ca3af', fontWeight:d.deduct>0?800:400 }}>
                                    {d.deduct>0?`-${d.deduct}`:'—'}
                                  </td>
                                  <td style={{ padding:'9px 12px', fontWeight:800, color:'#1e1b4b' }}>{d.adjOrders}</td>
                                  <td style={{ padding:'9px 12px', fontSize:14, fontWeight:900, color:'#7c3aed' }}>฿{d.adjComm.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', borderTop:'2px solid #ddd6fe' }}>
                                <td colSpan={4} style={{ padding:'9px 12px', fontSize:13, fontWeight:900, color:'#6d28d9' }}>∑ รวมทั้งเพจ</td>
                                <td style={{ padding:'9px 12px', fontSize:14, fontWeight:900, color:'#1e1b4b' }}>
                                  {g.adminsDetail.reduce((a,d)=>a+d.orders,0)}
                                </td>
                                <td style={{ padding:'9px 12px' }}/>
                                <td style={{ padding:'9px 12px', fontSize:13, fontWeight:700, color:'#be123c' }}>
                                  {g.adminsDetail.reduce((a,d)=>a+d.deduct,0)>0
                                    ? `-${Math.round(g.adminsDetail.reduce((a,d)=>a+d.deduct,0)*10)/10}` : '—'}
                                </td>
                                <td style={{ padding:'9px 12px', fontSize:14, fontWeight:900, color:'#1e1b4b' }}>
                                  {Math.round(g.adminsDetail.reduce((a,d)=>a+d.adjOrders,0)*10)/10}
                                </td>
                                <td style={{ padding:'9px 12px' }}>
                                  <div style={{ fontSize:16, fontWeight:900, color:'#7c3aed' }}>
                                    ฿{Math.round(g.totalComm).toLocaleString()}
                                  </div>
                                  <div style={{ fontSize:11, color:'#9ca3af', fontWeight:600 }}>
                                    เฉลี่ย ฿{g.avgComm.toLocaleString()}/คน
                                  </div>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}
            <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:500 }}>
                <thead><tr style={{ borderBottom:'1.5px solid #fde68a' }}>
                  {['วันที่','เพจ','ออเดอร์จริง','นำเข้าเมื่อ'].map((h,i)=>(
                    <th key={i} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {backendOrders.length===0
                    ?<tr><td colSpan={4} style={{ textAlign:'center', padding:28, color:'#9ca3af' }}>ยังไม่มีข้อมูลหลังบ้าน — Import ไฟล์ก่อน</td></tr>
                    :backendOrders.slice(0,50).map((b,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid #fef3c7' }}>
                        <td style={{ padding:'10px 14px', fontSize:13, color:'#6b7280' }}>{b.date}</td>
                        <td style={{ padding:'10px 14px', fontSize:13.5, fontWeight:600 }}>{getPageName(b.pageId)||b.pageId}</td>
                        <td style={{ padding:'10px 14px', fontSize:16, fontWeight:900, color:'#b45309' }}>{b.actualCount}</td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:'#9ca3af' }}>
                          {b.importedAt?.toDate ? format(b.importedAt.toDate(),'d/M/yy HH:mm') : '—'}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab==='cancelled' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Add cancel form */}
          {showCancel && (
            <div style={{ background:'#fff1f2', border:'2px solid #fca5a5', borderRadius:16, padding:20 }}>
              <div style={{ fontSize:15, fontWeight:900, color:'#be123c', marginBottom:14 }}>❌ บันทึกออเดอร์ยกเลิก</div>
              <div style={{ fontSize:12.5, color:'#9f1239', marginBottom:14 }}>
                <strong>Rule 7:</strong> ระบุวันที่ของออเดอร์นั้น → หักจากแอดมินที่อยู่เพจนั้นวันนั้น ตามสัดส่วน
              </div>
              {err && <div style={{ background:'#fff', border:'1.5px solid #fca5a5', borderRadius:9, padding:'8px 12px', color:'#be123c', marginBottom:12, fontSize:13 }}>❌ {err}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:14 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>📄 เพจ *</label>
                  <select style={S} value={cancelForm.pageId} onChange={setCF('pageId')}>
                    <option value="">-- เลือกเพจ --</option>
                    {pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>📅 วันที่ของออเดอร์ *</label>
                  <input type="date" style={S} value={cancelForm.date} onChange={setCF('date')}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>จำนวน (บ้าน)</label>
                  <input type="number" min="1" style={{...S,textAlign:'center',fontWeight:800,color:'#be123c'}} value={cancelForm.qty} onChange={setCF('qty')}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>ยอดหัก (฿)</label>
                  <input type="number" min="0" step="0.01" style={{...S,textAlign:'center',fontWeight:800,color:'#be123c'}} value={cancelForm.amount} onChange={setCF('amount')}/>
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>เหตุผล</label>
                <input style={S} placeholder="เหตุผลการยกเลิก..." value={cancelForm.reason} onChange={setCF('reason')}/>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={()=>setShowCancel(false)} style={{ background:'#f1f5f9', border:'1.5px solid #dde3f5', borderRadius:9, padding:'8px 16px', cursor:'pointer', fontSize:13, fontWeight:700, color:'#6b7280', fontFamily:'inherit' }}>ยกเลิก</button>
                <button onClick={handleSaveCancel} disabled={saving} style={{ background:'linear-gradient(135deg,#e11d48,#f43f5e)', border:'none', borderRadius:9, padding:'8px 20px', cursor:'pointer', fontSize:13, fontWeight:800, color:'#fff', fontFamily:'inherit' }}>
                  {saving?'กำลังบันทึก...':'❌ บันทึกการยกเลิก'}
                </button>
              </div>
            </div>
          )}

          {/* Cancelled list */}
          <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(135deg,#fff1f2,#ffe4e6)', padding:'12px 18px', borderBottom:'1.5px solid #fecdd3', fontSize:14, fontWeight:800, color:'#be123c' }}>
              ❌ ออเดอร์ยกเลิกทั้งหมด ({cancelledOrders.length} รายการ)
            </div>
            <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ borderBottom:'1.5px solid #fecdd3' }}>
                  {['วันที่ของออเดอร์','เพจ','จำนวน','ยอดหัก (฿)','เหตุผล',''].map((h,i)=>(
                    <th key={i} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:800, color:'#be123c', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {cancelledOrders.length===0
                    ?<tr><td colSpan={6} style={{ textAlign:'center', padding:28, color:'#9ca3af' }}>ยังไม่มีรายการยกเลิก</td></tr>
                    :cancelledOrders.map(c=>(
                      <tr key={c.id} style={{ borderBottom:'1px solid #fff1f2' }}>
                        <td style={{ padding:'10px 14px', fontSize:13, color:'#6b7280' }}>{c.originalDate}</td>
                        <td style={{ padding:'10px 14px', fontSize:13.5, fontWeight:600 }}>{getPageName(c.pageId)||c.pageId}</td>
                        <td style={{ padding:'10px 14px', fontSize:14, fontWeight:800, color:'#be123c' }}>{c.qty}</td>
                        <td style={{ padding:'10px 14px', fontSize:14, fontWeight:900, color:'#be123c' }}>฿{(c.amount||0).toLocaleString()}</td>
                        <td style={{ padding:'10px 14px', fontSize:13, color:'#6b7280' }}>{c.reason||'—'}</td>
                        <td style={{ padding:'8px 10px' }}>
                          {isSuperAdmin&&(
                            <button onClick={()=>removeCancel(c.id)} style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:7, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#be123c' }}>
                              <Trash2 size={12}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
