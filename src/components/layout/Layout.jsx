import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, ROLES } from '../../contexts/AuthContext'
import { ChevronLeft, ChevronRight, Menu, X, LogOut } from 'lucide-react'
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
      { path:'/parcels',        emoji:'📦', label:'พัสดุ / ขนส่ง',          roles:['superadmin','head_admin','admin','assistant'] },
      { path:'/parcel-compare',  emoji:'🔍', label:'เปรียบเทียบออเดอร์',      roles:['superadmin','head_admin','assistant'] },
    ]
  },
  {
    label:'ทีมงาน',
    items:[
      { path:'/team',     emoji:'🛡️', label:'ศูนย์บัญชาการทีม', roles:['superadmin','head_admin'] },
      { path:'/payroll',  emoji:'💵', label:'เงินเดือน',           roles:['superadmin','head_admin','assistant'] },
      { path:'/company',  emoji:'🏢', label:'ภาพรวมบริษัท',      roles:['superadmin'] },
      { path:'/pages',    emoji:'📄', label:'จัดการเพจ',         roles:['superadmin','head_admin','admin'] },
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
  const { profile, logout } = useAuth()
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

  const isCollapsed=!isMobile&&collapsed
  const sidebarClass=['sidebar', isCollapsed?'collapsed':'', isMobile?(mobileOpen?'mobile-open':'mobile-hidden'):''].filter(Boolean).join(' ')
  const mainClass=['main-wrap', isCollapsed?'collapsed':''].filter(Boolean).join(' ')

  const allItems = NAV_GROUPS.flatMap(g=>g.items)
  const currentPage = allItems.find(n=>
    n.path==='/' ? location.pathname==='/' : location.pathname.startsWith(n.path)
  )
  const rs = TOPBAR_BADGE[profile?.role] || TOPBAR_BADGE.admin

  return (
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
          {NAV_GROUPS.map(group=>{
            const visible=group.items.filter(n=>n.roles.includes(profile?.role))
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
          })}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="avatar avatar-sm" style={{ background:'rgba(255,255,255,.25)', color:'#fff', border:'1.5px solid rgba(255,255,255,.3)', fontSize:14 }}>
              {(profile?.avatar||profile?.name||'?').slice(0,2)}
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
            <div style={{
              background:rs.bg, color:rs.color, border:`1.5px solid ${rs.border}`,
              borderRadius:99, padding:'5px 14px', fontSize:13, fontWeight:700,
            }}>
              {rs.label}
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet/>
        </main>
      </div>
    </div>
  )
}
