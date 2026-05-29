// src/pages/UsersPage.js
import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { ToastContainer, useToast } from '../components/Toast';

const ROLE_OPTS = [
  { value: 'executive', label: 'ผู้บริหาร', cls: 'tag-gold'   },
  { value: 'head',      label: 'หัวหน้า',   cls: 'tag-blue'   },
  { value: 'admin',     label: 'แอดมิน',    cls: 'tag-green'  },
];
const roleInfo = r => ROLE_OPTS.find(x => x.value === r) || { label: r, cls: 'tag-gray' };

export default function UsersPage() {
  const { user: me, isExecutive } = useAuth();
  const { toasts, remove, toast } = useToast();
  const [users,  setUsers]  = useState([]);
  const [pages,  setPages]  = useState([]);
  const [search, setSearch] = useState('');
  const [loading,setLoading]= useState(true);
  const [modal,  setModal]  = useState(null); // null | 'add' | 'edit' | 'password' | 'verify'
  const [editing,setEditing]= useState(null);
  const [form,   setForm]   = useState({});
  const [showNP, setShowNP] = useState(false);
  const [showNP2,setShowNP2]= useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [uR, pR] = await Promise.all([api.getUsers(), api.getPages()]);
      setUsers(uR.data || []);
      setPages((pR.data || []).filter(p => p.active !== false && p.active !== 'false' && p.active !== 'FALSE'));
    } catch(e){ toast.error(e.message); }
    finally{ setLoading(false); }
  }

  // ── open modals ──────────────────────────────────────────
  function openAdd() {
    setEditing(null);
    setForm({ firstName:'', lastName:'', email:'', role:'admin', pages:[], password:'', password2:'' });
    setModal('add');
  }
  function openEdit(u) {
    setEditing(u);
    let pg = [];
    try{ pg = typeof u.pages==='string' ? JSON.parse(u.pages) : (u.pages||[]); }catch{}
    setForm({ ...u, pages: pg, newPassword:'', newPassword2:'' });
    setModal('edit');
  }
  function openChangePW(u) {
    setEditing(u);
    setForm({ newPassword:'', newPassword2:'' });
    setModal('password');
  }

  // ── save ─────────────────────────────────────────────────
  async function saveAdd() {
    const { firstName, email, password, password2, role, pages: pg } = form;
    if (!firstName || !email || !password) return toast.error('กรุณากรอกข้อมูลที่จำเป็น');
    if (password !== password2) return toast.error('รหัสผ่านไม่ตรงกัน');
    if (password.length < 6)   return toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    try {
      await api.addUser({ ...form, createdBy: me?.email });
      toast.success('เพิ่มผู้ใช้สำเร็จ — ระบบส่ง OTP ยืนยันอีเมลให้แล้ว');
      setModal(null); loadAll();
    } catch(e){ toast.error(e.message); }
  }

  async function saveEdit() {
    try {
      await api.updateUser({ ...form, pages: form.pages });
      toast.success('แก้ไขข้อมูลสำเร็จ');
      setModal(null); loadAll();
    } catch(e){ toast.error(e.message); }
  }

  async function savePassword() {
    const { newPassword, newPassword2 } = form;
    if (newPassword.length < 6)    return toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    if (newPassword !== newPassword2) return toast.error('รหัสผ่านไม่ตรงกัน');
    try {
      await api.updateUser({ email: editing.email, newPassword });
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      setModal(null);
    } catch(e){ toast.error(e.message); }
  }

  async function handleDelete(u) {
    if (u.email === me?.email) return toast.error('ไม่สามารถลบบัญชีตัวเองได้');
    if (!window.confirm(`ลบผู้ใช้ ${u.displayName || u.email} ?`)) return;
    try {
      await api.deleteUser(u.email);
      toast.success('ลบผู้ใช้สำเร็จ');
      loadAll();
    } catch(e){ toast.error(e.message); }
  }

  async function handleRoleChange(u, newRole) {
    try {
      await api.updateUserRole({ email: u.email, role: newRole });
      toast.success('เปลี่ยนสิทธิ์สำเร็จ');
      loadAll();
    } catch(e){ toast.error(e.message); }
  }

  async function resendVerify(u) {
    try {
      await api.sendVerifyEmail({ email: u.email, type: 'verify' });
      toast.success('ส่ง OTP ยืนยันอีเมลแล้ว');
    } catch(e){ toast.error(e.message); }
  }

  function togglePage(id) {
    setForm(f => ({
      ...f,
      pages: f.pages.includes(id) ? f.pages.filter(p=>p!==id) : [...f.pages, id]
    }));
  }

  const filtered = users.filter(u =>
    (u.email||'').toLowerCase().includes(search.toLowerCase()) ||
    (u.displayName||'').toLowerCase().includes(search.toLowerCase()) ||
    (u.firstName||'').toLowerCase().includes(search.toLowerCase())
  );

  // ── password field helper ────────────────────────────────
  function PwField({ label, field, show, setShow }) {
    return (
      <div className="form-group">
        <label className="form-label">{label}</label>
        <div style={{ position:'relative' }}>
          <input
            className="form-input"
            type={show ? 'text' : 'password'}
            placeholder="อย่างน้อย 6 ตัวอักษร"
            value={form[field]||''}
            onChange={e => setForm(f=>({...f,[field]:e.target.value}))}
            style={{ paddingRight: 40 }}
          />
          <button type="button" onClick={()=>setShow(s=>!s)}
            style={{ position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16 }}>
            {show?'🙈':'👁️'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={remove}/>

      <div className="page-header">
        <div>
          <div className="page-header-title">จัดการผู้ใช้</div>
          <div className="page-header-sub">ผู้ใช้ทั้งหมด {users.length} คน</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ เพิ่มผู้ใช้</button>
      </div>

      <div className="card" style={{ marginBottom:18 }}>
        <input className="form-input" style={{ maxWidth:340 }}
          placeholder="🔍 ค้นหาชื่อหรืออีเมล..." value={search}
          onChange={e=>setSearch(e.target.value)}/>
      </div>

      <div className="card">
        {loading
          ? <div className="loading-overlay"><div className="spinner"/></div>
          : filtered.length === 0
            ? <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-title">ไม่พบผู้ใช้</div></div>
            : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ผู้ใช้</th>
                  <th>อีเมล</th>
                  <th>สิทธิ์</th>
                  <th>ยืนยันอีเมล</th>
                  <th>เพจ</th>
                  <th>เข้าล่าสุด</th>
                  <th>สถานะ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  let pg = [];
                  try{ pg = typeof u.pages==='string'?JSON.parse(u.pages):(u.pages||[]); }catch{}
                  const ri = roleInfo(u.role);
                  const verified = u.emailVerified==='true'||u.emailVerified===true||u.emailVerified==='TRUE';
                  return (
                    <tr key={u.email}>
                      <td>
                        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                          <div className="user-avatar-placeholder" style={{ width:34,height:34,fontSize:13,flexShrink:0 }}>
                            {(u.displayName||u.email||'?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight:600,fontSize:13 }}>
                              {u.displayName || `${u.firstName||''} ${u.lastName||''}`.trim()}
                            </div>
                            {u.email===me?.email && <span className="tag tag-gold" style={{fontSize:9}}>คุณ</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize:13,color:'var(--text-secondary)' }}>{u.email}</td>
                      <td>
                        {isExecutive && u.email!==me?.email
                          ? <select className="form-select" style={{ width:110,padding:'4px 8px',fontSize:12 }}
                              value={u.role} onChange={e=>handleRoleChange(u,e.target.value)}>
                              {ROLE_OPTS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          : <span className={`tag ${ri.cls}`}>{ri.label}</span>
                        }
                      </td>
                      <td>
                        {verified
                          ? <span className="tag tag-green">✅ ยืนยันแล้ว</span>
                          : (
                            <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                              <span className="tag tag-rose">⏳ รอยืนยัน</span>
                              <button className="btn btn-ghost btn-sm" style={{ fontSize:11,padding:'3px 8px' }}
                                onClick={()=>resendVerify(u)} title="ส่ง OTP ใหม่">📧</button>
                            </div>
                          )
                        }
                      </td>
                      <td>
                        <div style={{ display:'flex',flexWrap:'wrap',gap:3 }}>
                          {pg.slice(0,3).map(pid=>{
                            const p=pages.find(x=>x.id===pid);
                            return p?<span key={pid} className="tag tag-blue" style={{fontSize:10}}>{p.name}</span>:null;
                          })}
                          {pg.length>3&&<span className="tag tag-gray" style={{fontSize:10}}>+{pg.length-3}</span>}
                          {pg.length===0&&<span style={{fontSize:12,color:'var(--text-muted)'}}>—</span>}
                        </div>
                      </td>
                      <td style={{ fontSize:12,color:'var(--text-muted)' }}>
                        {u.lastLogin?new Date(u.lastLogin).toLocaleDateString('th-TH'):'ยังไม่เคย'}
                      </td>
                      <td>
                        <span className={`tag ${u.active==='false'||u.active===false?'tag-rose':'tag-green'}`}>
                          {u.active==='false'||u.active===false?'ปิด':'เปิด'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display:'flex',gap:5 }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>openEdit(u)} title="แก้ไข">✏️</button>
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={()=>openChangePW(u)} title="เปลี่ยนรหัสผ่าน">🔑</button>
                          {isExecutive && u.email!==me?.email &&
                            <button className="btn btn-danger btn-sm btn-icon" onClick={()=>handleDelete(u)} title="ลบ">🗑️</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Add User ── */}
      {modal==='add' && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">➕ เพิ่มผู้ใช้ใหม่</div>
              <button className="modal-close" onClick={()=>setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">ชื่อ *</label>
                  <input className="form-input" placeholder="ชื่อจริง" value={form.firstName||''}
                    onChange={e=>setForm(f=>({...f,firstName:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">นามสกุล</label>
                  <input className="form-input" placeholder="นามสกุล" value={form.lastName||''}
                    onChange={e=>setForm(f=>({...f,lastName:e.target.value}))}/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">อีเมล * <span style={{color:'var(--text-muted)',fontWeight:400,textTransform:'none',letterSpacing:0}}>(ใช้ login + รับ OTP)</span></label>
                <input className="form-input" type="email" placeholder="user@example.com"
                  value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">บทบาท</label>
                <select className="form-select" value={form.role||'admin'}
                  onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  {ROLE_OPTS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <PwField label="รหัสผ่านเริ่มต้น *" field="password" show={showNP} setShow={setShowNP}/>
              <PwField label="ยืนยันรหัสผ่าน *" field="password2" show={showNP2} setShow={setShowNP2}/>
              <div className="form-group">
                <label className="form-label">เพจที่รับผิดชอบ</label>
                <div style={{ display:'flex',flexWrap:'wrap',gap:7 }}>
                  {pages.map(p=>(
                    <label key={p.id} style={{
                      display:'flex',alignItems:'center',gap:6,cursor:'pointer',
                      padding:'6px 12px',borderRadius:8,fontSize:13,transition:'all .15s',
                      background:form.pages.includes(p.id)?'rgba(79,142,247,.15)':'var(--bg-surface)',
                      border:`1px solid ${form.pages.includes(p.id)?'rgba(79,142,247,.4)':'var(--border)'}`
                    }}>
                      <input type="checkbox" style={{display:'none'}} checked={form.pages.includes(p.id)}
                        onChange={()=>togglePage(p.id)}/>
                      {form.pages.includes(p.id)?'✅':'⬜'} {p.name}
                    </label>
                  ))}
                  {pages.length===0&&<span style={{fontSize:13,color:'var(--text-muted)'}}>ยังไม่มีเพจ</span>}
                </div>
              </div>
              <div className="lp-info-box">
                📧 ระบบจะส่ง OTP ไปที่อีเมลนี้อัตโนมัติ<br/>
                ผู้ใช้ต้องยืนยัน OTP ก่อนจึงจะ login ได้
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setModal(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={saveAdd}>➕ เพิ่มผู้ใช้ & ส่ง OTP</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Edit User ── */}
      {modal==='edit' && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">✏️ แก้ไขผู้ใช้</div>
              <button className="modal-close" onClick={()=>setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">ชื่อ</label>
                  <input className="form-input" value={form.firstName||''}
                    onChange={e=>setForm(f=>({...f,firstName:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">นามสกุล</label>
                  <input className="form-input" value={form.lastName||''}
                    onChange={e=>setForm(f=>({...f,lastName:e.target.value}))}/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">อีเมล</label>
                <input className="form-input" value={form.email||''} disabled/>
              </div>
              <div className="form-group">
                <label className="form-label">บทบาท</label>
                <select className="form-select" value={form.role||'admin'}
                  onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  {ROLE_OPTS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">สถานะ</label>
                <select className="form-select" value={String(form.active)}
                  onChange={e=>setForm(f=>({...f,active:e.target.value==='true'}))}>
                  <option value="true">เปิดใช้งาน</option>
                  <option value="false">ปิดใช้งาน</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">เพจที่รับผิดชอบ</label>
                <div style={{ display:'flex',flexWrap:'wrap',gap:7 }}>
                  {pages.map(p=>(
                    <label key={p.id} style={{
                      display:'flex',alignItems:'center',gap:6,cursor:'pointer',
                      padding:'6px 12px',borderRadius:8,fontSize:13,transition:'all .15s',
                      background:form.pages.includes(p.id)?'rgba(79,142,247,.15)':'var(--bg-surface)',
                      border:`1px solid ${form.pages.includes(p.id)?'rgba(79,142,247,.4)':'var(--border)'}`
                    }}>
                      <input type="checkbox" style={{display:'none'}} checked={form.pages.includes(p.id)}
                        onChange={()=>togglePage(p.id)}/>
                      {form.pages.includes(p.id)?'✅':'⬜'} {p.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setModal(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={saveEdit}>💾 บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Change Password ── */}
      {modal==='password' && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <div className="modal-title">🔑 เปลี่ยนรหัสผ่าน — {editing?.displayName||editing?.email}</div>
              <button className="modal-close" onClick={()=>setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <PwField label="รหัสผ่านใหม่ *" field="newPassword"  show={showNP}  setShow={setShowNP}/>
              <PwField label="ยืนยันรหัสผ่าน *" field="newPassword2" show={showNP2} setShow={setShowNP2}/>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setModal(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={savePassword}>🔑 บันทึกรหัสผ่านใหม่</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .lp-info-box{
          background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.25);
          border-radius:8px;padding:10px 14px;font-size:12.5px;color:var(--text-secondary);
          line-height:1.65;
        }
      `}</style>
    </div>
  );
}
