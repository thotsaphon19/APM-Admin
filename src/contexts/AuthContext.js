// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('apm_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
    setLoading(false);
  }, []);

  async function login(email, password) {
    const res = await api.login({ email, password });
    setUser(res.user);
    localStorage.setItem('apm_user', JSON.stringify(res.user));
    return res.user;
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('apm_user');
  }

  async function refreshUser() {
    // re-fetch via getUsers then find self
  }

  const isExecutive = user?.role === 'executive';
  const isHead      = user?.role === 'head';
  const isAdmin     = user?.role === 'admin';
  const canManageUsers  = isExecutive || isHead;
  const canDeleteUsers  = isExecutive;

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, refreshUser,
      isExecutive, isHead, isAdmin, canManageUsers, canDeleteUsers,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
