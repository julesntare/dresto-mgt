import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { ordersApi, menuApi, categoriesApi, tablesApi } from '../lib/api'
import type { Table } from '../lib/api'
import { useAuth } from '../lib/use-auth'
import { useNotifications } from '../lib/use-notifications'
import { Plus, Eye, X, ChevronLeft, ChevronRight, ShoppingCart, Trash2, Send, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED'

interface OrderMessage {
  id: string
  orderId: string
  content: string
  senderType: 'CLIENT' | 'STAFF'
  senderName: string | null
  isRead: boolean
  createdAt: string
}
type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
type PaymentStatus = 'UNPAID' | 'PENDING_VERIFICATION' | 'PAID'

interface OrderItem {
  menuItemId: string
  quantity: number
  price: number
  excludedIngredients?: string[]
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
  paymentStatus: PaymentStatus
  transactionId?: string
  paymentProvider?: string
  paidAt?: string
}

interface MenuItem { id: string; name: string; price: number; isAvailable: boolean; ingredients: string[]; category?: { name: string } }
interface Category { id: string; name: string }

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  PREPARING: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  READY: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  DELIVERED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  UNPAID: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: 'Unpaid',
  PENDING_VERIFICATION: 'Pending',
  PAID: 'Paid',
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

interface NewOrderItem { menuItemId: string; quantity: number; name: string; price: number; ingredients: string[]; excludedIngredients: string[] }
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
  const { lastOrderEventAt } = useNotifications()
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
  const location = useLocation()
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Payment
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentProvider, setPaymentProvider] = useState('')
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  // Messaging
  const [messages, setMessages] = useState<OrderMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  const fetchMessages = useCallback(async (orderId: string) => {
    try {
      const data = await ordersApi.getMessages(orderId)
      setMessages(data.messages)
    } catch {
      // silently fail on poll
    }
  }, [])

  // Start/stop polling when selected order changes
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (!detailOrder) { setMessages([]); return }

    fetchMessages(detailOrder.id)

    const isActive = !['DELIVERED', 'CANCELLED'].includes(detailOrder.status)
    if (isActive) {
      pollRef.current = setInterval(() => fetchMessages(detailOrder.id), 8000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [detailOrder?.id, detailOrder?.status, fetchMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async () => {
    if (!detailOrder || !messageInput.trim()) return
    setSendingMessage(true)
    try {
      const { message } = await ordersApi.sendMessage(detailOrder.id, messageInput.trim())
      setMessages((prev) => [...prev, message])
      setMessageInput('')
    } catch {
      // ignore
    } finally {
      setSendingMessage(false)
    }
  }

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

  // Refresh when a new SSE order event arrives
  useEffect(() => {
    if (lastOrderEventAt === 0) return
    fetchOrders()
  }, [lastOrderEventAt])

  // 30s polling fallback (in case SSE disconnects)
  useEffect(() => {
    const interval = setInterval(fetchOrders, 30_000)
    return () => clearInterval(interval)
  }, [filterStatus, filterType, page])

  // Auto-open order from notification navigation
  useEffect(() => {
    const openOrderId = (location.state as { openOrderId?: string } | null)?.openOrderId
    if (!openOrderId || orders.length === 0) return
    const target = orders.find((o) => o.id === openOrderId)
    if (target) setDetailOrder(target)
  }, [orders, location.state])

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
      return { ...prev, items: [...prev.items, { menuItemId: item.id, quantity: 1, name: item.name, price: item.price, ingredients: item.ingredients ?? [], excludedIngredients: [] }] }
    })
  }

  const toggleExcludeIngredient = (menuItemId: string, ingredient: string) => {
    setNewOrder((prev) => ({
      ...prev,
      items: prev.items.map((i) => {
        if (i.menuItemId !== menuItemId) return i
        const excluded = i.excludedIngredients.includes(ingredient)
          ? i.excludedIngredients.filter((e) => e !== ingredient)
          : [...i.excludedIngredients, ingredient]
        return { ...i, excludedIngredients: excluded }
      }),
    }))
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
        items: newOrder.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, excludedIngredients: i.excludedIngredients.length > 0 ? i.excludedIngredients : undefined })),
      })
      setCreateOpen(false)
      await fetchOrders()
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create order.')
    } finally {
      setCreating(false)
    }
  }

  const handleRecordPayment = async () => {
    if (!detailOrder || !paymentRef.trim()) return
    setRecordingPayment(true)
    setPaymentError(null)
    try {
      const { order } = await ordersApi.recordPayment(detailOrder.id, paymentRef.trim(), paymentProvider.trim() || undefined)
      setDetailOrder({ ...detailOrder, ...order })
      setPaymentRef('')
      setPaymentProvider('')
      await fetchOrders()
    } catch {
      setPaymentError('Failed to record payment.')
    } finally {
      setRecordingPayment(false)
    }
  }

  const handleConfirmPayment = async () => {
    if (!detailOrder) return
    setRecordingPayment(true)
    setPaymentError(null)
    try {
      const { order } = await ordersApi.confirmPayment(detailOrder.id)
      setDetailOrder({ ...detailOrder, ...order })
      await fetchOrders()
    } catch {
      setPaymentError('Failed to confirm payment.')
    } finally {
      setRecordingPayment(false)
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Manage restaurant orders</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New Order
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg mb-4 text-sm">{error}</div>}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6 flex flex-wrap gap-3">
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          {(['PENDING','CONFIRMED','PREPARING','READY','DELIVERED','CANCELLED'] as OrderStatus[]).map((s) => (
            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 dark:border-gray-100" />
              </div>
            ) : (
              <>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center">
                          <ShoppingCart className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-500 dark:text-gray-400">No orders found.</p>
                        </td>
                      </tr>
                    ) : orders.map((order) => (
                      <tr
                        key={order.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${detailOrder?.id === order.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                        onClick={() => { setDetailOrder(detailOrder?.id === order.id ? null : order); setPaymentRef(''); setPaymentProvider(''); setPaymentError(null) }}
                      >
                        <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900 dark:text-white">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{order.customerName || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{ORDER_TYPE_LABEL[order.orderType]}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                            {getStatusLabel(order.status, order.orderType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{Math.round(Number(order.totalAmount)).toLocaleString()} RWF</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{format(new Date(order.createdAt), 'MMM dd, HH:mm')}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailOrder(detailOrder?.id === order.id ? null : order) }}
                            className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 transition-colors"
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
                  <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">Order Details</h2>
                <button onClick={() => setDetailOrder(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Order #</span>
                  <span className="font-mono font-medium dark:text-white">{detailOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Type</span>
                  <span className="dark:text-gray-300">{ORDER_TYPE_LABEL[detailOrder.orderType]}</span>
                </div>
                {detailOrder.table && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Table</span>
                    <span className="dark:text-gray-300">{detailOrder.table.number}{detailOrder.table.location ? ` · ${detailOrder.table.location}` : ''}</span>
                  </div>
                )}
                {detailOrder.customerName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Customer</span>
                    <span className="dark:text-gray-300">{detailOrder.customerName}</span>
                  </div>
                )}
                {detailOrder.customerPhone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Phone</span>
                    <span className="dark:text-gray-300">{detailOrder.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[detailOrder.status]}`}>
                    {getStatusLabel(detailOrder.status, detailOrder.orderType)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Created</span>
                  <span className="dark:text-gray-300">{format(new Date(detailOrder.createdAt), 'MMM dd, HH:mm')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400">Payment</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_COLORS[detailOrder.paymentStatus ?? 'UNPAID']}`}>
                    {PAYMENT_STATUS_LABEL[detailOrder.paymentStatus ?? 'UNPAID']}
                  </span>
                </div>
                {detailOrder.transactionId && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Ref #</span>
                    <span className="font-mono text-xs dark:text-gray-300">{detailOrder.transactionId}</span>
                  </div>
                )}
                {detailOrder.paymentProvider && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Provider</span>
                    <span className="dark:text-gray-300">{detailOrder.paymentProvider}</span>
                  </div>
                )}
                {detailOrder.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Paid at</span>
                    <span className="dark:text-gray-300">{format(new Date(detailOrder.paidAt), 'MMM dd, HH:mm')}</span>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mb-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Items</p>
                <div className="space-y-2">
                  {detailOrder.orderItems.map((item, i) => (
                    <div key={i} className="text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-700 dark:text-gray-300">{item.menuItem?.name ?? 'Item'} × {item.quantity}</span>
                        <span className="font-medium dark:text-white">{Math.round(Number(item.price) * item.quantity).toLocaleString()} RWF</span>
                      </div>
                      {item.excludedIngredients && item.excludedIngredients.length > 0 && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                          No: {item.excludedIngredients.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-semibold text-sm border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
                  <span className="dark:text-white">Total</span>
                  <span className="dark:text-white">{Math.round(Number(detailOrder.totalAmount)).toLocaleString()} RWF</span>
                </div>
              </div>

              {detailOrder.notes && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-2 mb-4 text-xs text-yellow-800 dark:text-yellow-300">
                  <span className="font-medium">Notes: </span>{detailOrder.notes}
                </div>
              )}

              {/* Payment Actions */}
              {detailOrder.status !== 'CANCELLED' && detailOrder.paymentStatus !== 'PAID' && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mb-4 space-y-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment</p>

                  {detailOrder.paymentStatus === 'UNPAID' && (
                    <>
                      <input
                        type="text"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        placeholder="Reference / Transaction ID"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        value={paymentProvider}
                        onChange={(e) => setPaymentProvider(e.target.value)}
                        placeholder="Provider (e.g. MTN MoMo)"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={handleRecordPayment}
                        disabled={recordingPayment || !paymentRef.trim()}
                        className="w-full py-1.5 px-3 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {recordingPayment ? 'Saving…' : 'Record Payment'}
                      </button>
                    </>
                  )}

                  {detailOrder.paymentStatus === 'PENDING_VERIFICATION' && (
                    <button
                      onClick={handleConfirmPayment}
                      disabled={recordingPayment}
                      className="w-full py-1.5 px-3 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {recordingPayment ? 'Confirming…' : 'Confirm Payment Received'}
                    </button>
                  )}

                  {paymentError && <p className="text-xs text-red-600 dark:text-red-400">{paymentError}</p>}
                </div>
              )}

              {/* Status Actions */}
              {STATUS_TRANSITIONS[detailOrder.status].length > 0 && (canManage || detailOrder.status !== 'CANCELLED') && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Update Status</p>
                  {STATUS_TRANSITIONS[detailOrder.status].map((nextStatus) => (
                    <button
                      key={nextStatus}
                      onClick={() => handleStatusUpdate(detailOrder.id, nextStatus)}
                      disabled={updatingStatus}
                      className={`w-full py-1.5 px-3 rounded text-sm font-medium transition-colors disabled:opacity-50 ${
                        nextStatus === 'CANCELLED'
                          ? 'border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {nextStatus === 'CANCELLED' ? 'Cancel Order' : `Mark as ${getStatusLabel(nextStatus, detailOrder.orderType)}`}
                    </button>
                  ))}
                </div>
              )}

              {/* Message Thread */}
              {!['DELIVERED', 'CANCELLED'].includes(detailOrder.status) && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer Chat</p>
                  </div>

                  <div className="h-40 overflow-y-auto space-y-2 mb-2 pr-1">
                    {messages.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No messages yet.</p>
                    ) : messages.map((msg) => {
                      const isStaff = msg.senderType === 'STAFF'
                      return (
                        <div key={msg.id} className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5 px-1">
                            {msg.senderName || (isStaff ? 'Staff' : 'Customer')} · {format(new Date(msg.createdAt), 'HH:mm')}
                          </span>
                          <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs ${
                            isStaff
                              ? 'bg-indigo-600 text-white rounded-tr-none'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                      placeholder="Type a message…"
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={sendingMessage || !messageInput.trim()}
                      className="p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Closed order messages (read-only) */}
              {['DELIVERED', 'CANCELLED'].includes(detailOrder.status) && messages.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Chat History</p>
                  </div>
                  <div className="h-32 overflow-y-auto space-y-2 pr-1">
                    {messages.map((msg) => {
                      const isStaff = msg.senderType === 'STAFF'
                      return (
                        <div key={msg.id} className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5 px-1">
                            {msg.senderName || (isStaff ? 'Staff' : 'Customer')} · {format(new Date(msg.createdAt), 'HH:mm')}
                          </span>
                          <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs ${
                            isStaff
                              ? 'bg-indigo-600 text-white rounded-tr-none'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Order</h2>
              <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Menu Selection */}
              <div className="flex-1 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select Menu Items</p>
                <select
                  value={menuFilterCat}
                  onChange={(e) => setMenuFilterCat(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="space-y-2">
                  {filteredMenuItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addItemToOrder(item)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.category?.name}</p>
                      </div>
                      <span className="text-sm font-semibold text-indigo-600">{Math.round(Number(item.price)).toLocaleString()} RWF</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Summary & Details */}
              <div className="w-72 shrink-0 flex flex-col overflow-hidden">
                {/* Order Items */}
                <div className="flex-1 overflow-y-auto p-4 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Order Items</p>
                  {newOrder.items.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No items added yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {newOrder.items.map((item) => (
                        <div key={item.menuItemId} className="text-sm">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{Math.round(item.price).toLocaleString()} RWF each</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => updateItemQty(item.menuItemId, item.quantity - 1)} className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white">−</button>
                              <span className="w-6 text-center text-xs font-medium dark:text-white">{item.quantity}</span>
                              <button onClick={() => updateItemQty(item.menuItemId, item.quantity + 1)} className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white">+</button>
                              <button onClick={() => updateItemQty(item.menuItemId, 0)} className="text-red-400 hover:text-red-600 ml-1">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          {item.ingredients.length > 0 && (
                            <div className="mt-1.5 pl-0.5">
                              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Exclude:</p>
                              <div className="flex flex-wrap gap-1">
                                {item.ingredients.map((ing) => (
                                  <label key={ing} className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={item.excludedIngredients.includes(ing)}
                                      onChange={() => toggleExcludeIngredient(item.menuItemId, ing)}
                                      className="rounded border-gray-300 text-red-500 focus:ring-red-400 w-3 h-3"
                                    />
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${item.excludedIngredients.includes(ing) ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 line-through' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{ing}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {newOrder.items.length > 0 && (
                    <div className="flex justify-between font-semibold text-sm border-t border-gray-100 dark:border-gray-700 pt-2 mt-3">
                      <span className="dark:text-white">Total</span>
                      <span className="dark:text-white">{Math.round(orderTotal).toLocaleString()} RWF</span>
                    </div>
                  )}
                </div>

                {/* Order Details Form */}
                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Order Type</label>
                    <select
                      value={newOrder.orderType}
                      onChange={(e) => setNewOrder({ ...newOrder, orderType: e.target.value as OrderType })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="DINE_IN">Dine In</option>
                      <option value="TAKEAWAY">Takeaway</option>
                      <option value="DELIVERY">Delivery</option>
                    </select>
                  </div>
                  {newOrder.orderType === 'DINE_IN' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Table</label>
                      <select
                        value={newOrder.tableId}
                        onChange={(e) => setNewOrder({ ...newOrder, tableId: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">No table / Walk-in</option>
                        {availableTables.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.number}{t.location ? ` — ${t.location}` : ''} ({t.capacity} seats)
                          </option>
                        ))}
                      </select>
                      {availableTables.length === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No available tables right now.</p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={newOrder.customerName}
                      onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <textarea
                      value={newOrder.notes}
                      onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder="Special instructions…"
                      rows={2}
                    />
                  </div>
                  {createError && <p className="text-xs text-red-600 dark:text-red-400">{createError}</p>}
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
