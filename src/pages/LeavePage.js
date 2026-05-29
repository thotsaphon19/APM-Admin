// src/pages/LeavePage.js
import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { ToastContainer, useToast } from '../components/Toast';

const LEAVE_TYPES = ['ลาป่วย', 'ลากิจ', 'ลาพักร้อน', 'ลาคลอด', 'ลาอื่นๆ'];
const STATUS_INFO = {
  pending:  { label: 'รอพิจารณา', cls: 'tag-gold',  icon: '⏳' },
  approved: { label: 'อนุมัติ',   cls: 'tag-green', icon: '✅' },
  rejected: { label: 'ไม่อนุมัติ', cls: 'tag-rose',  icon: '❌' },
};

function calcDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  let days = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export default function LeavePage() {
  const { user, canManageUsers } = useAuth();
  const { toasts, remove, toast } = useToast();
  const [leaves,   setLeaves]   = useState([]);
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showModal,setShowModal]= useState(false);
  const [approveModal, setApproveModal] = useState(null); // leave obj
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUser,   setFilterUser]   = useState('');
  const [approveNote,  setApproveNote]  = useState('');

  const today = new Date().toISOString().split('T')[0];
  const emptyForm = {
    leaveType: 'ลาป่วย', startDate: today, endDate: today, reason: ''
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true);
    try {
      const filter = canManageUsers ? {} : { userEmail: user.email };
      const [lRes, uRes] = await Promise.all([api.getLeaves(filter), api.getUsers()]);
      setLeaves(lRes.data || []);
      setUsers(uRes.data || []);
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  async function submitLeave() {
    if (!form.startDate || !form.endDate) return toast.error('กรุณาเลือกวันที่');
    if (form.endDate < form.startDate)    return toast.error('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
    if (!form.reason)                     return toast.error('กรุณากรอกเหตุผล');
    try {
      await api.addLeave({
        ...form,
        userEmail: user.email,
        userName:  user.displayName || `${user.firstName} ${user.lastName}`.trim(),
      });
      toast.success('ยื่นคำขอลางานสำเร็จ ระบบแจ้งผู้บังคับบัญชาแล้ว');
      setShowModal(false);
      setForm(emptyForm);
      loadAll();
    } catch(e) { toast.error(e.message); }
  }

  async function handleApprove(status) {
    try {
      await api.updateLeaveStatus({
        id: approveModal.id,
        status,
        approvedBy: user.displayName || user.email,
        note: approveNote,
      });
      toast.success(status === 'approved' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ');
      setApproveModal(null);
      setApproveNote('');
      loadAll();
    } catch(e) { toast.error(e.message); }
  }

  async function handleDelete(l) {
    if (!window.confirm('ลบคำขอลานี้?')) return;
    try {
      await api.deleteLeave(l.id);
      toast.success('ลบสำเร็จ');
      loadAll();
    } catch(e) { toast.error(e.message); }
  }

  // Filter
  let filtered = leaves;
  if (filterStatus) filtered = filtered.filter(l => l.status === filterStatus);
  if (filterUser)   filtered = filtered.filter(l => l.userEmail === filterUser);

  // Stats
  const myLeaves   = leaves.filter(l => l.userEmail === user.email);
  const pendingAll = leaves.filter(l => l.status === 'pending').length;
  const approvedThisMonth = leaves.filter(l => {
    const m = new Date().toISOString().slice(0, 7);
    return l.status === 'approved' && (l.startDate || '').startsWith(m);
  });

  const days = calcDays(form.startDate, form.endDate);

  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={remove}/>

      <div className="page-header">
        <div>
          <div className="page-header-title">ระบบลางาน</div>
          <div className="page-header-sub">ยื่นและติดตามคำขอลางาน</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + ยื่นใบลา
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {[
          { icon: '📋', label: 'ใบลาของฉัน', value: myLeaves.length, color: '#4f8ef7' },
          { icon: '⏳', label: 'รอพิจารณา', value: myLeaves.filter(l=>l.status==='pending').length, color: '#f5c842' },
          { icon: '✅', label: 'อนุมัติแล้ว', value: myLeaves.filter(l=>l.status==='approved').length, color: '#36d7b7' },
          { icon: '📅', label: canManageUsers ? 'รอพิจารณา (ทั้งหมด)' : 'วันลาเดือนนี้',
            value: canManageUsers ? pendingAll : approvedThisMonth.reduce((s,l)=>s+Number(l.days||0),0),
            color: '#f76f8e' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ '--accent-color': s.color }}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="filters-bar">
          <div className="filter-item">
            <label className="filter-label">สถานะ</label>
            <select className="form-select" style={{ width: 160 }} value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {Object.entries(STATUS_INFO).map(([v, s]) => (
                <option key={v} value={v}>{s.icon} {s.label}</option>
              ))}
            </select>
          </div>
          {canManageUsers && (
            <div className="filter-item">
              <label className="filter-label">พนักงาน</label>
              <select className="form-select" style={{ width: 200 }} value={filterUser}
                onChange={e => setFilterUser(e.target.value)}>
                <option value="">ทุกคน</option>
                {users.map(u => (
                  <option key={u.email} value={u.email}>{u.displayName || u.email}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ marginTop: 'auto' }}>
            <button className="btn btn-ghost" onClick={() => { setFilterStatus(''); setFilterUser(''); }}>
              🔄 ล้างตัวกรอง
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading-overlay"><div className="spinner"/></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌴</div>
            <div className="empty-title">ยังไม่มีคำขอลา</div>
            <div className="empty-desc">คลิก "+ ยื่นใบลา" เพื่อยื่นคำขอ</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {canManageUsers && <th>พนักงาน</th>}
                  <th>ประเภทการลา</th>
                  <th>วันที่เริ่ม</th>
                  <th>วันที่สิ้นสุด</th>
                  <th style={{ textAlign: 'center' }}>จำนวนวัน</th>
                  <th>เหตุผล</th>
                  <th style={{ textAlign: 'center' }}>สถานะ</th>
                  <th>อนุมัติโดย</th>
                  <th>วันที่ยื่น</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const si = STATUS_INFO[l.status] || STATUS_INFO.pending;
                  return (
                    <tr key={l.id}>
                      {canManageUsers && (
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{l.userName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.userEmail}</div>
                        </td>
                      )}
                      <td>
                        <span className="tag tag-purple">{l.leaveType}</span>
                      </td>
                      <td style={{ fontFamily: 'Sora', fontSize: 13 }}>{l.startDate}</td>
                      <td style={{ fontFamily: 'Sora', fontSize: 13 }}>{l.endDate}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontFamily: 'Sora', color: 'var(--accent-gold)' }}>
                        {l.days} วัน
                      </td>
                      <td style={{ fontSize: 13, maxWidth: 200, color: 'var(--text-secondary)' }}>
                        {l.reason || '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`tag ${si.cls}`}>{si.icon} {si.label}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {l.approvedBy || '—'}
                        {l.note && <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 2 }}>{l.note}</div>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {l.createdAt ? new Date(l.createdAt).toLocaleDateString('th-TH') : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {canManageUsers && l.status === 'pending' && (
                            <button className="btn btn-secondary btn-sm"
                              onClick={() => { setApproveModal(l); setApproveNote(''); }}
                              title="พิจารณา">⚖️</button>
                          )}
                          {(l.userEmail === user.email || canManageUsers) && l.status === 'pending' && (
                            <button className="btn btn-danger btn-sm btn-icon"
                              onClick={() => handleDelete(l)} title="ลบ">🗑️</button>
                          )}
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

      {/* Modal: ยื่นใบลา */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div className="modal-title">🌴 ยื่นคำขอลางาน</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">ประเภทการลา *</label>
                <select className="form-select" value={form.leaveType}
                  onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))}>
                  {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">วันที่เริ่ม *</label>
                  <input type="date" className="form-input" value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">วันที่สิ้นสุด *</label>
                  <input type="date" className="form-input" value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}/>
                </div>
              </div>

              {/* Days preview */}
              {form.startDate && form.endDate && (
                <div style={{
                  background: days > 0 ? 'rgba(54,215,183,0.08)' : 'rgba(247,111,142,0.08)',
                  border: `1px solid ${days > 0 ? 'rgba(54,215,183,0.25)' : 'rgba(247,111,142,0.25)'}`,
                  borderRadius: 8, padding: '10px 16px',
                  fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <span style={{ fontSize: 18 }}>{days > 0 ? '📅' : '⚠️'}</span>
                  {days > 0
                    ? <><strong style={{ color: 'var(--accent-teal)' }}>{days} วันทำการ</strong> (ไม่นับวันหยุดสุดสัปดาห์)</>
                    : <span style={{ color: 'var(--accent-rose)' }}>วันที่เลือกเป็นวันหยุด</span>
                  }
                </div>
              )}

              <div className="form-group">
                <label className="form-label">เหตุผลการลา *</label>
                <textarea className="form-textarea" rows={3} value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="ระบุเหตุผลการลา..."/>
              </div>

              <div style={{
                background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.2)',
                borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)',
                lineHeight: 1.6
              }}>
                📧 ระบบจะส่งการแจ้งเตือนไปยังผู้บังคับบัญชาอัตโนมัติ
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={submitLeave} disabled={days === 0}>
                📨 ยื่นคำขอลา
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: อนุมัติ/ไม่อนุมัติ */}
      {approveModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setApproveModal(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div className="modal-title">⚖️ พิจารณาคำขอลา</div>
              <button className="modal-close" onClick={() => setApproveModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {/* Leave detail */}
              <div style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '16px 20px', marginBottom: 4
              }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{approveModal.userName}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 13 }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>ประเภท: </span>{approveModal.leaveType}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>จำนวน: </span><strong style={{ color: 'var(--accent-gold)' }}>{approveModal.days} วัน</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>เริ่ม: </span>{approveModal.startDate}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>สิ้นสุด: </span>{approveModal.endDate}</div>
                </div>
                {approveModal.reason && (
                  <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <span style={{ color: 'var(--text-muted)' }}>เหตุผล: </span>{approveModal.reason}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">หมายเหตุ (ถ้ามี)</label>
                <textarea className="form-textarea" rows={2} value={approveNote}
                  onChange={e => setApproveNote(e.target.value)}
                  placeholder="ระบุเหตุผลที่ไม่อนุมัติ หรือหมายเหตุเพิ่มเติม..."/>
              </div>
            </div>
            <div className="modal-footer" style={{ gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setApproveModal(null)}>ยกเลิก</button>
              <button className="btn btn-danger" onClick={() => handleApprove('rejected')}>
                ❌ ไม่อนุมัติ
              </button>
              <button className="btn btn-primary" onClick={() => handleApprove('approved')}>
                ✅ อนุมัติ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
