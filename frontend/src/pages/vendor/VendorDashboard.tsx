import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import api from '../../api/axios'

interface Gift { id: string; title: string; state: string; target_amount_kzt: number; current_amount_kzt: number; is_fragile: boolean; registry_id?: string }

function stateBadge(state: string) {
  const map: Record<string, string> = { FUNDED: 'badge-funded', PURCHASED: 'badge-purchased', DELIVERED: 'badge-delivered' }
  const labels: Record<string, string> = { FUNDED: 'Funded', PURCHASED: 'Purchased', DELIVERED: 'Delivered' }
  return <span className={map[state] || 'badge-pending'}>{labels[state] || state}</span>
}

export default function VendorDashboard() {
  const [funded, setFunded] = useState<Gift[]>([])
  const [myGifts, setMyGifts] = useState<Gift[]>([])
  const [activeTab, setActiveTab] = useState<'available' | 'my'>('available')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const fetchData = async () => {
    setLoading(true)
    const [fundedRes, myRes] = await Promise.all([
      api.get('/vendor/gifts').catch(() => ({ data: { data: [] } })),
      api.get('/vendor/gifts/my').catch(() => ({ data: { data: [] } })),
    ])
    setFunded(fundedRes.data.data || [])
    setMyGifts(myRes.data.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const confirmPurchase = async (giftId: string) => {
    if (!confirm('Confirm purchase of this gift?')) return
    try {
      await api.patch(`/vendor/gifts/${giftId}/purchase`)
      setMsg('✅ Purchase confirmed!')
      fetchData()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setMsg(e?.response?.data?.message || 'Confirmation failed')
    }
  }

  return (
    <Layout title="Vendor Dashboard">
      {msg && (
        <div className={`mb-5 ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'} justify-between`}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="font-bold ml-2 text-lg leading-none opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      <div className="flex border-b border-stone-100 mb-6 gap-0">
        <button onClick={() => setActiveTab('available')} className={activeTab === 'available' ? 'tab-btn-active' : 'tab-btn-inactive'}>
          🛒 Available ({funded.length})
        </button>
        <button onClick={() => setActiveTab('my')} className={activeTab === 'my' ? 'tab-btn-active' : 'tab-btn-inactive'}>
          📦 My Purchases ({myGifts.length})
        </button>
        <button onClick={fetchData} className="ml-auto btn-secondary text-xs py-1.5 px-3 mb-px">
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-stone-400 gap-2">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      ) : (
        <>
          {activeTab === 'available' && (
            funded.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4 text-3xl">🎁</div>
                <p className="text-stone-600 font-medium">No gifts ready for purchase</p>
                <p className="text-stone-400 text-sm mt-1">Check back later when guests have funded gifts</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {funded.map((gift) => (
                  <div key={gift.id} className="card hover:shadow-card-hover transition-all duration-200">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-stone-800 text-sm leading-tight">{gift.title}</h3>
                      {gift.is_fragile && (
                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-lg flex-shrink-0 ml-2">⚠️ Fragile</span>
                      )}
                    </div>
                    <div className="space-y-1 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Funded</span>
                        <span className="font-semibold text-emerald-700">{gift.current_amount_kzt.toLocaleString()} KZT</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Target</span>
                        <span className="text-stone-600">{gift.target_amount_kzt.toLocaleString()} KZT</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-stone-50">
                      {stateBadge(gift.state)}
                      <button onClick={() => confirmPurchase(gift.id)} className="btn-primary text-xs py-2 px-3">
                        ✓ Purchase
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'my' && (
            myGifts.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4 text-3xl">📦</div>
                <p className="text-stone-600 font-medium">No active purchases</p>
                <p className="text-stone-400 text-sm mt-1">Your purchased gifts will appear here</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {myGifts.map((gift) => (
                  <div key={gift.id} className="card">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-stone-800 text-sm">{gift.title}</h3>
                      {gift.is_fragile && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-lg ml-2">⚠️ Fragile</span>}
                    </div>
                    <div className="text-sm text-stone-600 mb-3">{gift.current_amount_kzt.toLocaleString()} KZT</div>
                    {stateBadge(gift.state)}
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </Layout>
  )
}
