// src/components/NotifBell.js
import React, { useState, useRef, useEffect } from 'react';
import { useNotif } from '../contexts/NotifContext';

const TYPE_ICONS = {
  leave_request:  '🌴',
  leave_approved: '✅',
  leave_rejected: '❌',
  profile_updated:'📝',
  pages_updated:  '📄',
  default:        '🔔',
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)   return 'เมื่อกี้';
  if (diff < 3600) return `${Math.floor(diff/60)} นาทีที่แล้ว`;
  if (diff < 86400)return `${Math.floor(diff/3600)} ชม.ที่แล้ว`;
  return `${Math.floor(diff/86400)} วันที่แล้ว`;
}

export default function NotifBell() {
  const { notifs, unread, loading, markRead, markAllRead } = useNotif();
  const [open, setOpen] = useState(false);
  const ref  = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button onClick={() => setOpen(o => !o)} style={{
        position: 'relative', background: open ? 'rgba(99,102,241,0.1)' : 'var(--bg-hover)',
        border: '1px solid var(--border)', borderRadius: 10,
        width: 38, height: 38, cursor: 'pointer', fontSize: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .2s', color: open ? 'var(--brand-primary)' : 'var(--text-secondary)',
        boxShadow: open ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
      }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'var(--accent-rose)', color: 'white',
            borderRadius: '50%', width: 18, height: 18,
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-deep)',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 44, width: 360,
          background: 'white',
          border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 16, boxShadow: '0 12px 40px rgba(99,102,241,0.15)',
          zIndex: 999, overflow: 'hidden',
          animation: 'slideUp .15s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              การแจ้งเตือน {unread > 0 && <span className="tag tag-rose" style={{ fontSize: 10 }}>{unread} ใหม่</span>}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: 'var(--brand-primary)', fontFamily: 'inherit',
              }}>อ่านทั้งหมด</button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {loading && notifs.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <div className="spinner" style={{ margin: '0 auto 8px' }}/>กำลังโหลด...
              </div>
            )}
            {!loading && notifs.length === 0 && (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>ยังไม่มีการแจ้งเตือน</div>
              </div>
            )}
            {notifs.map(n => {
              const isRead = n.read === 'true' || n.read === true;
              const icon   = TYPE_ICONS[n.type] || TYPE_ICONS.default;
              return (
                <div key={n.id} onClick={() => { if (!isRead) markRead(n.id); }} style={{
                  padding: '12px 18px', cursor: 'pointer',
                  background: isRead ? 'transparent' : 'rgba(99,102,241,0.04)',
                  borderBottom: '1px solid rgba(99,102,241,0.06)',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  transition: 'background .15s',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: isRead ? 'var(--bg-hover)' : 'rgba(99,102,241,0.08)',
                    border: `1px solid ${isRead ? 'var(--border)' : 'rgba(79,142,247,0.25)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                  }}>{icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: isRead ? 400 : 600,
                      color: isRead ? 'var(--text-secondary)' : 'var(--text-primary)',
                      marginBottom: 2,
                    }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 8 }}>
                      <span>{n.fromName}</span>
                      <span>·</span>
                      <span>{timeAgo(n.createdAt)}</span>
                    </div>
                  </div>
                  {!isRead && (
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--brand-primary)', flexShrink: 0, marginTop: 4,
                    }}/>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
