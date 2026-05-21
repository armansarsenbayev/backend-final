import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import api from '../../api/axios'

interface Gift { id: string; title: string; state: string; target_amount_kzt: number; current_amount_kzt: number; is_fragile: boolean; registry_id?: string }

function stateBadge(state: string) {
  const map: Record<string, string> = { FUNDED: 'badge-funded', PURCHASED: 'badge-purchased', DELIVERED: 'badge-delivered' }
  const labels: Record<string, string> = { FUNDED: 'Собрано', PURCHASED: 'Куплен', DELIVERED: 'Доставлен' }
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
    if (!confirm('Подтвердить покупку этого подарка?')) return
    try {
      await api.patch(`/vendor/gifts/${giftId}/purchase`)
      setMsg('✅ Покупка подтверждена!')
      fetchData()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setMsg(e?.response?.data?.message || 'Ошибка подтверждения')
    }
  }

  return (
    <Layout title="Панель продавца">
      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm flex justify-between ${msg.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          <span>{msg}</span><button onClick={() => setMsg('')} className="font-bold ml-2">×</button>
        </div>
      )}

      <div className="flex border-b mb-6 gap-1">
        <button
          onClick={() => setActiveTab('available')}
          className={`px-5 py-2.5 text-sm font-medium transition ${activeTab === 'available' ? 'border-b-2 border-amber-500 text-amber-700' : 'text-gray-500'}`}
        >
          🛒 Доступные для покупки ({funded.length})
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`px-5 py-2.5 text-sm font-medium transition ${activeTab === 'my' ? 'border-b-2 border-amber-500 text-amber-700' : 'text-gray-500'}`}
        >
          📦 Мои покупки ({myGifts.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-16">Загрузка...</div>
      ) : (
        <>
          {activeTab === 'available' && (
            <div>
              {funded.length === 0 ? (
                <div className="card text-center text-gray-400 py-16">
                  <div className="text-4xl mb-2">🎁</div>
                  <p>Нет подарков, готовых к покупке</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {funded.map((gift) => (
                    <div key={gift.id} className="card hover:shadow-md transition">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-800">{gift.title}</h3>
                        {gift.is_fragile && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">⚠️ Хрупкий</span>}
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        Собрано: <strong>{gift.current_amount_kzt.toLocaleString()} KZT</strong>
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        Цель: {gift.target_amount_kzt.toLocaleString()} KZT
                      </div>
                      <div className="flex items-center justify-between">
                        {stateBadge(gift.state)}
                        <button onClick={() => confirmPurchase(gift.id)} className="btn-primary text-sm">
                          ✓ Подтвердить покупку
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'my' && (
            <div>
              {myGifts.length === 0 ? (
                <div className="card text-center text-gray-400 py-16">
                  <div className="text-4xl mb-2">📦</div>
                  <p>Нет активных покупок</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {myGifts.map((gift) => (
                    <div key={gift.id} className="card">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-800">{gift.title}</h3>
                        {gift.is_fragile && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">⚠️ Хрупкий</span>}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        {gift.current_amount_kzt.toLocaleString()} KZT
                      </div>
                      {stateBadge(gift.state)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
