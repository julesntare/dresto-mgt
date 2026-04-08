import {
  createContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "./use-auth";
import { api } from "./api";

export interface AppNotification {
  id: string;
  type: "ORDER_CREATED" | "ORDER_UPDATED" | "ORDER_CANCELLED";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  orderId?: string;
  orderNumber?: string;
  meta?: Record<string, unknown>;
}

export interface Toast extends AppNotification {
  expiresAt: number;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  toasts: Toast[];
  unreadCount: number;
  lastOrderEventAt: number;   // timestamp — watch this to trigger re-fetches
  isConnected: boolean;
  markAllRead: () => void;
  clearAll: () => void;
  dismissToast: (id: string) => void;
}

export const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  toasts: [],
  unreadCount: 0,
  lastOrderEventAt: 0,
  isConnected: false,
  markAllRead: () => {},
  clearAll: () => {},
  dismissToast: () => {},
});

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const STAFF_ROLES = ["ADMIN", "MANAGER", "STAFF"];

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastOrderEventAt, setLastOrderEventAt] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const isStaff = user && STAFF_ROLES.includes(user.role);

  const addNotification = useCallback((notif: Omit<AppNotification, "id" | "read">) => {
    const id = crypto.randomUUID();
    const full: AppNotification = { ...notif, id, read: false };
    setNotifications((prev) => [full, ...prev.slice(0, 49)]);
    setToasts((prev) => [...prev, { ...full, expiresAt: Date.now() + 5000 }]);
    setLastOrderEventAt(Date.now());
  }, []);

  // SSE connection
  useEffect(() => {
    if (!isStaff) return;

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const es = new EventSource(
      `http://localhost:5000/api/v1/notifications/stream?token=${encodeURIComponent(token)}`
    );
    eventSourceRef.current = es;

    es.addEventListener("order_created", (e) => {
      const data = JSON.parse(e.data);
      addNotification({
        type: "ORDER_CREATED",
        title: "New Order",
        body: `${data.customerName} placed order ${data.orderNumber} · ${data.status ?? "PENDING"}`,
        createdAt: data.createdAt,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        meta: data,
      });
    });

    es.addEventListener("order_updated", (e) => {
      const data = JSON.parse(e.data);
      const isCancelled = data.type === "ORDER_CANCELLED";
      addNotification({
        type: isCancelled ? "ORDER_CANCELLED" : "ORDER_UPDATED",
        title: isCancelled ? "Order Cancelled" : "Order Updated",
        body: isCancelled
          ? `Order ${data.orderNumber} was cancelled`
          : `Order ${data.orderNumber} is now ${data.status}`,
        createdAt: data.updatedAt,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        meta: data,
      });
    });

    es.addEventListener("connected", () => setIsConnected(true));

    es.onerror = () => {
      setIsConnected(false);
      // Browser auto-reconnects; on reconnect the 'connected' event fires again
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [isStaff, addNotification]);

  // Web Push subscription
  useEffect(() => {
    if (!isStaff || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    async function subscribePush() {
      try {
        // Register the SW, then wait for it to become active.
        // Do NOT use the return value of register() — it may still be in
        // "installing" state and its pushManager will reject subscribe().
        await navigator.serviceWorker.register("/sw.js");
        const reg = await navigator.serviceWorker.ready;
        console.log("[Push] Service worker ready:", reg.scope);

        const permission =
          Notification.permission === "granted"
            ? "granted"
            : await Notification.requestPermission();
        console.log("[Push] Permission:", permission);
        if (permission !== "granted") return;

        const { data } = await api.get<{ publicKey: string }>("/notifications/vapid-key");
        if (!data.publicKey) {
          console.error("[Push] Server returned no VAPID public key — check VAPID_PUBLIC_KEY env var");
          return;
        }

        const existing = await reg.pushManager.getSubscription();
        if (existing) await existing.unsubscribe();

        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });

        await api.post("/notifications/subscribe", { subscription });
        console.log("[Push] Subscribed successfully");
      } catch (err) {
        console.error("[Push] Subscription failed:", err);
      }
    }

    subscribePush();

    return () => {
      // Unsubscribe on logout handled separately
    };
  }, [isStaff]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, toasts, unreadCount, lastOrderEventAt, isConnected, markAllRead, clearAll, dismissToast }}>
      {children}
    </NotificationContext.Provider>
  );
}
