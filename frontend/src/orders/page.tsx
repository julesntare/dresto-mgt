import { useState, useEffect } from 'react'
import { ordersApi, menuApi, categoriesApi, tablesApi } from '../lib/api'
import type { Table } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { Plus, Eye, X, ChevronLeft, ChevronRight, ShoppingCart, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED'
type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'

interface OrderItem {
  menuItemId: string
  quantity: number
  price: number
  menuItem?: { id: string; name: string; price: number; image?: string }
}

interface Order {
  id: string
  orderNumber: string
  customerName?: string
  customerPhone?: string
  orderType: OrderType
  tableId?: string
  table?: { id: string; number: string; location?: string }
  notes?: string
  totalAmount: number
  status: OrderStatus
  createdAt: string
  updatedAt: string
  orderItems: OrderItem[]
  user?: { id: string; name: string; email: string }
}

interface MenuItem { id: string; name: string; price: number; isAvailable: boolean; category?: { name: string } }
interface Category { id: string; name: string }

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  DINE_IN: 'Dine In',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
}

const getStatusLabel = (status: OrderStatus, orderType: OrderType): string => {
  if (status === 'DELIVERED' && orderType === 'DINE_IN') return 'Served'
  return status.charAt(0) + status.slice(1).toLowerCase()
}

interface NewOrderItem { menuItemId: string; quantity: number; name: string; price: number }
interface NewOrderForm {
  customerName: string
  customerPhone: string
  orderType: OrderType
  tableId: string
  notes: string
  items: NewOrderItem[]
}

