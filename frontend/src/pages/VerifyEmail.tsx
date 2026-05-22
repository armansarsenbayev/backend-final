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

  const icon = status === 'loading' ? (
    <svg className="animate-spin w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ) : status === 'success' ? (
    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
      <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  ) : (
    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
      <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  )

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-card border border-stone-100 p-10 w-full max-w-sm text-center">
        <div className="flex justify-center mb-5">{icon}</div>
        <h1 className="text-xl font-bold text-stone-900 mb-2">
          {status === 'loading' ? 'Verifying your email...' : status === 'success' ? 'Email Verified!' : 'Verification Failed'}
        </h1>
        <p className="text-stone-500 text-sm mb-7">{message}</p>
        {status !== 'loading' && (
          <Link to="/login" className="btn-primary w-full justify-center">
            Sign In
          </Link>
        )}
        <div className="mt-4">
          <Link to="/" className="text-xs text-stone-400 hover:text-stone-600">← Back to home</Link>
        </div>
      </div>
    </div>
  )
}
