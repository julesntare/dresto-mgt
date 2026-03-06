import { useState, useEffect } from 'react'
import { tablesApi } from '../lib/api'
import type { Table, TableStatus } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { Plus, Pencil, Trash2, UtensilsCrossed } from 'lucide-react'
import { format } from 'date-fns'

const STATUS_COLORS: Record<TableStatus, string> = {
  AVAILABLE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  OCCUPIED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  RESERVED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
}

interface TableForm {
  number: string
  capacity: string
  location: string
  isActive: boolean
}

const emptyForm: TableForm = { number: '', capacity: '', location: '', isActive: true }

export default function TablesPage() {
  const { user } = useAuth()
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<TableForm>(emptyForm)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Edit modal
  const [editTable, setEditTable] = useState<Table | null>(null)
  const [editForm, setEditForm] = useState<TableForm>(emptyForm)
  const [editError, setEditError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  // Delete modal
  const [deleteTable, setDeleteTable] = useState<Table | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const isAdmin = user?.role === 'ADMIN'

  const fetchTables = async () => {
    try {
      setError(null)
      const data = await tablesApi.getAll()
      setTables(data.tables)
    } catch {
      setError('Failed to load tables.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTables() }, [])

  const openCreate = () => {
    setCreateForm(emptyForm)
    setCreateError(null)
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    setCreateError(null)
    if (!createForm.number.trim()) { setCreateError('Table number is required.'); return }
    const cap = Number(createForm.capacity)
    if (!createForm.capacity || isNaN(cap) || cap < 1) { setCreateError('Capacity must be a positive number.'); return }
    setCreating(true)
    try {
      await tablesApi.create({
        number: createForm.number.trim(),
        capacity: cap,
        location: createForm.location.trim() || undefined,
      })
      setCreateOpen(false)
      await fetchTables()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setCreateError(msg || 'Failed to create table.')
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (table: Table) => {
    setEditTable(table)
    setEditForm({
      number: table.number,
      capacity: String(table.capacity),
      location: table.location ?? '',
      isActive: table.isActive,
    })
    setEditError(null)
  }

  const handleEdit = async () => {
    if (!editTable) return
    setEditError(null)
    if (!editForm.number.trim()) { setEditError('Table number is required.'); return }
    const cap = Number(editForm.capacity)
    if (!editForm.capacity || isNaN(cap) || cap < 1) { setEditError('Capacity must be a positive number.'); return }
    setEditing(true)
    try {
      await tablesApi.update(editTable.id, {
        number: editForm.number.trim(),
        capacity: cap,
        location: editForm.location.trim() || undefined,
        isActive: editForm.isActive,
      })
      setEditTable(null)
      await fetchTables()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setEditError(msg || 'Failed to update table.')
    } finally {
      setEditing(false)
    }
  }

  const handleToggleStatus = async (table: Table) => {
    const next: TableStatus = table.status === 'AVAILABLE' ? 'RESERVED' : 'AVAILABLE'
    try {
      await tablesApi.updateStatus(table.id, next)
      await fetchTables()
    } catch {
      setError('Failed to update table status.')
    }
  }

  const openDelete = (table: Table) => {
    setDeleteTable(table)
    setDeleteError(null)
  }

  const handleDelete = async () => {
    if (!deleteTable) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await tablesApi.delete(deleteTable.id)
      setDeleteTable(null)
      await fetchTables()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDeleteError(msg || 'Failed to delete table.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tables</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Manage restaurant seating tables</p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Table
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg mb-4 text-sm">{error}</div>}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 dark:border-gray-100" />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Capacity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Orders</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Added</th>
                {isAdmin && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {tables.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-4 py-12 text-center">
                    <UtensilsCrossed className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No tables registered yet.</p>
                  </td>
                </tr>
              ) : tables.map((table) => (
                <tr key={table.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{table.number}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{table.capacity} seats</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{table.location || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[table.status]}`}>
                      {table.status.charAt(0) + table.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      table.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {table.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{table._count?.orders ?? 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{format(new Date(table.createdAt), 'MMM dd, yyyy')}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleStatus(table)}
                          disabled={table.status === 'OCCUPIED'}
                          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title={table.status === 'OCCUPIED' ? 'Cannot change status of occupied table' : 'Toggle status'}
                        >
                          {table.status === 'AVAILABLE' ? 'Reserve' : table.status === 'RESERVED' ? 'Free' : 'Occupied'}
                        </button>
                        <button
                          onClick={() => openEdit(table)}
                          className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 transition-colors"
                          title="Edit table"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDelete(table)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          title="Delete table"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Table</h2>
              <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Table Number <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={createForm.number}
                  onChange={(e) => setCreateForm({ ...createForm, number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. T1, VIP-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacity (seats) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min={1}
                  value={createForm.capacity}
                  onChange={(e) => setCreateForm({ ...createForm, capacity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 4"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                <input
                  type="text"
                  value={createForm.location}
                  onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Main Hall, Terrace"
                />
              </div>
              {createError && <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {creating ? 'Adding…' : 'Add Table'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Table</h2>
              <button onClick={() => setEditTable(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Table Number <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editForm.number}
                  onChange={(e) => setEditForm({ ...editForm, number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacity (seats) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min={1}
                  value={editForm.capacity}
                  onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                />
                <label htmlFor="editIsActive" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
              </div>
              {editError && <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setEditTable(null)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={handleEdit} disabled={editing} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {editing ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Table</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Are you sure you want to delete table <strong>{deleteTable.number}</strong>? This cannot be undone.
              </p>
              {deleteError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{deleteError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setDeleteTable(null)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
