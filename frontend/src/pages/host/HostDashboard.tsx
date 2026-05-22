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
    PENDING: 'Pending', FUNDED: 'Funded', PURCHASED: 'Purchased',
    DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
  }
  return <span className={map[state] || 'badge-pending'}>{labels[state] || state}</span>
}

function FamilyTreeNode({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const kinshipLabels: Record<string, string> = {
    ata_ana: 'Parents', aga_apa: 'Sibling', jien: 'Niece/Nephew', kuda: 'In-Laws', dos: 'Friend', other: 'Other',
  }
  return (
    <div style={{ marginLeft: depth * 20 }} className="my-1">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${depth === 0 ? 'bg-amber-100 border-amber-400 font-semibold' : 'bg-white border-gray-200'}`}>
        <span>{node.display_name}</span>
        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{kinshipLabels[node.kinship_label] || node.kinship_label}</span>
        <span className="text-xs text-amber-600">T{node.tier_rank}</span>
      </div>
      {node.children?.map((child) => <FamilyTreeNode key={child.id} node={child} depth={depth + 1} />)}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-4">{children}</div>
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

  return (
    <Layout title="Host Dashboard">
      {msg && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg text-sm flex justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="ml-2 font-bold">×</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">My Registries</h2>
        <button onClick={() => setShowCreateReg(true)} className="btn-primary text-sm">+ New Registry</button>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        <div className="lg:w-64 flex-shrink-0">
          {loading ? (
            <div className="text-gray-400 text-sm p-4 text-center">Loading...</div>
          ) : registries.length === 0 ? (
            <div className="card text-gray-400 text-sm text-center py-8">No registries yet. Create your first!</div>
          ) : (
            <div className="space-y-2">
              {registries.map((reg) => (
                <div
                  key={reg.id}
                  onClick={() => selectRegistry(reg)}
                  className={`card cursor-pointer hover:border-amber-300 transition ${selectedReg?.id === reg.id ? 'border-amber-500 ring-2 ring-amber-200' : ''}`}
                >
                  <div className="font-medium text-gray-800 text-sm">{reg.title}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(reg.event_date).toLocaleDateString('en-US')}
                  </div>
                  <div className="text-xs mt-1">
                    <span className={`px-1.5 py-0.5 rounded ${reg.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {reg.is_public ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1">
          {!selectedReg ? (
            <div className="card text-center text-gray-400 py-16">
              <div className="text-4xl mb-2">👆</div>
              <div>Select a registry on the left</div>
            </div>
          ) : (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-800">{selectedReg.title}</h3>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(selectedReg.event_date).toLocaleDateString('en-US')}
                    {' · '}
                    <span className={selectedReg.is_public ? 'text-green-600' : 'text-gray-500'}>
                      {selectedReg.is_public ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {activeTab === 'gifts' && (
                    <button onClick={() => setShowCreateGift(true)} className="btn-primary text-sm">+ Gift</button>
                  )}
                  {activeTab === 'guests' && (
                    <button onClick={() => setShowCreateGuest(true)} className="btn-primary text-sm">+ Guest</button>
                  )}
                  {activeTab === 'tree' && (
                    <button onClick={loadFamilyTree} className="btn-secondary text-sm">Refresh Tree</button>
                  )}
                  <button onClick={() => openEditReg(selectedReg)} className="btn-secondary text-sm">✏️ Edit</button>
                  <button onClick={deleteRegistry} className="text-sm px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition">🗑 Delete</button>
                </div>
              </div>

              <div className="flex border-b mb-4 gap-1">
                {(['gifts', 'guests', 'tree'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); if (tab === 'tree') loadFamilyTree() }}
                    className={`px-4 py-2 text-sm font-medium rounded-t transition ${activeTab === tab ? 'border-b-2 border-amber-500 text-amber-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {tab === 'gifts' ? `🎁 Gifts (${gifts.length})` : tab === 'guests' ? `👥 Guests (${guests.length})` : '🌳 Family Tree'}
                  </button>
                ))}
              </div>

              {activeTab === 'gifts' && (
                <div className="space-y-2">
                  {gifts.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">No gifts yet. Add your first!</div>
                  ) : (
                    gifts.map((gift) => (
                      <div key={gift.id} className="border rounded-lg overflow-hidden">
                        <div className="p-3 flex items-center justify-between bg-gray-50">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{gift.title}</span>
                              {gift.is_fragile && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 rounded">⚠️ Fragile</span>}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {gift.current_amount_kzt.toLocaleString()} / {gift.target_amount_kzt.toLocaleString()} KZT
                              {' · '}Tier {gift.required_tier_rank}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {stateBadge(gift.state)}
                            <button onClick={() => loadContributions(gift.id)} className="text-xs text-blue-600 hover:underline">
                              Contributions
                            </button>
                            {['PENDING', 'FUNDED'].includes(gift.state) && (
                              <button onClick={() => cancelGift(gift.id)} className="text-xs text-orange-600 hover:underline">
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="px-3 pb-2 bg-gray-50">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-amber-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (gift.current_amount_kzt / gift.target_amount_kzt) * 100)}%` }}
                            />
                          </div>
                        </div>
                        {expandedGift === gift.id && (
                          <div className="p-3 border-t bg-white">
                            <p className="text-xs font-medium text-gray-600 mb-2">Contributions:</p>
                            {!contributions[gift.id]?.length ? (
                              <p className="text-xs text-gray-400">No contributions</p>
                            ) : (
                              contributions[gift.id].map((c) => (
                                <div key={c.id} className="flex justify-between text-xs text-gray-600 py-1 border-b last:border-0">
                                  <span>{c.amount_original.toLocaleString()} {c.currency_original}</span>
                                  <span>{c.amount_kzt.toLocaleString()} KZT</span>
                                  <span className={`px-1.5 py-0.5 rounded ${c.status === 'FUNDED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {c.status}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'guests' && (
                <div className="space-y-2">
                  {guests.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">No guests yet. Add your first!</div>
                  ) : (
                    guests.map((guest) => (
                      <div key={guest.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <span className="font-medium text-sm">{guest.display_name}</span>
                          <span className="ml-2 text-xs text-gray-500">{guest.kinship_label}</span>
                          <span className="ml-2 text-xs text-amber-600">Tier {guest.tier_rank}</span>
                          {guest.parent_id && <span className="ml-2 text-xs text-blue-500">↳ child node</span>}
                        </div>
                        <button onClick={() => deleteGuest(guest.id)} className="text-xs text-red-500 hover:underline">
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'tree' && (
                <div>
                  {familyTreeRoots.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <div className="text-3xl mb-2">🌳</div>
                      <p>Click "Refresh Tree" to build</p>
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-96 p-2 space-y-4">
                      {familyTreeRoots.map((root: TreeNode) => (
                        <div key={root.id}>
                          <FamilyTreeNode node={root} />
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

      {showCreateReg && (
        <Modal title="Create Registry" onClose={() => setShowCreateReg(false)}>
          <form onSubmit={createRegistry} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input className="input-field" value={regForm.title} onChange={(e) => setRegForm({ ...regForm, title: e.target.value })} required minLength={3} placeholder="e.g. Aigerim & Aset Wedding" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Date *</label>
              <input type="date" className="input-field" value={regForm.event_date} onChange={(e) => setRegForm({ ...regForm, event_date: e.target.value })} required />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={regForm.is_public} onChange={(e) => setRegForm({ ...regForm, is_public: e.target.checked })} className="rounded" />
              Public registry
            </label>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn-primary flex-1">Create</button>
              <button type="button" onClick={() => setShowCreateReg(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {showCreateGift && (
        <Modal title="Add Gift" onClose={() => setShowCreateGift(false)}>
          <form onSubmit={createGift} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input className="input-field" value={giftForm.title} onChange={(e) => setGiftForm({ ...giftForm, title: e.target.value })} required placeholder="e.g. Dinner Set" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Amount (KZT) *</label>
              <input type="number" className="input-field" value={giftForm.target_amount_kzt} onChange={(e) => setGiftForm({ ...giftForm, target_amount_kzt: e.target.value })} required min={1000} placeholder="100000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Required Tier (0 = all)</label>
              <input type="number" className="input-field" value={giftForm.required_tier_rank} onChange={(e) => setGiftForm({ ...giftForm, required_tier_rank: Number(e.target.value) })} min={0} max={5} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={giftForm.is_fragile} onChange={(e) => setGiftForm({ ...giftForm, is_fragile: e.target.checked })} />
              Fragile item
            </label>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn-primary flex-1">Add</button>
              <button type="button" onClick={() => setShowCreateGift(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {showEditReg && selectedReg && (
        <Modal title="Edit Registry" onClose={() => setShowEditReg(false)}>
          <form onSubmit={saveEditReg} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input className="input-field" value={editRegForm.title} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditRegForm({ ...editRegForm, title: e.target.value })} required minLength={3} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Date *</label>
              <input type="date" className="input-field" value={editRegForm.event_date} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditRegForm({ ...editRegForm, event_date: e.target.value })} required />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editRegForm.is_public} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditRegForm({ ...editRegForm, is_public: e.target.checked })} className="rounded" />
              Public registry
            </label>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn-primary flex-1">Save</button>
              <button type="button" onClick={() => setShowEditReg(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {showCreateGuest && (
        <Modal title="Add Guest" onClose={() => { setShowCreateGuest(false); setUserLookup(null); setUserLookupInput(''); setUserLookupError('') }}>
          <form onSubmit={createGuest} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input className="input-field" value={guestForm.display_name} onChange={(e) => setGuestForm({ ...guestForm, display_name: e.target.value })} required placeholder="e.g. Aigerim Seitkali" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kinship *</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Tier (0 = closest, 5 = most distant)</label>
              <input type="number" className="input-field" value={guestForm.tier_rank} onChange={(e) => setGuestForm({ ...guestForm, tier_rank: Number(e.target.value) })} min={0} max={5} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent Guest (optional)</label>
              <select className="input-field" value={guestForm.parent_id} onChange={(e) => setGuestForm({ ...guestForm, parent_id: e.target.value })}>
                <option value="">— no parent —</option>
                {guests.map((g) => <option key={g.id} value={g.id}>{g.display_name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link User Account <span className="text-gray-400 font-normal">(optional — lets them contribute)</span>
              </label>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  value={userLookupInput}
                  onChange={(e) => { setUserLookupInput(e.target.value); setUserLookup(null); setUserLookupError(''); setGuestForm((p) => ({ ...p, user_id: '' })) }}
                  placeholder="username"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupUser() } }}
                />
                <button type="button" onClick={lookupUser} className="btn-secondary text-sm px-3">Find</button>
              </div>
              {userLookup && (
                <div className="mt-1.5 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                  <span>✓</span>
                  <span><strong>@{userLookup.username}</strong> ({userLookup.role}) — will be linked</span>
                </div>
              )}
              {userLookupError && (
                <p className="mt-1 text-xs text-red-600">{userLookupError}</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn-primary flex-1">Add</button>
              <button type="button" onClick={() => { setShowCreateGuest(false); setUserLookup(null); setUserLookupInput(''); setUserLookupError('') }} className="btn-secondary flex-1">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  )
}
