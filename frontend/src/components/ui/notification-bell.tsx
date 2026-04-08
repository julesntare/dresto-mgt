import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useNotifications, type AppNotification } from "../../lib/use-notifications";

const typeColors: Record<AppNotification["type"], string> = {
  ORDER_CREATED: "bg-green-500",
  ORDER_UPDATED: "bg-blue-500",
  ORDER_CANCELLED: "bg-red-500",
};

export default function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const { notifications, unreadCount, isConnected, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggle() {
    setOpen((v) => !v);
    if (!open && unreadCount > 0) markAllRead();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative flex items-center w-full px-2 py-2 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors"
        title="Notifications"
      >
        <Bell className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="ml-3">Notifications</span>}
        {unreadCount > 0 && (
          <span className="absolute top-1 left-5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 rounded-lg bg-gray-800 shadow-xl border border-gray-700 z-50">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Notifications</span>
              <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-400" : "bg-gray-500"}`} title={isConnected ? "Live" : "Connecting..."} />
            </div>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    setOpen(false);
                    navigate("/dashboard/orders", { state: { openOrderId: n.orderId } });
                  }}
                  className={`flex gap-3 px-4 py-3 border-b border-gray-700 last:border-0 cursor-pointer hover:bg-gray-700 transition-colors ${
                    n.read ? "opacity-60" : ""
                  }`}
                >
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${typeColors[n.type]}`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{n.title}</p>
                    <p className="text-xs text-gray-400 truncate">{n.body}</p>
                    <p className="mt-1 text-[10px] text-gray-500">
                      {new Date(n.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
