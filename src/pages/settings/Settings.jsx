import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { Alert } from '../../components/ui'
import { useNotify } from '../../hooks/useNotify'
import { AlertTriangle, Save, CheckCircle, HandMetal, Bot, Moon, Target, Zap } from 'lucide-react'

const S = { width:'100%', background:'#fff', border:'1.5px solid #dde3f5', borderRadius:10, color:'#1e1b4b', fontFamily:'inherit', fontSize:14, padding:'9px 12px', outline:'none' }

export default function Settings() {
  const { isSuperAdmin } = useAuth()
  const { commRates, saveCommissionRates } = useData()
  const { notifyRateChange } = useNotify()

  // Basic rates
  const [manual,  setManual]  = useState('')
  const [ai,      setAi]      = useState('')
  // Daily quota
  const [useQuota,    setUseQuota]    = useState(false)
  const [dailyQuota,  setDailyQuota]  = useState('')     // โควต้าต่อวัน (บ้าน)
  const [dailySalary, setDailySalary] = useState('')     // เงินรายวัน (฿)
  const [overRate,    setOverRate]    = useState('')     // ค่าคอม/บ้านที่เกิน
  // Night shift
  const [nightStart,  setNightStart]  = useState('22:30')
  const [nightEnd,    setNightEnd]    = useState('05:00')
  const [midnightCut, setMidnightCut] = useState(true)   // ตัดยอดเที่ยงคืน

  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [err,    setErr]    = useState('')

  useEffect(() => {
    setManual(commRates.manualRate ?? 5)
    setAi(commRates.aiRate ?? 2)
    if (commRates.dailyQuota)   setDailyQuota(commRates.dailyQuota)
    if (commRates.dailySalary)  setDailySalary(commRates.dailySalary)
    if (commRates.overRate)     setOverRate(commRates.overRate)
    if (commRates.useQuota !== undefined) setUseQuota(commRates.useQuota)
    if (commRates.nightStart)   setNightStart(commRates.nightStart)
    if (commRates.nightEnd)     setNightEnd(commRates.nightEnd)
    if (commRates.midnightCut !== undefined) setMidnightCut(commRates.midnightCut)
  }, [commRates])

  if (!isSuperAdmin) {
    return (
      <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:16, padding:24, display:'flex', gap:12 }}>
        <AlertTriangle size={20} style={{ color:'#d97706', flexShrink:0 }}/>
        <span style={{ color:'#92400e', fontWeight:600 }}>เฉพาะผู้ดูแลสูงสุดเท่านั้นที่สามารถตั้งค่าได้</span>
      </div>
    )
  }

  const handleSave = async () => {
    if (parseFloat(manual) < 0 || parseFloat(ai) < 0) { setErr('ค่าคอมต้องไม่ติดลบ'); return }
    if (useQuota && (!dailyQuota || !dailySalary || !overRate)) { setErr('กรุณากรอกโควต้า, เงินรายวัน, และค่าคอมที่เกินให้ครบ'); return }
    setSaving(true); setErr('')
    try {
      await saveCommissionRates(parseFloat(manual), parseFloat(ai), {
        useQuota,
        dailyQuota:   parseFloat(dailyQuota) || 0,
        dailySalary:  parseFloat(dailySalary) || 0,
        overRate:     parseFloat(overRate) || parseFloat(manual),
        nightStart, nightEnd, midnightCut,
      })
      notifyRateChange(manual, ai)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  // Preview calculation
  const exampleOrders = useQuota ? parseFloat(dailyQuota)||300 : 300
  const exampleOver   = 100
  const exampleManual = exampleOrders + exampleOver
  const previewBase   = exampleManual * parseFloat(manual||0)
  const previewQuota  = useQuota
    ? (parseFloat(dailySalary)||0) + (exampleOver * parseFloat(overRate||0))
    : previewBase

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <h2 style={{ fontSize:20, fontWeight:900, color:'#1e1b4b', marginBottom:3 }}>⚙️ ตั้งค่าค่าคอม</h2>
        <p style={{ fontSize:12.5, color:'#6b7280' }}>กำหนดอัตราค่าคอม · โควต้ารายวัน · กะกลางคืน</p>
      </div>

      {err  && <Alert type="error">{err}</Alert>}
      {saved && <Alert type="success">✅ บันทึกแล้ว — มีผลทันที</Alert>}

      {/* ── 1. อัตราค่าคอมพื้นฐาน ── */}
      <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
        <div style={{ background:'linear-gradient(135deg,#eef2ff,#e0e7ff)', padding:'14px 20px', borderBottom:'1.5px solid #e0e7ff', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>💰</span>
          <span style={{ fontSize:15, fontWeight:900, color:'#4338ca' }}>อัตราค่าคอมพื้นฐาน</span>
        </div>
        <div style={{ padding:22 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
            <div style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', border:'2px solid #ddd6fe', borderRadius:14, padding:18 }}>
              <div style={{ fontSize:24, marginBottom:10 }}>🖐</div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#6d28d9', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                ค่าคอมตอบมือ (฿ / บ้าน)
              </label>
              <input type="number" min="0" step="0.5" style={{ ...S, fontSize:22, fontWeight:900, textAlign:'center', color:'#6d28d9', border:'2px solid #c4b5fd', borderRadius:10 }}
                value={manual} onChange={e=>setManual(e.target.value)}/>
              <div style={{ fontSize:12, color:'#9ca3af', marginTop:8, textAlign:'center' }}>
                100 บ้าน = ฿{((parseFloat(manual)||0)*100).toLocaleString()}
              </div>
            </div>
            <div style={{ background:'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border:'2px solid #99f6e4', borderRadius:14, padding:18 }}>
              <div style={{ fontSize:24, marginBottom:10 }}>🤖</div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#0f766e', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                ค่าคอม AI (฿ / บ้าน)
              </label>
              <input type="number" min="0" step="0.5" style={{ ...S, fontSize:22, fontWeight:900, textAlign:'center', color:'#0f766e', border:'2px solid #5eead4', borderRadius:10 }}
                value={ai} onChange={e=>setAi(e.target.value)}/>
              <div style={{ fontSize:12, color:'#9ca3af', marginTop:8, textAlign:'center' }}>
                100 บ้าน = ฿{((parseFloat(ai)||0)*100).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. โควต้ารายวัน + ออเดอร์เกิน ── */}
      <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
        <div style={{ background:'linear-gradient(135deg,#fefce8,#fef9c3)', padding:'14px 20px', borderBottom:'1.5px solid #fde68a', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>🎯</span>
            <span style={{ fontSize:15, fontWeight:900, color:'#854d0e' }}>โควต้ารายวัน + ออเดอร์เกิน</span>
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13.5, fontWeight:700, color:'#854d0e' }}>
            <div onClick={()=>setUseQuota(v=>!v)} style={{
              width:44, height:24, borderRadius:99, cursor:'pointer',
              background: useQuota ? '#d97706' : '#d1d5db',
              position:'relative', transition:'background .2s',
            }}>
              <div style={{
                position:'absolute', top:2, left: useQuota?20:2,
                width:20, height:20, borderRadius:'50%', background:'#fff',
                transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,.2)',
              }}/>
            </div>
            {useQuota ? '✅ เปิดใช้งาน' : '⏸ ปิดอยู่'}
          </label>
        </div>

        <div style={{ padding:22 }}>
          {/* Explanation */}
          <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:12, padding:'12px 16px', marginBottom:20, fontSize:13.5, color:'#92400e', lineHeight:1.7 }}>
            <strong>ตัวอย่าง:</strong> โควต้า <strong>300 บ้าน/วัน</strong> เงินรายวัน <strong>฿{(parseFloat(dailySalary)||300).toLocaleString()}</strong><br/>
            → ตอบได้ 300 บ้าน = ได้เงินรายวัน ฿{(parseFloat(dailySalary)||300).toLocaleString()} (ไม่มีค่าคอมพิเศษ)<br/>
            → ตอบได้ 400 บ้าน = เงินรายวัน ฿{(parseFloat(dailySalary)||300).toLocaleString()} + ค่าคอม 100 บ้าน ×  ฿{parseFloat(overRate)||parseFloat(manual)||5} = <strong>฿{((parseFloat(dailySalary)||300)+100*(parseFloat(overRate)||parseFloat(manual)||5)).toLocaleString()}</strong>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, opacity: useQuota ? 1 : 0.4, pointerEvents: useQuota ? 'auto' : 'none' }}>
            <div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                🎯 โควต้าต่อวัน (บ้าน)
              </label>
              <input type="number" min="1" style={{ ...S, fontSize:20, fontWeight:900, textAlign:'center', color:'#b45309' }}
                placeholder="300" value={dailyQuota} onChange={e=>setDailyQuota(e.target.value)}/>
              <div style={{ fontSize:12, color:'#9ca3af', marginTop:6, textAlign:'center' }}>บ้านที่ต้องทำ/วัน</div>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                💵 เงินรายวัน (฿)
              </label>
              <input type="number" min="0" style={{ ...S, fontSize:20, fontWeight:900, textAlign:'center', color:'#059669' }}
                placeholder="300" value={dailySalary} onChange={e=>setDailySalary(e.target.value)}/>
              <div style={{ fontSize:12, color:'#9ca3af', marginTop:6, textAlign:'center' }}>ได้เมื่อครบโควต้า</div>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#b45309', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                ⚡ ค่าคอมออเดอร์เกิน (฿/บ้าน)
              </label>
              <input type="number" min="0" step="0.5" style={{ ...S, fontSize:20, fontWeight:900, textAlign:'center', color:'#7c3aed' }}
                placeholder={manual||5} value={overRate} onChange={e=>setOverRate(e.target.value)}/>
              <div style={{ fontSize:12, color:'#9ca3af', marginTop:6, textAlign:'center' }}>บ้านที่เกินโควต้า</div>
            </div>
          </div>

          {/* Preview */}
          {useQuota && dailyQuota && dailySalary && overRate && (
            <div style={{ marginTop:20, background:'linear-gradient(135deg,#6366f1,#7c3aed)', borderRadius:14, padding:'16px 22px' }}>
              <div style={{ fontSize:13, color:'rgba(255,255,255,.8)', marginBottom:8 }}>📊 Preview: ตอบได้ {parseFloat(dailyQuota)+100} บ้าน (เกิน {100} บ้าน)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
                {[
                  { label:'เงินรายวัน', val:`฿${parseFloat(dailySalary).toLocaleString()}`, sub:'ครบโควต้า' },
                  { label:'ค่าคอม 100 บ้านที่เกิน', val:`฿${(100*(parseFloat(overRate)||0)).toLocaleString()}`, sub:`${100} × ฿${overRate}` },
                  { label:'รวมทั้งหมด', val:`฿${(parseFloat(dailySalary)+100*(parseFloat(overRate)||0)).toLocaleString()}`, sub:'จ่ายจริง', big:true },
                ].map((p,i)=>(
                  <div key={i} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginBottom:4 }}>{p.label}</div>
                    <div style={{ fontSize:p.big?22:17, fontWeight:900, color:'#fff' }}>{p.val}</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginTop:2 }}>{p.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. กะกลางคืน ── */}
      <div style={{ background:'#fff', border:'1.5px solid #e0e7ff', borderRadius:16, overflow:'hidden' }}>
        <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', padding:'14px 20px', borderBottom:'1.5px solid #3730a3', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>🌙</span>
          <span style={{ fontSize:15, fontWeight:900, color:'#fff' }}>กะกลางคืน</span>
          <span style={{ fontSize:12, color:'rgba(255,255,255,.5)', marginLeft:4 }}>ตั้งค่าเวลาและการตัดยอด</span>
        </div>
        <div style={{ padding:22 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
            <div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#4338ca', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                🕙 เวลาเริ่มกะ
              </label>
              <input type="time" style={{ ...S, fontSize:18, fontWeight:800, textAlign:'center', color:'#4338ca' }}
                value={nightStart} onChange={e=>setNightStart(e.target.value)}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11.5, fontWeight:800, color:'#4338ca', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                🌅 เวลาออกงาน
              </label>
              <input type="time" style={{ ...S, fontSize:18, fontWeight:800, textAlign:'center', color:'#7c3aed' }}
                value={nightEnd} onChange={e=>setNightEnd(e.target.value)}/>
            </div>
          </div>

          {/* Midnight cut toggle */}
          <div style={{ background:'linear-gradient(135deg,#eef2ff,#e0e7ff)', border:'1.5px solid #c7d2fe', borderRadius:14, padding:'16px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:'#4338ca', marginBottom:4 }}>
                  ⏰ ตัดยอดเที่ยงคืน (00:00)
                </div>
                <div style={{ fontSize:12.5, color:'#6b7280', lineHeight:1.6 }}>
                  ออเดอร์ก่อน 00:00 = <strong>นับวันที่เริ่มกะ ({nightStart})</strong><br/>
                  ออเดอร์หลัง 00:00 = <strong>นับวันพรุ่งนี้ (หลังเที่ยงคืน)</strong>
                </div>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, fontWeight:700, color:'#4338ca' }}>
                <div onClick={()=>setMidnightCut(v=>!v)} style={{
                  width:44, height:24, borderRadius:99, cursor:'pointer',
                  background: midnightCut ? '#6366f1' : '#d1d5db',
                  position:'relative', transition:'background .2s',
                }}>
                  <div style={{
                    position:'absolute', top:2, left: midnightCut?20:2,
                    width:20, height:20, borderRadius:'50%', background:'#fff',
                    transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,.2)',
                  }}/>
                </div>
                {midnightCut ? '✅ เปิดอยู่' : '⏸ ปิดอยู่'}
              </label>
            </div>

            {midnightCut && (
              <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  { emoji:'🌙', label:'ช่วงก่อน 00:00', from:nightStart, to:'00:00', color:'#4338ca', bg:'#eef2ff', border:'#c7d2fe', desc:'นับใน"วันนี้"' },
                  { emoji:'🌅', label:'ช่วงหลัง 00:00',  from:'00:00',   to:nightEnd, color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe', desc:'นับใน"วันพรุ่งนี้"' },
                ].map((s,i) => (
                  <div key={i} style={{ background:s.bg, border:`1.5px solid ${s.border}`, borderRadius:11, padding:14, textAlign:'center' }}>
                    <div style={{ fontSize:24, marginBottom:6 }}>{s.emoji}</div>
                    <div style={{ fontSize:13, fontWeight:800, color:s.color }}>{s.label}</div>
                    <div style={{ fontSize:12.5, color:'#6b7280', margin:'4px 0' }}>{s.from} – {s.to}</div>
                    <div style={{ fontSize:11, color:s.color, fontWeight:700, background:s.bg, border:`1px solid ${s.border}`, borderRadius:99, padding:'2px 10px', display:'inline-block' }}>
                      {s.desc}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Night shift example */}
          <div style={{ marginTop:16, background:'#f8faff', border:'1.5px solid #e0e7ff', borderRadius:12, padding:'14px 18px', fontSize:13.5, color:'#4b5563', lineHeight:2 }}>
            <strong style={{ color:'#4338ca' }}>📌 ตัวอย่างกะนี้ ({nightStart}–{nightEnd}):</strong><br/>
            แอดมินเข้า {nightStart} → ออก {nightEnd}<br/>
            {midnightCut ? (
              <>
                ออเดอร์ {nightStart}–00:00 → บันทึกใต้วันที่ <strong>เริ่มกะ</strong><br/>
                ออเดอร์ 00:00–{nightEnd} → บันทึกใต้วันที่ <strong>ถัดไป</strong>
              </>
            ) : (
              <>ออเดอร์ทั้งหมด → บันทึกใต้วันที่ <strong>เริ่มกะ</strong> (ไม่ตัดยอด)</>
            )}
            {useQuota && (
              <><br/>โควต้า {dailyQuota||300} บ้าน → ถ้าตอบได้มากกว่านี้ <strong>บ้านที่เกิน = ค่าคอม ฿{overRate||manual||5}/บ้าน</strong></>
            )}
          </div>
        </div>
      </div>

      {/* ── Save button ── */}
      <button onClick={handleSave} disabled={saving}
        style={{ background:'linear-gradient(135deg,#6366f1,#7c3aed)', border:'none', borderRadius:14, padding:'14px 32px', cursor:'pointer', fontSize:16, fontWeight:900, color:'#fff', fontFamily:'inherit', display:'flex', alignItems:'center', gap:10, width:'fit-content', boxShadow:'0 6px 20px rgba(99,102,241,.35)', opacity:saving?0.6:1 }}>
        {saved ? <><CheckCircle size={18}/> บันทึกแล้ว!</> : saving ? '⏳ กำลังบันทึก...' : <><Save size={18}/> บันทึกการตั้งค่า</>}
      </button>
    </div>
  )
}
