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
      setMessage('Verification token is missing')
      return
    }
    api
      .get(`/auth/verify-email?token=${token}`)
      .then((res) => {
        setStatus('success')
        setMessage(res.data.message || 'Email verified successfully!')
      })
      .catch((err) => {
        setStatus('error')
        const e = err as { response?: { data?: { message?: string } } }
        setMessage(e?.response?.data?.message || 'Token verification failed')
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
          {status === 'loading' && 'Verifying...'}
          {status === 'success' && 'Email Verified!'}
          {status === 'error' && 'Verification Failed'}
        </h1>
        <p className="text-gray-600 text-sm mb-6">{message}</p>
        {status !== 'loading' && (
          <Link to="/login" className="btn-primary inline-block">
            Sign In
          </Link>
        )}
      </div>
    </div>
  )
}
