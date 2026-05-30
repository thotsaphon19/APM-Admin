// src/pages/TeamOverviewPage.js
import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { ToastContainer, useToast } from '../components/Toast';

const DAY_OPTS    = ['จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์','อาทิตย์'];
const CATEGORIES  = ['General','ธุรกิจ','ความบันเทิง','ข่าวสาร','สุขภาพ','การศึกษา','อื่นๆ'];

export default function TeamOverviewPage() {
  const { user } = useAuth();
  const { toasts, remove, toast } = useToast();

  const [adminList,  setAdminList]  = useState([]);
  const [allPages,   setAllPages]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [expanding,  setExpanding]  = useState({});
  const [editTarget, setEditTarget] = useState(null);
  const [editForm,   setEditForm]   = useState({});
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(null);
  const [addTarget,  setAddTarget]  = useState(null); // admin to add page for
  const [addForm,    setAddForm]    = useState({});
  const [addSaving,  setAddSaving]  = useState(false);

  const emptyAddForm = {
    pageName:'', pageUrl:'', category:'General',
    followers:'', workDays:[], workHours:'', duties:'', notes:'',
  };

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  async function loadAll() {
    setLoading(true);
    try {
      const [pRes, aRes] = await Promise.all([
        api.getMyPageEntries({}),
        api.getAdminProfiles(),
      ]);
      setAllPages(pRes.data || []);
      setAdminList(aRes.data || []);
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  // จับคู่ admin กับ pages
  const adminWithPages = adminList.map(admin => ({
    ...admin,
    pages: allPages.filter(p => p.userEmail === admin.email),
  })).filter(a =>
    !search ||
    (a.displayName||a.email||'').toLowerCase().includes(search.toLowerCase()) ||
    a.pages.some(p => (p.pageName||'').toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages  = allPages.length;
  const withPages   = adminList.filter(a => allPages.some(p => p.userEmail === a.email)).length;
  const avgPages    = adminList.length ? (totalPages / adminList.length).toFixed(1) : 0;

  function toggleExpand(email) {
    setExpanding(e => ({ ...e, [email]: !(e[email] !== false) }));
  }
  const isExpanded = (email) => expanding[email] !== false;

  // ── Edit ──
  function openEdit(entry) {
    const days = entry.workDays ? entry.workDays.split(',').filter(Boolean) : [];
    setEditTarget(entry);
    setEditForm({ ...entry, workDays: days });
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api.updateMyPageEntry({
        ...editForm,
        id: editTarget.id,
        workDays:  Array.isArray(editForm.workDays) ? editForm.workDays.join(',') : (editForm.workDays||''),
        followers: Number(editForm.followers) || 0,
      });
      toast.success('แก้ไขสำเร็จ');
      setEditTarget(null);
      loadAll();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  // ── Delete ──
  async function handleDelete(entry) {
    if (!window.confirm(`ลบเพจ "${entry.pageName}" ของ ${entry.userName}?`)) return;
    setDeleting(entry.id);
    try {
      await api.deleteMyPageEntry(entry.id);
      toast.success('ลบสำเร็จ');
      loadAll();
    } catch(e) { toast.error(e.message); }
    finally { setDeleting(null); }
  }

  // ── Add page for admin ──
  function openAdd(admin) {
    setAddTarget(admin);
    setAddForm({ ...emptyAddForm });
  }

  async function saveAdd() {
    if (!addForm.pageName.trim()) return toast.error('กรุณากรอกชื่อเพจ');
    setAddSaving(true);
    try {
      await api.addMyPageEntry({
        ...addForm,
        workDays:  addForm.workDays.join(','),
        followers: Number(addForm.followers) || 0,
        userEmail: addTarget.email,
        userName:  addTarget.displayName || `${addTarget.firstName||''} ${addTarget.lastName||''}`.trim() || addTarget.email,
      });
      toast.success(`เพิ่มเพจให้ ${addTarget.displayName || addTarget.email} สำเร็จ`);
      setAddTarget(null);
      loadAll();
    } catch(e) { toast.error(e.message); }
    finally { setAddSaving(false); }
  }

  function toggleDay(day, form, setForm) {
    setForm(f => ({
      ...f,
      workDays: f.workDays.includes(day)
        ? f.workDays.filter(d => d !== day)
        : [...f.workDays, day],
    }));
  }

  function toggleEditDay(day) {
    const cur = Array.isArray(editForm.workDays) ? editForm.workDays : (editForm.workDays||'').split(',').filter(Boolean);
    const sel = cur.includes(day);
    setEditForm(f => ({ ...f, workDays: sel ? cur.filter(d=>d!==day) : [...cur, day] }));
  }

  const initials = u => (u?.displayName || u?.email || '?').charAt(0).toUpperCase();

  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={remove}/>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom:24 }}>
        {[
          { icon:'👥', label:'แอดมินทั้งหมด',    value: adminList.length, color:'#6366f1' },
          { icon:'📄', label:'เพจรวมทั้งหมด',    value: totalPages,       color:'#8b5cf6' },
          { icon:'✅', label:'แอดมินที่มีเพจ',   value: withPages,        color:'#10b981' },
          { icon:'📋', label:'เพจเฉลี่ยต่อคน',  value: avgPages,         color:'#f59e0b' },
        ].map((s,i) => (
          <div key={i} className="stat-card" style={{ '--accent-color': s.color }}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search + Expand all */}
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:18, flexWrap:'wrap' }}>
        <input className="form-input" style={{ maxWidth:340 }}
          placeholder="🔍 ค้นหาแอดมินหรือชื่อเพจ..."
          value={search} onChange={e => setSearch(e.target.value)}/>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          const allExpanded = adminWithPages.every(a => isExpanded(a.email));
          const newState = {};
          adminWithPages.forEach(a => { newState[a.email] = !allExpanded; });
          setExpanding(newState);
        }}>
          {adminWithPages.every(a => isExpanded(a.email)) ? '▲ ย่อทั้งหมด' : '▼ ขยายทั้งหมด'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={loadAll}>🔄 รีเฟรช</button>
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner"/></div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {adminWithPages.map(admin => {
            const expanded = isExpanded(admin.email);
            return (
              <div key={admin.email} className="card" style={{ padding:0, overflow:'hidden' }}>
                {/* Header */}
                <div style={{
                  padding:'14px 20px', display:'flex', alignItems:'center', gap:12,
                  cursor:'pointer', transition:'background .15s',
                  background: expanded ? 'rgba(99,102,241,0.03)' : 'white',
                  borderBottom: expanded ? '1px solid var(--border)' : 'none',
                }}>
                  {/* Avatar */}
                  <div onClick={() => toggleExpand(admin.email)}
                    style={{ display:'flex', alignItems:'center', gap:12, flex:1 }}>
                    <div className="user-avatar-placeholder"
                      style={{ width:40, height:40, fontSize:16, flexShrink:0 }}>
                      {initials(admin)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)' }}>
                        {admin.displayName || `${admin.firstName||''} ${admin.lastName||''}`.trim() || admin.email}
                      </div>
                      <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:2 }}>
                        <span className={`tag ${admin.role==='executive'?'tag-gold':admin.role==='head'?'tag-blue':'tag-green'}`}
                          style={{ fontSize:9 }}>
                          {admin.role==='executive'?'ผู้บริหาร':admin.role==='head'?'หัวหน้า':'แอดมิน'}
                        </span>
                        {admin.position && <span style={{ fontSize:11, color:'var(--text-muted)' }}>{admin.position}</span>}
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>{admin.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: page count + add button */}
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                    <button className="btn btn-primary btn-sm"
                      onClick={e => { e.stopPropagation(); openAdd(admin); }}>
                      + เพิ่มเพจ
                    </button>
                    <div onClick={() => toggleExpand(admin.email)}
                      style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                      <span style={{
                        background: admin.pages.length > 0 ? 'rgba(99,102,241,0.1)' : 'var(--bg-hover)',
                        color: admin.pages.length > 0 ? 'var(--brand-primary)' : 'var(--text-muted)',
                        fontSize:12, fontWeight:700, padding:'3px 12px', borderRadius:20,
                        border:`1px solid ${admin.pages.length>0?'rgba(99,102,241,0.2)':'var(--border)'}`,
                      }}>{admin.pages.length} เพจ</span>
                      <span style={{ color:'var(--text-muted)', fontSize:13 }}>{expanded?'▲':'▼'}</span>
                    </div>
                  </div>
                </div>

                {/* Pages */}
                {expanded && (
                  <div style={{ padding:'16px 20px', background:'var(--bg-hover)' }}>
                    {admin.pages.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'18px', color:'var(--text-muted)', fontSize:13 }}>
                        ยังไม่มีเพจที่บันทึกไว้ — กด "+ เพิ่มเพจ" เพื่อเพิ่ม
                      </div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:12 }}>
                        {admin.pages.map(entry => {
                          const days = entry.workDays ? entry.workDays.split(',').filter(Boolean) : [];
                          return (
                            <div key={entry.id} style={{
                              background:'white', border:'1px solid var(--border)',
                              borderRadius:12, padding:'14px 16px',
                              borderLeft:'3px solid var(--brand-primary)',
                              boxShadow:'var(--shadow-card)',
                            }}>
                              {/* Card header */}
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                                <div style={{ fontWeight:700, fontSize:13.5, color:'var(--text-primary)', flex:1, paddingRight:8 }}>
                                  📄 {entry.pageName}
                                </div>
                                <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                                  <button className="btn btn-ghost btn-sm btn-icon"
                                    onClick={() => openEdit(entry)} title="แก้ไข"
                                    style={{ padding:'4px 7px' }}>✏️</button>
                                  <button className="btn btn-danger btn-sm btn-icon"
                                    onClick={() => handleDelete(entry)}
                                    disabled={deleting === entry.id}
                                    style={{ padding:'4px 7px' }}>
                                    {deleting === entry.id ? '⏳' : '🗑️'}
                                  </button>
                                </div>
                              </div>

                              {/* Tags */}
                              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
                                <span className="tag tag-purple" style={{ fontSize:9 }}>{entry.category}</span>
                                {entry.followers > 0 && (
                                  <span style={{ fontSize:10, color:'var(--text-muted)' }}>
                                    👥 {Number(entry.followers).toLocaleString()}
                                  </span>
                                )}
                                {entry.pageUrl && (
                                  <a href={entry.pageUrl.startsWith('http')?entry.pageUrl:`https://${entry.pageUrl}`}
                                     target="_blank" rel="noreferrer"
                                     style={{ fontSize:10, color:'var(--brand-primary)', textDecoration:'none' }}>
                                    🔗 ลิงก์
                                  </a>
                                )}
                              </div>

                              {/* Days + Hours */}
                              {days.length > 0 && (
                                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:5 }}>
                                  📅 {days.join(', ')}
                                  {entry.workHours && <span> · 🕐 {entry.workHours}</span>}
                                </div>
                              )}

                              {/* Duties */}
                              {entry.duties && (
                                <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.55 }}>
                                  {entry.duties}
                                </div>
                              )}

                              {/* Notes */}
                              {entry.notes && (
                                <div style={{
                                  marginTop:8, background:'rgba(245,158,11,0.07)',
                                  border:'1px solid rgba(245,158,11,0.2)',
                                  borderRadius:7, padding:'6px 10px',
                                  fontSize:11, color:'var(--text-secondary)',
                                }}>📝 {entry.notes}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {adminWithPages.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-title">ไม่พบผลลัพธ์</div>
              <div className="empty-desc">ลองเปลี่ยนคำค้นหาครับ</div>
            </div>
          )}
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setEditTarget(null)}>
          <div className="modal" style={{ maxWidth:540 }}>
            <div className="modal-header">
              <div className="modal-title">✏️ แก้ไขเพจ — {editTarget.userName}</div>
              <button className="modal-close" onClick={() => setEditTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">ชื่อเพจ *</label>
                  <input className="form-input" value={editForm.pageName||''}
                    onChange={e => setEditForm(f=>({...f,pageName:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">หมวดหมู่</label>
                  <select className="form-select" value={editForm.category||'General'}
                    onChange={e => setEditForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">ลิงก์เพจ</label>
                  <input className="form-input" value={editForm.pageUrl||''}
                    onChange={e => setEditForm(f=>({...f,pageUrl:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Followers</label>
                  <input type="number" className="form-input" value={editForm.followers||''}
                    onChange={e => setEditForm(f=>({...f,followers:e.target.value}))}/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">วันที่ดูแล</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {DAY_OPTS.map(day => {
                    const cur = Array.isArray(editForm.workDays) ? editForm.workDays : (editForm.workDays||'').split(',').filter(Boolean);
                    const sel = cur.includes(day);
                    return (
                      <button key={day} type="button" onClick={() => toggleEditDay(day)} style={{
                        padding:'5px 13px', borderRadius:20, cursor:'pointer',
                        fontSize:12, fontWeight:600, transition:'all .15s',
                        background: sel?'var(--brand-primary)':'var(--bg-hover)',
                        color: sel?'white':'var(--text-secondary)',
                        border:`1.5px solid ${sel?'var(--brand-primary)':'var(--border-strong)'}`,
                      }}>{day}</button>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">เวลาที่ดูแล</label>
                <input className="form-input" placeholder="09:00 - 18:00" value={editForm.workHours||''}
                  onChange={e => setEditForm(f=>({...f,workHours:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">หน้าที่รับผิดชอบ</label>
                <textarea className="form-textarea" rows={3} value={editForm.duties||''}
                  onChange={e => setEditForm(f=>({...f,duties:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">บันทึกเพิ่มเติม</label>
                <textarea className="form-textarea" rows={2} value={editForm.notes||''}
                  onChange={e => setEditForm(f=>({...f,notes:e.target.value}))}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditTarget(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving?'⏳...':'💾 บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Page Modal ── */}
      {addTarget && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setAddTarget(null)}>
          <div className="modal" style={{ maxWidth:540 }}>
            <div className="modal-header">
              <div className="modal-title">
                ➕ เพิ่มเพจให้ {addTarget.displayName || addTarget.email}
              </div>
              <button className="modal-close" onClick={() => setAddTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">ชื่อเพจ *</label>
                  <input className="form-input" placeholder="เช่น TJ Solution Official"
                    value={addForm.pageName}
                    onChange={e => setAddForm(f=>({...f,pageName:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">หมวดหมู่</label>
                  <select className="form-select" value={addForm.category}
                    onChange={e => setAddForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">ลิงก์เพจ</label>
                  <input className="form-input" placeholder="https://facebook.com/page"
                    value={addForm.pageUrl}
                    onChange={e => setAddForm(f=>({...f,pageUrl:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Followers</label>
                  <input type="number" className="form-input" placeholder="0"
                    value={addForm.followers}
                    onChange={e => setAddForm(f=>({...f,followers:e.target.value}))}/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">วันที่ดูแล</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {DAY_OPTS.map(day => {
                    const sel = addForm.workDays.includes(day);
                    return (
                      <button key={day} type="button"
                        onClick={() => toggleDay(day, addForm, setAddForm)} style={{
                          padding:'5px 13px', borderRadius:20, cursor:'pointer',
                          fontSize:12, fontWeight:600, transition:'all .15s',
                          background: sel?'var(--brand-primary)':'var(--bg-hover)',
                          color: sel?'white':'var(--text-secondary)',
                          border:`1.5px solid ${sel?'var(--brand-primary)':'var(--border-strong)'}`,
                        }}>{day}</button>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">เวลาที่ดูแล</label>
                <input className="form-input" placeholder="09:00 - 18:00"
                  value={addForm.workHours}
                  onChange={e => setAddForm(f=>({...f,workHours:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">หน้าที่รับผิดชอบ</label>
                <textarea className="form-textarea" rows={3}
                  placeholder="เช่น ตอบข้อความ โพสต์คอนเทนต์..."
                  value={addForm.duties}
                  onChange={e => setAddForm(f=>({...f,duties:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">บันทึกเพิ่มเติม</label>
                <textarea className="form-textarea" rows={2}
                  placeholder="ข้อมูลพิเศษ..."
                  value={addForm.notes}
                  onChange={e => setAddForm(f=>({...f,notes:e.target.value}))}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAddTarget(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={saveAdd} disabled={addSaving}>
                {addSaving?'⏳...':'➕ เพิ่มเพจ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
