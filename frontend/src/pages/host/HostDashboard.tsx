import { useState, useEffect, FormEvent, ChangeEvent } from 'react'
import Layout from '../../components/Layout'
import api from '../../api/axios'

interface Registry { id: string; title: string; event_date: string; is_public: boolean }
interface Gift { id: string; title: string; state: string; target_amount_kzt: number; current_amount_kzt: number; required_tier_rank: number; is_fragile: boolean }
interface Guest { id: string; display_name: string; kinship_label: string; tier_rank: number; parent_id: string | null; user_id: string | null }
interface Contribution { id: string; amount_kzt: number; amount_original: number; currency_original: string; status: string; created_at: string }
interface TreeNode { id: string; display_name: string; kinship_label: string; tier_rank: number; children?: TreeNode[] }
interface FlatNode { id: string; parent_id: string | null; display_name: string; kinship_label: string; tier_rank: number }

function buildForest(nodes: FlatNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  for (const n of nodes) map.set(n.id, { id: n.id, display_name: n.display_name, kinship_label: n.kinship_label, tier_rank: n.tier_rank, children: [] })
  const roots: TreeNode[] = []
  for (const n of nodes) {
    const node = map.get(n.id)!
    if (n.parent_id && map.has(n.parent_id)) map.get(n.parent_id)!.children!.push(node)
    else if (!n.parent_id) roots.push(node)
  }
  return roots
}

function stateBadge(state: string) {
  const map: Record<string, string> = {
    PENDING: 'badge-pending', FUNDED: 'badge-funded', PURCHASED: 'badge-purchased',
    DELIVERED: 'badge-delivered', CANCELLED: 'badge-cancelled',
  }
  const labels: Record<string, string> = {
    PENDING: 'Pending', FUNDED: 'Funded', PURCHASED: 'Purchased', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
  }
  return <span className={map[state] || 'badge-pending'}>{labels[state] || state}</span>
}

const KINSHIP_LABELS: Record<string, string> = {
  ata_ana: 'Parents', aga_apa: 'Sibling', jien: 'Niece/Nephew', kuda: 'In-Laws', dos: 'Friend', other: 'Other',
}