export default function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & Pagination
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const LIMIT = 10

  // Detail panel
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Create order modal
  const [createOpen, setCreateOpen] = useState(false)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [availableTables, setAvailableTables] = useState<Table[]>([])
  const [menuFilterCat, setMenuFilterCat] = useState('')
  const [newOrder, setNewOrder] = useState<NewOrderForm>({
    customerName: '', customerPhone: '', orderType: 'DINE_IN', tableId: '', notes: '', items: [],
  })
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const fetchOrders = async () => {
    try {
      setError(null)
      const data = await ordersApi.getAll({
        status: filterStatus || undefined,
        orderType: filterType || undefined,
        page,
        limit: LIMIT,
      })
      setOrders(data.orders)
      setTotalPages(data.pagination.pages)
    } catch {
      setError('Failed to load orders.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, [filterStatus, filterType, page])

  const openCreate = async () => {
    setCreateError(null)
    setNewOrder({ customerName: '', customerPhone: '', orderType: 'DINE_IN', tableId: '', notes: '', items: [] })
    try {
      const [menuData, catData, tableData] = await Promise.all([
        menuApi.getItems({ available: true }),
        categoriesApi.getAll(),
        tablesApi.getAll({ isActive: true }),
      ])
      setMenuItems(menuData.menuItems)
      setCategories(catData.categories.filter((c) => c.isActive))
      setAvailableTables(tableData.tables.filter((t) => t.status === 'AVAILABLE'))
    } catch {
      setCreateError('Failed to load menu.')
    }
    setCreateOpen(true)
  }

  const addItemToOrder = (item: MenuItem) => {
    setNewOrder((prev) => {
      const existing = prev.items.find((i) => i.menuItemId === item.id)
      if (existing) {
        return { ...prev, items: prev.items.map((i) => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i) }
      }
      return { ...prev, items: [...prev.items, { menuItemId: item.id, quantity: 1, name: item.name, price: item.price }] }
    })
  }

  const updateItemQty = (menuItemId: string, qty: number) => {
    if (qty < 1) {
      setNewOrder((prev) => ({ ...prev, items: prev.items.filter((i) => i.menuItemId !== menuItemId) }))
    } else {
      setNewOrder((prev) => ({ ...prev, items: prev.items.map((i) => i.menuItemId === menuItemId ? { ...i, quantity: qty } : i) }))
    }
  }

  const orderTotal = newOrder.items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const handleCreate = async () => {
    if (newOrder.items.length === 0) { setCreateError('Add at least one item.'); return }
    setCreating(true)
    setCreateError(null)
    try {
      await ordersApi.create({
        customerName: newOrder.customerName.trim() || undefined,
        customerPhone: newOrder.customerPhone.trim() || undefined,
        orderType: newOrder.orderType,
        tableId: newOrder.tableId || undefined,
        notes: newOrder.notes.trim() || undefined,
        items: newOrder.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
      })
      setCreateOpen(false)
      await fetchOrders()
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create order.')
    } finally {
      setCreating(false)
    }
  }

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    if (status === 'CANCELLED') {
      setUpdatingStatus(true)
      try {
        await ordersApi.cancel(orderId)
        if (detailOrder?.id === orderId) setDetailOrder((prev) => prev ? { ...prev, status: 'CANCELLED' } : prev)
        await fetchOrders()
      } catch { setError('Failed to cancel order.') }
      finally { setUpdatingStatus(false) }
      return
    }
    setUpdatingStatus(true)
    try {
      await ordersApi.updateStatus(orderId, status)
      if (detailOrder?.id === orderId) setDetailOrder((prev) => prev ? { ...prev, status } : prev)
      await fetchOrders()
    } catch { setError('Failed to update status.') }
    finally { setUpdatingStatus(false) }
  }

  const filteredMenuItems = menuFilterCat
    ? menuItems.filter((m) => {
        const cat = categories.find((c) => c.id === menuFilterCat)
        return cat && m.category?.name === cat.name
      })
    : menuItems

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage restaurant orders</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New Order
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4 text-sm">{error}</div>}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex flex-wrap gap-3">
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          {(['PENDING','CONFIRMED','PREPARING','READY','DELIVERED','CANCELLED'] as OrderStatus[]).map((s) => (
            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Types</option>
          {(['DINE_IN','TAKEAWAY','DELIVERY'] as OrderType[]).map((t) => (
            <option key={t} value={t}>{ORDER_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-6">
        {/* Orders Table */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900" />
              </div>
            ) : (
              <>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center">
                          <ShoppingCart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">No orders found.</p>
                        </td>
                      </tr>
                    ) : orders.map((order) => (
                      <tr
                        key={order.id}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${detailOrder?.id === order.id ? 'bg-indigo-50' : ''}`}
                        onClick={() => setDetailOrder(detailOrder?.id === order.id ? null : order)}
                      >
                        <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{order.customerName || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{ORDER_TYPE_LABEL[order.orderType]}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                            {getStatusLabel(order.status, order.orderType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{Math.round(Number(order.totalAmount)).toLocaleString()} RWF</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{format(new Date(order.createdAt), 'MMM dd, HH:mm')}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailOrder(detailOrder?.id === order.id ? null : order) }}
                            className="text-indigo-600 hover:text-indigo-900 transition-colors"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                    <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Order Detail Panel */}
        {detailOrder && (
          <div className="w-80 shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Order Details</h2>
                <button onClick={() => setDetailOrder(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Order #</span>
                  <span className="font-mono font-medium">{detailOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span>{ORDER_TYPE_LABEL[detailOrder.orderType]}</span>
                </div>
                {detailOrder.table && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Table</span>
                    <span>{detailOrder.table.number}{detailOrder.table.location ? ` · ${detailOrder.table.location}` : ''}</span>
                  </div>
                )}
                {detailOrder.customerName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer</span>
                    <span>{detailOrder.customerName}</span>
                  </div>
                )}
                {detailOrder.customerPhone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span>{detailOrder.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[detailOrder.status]}`}>
                    {getStatusLabel(detailOrder.status, detailOrder.orderType)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span>{format(new Date(detailOrder.createdAt), 'MMM dd, HH:mm')}</span>
                </div>
              </div>

              {/* Items */}
              <div className="border-t border-gray-100 pt-3 mb-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Items</p>
                <div className="space-y-2">
                  {detailOrder.orderItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.menuItem?.name ?? 'Item'} × {item.quantity}</span>
                      <span className="font-medium">{Math.round(Number(item.price) * item.quantity).toLocaleString()} RWF</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-semibold text-sm border-t border-gray-100 pt-2 mt-2">
                  <span>Total</span>
                  <span>{Math.round(Number(detailOrder.totalAmount)).toLocaleString()} RWF</span>
                </div>
              </div>

              {detailOrder.notes && (
                <div className="bg-yellow-50 rounded p-2 mb-4 text-xs text-yellow-800">
                  <span className="font-medium">Notes: </span>{detailOrder.notes}
                </div>
              )}

              {/* Status Actions */}
              {STATUS_TRANSITIONS[detailOrder.status].length > 0 && (canManage || detailOrder.status !== 'CANCELLED') && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Update Status</p>
                  {STATUS_TRANSITIONS[detailOrder.status].map((nextStatus) => (
                    <button
                      key={nextStatus}
                      onClick={() => handleStatusUpdate(detailOrder.id, nextStatus)}
                      disabled={updatingStatus}
                      className={`w-full py-1.5 px-3 rounded text-sm font-medium transition-colors disabled:opacity-50 ${
                        nextStatus === 'CANCELLED'
                          ? 'border border-red-300 text-red-600 hover:bg-red-50'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {nextStatus === 'CANCELLED' ? 'Cancel Order' : `Mark as ${getStatusLabel(nextStatus, detailOrder.orderType)}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 shrink-0 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">New Order</h2>
              <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Menu Selection */}
              <div className="flex-1 border-r border-gray-200 overflow-y-auto p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Select Menu Items</p>
                <select
                  value={menuFilterCat}
                  onChange={(e) => setMenuFilterCat(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="space-y-2">
                  {filteredMenuItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addItemToOrder(item)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.category?.name}</p>
                      </div>
                      <span className="text-sm font-semibold text-indigo-600">{Math.round(Number(item.price)).toLocaleString()} RWF</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Summary & Details */}
              <div className="w-72 shrink-0 flex flex-col overflow-hidden">
                {/* Order Items */}
                <div className="flex-1 overflow-y-auto p-4 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-3">Order Items</p>
                  {newOrder.items.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No items added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {newOrder.items.map((item) => (
                        <div key={item.menuItemId} className="flex items-center gap-2 text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{item.name}</p>
                            <p className="text-xs text-gray-500">{Math.round(item.price).toLocaleString()} RWF each</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateItemQty(item.menuItemId, item.quantity - 1)} className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center text-xs hover:bg-gray-100">−</button>
                            <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                            <button onClick={() => updateItemQty(item.menuItemId, item.quantity + 1)} className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center text-xs hover:bg-gray-100">+</button>
                            <button onClick={() => updateItemQty(item.menuItemId, 0)} className="text-red-400 hover:text-red-600 ml-1">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {newOrder.items.length > 0 && (
                    <div className="flex justify-between font-semibold text-sm border-t border-gray-100 pt-2 mt-3">
                      <span>Total</span>
                      <span>{Math.round(orderTotal).toLocaleString()} RWF</span>
                    </div>
                  )}
                </div>

                {/* Order Details Form */}
                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Order Type</label>
                    <select
                      value={newOrder.orderType}
                      onChange={(e) => setNewOrder({ ...newOrder, orderType: e.target.value as OrderType })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="DINE_IN">Dine In</option>
                      <option value="TAKEAWAY">Takeaway</option>
                      <option value="DELIVERY">Delivery</option>
                    </select>
                  </div>
                  {newOrder.orderType === 'DINE_IN' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Table</label>
                      <select
                        value={newOrder.tableId}
                        onChange={(e) => setNewOrder({ ...newOrder, tableId: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">No table / Walk-in</option>
                        {availableTables.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.number}{t.location ? ` — ${t.location}` : ''} ({t.capacity} seats)
                          </option>
                        ))}
                      </select>
                      {availableTables.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">No available tables right now.</p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={newOrder.customerName}
                      onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={newOrder.notes}
                      onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder="Special instructions…"
                      rows={2}
                    />
                  </div>
                  {createError && <p className="text-xs text-red-600">{createError}</p>}
                  <button
                    onClick={handleCreate}
                    disabled={creating || newOrder.items.length === 0}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {creating ? 'Placing Order…' : 'Place Order'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
