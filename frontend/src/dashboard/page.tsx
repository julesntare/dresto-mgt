import { useEffect, useState, useMemo, type ReactNode } from "react";
import { useAuth } from "../lib/auth-context";
import { ordersApi } from "../lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ShoppingBag, Clock, CheckCircle, XCircle, DollarSign, TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

interface OrderStats {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  completionRate: number;
  averageOrderValue?: number;
  ordersByType?: Array<{ type: string; count: number; revenue: number }>;
  popularItems: Array<{
    menuItemId: string;
    _sum: { quantity: number; price?: number };
    menuItem: { name: string; price: number };
  }>;
}

interface DailySales {
  date: string;
  order_count: number;
  total_revenue: number;
}

function formatCurrency(amount: number): string {
  return `RWF ${Math.round(amount).toLocaleString("en-US")}`;
}

const ORDER_TYPE_COLORS: Record<string, string> = {
  DINE_IN: "#6366f1",
  TAKEAWAY: "#22c55e",
  DELIVERY: "#f59e0b",
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  DINE_IN: "Dine In",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [loading, setLoading] = useState(true);

  const formattedDailySales = useMemo(() =>
    dailySales.map((s) => ({
      ...s,
      label: format(new Date(s.date), "MMM dd"),
    })), [dailySales]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, salesData] = await Promise.all([
          ordersApi.getStats(),
          ordersApi.getDailySales(7),
        ]);
        setStats(statsData.stats);
        setDailySales(salesData.dailySales);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const isManager = user?.role === "ADMIN" || user?.role === "MANAGER";

  const activeOrders = stats
    ? stats.totalOrders - stats.completedOrders - stats.cancelledOrders
    : 0;

  const cancellationRate =
    stats && stats.totalOrders > 0
      ? ((stats.cancelledOrders / stats.totalOrders) * 100).toFixed(1)
      : "0.0";

  const orderTypeData = (stats?.ordersByType || []).map((t) => ({
    name: ORDER_TYPE_LABELS[t.type] || t.type,
    value: t.count,
    revenue: t.revenue,
    color: ORDER_TYPE_COLORS[t.type] || "#6b7280",
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.name}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Here's what's happening with your restaurant today.
        </p>
      </div>

      {/* KPI Cards */}
      <div className={`grid gap-4 mb-6 ${isManager ? "grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" : "grid-cols-2 sm:grid-cols-4"}`}>
        <KpiCard
          label="Total Orders"
          value={String(stats?.totalOrders ?? 0)}
          icon={<ShoppingBag className="h-5 w-5 text-indigo-600" />}
          bg="bg-indigo-50"
        />
        <KpiCard
          label="Active"
          value={String(Math.max(0, activeOrders))}
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          bg="bg-amber-50"
          sub="In progress"
        />
        <KpiCard
          label="Completed"
          value={String(stats?.completedOrders ?? 0)}
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          bg="bg-green-50"
        />
        <KpiCard
          label="Cancelled"
          value={String(stats?.cancelledOrders ?? 0)}
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          bg="bg-red-50"
        />
        {isManager && (
          <KpiCard
            label="Total Revenue"
            value={formatCurrency(stats?.totalRevenue ?? 0)}
            icon={<DollarSign className="h-5 w-5 text-blue-600" />}
            bg="bg-blue-50"
          />
        )}
        {isManager && (
          <KpiCard
            label="Avg Order"
            value={formatCurrency(stats?.averageOrderValue ?? 0)}
            icon={<TrendingUp className="h-5 w-5 text-purple-600" />}
            bg="bg-purple-50"
            sub="Per completed"
          />
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue Chart - spans 2 cols for managers */}
        {isManager ? (
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Revenue — Last 7 Days
            </h2>
            {formattedDailySales.length === 0 ? (
              <EmptyState label="No revenue data" />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedDailySales} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                    />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                    <Bar dataKey="total_revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          /* Order Volume for staff (no revenue) */
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Order Volume — Last 7 Days
            </h2>
            {formattedDailySales.length === 0 ? (
              <EmptyState label="No order data" />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedDailySales} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => [v, "Orders"]} />
                    <Bar dataKey="order_count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Order Type Donut */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Order Types</h2>
          {orderTypeData.length === 0 ? (
            <EmptyState label="No data" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderTypeData}
                    cx="50%"
                    cy="45%"
                    innerRadius={48}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {orderTypeData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(v) => <span className="text-xs text-gray-600">{v}</span>}
                  />
                  <Tooltip
                    formatter={(v: number, _name, props) => [
                      isManager
                        ? `${v} orders · ${formatCurrency(props.payload.revenue)}`
                        : `${v} orders`,
                      props.payload.name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Order Volume (for managers — alongside revenue chart above) */}
        {isManager && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Order Volume — Last 7 Days
            </h2>
            {formattedDailySales.length === 0 ? (
              <EmptyState label="No order data" />
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedDailySales} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => [v, "Orders"]} />
                    <Bar dataKey="order_count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Top Items */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Top Items</h2>
          {!stats?.popularItems?.length ? (
            <EmptyState label="No items data" />
          ) : (
            <div className="space-y-3">
              {stats.popularItems.slice(0, 5).map((item, i) => {
                const maxQty = stats.popularItems[0]._sum.quantity;
                const pct = Math.round((item._sum.quantity / maxQty) * 100);
                const revenue = item._sum.price
                  ? item._sum.price
                  : item.menuItem.price * item._sum.quantity;
                return (
                  <div key={item.menuItemId}>
                    <div className="flex justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 w-4">
                          #{i + 1}
                        </span>
                        <span className="font-medium text-gray-800">
                          {item.menuItem.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-gray-500">{item._sum.quantity} sold</span>
                        {isManager && (
                          <span className="text-xs text-gray-400">
                            {formatCurrency(revenue)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Performance Summary */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Performance Summary
        </h2>
        <div className={`grid gap-6 ${isManager ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`}>
          <MetricRow
            label="Completion Rate"
            value={`${stats?.completionRate ?? 0}%`}
            good={Number(stats?.completionRate ?? 0) >= 70}
          />
          <MetricRow
            label="Cancellation Rate"
            value={`${cancellationRate}%`}
            good={Number(cancellationRate) <= 10}
            invertGood
          />
          {isManager && (
            <MetricRow
              label="Avg Order Value"
              value={formatCurrency(stats?.averageOrderValue ?? 0)}
              good
            />
          )}
          {isManager && (
            <MetricRow
              label="Active Orders"
              value={String(Math.max(0, activeOrders))}
              good={activeOrders > 0}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, icon, bg, sub,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  bg: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${bg}`}>{icon}</div>
      </div>
      <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function MetricRow({
  label, value, good, invertGood = false,
}: {
  label: string;
  value: string;
  good: boolean;
  invertGood?: boolean;
}) {
  const isGood = invertGood ? !good : good;
  return (
    <div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${isGood ? "text-green-600" : "text-red-500"}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-gray-400">
      <p className="text-sm">{label}</p>
    </div>
  );
}
