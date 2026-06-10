import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications, NOTI_CONFIG } from '../../contexts/NotificationContext'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'
import { Bell, Check, Trash2, X, BellOff } from 'lucide-react'

// ── เสียงแจ้งเตือน (Web Audio API — ไม่ต้องใช้ไฟล์ mp3) ──
function playNotifySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    // เสียง 2 โน้ต สั้นๆ นุ่ม
    const notes = [880, 1100]
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15)
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.15 + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.25)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.3)
    })
  } catch(e) { /* ไม่รองรับ browser เก่า */ }
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllAsRead, deleteNoti, uid } = useNotifications()
  const [open, setOpen] = useState(false)
  const [tab,  setTab]  = useState('unread') // 'unread' | 'all'
  const ref   = useRef(null)
  const nav   = useNavigate()
  const prevCount = useRef(unreadCount)

  // ── เสียงเมื่อ unreadCount เพิ่มขึ้น ──────────────
  useEffect(() => {
    if (unreadCount > prevCount.current) {
      playNotifySound()
    }
    prevCount.current = unreadCount
  }, [unreadCount])

  // close on outside click
  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const displayed = tab === 'unread'
    ? notifications.filter(n => !n.readBy?.includes(uid))
    : notifications.slice(0, 50)

  const handleClick = (n) => {
    markRead(n.id)
    if (n.link) nav(n.link)
    setOpen(false)
  }

  const timeAgo = (ts) => {
    if (!ts) return ''
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts)
      return formatDistanceToNow(date, { locale: th, addSuffix: true })
    } catch { return '' }
  }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          position:'relative',
          width:40, height:40, borderRadius:12,
          background: open ? '#eef2ff' : '#fff',
          border:'1.5px solid ' + (open ? '#c7d2fe' : '#e5e7eb'),
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          color: open ? '#6366f1' : '#6b7280',
          transition:'all .18s',
          boxShadow:'0 1px 4px rgba(0,0,0,.06)',
        }}
      >
        <Bell size={18}/>
        {unreadCount > 0 && (
          <div style={{
            position:'absolute', top:-4, right:-4,
            background:'linear-gradient(135deg,#e11d48,#f43f5e)',
            color:'#fff', fontSize:10, fontWeight:900,
            minWidth:18, height:18, borderRadius:99,
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:'0 4px',
            border:'2px solid #fff',
            boxShadow:'0 2px 6px rgba(225,29,72,.4)',
            animation: unreadCount > 0 ? 'noti-pulse 2s ease-in-out infinite' : 'none',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 10px)', right:0,
          width:380, maxHeight:520,
          background:'#fff',
          border:'1.5px solid #e0e7ff',
          borderRadius:18,
          boxShadow:'0 16px 48px rgba(99,102,241,.18), 0 4px 16px rgba(0,0,0,.08)',
          zIndex:999,
          display:'flex', flexDirection:'column',
          overflow:'hidden',
          animation:'slideUp .2s ease',
        }}>
          {/* Header */}
          <div style={{
            padding:'14px 18px',
            background:'linear-gradient(135deg,#6366f1,#7c3aed)',
            display:'flex', alignItems:'center', justifyContent:'space-between',
            flexShrink:0,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Bell size={16} style={{ color:'#fff' }}/>
              <span style={{ fontWeight:800, fontSize:15, color:'#fff' }}>การแจ้งเตือน</span>
              {unreadCount > 0 && (
                <span style={{ background:'rgba(255,255,255,.25)', color:'#fff', fontSize:11, fontWeight:800, padding:'2px 8px', borderRadius:99 }}>
                  {unreadCount} ใหม่
                </span>
              )}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead}
                  title="อ่านทั้งหมด"
                  style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:8, padding:'5px 10px', cursor:'pointer', color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                  <Check size={12}/> อ่านทั้งหมด
                </button>
              )}
              <button onClick={() => setOpen(false)}
                style={{ background:'rgba(255,255,255,.15)', border:'none', borderRadius:8, width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
                <X size={14}/>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:0, background:'#f8f9ff', borderBottom:'1.5px solid #e0e7ff', flexShrink:0 }}>
            {[
              { k:'unread', label:`ยังไม่อ่าน (${unreadCount})` },
              { k:'all',    label:'ทั้งหมด' },
            ].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                style={{
                  flex:1, padding:'10px 0',
                  background: tab===t.k ? '#fff' : 'transparent',
                  border:'none', borderBottom: tab===t.k ? '2px solid #6366f1' : '2px solid transparent',
                  cursor:'pointer', fontSize:13, fontWeight:700,
                  color: tab===t.k ? '#6366f1' : '#9ca3af',
                  fontFamily:'inherit',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
            {displayed.length === 0 ? (
              <div style={{ textAlign:'center', padding:'36px 20px', color:'#9ca3af' }}>
                <BellOff size={36} style={{ margin:'0 auto 10px', opacity:.3 }}/>
                <p style={{ fontSize:14, fontWeight:600, color:'#6b7280' }}>
                  {tab==='unread' ? 'ไม่มีการแจ้งเตือนใหม่' : 'ยังไม่มีการแจ้งเตือน'}
                </p>
              </div>
            ) : displayed.map(n => {
              const cfg = NOTI_CONFIG[n.type] || NOTI_CONFIG.system
              const isUnread = !n.readBy?.includes(uid)
              return (
                <div key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    display:'flex', alignItems:'flex-start', gap:12,
                    padding:'12px 16px',
                    background: isUnread ? '#fafbff' : '#fff',
                    borderLeft: isUnread ? `3px solid ${cfg.color}` : '3px solid transparent',
                    cursor: n.link ? 'pointer' : 'default',
                    transition:'background .15s',
                    borderBottom:'1px solid #f0f4ff',
                    position:'relative',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f7ff'}
                  onMouseLeave={e => e.currentTarget.style.background = isUnread ? '#fafbff' : '#fff'}
                >
                  {/* Icon */}
                  <div style={{
                    width:38, height:38, borderRadius:12, flexShrink:0,
                    background:cfg.bg, border:`1.5px solid ${cfg.border}`,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
                  }}>
                    {cfg.emoji}
                  </div>

                  {/* Content */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:3 }}>
                      <div style={{ fontSize:13.5, fontWeight: isUnread ? 800 : 600, color:'#1e1b4b', lineHeight:1.3 }}>
                        {n.title}
                        {isUnread && (
                          <span style={{ display:'inline-block', width:7, height:7, background:'#6366f1', borderRadius:'50%', marginLeft:6, verticalAlign:'middle' }}/>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteNoti(n.id) }}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#d1d5db', padding:2, flexShrink:0, borderRadius:4 }}
                        onMouseEnter={e => e.currentTarget.style.color='#f43f5e'}
                        onMouseLeave={e => e.currentTarget.style.color='#d1d5db'}
                      >
                        <Trash2 size={12}/>
                      </button>
                    </div>
                    <div style={{ fontSize:12.5, color:'#6b7280', lineHeight:1.4, marginBottom:4 }}>
                      {n.message}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:11, color:'#9ca3af' }}>{timeAgo(n.createdAt)}</span>
                      {n.link && (
                        <span style={{ fontSize:11, color:cfg.color, fontWeight:700 }}>→ ดูรายละเอียด</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{ padding:'10px 16px', borderTop:'1.5px solid #f0f4ff', textAlign:'center', flexShrink:0, background:'#fafbff' }}>
              <span style={{ fontSize:12, color:'#9ca3af' }}>
                แสดง {displayed.length} จาก {notifications.length} รายการ
              </span>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes noti-pulse {
          0%,100% { box-shadow: 0 2px 6px rgba(225,29,72,.4); }
          50%      { box-shadow: 0 2px 16px rgba(225,29,72,.7); }
        }
      `}</style>
    </div>
  )
}
