// src/contexts/NotifContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';

const NotifContext = createContext(null);

export function NotifProvider({ children }) {
  const { user } = useAuth();
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(false);

  const unread = notifs.filter(n => n.read !== 'true' && n.read !== true).length;

  const load = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const res = await api.getNotifications({ email: user.email });
      setNotifs(res.data || []);
    } catch(e) { console.error('notif load fail', e); }
    finally { setLoading(false); }
  }, [user?.email]);

  // Poll every 30 seconds for new notifications
  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  async function markRead(id) {
    try {
      await api.markNotifRead({ id, email: user.email });
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: 'true' } : n));
    } catch(e) {}
  }

  async function markAllRead() {
    try {
      await api.markAllNotifRead({ email: user.email });
      setNotifs(prev => prev.map(n => ({ ...n, read: 'true' })));
    } catch(e) {}
  }

  return (
    <NotifContext.Provider value={{ notifs, unread, loading, load, markRead, markAllRead }}>
      {children}
    </NotifContext.Provider>
  );
}

export function useNotif() {
  const ctx = useContext(NotifContext);
  if (!ctx) throw new Error('useNotif must be inside NotifProvider');
  return ctx;
}
