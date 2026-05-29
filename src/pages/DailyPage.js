// src/pages/DailyPage.js
import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { ToastContainer, useToast } from '../components/Toast';

export default function DailyPage() {
  const { user, canManageUsers } = useAuth();
  const { toasts, remove, toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [pages, setPages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState({ startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], pageId: '', userEmail: '' });

  const emptyForm = {
    date: new Date().toISOString().split('T')[0],
    pageId: '', pageName: '',
    messageCount: '', responseCount: '', newFollowers: '',
    posts: '', reach: '', engagement: '', notes: ''
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [eRes, pRes, uRes] = await Promise.all([
        api.getDailyEntries(filter),
        api.getPages(),
        api.getUsers(),
      ]);
      setEntries(eRes.data || []);
      setPages((pRes.data || []).filter(p => p.active !== false && p.active !== 'false'));
      setUsers(uRes.data || []);
    } catch (err) {
      toast.error('โหลดข้อมูลไม่ได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFilter() {
    setLoading(true);
    try {
      const filterData = { ...filter };
      if (user?.role === 'admin') filterData.userEmail = user.email;
      const res = await api.getDailyEntries(filterData);
      setEntries(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  }

  function openEdit(entry) {
    setEditing(entry);
    setForm({ ...entry });
    setShowModal(true);
  }

  function handlePageChange(e) {
    const page = pages.find(p => p.id === e.target.value);
    setForm(f => ({ ...f, pageId: e.target.value, pageName: page?.name || '' }));
  }

  async function handleSave() {
    if (!form.date || !form.pageId) return toast.error('กรุณากรอกวันที่และเพจ');
    try {
      if (editing) {
        await api.updateDailyEntry({ ...form, id: editing.id });
        toast.success('แก้ไขรายการสำเร็จ');
      } else {
        await api.addDailyEntry({
          ...form,
          userEmail: user.email,
          userName: user.displayName,
        });
        toast.success('เพิ่มรายการสำเร็จ');
      }
      setShowModal(false);
      loadAll();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete(entry) {
    if (!window.confirm(`ลบรายการวันที่ ${entry.date} ของเพจ ${entry.pageName}?`)) return;
    try {
      await api.deleteDailyEntry(entry.id);
      toast.success('ลบรายการสำเร็จ');
      loadAll();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const canEdit = (entry) => canManageUsers || entry.userEmail === user?.email;

  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={remove} />

      <div className="page-header">
        <div>
          <div className="page-header-title">รายการประจำวัน</div>
          <div className="page-header-sub">บันทึกผลงานและสถิติรายวัน</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ เพิ่มรายการ</button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="filters-bar">
          <div className="filter-item">
            <label className="filter-label">วันที่เริ่ม</label>
            <input type="date" className="form-input" style={{ width: 160 }} value={filter.startDate} onChange={e => setFilter(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div className="filter-item">
            <label className="filter-label">วันที่สิ้นสุด</label>
            <input type="date" className="form-input" style={{ width: 160 }} value={filter.endDate} onChange={e => setFilter(f => ({ ...f, endDate: e.target.value }))} />
          </div>
          <div className="filter-item">
            <label className="filter-label">เพจ</label>
            <select className="form-select" style={{ width: 180 }} value={filter.pageId} onChange={e => setFilter(f => ({ ...f, pageId: e.target.value }))}>
              <option value="">ทั้งหมด</option>
              {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {canManageUsers && (
            <div className="filter-item">
              <label className="filter-label">แอดมิน</label>
              <select className="form-select" style={{ width: 180 }} value={filter.userEmail} onChange={e => setFilter(f => ({ ...f, userEmail: e.target.value }))}>
                <option value="">ทั้งหมด</option>
                {users.map(u => <option key={u.email} value={u.email}>{u.displayName || u.email}</option>)}
              </select>
            </div>
          )}
          <div style={{ marginTop: 'auto' }}>
            <button className="btn btn-primary" onClick={handleFilter}>🔍 ค้นหา</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <div className="empty-title">ยังไม่มีรายการ</div>
            <div className="empty-desc">คลิก "+ เพิ่มรายการ" เพื่อบันทึกรายการแรก</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>แอดมิน</th>
                  <th>เพจ</th>
                  <th style={{ textAlign: 'right' }}>ข้อความ</th>
                  <th style={{ textAlign: 'right' }}>ตอบ</th>
                  <th style={{ textAlign: 'right' }}>ผู้ติดตาม</th>
                  <th style={{ textAlign: 'right' }}>โพสต์</th>
                  <th style={{ textAlign: 'right' }}>Reach</th>
                  <th style={{ textAlign: 'right' }}>Engagement</th>
                  <th>หมายเหตุ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap', fontFamily: 'Sora, sans-serif', fontSize: 13 }}>{e.date}</td>
                    <td>
                      <div style={{ fontSize: 13 }}>{e.userName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.userEmail}</div>
                    </td>
                    <td><span className="tag tag-blue">{e.pageName}</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'Sora', fontWeight: 600 }}>{Number(e.messageCount || 0).toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'Sora', fontWeight: 600, color: 'var(--accent-teal)' }}>{Number(e.responseCount || 0).toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'Sora', fontWeight: 600, color: 'var(--accent-gold)' }}>{Number(e.newFollowers || 0).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{Number(e.posts || 0).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{Number(e.reach || 0).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{Number(e.engagement || 0).toLocaleString()}</td>
                    <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>{e.notes}</td>
                    <td>
                      {canEdit(e) && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(e)} title="แก้ไข">✏️</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(e)} title="ลบ">🗑️</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editing ? '✏️ แก้ไขรายการ' : '➕ เพิ่มรายการประจำวัน'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">วันที่ *</label>
                  <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">เพจ *</label>
                  <select className="form-select" value={form.pageId} onChange={handlePageChange}>
                    <option value="">เลือกเพจ</option>
                    {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">จำนวนข้อความ</label>
                  <input type="number" className="form-input" placeholder="0" value={form.messageCount} onChange={e => setForm(f => ({ ...f, messageCount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">ตอบกลับ</label>
                  <input type="number" className="form-input" placeholder="0" value={form.responseCount} onChange={e => setForm(f => ({ ...f, responseCount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">ผู้ติดตามใหม่</label>
                  <input type="number" className="form-input" placeholder="0" value={form.newFollowers} onChange={e => setForm(f => ({ ...f, newFollowers: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">โพสต์</label>
                  <input type="number" className="form-input" placeholder="0" value={form.posts} onChange={e => setForm(f => ({ ...f, posts: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reach</label>
                  <input type="number" className="form-input" placeholder="0" value={form.reach} onChange={e => setForm(f => ({ ...f, reach: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Engagement</label>
                  <input type="number" className="form-input" placeholder="0" value={form.engagement} onChange={e => setForm(f => ({ ...f, engagement: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">หมายเหตุ</label>
                <textarea className="form-textarea" rows={3} placeholder="หมายเหตุเพิ่มเติม..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? '💾 บันทึกการแก้ไข' : '➕ เพิ่มรายการ'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
