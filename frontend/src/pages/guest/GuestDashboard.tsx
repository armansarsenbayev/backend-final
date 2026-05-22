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

  const pct = (g: Gift) => Math.min(100, g.target_amount_kzt > 0 ? (g.current_amount_kzt / g.target_amount_kzt) * 100 : 0)

  return (
    <Layout title="Guest Dashboard">
      {msg && (
        <div className={`mb-5 ${msg.startsWith('✅') ? 'alert-success' : 'alert-warning'} justify-between`}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="ml-2 font-bold text-lg leading-none opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <p className="section-label mb-3">Registries</p>
          {loading ? (
            <div className="card flex items-center justify-center py-12 text-stone-400 text-sm gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          ) : registries.length === 0 ? (
            <div className="card text-center py-10">
              <div className="text-3xl mb-2">🌸</div>
              <p className="text-stone-500 text-sm">No registries available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {registries.map((reg) => (
                <div
                  key={reg.id}
                  onClick={() => selectRegistry(reg)}
                  className={`card-hover ${selectedReg?.id === reg.id ? 'border-amber-400 ring-2 ring-amber-100 shadow-card-hover' : ''}`}
                >
                  <div className="font-semibold text-stone-800 text-sm truncate">{reg.title}</div>
                  <div className="text-xs text-stone-400 mt-1">
                    {new Date(reg.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0">
          {!selectedReg ? (
            <div className="card flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                <span className="text-3xl">👈</span>
              </div>
              <p className="text-stone-600 font-medium">Select a registry</p>
              <p className="text-stone-400 text-sm mt-1">Choose from the list on the left</p>
            </div>
          ) : (
            <div className="card">
              {/* Header */}
              <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">{selectedReg.title}</h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {new Date(selectedReg.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                {myGuest && (
                  <span className="badge-funded text-xs">
                    You: {myGuest.display_name} · Tier {myGuest.tier_rank}
                  </span>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-stone-100 mb-5 gap-0 -mx-1">
                <button onClick={() => setActiveTab('gifts')} className={activeTab === 'gifts' ? 'tab-btn-active' : 'tab-btn-inactive'}>
                  🎁 Gifts ({gifts.length})
                </button>
                <button onClick={loadMyContributions} className={activeTab === 'history' ? 'tab-btn-active' : 'tab-btn-inactive'}>
                  📋 My Contributions
                </button>
              </div>

              {/* Gifts */}
              {activeTab === 'gifts' && (
                <div className="space-y-3">
                  {gifts.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                      <div className="text-3xl mb-2">🎁</div>
                      <p className="text-sm">No gifts in this registry</p>
                    </div>
                  ) : gifts.map((gift) => (
                    <div key={gift.id} className="border border-stone-100 rounded-2xl p-4 hover:border-stone-200 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-stone-800 text-sm">{gift.title}</span>
                            {stateBadge(gift.state)}
                          </div>
                          <div className="text-xs text-stone-400 mt-1">
                            {gift.current_amount_kzt.toLocaleString()} / {gift.target_amount_kzt.toLocaleString()} KZT
                          </div>
                          <div className="mt-2">
                            <div className="progress-track h-1.5">
                              <div className="progress-fill h-1.5" style={{ width: `${pct(gift)}%` }} />
                            </div>
                            <div className="text-right text-xs text-stone-400 mt-0.5">{Math.round(pct(gift))}%</div>
                          </div>
                        </div>
                        {gift.state === 'PENDING' && myGuest && (
                          <button onClick={() => openContribute(gift)} className="btn-primary text-xs py-2 px-3 flex-shrink-0">
                            Contribute
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Contributions history */}
              {activeTab === 'history' && (
                <div>
                  {myContributions.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                      <div className="text-3xl mb-2">📋</div>
                      <p className="text-sm">No contributions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {myContributions.map((c) => (
                        <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-stone-100">
                          <div>
                            <span className="font-semibold text-stone-800 text-sm">{c.amount_original.toLocaleString()} {c.currency_original}</span>
                            <span className="text-stone-400 text-xs ml-2">= {c.amount_kzt.toLocaleString()} KZT</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={c.status === 'FUNDED' ? 'badge-funded' : 'badge-cancelled'}>{c.status}</span>
                            <span className="text-xs text-stone-400">{new Date(c.created_at).toLocaleDateString('en-US')}</span>
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

      {/* Contribute Modal */}
      {showContribute && selectedGift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-modal w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <div>
                <h3 className="font-semibold text-stone-900">Contribute to Gift</h3>
                <p className="text-sm text-stone-500 mt-0.5">{selectedGift.title}</p>
              </div>
              <button onClick={() => setShowContribute(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-all text-xl">×</button>
            </div>
            <div className="px-6 py-5">
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
                <p className="text-sm text-amber-800">
                  Still needed: <strong>{(selectedGift.target_amount_kzt - selectedGift.current_amount_kzt).toLocaleString()} KZT</strong>
                </p>
              </div>
              <form onSubmit={submitContribution} className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Amount *</label>
                    <input
                      type="number"
                      className="input-field"
                      value={contribForm.amount_original}
                      onChange={(e) => setContribForm({ ...contribForm, amount_original: e.target.value })}
                      required min={1} placeholder="5000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">Currency</label>
                    <select className="input-field" value={contribForm.currency_original} onChange={(e) => setContribForm({ ...contribForm, currency_original: e.target.value })}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
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
