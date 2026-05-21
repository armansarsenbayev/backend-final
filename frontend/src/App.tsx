import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

import HostDashboard from './pages/host/HostDashboard'
import GuestDashboard from './pages/guest/GuestDashboard'
import VendorDashboard from './pages/vendor/VendorDashboard'
import CourierDashboard from './pages/courier/CourierDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'

const ROLE_ROUTES: Record<string, string> = {
  HOST: '/host',
  GUEST: '/guest',
  VENDOR: '/vendor',
  COURIER: '/courier',
  ADMIN: '/admin',
}

function RoleRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={ROLE_ROUTES[user.role] || '/login'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Root → role redirect */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RoleRedirect />
              </ProtectedRoute>
            }
          />

          {/* Role dashboards */}
          <Route
            path="/host"
            element={
              <ProtectedRoute allowedRoles={['HOST']}>
                <HostDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guest"
            element={
              <ProtectedRoute allowedRoles={['GUEST']}>
                <GuestDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor"
            element={
              <ProtectedRoute allowedRoles={['VENDOR']}>
                <VendorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courier"
            element={
              <ProtectedRoute allowedRoles={['COURIER']}>
                <CourierDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
