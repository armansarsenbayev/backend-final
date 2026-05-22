import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_ROUTES: Record<string, string> = {
  HOST: '/host', GUEST: '/guest', VENDOR: '/vendor', COURIER: '/courier', ADMIN: '/admin',
}

function getError(err: unknown): string {
  const e = err as { response?: { data?: { error?: string; message?: string; details?: { field: string; issue: string }[] } } }
  const details = e?.response?.data?.details
  if (details?.length) return details.map((d) => d.issue).join(', ')
  return e?.response?.data?.error || e?.response?.data?.message || 'Login failed'
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      navigate(ROLE_ROUTES[user.role] || '/')
    } catch (err) {
      setError(getError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🌸</div>
          <h1 className="text-2xl font-bold text-gray-800">Saukele</h1>
          <p className="text-gray-500 text-sm mt-1">Kazakh Wedding Gift Registry</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-gray-600 space-y-2">
          <div>
            <Link to="/forgot-password" className="text-amber-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div>
            Don't have an account?{' '}
            <Link to="/register" className="text-amber-600 hover:underline font-medium">
              Sign Up
            </Link>
          </div>
          <div className="pt-1 border-t border-gray-100">
            <Link to="/admin-register" className="text-xs text-gray-400 hover:text-gray-600">
              Admin registration →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
