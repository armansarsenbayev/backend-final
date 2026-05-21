import { useState, useEffect, FormEvent } from 'react'
import Layout from '../../components/Layout'
import api from '../../api/axios'

interface User { id: string; email: string; username: string; role: string; is_active: boolean; is_email_verified: boolean; created_at: string }
interface QueueStatus { waiting?: number; active?: number; completed?: number; failed?: number; delayed?: number; name?: string }

const ROLE_LABELS: Record<string, string> = { HOST: 'Хозяин', GUEST: 'Гость', VENDOR: 'Продавец', COURIER: 'Курьер', ADMIN: 'Администратор' }
const ROLES = ['', 'HOST', 'GUEST', 'VENDOR', 'COURIER', 'ADMIN']

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [roleFilter, setRoleFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'users' | 'queue' | 'create-admin'>('users')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  // Create admin form
  const [adminForm, setAdminForm] = useState({ email: '', username: '', password: '', adminKey: '' })
  const [adminLoading, setAdminLoading] = useState(false)

  const fetchUsers = async (role = '') => {
    setLoading(true)
    const url = role ? `/admin/users?role=${role}` : '/admin/users'
    const res = await api.get(url).catch(() => ({ data: { data: [] } }))
    setUsers(res.data.data || [])
    setLoading(false)
  }

  const fetchQueueStatus = async () => {
    const res = await api.get('/admin/queue-status').catch(() => ({ data: {} }))
    setQueueStatus(res.data)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleRoleFilter = (role: string) => {
    setRoleFilter(role)
    fetchUsers(role)
  }

  const toggleActive = async (userId: string, isActive: boolean) => {
    try {
      const res = await api.patch(`/admin/users/${userId}/activate`, { isActive: !isActive })
      setUsers((prev) => prev.map((u) => (u.id === userId ? res.data : u)))
      setMsg(`✅ Пользователь ${!isActive ? 'активирован' : 'деактивирован'}`)
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setMsg(e?.response?.data?.message || 'Ошибка')
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
      setMsg(`✅ Администратор создан: @${res.data.username}`)
      setAdminForm({ email: '', username: '', password: '', adminKey: '' })
      if (activeTab === 'users') fetchUsers(roleFilter)
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; error?: string } } }
      setMsg(e?.response?.data?.message || e?.response?.data?.error || 'Ошибка создания администратора')
    } finally {
      setAdminLoading(false)
    }
  }

  const roleColor = (role: string) => {
    const map: Record<string, string> = {
      HOST: 'bg-purple-100 text-purple-700', GUEST: 'bg-blue-100 text-blue-700',
      VENDOR: 'bg-orange-100 text-orange-700', COURIER: 'bg-teal-100 text-teal-700',
      ADMIN: 'bg-red-100 text-red-700',
    }
    return map[role] || 'bg-gray-100 text-gray-600'
  }

  return (
    <Layout title="Панель администратора">
      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm flex justify-between ${msg.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          <span>{msg}</span><button onClick={() => setMsg('')} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-6 gap-1">
        {(['users', 'queue', 'create-admin'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); if (tab === 'queue') fetchQueueStatus() }}
            className={`px-5 py-2.5 text-sm font-medium transition ${activeTab === tab ? 'border-b-2 border-amber-500 text-amber-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'users' ? '👥 Пользователи' : tab === 'queue' ? '📊 Очередь BullMQ' : '🔐 Создать ADMIN'}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => handleRoleFilter(role)}
                className={`px-3 py-1.5 text-sm rounded-full border transition ${roleFilter === role ? 'bg-amber-600 text-white border-amber-600' : 'border-gray-300 text-gray-600 hover:border-amber-400'}`}
              >
                {role || 'Все роли'}
              </button>
            ))}
            <button onClick={() => fetchUsers(roleFilter)} className="btn-secondary text-sm ml-auto">↻ Обновить</button>
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-16">Загрузка...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                    <th className="pb-2 pr-4">Пользователь</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Роль</th>
                    <th className="pb-2 pr-4">Статус</th>
                    <th className="pb-2 pr-4">Email верифицирован</th>
                    <th className="pb-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-gray-400 py-8">Нет пользователей</td></tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-medium">@{user.username}</td>
                        <td className="py-2.5 pr-4 text-gray-600">{user.email}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColor(user.role)}`}>
                            {ROLE_LABELS[user.role] || user.role}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {user.is_active ? 'Активен' : 'Заблокирован'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          {user.is_email_verified ? '✅' : '❌'}
                        </td>
                        <td className="py-2.5">
                          <button
                            onClick={() => toggleActive(user.id, user.is_active)}
                            className={`text-xs px-2 py-1 rounded transition ${user.is_active ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                          >
                            {user.is_active ? 'Заблокировать' : 'Активировать'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Queue tab */}
      {activeTab === 'queue' && (
        <div>
          <button onClick={fetchQueueStatus} className="btn-secondary text-sm mb-4">↻ Обновить статус</button>
          {!queueStatus ? (
            <div className="text-center text-gray-400 py-8">Нажмите «Обновить статус»</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'Ожидание', key: 'waiting', color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
                { label: 'Активные', key: 'active', color: 'bg-blue-50 border-blue-200 text-blue-800' },
                { label: 'Выполнено', key: 'completed', color: 'bg-green-50 border-green-200 text-green-800' },
                { label: 'Ошибки', key: 'failed', color: 'bg-red-50 border-red-200 text-red-800' },
                { label: 'Отложено', key: 'delayed', color: 'bg-gray-50 border-gray-200 text-gray-800' },
              ].map(({ label, key, color }) => (
                <div key={key} className={`border rounded-xl p-4 text-center ${color}`}>
                  <div className="text-3xl font-bold">{(queueStatus as Record<string, unknown>)[key] ?? '—'}</div>
                  <div className="text-sm mt-1">{label}</div>
                </div>
              ))}
            </div>
          )}
          {queueStatus && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
              <pre>{JSON.stringify(queueStatus, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* Create Admin tab */}
      {activeTab === 'create-admin' && (
        <div className="max-w-md">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-1">Создать нового администратора</h3>
            <p className="text-sm text-gray-500 mb-4">
              Требуется секретный ключ <code className="bg-gray-100 px-1 rounded">ADMIN_REGISTRATION_KEY</code> из конфигурации сервера.
            </p>
            <form onSubmit={createAdmin} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  className="input-field"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  required
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Имя пользователя *</label>
                <input
                  className="input-field"
                  value={adminForm.username}
                  onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                  required
                  minLength={3}
                  placeholder="superadmin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Пароль * (мин. 8 символов)</label>
                <input
                  type="password"
                  className="input-field"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  required
                  minLength={8}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Секретный ключ (X-Admin-Key) *</label>
                <input
                  type="password"
                  className="input-field"
                  value={adminForm.adminKey}
                  onChange={(e) => setAdminForm({ ...adminForm, adminKey: e.target.value })}
                  required
                  placeholder="admin-registration-secret-key"
                />
              </div>
              <button type="submit" disabled={adminLoading} className="btn-primary w-full">
                {adminLoading ? 'Создание...' : '🔐 Создать администратора'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
