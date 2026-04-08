import axios from "axios";

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  image?: string;
  isAvailable: boolean;
  ingredients: string[];
  category?: {
    id: string;
    name: string;
  };
}

interface CreateMenuItemData {
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  image?: string;
  isAvailable?: boolean;
  ingredients?: string[];
}

interface OrderItem {
  menuItemId: string;
  quantity: number;
  price: number;
  excludedIngredients?: string[];
  menuItem?: {
    id: string;
    name: string;
    price: number;
    image?: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  customerName?: string;
  customerPhone?: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableId?: string;
  table?: { id: string; number: string; location?: string };
  notes?: string;
  totalAmount: number;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "PREPARING"
    | "READY"
    | "DELIVERED"
    | "CANCELLED";
  userId?: string;
  createdAt: string;
  updatedAt: string;
  orderItems: OrderItem[];
  user?: {
    id: string;
    name: string;
    email: string;
  };
  paymentStatus: "UNPAID" | "PENDING_VERIFICATION" | "PAID";
  transactionId?: string;
  paymentProvider?: string;
  paidAt?: string;
}

interface CreateOrderData {
  customerName?: string;
  customerPhone?: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableId?: string;
  notes?: string;
  items: {
    menuItemId: string;
    quantity: number;
    excludedIngredients?: string[];
  }[];
}

interface OrderFilters {
  status?: string;
  orderType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  _count?: {
    menuItems: number;
  };
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

function redirectToLogin() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  // Only redirect if not already on the login page
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

// Response interceptor to handle token refresh and session expiry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // Only attempt refresh for 401 on non-refresh, non-login requests
    if (
      status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/login")
    ) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem("refreshToken");

