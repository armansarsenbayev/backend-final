import { useState, FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const token = searchParams.get('token') || ''

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Пароли не совпадают'); return }
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/reset-password', { token, new_password: password })
      setMessage(res.data.message || 'Пароль изменён!')
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message || 'Ошибка сброса пароля')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <p className="text-red-600 mb-4">Токен сброса отсутствует</p>
          <Link to="/forgot-password" className="text-amber-600 hover:underline">Запросить новый</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800">Новый пароль</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          {message && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{message}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Новый пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="input-field" placeholder="минимум 8 символов" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Подтвердите пароль</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="input-field" placeholder="повторите пароль" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Сохранение...' : 'Сохранить пароль'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-amber-600 hover:underline">← Назад к входу</Link>
        </p>
      </div>
    </div>
  )
}
