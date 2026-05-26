// src/components/Layout.js
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

const ROLE_LABELS  = { executive:'ผู้บริหาร', head:'หัวหน้า', admin:'แอดมิน' };
const ROLE_CLASSES = { executive:'role-executive', head:'role-head', admin:'role-admin' };

export default function Layout({ children, currentPage, setCurrentPage }) {
  const { user, logout, canManageUsers, isAdmin } = useAuth();
  const [collapsed,    setCollapsed]    = useState(false);
  const [showPWModal,  setShowPWModal]  = useState(false);
  const [pwForm,       setPwForm]       = useState({ current:'', next:'', next2:'' });
  const [pwErr,        setPwErr]        = useState('');
  const [pwOk,         setPwOk]         = useState('');
  const [pwBusy,       setPwBusy]       = useState(false);

  const navItems = [
    { id:'dashboard', icon:'📊', label:'ภาพรวม',           section:'หลัก',    show: true },
    { id:'daily',     icon:'📝', label:'รายการประจำวัน',   section:'หลัก',    show: true },
    { id:'personal',  icon:'👤', label:'สรุปรายบุคคล',    section:'หลัก',    show: true },
    { id:'users',     icon:'👥', label:'จัดการผู้ใช้',     section:'จัดการ',  show: !isAdmin },
    { id:'pages',     icon:'📄', label:'จัดการเพจ',        section:'จัดการ',  show: !isAdmin },
    { id:'reports',   icon:'📈', label:'รายงาน & PDF',     section:'รายงาน',  show: true },
  ];

  const titles = {
    dashboard:{ title:'ภาพรวม',           sub:'สถิติและข้อมูลรวม' },
    daily:    { title:'รายการประจำวัน',   sub:'บันทึกผลงานรายวัน' },
    personal: { title:'สรุปรายบุคคล',    sub:'ผลงานแยกตามบุคคล' },
    users:    { title:'จัดการผู้ใช้',     sub:'เพิ่ม ลบ แก้ไขผู้ใช้' },
    pages:    { title:'จัดการเพจ',        sub:'เพิ่ม ลบ แก้ไขเพจ' },
    reports:  { title:'รายงาน',           sub:'สรุปผลรายวัน เดือน ปี + PDF' },
  };

  const initials = (user?.displayName || user?.email || '?').charAt(0).toUpperCase();

  async function changePW() {
    const { current, next, next2 } = pwForm;
    setPwErr(''); setPwOk('');
    if (!current || !next) return setPwErr('กรุณากรอกข้อมูลครบ');
    if (next.length < 6)   return setPwErr('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
    if (next !== next2)    return setPwErr('รหัสผ่านใหม่ไม่ตรงกัน');
    setPwBusy(true);
    try {
      await api.changePassword({ email: user.email, currentPassword: current, newPassword: next });
      setPwOk('เปลี่ยนรหัสผ่านสำเร็จ');
      setPwForm({ current:'', next:'', next2:'' });
      setTimeout(() => setShowPWModal(false), 1400);
    } catch(e) {
      setPwErr(e.message);
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar" style={{ width: collapsed ? 70 : 240 }}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-mark" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <div className="logo-icon">APM</div>
            {!collapsed && (
              <div className="logo-text">
                <div className="brand">Admin Page Mgr</div>
                <div className="tagline">Management System</div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        {['หลัก','จัดการ','รายงาน'].map(sec => {
          const items = navItems.filter(n => n.section === sec && n.show);
          if (!items.length) return null;
          return (
            <div key={sec} className="nav-section">
              {!collapsed && <div className="nav-label">{sec}</div>}
              {items.map(item => (
                <div key={item.id}
                  className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                  onClick={() => setCurrentPage(item.id)}
                  title={collapsed ? item.label : ''}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </div>
              ))}
            </div>
          );
        })}

        {/* Collapse toggle */}
        <div style={{ padding:'0 12px 12px', marginTop:'auto' }}>
          <div className="nav-item" onClick={() => setCollapsed(c => !c)}
            style={{ justifyContent: collapsed ? 'center' : 'flex-start', cursor:'pointer' }}>
            <span className="nav-icon">{collapsed ? '→' : '←'}</span>
            {!collapsed && <span>ย่อเมนู</span>}
          </div>
        </div>

        {/* User footer */}
        <div className="sidebar-footer" style={{ padding: collapsed ? '12px 8px' : '14px 12px' }}>
          <div className="user-card" style={{ flexDirection: collapsed ? 'column' : 'row', gap: 8 }}>
            <div className="user-avatar-placeholder">{initials}</div>
            {!collapsed && (
              <div className="user-info" style={{ flex:1, minWidth:0 }}>
                <div className="user-name" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {user?.displayName || user?.email}
                </div>
                <div className="user-role">{ROLE_LABELS[user?.role] || user?.role}</div>
              </div>
            )}
            {!collapsed && (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <button className="logout-btn" title="เปลี่ยนรหัสผ่าน" onClick={() => setShowPWModal(true)}>🔑</button>
                <button className="logout-btn" title="ออกจากระบบ" onClick={logout}>⏻</button>
              </div>
            )}
          </div>
          {collapsed && (
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
              <button className="btn btn-ghost btn-sm" style={{ padding:'5px', justifyContent:'center' }} onClick={() => setShowPWModal(true)} title="เปลี่ยนรหัสผ่าน">🔑</button>
              <button className="btn btn-danger btn-sm" style={{ padding:'5px', justifyContent:'center' }} onClick={logout} title="ออกจากระบบ">⏻</button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-content" style={{ marginLeft: collapsed ? 70 : 240 }}>
        <header className="top-bar">
          <div>
            <div className="page-title">{titles[currentPage]?.title}</div>
            <div className="page-subtitle">{titles[currentPage]?.sub}</div>
          </div>
          <div className="top-bar-actions">
            <span className={`role-badge ${ROLE_CLASSES[user?.role] || ''}`}>
              {ROLE_LABELS[user?.role] || user?.role}
            </span>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>
              {user?.displayName || user?.email}
            </span>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>

      {/* ── Change Password Modal ── */}
      {showPWModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPWModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">🔑 เปลี่ยนรหัสผ่าน</div>
              <button className="modal-close" onClick={() => setShowPWModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {[
                { label:'รหัสผ่านปัจจุบัน', field:'current', ph:'••••••••' },
                { label:'รหัสผ่านใหม่',      field:'next',    ph:'อย่างน้อย 6 ตัวอักษร' },
                { label:'ยืนยันรหัสผ่านใหม่',field:'next2',   ph:'กรอกซ้ำอีกครั้ง' },
              ].map(({ label, field, ph }) => (
                <div key={field} className="form-group">
                  <label className="form-label">{label}</label>
                  <input className="form-input" type="password" placeholder={ph}
                    value={pwForm[field]} onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}/>
                </div>
              ))}
              {pwErr && <div style={{ background:'rgba(247,111,142,.1)', border:'1px solid rgba(247,111,142,.3)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--accent-rose)' }}>⚠️ {pwErr}</div>}
              {pwOk  && <div style={{ background:'rgba(54,215,183,.1)',  border:'1px solid rgba(54,215,183,.3)',  borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--accent-teal)' }}>✅ {pwOk}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowPWModal(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={changePW} disabled={pwBusy}>
                {pwBusy ? '...' : '🔐 บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
