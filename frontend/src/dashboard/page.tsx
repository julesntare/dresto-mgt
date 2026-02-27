import { useEffect, useState, useMemo, type ReactNode } from "react";
import { useAuth } from "../lib/auth-context";
import { ordersApi } from "../lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Clock,
  DollarSign,
  Package,
  ShoppingBag,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { format } from "date-fns";

interface OrderStats {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  completionRate: number;
  popularItems: Array<{
    menuItemId: string;
    _sum: { quantity: number };
    menuItem: { name: string; price: number };
  }>;
}

interface DailySales {
  date: string;
  order_count: number;
  total_revenue: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [loading, setLoading] = useState(true);

  // Memoize formatted dates to prevent hydration mismatch
  const formattedDailySales = useMemo(() => {
    return dailySales.map((sale) => ({
      ...sale,
      formattedDate: format(new Date(sale.date), "MMM dd"),
      fullDate: format(new Date(sale.date), "MMMM dd, yyyy"),
    }));
  }, [dailySales]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsData, salesData] = await Promise.all([
          ordersApi.getStats(),
          ordersApi.getDailySales(7),
        ]);
        setStats(statsData.stats);
        setDailySales(salesData.dailySales);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Welcome back, {user?.name}</h1>
        <p className="text-gray-600">
          Here&apos;s what&apos;s happening with your restaurant today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Orders"
          value={stats?.totalOrders || 0}
          icon={<Package className="h-6 w-6" />}
          trend={10}
        />
        <StatCard
          title="Pending Orders"
          value={stats?.pendingOrders || 0}
          icon={<Clock className="h-6 w-6" />}
          trend={-5}
          trendColor="yellow"
        />
        <StatCard
          title="Completed Orders"
          value={stats?.completedOrders || 0}
          icon={<ShoppingBag className="h-6 w-6" />}
          trend={15}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={<DollarSign className="h-6 w-6" />}
          trend={8}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Revenue (Last 7 Days)</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedDailySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="formattedDate" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label: string) =>
                    formattedDailySales.find(
                      (sale) => sale.formattedDate === label
                    )?.fullDate || label
                  }
                />
                <Bar dataKey="total_revenue" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Popular Items</h2>
          <div className="space-y-4">
            {stats?.popularItems?.slice(0, 5).map((item) => (
              <div
                key={item.menuItemId}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{item.menuItem.name}</p>
                  <p className="text-sm text-gray-500">
                    {item._sum.quantity} orders
                  </p>
                </div>
                <span className="font-medium">
                  {formatCurrency(item.menuItem.price * item._sum.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Order Completion Rate</h2>
          <div className="flex items-end space-x-2">
            <span className="text-3xl font-bold">{stats?.completionRate}%</span>
            <span className="text-green-500 flex items-center">
              <ArrowUp className="h-4 w-4" />
              2.1%
            </span>
          </div>
          <p className="text-gray-500 mt-1">Compared to last week</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Cancellation Rate</h2>
          <div className="flex items-end space-x-2">
            <span className="text-3xl font-bold">
              {stats && stats.totalOrders > 0
                ? ((stats.cancelledOrders / stats.totalOrders) * 100).toFixed(1)
                : 0}
              %
            </span>
            <span className="text-red-500 flex items-center">
              <ArrowDown className="h-4 w-4" />
              0.8%
            </span>
          </div>
          <p className="text-gray-500 mt-1">Compared to last week</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  trend,
  trendColor = trend > 0 ? "green" : "red",
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend: number;
  trendColor?: "green" | "red" | "yellow";
}) {
  const trendColorClasses = {
    green: "text-green-500",
    red: "text-red-500",
    yellow: "text-yellow-500",
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-indigo-50 rounded-lg">{icon}</div>
        <span className={`flex items-center ${trendColorClasses[trendColor]}`}>
          {trend > 0 ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )}
          {Math.abs(trend)}%
        </span>
      </div>
      <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
