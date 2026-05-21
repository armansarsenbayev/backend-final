import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/axios'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setMessage('Токен верификации отсутствует')
      return
    }
    api
      .get(`/auth/verify-email?token=${token}`)
      .then((res) => {
        setStatus('success')
        setMessage(res.data.message || 'Email успешно подтверждён!')
      })
      .catch((err) => {
        setStatus('error')
        const e = err as { response?: { data?: { message?: string } } }
        setMessage(e?.response?.data?.message || 'Ошибка верификации токена')
      })
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="text-5xl mb-4">
          {status === 'loading' && '⏳'}
          {status === 'success' && '✅'}
          {status === 'error' && '❌'}
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          {status === 'loading' && 'Верификация...'}
          {status === 'success' && 'Email подтверждён!'}
          {status === 'error' && 'Ошибка верификации'}
        </h1>
        <p className="text-gray-600 text-sm mb-6">{message}</p>
        {status !== 'loading' && (
          <Link to="/login" className="btn-primary inline-block">
            Войти
          </Link>
        )}
      </div>
    </div>
  )
}
