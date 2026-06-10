import React from 'react'
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'

export function Modal({ open, onClose, title, size='', children }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={`modal ${size==='lg'?'modal-lg':size==='xl'?'modal-xl':''}`}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" style={{ color:'#6b7280' }}>
            <X size={15}/>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Confirm({ open, onClose, onConfirm, title, message, danger }) {
  if (!open) return null
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:400 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:18 }}>
          <div style={{
            width:44, height:44, borderRadius:'50%', flexShrink:0,
            background: danger?'#ffe4e6':'#eef2ff',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
          }}>{danger?'🗑️':'❓'}</div>
          <div>
            <div style={{ fontWeight:900, fontSize:16, marginBottom:5, color:'#1e1b4b' }}>{title}</div>
            <div style={{ fontSize:13.5, color:'#6b7280' }}>{message}</div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">ยกเลิก</button>
          <button onClick={()=>{onConfirm();onClose()}}
            className={`btn btn-sm ${danger?'btn-danger':'btn-primary'}`}>
            {danger?'🗑️ ลบ':'✅ ยืนยัน'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Alert({ type='info', children }) {
  const M = {
    success:{ icon:'✅', cls:'alert-success' },
    error:  { icon:'❌', cls:'alert-error'   },
    warning:{ icon:'⚠️', cls:'alert-warning' },
    info:   { icon:'ℹ️', cls:'alert-info'    },
  }
  const { icon, cls } = M[type]||M.info
  return (
    <div className={`alert ${cls}`}>
      <span style={{ flexShrink:0, fontSize:14 }}>{icon}</span>
      <span>{children}</span>
    </div>
  )
}

export function Spinner({ size=20, className='' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      className={className} style={{ animation:'spin 1s linear infinite', ...({}) }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".2"/>
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

export function Empty({ icon: Icon, title, sub }) {
  return (
    <div className="empty-state">
      <div style={{ fontSize:48, marginBottom:12 }}>
        {title?.includes('ลา')?'🌴':title?.includes('เพจ')?'📄':title?.includes('เมล')?'📬':title?.includes('พนักงาน')?'👥':'📭'}
      </div>
      <p>{title}</p>
      {sub&&<small>{sub}</small>}
    </div>
  )
}

export function Avatar({ name='?', size='md', className='', style={}, photoURL='' }) {
  const sz={xs:'avatar-xs',sm:'avatar-sm',md:'avatar-md',lg:'avatar-lg',xl:'avatar-xl'}[size]||'avatar-md'
  if (photoURL) {
    return (
      <div className={`avatar ${sz} ${className}`} style={{ ...style, padding:0, overflow:'hidden' }}>
        <img src={photoURL} alt={name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}/>
      </div>
    )
  }
  return <div className={`avatar ${sz} ${className}`} style={style}>{(name||'?').slice(0,2)}</div>
}

export function StatCard({ icon: Icon, iconClass='icon-primary', value, label, sub, onClick, emoji }) {
  return (
    <div className={`stat-card ${onClick?'pointer':''}`} onClick={onClick}>
      {emoji
        ? <div style={{ fontSize:32, lineHeight:1, flexShrink:0 }}>{emoji}</div>
        : <div className={`stat-icon ${iconClass}`}>{Icon&&<Icon size={21}/>}</div>
      }
      <div style={{ flex:1 }}>
        <div style={{ fontSize:24, fontWeight:900, lineHeight:1, color:'#1e1b4b' }}>{value}</div>
        <div style={{ fontSize:12.5, color:'#6b7280', marginTop:4 }}>{label}</div>
        {sub&&<div style={{ fontSize:11.5, color:'#9ca3af', marginTop:3 }}>{sub}</div>}
      </div>
    </div>
  )
}

export function FormGroup({ label, children, required }) {
  return (
    <div className="form-group">
      {label&&(
        <label className="label">
          {label}{required&&<span style={{ color:'#e11d48', marginLeft:3 }}>*</span>}
        </label>
      )}
      {children}
    </div>
  )
}

export function Select({ value, onChange, options=[], placeholder, disabled, required, className='' }) {
  return (
    <select value={value} onChange={onChange} disabled={disabled} required={required}
      className={`input ${className}`}>
      {placeholder&&<option value="">{placeholder}</option>}
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export function LoadingPage() {
  return (
    <div style={{
      position:'fixed', inset:0,
      background:'linear-gradient(135deg, #eef2ff, #f0fdf4)',
      display:'flex', alignItems:'center', justifyContent:'center',
      flexDirection:'column', gap:16,
    }}>
      <div className="animate-float" style={{
        width:64, height:64, borderRadius:18,
        background:'linear-gradient(135deg, #6366f1, #7c3aed)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:30, boxShadow:'0 8px 24px rgba(99,102,241,.35)',
      }}>🚀</div>
      <Spinner size={28} style={{ color:'#6366f1' }}/>
      <p style={{ color:'#6b7280', fontSize:13 }}>กำลังโหลด...</p>
    </div>
  )
}

export function RoleBadge({ role }) {
  const M = {
    superadmin:{ cls:'badge-pink',   label:'👑 ผู้ดูแลสูงสุด' },
    head_admin:{ cls:'badge-orange', label:'⭐ หัวหน้าแอดมิน' },
    admin:     { cls:'badge-blue',   label:'💼 แอดมิน' },
    assistant: { cls:'badge-teal',   label:'🤝 ผู้ช่วย' },
  }
  const c=M[role]||{cls:'badge-gray',label:role}
  return <span className={`badge ${c.cls}`}>{c.label}</span>
}

export function StatusBadge({ status }) {
  const M = {
    pending: { cls:'badge-orange', label:'⏳ รออนุมัติ' },
    approved:{ cls:'badge-green',  label:'✅ อนุมัติแล้ว' },
    rejected:{ cls:'badge-red',    label:'❌ ไม่อนุมัติ' },
    active:  { cls:'badge-green',  label:'✅ ใช้งาน' },
    inactive:{ cls:'badge-gray',   label:'⏸ ปิด' },
  }
  const c=M[status]||{cls:'badge-gray',label:status}
  return <span className={`badge ${c.cls}`}>{c.label}</span>
}
