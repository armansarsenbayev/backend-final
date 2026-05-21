import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface LayoutProps {
  children: ReactNode
  title: string
}

const ROLE_LABELS: Record<string, string> = {
  HOST: 'Хозяин',
  GUEST: 'Гость',
  VENDOR: 'Продавец',
  COURIER: 'Курьер',
  ADMIN: 'Администратор',
}

export default function Layout({ children, title }: LayoutProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-amber-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌸</span>
              <span className="font-bold text-xl tracking-tight">Saukele</span>
              <span className="text-amber-200 text-sm hidden sm:inline">— {title}</span>
            </div>
            {user && (
              <div className="flex items-center gap-3">
                <span className="text-sm hidden sm:block">
                  <span className="text-amber-200">@{user.username}</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-700 text-xs font-medium">
                  {ROLE_LABELS[user.role] || user.role}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-amber-700 hover:bg-amber-800 px-3 py-1.5 rounded text-sm transition"
                >
                  Выйти
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  )
}
