import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface LayoutProps {
  children: ReactNode
  title: string
}

const ROLE_LABELS: Record<string, string> = {
  HOST: 'Host',
  GUEST: 'Guest',
  VENDOR: 'Vendor',
  COURIER: 'Courier',
  ADMIN: 'Administrator',
}

const ROLE_COLORS: Record<string, string> = {
  HOST:    'bg-violet-100 text-violet-700 border-violet-200',
  GUEST:   'bg-blue-100 text-blue-700 border-blue-200',
  VENDOR:  'bg-orange-100 text-orange-700 border-orange-200',
  COURIER: 'bg-teal-100 text-teal-700 border-teal-200',
  ADMIN:   'bg-red-100 text-red-700 border-red-200',
}

export default function Layout({ children, title }: LayoutProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
                <span className="text-lg leading-none">🌸</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-stone-900 tracking-tight">Saukele</span>
                <span className="hidden sm:inline text-stone-300 select-none">·</span>
                <span className="hidden sm:inline text-sm text-stone-500">{title}</span>
              </div>
            </div>

            {/* User info + logout */}
            {user && (
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="hidden sm:inline text-sm text-stone-600 font-medium">
                  @{user.username}
                </span>
                <span className={`hidden sm:inline px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ROLE_COLORS[user.role] || 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                  {ROLE_LABELS[user.role] || user.role}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition-all duration-150 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                  </svg>
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
