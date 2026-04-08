import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, ShoppingCart } from "lucide-react";
import { useNotifications, type Toast } from "../../lib/use-notifications";

const typeStyles = {
  ORDER_CREATED: "border-l-green-500",
  ORDER_UPDATED: "border-l-blue-500",
  ORDER_CANCELLED: "border-l-red-500",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const navigate = useNavigate();

  // Auto-dismiss when expired
  useEffect(() => {
    const remaining = toast.expiresAt - Date.now();
    if (remaining <= 0) { onDismiss(); return; }
    const timer = setTimeout(onDismiss, remaining);
    return () => clearTimeout(timer);
  }, [toast.expiresAt, onDismiss]);

  function handleClick() {
    onDismiss();
    navigate("/dashboard/orders", { state: { openOrderId: toast.orderId } });
  }

  return (
    <div
      onClick={handleClick}
      className={`flex items-start gap-3 w-80 bg-gray-900 border border-gray-700 border-l-4 ${typeStyles[toast.type]} rounded-lg shadow-xl p-4 cursor-pointer hover:bg-gray-800 transition-colors animate-slide-in`}
    >
      <ShoppingCart className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{toast.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{toast.body}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="text-gray-500 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function NotificationToastContainer() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={() => dismissToast(toast.id)} />
        </div>
      ))}
    </div>
  );
}
