import { useState, useEffect } from 'react'
import { categoriesApi } from '../lib/api'
import { useAuth } from '../lib/use-auth'
import { Plus, Edit2, Trash2, Tag } from 'lucide-react'

interface Category {
  id: string
  name: string
  description?: string
  isActive: boolean
  _count?: { menuItems: number }
}

interface FormData {
  name: string
  description: string
  isActive: boolean
}

export default function CategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null)
  const [formData, setFormData] = useState<FormData>({ name: '', description: '', isActive: true })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const canDelete = user?.role === 'ADMIN'

  const fetchCategories = async () => {
    try {
      setError(null)
      const data = await categoriesApi.getAll(canEdit)
      setCategories(data.categories)
    } catch {
      setError('Failed to load categories.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCategories() }, [])

  const openCreate = () => {
    setEditingCategory(null)
    setFormData({ name: '', description: '', isActive: true })
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditingCategory(cat)
    setFormData({ name: cat.name, description: cat.description ?? '', isActive: cat.isActive })
    setFormError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) { setFormError('Name is required.'); return }
    setSaving(true)
    setFormError(null)
    try {
      if (editingCategory) {
        await categoriesApi.update(editingCategory.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          isActive: formData.isActive,
        })
      } else {
        await categoriesApi.create({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        })
      }
      setModalOpen(false)
      await fetchCategories()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save category.'
      setFormError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await categoriesApi.delete(deleteConfirm.id)
      setDeleteConfirm(null)
      await fetchCategories()
    } catch {
      setError('Failed to delete category. It may still have menu items.')
    } finally {
      setDeleting(false)
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
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Manage menu categories</p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Items</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              {canEdit && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-6 py-12 text-center">
                  <Tag className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No categories yet. Create your first one!</p>
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{cat.name}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm max-w-xs truncate">{cat.description ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">{cat._count?.menuItems ?? 0}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      cat.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {cat.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right whitespace-nowrap space-x-3">
                      <button
                        onClick={() => openEdit(cat)}
                        className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => setDeleteConfirm(cat)}
                          disabled={(cat._count?.menuItems ?? 0) > 0}
                          className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={(cat._count?.menuItems ?? 0) > 0 ? 'Cannot delete — has menu items' : 'Delete'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g. Main Course"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              {editingCategory && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
                </label>
              )}
              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Category</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
