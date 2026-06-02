import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import { LoadingPage } from './components/ui'
import { NotificationProvider } from './contexts/NotificationContext'
import Layout from './components/layout/Layout'

// Pages
import Login           from './pages/auth/Login'
import Dashboard       from './pages/dashboard/Dashboard'
import Commission      from './pages/commission/Commission'
import Verify          from './pages/verify/Verify'
import TeamDashboard   from './pages/team/TeamDashboard'
import Payroll         from './pages/payroll/Payroll'
import CompanyOverview from './pages/company/CompanyOverview'
import PagesManagement from './pages/pages-mgmt/PagesManagement'
import Leave           from './pages/leave/Leave'
import Mailbox         from './pages/mailbox/Mailbox'
import Employees       from './pages/employees/Employees'
import Reports         from './pages/reports/Reports'
import SettingsPage    from './pages/settings/Settings'

function Guard({ children, roles }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <LoadingPage/>
  if (!user)   return <Navigate to="/login" replace/>
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/" replace/>
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingPage/>
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace/> : <Login/>}/>
      <Route path="/" element={<Guard><Layout/></Guard>}>
        <Route index             element={<Dashboard/>}/>
        <Route path="commission" element={<Commission/>}/>
        <Route path="verify"     element={<Guard roles={['superadmin','head_admin','assistant']}><Verify/></Guard>}/>
        <Route path="team"       element={<Guard roles={['superadmin','head_admin']}><TeamDashboard/></Guard>}/>
        <Route path="payroll"    element={<Guard roles={['superadmin','assistant']}><Payroll/></Guard>}/>
        <Route path="company"    element={<Guard roles={['superadmin']}><CompanyOverview/></Guard>}/>
        <Route path="pages"      element={<PagesManagement/>}/>
        <Route path="leave"      element={<Leave/>}/>
        <Route path="mailbox"    element={<Mailbox/>}/>
        <Route path="employees"  element={<Guard roles={['superadmin','head_admin']}><Employees/></Guard>}/>
        <Route path="reports"    element={<Guard roles={['superadmin','head_admin','assistant']}><Reports/></Guard>}/>
        <Route path="settings"   element={<Guard roles={['superadmin']}><SettingsPage/></Guard>}/>
      </Route>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <NotificationProvider>
            <AppRoutes/>
          </NotificationProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
