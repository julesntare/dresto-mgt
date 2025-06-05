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
