import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Sun,
  Moon,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "../../lib/theme-context";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Menu Items", href: "/dashboard/menu", icon: UtensilsCrossed },
  { name: "Orders", href: "/dashboard/orders", icon: ShoppingCart },
  { name: "Categories", href: "/dashboard/categories", icon: Menu },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    roles: ["ADMIN", "MANAGER"],
  },
  { name: "Users", href: "/dashboard/users", icon: Users, roles: ["ADMIN"] },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["ADMIN"],
  },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNavigation = navigation.filter(
    (item) => !item.roles || item.roles.includes(user?.role || ""),
  );

  return (
    <div
      className={`relative bg-gray-900 text-white transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex items-center justify-between p-4">
        {!collapsed && <h1 className="text-xl font-bold">RestoDash</h1>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md hover:bg-gray-700"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <nav className="mt-8">
        <div className="px-2 space-y-1">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="ml-3">{item.name}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
        {!collapsed && (
          <div className="mb-4 text-sm text-gray-400">
            <p className="font-medium text-white">{user?.name}</p>
            <p>{user?.role}</p>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="flex items-center w-full px-2 py-2 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors"
          title={
            theme === "light" ? "Switch to dark mode" : "Switch to light mode"
          }
        >
          {theme === "light" ? (
            <>
              <Moon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="ml-3">Dark Mode</span>}
            </>
          ) : (
            <>
              <Sun className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="ml-3">Light Mode</span>}
            </>
          )}
        </button>

        <button
          onClick={logout}
          className="flex items-center w-full px-2 py-2 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="ml-3">Sign out</span>}
        </button>
      </div>
    </div>
  );
}
