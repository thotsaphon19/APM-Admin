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
const DAY_OPTS = ['จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์','อาทิตย์'];

// ─────────────────────────────────────────────────────────────
// MyPagesTab — แอดมินจัดการเพจของตัวเองได้ทั้งหมด
// บันทึกลง Sheet โดยตรง (ไม่ต้องอิงเพจในระบบก่อน)
// ─────────────────────────────────────────────────────────────
function MyPagesTab({ user, toast }) {
  const [entries,    setEntries]    = useState([]); // รายการเพจของฉัน
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState(null); // null=add, obj=edit
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(null);

  const emptyForm = {
    pageName:    '',
    pageUrl:     '',
    category:    'General',
    followers:   '',
    workDays:    [],
    workHours:   '',
    duties:      '',
    notes:       '',
  };
  const [form, setForm] = useState(emptyForm);

  const CATEGORIES = ['General','ธุรกิจ','ความบันเทิง','ข่าวสาร','สุขภาพ','การศึกษา','อื่นๆ'];

  useEffect(() => { loadMyPages(); }, []); // eslint-disable-line

  async function loadMyPages() {
    setLoading(true);
    try {
      const res = await api.getMyPageEntries({ userEmail: user.email });
      setEntries(res.data || []);
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  }

  function openEdit(entry) {
    setEditing(entry);
    setForm({
      pageName:  entry.pageName  || '',
      pageUrl:   entry.pageUrl   || '',
      category:  entry.category  || 'General',
      followers: entry.followers || '',
      workDays:  entry.workDays  ? entry.workDays.split(',') : [],
      workHours: entry.workHours || '',
      duties:    entry.duties    || '',
      notes:     entry.notes     || '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.pageName.trim()) return toast.error('กรุณากรอกชื่อเพจ');
    setSaving(true);
    try {
      const payload = {
        ...form,
        workDays:   form.workDays.join(','),
        userEmail:  user.email,
        userName:   user.displayName || `${user.firstName||''} ${user.lastName||''}`.trim(),
      };
      if (editing) {
        await api.updateMyPageEntry({ ...payload, id: editing.id });
        toast.success('แก้ไขข้อมูลเพจสำเร็จ');
      } else {
        await api.addMyPageEntry(payload);
        toast.success('เพิ่มเพจสำเร็จ');
      }
      setShowForm(false);
      loadMyPages();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(entry) {
    if (!window.confirm(`ลบเพจ "${entry.pageName}" ออกจากรายการของคุณ?`)) return;
    setDeleting(entry.id);
    try {
      await api.deleteMyPageEntry(entry.id);
      toast.success('ลบสำเร็จ');
      loadMyPages();
    } catch(e) { toast.error(e.message); }
    finally { setDeleting(null); }
  }

  function toggleDay(day) {
    setForm(f => ({
      ...f,
      workDays: f.workDays.includes(day)
        ? f.workDays.filter(d => d !== day)
        : [...f.workDays, day],
    }));
  }

  if (loading) return <div className="loading-overlay"><div className="spinner"/></div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)' }}>
            📄 เพจที่ฉันรับผิดชอบ
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
            เพิ่ม แก้ไข หรือลบเพจที่คุณดูแลได้เลย
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + เพิ่มเพจ
        </button>
      </div>

      {/* Empty state */}
      {entries.length === 0 && !showForm && (
        <div className="empty-state" style={{ padding:'48px 20px' }}>
          <div className="empty-icon">📄</div>
          <div className="empty-title">ยังไม่มีเพจที่รับผิดชอบ</div>
          <div className="empty-desc">คลิก "+ เพิ่มเพจ" เพื่อกรอกข้อมูลเพจที่คุณดูแล</div>
          <button className="btn btn-primary" style={{ marginTop:16 }} onClick={openAdd}>
            + เพิ่มเพจแรก
          </button>
        </div>
      )}

      {/* Page cards */}
      {entries.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom: showForm ? 24 : 0 }}>
          {entries.map(entry => {
            const days = entry.workDays ? entry.workDays.split(',').filter(Boolean) : [];
            return (
              <div key={entry.id} style={{
                background:'white', border:'1.5px solid var(--border)',
                borderRadius:14, overflow:'hidden',
                borderLeft:'4px solid var(--brand-primary)',
                boxShadow:'var(--shadow-card)',
              }}>
                {/* Card header */}
                <div style={{ padding:'16px 20px', display:'flex', alignItems:'flex-start', gap:14 }}>
                  <div style={{
                    width:46, height:46, borderRadius:11, flexShrink:0,
                    background:'linear-gradient(135deg,var(--brand-primary),var(--brand-secondary))',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:20, boxShadow:'0 3px 10px rgba(99,102,241,0.25)',
                  }}>📄</div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:16, color:'var(--text-primary)', marginBottom:4 }}>
                      {entry.pageName}
                    </div>
                    <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center' }}>
                      <span className="tag tag-purple" style={{ fontSize:10 }}>{entry.category}</span>
                      {entry.followers && (
                        <span style={{ fontSize:12, color:'var(--text-muted)' }}>
                          👥 {Number(entry.followers).toLocaleString()} followers
                        </span>
                      )}
                      {entry.pageUrl && (
                        <a href={entry.pageUrl.startsWith('http') ? entry.pageUrl : `https://${entry.pageUrl}`}
                           target="_blank" rel="noreferrer"
                           style={{ fontSize:12, color:'var(--brand-primary)', textDecoration:'none' }}>
                          🔗 ลิงก์เพจ
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', gap:7, flexShrink:0 }}>
                    <button className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => openEdit(entry)} title="แก้ไข">✏️</button>
                    <button className="btn btn-danger btn-sm btn-icon"
                      onClick={() => handleDelete(entry)}
                      disabled={deleting === entry.id} title="ลบ">
                      {deleting === entry.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>

                {/* Details grid */}
                <div style={{
                  padding:'0 20px 16px',
                  display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 24px',
                  borderTop:'1px solid var(--border)', paddingTop:14,
                  marginTop:0,
                }}>
                  {days.length > 0 && (
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--text-muted)', marginBottom:5 }}>
                        วันที่ดูแล
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {days.map(d => (
                          <span key={d} style={{
                            padding:'2px 9px', borderRadius:20,
                            background:'rgba(99,102,241,0.1)', color:'var(--brand-primary)',
                            fontSize:11, fontWeight:600,
                            border:'1px solid rgba(99,102,241,0.2)',
                          }}>{d}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {entry.workHours && (
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--text-muted)', marginBottom:5 }}>
                        เวลาทำงาน
                      </div>
                      <div style={{ fontSize:13, color:'var(--text-primary)' }}>
                        🕐 {entry.workHours}
                      </div>
                    </div>
                  )}

                  {entry.duties && (
                    <div style={{ gridColumn:'1/-1' }}>
                      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--text-muted)', marginBottom:5 }}>
                        หน้าที่รับผิดชอบ
                      </div>
                      <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6 }}>
                        {entry.duties}
                      </div>
                    </div>
                  )}

                  {entry.notes && (
                    <div style={{ gridColumn:'1/-1' }}>
                      <div style={{
                        background:'rgba(245,158,11,0.07)',
                        border:'1px solid rgba(245,158,11,0.2)',
                        borderRadius:8, padding:'8px 12px',
                        fontSize:12, color:'var(--text-secondary)', lineHeight:1.6,
                      }}>
                        📝 {entry.notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add/Edit Form ── */}
      {showForm && (
        <div style={{
          background:'white', border:'1.5px solid var(--border-active)',
          borderRadius:16, padding:'24px 24px',
          boxShadow:'var(--shadow-md)',
          marginTop: entries.length > 0 ? 0 : 0,
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:15 }}>
              {editing ? '✏️ แก้ไขข้อมูลเพจ' : '➕ เพิ่มเพจที่รับผิดชอบ'}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕ ปิด</button>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Row 1 */}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">ชื่อเพจ *</label>
                <input className="form-input" placeholder="เช่น TJ Solution Official"
                  value={form.pageName}
                  onChange={e => setForm(f => ({ ...f, pageName: e.target.value }))}/>
              </div>
              <div className="form-group">
                <label className="form-label">หมวดหมู่</label>
                <select className="form-select" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2 */}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">ลิงก์เพจ (URL)</label>
                <input className="form-input" placeholder="https://facebook.com/yourpage"
                  value={form.pageUrl}
                  onChange={e => setForm(f => ({ ...f, pageUrl: e.target.value }))}/>
              </div>
              <div className="form-group">
                <label className="form-label">จำนวน Followers</label>
                <input className="form-input" type="number" placeholder="0"
                  value={form.followers}
                  onChange={e => setForm(f => ({ ...f, followers: e.target.value }))}/>
              </div>
            </div>

            {/* Work days */}
            <div className="form-group">
              <label className="form-label">วันที่ดูแลเพจ</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {DAY_OPTS.map(day => {
                  const sel = form.workDays.includes(day);
                  return (
                    <button key={day} type="button" onClick={() => toggleDay(day)} style={{
                      padding:'6px 14px', borderRadius:20, cursor:'pointer',
                      fontSize:12, fontWeight:600, transition:'all .15s',
                      background: sel ? 'var(--brand-primary)' : 'var(--bg-hover)',
                      color: sel ? 'white' : 'var(--text-secondary)',
                      border: `1.5px solid ${sel ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
                      boxShadow: sel ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                    }}>{day}</button>
                  );
                })}
              </div>
            </div>

            {/* Work hours */}
            <div className="form-group">
              <label className="form-label">เวลาที่ดูแล</label>
              <input className="form-input" placeholder="เช่น 09:00 - 18:00 น."
                value={form.workHours}
                onChange={e => setForm(f => ({ ...f, workHours: e.target.value }))}/>
            </div>

            {/* Duties */}
            <div className="form-group">
              <label className="form-label">หน้าที่รับผิดชอบ</label>
              <textarea className="form-textarea" rows={3}
                placeholder="เช่น ตอบข้อความลูกค้า, โพสต์คอนเทนต์รายวัน, ตรวจสอบคอมเมนต์..."
                value={form.duties}
                onChange={e => setForm(f => ({ ...f, duties: e.target.value }))}/>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">บันทึกเพิ่มเติม</label>
              <textarea className="form-textarea" rows={2}
                placeholder="ข้อมูลพิเศษ หรือสิ่งที่ต้องระวังสำหรับเพจนี้..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/>
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', paddingTop:4, borderTop:'1px solid var(--border)' }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '⏳ กำลังบันทึก...' : (editing ? '💾 บันทึกการแก้ไข' : '➕ เพิ่มเพจ')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main ProfilePage
// ─────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth();
  const { load: reloadNotif } = useNotif();
  const { toasts, remove, toast } = useToast();
  const canManage = user?.role === 'executive' || user?.role === 'head';

  const [viewMode,  setViewMode]  = useState('me');
  const [adminList, setAdminList] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [tab,       setTab]       = useState('info');
  const [editMode,  setEditMode]  = useState(false);

  const [form,   setForm]   = useState({ firstName:'', lastName:'', phone:'', lineId:'', position:'', bio:'' });
  const [roleForm, setRoleForm] = useState('admin');
  const [pwForm, setPwForm] = useState({ current:'', next:'', next2:'' });
  const [showPw, setShowPw] = useState({ c:false, n:false, n2:false });

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.getAdminProfiles();
      const all = res.data || [];
      setAdminList(all);
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
  }

  function selectAdmin(email) {
    setViewMode(email); setEditMode(false); setTab('info');
    const u = adminList.find(a => a.email === email);
    if (u) initForm(u);
  }

  function selectMe() {
    setViewMode('me'); setEditMode(false); setTab('info');
    const me = adminList.find(u => u.email === user.email) || user;
    initForm(me);
  }

  const currentUser = viewMode === 'me'
    ? (adminList.find(u => u.email === user.email) || user)
    : (adminList.find(u => u.email === viewMode) || {});

  const isSelf = viewMode === 'me' || viewMode === user.email;

  async function saveInfo() {
    setSaving(true);
    try {
      if (isSelf) {
        await api.updateProfile({ email: user.email, ...form });
      } else {
        await api.updateAdminProfile({
          targetEmail: currentUser.email, requesterRole: user.role,
          requesterEmail: user.email, requesterName: user.displayName || user.email,
          ...form, role: roleForm,
        });
        reloadNotif();
      }
      toast.success('บันทึกสำเร็จ');
      setEditMode(false); loadData();
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

  const initials = n => (n?.displayName || n?.email || '?').charAt(0).toUpperCase();

  const tabs = [
    { id:'info',     label:'👤 ข้อมูลส่วนตัว' },
    { id:'pages',    label:'📄 เพจที่รับผิดชอบ' },
    ...(isSelf ? [{ id:'password', label:'🔑 รหัสผ่าน' }] : []),
  ];

  return (
    <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
      <ToastContainer toasts={toasts} removeToast={remove}/>

      {/* ── Manager sidebar ── */}
      {canManage && (
        <div style={{ width:220, flexShrink:0 }}>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'13px 16px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:13 }}>
              👥 ทีมแอดมิน
            </div>
            <div style={{ maxHeight:500, overflowY:'auto' }}>
              {/* Me */}
              <SidebarUserItem u={user} active={viewMode==='me'} label="คุณ" onClick={selectMe} initials={initials(user)}/>
              {adminList.filter(u => u.email !== user.email).map(u => (
                <SidebarUserItem key={u.email} u={u} active={viewMode===u.email}
                  onClick={() => selectAdmin(u.email)} initials={initials(u)}/>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* Hero card */}
        <div className="card" style={{
          marginBottom:20, padding:'22px 26px',
          background:'linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%)',
          border:'1px solid rgba(99,102,241,0.18)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <div style={{
              width:62, height:62, borderRadius:'50%', flexShrink:0,
              background:'linear-gradient(135deg,var(--brand-primary),var(--brand-secondary))',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:24, fontWeight:800, color:'white',
              border:'3px solid rgba(99,102,241,0.3)',
              boxShadow:'0 4px 18px rgba(99,102,241,0.28)',
            }}>{initials(currentUser)}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:19, fontWeight:800, marginBottom:4, color:'var(--text-primary)' }}>
                {currentUser.displayName || `${currentUser.firstName||''} ${currentUser.lastName||''}`.trim() || currentUser.email}
                {isSelf && <span style={{ fontSize:12, color:'var(--text-muted)', marginLeft:8, fontWeight:400 }}>(คุณ)</span>}
              </div>
              <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center' }}>
                <span className={`tag ${ROLE_CLS[currentUser.role]||'tag-gray'}`}>
                  {ROLE_LABELS[currentUser.role]||currentUser.role}
                </span>
                {currentUser.position && <span className="tag tag-gray">{currentUser.position}</span>}
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>{currentUser.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display:'flex', gap:4, marginBottom:20,
          background:'var(--bg-hover)', padding:4,
          borderRadius:12, width:'fit-content',
          border:'1px solid var(--border)',
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setEditMode(false); }}
              className={`btn btn-sm ${tab===t.id?'btn-primary':'btn-ghost'}`}
              style={{ borderRadius:9 }}>
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
                {!editMode && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(true)}>✏️ แก้ไข</button>
                )}
              </div>
              {!editMode ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 28px' }}>
                  {[
                    { label:'ชื่อ-นามสกุล', value:`${currentUser.firstName||''} ${currentUser.lastName||''}`.trim()||'—' },
                    { label:'ตำแหน่ง',      value: currentUser.position||'—' },
                    { label:'เบอร์โทร',      value: currentUser.phone||'—' },
                    { label:'Line ID',        value: currentUser.lineId||'—' },
                    { label:'อีเมล',          value: currentUser.email },
                    { label:'บทบาท',         value: ROLE_LABELS[currentUser.role]||currentUser.role },
                    { label:'เข้าล่าสุด',    value: currentUser.lastLogin?new Date(currentUser.lastLogin).toLocaleDateString('th-TH'):'—' },
                    { label:'สถานะ',         value: currentUser.active==='false'||currentUser.active===false?'ปิดใช้งาน':'ใช้งาน' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:3, fontWeight:600 }}>{label}</div>
                      <div style={{ fontSize:14, color:'var(--text-primary)' }}>{value}</div>
                    </div>
                  ))}
                  {currentUser.bio && (
                    <div style={{ gridColumn:'1/-1' }}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:5, fontWeight:600 }}>Bio</div>
                      <div style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.7 }}>{currentUser.bio}</div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="form-grid" style={{ marginBottom:14 }}>
                    <div className="form-group">
                      <label className="form-label">ชื่อ *</label>
                      <input className="form-input" value={form.firstName} placeholder="ชื่อจริง"
                        onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">นามสกุล</label>
                      <input className="form-input" value={form.lastName} placeholder="นามสกุล"
                        onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">ตำแหน่ง</label>
                      <input className="form-input" value={form.position} placeholder="เช่น Social Media Admin"
                        onChange={e => setForm(f => ({ ...f, position: e.target.value }))}/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">เบอร์โทร</label>
                      <input className="form-input" value={form.phone} placeholder="0812345678"
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Line ID</label>
                      <input className="form-input" value={form.lineId} placeholder="@lineid"
                        onChange={e => setForm(f => ({ ...f, lineId: e.target.value }))}/>
                    </div>
                    {canManage && !isSelf && (
                      <div className="form-group">
                        <label className="form-label">บทบาท</label>
                        <select className="form-select" value={roleForm}
                          onChange={e => setRoleForm(e.target.value)}>
                          {ROLE_OPTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="form-group" style={{ marginBottom:18 }}>
                    <label className="form-label">Bio / แนะนำตัว</label>
                    <textarea className="form-textarea" rows={3} value={form.bio}
                      placeholder="เล่าเกี่ยวกับตัวเอง..."
                      onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}/>
                  </div>
                  <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                    <button className="btn btn-ghost" onClick={() => setEditMode(false)}>ยกเลิก</button>
                    <button className="btn btn-primary" onClick={saveInfo} disabled={saving}>
                      {saving ? '⏳...' : '💾 บันทึก'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab: My Pages — แอดมินจัดการเองทั้งหมด */}
          {tab==='pages' && (
            <div className="card">
              <MyPagesTab user={isSelf ? user : currentUser} toast={toast}/>
            </div>
          )}

          {/* Tab: Password */}
          {tab==='password' && isSelf && (
            <div className="card" style={{ maxWidth:460 }}>
              <div className="chart-title" style={{ marginBottom:20 }}>🔑 เปลี่ยนรหัสผ่าน</div>
              {[
                { label:'รหัสผ่านปัจจุบัน', field:'current', key:'c' },
                { label:'รหัสผ่านใหม่ (≥6 ตัว)', field:'next', key:'n' },
                { label:'ยืนยันรหัสผ่านใหม่', field:'next2', key:'n2' },
              ].map(({ label, field, key }) => (
                <div key={field} className="form-group" style={{ marginBottom:14 }}>
                  <label className="form-label">{label}</label>
                  <div style={{ position:'relative' }}>
                    <input className="form-input" type={showPw[key] ? 'text' : 'password'}
                      placeholder="••••••••" value={pwForm[field]}
                      style={{ paddingRight:42 }}
                      onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}/>
                    <button type="button" onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                      style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                               background:'none',border:'none',cursor:'pointer',fontSize:16 }}>
                      {showPw[key] ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
                <button className="btn btn-primary" onClick={savePassword} disabled={saving}>
                  {saving ? '⏳...' : '🔐 บันทึก'}
                </button>
              </div>
            </div>
          )}

        </>)}
      </div>
    </div>
  );
}

// ── small helper ─────────────────────────────────────────────
function SidebarUserItem({ u, active, label, onClick, initials }) {
  return (
    <div onClick={onClick} style={{
      padding:'11px 16px', cursor:'pointer',
      display:'flex', gap:10, alignItems:'center',
      background: active ? 'var(--bg-active)' : 'transparent',
      borderBottom:'1px solid rgba(99,102,241,0.05)',
      transition:'background .15s',
    }}>
      <div className="user-avatar-placeholder" style={{ width:30, height:30, fontSize:12, flexShrink:0 }}>
        {initials}
      </div>
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text-primary)' }}>
          {u?.displayName || u?.email}
        </div>
        {label
          ? <div style={{ fontSize:10, color:'var(--brand-primary)', fontWeight:600 }}>{label}</div>
          : <span className={`tag ${u?.role==='executive'?'tag-gold':u?.role==='head'?'tag-blue':'tag-green'}`} style={{ fontSize:9 }}>
              {u?.role==='executive'?'ผู้บริหาร':u?.role==='head'?'หัวหน้า':'แอดมิน'}
            </span>
        }
      </div>
      {(u?.active==='false'||u?.active===false) &&
        <span style={{ fontSize:10, color:'var(--accent-rose)' }}>ปิด</span>}
    </div>
  );
}
