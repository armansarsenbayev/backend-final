import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

function getError(err: unknown): string {
  const e = err as { response?: { data?: { error?: string; message?: string; details?: { field: string; issue: string }[] } } }
  const details = e?.response?.data?.details
  if (details?.length) return details.map((d) => `${d.field}: ${d.issue}`).join(' · ')
  return e?.response?.data?.error || e?.response?.data?.message || 'Registration failed'
}

export default function AdminRegister() {
  const [form, setForm] = useState({ email: '', username: '', password: '', adminKey: '' })
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
      const res = await axios.post(
        `${BASE_URL}/admin/register-admin`,
        { email: form.email, username: form.username, password: form.password },
        { headers: { 'X-Admin-Key': form.adminKey } }
      )
      setSuccess(`Admin account @${res.data.username} created! Redirecting to login...`)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(getError(err))
    } finally {
      setLoading(false)
    }
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🔐</div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Registration</h1>
          <p className="text-gray-500 text-sm mt-1">Requires the server's secret admin key</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={set('email')} required className="input-field" placeholder="admin@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input type="text" value={form.username} onChange={set('username')} required minLength={3} className="input-field" placeholder="superadmin" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password (min 8 chars)</label>
            <input type="password" value={form.password} onChange={set('password')} required minLength={8} className="input-field" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Secret Key</label>
            <input type="password" value={form.adminKey} onChange={set('adminKey')} required className="input-field" placeholder="ADMIN_REGISTRATION_KEY from .env" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 bg-red-600 hover:bg-red-700">
            {loading ? 'Creating...' : '🔐 Create Admin Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          <Link to="/login" className="text-amber-600 hover:underline">← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
