// Central API client — reads base URL from env or falls back gracefully
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:3000/api/v1";
    }
    // On production domains (e.g. Netlify), use relative URL to route via proxy and avoid Mixed Content
    return "/api/v1";
  }
  return "/api/v1";
}


function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  const direct = localStorage.getItem("refreshToken");
  if (direct) return direct;
  try {
    const raw = localStorage.getItem("auth");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.refreshToken ?? null;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, bufferSeconds = 30): boolean {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    return Date.now() >= (payload.exp - bufferSeconds) * 1000;
  } catch {
    return false;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function doRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    storage.clearAuth();
    return null;
  }

  // If the refresh token itself is expired, clear auth
  if (isJwtExpired(refreshToken, 0)) {
    storage.clearAuth();
    return null;
  }

  try {
    const res = await fetch(`${getBaseUrl()}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    if (!res.ok) {
      storage.clearAuth();
      return null;
    }

    const json = await res.json();
    const data = (json?.data !== undefined ? json.data : json) as {
      accessToken: string;
      refreshToken?: string;
    };

    if (data?.accessToken) {
      const currentAuth = storage.getAuth();
      const newRefreshToken = data.refreshToken || refreshToken;
      if (currentAuth) {
        storage.setAuth({
          ...currentAuth,
          accessToken: data.accessToken,
          refreshToken: newRefreshToken,
        });
      } else {
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", newRefreshToken);
      }
      return data.accessToken;
    } else {
      storage.clearAuth();
      return null;
    }
  } catch {
    storage.clearAuth();
    return null;
  }
}

async function getValidAccessToken(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;

  if (!isJwtExpired(token)) {
    return token;
  }

  // Token is expired; refresh it
  if (!refreshPromise) {
    refreshPromise = doRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const isRefreshEndpoint = path.startsWith("/auth/refresh");
  const isPublicAuth =
    path.startsWith("/auth/send-otp") || path.startsWith("/auth/verify-otp");

  let token: string | null = null;
  if (!isRefreshEndpoint && !isPublicAuth) {
    token = await getValidAccessToken();
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${getBaseUrl()}${path}`, { ...options, headers });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err?.message ?? err?.error ?? msg;
      if (Array.isArray(msg)) msg = msg.join(", ");
    } catch { }

    const lower = String(msg).toLowerCase();
    const isAuthError =
      res.status === 401 ||
      lower.includes("jwt") ||
      lower.includes("expire") ||
      lower.includes("unauthorized");

    // If unauthorized or token expired, attempt one refresh & retry
    if (isAuthError && !isRetry && !isRefreshEndpoint && !isPublicAuth) {
      if (!refreshPromise) {
        refreshPromise = doRefreshToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        const retryHeaders = {
          ...(options.headers as Record<string, string>),
          Authorization: `Bearer ${newToken}`,
        };
        return request<T>(path, { ...options, headers: retryHeaders }, true);
      } else {
        storage.clearAuth();
      }
    }

    throw new Error(msg);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  const json = await res.json();
  // Backend wraps responses in { data: ... }
  return (json?.data !== undefined ? json.data : json) as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    sendOtp: (phone: string) =>
      request<{ message: string }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      }),

    verifyOtp: (payload: {
      phone: string;
      code: string;
      fullName?: string;
    }) =>
      request<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; fullName: string; phone: string; role: string };
      }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    guestLogin: (payload: {
      phone: string;
      fullName?: string;
      deviceId?: string;
    }) =>
      request<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; fullName: string; phone: string; role: string };
      }>("/auth/guest", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    me: () =>
      request<{ id: string; fullName: string; phone: string; role: string }>(
        "/auth/me"
      ),

    updateProfile: (fullName: string) =>
      request<{ fullName: string }>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ fullName }),
      }),

    refresh: (refreshToken: string) =>
      request<{
        accessToken: string;
        refreshToken: string;
      }>("/auth/refresh", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      }),
  },

  tables: {
    resolve: (token: string, lat?: number, lng?: number) => {
      const params = new URLSearchParams({ token });
      if (lat != null) params.set("latitude", String(lat));
      if (lng != null) params.set("longitude", String(lng));
      return request<TableInfo>(`/tables/resolve?${params}`);
    },
  },

  restaurants: {
    ownerMe: () => request<DashboardRestaurant>("/restaurants/owner/me"),
    update: (id: string, payload: RestaurantUpdatePayload) =>
      request<DashboardRestaurant>(`/restaurants/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
  },

  branches: {
    ownerMe: () => request<DashboardBranch[]>("/branches/owner/me"),
    update: (id: string, payload: { acceptingOrders?: boolean }) =>
      request<DashboardBranch>(`/branches/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
  },

  menu: {
    list: (restaurantId: string, branchId?: string, categoryId?: string) => {
      const params = new URLSearchParams({ restaurantId });
      if (branchId) params.set("branchId", branchId);
      if (categoryId) params.set("categoryId", categoryId);
      return request<MenuItem[]>(`/menu-items?${params}`);
    },
    create: (payload: MenuItemMutation) =>
      request<MenuItem>("/menu-items", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: Partial<MenuItemMutation>) =>
      request<MenuItem>(`/menu-items/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    remove: (id: string) => request<void>(`/menu-items/${id}`, { method: "DELETE" }),
  },

  categories: {
    list: (restaurantId: string) =>
      request<DashboardCategory[]>(`/categories?restaurantId=${encodeURIComponent(restaurantId)}`),
    create: (payload: { name: string; restaurantId: string }) =>
      request<DashboardCategory>("/categories", { method: "POST", body: JSON.stringify(payload) }),
  },

  menuAddons: {
    list: (restaurantId: string) =>
      request<MenuAddon[]>(`/menu-addons?restaurantId=${encodeURIComponent(restaurantId)}`),
    create: (payload: { name: string; price: number; restaurantId: string }) =>
      request<MenuAddon>("/menu-addons", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: { name?: string; price?: number; isAvailable?: boolean }) =>
      request<MenuAddon>(`/menu-addons/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  },

  orders: {
    create: (payload: CreateOrderPayload) =>
      request<Order>("/orders", { method: "POST", body: JSON.stringify(payload) }),

    findMy: () => request<Order[]>("/orders/my"),

    byRestaurant: (restaurantId: string) =>
      request<Order[]>(`/orders/restaurant?restaurantId=${encodeURIComponent(restaurantId)}`),

    updateStatus: (id: string, status: OrderStatus) =>
      request<Order>(`/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),

    findOne: (id: string) => request<Order>(`/orders/${id}`),

    cancel: (id: string) =>
      request<Order>(`/orders/${id}/cancel`, { method: "PATCH" }),
  },

  payments: {
    createPaymentOrder: (orderId: string) =>
      request<CreatePaymentOrderResponse>(`/payments/orders/${orderId}/create`, {
        method: "POST",
      }),

    createUpiIntent: (orderId: string) =>
      request<CreateUpiIntentResponse>(`/payments/orders/${orderId}/upi-intent`, {
        method: "POST",
      }),

    verifyUpiPayment: (payload: VerifyUpiPaymentPayload) =>
      request<{ success: boolean; message: string; order: Order }>(
        `/payments/orders/${payload.orderId}/verify-upi`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),

    getPaymentStatus: (orderId: string) =>
      request<PaymentStatusResponse>(`/payments/orders/${orderId}/status`),

    verifyPayment: (payload: VerifyPaymentPayload) =>
      request<Order>("/payments/verify", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  admin: {
    dashboard: () => request<AdminDashboardData>("/admin/dashboard"),
    restaurants: () => request<AdminRestaurant[]>("/admin/restaurants"),
    setRestaurantStatus: (id: string, isActive: boolean) =>
      request<AdminRestaurant>(`/admin/restaurants/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    orders: () => request<Order[]>("/admin/orders"),
    updateOrderStatus: (id: string, status: OrderStatus) =>
      request<Order>(`/admin/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    customers: () => request<AdminUser[]>("/admin/customers"),
    setCustomerStatus: (id: string, isActive: boolean) =>
      request<AdminUser>(`/admin/customers/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaymentMethod = "cod" | "online";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface CreatePaymentOrderResponse {
  razorpayOrderId: string;
  amount: number; // in paise
  currency: string;
  keyId: string;
  mock: boolean;
}

export interface VerifyPaymentPayload {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface CreateUpiIntentResponse {
  orderId: string;
  amount: number;
  currency: string;
  merchantVpa: string;
  merchantName: string;
  transactionRef: string;
  transactionNote: string;
  upiUri: string;
  apps: {
    gpay: string;
    phonepe: string;
    paytm: string;
    bhim: string;
    cred: string;
    generic: string;
  };
  razorpayOrderId: string | null;
}

export interface VerifyUpiPaymentPayload {
  orderId: string;
  transactionRef?: string;
  utr?: string;
  upiApp?: string;
}

export interface PaymentStatusResponse {
  orderId: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentId: string | null;
  totalAmount: number;
  isPaid: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discountedPrice: number | null;
  dineInPrice: number | null;
  imageUrl: string | null;
  isAvailable: boolean;
  isVeg: boolean;
  isFeatured: boolean;
  preparationTime: number;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
  addOns?: MenuAddon[];
}

export interface MenuAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  portion?: string;
  specialInstructions?: string;
  addOnIds?: string[];
  unitPrice?: number;
}

export interface CreateOrderPayload {
  restaurantId: string;
  items: {
    menuItemId: string;
    quantity: number;
    portion?: string;
    specialInstructions?: string;
    addOnIds?: string[];
    customization?: any;
  }[];
  orderType: "dine_in" | "delivery";
  tableToken?: string;
  dineInBranchId?: string;
  tableNumber?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  paymentMethod?: PaymentMethod;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  portion?: string | null;
  customization?: { addOns?: MenuAddon[] } | null;
  specialInstructions?: string | null;
}

export interface Order {
  id: string;
  status: OrderStatus;
  orderType: "dine_in" | "delivery";
  tableNumber?: string;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  convenienceFee?: number;
  total: number;
  totalAmount?: number;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentId?: string | null;
  razorpayOrderId?: string | null;
  restaurantName?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdAt: string;
  branch?: { name: string };
  branchName?: string;
}

export interface DashboardBranch {
  id: string;
  name: string;
  isActive: boolean;
  acceptingOrders: boolean;
  address?: string;
}

export interface DashboardCategory {
  id: string;
  name: string;
  isActive: boolean;
}

export interface DashboardRestaurant {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  isActive: boolean;
  rating?: number;
  description?: string | null;
  baseDeliveryFee?: number | null;
  perKmDeliveryFee?: number | null;
  taxPercent?: number | null;
  dineInDiscountPercent?: number | null;
  branches?: DashboardBranch[];
  categories?: DashboardCategory[];
  menuItems?: MenuItem[];
}

export interface RestaurantUpdatePayload {
  name?: string;
  address?: string;
  description?: string;
  phone?: string;
  baseDeliveryFee?: number;
  perKmDeliveryFee?: number;
  taxPercent?: number;
  dineInDiscountPercent?: number;
}

export interface MenuItemMutation {
  name: string;
  description?: string;
  price: number;
  isVeg?: boolean;
  isAvailable?: boolean;
  categoryId?: string;
  addOnIds?: string[];
  restaurantId: string;
}

export interface AdminRestaurant {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  isActive: boolean;
  rating?: number;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  fullName: string | null;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminDashboardData {
  statistics: {
    customers: number;
    restaurants: number;
    branches: number;
    categories: number;
    menuItems: number;
    totalOrders: number;
    pendingOrders: number;
    preparingOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    revenue: number;
  };
  latestOrders: Order[];
  revenue: { totalOrders: number; totalRevenue: number };
  orderSummary: {
    total: number;
    pending: number;
    confirmed: number;
    preparing: number;
    ready: number;
    outForDelivery: number;
    delivered: number;
    cancelled: number;
  };
  topSellingItems: Array<{ menuItemId: string | null; name: string; quantity: number; revenue: number }>;
  branches: Array<{ id: string; name: string; totalOrders: number }>;
}

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export interface TableInfo {
  tableId: string;
  tableNumber: string;
  branchId: string;
  branchName: string;
  restaurantId: string;
  restaurantName?: string;
  restaurantLogo?: string | null;
  isWithinRange: boolean | null;
  distanceMeters: number | null;
  qrToken?: string;
}

// Local storage helpers
export const storage = {
  getAuth: (): {
    accessToken: string;
    refreshToken?: string;
    user: { id: string; fullName: string; phone: string; role: string };
  } | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("auth");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const accessToken = parsed.accessToken || localStorage.getItem("accessToken");
      const refreshToken = parsed.refreshToken || localStorage.getItem("refreshToken");

      // If access token is expired and there is no refresh token, auth is invalid
      if (accessToken && isJwtExpired(accessToken) && !refreshToken) {
        storage.clearAuth();
        return null;
      }

      return {
        ...parsed,
        accessToken,
        refreshToken,
      };
    } catch {
      return null;
    }
  },
  setAuth: (data: {
    accessToken: string;
    refreshToken?: string;
    user: { id: string; fullName: string; phone: string; role: string };
  }) => {
    localStorage.setItem("auth", JSON.stringify(data));
    localStorage.setItem("accessToken", data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem("refreshToken", data.refreshToken);
    }
  },
  clearAuth: () => {
    localStorage.removeItem("auth");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  },
  getTableInfo: (): TableInfo | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem("tableInfo") || localStorage.getItem("tableInfo");
      if (!raw) return null;
      const parsed: TableInfo = JSON.parse(raw);
      if (!parsed.qrToken) {
        const storedToken = sessionStorage.getItem("qrToken") || localStorage.getItem("qrToken");
        if (storedToken) parsed.qrToken = storedToken;
      }
      return parsed;
    } catch {
      return null;
    }
  },
  setTableInfo: (info: TableInfo) => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem("tableInfo", JSON.stringify(info));
    localStorage.setItem("tableInfo", JSON.stringify(info));
    if (info.qrToken) {
      sessionStorage.setItem("qrToken", info.qrToken);
      localStorage.setItem("qrToken", info.qrToken);
    }
  },
  getCart: (): CartItem[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem("cart");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },
  setCart: (cart: CartItem[]) => {
    sessionStorage.setItem("cart", JSON.stringify(cart));
  },
};