function FamilyTreeNode({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  return (
    <div style={{ marginLeft: depth * 24 }} className="my-1">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition-all ${depth === 0 ? 'bg-amber-50 border-amber-300 font-semibold text-amber-900' : 'bg-white border-stone-200 text-stone-700'}`}>
        <span>{node.display_name}</span>
        <span className="text-xs text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-lg">{KINSHIP_LABELS[node.kinship_label] || node.kinship_label}</span>
        <span className="text-xs text-amber-600 font-medium">T{node.tier_rank}</span>
      </div>
      {node.children?.map((child) => <FamilyTreeNode key={child.id} node={child} depth={depth + 1} />)}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-modal w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h3 className="font-semibold text-stone-900 text-lg">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-all text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function HostDashboard() {
  const [registries, setRegistries] = useState<Registry[]>([])
  const [selectedReg, setSelectedReg] = useState<Registry | null>(null)
  const [gifts, setGifts] = useState<Gift[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [activeTab, setActiveTab] = useState<'gifts' | 'guests' | 'tree'>('gifts')
  const [familyTreeRoots, setFamilyTreeRoots] = useState<TreeNode[]>([])
  const [contributions, setContributions] = useState<Record<string, Contribution[]>>({})
  const [expandedGift, setExpandedGift] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const [showCreateReg, setShowCreateReg] = useState(false)
  const [showCreateGift, setShowCreateGift] = useState(false)
  const [showCreateGuest, setShowCreateGuest] = useState(false)
  const [showEditReg, setShowEditReg] = useState(false)
  const [editRegForm, setEditRegForm] = useState({ title: '', event_date: '', is_public: true })

  const [regForm, setRegForm] = useState({ title: '', event_date: '', is_public: true })
  const [giftForm, setGiftForm] = useState({ title: '', target_amount_kzt: '', required_tier_rank: 0, is_fragile: false })
  const [guestForm, setGuestForm] = useState({ display_name: '', kinship_label: 'other', tier_rank: 0, parent_id: '', user_id: '' })
  const [userLookup, setUserLookup] = useState<{ username: string; role: string } | null>(null)
  const [userLookupInput, setUserLookupInput] = useState('')
  const [userLookupError, setUserLookupError] = useState('')

  useEffect(() => {
    api.get('/registries').then((r) => { setRegistries(r.data.data || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const selectRegistry = async (reg: Registry) => {
    setSelectedReg(reg)
    setActiveTab('gifts')
    setFamilyTreeRoots([])
    const [gRes, gsRes] = await Promise.all([
      api.get(`/registries/${reg.id}/gifts`),
      api.get(`/registries/${reg.id}/guests`),
    ])
    setGifts(gRes.data.data || [])
    setGuests(gsRes.data.data || [])
  }

  const loadContributions = async (giftId: string) => {
    if (contributions[giftId]) { setExpandedGift(expandedGift === giftId ? null : giftId); return }
    const res = await api.get(`/gifts/${giftId}/contributions`)
    setContributions((prev) => ({ ...prev, [giftId]: res.data.data || [] }))
    setExpandedGift(giftId)
  }

  const loadFamilyTree = () => {
    if (!guests.length) { setMsg('No guests to build the tree'); return }
    setFamilyTreeRoots(buildForest(guests))
  }

  const openEditReg = (reg: Registry) => {
    setEditRegForm({
      title: reg.title,
      event_date: new Date(reg.event_date).toISOString().split('T')[0],
      is_public: reg.is_public,
    })
    setShowEditReg(true)
  }

  const saveEditReg = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedReg) return
    try {
      const res = await api.patch(`/registries/${selectedReg.id}`, {
        title: editRegForm.title,
        event_date: new Date(editRegForm.event_date).toISOString(),
        is_public: editRegForm.is_public,
      })
      const updated = res.data
      setRegistries((prev) => prev.map((r: Registry) => (r.id === updated.id ? updated : r)))
      setSelectedReg(updated)
      setShowEditReg(false)
    } catch (err) {
      const e = err as { response?: { data?: { error?: string; details?: { issue: string }[] } } }
      const details = e?.response?.data?.details
      setMsg(details?.length ? details.map((d) => d.issue).join(', ') : e?.response?.data?.error || 'Failed to update registry')
    }
  }

  const deleteRegistry = async () => {
    if (!selectedReg || !confirm(`Delete registry "${selectedReg.title}"? This cannot be undone.`)) return
    try {
      await api.delete(`/registries/${selectedReg.id}`)
      setRegistries((prev) => prev.filter((r: Registry) => r.id !== selectedReg.id))
      setSelectedReg(null)
      setGifts([])
      setGuests([])
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      setMsg(e?.response?.data?.error || 'Failed to delete registry')
    }
  }

  const createRegistry = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const res = await api.post('/registries', { ...regForm, event_date: new Date(regForm.event_date).toISOString() })
      setRegistries((prev) => [res.data, ...prev])
      setShowCreateReg(false)
      setRegForm({ title: '', event_date: '', is_public: true })
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setMsg(e?.response?.data?.message || 'Failed to create registry')
    }
  }

  const createGift = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedReg) return
    try {
      const res = await api.post(`/registries/${selectedReg.id}/gifts`, {
        ...giftForm, target_amount_kzt: Number(giftForm.target_amount_kzt),
      })
      setGifts((prev) => [res.data, ...prev])
      setShowCreateGift(false)
      setGiftForm({ title: '', target_amount_kzt: '', required_tier_rank: 0, is_fragile: false })
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setMsg(e?.response?.data?.message || 'Failed to add gift')
    }
  }

  const cancelGift = async (giftId: string) => {
    if (!confirm('Cancel this gift?')) return
    try {
      const res = await api.patch(`/gifts/${giftId}/cancel`)
      setGifts((prev) => prev.map((g) => (g.id === giftId ? res.data : g)))
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setMsg(e?.response?.data?.message || 'Cancellation failed')
    }
  }

  const lookupUser = async () => {
    setUserLookupError('')
    setUserLookup(null)
    if (!userLookupInput.trim()) return
    try {
      const res = await api.get(`/users/lookup?username=${encodeURIComponent(userLookupInput.trim())}`)
      setUserLookup({ username: res.data.username, role: res.data.role })
      setGuestForm((prev) => ({ ...prev, user_id: res.data.id }))
    } catch {
      setUserLookupError('User not found')
      setGuestForm((prev) => ({ ...prev, user_id: '' }))
    }
  }

  const createGuest = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedReg) return
    try {
      const body = {
        display_name: guestForm.display_name,
        kinship_label: guestForm.kinship_label,
        tier_rank: guestForm.tier_rank,
        parent_id: guestForm.parent_id || null,
        user_id: guestForm.user_id || null,
      }
      const res = await api.post(`/registries/${selectedReg.id}/guests`, body)
      setGuests((prev) => [...prev, res.data])
      setShowCreateGuest(false)
      setGuestForm({ display_name: '', kinship_label: 'other', tier_rank: 0, parent_id: '', user_id: '' })
      setUserLookup(null)
      setUserLookupInput('')
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setMsg(e?.response?.data?.message || 'Failed to add guest')
    }
  }

  const deleteGuest = async (guestId: string) => {
    if (!confirm('Remove this guest?') || !selectedReg) return
    try {
      await api.delete(`/registries/${selectedReg.id}/guests/${guestId}`)
      setGuests((prev) => prev.filter((g) => g.id !== guestId))
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setMsg(e?.response?.data?.message || 'Deletion failed')
    }
  }

  const pct = (g: Gift) => Math.min(100, g.target_amount_kzt > 0 ? (g.current_amount_kzt / g.target_amount_kzt) * 100 : 0)

  return (
    <Layout title="Host Dashboard">
      {msg && (
        <div className="mb-5 alert-warning justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="ml-2 font-bold text-lg leading-none opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">My Registries</h2>
          <p className="text-sm text-stone-500 mt-0.5">{registries.length} {registries.length === 1 ? 'registry' : 'registries'}</p>
        </div>
        <button onClick={() => setShowCreateReg(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Registry
        </button>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Registry list sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          {loading ? (
            <div className="card flex items-center justify-center py-12 text-stone-400">
              <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          ) : registries.length === 0 ? (
            <div className="card text-center py-10">
              <div className="text-3xl mb-2">🌸</div>
              <p className="text-stone-500 text-sm">No registries yet.</p>
              <p className="text-stone-400 text-xs mt-1">Create your first one!</p>
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
                  <div className="mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${reg.is_public ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                      {reg.is_public ? 'Public' : 'Private'}
                    </span>
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
              {/* Registry header */}
              <div className="flex items-start justify-between mb-5 gap-4">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">{selectedReg.title}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-stone-400">
                      {new Date(selectedReg.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    <span className="text-stone-200">·</span>
                    <span className={`text-xs font-medium ${selectedReg.is_public ? 'text-emerald-600' : 'text-stone-500'}`}>
                      {selectedReg.is_public ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                  <button onClick={() => openEditReg(selectedReg)} className="btn-secondary text-xs py-1.5 px-3">
                    Edit
                  </button>
                  <button onClick={deleteRegistry} className="text-xs px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-all font-semibold">
                    Delete
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mb-5 flex-wrap">
                {activeTab === 'gifts' && (
                  <button onClick={() => setShowCreateGift(true)} className="btn-primary text-xs py-2 px-3">+ Add Gift</button>
                )}
                {activeTab === 'guests' && (
                  <button onClick={() => setShowCreateGuest(true)} className="btn-primary text-xs py-2 px-3">+ Add Guest</button>
                )}
                {activeTab === 'tree' && (
                  <button onClick={loadFamilyTree} className="btn-secondary text-xs py-2 px-3">Refresh Tree</button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-stone-100 mb-5 gap-0 -mx-1">
                {(['gifts', 'guests', 'tree'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); if (tab === 'tree') loadFamilyTree() }}
                    className={tab === activeTab ? 'tab-btn-active' : 'tab-btn-inactive'}
                  >
                    {tab === 'gifts' ? `🎁 Gifts (${gifts.length})` : tab === 'guests' ? `👥 Guests (${guests.length})` : '🌳 Family Tree'}
                  </button>
                ))}
              </div>

              {/* Gifts tab */}
              {activeTab === 'gifts' && (
                <div className="space-y-3">
                  {gifts.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                      <div className="text-3xl mb-2">🎁</div>
                      <p className="text-sm">No gifts yet. Add your first!</p>
                    </div>
                  ) : gifts.map((gift) => (
                    <div key={gift.id} className="border border-stone-100 rounded-2xl overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-stone-800 text-sm">{gift.title}</span>
                              {gift.is_fragile && (
                                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-lg">⚠️ Fragile</span>
                              )}
                              {stateBadge(gift.state)}
                            </div>
                            <div className="text-xs text-stone-400 mt-1">
                              {gift.current_amount_kzt.toLocaleString()} / {gift.target_amount_kzt.toLocaleString()} KZT · Tier {gift.required_tier_rank}
                            </div>
                            <div className="mt-2">
                              <div className="progress-track h-1.5">
                                <div className="progress-fill h-1.5" style={{ width: `${pct(gift)}%` }} />
                              </div>
                              <div className="text-right text-xs text-stone-400 mt-0.5">{Math.round(pct(gift))}%</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <button onClick={() => loadContributions(gift.id)} className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline">
                              {expandedGift === gift.id ? 'Hide' : 'Contributions'}
                            </button>
                            {['PENDING', 'FUNDED'].includes(gift.state) && (
                              <button onClick={() => cancelGift(gift.id)} className="text-xs text-stone-400 hover:text-red-600 font-medium hover:underline">
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {expandedGift === gift.id && (
                        <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
                          <p className="text-xs font-semibold text-stone-500 mb-2 uppercase tracking-wide">Contributions</p>
                          {!contributions[gift.id]?.length ? (
                            <p className="text-xs text-stone-400">No contributions yet</p>
                          ) : contributions[gift.id].map((c) => (
                            <div key={c.id} className="flex justify-between items-center text-xs py-1.5 border-b border-stone-100 last:border-0">
                              <span className="text-stone-700 font-medium">{c.amount_original.toLocaleString()} {c.currency_original}</span>
                              <span className="text-stone-500">= {c.amount_kzt.toLocaleString()} KZT</span>
                              <span className={c.status === 'FUNDED' ? 'badge-funded' : 'badge-cancelled'}>{c.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Guests tab */}
              {activeTab === 'guests' && (
                <div className="space-y-2">
                  {guests.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                      <div className="text-3xl mb-2">👥</div>
                      <p className="text-sm">No guests yet. Add your first!</p>
                    </div>
                  ) : guests.map((guest) => (
                    <div key={guest.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-stone-100 hover:border-stone-200 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm flex-shrink-0">
                          {guest.display_name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-sm text-stone-800">{guest.display_name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-stone-400">{KINSHIP_LABELS[guest.kinship_label] || guest.kinship_label}</span>
                            <span className="text-xs text-amber-600 font-medium">Tier {guest.tier_rank}</span>
                            {guest.parent_id && <span className="text-xs text-blue-400">↳ child</span>}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => deleteGuest(guest.id)} className="text-xs text-stone-300 hover:text-red-500 font-medium transition-colors">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Family Tree tab */}
              {activeTab === 'tree' && (
                <div>
                  {familyTreeRoots.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                      <div className="text-4xl mb-3">🌳</div>
                      <p className="text-sm font-medium">Click "Refresh Tree" to build</p>
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-96 p-2 space-y-4">
                      {familyTreeRoots.map((root: TreeNode) => (
                        <FamilyTreeNode key={root.id} node={root} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Registry Modal */}
      {showCreateReg && (
        <Modal title="New Registry" onClose={() => setShowCreateReg(false)}>
          <form onSubmit={createRegistry} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Title *</label>
              <input className="input-field" value={regForm.title} onChange={(e) => setRegForm({ ...regForm, title: e.target.value })} required minLength={3} placeholder="e.g. Aigerim & Aset Wedding" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Event Date *</label>
              <input type="date" className="input-field" value={regForm.event_date} onChange={(e) => setRegForm({ ...regForm, event_date: e.target.value })} required />
            </div>
            <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer">
              <input type="checkbox" checked={regForm.is_public} onChange={(e) => setRegForm({ ...regForm, is_public: e.target.checked })} className="rounded w-4 h-4 accent-amber-600" />
              Public registry (visible to all)
            </label>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex-1">Create</button>
              <button type="button" onClick={() => setShowCreateReg(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Gift Modal */}
      {showCreateGift && (
        <Modal title="Add Gift" onClose={() => setShowCreateGift(false)}>
          <form onSubmit={createGift} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Title *</label>
              <input className="input-field" value={giftForm.title} onChange={(e) => setGiftForm({ ...giftForm, title: e.target.value })} required placeholder="e.g. Dinner Set" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Target Amount (KZT) *</label>
              <input type="number" className="input-field" value={giftForm.target_amount_kzt} onChange={(e) => setGiftForm({ ...giftForm, target_amount_kzt: e.target.value })} required min={1000} placeholder="100000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Required Tier <span className="text-stone-400 font-normal">(0 = everyone)</span></label>
              <input type="number" className="input-field" value={giftForm.required_tier_rank} onChange={(e) => setGiftForm({ ...giftForm, required_tier_rank: Number(e.target.value) })} min={0} max={5} />
            </div>
            <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer">
              <input type="checkbox" checked={giftForm.is_fragile} onChange={(e) => setGiftForm({ ...giftForm, is_fragile: e.target.checked })} className="rounded w-4 h-4 accent-amber-600" />
              Fragile item (requires careful handling)
            </label>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex-1">Add Gift</button>
              <button type="button" onClick={() => setShowCreateGift(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Registry Modal */}
      {showEditReg && selectedReg && (
        <Modal title="Edit Registry" onClose={() => setShowEditReg(false)}>
          <form onSubmit={saveEditReg} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Title *</label>
              <input className="input-field" value={editRegForm.title} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditRegForm({ ...editRegForm, title: e.target.value })} required minLength={3} />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Event Date *</label>
              <input type="date" className="input-field" value={editRegForm.event_date} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditRegForm({ ...editRegForm, event_date: e.target.value })} required />
            </div>
            <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer">
              <input type="checkbox" checked={editRegForm.is_public} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditRegForm({ ...editRegForm, is_public: e.target.checked })} className="rounded w-4 h-4 accent-amber-600" />
              Public registry
            </label>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex-1">Save Changes</button>
              <button type="button" onClick={() => setShowEditReg(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Guest Modal */}
      {showCreateGuest && (
        <Modal title="Add Guest" onClose={() => { setShowCreateGuest(false); setUserLookup(null); setUserLookupInput(''); setUserLookupError('') }}>
          <form onSubmit={createGuest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Name *</label>
              <input className="input-field" value={guestForm.display_name} onChange={(e) => setGuestForm({ ...guestForm, display_name: e.target.value })} required placeholder="e.g. Aigerim Seitkali" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Kinship *</label>
              <select className="input-field" value={guestForm.kinship_label} onChange={(e) => setGuestForm({ ...guestForm, kinship_label: e.target.value })}>
                <option value="ata_ana">Parents (ata_ana)</option>
                <option value="aga_apa">Sibling (aga_apa)</option>
                <option value="jien">Niece/Nephew (jien)</option>
                <option value="kuda">In-Laws (kuda)</option>
                <option value="dos">Friend (dos)</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Tier <span className="text-stone-400 font-normal">(0 = closest, 5 = most distant)</span></label>
              <input type="number" className="input-field" value={guestForm.tier_rank} onChange={(e) => setGuestForm({ ...guestForm, tier_rank: Number(e.target.value) })} min={0} max={5} />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Parent Guest <span className="text-stone-400 font-normal">(optional)</span></label>
              <select className="input-field" value={guestForm.parent_id} onChange={(e) => setGuestForm({ ...guestForm, parent_id: e.target.value })}>
                <option value="">— no parent —</option>
                {guests.map((g) => <option key={g.id} value={g.id}>{g.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Link User Account <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  value={userLookupInput}
                  onChange={(e) => { setUserLookupInput(e.target.value); setUserLookup(null); setUserLookupError(''); setGuestForm((p) => ({ ...p, user_id: '' })) }}
                  placeholder="username"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupUser() } }}
                />
                <button type="button" onClick={lookupUser} className="btn-secondary px-3">Find</button>
              </div>
              {userLookup && (
                <div className="mt-2 alert-success">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span><strong>@{userLookup.username}</strong> ({userLookup.role}) will be linked</span>
                </div>
              )}
              {userLookupError && <p className="mt-1.5 text-xs text-red-600">{userLookupError}</p>}
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex-1">Add Guest</button>
              <button type="button" onClick={() => { setShowCreateGuest(false); setUserLookup(null); setUserLookupInput(''); setUserLookupError('') }} className="btn-secondary flex-1">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  )
}
