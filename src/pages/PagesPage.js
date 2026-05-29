// src/pages/PagesPage.js
import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { ToastContainer, useToast } from '../components/Toast';

const CATEGORIES = ['General', 'ธุรกิจ', 'ความบันเทิง', 'ข่าวสาร', 'สุขภาพ', 'การศึกษา', 'อื่นๆ'];

export default function PagesPage() {
  const { toasts, remove, toast } = useToast();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const emptyForm = { name: '', description: '', followers: '', category: 'General' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const res = await api.getPages();
      setPages(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() { setEditing(null); setForm({ ...emptyForm }); setShowModal(true); }
  function openEdit(p) { setEditing(p); setForm({ ...p }); setShowModal(true); }

  async function handleSave() {
    if (!form.name) return toast.error('กรุณากรอกชื่อเพจ');
    try {
      if (editing) {
        await api.updatePage({ ...form, id: editing.id });
        toast.success('แก้ไขเพจสำเร็จ');
      } else {
        await api.addPage(form);
        toast.success('เพิ่มเพจสำเร็จ');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete(p) {
    if (!window.confirm(`ลบเพจ "${p.name}"?`)) return;
    try {
      await api.deletePage(p.id);
      toast.success('ลบเพจสำเร็จ');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function toggleActive(p) {
    const newActive = p.active === false || p.active === 'false' ? true : false;
    try {
      await api.updatePage({ id: p.id, active: newActive });
      toast.success(newActive ? 'เปิดใช้งานเพจแล้ว' : 'ปิดใช้งานเพจแล้ว');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const filtered = pages.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={remove} />

      <div className="page-header">
        <div>
          <div className="page-header-title">จัดการเพจ</div>
          <div className="page-header-sub">เพจทั้งหมด {pages.length} เพจ</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ เพิ่มเพจ</button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <input
          className="form-input"
          placeholder="🔍 ค้นหาเพจ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 340 }}
        />
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(p => (
            <div key={p.id} className="card" style={{ opacity: p.active === false || p.active === 'false' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    📄
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                    <span className="tag tag-blue" style={{ fontSize: 10 }}>{p.category}</span>
                  </div>
                </div>
                <span className={`tag ${p.active === false || p.active === 'false' ? 'tag-rose' : 'tag-green'}`} style={{ fontSize: 10 }}>
                  {p.active === false || p.active === 'false' ? 'ปิด' : 'เปิด'}
                </span>
              </div>

              {p.description && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>{p.description}</p>
              )}

              <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Sora', color: 'var(--accent-gold)' }}>
                    {Number(p.followers || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Followers</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>สร้างเมื่อ</div>
                  <div style={{ fontSize: 12 }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString('th-TH') : '—'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️ แก้ไข</button>
                <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(p)}>
                  {p.active === false || p.active === 'false' ? '✅ เปิดใช้' : '🚫 ปิดใช้'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)}>🗑️</button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && !loading && (
            <div style={{ gridColumn: '1/-1' }}>
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <div className="empty-title">ยังไม่มีเพจ</div>
                <div className="empty-desc">คลิก "+ เพิ่มเพจ" เพื่อสร้างเพจแรก</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editing ? '✏️ แก้ไขเพจ' : '➕ เพิ่มเพจใหม่'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">ชื่อเพจ *</label>
                <input className="form-input" placeholder="ชื่อเพจ" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">รายละเอียด</label>
                <textarea className="form-textarea" rows={2} placeholder="คำอธิบายเพจ..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">จำนวน Followers</label>
                  <input type="number" className="form-input" placeholder="0" value={form.followers} onChange={e => setForm(f => ({ ...f, followers: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">หมวดหมู่</label>
                  <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? '💾 บันทึก' : '➕ เพิ่ม'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
