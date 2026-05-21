import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import api from '../../api/axios'

interface Gift { id: string; title: string; state: string; target_amount_kzt: number; current_amount_kzt: number; is_fragile: boolean }

function stateBadge(state: string) {
  const map: Record<string, string> = { PURCHASED: 'badge-purchased', DELIVERED: 'badge-delivered' }
  const labels: Record<string, string> = { PURCHASED: 'Куплен', DELIVERED: 'Доставлен' }
  return <span className={map[state] || 'badge-pending'}>{labels[state] || state}</span>
}

export default function CourierDashboard() {
  const [purchased, setPurchased] = useState<Gift[]>([])
  const [myDeliveries, setMyDeliveries] = useState<Gift[]>([])
  const [activeTab, setActiveTab] = useState<'available' | 'my'>('available')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const fetchData = async () => {
    setLoading(true)
    const [pRes, mRes] = await Promise.all([
      api.get('/courier/gifts').catch(() => ({ data: { data: [] } })),
      api.get('/courier/gifts/my').catch(() => ({ data: { data: [] } })),
    ])
    setPurchased(pRes.data.data || [])
    setMyDeliveries(mRes.data.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const confirmDelivery = async (giftId: string) => {
    if (!confirm('Подтвердить доставку этого подарка?')) return
    try {
      await api.patch(`/courier/gifts/${giftId}/deliver`)
      setMsg('✅ Доставка подтверждена!')
      fetchData()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setMsg(e?.response?.data?.message || 'Ошибка подтверждения доставки')
    }
  }

  return (
    <Layout title="Панель курьера">
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
          🚚 Готовы к доставке ({purchased.length})
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`px-5 py-2.5 text-sm font-medium transition ${activeTab === 'my' ? 'border-b-2 border-amber-500 text-amber-700' : 'text-gray-500'}`}
        >
          ✅ Мои доставки ({myDeliveries.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-16">Загрузка...</div>
      ) : (
        <>
          {activeTab === 'available' && (
            <div>
              {purchased.length === 0 ? (
                <div className="card text-center text-gray-400 py-16">
                  <div className="text-4xl mb-2">🚚</div>
                  <p>Нет подарков, готовых к доставке</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {purchased.map((gift) => (
                    <div key={gift.id} className="card hover:shadow-md transition">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-800">{gift.title}</h3>
                        {gift.is_fragile && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                            ⚠️ ХРУПКИЙ
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        {gift.current_amount_kzt.toLocaleString()} KZT
                      </div>
                      <div className="flex items-center justify-between">
                        {stateBadge(gift.state)}
                        <button onClick={() => confirmDelivery(gift.id)} className="btn-primary text-sm">
                          🏠 Доставлен
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
              {myDeliveries.length === 0 ? (
                <div className="card text-center text-gray-400 py-16">
                  <div className="text-4xl mb-2">📋</div>
                  <p>Нет выполненных доставок</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {myDeliveries.map((gift) => (
                    <div key={gift.id} className="card">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-800">{gift.title}</h3>
                        {gift.is_fragile && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">⚠️ Хрупкий</span>}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">{gift.current_amount_kzt.toLocaleString()} KZT</div>
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
