import { useState, useEffect, FormEvent, ReactNode } from 'react'
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

const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
  { id: 'users',        label: 'Users',         icon: '👥' },
  { id: 'registries',   label: 'Registries',    icon: '📋' },
  { id: 'contributions',label: 'Contributions', icon: '💰' },
  { id: 'audit',        label: 'Audit Log',     icon: '📜' },
  { id: 'queue',        label: 'Queue',         icon: '⚙️' },
  { id: 'create-admin', label: 'New Admin',     icon: '🔐' },
]

const roleColor = (role: string) => {
  const map: Record<string, string> = {
    HOST: 'bg-violet-50 text-violet-700 border-violet-200',
    GUEST: 'bg-blue-50 text-blue-700 border-blue-200',
    VENDOR: 'bg-orange-50 text-orange-700 border-orange-200',
    COURIER: 'bg-teal-50 text-teal-700 border-teal-200',
    ADMIN: 'bg-red-50 text-red-700 border-red-200',
  }
  return map[role] || 'bg-stone-50 text-stone-600 border-stone-200'
}

function Th({ children }: { children: ReactNode }) {
  return <th className="table-th">{children}</th>
}
function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`table-td ${className}`}>{children}</td>
}
function Empty({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} className="text-center text-stone-400 py-12 text-sm">{text}</td></tr>
}

const ACTION_COLORS: Record<string, string> = {
  USER_REGISTERED:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  USER_LOGIN:          'bg-blue-50 text-blue-700 border-blue-200',
  USER_LOGOUT:         'bg-slate-50 text-slate-600 border-slate-200',
  REGISTRY_CREATED:    'bg-violet-50 text-violet-700 border-violet-200',
  GIFT_CREATED:        'bg-amber-50 text-amber-700 border-amber-200',
  GIFT_STATE_CHANGED:  'bg-orange-50 text-orange-700 border-orange-200',
  CONTRIBUTION_FUNDED: 'bg-teal-50 text-teal-700 border-teal-200',
}

