import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_ROUTES: Record<string, string> = {
  HOST: '/host',
  GUEST: '/guest',
  VENDOR: '/vendor',
  COURIER: '/courier',
  ADMIN: '/admin',
}

interface Props {
  children: ReactNode
  allowedRoles?: string[]
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-amber-600 text-lg animate-pulse">Загрузка...</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_ROUTES[user.role] || '/login'} replace />
  }

  return <>{children}</>
}
