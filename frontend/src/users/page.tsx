import { useState, useEffect } from 'react'
import { usersApi } from '../lib/api'
import { useAuth } from '../lib/use-auth'
import { Plus, Edit2, Trash2, Users, ToggleLeft, ToggleRight, KeyRound } from 'lucide-react'
import { format } from 'date-fns'

type Role = 'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER'

interface User {
  id: string
  email: string | null
  phone: string | null
  name: string
  role: Role
  isActive: boolean
  createdAt: string
  _count: { orders: number }
}

interface CreateForm {
  name: string
  email: string
  phone: string
  password: string
  role: Role
}

interface EditForm {
  name: string
  phone: string
  role: Role
  isActive: boolean
}

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  MANAGER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  STAFF: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  CUSTOMER: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>({ name: '', email: '', phone: '', password: '', role: 'STAFF' })
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Edit modal
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ name: '', phone: '', role: 'STAFF', isActive: true })
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Reset password
  const [resetUser, setResetUser] = useState<User | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  const fetchUsers = async () => {
    try {
      setError(null)
      const data = await usersApi.getAll()
      setUsers(data.users)
    } catch {
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const openCreate = () => {
    setCreateForm({ name: '', email: '', phone: '', password: '', role: 'STAFF' })
    setCreateError(null)
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    if (!createForm.name.trim()) { setCreateError('Name is required.'); return }
    if (createForm.email && !createForm.password) { setCreateError('Password is required when email is provided.'); return }
    if (createForm.password && createForm.password.length < 6) { setCreateError('Password must be at least 6 characters.'); return }

    setCreating(true)
    setCreateError(null)
    try {
      await usersApi.create({
        name: createForm.name.trim(),
        email: createForm.email.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
        password: createForm.password || undefined,
        role: createForm.role,
      })
      setCreateOpen(false)
      await fetchUsers()
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user.')
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (u: User) => {
    setEditUser(u)
    setEditForm({ name: u.name, phone: u.phone ?? '', role: u.role, isActive: u.isActive })
    setEditError(null)
  }

  const handleEdit = async () => {
    if (!editUser) return
    if (!editForm.name.trim()) { setEditError('Name is required.'); return }
    setSaving(true)
    setEditError(null)
    try {
      await usersApi.update(editUser.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        role: editForm.role,
        isActive: editForm.isActive,
      })
      setEditUser(null)
      await fetchUsers()
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update user.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (u: User) => {
    try {
      await usersApi.update(u.id, { isActive: !u.isActive })
      await fetchUsers()
    } catch {
      setError('Failed to update user status.')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await usersApi.delete(deleteConfirm.id)
      setDeleteConfirm(null)
      await fetchUsers()
    } catch {
      setError('Failed to delete user.')
    } finally {
      setDeleting(false)
    }
  }

  const openResetPassword = (u: User) => {
    setResetUser(u)
    setResetPassword('')
    setResetConfirm('')
    setResetError(null)
    setResetSuccess(false)
  }

  const handleResetPassword = async () => {
    if (!resetUser) return
    if (!resetPassword) { setResetError('New password is required.'); return }
    if (resetPassword.length < 6) { setResetError('Password must be at least 6 characters.'); return }
    if (resetPassword !== resetConfirm) { setResetError('Passwords do not match.'); return }
    setResetting(true)
    setResetError(null)
    try {
      await usersApi.resetPassword(resetUser.id, resetPassword)
      setResetSuccess(true)
      setResetPassword('')
      setResetConfirm('')
      setTimeout(() => setResetUser(null), 1500)
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Failed to reset password.')
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 dark:border-gray-100" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{users.length} user{users.length !== 1 ? 's' : ''} in the system</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg mb-4 text-sm">{error}</div>}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Orders</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joined</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <Users className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No users found.</p>
                </td>
              </tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-semibold text-sm shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {u.name}
                        {u.id === currentUser?.id && <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400 font-normal">(you)</span>}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{u.email ?? <span className="italic text-gray-400 dark:text-gray-500">no email</span>}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{u.phone ?? '—'}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{u._count.orders}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => u.id !== currentUser?.id && handleToggleActive(u)}
                    disabled={u.id === currentUser?.id}
                    className="disabled:cursor-default"
                    title={u.id === currentUser?.id ? 'Cannot change your own status' : (u.isActive ? 'Click to deactivate' : 'Click to activate')}
                  >
                    {u.isActive
                      ? <ToggleRight className="h-6 w-6 text-green-500" />
                      : <ToggleLeft className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                    }
                  </button>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{format(new Date(u.createdAt), 'MMM dd, yyyy')}</td>
                <td className="px-6 py-4 text-right whitespace-nowrap space-x-3">
                  <button onClick={() => openEdit(u)} className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 transition-colors" title="Edit">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {u.id !== currentUser?.id && (
                    <button onClick={() => openResetPassword(u)} className="text-amber-500 hover:text-amber-700 transition-colors" title="Reset Password">
                      <KeyRound className="h-4 w-4" />
                    </button>
                  )}
                  {u.id !== currentUser?.id && (
                    <button onClick={() => setDeleteConfirm(u)} className="text-red-500 hover:text-red-700 transition-colors" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create User</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="John Doe"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="+250 7xx xxx xxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email <span className="text-gray-400 dark:text-gray-500 font-normal">(optional — required for login)</span>
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="john@example.com"
                />
              </div>
              {createForm.email && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Min. 6 characters"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Role })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="STAFF">Staff</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              {createError && <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {creating ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit User</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{editUser.email ?? editUser.phone ?? editUser.name}</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="+250 7xx xxx xxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CUSTOMER">Customer</option>
                  <option value="STAFF">Staff</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              {editUser.id !== currentUser?.id && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
                </label>
              )}
              {editError && <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={handleEdit} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Reset Password</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Set a new password for <strong>{resetUser.name}</strong></p>
            </div>
            <div className="px-6 py-4 space-y-4">
              {resetSuccess ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm py-2">
                  <KeyRound className="h-4 w-4" />
                  Password reset successfully. The user can now log in with the new password.
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password <span className="text-red-500">*</span></label>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Min. 6 characters"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password <span className="text-red-500">*</span></label>
                    <input
                      type="password"
                      value={resetConfirm}
                      onChange={(e) => setResetConfirm(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Repeat new password"
                    />
                  </div>
                  {resetError && <p className="text-sm text-red-600 dark:text-red-400">{resetError}</p>}
                  <p className="text-xs text-gray-400 dark:text-gray-500">After resetting, share the new password with the user. They can change it themselves in Settings.</p>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setResetUser(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                {resetSuccess ? 'Close' : 'Cancel'}
              </button>
              {!resetSuccess && (
                <button onClick={handleResetPassword} disabled={resetting} className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors">
                  {resetting ? 'Resetting…' : 'Reset Password'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete User</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Are you sure you want to permanently delete <strong>{deleteConfirm.name}</strong>? This cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
