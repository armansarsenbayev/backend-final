import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'

const ROLES = [
  { value: 'HOST',    label: 'Registry Host',  desc: 'Create and manage wedding registries' },
  { value: 'GUEST',   label: 'Guest',           desc: 'Browse registries and contribute to gifts' },
  { value: 'VENDOR',  label: 'Vendor',          desc: 'Purchase funded gifts' },
  { value: 'COURIER', label: 'Courier',         desc: 'Deliver purchased gifts' },
]

function getError(err: unknown): string {
  const e = err as { response?: { data?: { error?: string; message?: string; details?: { field: string; issue: string }[] } } }
  const details = e?.response?.data?.details
  if (details?.length) return details.map((d) => `${d.field}: ${d.issue}`).join(' · ')
  return e?.response?.data?.error || e?.response?.data?.message || 'Registration failed'
}

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '', role: 'GUEST' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await api.post('/auth/register', form)
      setSuccess('Account created! Check your email to verify your account.')
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(getError(err))
    } finally {
      setLoading(false)
    }
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

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
          <h1 className="text-4xl font-bold mb-3 tracking-tight">Join Saukele</h1>
          <p className="text-amber-100 text-lg mb-8 font-medium">Create your account today</p>
          <div className="space-y-3 text-amber-100 text-sm max-w-xs mx-auto text-left">
            {ROLES.map((r) => (
              <div key={r.value} className="flex items-start gap-3 bg-white/10 rounded-xl px-4 py-3">
                <span className="font-semibold text-white">{r.label}</span>
                <span className="text-amber-100">{r.desc}</span>
              </div>
            ))}
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
          </div>

          <div className="bg-white rounded-3xl shadow-card border border-stone-100 p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-stone-900">Create Account</h2>
              <p className="text-stone-500 text-sm mt-1">Fill in the details to get started</p>
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
              {success && (
                <div className="alert-success">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{success}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={set('email')} required className="input-field" placeholder="your@email.com" />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Username</label>
                <input type="text" value={form.username} onChange={set('username')} required minLength={3} className="input-field" placeholder="username" />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
                <input type="password" value={form.password} onChange={set('password')} required minLength={8} className="input-field" placeholder="min 8 characters" />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Role</label>
                <select value={form.role} onChange={set('role')} className="input-field">
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating account...
                  </span>
                ) : 'Create Account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-stone-500">
              Already have an account?{' '}
              <Link to="/login" className="text-amber-600 hover:text-amber-700 font-semibold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