      if (!refreshToken) {
        redirectToLogin();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });
        const { accessToken } = response.data;
        localStorage.setItem("accessToken", accessToken);
        originalRequest.headers["Authorization"] = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        // Refresh token is also expired or invalid
        redirectToLogin();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

// Auth API functions
export const authApi = {
  login: async (identifier: string, password: string) => {
    const isEmail = identifier.includes("@");
    const payload = isEmail
      ? { email: identifier, password }
      : { phone: identifier, password };
    const response = await api.post("/auth/login", payload);
    return response.data;
  },

  register: async (userData: {
    email: string;
    password: string;
    name: string;
    role?: string;
  }) => {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },

  updateProfile: async (userData: { name: string }) => {
    const response = await api.put("/auth/profile", userData);
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.put("/auth/change-password", {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  logout: async () => {
    await api.post("/auth/logout");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  },
};

// Menu API functions
export const menuApi = {
  getItems: async (filters?: {
    categoryId?: string;
    available?: boolean;
    search?: string;
  }) => {
    const response = await api.get<{ menuItems: MenuItem[] }>("/menu", {
      params: filters,
    });
    return response.data;
  },

  getItem: async (id: string) => {
    const response = await api.get<{ menuItem: MenuItem }>(`/menu/${id}`);
    return response.data;
  },

  createItem: async (itemData: CreateMenuItemData) => {
    const response = await api.post<{ message: string; menuItem: MenuItem }>(
      "/menu",
      itemData,
    );
    return response.data;
  },

  updateItem: async (id: string, itemData: Partial<CreateMenuItemData>) => {
    const response = await api.put<{ message: string; menuItem: MenuItem }>(
      `/menu/${id}`,
      itemData,
    );
    return response.data;
  },

  deleteItem: async (id: string) => {
    const response = await api.delete<{ message: string }>(`/menu/${id}`);
    return response.data;
  },

  updateAvailability: async (itemIds: string[], isAvailable: boolean) => {
    const response = await api.patch<{ message: string; updatedCount: number }>(
      "/menu/bulk-availability",
      {
        itemIds,
        isAvailable,
      },
    );
    return response.data;
  },
};

// Categories API functions
export const categoriesApi = {
  getAll: async (includeInactive?: boolean) => {
    const response = await api.get<{ categories: Category[] }>("/categories", {
      params: { includeInactive },
    });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<{ category: Category }>(`/categories/${id}`);
    return response.data;
  },

  create: async (categoryData: { name: string; description?: string }) => {
    const response = await api.post<{ message: string; category: Category }>(
      "/categories",
      categoryData,
    );
    return response.data;
  },

  update: async (
    id: string,
    categoryData: { name?: string; description?: string; isActive?: boolean },
  ) => {
    const response = await api.put<{ message: string; category: Category }>(
      `/categories/${id}`,
      categoryData,
    );
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ message: string }>(`/categories/${id}`);
    return response.data;
  },
};

// Users API functions (Admin only)
type UserRole = "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER";

export const usersApi = {
  getAll: async () => {
    const response = await api.get<{
      users: Array<{
        id: string;
        email: string | null;
        phone: string | null;
        name: string;
        role: UserRole;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
        _count: { orders: number };
      }>;
    }>("/users");
    return response.data;
  },

  create: async (userData: {
    email?: string;
    phone?: string;
    password?: string;
    name: string;
    role?: UserRole;
  }) => {
    const response = await api.post<{
      message: string;
      user: {
        id: string;
        email: string | null;
        phone: string | null;
        name: string;
        role: UserRole;
        isActive: boolean;
        createdAt: string;
      };
    }>("/users", userData);
    return response.data;
  },

  update: async (
    id: string,
    data: {
      name?: string;
      phone?: string;
      role?: UserRole;
      isActive?: boolean;
    },
  ) => {
    const response = await api.put<{
      message: string;
      user: {
        id: string;
        email: string | null;
        phone: string | null;
        name: string;
        role: UserRole;
        isActive: boolean;
      };
    }>(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ message: string }>(`/users/${id}`);
    return response.data;
  },

  resetPassword: async (id: string, newPassword: string) => {
    const response = await api.patch<{ message: string }>(
      `/users/${id}/password`,
      { newPassword },
    );
    return response.data;
  },
};

// Orders API functions
export const ordersApi = {
  getAll: async (filters?: OrderFilters) => {
    const response = await api.get<{
      orders: Order[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>("/orders", { params: filters });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<{ order: Order }>(`/orders/${id}`);
    return response.data;
  },

  create: async (orderData: CreateOrderData) => {
    const response = await api.post<{ message: string; order: Order }>(
      "/orders",
      orderData,
    );
    return response.data;
  },

  updateStatus: async (id: string, status: string) => {
    const response = await api.patch<{ message: string; order: Order }>(
      `/orders/${id}/status`,
      { status },
    );
    return response.data;
  },

  cancel: async (id: string, reason?: string) => {
    const response = await api.patch<{ message: string; order: Order }>(
      `/orders/${id}/cancel`,
      { reason },
    );
    return response.data;
  },

  getStats: async (dateRange?: { startDate: string; endDate: string }) => {
    const response = await api.get("/orders/stats/overview", {
      params: dateRange,
    });
    return response.data;
  },

  getDailySales: async (days?: number) => {
    const response = await api.get("/orders/stats/daily-sales", {
      params: { days },
    });
    return response.data;
  },

  recordPayment: async (
    id: string,
    transactionId: string,
    provider?: string,
  ) => {
    const response = await api.post<{ message: string; order: Order }>(
      `/orders/${id}/payment`,
      { transactionId, provider },
    );
    return response.data;
  },

  confirmPayment: async (id: string) => {
    const response = await api.patch<{ message: string; order: Order }>(
      `/orders/${id}/payment/confirm`,
      {},
    );
    return response.data;
  },

  getMessages: async (id: string) => {
    const response = await api.get<{
      messages: Array<{
        id: string;
        orderId: string;
        content: string;
        senderType: "CLIENT" | "STAFF";
        senderName: string | null;
        isRead: boolean;
        createdAt: string;
      }>;
    }>(`/orders/${id}/messages`);
    return response.data;
  },

  sendMessage: async (id: string, content: string) => {
    const response = await api.post<{
      message: {
        id: string;
        orderId: string;
        content: string;
        senderType: "CLIENT" | "STAFF";
        senderName: string | null;
        isRead: boolean;
        createdAt: string;
      };
    }>(`/orders/${id}/messages`, { content });
    return response.data;
  },
};

// Tables API
export type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED";

export interface Table {
  id: string;
  number: string;
  capacity: number;
  location?: string;
  status: TableStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { orders: number };
}

export const tablesApi = {
  getAll: async (params?: { isActive?: boolean }) => {
    const response = await api.get<{ tables: Table[] }>("/tables", { params });
    return response.data;
  },

  create: async (data: {
    number: string;
    capacity: number;
    location?: string;
  }) => {
    const response = await api.post<{ message: string; table: Table }>(
      "/tables",
      data,
    );
    return response.data;
  },

  update: async (
    id: string,
    data: {
      number?: string;
      capacity?: number;
      location?: string;
      isActive?: boolean;
    },
  ) => {
    const response = await api.put<{ message: string; table: Table }>(
      `/tables/${id}`,
      data,
    );
    return response.data;
  },

  updateStatus: async (id: string, status: TableStatus) => {
    const response = await api.patch<{ message: string; table: Table }>(
      `/tables/${id}/status`,
      { status },
    );
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ message: string }>(`/tables/${id}`);
    return response.data;
  },
};
