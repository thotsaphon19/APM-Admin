// src/pages/ReportsPage.js
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../utils/api';
import { exportReportPDF } from '../utils/pdfExport';
import { ToastContainer, useToast } from '../components/Toast';

const PERIODS = [
  { value: 'day', label: 'รายวัน' },
  { value: 'month', label: 'รายเดือน' },
  { value: 'year', label: 'รายปี' },
];

export default function ReportsPage() {
  const { toasts, remove, toast } = useToast();
  const [period, setPeriod] = useState('month');
  const [chartType, setChartType] = useState('bar');
  const [filter, setFilter] = useState({
    startDate: new Date().toISOString().slice(0, 7) + '-01',
    endDate: new Date().toISOString().split('T')[0],
  });
  const [data, setData] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPage, setSelectedPage] = useState('');

  useEffect(() => {
    api.getPages().then(r => setPages(r.data || []));
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadReport() {
    setLoading(true);
    try {
      const f = { ...filter };
      if (selectedPage) f.pageId = selectedPage;
      const res = await api.getReport(f);
      setData(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function setPeriodFilter(p) {
    setPeriod(p);
    const now = new Date();
    if (p === 'day') {
      const s = new Date(); s.setDate(s.getDate() - 30);
      setFilter({ startDate: s.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] });
    } else if (p === 'month') {
      const s = new Date(); s.setMonth(s.getMonth() - 1); s.setDate(1);
      setFilter({ startDate: s.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] });
    } else {
      const s = new Date(now.getFullYear(), 0, 1);
      setFilter({ startDate: s.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] });
    }
  }

  function exportCSV() {
    if (!data?.entries?.length) return toast.error('ไม่มีข้อมูลให้ export');
    const headers = ['วันที่', 'แอดมิน', 'เพจ', 'ข้อความ', 'ตอบกลับ', 'ผู้ติดตาม', 'โพสต์', 'Reach', 'Engagement', 'หมายเหตุ'];
    const rows = data.entries.map(e => [e.date, e.userName, e.pageName, e.messageCount, e.responseCount, e.newFollowers, e.posts, e.reach, e.engagement, e.notes]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `รายงาน_${filter.startDate}_${filter.endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV สำเร็จ');
  }

  function exportPDF() {
    if (!data) return toast.error('ไม่มีข้อมูล');
    const s = data.summary;
    exportReportPDF({
      title: 'รายงานสรุปผลการดำเนินงาน',
      subtitle: `ช่วงเวลา: ${filter.startDate} ถึง ${filter.endDate}`,
      period: `${filter.startDate}_${filter.endDate}`,
      summary: {
        'ข้อความทั้งหมด': s.totalMessages || 0,
        'ตอบกลับ': s.totalResponses || 0,
        'ผู้ติดตามใหม่': s.totalFollowers || 0,
        'โพสต์': s.totalPosts || 0,
        'Reach': s.totalReach || 0,
        'Engagement': s.totalEngagement || 0,
      },
      tableData: data.entries,
      columns: [
        { key: 'date', label: 'วันที่' },
        { key: 'userName', label: 'แอดมิน' },
        { key: 'pageName', label: 'เพจ' },
        { key: 'messageCount', label: 'ข้อความ' },
        { key: 'responseCount', label: 'ตอบกลับ' },
        { key: 'newFollowers', label: 'ผู้ติดตาม' },
        { key: 'posts', label: 'โพสต์' },
        { key: 'reach', label: 'Reach' },
        { key: 'engagement', label: 'Engagement' },
      ],
    });
    toast.success('Export PDF สำเร็จ');
  }

  // Build chart data by date
  const chartData = data ? Object.entries(data.summary.byDate || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({ date: date.slice(5), ...val }))
    : [];

  const byPageData = data ? Object.entries(data.summary.byPage || {})
    .map(([name, val]) => ({ name: name.slice(0, 12), ...val }))
    : [];

  const byUserData = data ? Object.entries(data.summary.byUser || {})
    .map(([name, val]) => ({ name: name.split(' ')[0], ...val }))
    : [];

  const ChartComponent = chartType === 'bar' ? BarChart : LineChart;
  const DataComponent = chartType === 'bar' ? Bar : Line;

  return (
    <div>
      <ToastContainer toasts={toasts} removeToast={remove} />

      <div className="page-header">
        <div>
          <div className="page-header-title">รายงาน & PDF</div>
          <div className="page-header-sub">สรุปผลรายวัน เดือน ปี</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={exportCSV}>📊 Export CSV</button>
          <button className="btn btn-primary" onClick={exportPDF}>📄 Print PDF</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="filters-bar">
          <div className="filter-item">
            <label className="filter-label">ช่วงเวลา</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {PERIODS.map(p => (
                <button key={p.value} className={`btn btn-sm ${period === p.value ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPeriodFilter(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
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
            <select className="form-select" style={{ width: 180 }} value={selectedPage} onChange={e => setSelectedPage(e.target.value)}>
              <option value="">ทุกเพจ</option>
              {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">กราฟ</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={`btn btn-sm ${chartType === 'bar' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setChartType('bar')}>แท่ง</button>
              <button className={`btn btn-sm ${chartType === 'line' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setChartType('line')}>เส้น</button>
            </div>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <button className="btn btn-primary" onClick={loadReport}>🔍 ดูรายงาน</button>
          </div>
        </div>
      </div>

      {loading && <div className="loading-overlay"><div className="spinner" /></div>}

      {data && !loading && (
        <>
          {/* Summary cards */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            {[
              { label: 'ข้อความ', value: data.summary.totalMessages, color: '#f5c842', icon: '💬' },
              { label: 'ตอบกลับ', value: data.summary.totalResponses, color: '#4f8ef7', icon: '↩️' },
              { label: 'ผู้ติดตาม', value: data.summary.totalFollowers, color: '#36d7b7', icon: '👤' },
              { label: 'โพสต์', value: data.summary.totalPosts, color: '#9b6df7', icon: '📝' },
              { label: 'Reach', value: data.summary.totalReach, color: '#f76f8e', icon: '📡' },
              { label: 'Engagement', value: data.summary.totalEngagement, color: '#ff9f43', icon: '💫' },
            ].map((s, i) => (
              <div key={i} className="stat-card" style={{ '--accent-color': s.color }}>
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{Number(s.value || 0).toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Main chart */}
          <div className="chart-card" style={{ marginBottom: 20 }}>
            <div className="chart-title">📈 ข้อมูลรายวัน</div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <ChartComponent data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3c8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3c8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8 }} />
                  <Legend />
                  {chartType === 'bar' ? (
                    <>
                      <Bar dataKey="messages" name="ข้อความ" fill="#f5c842" radius={[3,3,0,0]} barSize={12} />
                      <Bar dataKey="followers" name="ผู้ติดตาม" fill="#36d7b7" radius={[3,3,0,0]} barSize={12} />
                    </>
                  ) : (
                    <>
                      <Line type="monotone" dataKey="messages" name="ข้อความ" stroke="#f5c842" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="followers" name="ผู้ติดตาม" stroke="#36d7b7" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="engagement" name="Engagement" stroke="#9b6df7" strokeWidth={2} dot={false} />
                    </>
                  )}
                </ChartComponent>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">ไม่มีข้อมูลในช่วงนี้</div></div>
            )}
          </div>

          <div className="charts-row">
            {/* By page */}
            <div className="chart-card">
              <div className="chart-title">📄 แยกตามเพจ</div>
              {byPageData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byPageData} layout="vertical" barSize={12}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#9ca3c8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3c8', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={{ background: 'white', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8 }} />
                    <Bar dataKey="messages" name="ข้อความ" fill="#4f8ef7" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="empty-state"><div className="empty-icon">📄</div><div className="empty-title">ไม่มีข้อมูล</div></div>}
            </div>

            {/* By user */}
            <div className="chart-card">
              <div className="chart-title">👥 แยกตามแอดมิน</div>
              {byUserData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byUserData} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.06)" />
                    <XAxis dataKey="name" tick={{ fill: '#9ca3c8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9ca3c8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'white', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="messages" name="ข้อความ" fill="#f5c842" radius={[3,3,0,0]} />
                    <Bar dataKey="posts" name="โพสต์" fill="#9b6df7" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-title">ไม่มีข้อมูล</div></div>}
            </div>
          </div>

          {/* Detail table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="chart-title" style={{ marginBottom: 0 }}>📋 ตารางรายละเอียด ({data.entries.length} รายการ)</div>
            </div>
            {data.entries.length > 0 ? (
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
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((e, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'Sora', fontSize: 13 }}>{e.date}</td>
                        <td style={{ fontSize: 13 }}>{e.userName}</td>
                        <td><span className="tag tag-blue">{e.pageName}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(e.messageCount||0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-teal)' }}>{Number(e.responseCount||0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-gold)' }}>{Number(e.newFollowers||0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>{Number(e.posts||0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>{Number(e.reach||0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>{Number(e.engagement||0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">ไม่มีข้อมูลในช่วงนี้</div></div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
