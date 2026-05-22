import { useState, useEffect, FormEvent } from 'react'
import Layout from '../../components/Layout'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

interface Registry { id: string; title: string; event_date: string }
interface Gift { id: string; title: string; state: string; target_amount_kzt: number; current_amount_kzt: number; required_tier_rank: number }
interface Guest { id: string; display_name: string; user_id: string | null; tier_rank: number }
interface Contribution { id: string; amount_kzt: number; amount_original: number; currency_original: string; status: string; created_at: string }

const CURRENCIES = ['KZT', 'USD', 'EUR', 'RUB', 'GBP', 'CNY', 'TRY']

function stateBadge(state: string) {
  const map: Record<string, string> = { PENDING: 'badge-pending', FUNDED: 'badge-funded', PURCHASED: 'badge-purchased', DELIVERED: 'badge-delivered', CANCELLED: 'badge-cancelled' }
  const labels: Record<string, string> = { PENDING: 'Pending', FUNDED: 'Funded', PURCHASED: 'Purchased', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' }
  return <span className={map[state] || 'badge-pending'}>{labels[state] || state}</span>
}

export default function GuestDashboard() {
  const { user } = useAuth()
  const [registries, setRegistries] = useState<Registry[]>([])
  const [selectedReg, setSelectedReg] = useState<Registry | null>(null)
  const [gifts, setGifts] = useState<Gift[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [myGuest, setMyGuest] = useState<Guest | null>(null)
  const [myContributions, setMyContributions] = useState<Contribution[]>([])
  const [activeTab, setActiveTab] = useState<'gifts' | 'history'>('gifts')

  const [showContribute, setShowContribute] = useState(false)
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null)
  const [contribForm, setContribForm] = useState({ amount_original: '', currency_original: 'KZT' })
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/registries').then((r) => { setRegistries(r.data.data || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const selectRegistry = async (reg: Registry) => {
    setSelectedReg(reg)
    setMyGuest(null)
    setMsg('')
    const [gRes, gsRes] = await Promise.all([
      api.get(`/registries/${reg.id}/gifts`),
      api.get(`/registries/${reg.id}/guests`),
    ])
    const fetchedGuests: Guest[] = gsRes.data.data || []
    setGifts(gRes.data.data || [])
    setGuests(fetchedGuests)
    const me = fetchedGuests.find((g) => g.user_id === user?.id)
    setMyGuest(me || null)
    if (!me) setMsg('You are not registered as a guest in this registry. Please contact the host.')
  }

  const loadMyContributions = async () => {
    if (!selectedReg) return
    const giftIds = gifts.map((g) => g.id)
    const all: Contribution[] = []
    await Promise.all(
      giftIds.map((id) =>
        api.get(`/gifts/${id}/contributions`).then((r) => all.push(...(r.data.data || []))).catch(() => null)
      )
    )
    setMyContributions(all)
    setActiveTab('history')
  }

  const openContribute = (gift: Gift) => {
    if (!myGuest) { setMsg('First select a registry where you are a guest'); return }
    if (gift.state !== 'PENDING') { setMsg('This gift is not accepting contributions right now'); return }
    setSelectedGift(gift)
    setContribForm({ amount_original: '', currency_original: 'KZT' })
    setShowContribute(true)
  }

  const submitContribution = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedGift || !myGuest) return
    try {
      await api.post(`/gifts/${selectedGift.id}/contributions`, {
        guest_id: myGuest.id,
        amount_original: Number(contribForm.amount_original),
        currency_original: contribForm.currency_original,
      })
      setShowContribute(false)
      setMsg('✅ Contribution submitted successfully!')
      const res = await api.get(`/registries/${selectedReg!.id}/gifts`)
      setGifts(res.data.data || [])
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setMsg(e?.response?.data?.message || 'Contribution failed')
    }
  }

  return (
    <Layout title="Guest Dashboard">
      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm flex justify-between ${msg.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'}`}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="ml-2 font-bold">×</button>
        </div>
      )}

      <div className="flex gap-4 flex-col lg:flex-row">
        <div className="lg:w-64 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Registries</h2>
          {loading ? (
            <div className="text-gray-400 text-sm p-4 text-center">Loading...</div>
          ) : registries.length === 0 ? (
            <div className="card text-gray-400 text-sm text-center py-8">No registries available</div>
          ) : (
            <div className="space-y-2">
              {registries.map((reg) => (
                <div
                  key={reg.id}
                  onClick={() => selectRegistry(reg)}
                  className={`card cursor-pointer hover:border-amber-300 transition ${selectedReg?.id === reg.id ? 'border-amber-500 ring-2 ring-amber-200' : ''}`}
                >
                  <div className="font-medium text-gray-800 text-sm">{reg.title}</div>
                  <div className="text-xs text-gray-400 mt-1">{new Date(reg.event_date).toLocaleDateString('en-US')}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1">
          {!selectedReg ? (
            <div className="card text-center text-gray-400 py-16">
              <div className="text-4xl mb-2">👈</div>
              <div>Select a registry</div>
            </div>
          ) : (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">{selectedReg.title}</h3>
                {myGuest && <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">You: {myGuest.display_name} (Tier {myGuest.tier_rank})</span>}
              </div>

              <div className="flex border-b mb-4 gap-1">
                <button
                  onClick={() => setActiveTab('gifts')}
                  className={`px-4 py-2 text-sm font-medium transition ${activeTab === 'gifts' ? 'border-b-2 border-amber-500 text-amber-700' : 'text-gray-500'}`}
                >
                  🎁 Gifts
                </button>
                <button
                  onClick={loadMyContributions}
                  className={`px-4 py-2 text-sm font-medium transition ${activeTab === 'history' ? 'border-b-2 border-amber-500 text-amber-700' : 'text-gray-500'}`}
                >
                  📋 My Contributions
                </button>
              </div>

              {activeTab === 'gifts' && (
                <div className="space-y-2">
                  {gifts.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">No gifts in this registry</div>
                  ) : (
                    gifts.map((gift) => (
                      <div key={gift.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{gift.title}</span>
                              {stateBadge(gift.state)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {gift.current_amount_kzt.toLocaleString()} / {gift.target_amount_kzt.toLocaleString()} KZT
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                              <div
                                className="bg-amber-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, (gift.current_amount_kzt / gift.target_amount_kzt) * 100)}%` }}
                              />
                            </div>
                          </div>
                          {gift.state === 'PENDING' && myGuest && (
                            <button onClick={() => openContribute(gift)} className="btn-primary text-xs ml-3">
                              Contribute
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div>
                  {myContributions.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">No contributions yet</div>
                  ) : (
                    <div className="space-y-2">
                      {myContributions.map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                          <div>
                            <span className="font-medium">{c.amount_original.toLocaleString()} {c.currency_original}</span>
                            <span className="text-gray-500 ml-2">= {c.amount_kzt.toLocaleString()} KZT</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${c.status === 'FUNDED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                            <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('en-US')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showContribute && selectedGift && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Contribute to: {selectedGift.title}</h3>
              <button onClick={() => setShowContribute(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Still needed: <strong>{(selectedGift.target_amount_kzt - selectedGift.current_amount_kzt).toLocaleString()} KZT</strong>
              </p>
              <form onSubmit={submitContribution} className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                    <input
                      type="number"
                      className="input-field"
                      value={contribForm.amount_original}
                      onChange={(e) => setContribForm({ ...contribForm, amount_original: e.target.value })}
                      required
                      min={1}
                      placeholder="5000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select
                      className="input-field"
                      value={contribForm.currency_original}
                      onChange={(e) => setContribForm({ ...contribForm, currency_original: e.target.value })}
                    >
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="btn-primary flex-1">Submit</button>
                  <button type="button" onClick={() => setShowContribute(false)} className="btn-secondary flex-1">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
