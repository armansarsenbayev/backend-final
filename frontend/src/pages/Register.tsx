import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'

const ROLES = [
  { value: 'HOST', label: 'Хозяин реестра (HOST)' },
  { value: 'GUEST', label: 'Гость (GUEST)' },
  { value: 'VENDOR', label: 'Продавец (VENDOR)' },
  { value: 'COURIER', label: 'Курьер (COURIER)' },
]

function getError(err: unknown): string {
  const e = err as { response?: { data?: { message?: string; error?: string; issues?: { issue: string }[] } } }
  const issues = e?.response?.data?.issues
  if (issues?.length) return issues.map((i) => i.issue).join(', ')
  return e?.response?.data?.message || e?.response?.data?.error || 'Ошибка регистрации'
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
      setSuccess('Регистрация успешна! Проверьте email для верификации.')
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🌸</div>
          <h1 className="text-2xl font-bold text-gray-800">Регистрация</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={set('email')} required className="input-field" placeholder="your@email.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Имя пользователя</label>
            <input type="text" value={form.username} onChange={set('username')} required minLength={3} className="input-field" placeholder="username" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
            <input type="password" value={form.password} onChange={set('password')} required minLength={8} className="input-field" placeholder="минимум 8 символов" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
            <select value={form.role} onChange={set('role')} className="input-field">
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-amber-600 hover:underline font-medium">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
