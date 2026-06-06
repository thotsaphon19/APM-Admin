import React from 'react'

const CHANNELS = {
  facebook:  { label:'Facebook',  color:'#1877F2', bg:'#E7F0FF', border:'#B3CFFF',
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
  line:      { label:'LINE',       color:'#06C755', bg:'#E6FFF0', border:'#A3E8BC',
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386a.631.631 0 0 1-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016a.631.631 0 0 1-.627.629.614.614 0 0 1-.49-.247l-2.38-3.239v2.857c0 .346-.283.629-.631.629a.631.631 0 0 1-.627-.629V8.108c0-.345.282-.63.63-.63.172 0 .333.074.451.203l2.39 3.252V8.108c0-.345.282-.63.63-.63.346 0 .626.285.626.63v4.771zm-5.741 0a.63.63 0 0 1-.627.629.631.631 0 0 1-.63-.629V8.108c0-.345.283-.63.63-.63a.63.63 0 0 1 .627.63v4.771zm-2.466.629H4.917a.631.631 0 0 1-.63-.629V8.108c0-.345.283-.63.63-.63.346 0 .627.285.627.63v4.141h1.885c.348 0 .63.283.63.629 0 .346-.282.63-.63.63M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg> },
  instagram: { label:'Instagram',  color:'#E1306C', bg:'#FFE8F0', border:'#F4B3CB',
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg> },
  tiktok:    { label:'TikTok',     color:'#010101', bg:'#F2F2F2', border:'#CCCCCC',
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.31 6.31 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.82a8.16 8.16 0 0 0 4.77 1.52V6.89a4.85 4.85 0 0 1-1-.2z"/></svg> },
  website:   { label:'เว็บไซต์',   color:'#6366F1', bg:'#EEEEFF', border:'#C7C9FA',
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  other:     { label:'อื่นๆ',      color:'#6B7280', bg:'#F3F4F6', border:'#D1D5DB',
    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
}

/**
 * PageBadge — แสดงชื่อเพจพร้อม icon ช่องทาง
 * props:
 *   page      — page object { name, channel, channelNote }
 *   showName  — boolean (default true)
 *   size      — 'xs' | 'sm' | 'md'
 */
export default function PageBadge({ page, showName = true, size = 'sm' }) {
  if (!page) return <span style={{ color:'#9ca3af' }}>—</span>

  const ch = CHANNELS[page.channel]
  const sizes = {
    xs: { fs:10,  iconSize:9,  pad:'1px 6px',  gap:3,  nameFontSize:11  },
    sm: { fs:11,  iconSize:11, pad:'2px 8px',  gap:4,  nameFontSize:13  },
    md: { fs:12.5,iconSize:13, pad:'3px 10px', gap:5,  nameFontSize:14.5},
  }
  const sz = sizes[size] || sizes.sm

  const channelLabel = page.channel === 'other' && page.channelNote
    ? page.channelNote
    : ch?.label

  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, flexWrap:'nowrap' }}>
      {/* ชื่อเพจ */}
      {showName && (
        <span style={{ fontSize:sz.nameFontSize, fontWeight:700, color:'#1e1b4b', whiteSpace:'nowrap' }}>
          {page.type === 'main' ? '⭐' : '🧪'} {page.name}
        </span>
      )}
      {/* channel badge */}
      {ch && (
        <span style={{
          background: ch.bg,
          color: ch.color,
          border: `1px solid ${ch.border}`,
          borderRadius: 99,
          padding: sz.pad,
          fontSize: sz.fs,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: sz.gap,
          flexShrink: 0,
        }}>
          <span style={{ color: ch.color, display:'flex', alignItems:'center', fontSize: sz.iconSize }}>
            {ch.icon}
          </span>
          {channelLabel}
        </span>
      )}
    </span>
  )
}

export { CHANNELS }