function AuditLogRow({ log, fmt }: { log: AuditLog; fmt: (d: string | null | undefined) => string }) {
  const [expanded, setExpanded] = useState(false)
  const actionColor = ACTION_COLORS[log.action] || 'bg-stone-100 text-stone-600 border-stone-200'
  const meta = log.metadata && Object.keys(log.metadata).length > 0 ? log.metadata : null

  return (
    <div className={`border rounded-2xl transition-all duration-150 ${expanded ? 'border-stone-200 shadow-card' : 'border-stone-100 hover:border-stone-200'}`}>
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => meta && setExpanded((p) => !p)}
      >
        {/* Timestamp */}
        <div className="text-xs text-stone-400 whitespace-nowrap pt-0.5 w-32 flex-shrink-0">
          {fmt(log.created_at)}
        </div>

        {/* Action badge */}
        <div className="flex-shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold border font-mono ${actionColor}`}>
            {log.action}
          </span>
        </div>

        {/* User */}
        <div className="flex-shrink-0 w-28">
          {log.user ? (
            <span className="text-xs text-stone-600 font-medium">@{log.user.username}</span>
          ) : (
            <span className="text-xs text-stone-300">system</span>
          )}
        </div>

        {/* Entity */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <span className="text-xs bg-stone-100 text-stone-500 border border-stone-200 px-1.5 py-0.5 rounded-lg font-mono">{log.entity_type}</span>
          <span className="text-xs text-stone-300 font-mono">{log.entity_id.slice(0, 8)}…</span>
        </div>

        {/* Metadata preview */}
        {meta && (
          <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
            {Object.entries(meta).slice(0, 3).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 text-xs bg-stone-50 border border-stone-200 px-1.5 py-0.5 rounded-lg">
                <span className="text-stone-400">{k}:</span>
                <span className="text-stone-700 font-medium truncate max-w-[80px]">{String(v)}</span>
              </span>
            ))}
            {Object.keys(meta).length > 3 && (
              <span className="text-xs text-stone-400">+{Object.keys(meta).length - 3} more</span>
            )}
            <span className="ml-auto text-stone-300 text-xs">{expanded ? '▲' : '▼'}</span>
          </div>
        )}
      </div>

      {/* Expanded metadata — Prisma Studio style */}
      {expanded && meta && (
        <div className="border-t border-stone-100 bg-stone-50 rounded-b-2xl px-4 py-3">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Metadata</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {Object.entries(meta).map(([k, v]) => (
              <div key={k} className="flex items-start gap-2 bg-white border border-stone-100 rounded-xl px-3 py-2">
                <span className="text-xs font-semibold text-stone-400 font-mono min-w-max">{k}</span>
                <span className="text-xs text-stone-700 break-all font-mono">
                  {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-stone-100">
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <span className="font-mono">entity_id:</span>
              <span className="font-mono text-stone-600 select-all">{log.entity_id}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
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

  const fmt = (d: string | null | undefined) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) }
    catch { return 'Invalid Date' }
  }

  const QUEUE_STATS = [
    { key: 'waiting',   label: 'Waiting',   color: 'bg-amber-50 border-amber-200 text-amber-800' },
    { key: 'active',    label: 'Active',    color: 'bg-blue-50 border-blue-200 text-blue-800' },
    { key: 'completed', label: 'Completed', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
    { key: 'failed',    label: 'Failed',    color: 'bg-red-50 border-red-200 text-red-800' },
    { key: 'delayed',   label: 'Delayed',   color: 'bg-stone-50 border-stone-200 text-stone-600' },
  ] as const

  return (
    <Layout title="Admin Dashboard">
      {msg && (
        <div className={`mb-5 ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'} justify-between`}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="font-bold ml-4 text-lg leading-none opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-stone-100 mb-6 gap-0 overflow-x-auto">
        {TAB_CONFIG.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={activeTab === id ? 'tab-btn-active' : 'tab-btn-inactive'}
          >
            <span className="mr-1.5">{icon}</span>{label}
          </button>
        ))}
      </div>

      {/* ── USERS ── */}
      {activeTab === 'users' && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            {ROLES.map((role) => (
              <button key={role} onClick={() => { setRoleFilter(role); fetchUsers(role) }}
                className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-all ${roleFilter === role ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-white border-stone-200 text-stone-600 hover:border-amber-300 hover:text-amber-700'}`}>
                {role || 'All'}
              </button>
            ))}
            <button onClick={() => fetchUsers(roleFilter)} className="btn-secondary text-xs ml-auto py-1.5 px-3">↻ Refresh</button>
          </div>
          {usersLoading ? (
            <div className="flex items-center justify-center py-16 text-stone-400 gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading users...
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-stone-100">
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-100">
                  <tr><Th>Username</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Verified</Th><Th>Joined</Th><Th>Actions</Th></tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {!users || users.length === 0 ? <Empty cols={7} text="No users found" /> : users.map((u) => (
                    <tr key={u.id} className="hover:bg-stone-50/50 transition-colors">
                      <Td className="font-semibold text-stone-800">@{u.username}</Td>
                      <Td className="text-stone-500">{u.email}</Td>
                      <Td><span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleColor(u.role)}`}>{ROLE_LABELS[u.role] || u.role}</span></Td>
                      <Td><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${u.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{u.is_active ? 'Active' : 'Blocked'}</span></Td>
                      <Td>{u.is_email_verified ? <span className="text-emerald-600 font-medium text-xs">✓ Yes</span> : <span className="text-red-400 text-xs">✗ No</span>}</Td>
                      <Td className="text-stone-400 text-xs">{fmt(u.created_at)}</Td>
                      <Td>
                        <div className="flex gap-1.5">
                          <button onClick={() => toggleActive(u.id, u.is_active)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'}`}>
                            {u.is_active ? 'Block' : 'Activate'}
                          </button>
                          <button onClick={() => deleteUser(u.id, u.username)} className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 text-stone-500 hover:bg-red-50 hover:text-red-600 border border-stone-200 hover:border-red-200 transition-all font-medium">Delete</button>
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
            <button onClick={fetchRegistries} className="btn-secondary text-xs py-1.5 px-3">↻ Refresh</button>
          </div>
          {regsLoading ? (
            <div className="flex items-center justify-center py-16 text-stone-400 gap-2 text-sm">Loading...</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-stone-100">
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-100">
                  <tr><Th>Title</Th><Th>Host</Th><Th>Event Date</Th><Th>Visibility</Th><Th>Gifts</Th><Th>Guests</Th><Th>Actions</Th></tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {!registries || registries.length === 0 ? <Empty cols={7} text="No registries" /> : registries.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50/50 transition-colors">
                      <Td className="font-semibold text-stone-800">{r.title}</Td>
                      <Td className="text-stone-500">@{r.host?.username}</Td>
                      <Td className="text-stone-400 text-xs">{r.event_date ? new Date(r.event_date).toLocaleDateString('en-US') : '—'}</Td>
                      <Td><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${r.is_public ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-50 text-stone-600 border-stone-200'}`}>{r.is_public ? 'Public' : 'Private'}</span></Td>
                      <Td>{r._count?.gifts ?? 0}</Td>
                      <Td>{r._count?.guests ?? 0}</Td>
                      <Td>
                        <button onClick={() => deleteRegistry(r.id, r.title)} className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all font-medium">Delete</button>
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
            <button onClick={fetchContributions} className="btn-secondary text-xs py-1.5 px-3">↻ Refresh</button>
          </div>
          {contribLoading ? (
            <div className="flex items-center justify-center py-16 text-stone-400 gap-2 text-sm">Loading...</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-stone-100">
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-100">
                  <tr><Th>Gift</Th><Th>Guest</Th><Th>Amount</Th><Th>KZT</Th><Th>Status</Th><Th>Date</Th></tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {!contributions || contributions.length === 0 ? <Empty cols={6} text="No contributions yet" /> : contributions.map((c) => (
                    <tr key={c.id} className="hover:bg-stone-50/50 transition-colors">
                      <Td className="font-semibold text-stone-800">{c.gift?.title ?? '—'}</Td>
                      <Td className="text-stone-500">{c.guest?.displayName ?? '—'}</Td>
                      <Td>{c.amount_original?.toLocaleString() ?? '0'} {c.currency_original ?? ''}</Td>
                      <Td className="font-semibold text-amber-700">{c.amount_kzt?.toLocaleString() ?? '0'} KZT</Td>
                      <Td><span className={c.status === 'FUNDED' ? 'badge-funded' : c.status === 'REFUNDED' ? 'badge-cancelled' : 'badge-pending'}>{c.status || '—'}</span></Td>
                      <Td className="text-stone-400 text-xs">{fmt(c.created_at)}</Td>
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
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-stone-500">{auditLogs.length} entries</p>
            <button onClick={fetchAuditLogs} className="btn-secondary text-xs py-1.5 px-3">↻ Refresh</button>
          </div>
          {auditLoading ? (
            <div className="flex items-center justify-center py-16 text-stone-400 gap-2 text-sm">Loading...</div>
          ) : auditLogs.length === 0 ? (
            <div className="card text-center py-16 text-stone-400">No audit logs yet</div>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <AuditLogRow key={log.id} log={log} fmt={fmt} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── QUEUE ── */}
      {activeTab === 'queue' && (
        <div>
          <div className="flex justify-end mb-5">
            <button onClick={() => api.get('/admin/queue-status').then((r) => setQueueStatus(r.data))} className="btn-secondary text-sm">
              ↻ Refresh
            </button>
          </div>
          {!queueStatus ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <div className="text-3xl mb-2">⚙️</div>
              <p className="text-stone-500 text-sm">Click Refresh to load queue status</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {QUEUE_STATS.map(({ key, label, color }) => (
                <div key={key} className={`border rounded-2xl p-5 text-center ${color}`}>
                  <div className="text-3xl font-bold">{(queueStatus as Record<string, unknown>)[key] ?? '—'}</div>
                  <div className="text-sm mt-1.5 font-medium">{label}</div>
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
            <div className="mb-5">
              <h3 className="font-bold text-stone-900 text-lg">Create Administrator</h3>
              <p className="text-sm text-stone-500 mt-1">
                Requires <code className="bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded-lg text-xs">ADMIN_REGISTRATION_KEY</code> from the server config.
              </p>
            </div>
            <form onSubmit={createAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Email *</label>
                <input type="email" className="input-field" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} required placeholder="admin@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Username *</label>
                <input className="input-field" value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} required minLength={3} placeholder="superadmin" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Password * <span className="text-stone-400 font-normal">(min 8 chars)</span></label>
                <input type="password" className="input-field" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} required minLength={8} placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Secret Key *</label>
                <input type="password" className="input-field" value={adminForm.adminKey} onChange={(e) => setAdminForm({ ...adminForm, adminKey: e.target.value })} required placeholder="ADMIN_REGISTRATION_KEY" />
              </div>
              <button type="submit" disabled={adminLoading} className="btn-primary w-full py-3">
                {adminLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </span>
                ) : '🔐 Create Administrator'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
