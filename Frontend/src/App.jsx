import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AdminLayout } from './layouts/AdminLayout'
import { Dashboard } from './pages/Dashboard'
import { UploadDashboard } from './pages/UploadDashboard'
import { History } from './pages/History'
import { Settings } from './pages/Settings'
import { Login } from './pages/auth/Login'
import { Register } from './pages/auth/Register'
import { ForgotPassword } from './pages/auth/ForgotPassword'
import { ToastProvider } from './context/ToastContext'
import { NotificationProvider } from './context/NotificationContext'
import { getSessionExpiresAt, isLoggedIn, logout } from './utils/auth'

function ProtectedRoute({ children }) {
  const loggedIn = isLoggedIn();
  const expiresAt = loggedIn ? getSessionExpiresAt() : null;

  useEffect(() => {
    if (!expiresAt) return undefined;

    const timeoutMs = expiresAt - Date.now();
    if (timeoutMs <= 0) {
      logout();
      return undefined;
    }

    const timeoutId = window.setTimeout(logout, timeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [expiresAt]);

  if (!loggedIn) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <ToastProvider>
      <NotificationProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Landing Page Route (No Sidebar) */}
            <Route path="/" element={<Dashboard />} />

            {/* Admin Layout Routes (Has Sidebar) */}
            <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route path="/uploadpage" element={<UploadDashboard />} />
              <Route path="/history" element={<History />} />
              {/* Placeholder for other routes */}
              <Route path="/scanner" element={<UploadDashboard />} />
              <Route path="/users" element={<UploadDashboard />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </Router>
      </NotificationProvider>
    </ToastProvider>
  )
}

export default App
