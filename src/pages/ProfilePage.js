// src/pages/ProfilePage.js
import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotif } from '../contexts/NotifContext';
import { ToastContainer, useToast } from '../components/Toast';

const ROLE_LABELS = { executive:'ผู้บริหาร', head:'หัวหน้า', admin:'แอดมิน' };
const ROLE_CLS    = { executive:'tag-gold', head:'tag-blue', admin:'tag-green' };
const ROLE_OPTS   = [
  { value:'executive', label:'ผู้บริหาร' },
  { value:'head',      label:'หัวหน้า' },
  { value:'admin',     label:'แอดมิน' },
];

// ── EditPagesForm sub-component ─────────────────────────────
function EditPagesForm({ pages, currentUser, selectedPages, setSelectedPages,
                         isSelf, canManage, saving, onCancel, onSave }) {
  const [notes, setNotes] = useState(() => {
    // init notes จากข้อมูลปัจจุบัน
    const init = {};
    pages.forEach(p => {
      const key = `pageNote_${p.id}`;
      if (currentUser[key]) init[p.id] = currentUser[key];
    });
    return init;
  });

  function toggle(id) {
    setSelectedPages(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  return (
    <div>
      <div style={{
        background:'rgba(79,142,247,0.06)', border:'1px solid rgba(79,142,247,0.2)',
        borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:13,
        color:'var(--text-secondary)', lineHeight:1.6,
      }}>
        ✅ <strong>เลือกเพจ</strong>ที่คุณรับผิดชอบ แล้วกรอก<strong>รายละเอียด</strong>เพิ่มเติมได้ เช่น วันเวลาที่ดูแล หน้าที่หลัก หรือข้อมูลสำคัญ
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:24 }}>
        {pages.map(p => {
          const sel = selectedPages.includes(p.id);
          return (
            <div key={p.id} style={{
              border:`1.5px solid ${sel ? 'rgba(79,142,247,0.5)' : 'var(--border)'}`,
              borderRadius:12, overflow:'hidden',
              background: sel ? 'rgba(79,142,247,0.04)' : 'var(--bg-surface)',
              transition:'all .15s',
            }}>
              {/* Page header row */}
              <div onClick={() => toggle(p.id)} style={{
                padding:'14px 16px', cursor:'pointer',
                display:'flex', alignItems:'center', gap:12,
              }}>
                <div style={{
                  width:36, height:36, borderRadius:8, flexShrink:0,
                  background: sel
                    ? 'linear-gradient(135deg,var(--accent-blue),var(--accent-purple))'
                    : 'var(--bg-hover)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
                }}>📄</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight: sel ? 700 : 500, fontSize:14 }}>{p.name}</div>
                  <div style={{ display:'flex', gap:6, marginTop:2 }}>
                    <span className="tag tag-blue" style={{ fontSize:10 }}>{p.category}</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                      {Number(p.followers||0).toLocaleString()} followers
                    </span>
                  </div>
                </div>
                <div style={{
                  width:24, height:24, borderRadius:6, flexShrink:0,
                  background: sel ? 'var(--accent-blue)' : 'var(--bg-hover)',
                  border: sel ? 'none' : '1.5px solid var(--border)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, transition:'all .15s',
                }}>
                  {sel ? '✓' : ''}
                </div>
              </div>

              {/* Note field — แสดงเฉพาะเมื่อเลือก */}
              {sel && (
                <div style={{
                  padding:'0 16px 16px', borderTop:'1px solid rgba(255,255,255,0.05)',
                  paddingTop:12,
                }}>
                  <label style={{
                    fontSize:11, fontWeight:600, textTransform:'uppercase',
                    letterSpacing:'0.6px', color:'var(--text-muted)', display:'block', marginBottom:6,
                  }}>
                    รายละเอียดหน้าที่ / บันทึก (ไม่บังคับ)
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={notes[p.id] || ''}
                    onChange={e => setNotes(n => ({ ...n, [p.id]: e.target.value }))}
                    placeholder={`เช่น ดูแลวันจันทร์-ศุกร์ 9:00-18:00, รับผิดชอบตอบข้อความและโพสต์คอนเทนต์...`}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              )}
            </div>
          );
        })}

        {pages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <div className="empty-title">ยังไม่มีเพจในระบบ</div>
            <div className="empty-desc">ผู้บริหาร/หัวหน้าต้องเพิ่มเพจในระบบก่อน</div>
          </div>
        )}
      </div>

      {/* Summary */}
      {selectedPages.length > 0 && (
        <div style={{
          background:'rgba(54,215,183,0.06)', border:'1px solid rgba(54,215,183,0.2)',
          borderRadius:8, padding:'10px 16px', marginBottom:16,
          fontSize:13, color:'var(--accent-teal)',
        }}>
          ✅ เลือกแล้ว {selectedPages.length} เพจ:{' '}
          {selectedPages.map(id => {
            const p = pages.find(pg => pg.id === id);
            return p?.name || id;
          }).join(', ')}
        </div>
      )}

      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary" onClick={() => onSave(notes)} disabled={saving}>
          {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกเพจ'}
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { load: reloadNotif } = useNotif();
  const { toasts, remove, toast } = useToast();
  const canManage = user?.role === 'executive' || user?.role === 'head';

  // ── View mode: 'me' | email of another admin ──
  const [viewMode,    setViewMode]    = useState('me');
  const [adminList,   setAdminList]   = useState([]);
  const [pages,       setPages]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [tab,         setTab]         = useState('info');
  const [editMode,    setEditMode]    = useState(false);

  // Forms
  const [form,   setForm]   = useState({ firstName:'', lastName:'', phone:'', lineId:'', position:'', bio:'' });
  const [roleForm, setRoleForm] = useState('admin');
  const [selectedPages, setSelectedPages] = useState([]);
  const [pwForm, setPwForm] = useState({ current:'', next:'', next2:'' });
  const [showPw, setShowPw] = useState({ c:false, n:false, n2:false });

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const [profilesRes, pagesRes] = await Promise.all([
        api.getAdminProfiles(),
        api.getPages(),
      ]);
      const all = profilesRes.data || [];
      setAdminList(all);
      setPages((pagesRes.data || []).filter(p => p.active !== false && p.active !== 'false'));
      // Init self form
      const me = all.find(u => u.email === user.email) || user;
      initForm(me);
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  function initForm(u) {
    setForm({
      firstName: u.firstName || '',
      lastName:  u.lastName  || '',
      phone:     u.phone     || '',
      lineId:    u.lineId    || '',
      position:  u.position  || '',
      bio:       u.bio       || '',
    });
    setRoleForm(u.role || 'admin');
    let pg = [];
    try { pg = typeof u.pages === 'string' ? JSON.parse(u.pages) : (u.pages || []); } catch {}
    setSelectedPages(pg);
  }

  function selectAdmin(email) {
    setViewMode(email);
    setEditMode(false);
    setTab('info');
    const u = adminList.find(a => a.email === email);
    if (u) initForm(u);
  }

  function selectMe() {
    setViewMode('me');
    setEditMode(false);
    setTab('info');
    const me = adminList.find(u => u.email === user.email) || user;
    initForm(me);
  }

  const currentUser = viewMode === 'me'
    ? (adminList.find(u => u.email === user.email) || user)
    : (adminList.find(u => u.email === viewMode) || {});

  const isSelf     = viewMode === 'me' || viewMode === user.email;
  const canEdit    = isSelf || canManage;

  // ── Pages for current user ──
  let myPageIds = [];
  try { myPageIds = typeof currentUser.pages === 'string' ? JSON.parse(currentUser.pages) : (currentUser.pages || []); } catch {}
  if (selectedPages.length > 0 && editMode) myPageIds = selectedPages;
  const myPages = pages.filter(p => myPageIds.includes(p.id));

  async function saveInfo() {
    setSaving(true);
    try {
      if (isSelf) {
        await api.updateProfile({ email: user.email, ...form });
      } else {
        await api.updateAdminProfile({
          targetEmail:    currentUser.email,
          requesterRole:  user.role,
          requesterEmail: user.email,
          requesterName:  user.displayName || user.email,
          ...form,
          role: roleForm,
        });
        reloadNotif();
      }
      toast.success('บันทึกข้อมูลสำเร็จ');
      setEditMode(false);
      loadData();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function savePages(notes = {}) {
    setSaving(true);
    try {
      const pageIds = selectedPages.filter(id => typeof id === 'string' && id.length > 0);
      // แปลง notes เป็น pageNote_xxx fields
      const noteFields = {};
      Object.entries(notes).forEach(([pageId, note]) => {
        noteFields[`pageNote_${pageId}`] = note;
      });

      if (isSelf) {
        await api.updateProfile({
          email: user.email,
          pages: JSON.stringify(pageIds),
          ...noteFields,
        });
        toast.success('บันทึกเพจที่รับผิดชอบสำเร็จ');
      } else {
        await api.updateUserPages({
          targetEmail:    currentUser.email,
          pages:          pageIds,
          requesterRole:  user.role,
          requesterEmail: user.email,
          requesterName:  user.displayName || user.email,
        });
        toast.success('อัปเดตเพจสำเร็จ');
        reloadNotif();
      }
      setEditMode(false);
      loadData();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function savePassword() {
    const { current, next, next2 } = pwForm;
    if (!current || !next) return toast.error('กรุณากรอกข้อมูลครบ');
    if (next.length < 6)   return toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัว');
    if (next !== next2)    return toast.error('รหัสผ่านใหม่ไม่ตรงกัน');
    setSaving(true);
    try {
      await api.changePassword({ email: user.email, currentPassword: current, newPassword: next });
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      setPwForm({ current:'', next:'', next2:'' });
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  const [pageNotes, setPageNotes] = useState({});

  function togglePage(id) {
    setSelectedPages(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  const initials = (n) => (n?.displayName || n?.email || '?').charAt(0).toUpperCase();

  return (
    <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
      <ToastContainer toasts={toasts} removeToast={remove}/>

      {/* ── Sidebar: admin list (managers only) ── */}
      {canManage && (
        <div style={{ width:220, flexShrink:0 }}>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', fontWeight:600, fontSize:13 }}>
              👥 ทีมแอดมิน
            </div>
            <div style={{ maxHeight:500, overflowY:'auto' }}>
              {/* Me */}
              <div onClick={selectMe} style={{
                padding:'12px 16px', cursor:'pointer', display:'flex', gap:10, alignItems:'center',
                background: viewMode==='me' ? 'var(--bg-active)' : 'transparent',
                borderBottom:'1px solid rgba(255,255,255,0.04)',
                transition:'background .15s',
              }}>
                <div className="user-avatar-placeholder" style={{ width:32, height:32, fontSize:12, flexShrink:0 }}>
                  {initials(user)}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {user?.displayName || user?.email}
                  </div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>คุณ</div>
                </div>
              </div>
              {adminList.filter(u => u.email !== user.email).map(u => (
                <div key={u.email} onClick={() => selectAdmin(u.email)} style={{
                  padding:'12px 16px', cursor:'pointer', display:'flex', gap:10, alignItems:'center',
                  background: viewMode===u.email ? 'var(--bg-active)' : 'transparent',
                  borderBottom:'1px solid rgba(255,255,255,0.04)',
                  transition:'background .15s',
                }}>
                  <div className="user-avatar-placeholder" style={{ width:32, height:32, fontSize:12, flexShrink:0 }}>
                    {initials(u)}
                  </div>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {u.displayName || u.email}
                    </div>
                    <span className={`tag ${ROLE_CLS[u.role]||'tag-gray'}`} style={{ fontSize:9 }}>
                      {ROLE_LABELS[u.role]||u.role}
                    </span>
                  </div>
                  {(u.active==='false'||u.active===false) &&
                    <span style={{ fontSize:10, color:'var(--accent-rose)' }}>ปิด</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* Hero */}
        <div className="card" style={{
          marginBottom:20, padding:'24px 28px',
          background:'linear-gradient(135deg,var(--bg-card),rgba(79,142,247,0.06))',
          border:'1px solid rgba(79,142,247,0.15)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:18, flexWrap:'wrap' }}>
            <div style={{
              width:64, height:64, borderRadius:'50%', flexShrink:0,
              background:'linear-gradient(135deg,var(--accent-blue),var(--accent-purple))',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:24, fontWeight:800, color:'white',
              border:'3px solid rgba(79,142,247,0.4)',
              boxShadow:'0 4px 20px rgba(79,142,247,0.3)',
            }}>{initials(currentUser)}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>
                {currentUser.displayName || `${currentUser.firstName||''} ${currentUser.lastName||''}`.trim() || currentUser.email}
                {isSelf && <span style={{ fontSize:12, color:'var(--text-muted)', marginLeft:8 }}>(คุณ)</span>}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                <span className={`tag ${ROLE_CLS[currentUser.role]||'tag-gray'}`}>
                  {ROLE_LABELS[currentUser.role]||currentUser.role}
                </span>
                {currentUser.position && <span className="tag tag-gray">{currentUser.position}</span>}
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>{currentUser.email}</span>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.8px' }}>
                เพจที่รับผิดชอบ
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, justifyContent:'flex-end', maxWidth:200 }}>
                {myPages.length>0
                  ? myPages.map(p=><span key={p.id} className="tag tag-blue" style={{ fontSize:11 }}>📄 {p.name}</span>)
                  : <span style={{ fontSize:12, color:'var(--text-muted)' }}>ยังไม่มีเพจ</span>
                }
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-surface)', padding:4, borderRadius:10, width:'fit-content', border:'1px solid var(--border)' }}>
          {[
            { id:'info',     label:'👤 ข้อมูลส่วนตัว' },
            { id:'pages',    label:'📄 เพจที่รับผิดชอบ' },
            ...(isSelf ? [{ id:'password', label:'🔑 รหัสผ่าน' }] : []),
          ].map(t=>(
            <button key={t.id} onClick={()=>{ setTab(t.id); setEditMode(false); }}
              className={`btn btn-sm ${tab===t.id?'btn-primary':'btn-ghost'}`} style={{ borderRadius:7 }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? <div className="loading-overlay"><div className="spinner"/></div> : (<>

        {/* Tab: Info */}
        {tab==='info' && (
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div className="chart-title" style={{ marginBottom:0 }}>👤 ข้อมูลส่วนตัว</div>
              {canEdit && !editMode && (
                <button className="btn btn-secondary btn-sm" onClick={()=>setEditMode(true)}>✏️ แก้ไข</button>
              )}
            </div>

            {!editMode ? (
              /* View mode */
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 24px' }}>
                {[
                  { label:'ชื่อ',        value:`${currentUser.firstName||''} ${currentUser.lastName||''}`.trim()||'—' },
                  { label:'ตำแหน่ง',    value:currentUser.position||'—' },
                  { label:'เบอร์โทร',   value:currentUser.phone||'—' },
                  { label:'Line ID',     value:currentUser.lineId||'—' },
                  { label:'อีเมล',       value:currentUser.email },
                  { label:'บทบาท',      value:ROLE_LABELS[currentUser.role]||currentUser.role },
                  { label:'สถานะ',      value:currentUser.active==='false'||currentUser.active===false?'ปิดใช้งาน':'ใช้งาน' },
                  { label:'เข้าล่าสุด', value:currentUser.lastLogin?new Date(currentUser.lastLogin).toLocaleDateString('th-TH'):'—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:3 }}>{label}</div>
                    <div style={{ fontSize:14, color:'var(--text-primary)' }}>{value}</div>
                  </div>
                ))}
                {currentUser.bio && (
                  <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:3 }}>Bio</div>
                    <div style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.6 }}>{currentUser.bio}</div>
                  </div>
                )}
              </div>
            ) : (
              /* Edit mode */
              <>
                <div className="form-grid" style={{ marginBottom:14 }}>
                  <div className="form-group">
                    <label className="form-label">ชื่อ *</label>
                    <input className="form-input" value={form.firstName}
                      onChange={e=>setForm(f=>({...f,firstName:e.target.value}))} placeholder="ชื่อจริง"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">นามสกุล</label>
                    <input className="form-input" value={form.lastName}
                      onChange={e=>setForm(f=>({...f,lastName:e.target.value}))} placeholder="นามสกุล"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">ตำแหน่ง</label>
                    <input className="form-input" value={form.position}
                      onChange={e=>setForm(f=>({...f,position:e.target.value}))} placeholder="เช่น Social Media Admin"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">เบอร์โทร</label>
                    <input className="form-input" value={form.phone}
                      onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="0812345678"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Line ID</label>
                    <input className="form-input" value={form.lineId}
                      onChange={e=>setForm(f=>({...f,lineId:e.target.value}))} placeholder="@lineid"/>
                  </div>
                  {canManage && !isSelf && (
                    <>
                      <div className="form-group">
                        <label className="form-label">บทบาท</label>
                        <select className="form-select" value={roleForm}
                          onChange={e=>setRoleForm(e.target.value)}>
                          {ROLE_OPTS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">สถานะ</label>
                        <select className="form-select" value={String(form.active)}
                          onChange={e=>setForm(f=>({...f,active:e.target.value==='true'}))}>
                          <option value="true">ใช้งาน</option>
                          <option value="false">ปิดใช้งาน</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <div className="form-group" style={{ marginBottom:18 }}>
                  <label className="form-label">Bio</label>
                  <textarea className="form-textarea" rows={3} value={form.bio}
                    onChange={e=>setForm(f=>({...f,bio:e.target.value}))}
                    placeholder="เล่าเกี่ยวกับตัวเอง..."/>
                </div>
                <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                  <button className="btn btn-ghost" onClick={()=>setEditMode(false)}>ยกเลิก</button>
                  <button className="btn btn-primary" onClick={saveInfo} disabled={saving}>
                    {saving?'⏳...':'💾 บันทึก'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab: Pages */}
        {tab==='pages' && (
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div className="chart-title" style={{ marginBottom:0 }}>📄 เพจที่รับผิดชอบ</div>
              {/* แอดมินแก้ไขตัวเองได้ / หัวหน้า-ผู้บริหารแก้ไขคนอื่นได้ */}
              {(isSelf || canManage) && !editMode && (
                <button className="btn btn-secondary btn-sm"
                  onClick={()=>{ setEditMode(true); setSelectedPages([...myPageIds]); }}>
                  ✏️ แก้ไขเพจ
                </button>
              )}
            </div>

            {!editMode ? (
              /* ── View mode ── */
              myPages.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📄</div>
                  <div className="empty-title">ยังไม่มีเพจที่รับผิดชอบ</div>
                  <div className="empty-desc">คลิก "แก้ไขเพจ" เพื่อเลือกเพจที่คุณดูแล</div>
                  <button className="btn btn-primary" style={{ marginTop:16 }}
                    onClick={()=>{ setEditMode(true); setSelectedPages([]); }}>
                    + เพิ่มเพจที่รับผิดชอบ
                  </button>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
                  {myPages.map(p => {
                    // หา note ของเพจนี้
                    const noteKey = `pageNote_${p.id}`;
                    const note = currentUser[noteKey] || '';
                    return (
                      <div key={p.id} style={{
                        background:'var(--bg-surface)', border:'1px solid var(--border)',
                        borderRadius:12, padding:20, borderLeft:'3px solid var(--accent-blue)',
                        display:'flex', flexDirection:'column', gap:10,
                      }}>
                        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                          <div style={{
                            width:44, height:44, borderRadius:10, flexShrink:0,
                            background:'linear-gradient(135deg,var(--accent-blue),var(--accent-purple))',
                            display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
                          }}>📄</div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:15 }}>{p.name}</div>
                            <div style={{ display:'flex', gap:6, marginTop:3 }}>
                              <span className="tag tag-blue" style={{ fontSize:10 }}>{p.category}</span>
                              <span className={`tag ${p.active===false||p.active==='false'?'tag-rose':'tag-green'}`} style={{ fontSize:10 }}>
                                {p.active===false||p.active==='false'?'ปิด':'เปิด'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:20 }}>
                          <div>
                            <div style={{ fontSize:20, fontWeight:700, color:'var(--accent-gold)', fontFamily:'Sora' }}>
                              {Number(p.followers||0).toLocaleString()}
                            </div>
                            <div style={{ fontSize:10, color:'var(--text-muted)' }}>Followers</div>
                          </div>
                          {p.description && (
                            <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.5 }}>
                              {p.description}
                            </div>
                          )}
                        </div>
                        {note && (
                          <div style={{
                            background:'rgba(245,200,66,0.07)', border:'1px solid rgba(245,200,66,0.2)',
                            borderRadius:8, padding:'8px 12px', fontSize:12,
                            color:'var(--text-secondary)', lineHeight:1.5,
                          }}>
                            📝 {note}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* ── Edit mode ── */
              <EditPagesForm
                pages={pages}
                currentUser={currentUser}
                selectedPages={selectedPages}
                setSelectedPages={setSelectedPages}
                isSelf={isSelf}
                canManage={canManage}
                saving={saving}
                onCancel={() => setEditMode(false)}
                onSave={(notes) => {
                  setPageNotes(notes);
                  savePages(notes);
                }}
              />
            )}
          </div>
        )}

        {/* Tab: Password (self only) */}
        {tab==='password' && isSelf && (
          <div className="card" style={{ maxWidth:460 }}>
            <div className="chart-title" style={{ marginBottom:20 }}>🔑 เปลี่ยนรหัสผ่าน</div>
            {[
              { label:'รหัสผ่านปัจจุบัน', field:'current', key:'c' },
              { label:'รหัสผ่านใหม่ (≥6 ตัว)', field:'next', key:'n' },
              { label:'ยืนยันรหัสผ่านใหม่', field:'next2', key:'n2' },
            ].map(({ label, field, key })=>(
              <div key={field} className="form-group" style={{ marginBottom:14 }}>
                <label className="form-label">{label}</label>
                <div style={{ position:'relative' }}>
                  <input className="form-input" type={showPw[key]?'text':'password'}
                    placeholder="••••••••" value={pwForm[field]}
                    style={{ paddingRight:42 }}
                    onChange={e=>setPwForm(f=>({...f,[field]:e.target.value}))}/>
                  <button type="button" onClick={()=>setShowPw(s=>({...s,[key]:!s[key]}))}
                    style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16 }}>
                    {showPw[key]?'🙈':'👁️'}
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
              <button className="btn btn-primary" onClick={savePassword} disabled={saving}>
                {saving?'⏳...':'🔐 บันทึก'}
              </button>
            </div>
          </div>
        )}

        </>)}
      </div>
    </div>
  );
}
