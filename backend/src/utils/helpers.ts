export const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  return `ORD${timestamp}${random}`;
};

export const calculateOrderTotal = (
  items: Array<{ price: number; quantity: number }>
): number => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "RWF",
  }).format(amount);
};

export const RESTAURANT_SINGLETON_ID = "singleton";

interface DayHours {
  open?: string; // "HH:MM"
  close?: string; // "HH:MM"
}

type OpeningHours = Partial<Record<"sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat", DayHours>>;

// Rwanda has a single, fixed UTC+2 offset (no DST), so hours are evaluated in that timezone
// regardless of where the server process runs.
export const isRestaurantOpenNow = (openingHours: unknown): boolean => {
  if (!openingHours || typeof openingHours !== "object") return true;

  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Kigali",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value.toLowerCase().slice(0, 3);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const nowMinutes = hour * 60 + minute;

  const dayConfig = (openingHours as OpeningHours)[weekday as keyof OpeningHours];
  if (!dayConfig?.open || !dayConfig?.close) return false;

  const [openH, openM] = dayConfig.open.split(":").map(Number);
  const [closeH, closeM] = dayConfig.close.split(":").map(Number);
  if ([openH, openM, closeH, closeM].some(Number.isNaN)) return true;

  return nowMinutes >= openH * 60 + openM && nowMinutes < closeH * 60 + closeM;
};
