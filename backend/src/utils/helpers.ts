export const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  return `ORD${timestamp}${random}`;
};

export interface OrderTotalItem {
  price: number;
  quantity: number;
  // per-unit price deltas of the selected modifiers for this line (§4.2-4)
  modifierDeltas?: number[];
}

export interface OrderMoneyRules {
  serviceChargePct?: number | null;
  vatEnabled?: boolean | null;
  vatPct?: number | null;
  deliveryFee?: number | null;
}

export interface OrderTotalBreakdown {
  subtotal: number; // items + modifier deltas
  serviceCharge: number;
  vat: number;
  deliveryFee: number;
  total: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// Full order total per §4.2-4: line subtotal (item price + modifier deltas) × qty,
// then service charge, then VAT on (subtotal + service charge), then delivery fee
// (delivery orders only). Rules come from the Restaurant config row.
export const calculateOrderTotal = (
  items: OrderTotalItem[],
  opts: { rules?: OrderMoneyRules; orderType?: string } = {}
): OrderTotalBreakdown => {
  const { rules = {}, orderType } = opts;

  const subtotal = items.reduce((sum, item) => {
    const modifiers = (item.modifierDeltas ?? []).reduce((a, d) => a + d, 0);
    return sum + (item.price + modifiers) * item.quantity;
  }, 0);

  const serviceCharge = rules.serviceChargePct
    ? subtotal * (rules.serviceChargePct / 100)
    : 0;

  const vat = rules.vatEnabled && rules.vatPct
    ? (subtotal + serviceCharge) * (rules.vatPct / 100)
    : 0;

  const deliveryFee =
    orderType === "DELIVERY" && rules.deliveryFee ? rules.deliveryFee : 0;

  return {
    subtotal: round2(subtotal),
    serviceCharge: round2(serviceCharge),
    vat: round2(vat),
    deliveryFee: round2(deliveryFee),
    total: round2(subtotal + serviceCharge + vat + deliveryFee),
  };
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
