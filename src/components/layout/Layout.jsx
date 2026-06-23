import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { ChevronLeft, ChevronRight, Menu, X, LogOut, Camera, Upload } from 'lucide-react'
import NotificationBell from '../ui/NotificationBell'

const NAV_GROUPS = [
  {
    label:'หลัก',
    items:[
      { path:'/',           emoji:'🏠', label:'Dashboard',          roles:['superadmin','head_admin','admin','assistant'] },
      { path:'/commission', emoji:'💰', label:'ค่าคอมมิชชั่น',    roles:['superadmin','head_admin','admin','assistant'] },
      { path:'/verify',     emoji:'🔍', label:'ตรวจสอบยอด',        roles:['superadmin','head_admin','assistant'] },
      { path:'/audit',      emoji:'⚖️', label:'หลังบ้านตรวจออเดอร์',roles:['superadmin','head_admin','auditor'] },
      { path:'/checkin',    emoji:'🏁', label:'เช็คอิน / กะ',          roles:['superadmin','head_admin','admin','assistant'] },
      { path:'/parcels',        emoji:'📦', label:'พัสดุ / ขนส่ง',          roles:['superadmin','head_admin','assistant'] },
      { path:'/parcel-compare',  emoji:'🔍', label:'เปรียบเทียบออเดอร์',      roles:['superadmin','head_admin','assistant'] },
    ]
  },
  {
    label:'ทีมงาน',
    items:[
      { path:'/team',     emoji:'🛡️', label:'ศูนย์บัญชาการทีม', roles:['superadmin','head_admin'] },
      { path:'/payroll',  emoji:'💵', label:'เงินเดือน',           roles:['superadmin','head_admin','assistant'] },
      { path:'/company',  emoji:'🏢', label:'ภาพรวมบริษัท',      roles:['superadmin'] },
      { path:'/pages',    emoji:'📄', label:'จัดการเพจ',         roles:['superadmin','head_admin'] },
      { path:'/leave',    emoji:'🌴', label:'วันลา',              roles:['superadmin','head_admin','admin','assistant'] },
      { path:'/mailbox',  emoji:'📬', label:'รับเมลงาน',         roles:['superadmin','head_admin','admin','assistant'] },
    ]
  },
  {
    label:'จัดการ',
    items:[
      { path:'/employees', emoji:'👥', label:'พนักงาน & สิทธิ์',  roles:['superadmin','head_admin'] },
      { path:'/reports',   emoji:'📈', label:'รายงาน & สถิติ',    roles:['superadmin','head_admin','assistant'] },
      { path:'/settings',  emoji:'⚙️', label:'ตั้งค่าค่าคอม',     roles:['superadmin'] },
    ]
  },
]

const ROLE_STYLE = {
  superadmin:{ bg:'rgba(255,255,255,.2)', color:'#fff', label:'👑 ผู้ดูแลสูงสุด' },
  head_admin:{ bg:'rgba(255,255,255,.2)', color:'#fff', label:'⭐ หัวหน้าแอดมิน' },
  admin:     { bg:'rgba(255,255,255,.2)', color:'#fff', label:'💼 แอดมิน' },
  assistant: { bg:'rgba(255,255,255,.2)', color:'#fff', label:'🤝 ผู้ช่วย' },
  auditor:   { bg:'rgba(255,255,255,.2)', color:'#fff', label:'⚖️ ผู้ตรวจสอบหลังบ้าน' },
}

const TOPBAR_BADGE = {
  superadmin:{ bg:'#fdf2f8', color:'#be185d', border:'#fbcfe8', label:'👑 ผู้ดูแลสูงสุด' },
  head_admin:{ bg:'#fffbeb', color:'#b45309', border:'#fde68a', label:'⭐ หัวหน้าแอดมิน' },
  admin:     { bg:'#eef2ff', color:'#4338ca', border:'#c7d2fe', label:'💼 แอดมิน' },
  assistant: { bg:'#f0fdf4', color:'#047857', border:'#bbf7d0', label:'🤝 ผู้ช่วย' },
  auditor:   { bg:'#f5f3ff', color:'#6d28d9', border:'#ddd6fe', label:'⚖️ ผู้ตรวจสอบหลังบ้าน' },
}

