import { useState, useEffect, FormEvent } from 'react'
import Layout from '../../components/Layout'
import api from '../../api/axios'

interface User { id: string; email: string; username: string; role: string; is_active: boolean; is_email_verified: boolean; created_at: string }
interface Registry { id: string; title: string; event_date: string; is_public: boolean; host: { username: string; email: string }; _count: { gifts: number; guests: number } }
interface Contribution { id: string; amount_kzt: number; amount_original: number; currency_original: string; status: string; created_at: string; guest: { displayName: string } | null; gift: { title: string } | null }
interface AuditLog { id: string; action: string; entity_type: string; entity_id: string; created_at: string; user: { username: string; email: string } | null; metadata?: Record<string, unknown> }
interface QueueStatus { waiting?: number; active?: number; completed?: number; failed?: number; delayed?: number }

const ROLE_LABELS: Record<string, string> = { HOST: 'Host', GUEST: 'Guest', VENDOR: 'Vendor', COURIER: 'Courier', ADMIN: 'Administrator' }
const ROLES = ['', 'HOST', 'GUEST', 'VENDOR', 'COURIER', 'ADMIN']

type Tab = 'users' | 'registries' | 'contributions' | 'audit' | 'queue' | 'create-admin'

const TAB_CONFIG: { id: Tab; label: string }[] = [
  { id: 'users', label: '👥 Users' },
  { id: 'registries', label: '📋 Registries' },
  { id: 'contributions', label: '💰 Contributions' },
  { id: 'audit', label: '📜 Audit Log' },
  { id: 'queue', label: '⚙️ Queue' },
  { id: 'create-admin', label: '🔐 New Admin' },
]

