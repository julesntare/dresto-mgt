import axios from "axios";

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  image?: string;
  isAvailable: boolean;
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
}

interface OrderItem {
  menuItemId: string;
  quantity: number;
  price?: number;
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
  tableNumber?: string;
  notes?: string;
  totalAmount: number;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "PREPARING"
    | "READY"
    | "DELIVERED"
    | "CANCELLED";
  userId: string;
  createdAt: string;
  updatedAt: string;
  orderItems: OrderItem[];
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface CreateOrderData {
  customerName?: string;
  customerPhone?: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableNumber?: string;
  notes?: string;
  items: { menuItemId: string; quantity: number }[];
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
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken } = response.data;
          localStorage.setItem("accessToken", accessToken);

          return api(originalRequest);
        }
      } catch {
        // Refresh failed, redirect to login
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

// Auth API functions
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post("/auth/login", { email, password });
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
      itemData
    );
    return response.data;
  },

  updateItem: async (id: string, itemData: Partial<CreateMenuItemData>) => {
    const response = await api.put<{ message: string; menuItem: MenuItem }>(
      `/menu/${id}`,
      itemData
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
      }
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
      categoryData
    );
    return response.data;
  },

  update: async (
    id: string,
    categoryData: { name?: string; description?: string; isActive?: boolean }
  ) => {
    const response = await api.put<{ message: string; category: Category }>(
      `/categories/${id}`,
      categoryData
    );
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ message: string }>(`/categories/${id}`);
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
      orderData
    );
    return response.data;
  },

  updateStatus: async (id: string, status: string) => {
    const response = await api.patch<{ message: string; order: Order }>(
      `/orders/${id}/status`,
      { status }
    );
    return response.data;
  },

  cancel: async (id: string, reason?: string) => {
    const response = await api.patch<{ message: string; order: Order }>(
      `/orders/${id}/cancel`,
      { reason }
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
};
