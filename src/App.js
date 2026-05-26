// src/App.js
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import DailyPage from './pages/DailyPage';
import UsersPage from './pages/UsersPage';
import PagesPage from './pages/PagesPage';
import ReportsPage from './pages/ReportsPage';
import PersonalPage from './pages/PersonalPage';
import './App.css';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (loading) {
    return (
      <div className="splash-screen">
        <div className="splash-logo">
          <div className="splash-ring" />
          <span>APM</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>กำลังโหลด...</p>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const pages = {
    dashboard: <DashboardPage />,
    daily:     <DailyPage />,
    personal:  <PersonalPage />,
    users:     <UsersPage />,
    pages:     <PagesPage />,
    reports:   <ReportsPage />,
  };

  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {pages[currentPage] || <DashboardPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