const roleColor = (role: string) => {
  const map: Record<string, string> = {
    HOST: 'bg-purple-100 text-purple-700', GUEST: 'bg-blue-100 text-blue-700',
    VENDOR: 'bg-orange-100 text-orange-700', COURIER: 'bg-teal-100 text-teal-700',
    ADMIN: 'bg-red-100 text-red-700',
  }
  return map[role] || 'bg-gray-100 text-gray-600'
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="pb-2 pr-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2.5 pr-4 text-sm ${className}`}>{children}</td>
}
function Empty({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} className="text-center text-gray-400 py-10 text-sm">{text}</td></tr>
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [msg, setMsg] = useState('')

  const [users, setUsers] = useState<User[]>([])
  const [roleFilter, setRoleFilter] = useState('')
  const [usersLoading, setUsersLoading] = useState(true)

  const [registries, setRegistries] = useState<Registry[]>([])
  const [regsLoading, setRegsLoading] = useState(false)

  const [contributions, setContributions] = useState<Contribution[]>([])
  const [contribLoading, setContribLoading] = useState(false)

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)

  const [adminForm, setAdminForm] = useState({ email: '', username: '', password: '', adminKey: '' })
  const [adminLoading, setAdminLoading] = useState(false)

  const fetchUsers = async (role = '') => {
    setUsersLoading(true)
    const url = role ? `/admin/users?role=${role}` : '/admin/users'
    const res = await api.get(url).catch(() => ({ data: { data: [] } }))
    setUsers(res.data?.data || [])
    setUsersLoading(false)
  }

  const fetchRegistries = async () => {
    setRegsLoading(true)
    const res = await api.get('/admin/registries').catch(() => ({ data: { data: [] } }))
    setRegistries(res.data?.data || [])
    setRegsLoading(false)
  }

  const fetchContributions = async () => {
    setContribLoading(true)
    const res = await api.get('/admin/contributions').catch(() => ({ data: { data: [] } }))
    setContributions(res.data?.data || [])
    setContribLoading(false)
  }

  const fetchAuditLogs = async () => {
    setAuditLoading(true)
    const res = await api.get('/admin/audit-logs').catch(() => ({ data: { data: [] } }))
    setAuditLogs(res.data?.data || [])
    setAuditLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const switchTab = (tab: Tab) => {
    setActiveTab(tab)
    if (tab === 'registries' && (!registries || registries.length === 0)) fetchRegistries()
    if (tab === 'contributions' && (!contributions || contributions.length === 0)) fetchContributions()
    if (tab === 'audit' && (!auditLogs || auditLogs.length === 0)) fetchAuditLogs()
    if (tab === 'queue') api.get('/admin/queue-status').catch(() => ({ data: {} })).then((r) => setQueueStatus(r.data))
  }

  const toggleActive = async (userId: string, isActive: boolean) => {
    try {
      const res = await api.patch(`/admin/users/${userId}/activate`, { isActive: !isActive })
      setUsers((prev) => prev.map((u) => (u.id === userId ? res.data : u)))
      setMsg(`✅ User ${!isActive ? 'activated' : 'deactivated'}`)
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      setMsg(e?.response?.data?.error || 'Error')
    }
  }

  const deleteRegistry = async (id: string, title: string) => {
    if (!confirm(`Delete registry "${title}"? This will also delete all its gifts and guests.`)) return
    try {
      await api.delete(`/admin/registries/${id}`)
      setRegistries((prev) => prev.filter((r: Registry) => r.id !== id))
      setMsg('✅ Registry deleted')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      setMsg(e?.response?.data?.error || 'Failed to delete')
    }
  }

  const deleteUser = async (id: string, username: string) => {
    if (!confirm(`Delete user @${username}? This cannot be undone.`)) return
    try {
      await api.delete(`/admin/users/${id}`)
      setUsers((prev) => prev.filter((u: User) => u.id !== id))
      setMsg(`✅ User @${username} deleted`)
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      setMsg(e?.response?.data?.error || 'Failed to delete')
    }
  }

  const createAdmin = async (e: FormEvent) => {
    e.preventDefault()
    setAdminLoading(true)
    setMsg('')
    try {
      const res = await api.post(
        '/admin/register-admin',
        { email: adminForm.email, username: adminForm.username, password: adminForm.password },
        { headers: { 'X-Admin-Key': adminForm.adminKey } }
      )
      setMsg(`✅ Administrator @${res.data.username} created`)
      setAdminForm({ email: '', username: '', password: '', adminKey: '' })
      fetchUsers(roleFilter)
    } catch (err) {
      const e = err as { response?: { data?: { error?: string; details?: { issue: string }[] } } }
      const det = e?.response?.data?.details
      setMsg(det?.length ? det.map((d) => d.issue).join(', ') : e?.response?.data?.error || 'Failed to create administrator')
    } finally {
      setAdminLoading(false)
    }
  }

  // Safe date formatter to prevent crashes
  const fmt = (d: string | null | undefined) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return 'Invalid Date';
    }
  }

  return (
    <Layout title="Admin Dashboard">
      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm flex justify-between items-center ${msg.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="font-bold ml-4 text-lg leading-none">×</button>
        </div>
      )}

      <div className="flex border-b mb-6 gap-0 overflow-x-auto">
        {TAB_CONFIG.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 -mb-px ${activeTab === id ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── USERS ── */}
      {activeTab === 'users' && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            {ROLES.map((role) => (
              <button key={role} onClick={() => { setRoleFilter(role); fetchUsers(role) }}
                className={`px-3 py-1.5 text-xs rounded-full border transition ${roleFilter === role ? 'bg-amber-600 text-white border-amber-600' : 'border-gray-300 text-gray-600 hover:border-amber-400'}`}>
                {role || 'All'}
              </button>
            ))}
            <button onClick={() => fetchUsers(roleFilter)} className="btn-secondary text-xs ml-auto">↻ Refresh</button>
          </div>
          {usersLoading ? <div className="text-center text-gray-400 py-16">Loading...</div> : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr><Th>Username</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Verified</Th><Th>Joined</Th><Th>Actions</Th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!users || users.length === 0 ? <Empty cols={7} text="No users found" /> : users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <Td className="font-medium">@{u.username}</Td>
                      <Td className="text-gray-600">{u.email}</Td>
                      <Td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColor(u.role)}`}>{ROLE_LABELS[u.role] || u.role}</span></Td>
                      <Td><span className={`px-2 py-0.5 rounded-full text-xs ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.is_active ? 'Active' : 'Blocked'}</span></Td>
                      <Td>{u.is_email_verified ? '✅' : '❌'}</Td>
                      <Td className="text-gray-400 text-xs">{fmt(u.created_at)}</Td>
                      <Td>
                        <div className="flex gap-1">
                          <button onClick={() => toggleActive(u.id, u.is_active)}
                            className={`text-xs px-2 py-1 rounded transition ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                            {u.is_active ? 'Block' : 'Activate'}
                          </button>
                          <button onClick={() => deleteUser(u.id, u.username)} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 transition">Delete</button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── REGISTRIES ── */}
      {activeTab === 'registries' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={fetchRegistries} className="btn-secondary text-xs">↻ Refresh</button>
          </div>
          {regsLoading ? <div className="text-center text-gray-400 py-16">Loading...</div> : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr><Th>Title</Th><Th>Host</Th><Th>Event Date</Th><Th>Visibility</Th><Th>Gifts</Th><Th>Guests</Th><Th>Actions</Th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!registries || registries.length === 0 ? <Empty cols={7} text="No registries" /> : registries.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <Td className="font-medium">{r.title}</Td>
                      <Td><span className="text-gray-600">@{r.host?.username}</span></Td>
                      <Td className="text-gray-500 text-xs">{r.event_date ? new Date(r.event_date).toLocaleDateString('en-US') : '—'}</Td>
                      <Td><span className={`px-2 py-0.5 rounded-full text-xs ${r.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.is_public ? 'Public' : 'Private'}</span></Td>
                      <Td>{r._count?.gifts ?? 0}</Td>
                      <Td>{r._count?.guests ?? 0}</Td>
                      <Td>
                        <button onClick={() => deleteRegistry(r.id, r.title)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition">Delete</button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CONTRIBUTIONS ── */}
      {activeTab === 'contributions' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={fetchContributions} className="btn-secondary text-xs">↻ Refresh</button>
          </div>
          {contribLoading ? <div className="text-center text-gray-400 py-16">Loading...</div> : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr><Th>Gift</Th><Th>Guest</Th><Th>Amount</Th><Th>KZT</Th><Th>Status</Th><Th>Date</Th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!contributions || contributions.length === 0 ? <Empty cols={6} text="No contributions yet" /> : contributions.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <Td className="font-medium">{c.gift?.title ?? '—'}</Td>
                      <Td className="text-gray-600">{c.guest?.displayName ?? '—'}</Td>
                      <Td>{c.amount_original?.toLocaleString() ?? '0'} {c.currency_original ?? ''}</Td>
                      <Td className="font-medium text-amber-700">{c.amount_kzt?.toLocaleString() ?? '0'} KZT</Td>
                      <Td><span className={`px-2 py-0.5 rounded-full text-xs ${c.status === 'FUNDED' ? 'bg-green-100 text-green-700' : c.status === 'REFUNDED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{c.status || '—'}</span></Td>
                      <Td className="text-gray-400 text-xs">{fmt(c.created_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── AUDIT LOG ── */}
      {activeTab === 'audit' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={fetchAuditLogs} className="btn-secondary text-xs">↻ Refresh</button>
          </div>
          {auditLoading ? <div className="text-center text-gray-400 py-16">Loading...</div> : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr><Th>Action</Th><Th>User</Th><Th>Entity</Th><Th>Details</Th><Th>Time</Th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!auditLogs || auditLogs.length === 0 ? <Empty cols={5} text="No audit logs yet" /> : auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <Td><span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{log.action}</span></Td>
                      <Td className="text-gray-600">{log.user ? `@${log.user.username}` : '—'}</Td>
                      <Td className="text-gray-500 text-xs">{log.entity_type}</Td>
                      <Td className="text-gray-400 text-xs max-w-xs truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : '—'}
                      </Td>
                      <Td className="text-gray-400 text-xs">{fmt(log.created_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── QUEUE ── */}
      {activeTab === 'queue' && (
        <div>
          <button onClick={() => api.get('/admin/queue-status').then((r) => setQueueStatus(r.data))} className="btn-secondary text-sm mb-4">↻ Refresh</button>
          {!queueStatus ? <div className="text-center text-gray-400 py-8">Click Refresh to load</div> : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {([['Waiting','waiting','yellow'],['Active','active','blue'],['Completed','completed','green'],['Failed','failed','red'],['Delayed','delayed','gray']] as const).map(([label, key, c]) => (
                <div key={key} className={`border rounded-xl p-4 text-center bg-${c}-50 border-${c}-200 text-${c}-800`}>
                  <div className="text-3xl font-bold">{(queueStatus as Record<string, unknown>)[key] ?? '—'}</div>
                  <div className="text-sm mt-1">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CREATE ADMIN ── */}
      {activeTab === 'create-admin' && (
        <div className="max-w-md">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-1">Create Administrator</h3>
            <p className="text-sm text-gray-500 mb-4">Requires <code className="bg-gray-100 px-1 rounded">ADMIN_REGISTRATION_KEY</code> from the server config.</p>
            <form onSubmit={createAdmin} className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" className="input-field" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} required placeholder="admin@example.com" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input className="input-field" value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} required minLength={3} placeholder="superadmin" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Password * (min 8 chars)</label>
                <input type="password" className="input-field" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} required minLength={8} placeholder="••••••••" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Secret Key *</label>
                <input type="password" className="input-field" value={adminForm.adminKey} onChange={(e) => setAdminForm({ ...adminForm, adminKey: e.target.value })} required placeholder="ADMIN_REGISTRATION_KEY" /></div>
              <button type="submit" disabled={adminLoading} className="btn-primary w-full">
                {adminLoading ? 'Creating...' : '🔐 Create Administrator'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}