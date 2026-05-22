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
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative text-center text-white">
          <div className="text-7xl mb-6">🌸</div>
          <h1 className="text-4xl font-bold mb-3 tracking-tight">Saukele</h1>
          <p className="text-amber-100 text-lg mb-8 font-medium">Kazakh Wedding Gift Registry</p>
          <div className="space-y-3 text-amber-100 text-sm max-w-xs mx-auto">
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
              <span className="text-xl">🎁</span>
              <span>Create and manage wedding gift registries</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
              <span className="text-xl">💛</span>
              <span>Contribute from anywhere in the world</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
              <span className="text-xl">🌿</span>
              <span>Family hierarchy with Kazakh traditions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-stone-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 items-center justify-center shadow-lg mb-3">
              <span className="text-3xl">🌸</span>
            </div>
            <h1 className="text-2xl font-bold text-stone-900">Saukele</h1>
            <p className="text-stone-500 text-sm mt-1">Kazakh Wedding Gift Registry</p>
          </div>

          <div className="bg-white rounded-3xl shadow-card border border-stone-100 p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-stone-900">Welcome back</h2>
              <p className="text-stone-500 text-sm mt-1">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="alert-error">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
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
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
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

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 space-y-3 text-center text-sm text-stone-500">
              <div>
                <Link to="/forgot-password" className="text-amber-600 hover:text-amber-700 font-medium hover:underline">
                  Forgot your password?
                </Link>
              </div>
              <div>
                Don't have an account?{' '}
                <Link to="/register" className="text-amber-600 hover:text-amber-700 font-semibold hover:underline">
                  Create account
                </Link>
              </div>
              <div className="pt-2 border-t border-stone-100">
                <Link to="/admin-register" className="text-xs text-stone-400 hover:text-stone-600">
                  Admin registration →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
