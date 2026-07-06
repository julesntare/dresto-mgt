import { useState, useEffect, useCallback, useRef } from 'react'
import { ordersApi } from '../lib/api'
import { useNotifications } from '../lib/use-notifications'
import { Clock, ChefHat } from 'lucide-react'

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED'
type ApiOrder = Awaited<ReturnType<typeof ordersApi.getAll>>['orders'][number]

const COLUMNS: { status: OrderStatus; label: string; next?: OrderStatus }[] = [
  { status: 'PENDING', label: 'Pending', next: 'CONFIRMED' },
  { status: 'CONFIRMED', label: 'Confirmed', next: 'PREPARING' },
  { status: 'PREPARING', label: 'Preparing', next: 'READY' },
  { status: 'READY', label: 'Ready', next: 'DELIVERED' },
]

function playBeep() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // audio not supported/blocked — not critical
  }
}

function ElapsedTime({ createdAt }: { createdAt: string }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
  return <span>{minutes}m</span>
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const { notifications, lastOrderEventAt } = useNotifications()
  const lastSeenNotifId = useRef<string | null>(null)

  const fetchActiveOrders = useCallback(async () => {
    try {
      setError(null)
      const results = await Promise.all(
        COLUMNS.map((c) => ordersApi.getAll({ status: c.status, limit: 50 })),
      )
      const combined = results.flatMap((r) => r.orders)
      combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      setOrders(combined)
    } catch {
      setError('Failed to load orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActiveOrders()
    const poll = setInterval(fetchActiveOrders, 30000)
    return () => clearInterval(poll)
  }, [fetchActiveOrders])

  // Live refresh on any order SSE event
  useEffect(() => {
    if (lastOrderEventAt === 0) return
    fetchActiveOrders()
  }, [lastOrderEventAt, fetchActiveOrders])

  // New-order sound cue
  useEffect(() => {
    const latest = notifications[0]
    if (!latest || latest.type !== 'ORDER_CREATED') return
    if (lastSeenNotifId.current === latest.id) return
    lastSeenNotifId.current = latest.id
    playBeep()
  }, [notifications])

  const handleAdvance = async (order: ApiOrder, next: OrderStatus) => {
    setUpdatingId(order.id)
    try {
      await ordersApi.updateStatus(order.id, next)
      await fetchActiveOrders()
    } catch {
      setError('Failed to update order status.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ChefHat className="h-6 w-6" /> Kitchen Board
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Live view of active orders — tap to advance status</p>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg mb-4 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 dark:border-gray-100" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const columnOrders = orders.filter((o) => o.status === col.status)
            return (
              <div key={col.status} className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{col.label}</h2>
                  <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5">
                    {columnOrders.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {columnOrders.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">No orders</p>
                  )}
                  {columnOrders.map((order) => (
                    <div key={order.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">{order.orderNumber}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> <ElapsedTime createdAt={order.createdAt} />
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        {order.orderType === 'DINE_IN' && order.table ? `Table ${order.table.number}` : order.orderType.replace('_', ' ')}
                        {order.customerName ? ` · ${order.customerName}` : ''}
                      </p>
                      <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-0.5 mb-3">
                        {order.orderItems.map((item, i) => (
                          <li key={i}>
                            {item.quantity}× {item.menuItem?.name ?? 'Item'}
                            {item.excludedIngredients && item.excludedIngredients.length > 0 && (
                              <span className="text-red-500"> (no {item.excludedIngredients.join(', ')})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {col.next && (
                        <button
                          onClick={() => handleAdvance(order, col.next!)}
                          disabled={updatingId === order.id}
                          className="w-full text-xs bg-indigo-600 text-white rounded-md py-1.5 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {updatingId === order.id
                            ? 'Updating…'
                            : `Mark ${col.next === 'DELIVERED' ? (order.orderType === 'DINE_IN' ? 'Served' : 'Delivered') : col.next}`}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
