import { useState, useEffect, useMemo } from 'react'
import { ordersApi } from '../lib/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { TrendingUp, ShoppingBag, DollarSign, XCircle, BarChart3, Hash } from 'lucide-react'

interface Stats {
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  pendingOrders: number
  totalRevenue: number
  completionRate: number
  averageOrderValue?: number
  ordersByType?: Array<{ type: string; count: number; revenue: number }>
  popularItems: Array<{
    menuItemId: string
    _sum: { quantity: number; price?: number }
    menuItem: { name: string; price: number }
  }>
}

interface DailySale { date: string; order_count: number; total_revenue: number }

const STATUS_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#6b7280']
const TYPE_COLORS: Record<string, string> = {
  DINE_IN: '#6366f1',
  TAKEAWAY: '#22c55e',
  DELIVERY: '#f59e0b',
}
const TYPE_LABELS: Record<string, string> = {
  DINE_IN: 'Dine In',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
}

const RANGE_OPTIONS = [
  { label: '7 Days', days: 7 },
  { label: '14 Days', days: 14 },
  { label: '30 Days', days: 30 },
]

function formatCurrency(amount: number) {
  return `${Math.round(amount).toLocaleString('en-US')}RWF`
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [dailySales, setDailySales] = useState<DailySale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDays, setSelectedDays] = useState(7)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const startDate = format(subDays(new Date(), selectedDays), 'yyyy-MM-dd')
      const endDate = format(new Date(), 'yyyy-MM-dd')

      const [statsData, salesData] = await Promise.all([
        ordersApi.getStats({ startDate, endDate }),
        ordersApi.getDailySales(selectedDays),
      ])
      setStats(statsData.stats)
      setDailySales(salesData.dailySales)
    } catch {
      setError('Failed to load analytics data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [selectedDays])

  const formattedSales = useMemo(() =>
    dailySales.map((s) => ({
      ...s,
      label: format(new Date(s.date), 'MMM dd'),
    })), [dailySales])

  const statusPieData = stats ? [
    { name: 'Completed', value: stats.completedOrders },
    { name: 'Pending', value: stats.pendingOrders },
    { name: 'Cancelled', value: stats.cancelledOrders },
    { name: 'Other', value: Math.max(0, stats.totalOrders - stats.completedOrders - stats.pendingOrders - stats.cancelledOrders) },
  ].filter((d) => d.value > 0) : []

  const orderTypeChartData = (stats?.ordersByType || []).map((t) => ({
    name: TYPE_LABELS[t.type] || t.type,
    orders: t.count,
    revenue: t.revenue,
    color: TYPE_COLORS[t.type] || '#6b7280',
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1 text-sm">Sales and performance overview</p>
        </div>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setSelectedDays(opt.days)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedDays === opt.days
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4 text-sm">{error}</div>}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard
          label="Total Revenue"
          value={formatCurrency(stats?.totalRevenue ?? 0)}
          icon={<DollarSign className="h-5 w-5 text-indigo-600" />}
          bg="bg-indigo-50"
        />
        <KpiCard
          label="Total Orders"
          value={String(stats?.totalOrders ?? 0)}
          icon={<ShoppingBag className="h-5 w-5 text-blue-600" />}
          bg="bg-blue-50"
        />
        <KpiCard
          label="Avg Order Value"
          value={formatCurrency(stats?.averageOrderValue ?? 0)}
          icon={<Hash className="h-5 w-5 text-purple-600" />}
          bg="bg-purple-50"
        />
        <KpiCard
          label="Completion Rate"
          value={`${stats?.completionRate ?? 0}%`}
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          bg="bg-green-50"
        />
        <KpiCard
          label="Cancelled"
          value={String(stats?.cancelledOrders ?? 0)}
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          bg="bg-red-50"
        />
      </div>

      {/* Revenue + Order Volume Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Daily Revenue</h2>
          {formattedSales.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formattedSales} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                  <Bar dataKey="total_revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Order Volume Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Daily Order Volume</h2>
          {formattedSales.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formattedSales} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, 'Orders']} />
                  <Bar dataKey="order_count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Order Type Breakdown */}
      {orderTypeChartData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Order Type Breakdown</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stacked bar by type */}
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={orderTypeChartData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={70} />
                  <Tooltip formatter={(v: number) => [v, 'Orders']} />
                  <Bar dataKey="orders" radius={[0, 4, 4, 0]}>
                    {orderTypeChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue by type */}
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={orderTypeChartData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={70} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {orderTypeChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Type summary cards */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {orderTypeChartData.map((t) => (
              <div key={t.name} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                  <span className="text-sm font-medium text-gray-700">{t.name}</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{t.orders} orders</p>
                <p className="text-xs text-gray-500">{formatCurrency(t.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status + Popular Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Order Status Distribution</h2>
          {statusPieData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusPieData.map((_, i) => (
                      <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend formatter={(v) => <span className="text-xs text-gray-600">{v}</span>} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Popular Items */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Top Items</h2>
          {!stats?.popularItems?.length ? (
            <EmptyChart />
          ) : (
            <div className="space-y-3">
              {stats.popularItems.slice(0, 6).map((item, i) => {
                const maxQty = stats.popularItems[0]._sum.quantity
                const pct = Math.round((item._sum.quantity / maxQty) * 100)
                const revenue = item._sum.price
                  ? item._sum.price
                  : item.menuItem.price * item._sum.quantity
                return (
                  <div key={item.menuItemId}>
                    <div className="flex justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                        <span className="font-medium text-gray-800">{item.menuItem.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{item._sum.quantity} sold</span>
                        <span className="text-xs text-gray-400">{formatCurrency(revenue)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon, bg }: { label: string; value: string; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
      <BarChart3 className="h-10 w-10 mb-2" />
      <p className="text-sm">No data for this period</p>
    </div>
  )
}
