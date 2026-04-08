import type { ReactNode } from "react";
import Sidebar from "../components/layout/sidebar";
import ProtectedRoute from "../components/ui/protected-route";
import NotificationToastContainer from "../components/ui/notification-toast";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
        <NotificationToastContainer />
      </div>
    </ProtectedRoute>
  );
}
