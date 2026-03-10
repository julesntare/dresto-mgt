import { useState, useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { menuApi, categoriesApi } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { Plus, Edit2, Trash2, Search, UtensilsCrossed, ImageOff, X } from 'lucide-react'

interface Category { id: string; name: string; isActive: boolean }
interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  image?: string
  isAvailable: boolean
  ingredients: string[]
  categoryId: string
  category?: { id: string; name: string }
}
interface FormData {
  name: string
  description: string
  price: string
  categoryId: string
  image: string
  isAvailable: boolean
  ingredients: string[]
}

const EMPTY_FORM: FormData = { name: '', description: '', price: '', categoryId: '', image: '', isAvailable: true, ingredients: [] }

export default function MenuPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterAvailable, setFilterAvailable] = useState('')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<MenuItem | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [ingredientInput, setIngredientInput] = useState('')
  const ingredientInputRef = useRef<HTMLInputElement>(null)

  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const canDelete = user?.role === 'ADMIN'

  const fetchData = async () => {
    try {
      setError(null)
      const [menuData, catData] = await Promise.all([
        menuApi.getItems({
          search: search || undefined,
          categoryId: filterCategory || undefined,
          available: filterAvailable === '' ? undefined : filterAvailable === 'true',
        }),
        categoriesApi.getAll(),
      ])
      setItems(menuData.menuItems)
      setCategories(catData.categories.filter((c) => c.isActive))
    } catch {
      setError('Failed to load menu items.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [search, filterCategory, filterAvailable])

  const openCreate = () => {
    setEditingItem(null)
    setFormData(EMPTY_FORM)
    setIngredientInput('')
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      description: item.description ?? '',
      price: String(item.price),
      categoryId: item.categoryId,
      image: item.image ?? '',
      isAvailable: item.isAvailable,
      ingredients: item.ingredients ?? [],
    })
    setIngredientInput('')
    setFormError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) { setFormError('Name is required.'); return }
    const price = parseFloat(formData.price)
    if (isNaN(price) || price < 0) { setFormError('Enter a valid price.'); return }
    if (!formData.categoryId) { setFormError('Select a category.'); return }

    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        price,
        categoryId: formData.categoryId,
        image: formData.image.trim() || undefined,
        isAvailable: formData.isAvailable,
        ingredients: formData.ingredients,
      }
      if (editingItem) {
        await menuApi.updateItem(editingItem.id, payload)
      } else {
        await menuApi.createItem(payload)
      }
      setModalOpen(false)
      await fetchData()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save item.')
    } finally {
      setSaving(false)
    }
  }

  const addIngredient = (value: string) => {
    const tag = value.trim()
    if (tag && !formData.ingredients.includes(tag)) {
      setFormData((prev) => ({ ...prev, ingredients: [...prev.ingredients, tag] }))
    }
    setIngredientInput('')
  }

  const handleIngredientKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addIngredient(ingredientInput)
    } else if (e.key === 'Backspace' && !ingredientInput && formData.ingredients.length > 0) {
      setFormData((prev) => ({ ...prev, ingredients: prev.ingredients.slice(0, -1) }))
    }
  }

  const removeIngredient = (tag: string) => {
    setFormData((prev) => ({ ...prev, ingredients: prev.ingredients.filter((i) => i !== tag) }))
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await menuApi.deleteItem(deleteConfirm.id)
      setDeleteConfirm(null)
      await fetchData()
    } catch {
      setError('Failed to delete menu item.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Menu Items</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg mb-4 text-sm">{error}</div>}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filterAvailable}
          onChange={(e) => setFilterAvailable(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Availability</option>
          <option value="true">Available</option>
          <option value="false">Unavailable</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 dark:border-gray-100" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm flex flex-col items-center justify-center py-16">
          <UtensilsCrossed className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No menu items found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden flex flex-col">
              {/* Image */}
              <div className="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                )}
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{item.name}</h3>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                    item.isAvailable
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {item.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{item.description}</p>
                )}
                {item.ingredients?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.ingredients.slice(0, 4).map((ing) => (
                      <span key={ing} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">{ing}</span>
                    ))}
                    {item.ingredients.length > 4 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 px-1">+{item.ingredients.length - 4} more</span>
                    )}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.category?.name}</p>
                    <p className="font-bold text-indigo-600">{Math.round(Number(item.price)).toLocaleString()} RWF</p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(item)} className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 transition-colors" title="Edit">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button onClick={() => setDeleteConfirm(item)} className="text-red-500 hover:text-red-700 transition-colors" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingItem ? 'Edit Menu Item' : 'Create Menu Item'}
              </h2>
            </div>
            <div className="px-6 py-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Grilled Chicken"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Optional description"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (RWF) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category <span className="text-red-500">*</span></label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image URL</label>
                <input
                  type="url"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ingredients</label>
                <div
                  className="min-h-10 w-full border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 flex flex-wrap gap-1.5 bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-indigo-500 cursor-text"
                  onClick={() => ingredientInputRef.current?.focus()}
                >
                  {formData.ingredients.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-0.5 rounded-full">
                      {tag}
                      <button type="button" onClick={() => removeIngredient(tag)} className="hover:text-indigo-900 dark:hover:text-indigo-100">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    ref={ingredientInputRef}
                    type="text"
                    value={ingredientInput}
                    onChange={(e) => setIngredientInput(e.target.value)}
                    onKeyDown={handleIngredientKeyDown}
                    onBlur={() => addIngredient(ingredientInput)}
                    className="flex-1 min-w-24 text-sm bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none py-0.5"
                    placeholder={formData.ingredients.length === 0 ? 'Type and press Enter…' : ''}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isAvailable}
                  onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Available for ordering</span>
              </label>
              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Item</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This cannot be undone.
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
