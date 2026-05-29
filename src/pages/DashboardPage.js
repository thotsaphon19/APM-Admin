// src/pages/DashboardPage.js
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const COLORS = ['#f5c842', '#4f8ef7', '#36d7b7', '#f76f8e', '#9b6df7', '#ff9f43'];

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const [reportRes, usersRes, pagesRes] = await Promise.all([
        api.getReport({ startDate: monthStart }),
        api.getUsers(),
        api.getPages(),
      ]);
      setStats({
        summary: reportRes.data.summary,
        entries: reportRes.data.entries,
        users: usersRes.data || [],
        pages: pagesRes.data || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;
  if (!stats) return null;

  const { summary, entries, users, pages } = stats;

  // Daily chart data (last 14 days)
  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const dayEntries = entries.filter(e => e.date === ds);
    last14.push({
      date: ds.slice(5),
      ข้อความ: dayEntries.reduce((s, e) => s + Number(e.messageCount || 0), 0),
      ผู้ติดตาม: dayEntries.reduce((s, e) => s + Number(e.newFollowers || 0), 0),
      Engagement: dayEntries.reduce((s, e) => s + Number(e.engagement || 0), 0),
    });
  }

  // By page pie
  const pageData = Object.entries(summary.byPage || {}).map(([name, val]) => ({
    name, value: val.messages
  })).slice(0, 6);

  // By user bar
  const userData = Object.entries(summary.byUser || {}).map(([name, val]) => ({
    name: name.split(' ')[0],
    ข้อความ: val.messages,
    ตอบกลับ: val.responses,
    โพสต์: val.posts,
  })).slice(0, 8);

  const statCards = [
    { icon: '💬', label: 'ข้อความทั้งหมด', value: summary.totalMessages?.toLocaleString() || 0, color: '#f5c842' },
    { icon: '↩️', label: 'ตอบกลับทั้งหมด', value: summary.totalResponses?.toLocaleString() || 0, color: '#4f8ef7' },
    { icon: '👤', label: 'ผู้ติดตามใหม่', value: summary.totalFollowers?.toLocaleString() || 0, color: '#36d7b7' },
    { icon: '📝', label: 'โพสต์ทั้งหมด', value: summary.totalPosts?.toLocaleString() || 0, color: '#9b6df7' },
    { icon: '📡', label: 'Reach', value: summary.totalReach?.toLocaleString() || 0, color: '#f76f8e' },
    { icon: '💫', label: 'Engagement', value: summary.totalEngagement?.toLocaleString() || 0, color: '#ff9f43' },
    { icon: '👥', label: 'แอดมินทั้งหมด', value: users.length || 0, color: '#36d7b7' },
    { icon: '📄', label: 'เพจที่รับผิดชอบ', value: pages.length || 0, color: '#4f8ef7' },
  ];

  return (
    <div>
      {/* Welcome */}
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(79,142,247,0.08) 100%)', border: '1px solid rgba(79,142,247,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 40 }}>👋</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>สวัสดี, {user?.displayName || user?.email}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              ข้อมูลสรุปประจำเดือน {new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
            </div>
          </div>
          <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={loadData}>🔄 รีเฟรช</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div key={i} className="stat-card" style={{ '--accent-color': s.color }}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="charts-row">
        <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <div className="chart-title">📈 ข้อความ & Engagement รายวัน (14 วันล่าสุด)</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={last14}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.06)" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3c8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3c8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="ข้อความ" stroke="#f5c842" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="ผู้ติดตาม" stroke="#36d7b7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Engagement" stroke="#9b6df7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-row">
        {/* Pie by page */}
        <div className="chart-card">
          <div className="chart-title">📄 ข้อความแยกตามเพจ</div>
          {pageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pageData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'white', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8 }} />
                <Legend formatter={(v) => <span style={{ color: '#9ca3c8', fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <div className="empty-title">ยังไม่มีข้อมูล</div>
            </div>
          )}
        </div>

        {/* Bar by user */}
        <div className="chart-card">
          <div className="chart-title">👥 ข้อความแยกตามแอดมิน</div>
          {userData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={userData} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.06)" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3c8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3c8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="ข้อความ" fill="#f5c842" radius={[3,3,0,0]} />
                <Bar dataKey="ตอบกลับ" fill="#4f8ef7" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <div className="empty-title">ยังไม่มีข้อมูล</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
