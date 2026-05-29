// src/pages/PersonalPage.js
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { exportPersonalPDF } from '../utils/pdfExport';
import { ToastContainer, useToast } from '../components/Toast';

export default function PersonalPage() {
  const { user, canManageUsers } = useAuth();
  const { toasts, remove, toast } = useToast();
  const [users, setUsers] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({
    startDate: new Date().toISOString().slice(0, 7) + '-01',
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (canManageUsers) {
      api.getUsers().then(r => setUsers(r.data || []));
    }
    setSelectedEmail(user?.email || '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedEmail) loadData();
  }, [selectedEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.getPersonalSummary({ email: selectedEmail, ...filter });
      setData(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function exportPDF() {
    if (!data) return;
    const selectedUser = users.find(u => u.email === selectedEmail) || user;
    exportPersonalPDF({
      user: selectedUser,
      entries: data.entries,
      total: data.total,
      period: `${filter.startDate} ถึง ${filter.endDate}`,
    });
    toast.success('Export PDF สำเร็จ');
  }

  // Chart data by date
  const chartData = data ? [...new Set(data.entries.map(e => e.date))].sort().map(date => {
    const dayEntries = data.entries.filter(e => e.date === date);
    return {
      date: date.slice(5),
      ข้อความ: dayEntries.reduce((s, e) => s + Number(e.messageCount || 0), 0),
      ตอบกลับ: dayEntries.reduce((s, e) => s + Number(e.responseCount || 0), 0),
      ผู้ติดตาม: dayEntries.reduce((s, e) => s + Number(e.newFollowers || 0), 0),
      โพสต์: dayEntries.reduce((s, e) => s + Number(e.posts || 0), 0),
    };
  }) : [];

  const selectedUserInfo = users.find(u => u.email === selectedEmail) || user;

  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={remove} />

      <div className="page-header">
        <div>
          <div className="page-header-title">สรุปรายบุคคล</div>
          <div className="page-header-sub">ผลงานและสถิติแยกตามบุคคล</div>
        </div>
        {data && <button className="btn btn-primary" onClick={exportPDF}>📄 Export PDF</button>}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="filters-bar">
          {canManageUsers && (
            <div className="filter-item">
              <label className="filter-label">เลือกแอดมิน</label>
              <select className="form-select" style={{ width: 220 }} value={selectedEmail} onChange={e => setSelectedEmail(e.target.value)}>
                <option value="">เลือกแอดมิน</option>
                {users.map(u => <option key={u.email} value={u.email}>{u.displayName || u.email}</option>)}
              </select>
            </div>
          )}
          <div className="filter-item">
            <label className="filter-label">วันที่เริ่ม</label>
            <input type="date" className="form-input" style={{ width: 160 }} value={filter.startDate} onChange={e => setFilter(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div className="filter-item">
            <label className="filter-label">วันที่สิ้นสุด</label>
            <input type="date" className="form-input" style={{ width: 160 }} value={filter.endDate} onChange={e => setFilter(f => ({ ...f, endDate: e.target.value }))} />
          </div>
          <div style={{ marginTop: 'auto' }}>
            <button className="btn btn-primary" onClick={loadData}>🔍 ดูรายงาน</button>
          </div>
        </div>
      </div>

      {/* Profile card */}
      {selectedUserInfo && (
        <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, var(--bg-card), rgba(79,142,247,0.06))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {selectedUserInfo.photoURL ? (
              <img src={selectedUserInfo.photoURL} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-gold)' }} />
            ) : (
              <div className="user-avatar-placeholder" style={{ width: 56, height: 56, fontSize: 20 }}>
                {(selectedUserInfo.displayName || selectedUserInfo.email || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedUserInfo.displayName || `${selectedUserInfo.firstName} ${selectedUserInfo.lastName}`}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{selectedUserInfo.email}</div>
              <div style={{ marginTop: 6 }}>
                <span className={`tag ${selectedUserInfo.role === 'executive' ? 'tag-gold' : selectedUserInfo.role === 'head' ? 'tag-blue' : 'tag-green'}`}>
                  {selectedUserInfo.role === 'executive' ? 'ผู้บริหาร' : selectedUserInfo.role === 'head' ? 'หัวหน้า' : 'แอดมิน'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="loading-overlay"><div className="spinner" /></div>}

      {data && !loading && (
        <>
          {/* Stats */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            {[
              { label: 'ข้อความ', value: data.total.messages, color: '#f5c842', icon: '💬' },
              { label: 'ตอบกลับ', value: data.total.responses, color: '#4f8ef7', icon: '↩️' },
              { label: 'ผู้ติดตาม', value: data.total.followers, color: '#36d7b7', icon: '👤' },
              { label: 'โพสต์', value: data.total.posts, color: '#9b6df7', icon: '📝' },
              { label: 'Reach', value: data.total.reach, color: '#f76f8e', icon: '📡' },
              { label: 'Engagement', value: data.total.engagement, color: '#ff9f43', icon: '💫' },
            ].map((s, i) => (
              <div key={i} className="stat-card" style={{ '--accent-color': s.color }}>
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{Number(s.value || 0).toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="chart-card" style={{ marginBottom: 20 }}>
            <div className="chart-title">📈 ผลงานรายวัน</div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={chartData} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3c8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3c8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="ข้อความ" fill="#f5c842" radius={[3,3,0,0]} />
                  <Bar dataKey="ตอบกลับ" fill="#4f8ef7" radius={[3,3,0,0]} />
                  <Bar dataKey="ผู้ติดตาม" fill="#36d7b7" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">ไม่มีข้อมูล</div></div>
            )}
          </div>

          {/* Detail table */}
          <div className="card">
            <div className="chart-title" style={{ marginBottom: 16 }}>📋 รายการทั้งหมด ({data.entries.length} รายการ)</div>
            {data.entries.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>เพจ</th>
                      <th style={{ textAlign: 'right' }}>ข้อความ</th>
                      <th style={{ textAlign: 'right' }}>ตอบ</th>
                      <th style={{ textAlign: 'right' }}>ผู้ติดตาม</th>
                      <th style={{ textAlign: 'right' }}>โพสต์</th>
                      <th style={{ textAlign: 'right' }}>Reach</th>
                      <th style={{ textAlign: 'right' }}>Engagement</th>
                      <th>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((e, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'Sora', fontSize: 13 }}>{e.date}</td>
                        <td><span className="tag tag-blue">{e.pageName}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(e.messageCount||0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-teal)' }}>{Number(e.responseCount||0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-gold)' }}>{Number(e.newFollowers||0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>{Number(e.posts||0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>{Number(e.reach||0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>{Number(e.engagement||0).toLocaleString()}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-icon">📝</div><div className="empty-title">ยังไม่มีรายการ</div></div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