export default function Layout() {
  const { profile, logout, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [collapsed,  setCollapsed]  = useState(()=>localStorage.getItem('sidebar-collapsed')==='true')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile,   setIsMobile]   = useState(window.innerWidth<768)

  useEffect(()=>{
    const fn=()=>{ const m=window.innerWidth<768; setIsMobile(m); if(m)setMobileOpen(false) }
    window.addEventListener('resize',fn); return ()=>window.removeEventListener('resize',fn)
  },[])
  useEffect(()=>{ setMobileOpen(false) },[location.pathname])

  const toggleCollapse=()=>{ const n=!collapsed; setCollapsed(n); localStorage.setItem('sidebar-collapsed',String(n)) }
  const handleLogout=async()=>{ await logout(); navigate('/login') }

  // ── Profile photo states ──────────────────────────
  const { updateUser } = useData()
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [uploadingPhoto,   setUploadingPhoto]   = useState(false)
  const [photoErr,         setPhotoErr]         = useState('')

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      setPhotoErr('รองรับเฉพาะ JPG, PNG, WebP'); return
    }
    if (file.size > 2 * 1024 * 1024) { setPhotoErr('ไฟล์ต้องไม่เกิน 2MB'); return }
    setUploadingPhoto(true); setPhotoErr('')
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        await updateUser(profile?.id, { photoURL: ev.target.result })
        setShowProfileModal(false)
      } catch(err) { setPhotoErr(err.message) }
      finally { setUploadingPhoto(false) }
    }
    reader.readAsDataURL(file)
  }

  const isCollapsed=!isMobile&&collapsed
  const sidebarClass=['sidebar', isCollapsed?'collapsed':'', isMobile?(mobileOpen?'mobile-open':'mobile-hidden'):''].filter(Boolean).join(' ')
  const mainClass=['main-wrap', isCollapsed?'collapsed':''].filter(Boolean).join(' ')

  const allItems = NAV_GROUPS.flatMap(g=>g.items)
  const currentPage = allItems.find(n=>
    n.path==='/' ? location.pathname==='/' : location.pathname.startsWith(n.path)
  )
  const rs = TOPBAR_BADGE[profile?.role] || TOPBAR_BADGE.admin

  return (
    <>
    <div className="app-shell">
      {mobileOpen&&<div className="sidebar-overlay show" onClick={()=>setMobileOpen(false)}/>}

      {/* ── Sidebar ── */}
      <nav className={sidebarClass}>
        {!isMobile&&(
          <button className="collapse-btn" onClick={toggleCollapse} title={collapsed?'ขยาย':'ย่อ'}>
            {collapsed?<ChevronRight size={13}/>:<ChevronLeft size={13}/>}
          </button>
        )}

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-mark">🚀</div>
          <div className="logo-text">
            <div className="logo-name">AdminSys</div>
            <div className="logo-sub">ระบบจัดการ</div>
          </div>
          {isMobile&&(
            <button onClick={()=>setMobileOpen(false)} style={{ marginLeft:'auto', background:'none', border:'none', color:'rgba(255,255,255,.7)', cursor:'pointer', padding:4, display:'flex' }}>
              <X size={18}/>
            </button>
          )}
        </div>

        {/* Nav */}
        <div className="sidebar-nav">
          {(loading || !profile) ? (
            <div style={{ padding:'20px 16px', color:'rgba(255,255,255,.4)', fontSize:12, textAlign:'center' }}>
              ⏳ กำลังโหลด...
            </div>
          ) : !profile.role ? (
            <div style={{ padding:'16px', color:'rgba(255,200,100,.8)', fontSize:11, textAlign:'center', lineHeight:1.7 }}>
              ⚠️ ไม่พบสิทธิ์ผู้ใช้<br/>กรุณาติดต่อผู้ดูแลระบบ
            </div>
          ) : (
            NAV_GROUPS.map(group=>{
              const visible=group.items.filter(n=>n.roles.includes(profile.role))
              if(!visible.length) return null
              return (
                <div key={group.label}>
                  <div className="nav-section-label">{group.label}</div>
                  {visible.map(item=>(
                    <NavLink key={item.path} to={item.path} end={item.path==='/'}
                      className={({isActive})=>`nav-item ${isActive?'active':''}`}>
                      <span style={{ fontSize:16, flexShrink:0, lineHeight:1 }}>{item.emoji}</span>
                      <span className="nav-item-label">{item.label}</span>
                      <div className="nav-item-tooltip">{item.emoji} {item.label}</div>
                    </NavLink>
                  ))}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="avatar avatar-sm" onClick={()=>setShowProfileModal(true)}
              style={{ background:profile?.photoURL?'transparent':'rgba(255,255,255,.25)', color:'#fff', border:'2px solid rgba(255,255,255,.4)', fontSize:14, cursor:'pointer', overflow:'hidden', flexShrink:0, position:'relative' }}>
              {profile?.photoURL
                ? <img src={profile.photoURL} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}/>
                : (profile?.avatar||profile?.name||'?').slice(0,2)
              }
              <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.3)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity .2s', borderRadius:'50%' }}
                onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                <Camera size={10} color="#fff"/>
              </div>
            </div>
            <div className="user-pill-info">
              <div className="user-name">{profile?.name}</div>
              <div className="user-role-label">{ROLE_STYLE[profile?.role]?.label}</div>
            </div>
            <button className="btn-logout" onClick={handleLogout} title="ออกจากระบบ">
              <LogOut size={15}/>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main ── */}
      <div className={mainClass}>
        <header className="topbar">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="hamburger-btn" onClick={()=>setMobileOpen(true)}>
              <Menu size={20}/>
            </button>
            <div>
              <div className="topbar-title">
                {currentPage?.emoji} {currentPage?.label||'Dashboard'}
              </div>
            </div>
          </div>
          <div className="topbar-right">
            <NotificationBell/>
            <div onClick={()=>setShowProfileModal(true)}
              style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer',
                background:rs.bg, border:`1.5px solid ${rs.border}`,
                borderRadius:99, padding:'4px 14px 4px 4px' }}>
              {/* avatar */}
              <div style={{ width:28, height:28, borderRadius:'50%', overflow:'hidden', flexShrink:0,
                background:profile?.photoURL?'transparent':'linear-gradient(135deg,#6366f1,#7c3aed)',
                color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:900, border:'1.5px solid rgba(255,255,255,.5)' }}>
                {profile?.photoURL
                  ? <img src={profile.photoURL} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  : (profile?.avatar||profile?.name||'?').slice(0,2)
                }
              </div>
              <span style={{ color:rs.color, fontSize:13, fontWeight:700 }}>{rs.label}</span>
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet/>
        </main>
      </div>
    </div>
    {/* ── Profile Modal ── */}
    {showProfileModal && (
      <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:20 }}
        onClick={e=>e.target===e.currentTarget&&setShowProfileModal(false)}>
        <div style={{ background:'#fff', borderRadius:22, padding:28, width:'100%', maxWidth:360, boxShadow:'0 20px 50px rgba(0,0,0,.25)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
            <div style={{ fontSize:17, fontWeight:900, color:'#1e1b4b' }}>📷 รูปโปรไฟล์</div>
            <button onClick={()=>setShowProfileModal(false)}
              style={{ background:'#f1f5f9', border:'none', borderRadius:8, width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6b7280' }}>✕</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, marginBottom:22 }}>
            <div style={{ width:90, height:90, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#7c3aed)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:900, overflow:'hidden', border:'3px solid #e0e7ff' }}>
              {profile?.photoURL
                ? <img src={profile.photoURL} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                : (profile?.avatar||profile?.name||'?').slice(0,2)
              }
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#1e1b4b' }}>{profile?.name}</div>
              <div style={{ fontSize:12.5, color:'#6b7280', marginTop:2 }}>{ROLE_STYLE[profile?.role]?.label}</div>
            </div>
          </div>
          {photoErr && (
            <div style={{ background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:10, padding:'9px 14px', fontSize:13, color:'#be123c', marginBottom:12 }}>❌ {photoErr}</div>
          )}
          <label style={{ display:'block', cursor:'pointer' }}>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} style={{ display:'none' }}/>
            <div style={{ background:uploadingPhoto?'#e5e7eb':'linear-gradient(135deg,#6366f1,#7c3aed)', borderRadius:12, padding:'13px 0', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <Upload size={16} color="#fff"/>
              <span style={{ fontSize:14, fontWeight:800, color:'#fff' }}>
                {uploadingPhoto ? '⏳ กำลังอัพโหลด...' : '📂 เลือกรูปภาพ'}
              </span>
            </div>
            <div style={{ fontSize:11.5, color:'#9ca3af', textAlign:'center', marginTop:6 }}>JPG, PNG, WebP · ไม่เกิน 2MB</div>
          </label>
          {profile?.photoURL && (
            <button onClick={async()=>{ await updateUser(profile?.id,{photoURL:''}); setShowProfileModal(false) }}
              style={{ width:'100%', background:'#fff1f2', border:'1.5px solid #fecdd3', borderRadius:10, padding:'9px 0', cursor:'pointer', fontSize:13, fontWeight:700, color:'#be123c', fontFamily:'inherit', marginTop:10 }}>
              🗑️ ลบรูปโปรไฟล์
            </button>
          )}
        </div>
      </div>
    )}
    </>
  )
}
