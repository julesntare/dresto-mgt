import { useContext } from "react";
import { NotificationContext } from "./notification-context";
export type { AppNotification, Toast } from "./notification-context";

export function useNotifications() {
  return useContext(NotificationContext);
}
