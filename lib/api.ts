// ═══════════════════════════════════════════════════════════════
// BadmintonHub — API Service Layer
// Kết nối frontend Next.js với backend NestJS
// ═══════════════════════════════════════════════════════════════

const CONFIGURED_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

function getApiBase() {
  if (typeof window === "undefined") return CONFIGURED_API_BASE;

  try {
    const configured = new URL(CONFIGURED_API_BASE);
    const isLocalApi =
      configured.hostname === "localhost" ||
      configured.hostname === "127.0.0.1";
    const pageIsLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocalApi && !pageIsLocal) {
      configured.hostname = window.location.hostname;
      return configured.toString().replace(/\/$/, "");
    }
  } catch {
    // Giữ nguyên URL cấu hình nếu không phải URL tuyệt đối.
  }

  return CONFIGURED_API_BASE;
}

// ─── Token management ───────────────────────────────────────
let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("bh_token", token);
    } else {
      localStorage.removeItem("bh_token");
    }
  }
}

export function getToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== "undefined") {
    authToken = localStorage.getItem("bh_token");
  }
  return authToken;
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ success: boolean; data?: T; message?: string; pagination?: any }> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${getApiBase()}${endpoint}`, {
      ...options,
      headers,
    });
    const json = await res.json();

    if (!res.ok) {
      // NestJS lỗi: { statusCode, message, error }
      const message = Array.isArray(json.message)
        ? json.message[0] // validation error trả về mảng
        : json.message || `Lỗi ${res.status}`;
      return { success: false, message };
    }

    // TransformInterceptor bọc mọi response thành { success: true, data: ... }
    // Unwrap để lấy data thực (tránh double-wrapping)
    if (
      json &&
      typeof json === "object" &&
      json.success === true &&
      "data" in json
    ) {
      return { success: true, data: json.data, pagination: json.pagination };
    }
    return { success: true, data: json };
  } catch (err: any) {
    return {
      success: false,
      message:
        err instanceof TypeError
          ? "Không thể kết nối máy chủ. Vui lòng kiểm tra BE đang chạy ở cổng 3001."
          : "Không thể kết nối server",
    };
  }
}

// ─── Type definitions ────────────────────────────────────────

export interface ApiBranch {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  email: string | null;
}

export interface ApiCourt {
  id: number;
  name: string;
  branchId: number;
  branch: string;
  address: string;
  lat: number;
  lng: number;
  type: string;
  indoor: boolean;
  price: number;
  rating: number;
  reviews: number;
  image: string;
  available: boolean;
  amenities: string[];
  description: string;
  hours: string;
}

export interface ApiProduct {
  id: number;
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  originalPrice: number | null;
  rating: number;
  reviews: number;
  image: string | null;
  description: string;
  specs: Record<string, string>;
  features: string[];
  inStock: boolean;
  gender: string | null;
  badges: string[];
  supplierName?: string | null;
}

export interface ApiUser {
  id: string;
  username: string;
  userCode?: string;
  fullName: string;
  email: string;
  phone: string;
  address: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  role: "user" | "admin" | "employee" | "guest";
  warehouseId: number | null;
  branchId: number;
  createdAt: string;
}

export interface ApiBooking {
  id: string;
  courtId: number;
  courtName: string;
  branchName: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  bookingDate: string;
  timeStart: string;
  timeEnd: string;
  slots: number;
  amount: number;
  status: string;
  paymentMethod: string | null;
  note: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  cancelledByName?: string | null;
  cancelledByRole?: string | null;
  createdAt: string;
  pricePerHour: number;
  fixedScheduleId: string | null;
  bookingCode?: string;
  placedBy?: string | null;
  placedByRole?: string | null;
  serviceLines?: any[] | null;
  servicePaidHash?: string | null;
  servicePaidAt?: string | null;
  invoice_id?: string | null;
  invoice_status?: string | null;
}

export interface ApiOrder {
  id: string;
  orderCode?: string;
  invoiceId?: string | null;
  invoiceStatus?: string | null;
  invoiceCode?: string | null;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  shippingAddress: string;
  subtotal?: number;
  shippingFee?: number;
  totalAmount?: number;
  amount: number;
  status: string;
  paymentMethod: string | null;
  note: string | null;
  deliveryMethod?: "delivery" | "pickup";
  pickupBranchId?: number | null;
  fulfillingWarehouseId?: number | null;
  fulfillingWarehouse?: string | null;
  fulfillingWarehouseName?: string | null;
  items: ApiOrderItem[];
  createdAt: string;
}

export interface ApiOrderItem {
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
}

// ─── Transform helpers ──────────────────────────────────────

function transformCourt(raw: any): ApiCourt {
  // BE mapCourt() returns snake_case: branch_id, branch_name, branch_address, branch_lat, branch_lng
  // Also handle legacy camelCase / nested branch object
  return {
    id: raw.id,
    name: raw.name,

    branchId: Number(raw.branch_id ?? raw.branchId ?? raw.branch?.id ?? 0),

    branch: raw.branch_name ?? raw.branch?.name ?? raw.branchName ?? "",
    address: raw.branch_address ?? raw.branch?.address ?? raw.address ?? "",
    lat: parseFloat(String(raw.branch_lat ?? raw.branch?.lat ?? raw.lat ?? 0)),
    lng: parseFloat(String(raw.branch_lng ?? raw.branch?.lng ?? raw.lng ?? 0)),

    type: raw.type ?? "standard",
    indoor: raw.indoor ?? true,
    price: parseFloat(String(raw.price ?? 0)),
    rating: parseFloat(String(raw.rating ?? 0)),
    reviews: raw.reviews_count ?? raw.reviewsCount ?? raw._count?.reviews ?? 0,
    available: raw.available ?? true,
    image: raw.image ?? raw.imageUrl ?? "",

    amenities: (raw.amenities ?? [])
      .map((a: any) => (typeof a === "string" ? a : (a.amenity ?? "")))
      .filter(Boolean),

    description: raw.description ?? "",
    hours: raw.hours ?? "06:00 - 22:00",
  };
}

function extractProductMeta(description?: string | null) {
  const raw = String(description || "");
  const segments = raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  let supplierName: string | null = null;
  const cleanSegments: string[] = [];
  for (const seg of segments) {
    if (seg.startsWith("NCC:")) {
      supplierName = seg.slice(4).trim() || null;
      continue;
    }
    cleanSegments.push(seg);
  }
  return { supplierName, cleanDescription: cleanSegments.join(" | ") };
}

function transformProduct(raw: any): ApiProduct {
  const meta = extractProductMeta(raw.description);
  const badges = Array.from(
    new Set<string>(
      (raw.badges || [])
        .map((b: any) => (typeof b === "string" ? b : b.badge))
        .filter(
          (badge: unknown): badge is string =>
            typeof badge === "string" && badge.length > 0,
        ),
    ),
  );

  return {
    id: raw.id,
    sku: raw.sku,
    name: raw.name,
    brand: raw.brand,
    category: raw.category,
    price: parseFloat(raw.price),
    originalPrice:
      (raw.original_price ?? raw.originalPrice)
        ? parseFloat(raw.original_price ?? raw.originalPrice)
        : null,
    rating: parseFloat(raw.rating) || 0,
    reviews: raw.reviews_count || raw.reviewsCount || 0,
    image: raw.image,
    description: meta.cleanDescription,
    specs: raw.specs || {},
    features: raw.features || [],
    inStock: raw.in_stock ?? raw.inStock ?? true,
    gender: raw.gender,
    badges,
    supplierName: raw.supplier_name ?? meta.supplierName ?? null,
  };
}

function transformUser(raw: any): ApiUser {
  // BE trả về snake_case từ mapUser() — handle cả camelCase lẫn snake_case
  return {
    id: raw.id,
    username: raw.username,
    userCode: raw.userCode || raw.user_code || undefined,
    fullName: raw.fullName || raw.full_name || "",
    email: raw.email || "",
    phone: raw.phone || "",
    address: raw.address || null,
    gender: raw.gender || null,
    dateOfBirth: raw.dateOfBirth || raw.date_of_birth || null,
    role: raw.role || "user",
    warehouseId: raw.warehouseId ?? raw.warehouse_id ?? null,
    branchId:
      raw.branchId ?? raw.branch_id ?? raw.warehouseId ?? raw.warehouse_id ?? 0,
    createdAt: (raw.createdAt || raw.created_at)?.split("T")[0] || "",
  };
}

function transformBooking(raw: any): ApiBooking {
  // BE's mapBooking() trả về snake_case — handle cả hai dạng
  return {
    id: raw.id,
    courtId: raw.courtId ?? raw.court_id ?? 0,
    courtName: raw.courtName || raw.court_name || raw.court?.name || "",
    branchName:
      raw.branchName ||
      raw.branch_name ||
      raw.court?.branch?.name ||
      raw.branch?.name ||
      "",
    userId: raw.userId ?? raw.user_id ?? null,
    customerName: raw.customerName || raw.customer_name || "",
    customerPhone: raw.customerPhone || raw.customer_phone || "",
    customerEmail: raw.customerEmail || raw.customer_email || null,
    bookingDate: raw.bookingDate || raw.booking_date || "",
    timeStart: raw.timeStart || raw.time_start || "",
    timeEnd: raw.timeEnd || raw.time_end || "",
    slots: raw.people ?? raw.slots ?? 1,
    amount: parseFloat(String(raw.amount ?? 0)),
    status: raw.status || "",
    paymentMethod: raw.paymentMethod || raw.payment_method || null,
    note: raw.note || null,
    createdAt: raw.createdAt || raw.created_at || "",
    pricePerHour: parseFloat(
      String(raw.pricePerHour ?? raw.price_per_hour ?? 0),
    ),
    fixedScheduleId: raw.fixedScheduleId || raw.fixed_schedule_id || null,
    bookingCode: raw.bookingCode || raw.booking_code || undefined,
    // BE dùng booked_by_* thay vì placed_by_*
    placedBy: raw.placedBy || raw.placed_by || raw.booked_by_name || null,
    placedByRole:
      raw.placedByRole || raw.placed_by_role || raw.booked_by_role || null,
    serviceLines: raw.serviceLines || raw.service_lines || null,
    servicePaidHash: raw.servicePaidHash || raw.service_paid_hash || null,
    servicePaidAt: raw.servicePaidAt || raw.service_paid_at || null,
    invoice_id: raw.invoice_id ?? raw.invoiceId ?? null,
    invoice_status: raw.invoice_status ?? null,
    cancellationReason:
      raw.cancellationReason ?? raw.cancellation_reason ?? null,
    cancelledAt: raw.cancelledAt ?? raw.cancelled_at ?? null,
    cancelledByRole: raw.cancelledByRole ?? raw.cancelled_by_role ?? null,
    cancelledByName: raw.cancelledByName ?? raw.cancelled_by_name ?? null,
  };
}

function transformOrder(raw: any): ApiOrder {
  return {
    id: raw.id,
    orderCode:
      raw.orderCode ||
      raw.order_code ||
      raw.sales_code ||
      raw.invoiceCode ||
      raw.invoice_code ||
      undefined,
    invoiceId: raw.invoiceId || raw.invoice_id || null,
    invoiceStatus: raw.invoiceStatus || raw.invoice_status || null,
    invoiceCode: raw.invoiceCode || raw.invoice_code || null,
    userId: raw.userId ?? raw.user_id ?? null,
    customerName: raw.customerName,
    customerPhone: raw.customerPhone,
    customerEmail: raw.customerEmail || null,
    shippingAddress:
      raw.shippingAddress ||
      raw.shipping_address ||
      raw.customerAddress ||
      raw.customer_address ||
      "",
    subtotal: parseFloat(
      String(
        raw.subtotal ??
          raw.amount ??
          raw.totalAmount ??
          raw.total_amount ??
          raw.total ??
          0,
      ),
    ),
    shippingFee: parseFloat(String(raw.shippingFee ?? raw.shipping_fee ?? 0)),
    totalAmount: parseFloat(
      String(
        raw.totalAmount ?? raw.total_amount ?? raw.total ?? raw.amount ?? 0,
      ),
    ),
    amount: parseFloat(
      String(
        raw.totalAmount ?? raw.total_amount ?? raw.total ?? raw.amount ?? 0,
      ),
    ),
    status: raw.status,
    paymentMethod: raw.paymentMethod || raw.payment_method || null,
    note: raw.note || null,
    deliveryMethod: raw.deliveryMethod || raw.delivery_method || "delivery",
    pickupBranchId: raw.pickupBranchId ?? raw.pickup_branch_id ?? null,
    fulfillingWarehouseId:
      raw.fulfillingWarehouseId ?? raw.fulfilling_warehouse_id ?? null,
    fulfillingWarehouse:
      raw.fulfillingWarehouse ||
      raw.fulfillingWarehouseName ||
      raw.fulfilling_warehouse_name ||
      null,
    fulfillingWarehouseName:
      raw.fulfillingWarehouseName ||
      raw.fulfilling_warehouse_name ||
      raw.fulfillingWarehouse ||
      null,
    items: (raw.items || []).map((item: any) => ({
      productId: item.productId ?? item.product_id,
      productName: item.productName || item.product_name || item.name || "",
      sku: item.product?.sku || item.sku || "",
      quantity: item.quantity ?? item.qty ?? 0,
      price: parseFloat(item.price),
    })),
    createdAt: raw.createdAt,
  };
}

// ═══════════════════════════════════════════════════════════════
// AUTH API
// ═══════════════════════════════════════════════════════════════

export const authApi = {
  // NestJS: POST /auth/login — body { username, password }
  // Response (sau khi unwrap TransformInterceptor): { token, user (snake_case) }
  login: async (username: string, password: string) => {
    const res = await apiFetch<{
      token: string;
      accessToken?: string;
      user: any;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (res.success && res.data) {
      const jwt = res.data.token || res.data.accessToken || "";
      if (jwt) setToken(jwt);
      return { success: true, user: transformUser(res.data.user), token: jwt };
    }
    return { success: false, error: res.message || "Đăng nhập thất bại" };
  },

  // NestJS: POST /auth/register — body snake_case (BE DTO: full_name, date_of_birth)
  // Response (sau khi unwrap): { token, user (snake_case) }
  register: async (data: {
    username: string;
    password: string;
    fullName: string;
    email: string;
    phone: string;
    address?: string;
    gender?: string;
    dateOfBirth?: string;
  }) => {
    const res = await apiFetch<{
      token: string;
      accessToken?: string;
      user: any;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: data.username,
        password: data.password,
        full_name: data.fullName, // BE DTO: full_name (snake_case)
        email: data.email,
        phone: data.phone,
        address: data.address,
        gender: data.gender,
        date_of_birth: data.dateOfBirth, // BE DTO: date_of_birth (snake_case)
      }),
    });
    if (res.success && res.data) {
      const jwt = res.data.token || res.data.accessToken || "";
      if (jwt) setToken(jwt);
      return { success: true, user: transformUser(res.data.user), token: jwt };
    }
    return { success: false, error: res.message || "Đăng ký thất bại" };
  },

  // NestJS: GET /auth/profile (không phải /auth/me)
  getProfile: async () => {
    const res = await apiFetch<any>("/auth/profile");
    if (res.success && res.data) {
      return { success: true, user: transformUser(res.data) };
    }
    return { success: false, error: res.message };
  },

  // NestJS: PUT /auth/me — BE DTO dùng snake_case
  updateProfile: async (data: {
    fullName?: string;
    email?: string;
    phone?: string;
    address?: string;
    gender?: string;
    dateOfBirth?: string;
  }) => {
    const res = await apiFetch<any>("/auth/me", {
      method: "PUT",
      body: JSON.stringify({
        ...(data.fullName !== undefined && { full_name: data.fullName }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.dateOfBirth !== undefined && {
          date_of_birth: data.dateOfBirth,
        }),
      }),
    });
    if (res.success && res.data) {
      return { success: true, user: transformUser(res.data) };
    }
    return { success: false, error: res.message };
  },

  // NestJS: PUT /auth/change-password — BE DTO: { current_password, new_password }
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await apiFetch("/auth/change-password", {
      method: "PUT",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    return { success: res.success, error: res.message };
  },

  // POST /auth/forgot-password — gửi OTP qua email
  forgotPassword: async (phone: string) => {
    const res = await apiFetch<{
      username: string;
      maskedEmail: string;
      maskedPhone: string;
      message: string;
    }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    if (res.success && res.data) {
      return { success: true, ...res.data };
    }
    return { success: false, error: res.message || "Không tìm thấy tài khoản" };
  },

  // POST /auth/reset-password — xác minh OTP và đặt mật khẩu mới
  resetPassword: async (phone: string, otp: string, newPassword: string) => {
    const res = await apiFetch<{ message: string; username: string }>(
      "/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ phone, otp, new_password: newPassword }),
      },
    );
    if (res.success)
      return { success: true, message: (res.data as any)?.message };
    return { success: false, error: res.message || "Xác minh thất bại" };
  },
};

// ═══════════════════════════════════════════════════════════════
// BRANCHES API
// ═══════════════════════════════════════════════════════════════

export const branchApi = {
  getAll: async (): Promise<ApiBranch[]> => {
    const res = await apiFetch<any[]>("/branches");
    if (res.success && res.data) {
      return res.data.map((b: any) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        lat: parseFloat(b.lat),
        lng: parseFloat(b.lng),
        phone: b.phone,
        email: b.email,
      }));
    }
    return [];
  },
};

// ═══════════════════════════════════════════════════════════════
// COURTS API
// ═══════════════════════════════════════════════════════════════

export const courtApi = {
  getAll: async (filters?: {
    branchId?: number;
    type?: string;
    indoor?: boolean;
  }): Promise<ApiCourt[]> => {
    const params = new URLSearchParams();
    if (filters?.branchId) params.set("branchId", String(filters.branchId));
    if (filters?.type) params.set("type", filters.type);
    if (filters?.indoor !== undefined)
      params.set("indoor", String(filters.indoor));
    const qs = params.toString();
    const res = await apiFetch<any[]>(`/courts${qs ? "?" + qs : ""}`);
    if (res.success && res.data) return res.data.map(transformCourt);
    return [];
  },

  getById: async (id: number): Promise<ApiCourt | null> => {
    const res = await apiFetch<any>(`/courts/${id}`);
    if (res.success && res.data) return transformCourt(res.data);
    return null;
  },

  getSlots: async (courtId: number, date: string) => {
    const res = await apiFetch<any[]>(`/courts/${courtId}/slots?date=${date}`);
    if (res.success && res.data) return res.data;
    return [];
  },

  // ← ĐÃ THÊM LẠI getReviews
  getReviews: async (courtId: number) => {
    const res = await apiFetch<any[]>(`/courts/${courtId}/reviews`);
    if (res.success && res.data) return res.data;
    return [];
  },

  createReview: async (
    courtId: number,
    data: { rating: number; content?: string },
  ) => {
    const res = await apiFetch(`/courts/${courtId}/reviews`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return {
      success: res.success,
      data: res.data,
      message: res.message,
    };
  },
};

// ═══════════════════════════════════════════════════════════════
// PRODUCTS API
// ═══════════════════════════════════════════════════════════════

export const productApi = {
  getAll: async (filters?: {
    category?: string;
    brand?: string;
    gender?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ products: ApiProduct[]; pagination?: any }> => {
    const params = new URLSearchParams();
    if (filters?.category) params.set("category", filters.category);
    if (filters?.brand) params.set("brand", filters.brand);
    if (filters?.gender) params.set("gender", filters.gender);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    const res = await apiFetch<any>(`/products${qs ? "?" + qs : ""}`);
    if (res.success) {
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.products || res.data || [];
      return {
        products: list.map(transformProduct),
        pagination: res.pagination,
      };
    }
    return { products: [] };
  },

  getById: async (id: number): Promise<ApiProduct | null> => {
    const res = await apiFetch<any>(`/products/${id}`);
    if (res.success && res.data) return transformProduct(res.data);
    return null;
  },

  getCategories: async (): Promise<string[]> => {
    const res = await apiFetch<string[]>("/products/categories");
    if (res.success && res.data) return res.data;
    return [];
  },

  getBrands: async (): Promise<string[]> => {
    const res = await apiFetch<string[]>("/products/brands");
    if (res.success && res.data) return res.data;
    return [];
  },

  create: async (data: {
    sku?: string;
    name: string;
    brand: string;
    category: string;
    price: number;
    original_price?: number | null;
    image?: string | null;
    description?: string;
    specs?: Record<string, string>;
    features?: string[];
    in_stock?: boolean;
    gender?: string | null;
    badges?: string[];
  }) => {
    const res = await apiFetch<any>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.success && res.data)
      return { success: true, product: transformProduct(res.data) };
    return {
      success: false,
      error: res.message || "Không thể tạo sản phẩm",
      product: null,
    };
  },

  update: async (
    id: number,
    data: {
      name?: string;
      brand?: string;
      category?: string;
      price?: number;
      original_price?: number | null;
      image?: string | null;
      description?: string;
      specs?: Record<string, string>;
      features?: string[];
      in_stock?: boolean;
      gender?: string | null;
    },
  ) => {
    const res = await apiFetch<any>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (res.success && res.data)
      return { success: true, product: transformProduct(res.data) };
    return {
      success: false,
      error: res.message || "Không thể cập nhật sản phẩm",
      product: null,
    };
  },

  delete: async (id: number) => {
    const res = await apiFetch<any>(`/products/${id}`, { method: "DELETE" });
    return { success: res.success, error: res.message };
  },

  uploadImage: async (file: File) => {
    const token = getToken();
    const formData = new FormData();
    formData.append("image", file);
    try {
      const response = await fetch(`${getApiBase()}/products/upload-image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await response.json();
      if (!response.ok)
        return {
          success: false,
          error: json.message || "Không thể tải ảnh",
          url: null,
        };
      // Unwrap TransformInterceptor
      const data = json.success === true && "data" in json ? json.data : json;
      const url = data?.url ? String(data.url) : null;
      return url
        ? { success: true, url }
        : { success: false, error: "Không có URL ảnh", url: null };
    } catch {
      return { success: false, error: "Không thể kết nối server", url: null };
    }
  },
};

// ═══════════════════════════════════════════════════════════════
// BOOKINGS API
// ═══════════════════════════════════════════════════════════════

export const bookingApi = {
  // GET /api/bookings (Admin/Employee)
  getAll: async (filters?: {
    status?: string;
    branchId?: number;
    date?: string;
    phone?: string;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.branchId) params.set("branchId", String(filters.branchId));
    if (filters?.date) params.set("date", filters.date);
    if (filters?.phone) params.set("phone", filters.phone);
    const qs = params.toString();
    const res = await apiFetch<any[]>(`/bookings${qs ? "?" + qs : ""}`);
    if (res.success && res.data) {
      return { bookings: res.data.map(transformBooking) };
    }
    return { bookings: [] };
  },

  // GET /api/bookings/my (User tự xem)
  getMyBookings: async (): Promise<ApiBooking[]> => {
    const res = await apiFetch<any[]>("/bookings/my");
    if (res.success && res.data) return res.data.map(transformBooking);
    return [];
  },

  // GET /api/bookings/user/:userId (Admin xem của 1 user)
  getByUser: async (userId: string): Promise<ApiBooking[]> => {
    const res = await apiFetch<any[]>(`/bookings/user/${userId}`);
    if (res.success && res.data) return res.data.map(transformBooking);
    return [];
  },

  // GET /api/bookings/:id
  getById: async (id: string): Promise<ApiBooking | null> => {
    const res = await apiFetch<any>(`/bookings/${id}`);
    if (res.success && res.data) return transformBooking(res.data);
    return null;
  },

  // POST /api/bookings — Đặt sân (hỗ trợ cả camelCase lẫn snake_case)
  // BE DTO dùng snake_case: court_id, booking_date, time_start, time_end, customer_name, customer_phone
  create: async (data: {
    // camelCase (booking page)
    courtId?: number;
    bookingDate?: string;
    timeStart?: string;
    timeEnd?: string;
    people?: number;
    paymentMethod?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    userId?: string;
    // snake_case (employee page / booking page)
    court_id?: number;
    booking_date?: string;
    time_start?: string;
    time_end?: string;
    slots?: number;
    payment_method?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    note?: string;
    user_id?: string;
    amount?: number;
  }) => {
    // Normalize to snake_case for BE DTO (forbidNonWhitelisted=true)
    const payload: Record<string, any> = {
      court_id: data.court_id ?? data.courtId,
      booking_date: data.booking_date ?? data.bookingDate,
      time_start: data.time_start ?? data.timeStart,
      time_end: data.time_end ?? data.timeEnd,
      people: data.people ?? data.slots,
      payment_method: data.payment_method ?? data.paymentMethod,
      customer_name: data.customer_name ?? data.customerName ?? "Khách",
      customer_phone: data.customer_phone ?? data.customerPhone ?? "",
      customer_email: data.customerEmail,
      user_id: data.user_id ?? data.userId,
      note: data.note,
      amount: data.amount,
    };
    // Remove undefined fields (avoid forbidNonWhitelisted rejecting undefined-valued keys)
    Object.keys(payload).forEach(
      (k) => payload[k] === undefined && delete payload[k],
    );
    const res = await apiFetch<any>("/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res.success && res.data) {
      return { success: true, booking: transformBooking(res.data) };
    }
    return { success: false, error: res.message };
  },

  // PATCH /api/bookings/:id/confirm
  confirm: async (id: string) => {
    const res = await apiFetch<any>(`/bookings/${id}/confirm`, {
      method: "PATCH",
    });
    if (res.success && res.data) {
      return { success: true, booking: transformBooking(res.data) };
    }
    return { success: false, error: res.message };
  },

  // PATCH /api/bookings/:id/cancel
  cancel: async (id: string, payload?: { reason?: string }) => {
    const res = await apiFetch<any>(`/bookings/${id}/cancel`, {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
    });
    if (res.success && res.data) {
      return { success: true, booking: transformBooking(res.data) };
    }
    return { success: false, error: res.message };
  },

  // PATCH /api/bookings/:id/status — Admin đổi trạng thái
  updateStatus: async (
    id: string,
    status: string,
    payload?: { reason?: string },
  ) => {
    // Map từ action → endpoint đúng
    if (status === "confirmed") {
      const res = await apiFetch<any>(`/bookings/${id}/confirm`, {
        method: "PATCH",
      });
      if (res.success && res.data) {
        return { success: true, booking: transformBooking(res.data) };
      }
      return { success: false, error: res.message };
    }
    if (status === "cancelled") {
      const res = await apiFetch<any>(`/bookings/${id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify(payload || {}),
      });
      if (res.success && res.data) {
        return { success: true, booking: transformBooking(res.data) };
      }
      return { success: false, error: res.message };
    }
    // playing, completed → dùng /status
    const res = await apiFetch<any>(`/bookings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return {
      success: res.success,
      booking: res.data
        ? transformBooking(res.data.booking ?? res.data)
        : undefined,
      error: res.message,
    };
  },

  // DELETE /api/bookings/:id — (cần thêm endpoint này vào NestJS)
  delete: async (id: string) => {
    const res = await apiFetch(`/bookings/${id}/cancel`, { method: "PATCH" });
    return { success: res.success };
  },

  // POST /api/bookings/checkin — QR check-in
  // BE returns: { message, booking: { camelCase } } wrapped by TransformInterceptor
  // apiFetch unwraps to: { success, data: { message, booking } }
  checkin: async (data: { bookingId?: string; bookingCode?: string }) => {
    const res = await apiFetch<any>("/bookings/checkin", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.success && res.data) {
      const bookingRaw = (res.data as any).booking ?? res.data;
      const msg = (res.data as any).message || res.message;
      return {
        success: true,
        booking: transformBooking(bookingRaw),
        message: msg,
      };
    }
    return { success: false, error: res.message };
  },

  // POST /api/bookings/recurring
  createRecurring: async (data: {
    court_id: number;
    time_start: string;
    time_end: string;
    start_date: string;
    weeks: number;
    slots?: number;
    customer_name: string;
    customer_phone: string;
    amount: number;
    payment_method?: string;
    note?: string;
    user_id?: string;
  }) => {
    const res = await apiFetch<any>("/bookings/recurring", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return {
      success: res.success,
      message: res.message,
      data: res.data,
      errors: (res as any).errors,
    };
  },

  // PATCH /api/bookings/:id/services
  updateServices: async (id: string, data: Record<string, any>) => {
    const res = await apiFetch<any>(`/bookings/${id}/services`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (res.success && res.data) {
      return {
        success: true,
        booking: transformBooking(res.data),
        message: res.message,
      };
    }
    return { success: false, error: res.message };
  },

  // POST /api/bookings (hold) — giữ chỗ
  createHold: async (data: {
    court_id: number;
    booking_date: string;
    time_start: string;
    time_end: string;
    slots?: number;
    customer_name: string;
    customer_phone: string;
    amount: number;
    payment_method?: string;
    note?: string;
  }) => {
    const res = await apiFetch<any>("/bookings/hold", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.success && res.data) {
      return {
        success: true,
        booking: transformBooking(res.data),
        message: res.message,
      };
    }
    return { success: false, error: res.message };
  },

  // PATCH /api/bookings/:id/confirm-payment
  confirmPayment: async (id: string) => {
    const res = await apiFetch<any>(`/bookings/${id}/confirm-payment`, {
      method: "PATCH",
    });
    if (res.success && res.data) {
      return {
        success: true,
        booking: transformBooking(res.data),
        message: res.message,
      };
    }
    return { success: false, error: res.message };
  },

  previewFixed: async (data: {
    courtId: number;
    cycle: "weekly" | "monthly";
    startDate: string;
    endDate: string;
    timeStart: string;
    timeEnd: string;
  }) => {
    const res = await apiFetch<any>("/bookings/fixed/preview", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { success: res.success, data: res.data, error: res.message };
  },

  confirmFixed: async (data: {
    courtId: number;
    cycle: "weekly" | "monthly";
    startDate: string;
    endDate: string;
    timeStart: string;
    timeEnd: string;
    paymentMethod: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    userId?: string;
    adjustmentLimit?: number;
    occurrences: {
      date: string;
      courtId: number;
      timeStart: string;
      timeEnd: string;
      skip: boolean;
    }[];
  }) => {
    const res = await apiFetch<any>("/bookings/fixed/confirm", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { success: res.success, data: res.data, error: res.message };
  },
};

// ═══════════════════════════════════════════════════════════════
// ORDERS API
// ═══════════════════════════════════════════════════════════════

export const orderApi = {
  getAll: async (filters?: { status?: string; userId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.userId) params.set("userId", filters.userId);
    const qs = params.toString();
    const res = await apiFetch<any[]>(`/orders${qs ? "?" + qs : ""}`);
    if (res.success && res.data) {
      return { orders: res.data.map(transformOrder) };
    }
    return { orders: [] };
  },

  getById: async (id: string): Promise<ApiOrder | null> => {
    const res = await apiFetch<any>(`/orders/${id}`);
    if (res.success && res.data) return transformOrder(res.data);
    return null;
  },

  getMyOrders: async (): Promise<ApiOrder[]> => {
    const res = await apiFetch<any[]>("/orders/my");
    if (res.success && res.data) return res.data.map(transformOrder);
    return [];
  },

  create: async (data: {
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    shipping_address: string;
    payment_method?: string;
    note?: string;
    delivery_method?: string;
    pickup_branch_id?: number;
    customer_coords?: any;
    shipping_fee?: number;
    subtotal?: number;
    total?: number;
    items: { product_id: number; qty: number; price: number }[];
  }) => {
    const res = await apiFetch<any>("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.success && res.data) {
      return { success: true, order: transformOrder(res.data) };
    }
    return { success: false, error: res.message };
  },

  updateStatus: async (id: string, status: string) => {
    const res = await apiFetch<any>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return { success: res.success, error: res.message };
  },
};

// ═══════════════════════════════════════════════════════════════
// INVENTORY API
// ═══════════════════════════════════════════════════════════════

export const inventoryApi = {
  // GET /inventory
  getAll: async () => {
    const res = await apiFetch("/inventory");
    const list = Array.isArray(res.data) ? res.data : [];
    return { success: res.success, data: list };
  },

  // GET /inventory/transactions
  getTransactions: async () => {
    const res = await apiFetch("/inventory/transactions");
    const list = Array.isArray(res.data) ? res.data : [];
    return { success: res.success, data: list };
  },

  // GET /inventory/warehouse/:id
  getByWarehouse: async (warehouseId: number) => {
    const res = await apiFetch(`/inventory/warehouse/${warehouseId}`);
    const list = Array.isArray(res.data) ? res.data : [];
    return { success: res.success, data: list };
  },

  // GET /inventory/warehouse/warehouses — danh sách kho
  getWarehouses: async () => {
    const res = await apiFetch("/warehouse/warehouses");
    const list = Array.isArray(res.data) ? res.data : [];
    return { success: res.success, data: list };
  },

  // GET /inventory/low-stock
  getLowStock: async () => {
    const res = await apiFetch("/inventory/low-stock");
    const list = Array.isArray(res.data) ? res.data : [];
    return { success: res.success, data: list };
  },

  // POST /inventory/import — BE DTO dùng camelCase: warehouseId, qty
  importStock: async (payload: {
    warehouse_id: number;
    sku: string;
    quantity: number;
    cost?: number;
    note?: string;
  }) => {
    const body = {
      warehouseId: payload.warehouse_id,
      sku: payload.sku,
      qty: payload.quantity,
      cost: payload.cost,
      note: payload.note,
    };
    const res = await apiFetch("/inventory/import", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { success: res.success, data: res.data, error: res.message };
  },

  // POST /inventory/export — BE DTO dùng camelCase: warehouseId, qty
  exportStock: async (payload: {
    warehouse_id: number;
    sku: string;
    quantity: number;
    note?: string;
  }) => {
    const body = {
      warehouseId: payload.warehouse_id,
      sku: payload.sku,
      qty: payload.quantity,
      note: payload.note,
    };
    const res = await apiFetch("/inventory/export", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { success: res.success, data: res.data, error: res.message };
  },
};
// ═══════════════════════════════════════════════════════════════
// TRANSFERS API
// ═══════════════════════════════════════════════════════════════

export const transferApi = {
  // GET /transfers
  getAll: async () => {
    const res = await apiFetch("/transfers");
    const list = Array.isArray(res.data) ? res.data : [];
    return { success: res.success, data: list };
  },

  // POST /transfers
  create: async (payload: {
    from_warehouse_id: number;
    to_warehouse_id: number;
    note?: string;
    items: { sku: string; quantity: number }[];
  }) => {
    const res = await apiFetch("/transfers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { success: res.success, data: res.data, error: res.message };
  },

  // PATCH /transfers/:id/status — BE DTO chỉ chấp nhận: approved, rejected, in_transit, completed
  updateStatus: async (id: string, status: string) => {
    // Normalize "in-transit" → "in_transit" để match BE DTO
    const normalizedStatus = status === "in-transit" ? "in_transit" : status;
    const res = await apiFetch(`/transfers/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: normalizedStatus }),
    });
    return { success: res.success, data: res.data, error: res.message };
  },
};

// ═══════════════════════════════════════════════════════════════
// PURCHASE ORDERS API  — BE: @Controller('purchase-orders')
// ═══════════════════════════════════════════════════════════════

export const purchaseOrderApi = {
  // GET /purchase-orders
  getAll: async (filters?: { status?: string; supplierId?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.supplierId)
      params.set("supplierId", String(filters.supplierId));
    const qs = params.toString();
    return apiFetch(`/purchase-orders${qs ? "?" + qs : ""}`);
  },

  // GET /purchase-orders/:id
  getById: async (id: string) => apiFetch(`/purchase-orders/${id}`),

  // POST /purchase-orders
  create: async (dto: {
    supplier_id: number;
    warehouse_id: number;
    note?: string;
    items: { sku: string; quantity: number; price: number }[];
  }) => {
    const res = await apiFetch("/purchase-orders", {
      method: "POST",
      body: JSON.stringify({
        supplier_id: dto.supplier_id,
        warehouse_id: dto.warehouse_id,
        note: dto.note || "",
        items: dto.items.map((i) => ({
          sku: i.sku,
          quantity: i.quantity,
          price: i.price,
        })),
      }),
    });
    return { success: res.success, data: res.data, error: res.message };
  },

  // PATCH /purchase-orders/:id/status
  updateStatus: async (id: string, status: string) => {
    const res = await apiFetch(`/purchase-orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return { success: res.success, error: res.message };
  },

  // GET /purchase-orders/suppliers
  getSuppliers: async () => {
    const res = await apiFetch("/purchase-orders/suppliers");
    const list = Array.isArray(res.data) ? res.data : [];
    return { success: res.success, data: list };
  },
};

// ═══════════════════════════════════════════════════════════════
// SALES ORDERS API  — BE: @Controller('sales-orders')
// ═══════════════════════════════════════════════════════════════

export const salesOrderApi = {
  // GET /sales-orders
  getAll: async (filters?: { status?: string; branchId?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.branchId) params.set("branchId", String(filters.branchId));
    const qs = params.toString();
    return apiFetch(`/sales-orders${qs ? "?" + qs : ""}`);
  },

  // GET /sales-orders/:id
  getById: async (id: string) => apiFetch(`/sales-orders/${id}`),

  // POST /sales-orders — BE DTO dùng snake_case
  create: async (dto: {
    branch_id?: number;
    customer_name?: string;
    customer_phone?: string;
    note?: string;
    order_type?: string;
    fulfillment_mode?: string;
    fulfill_warehouse_id?: number;
    payment_method?: string;
    total?: number;
    discount?: number;
    final_total?: number;
    items: {
      product_id?: number;
      product_name: string;
      price: number;
      quantity: number;
    }[];
  }) => {
    const res = await apiFetch("/sales-orders", {
      method: "POST",
      body: JSON.stringify({
        branch_id: dto.branch_id,
        customer_name: dto.customer_name || "Khách lẻ",
        customer_phone: dto.customer_phone || "",
        note: dto.note || "",
        order_type: dto.order_type,
        fulfillment_mode: dto.fulfillment_mode,
        fulfill_warehouse_id: dto.fulfill_warehouse_id,
        payment_method: dto.payment_method,
        total: dto.total,
        discount: dto.discount,
        final_total: dto.final_total,
        items: dto.items.map((i) => ({
          product_id: i.product_id ?? null,
          product_name: i.product_name || "",
          price: i.price,
          qty: i.quantity,
        })),
      }),
    });
    return { success: res.success, data: res.data, error: res.message };
  },

  // PATCH /sales-orders/:id/approve
  approve: async (id: string, payload?: Record<string, any>) => {
    const res = await apiFetch(`/sales-orders/${id}/approve`, {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
    });
    return { success: res.success, data: res.data, error: res.message };
  },

  // PATCH /sales-orders/:id/reject
  reject: async (id: string, reason?: string) => {
    const res = await apiFetch(`/sales-orders/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reject_reason: reason }),
    });
    return { success: res.success, data: res.data, error: res.message };
  },

  // PATCH /sales-orders/:id/confirm-payment
  confirmPayment: async (id: string, payload?: Record<string, any>) => {
    const res = await apiFetch(`/sales-orders/${id}/confirm-payment`, {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
    });
    return { success: res.success, data: res.data, error: res.message };
  },

  // PATCH /sales-orders/:id/complete
  complete: async (id: string) => {
    const res = await apiFetch(`/sales-orders/${id}/complete`, {
      method: "PATCH",
    });
    return { success: res.success, data: res.data, error: res.message };
  },

  // GET /sales-orders/customers?search=...
  getCustomers: async (search: string) => {
    const res = await apiFetch(
      `/sales-orders/customers?search=${encodeURIComponent(search)}`,
    );
    return {
      success: res.success,
      data: Array.isArray(res.data) ? res.data : [],
    };
  },
};

// ═══════════════════════════════════════════════════════════════
// FIXED SCHEDULE API
// ═══════════════════════════════════════════════════════════════

export interface ApiFixedScheduleOccurrence {
  date: string;
  dayLabel: string;
  courtId: number;
  courtName: string;
  timeStart: string;
  timeEnd: string;
  slots: string[];
  available: boolean;
  conflicts: Array<{
    time: string;
    status: string;
    bookedBy?: string;
  }>;
  pricePerHour: number;
  amount: number;
  skip: boolean;
}

export interface ApiFixedSchedulePreview {
  court: {
    id: number;
    name: string;
    type: string;
    price: number;
    branchId: number;
  };
  startDate: string;
  endDate: string;
  numberOfWeeks: number;
  weeklySlots: { dayOfWeek: number; timeStart: string; timeEnd: string }[];
  occurrences: ApiFixedScheduleOccurrence[];
  summary: {
    totalOccurrences: number;
    availableCount: number;
    replaceableCount: number;
    unresolvableCount: number;
  };
  pricing: {
    pricePerHour: number;
    estimatedTotal: number;
    currency: string;
  };
}

// ═══════════════════════════════════════════════════════════════
// FIXED SCHEDULE API - Correct Types
// ═══════════════════════════════════════════════════════════════

// Add this to your api.ts or lib/api.ts file

interface FixedSchedulePreviewPayload {
  courtId: number;
  cycle: "weekly" | "monthly";
  bookingMode?: "occurrence_count" | "date_range";
  startDate: string;
  endDate?: string;
  occurrenceCount?: number;
  rules?: {
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeStart: string;
    timeEnd: string;
  }[];
  timeStart?: string;
  timeEnd?: string;
}

interface FixedScheduleConfirmPayload {
  courtId: number;
  cycle: "weekly" | "monthly";
  bookingMode?: "occurrence_count" | "date_range";
  startDate: string;
  endDate?: string;
  occurrenceCount?: number;
  rules?: {
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeStart: string;
    timeEnd: string;
  }[];
  timeStart?: string;
  timeEnd?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  paymentMethod: string;
  userId?: string;
  adjustmentLimit?: number;
  decisions: {
    date: string;
    action: "keep" | "replace" | "skip" | "custom";
    replaceWithCourtId?: number;
    customTimeStart?: string;
    customTimeEnd?: string;
    reason?: string;
  }[];
}

export const fixedScheduleApi = {
  /**
   * POST /bookings/fixed/preview
   * BE bọc response trong { success: true, data: ... } qua TransformInterceptor.
   * Dùng apiFetch() để tự động unwrap → trả về data trực tiếp (có occurrences[]).
   * Trước đây dùng fetch thô → nhận { success, data } thay vì { occurrences[] } → lỗi.
   */
  preview: async (data: FixedSchedulePreviewPayload) => {
    const res = await apiFetch("/bookings/fixed/preview", {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!res.success) {
      throw new Error(res.message || "Không thể xem trước lịch");
    }

    return res.data;
  },

  /**
   * POST /bookings/fixed/confirm
   */
  confirm: async (data: FixedScheduleConfirmPayload) => {
    const res = await apiFetch("/bookings/fixed/confirm", {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!res.success) {
      throw new Error(res.message || "Không thể đặt lịch");
    }

    return res.data;
  },

  getMySchedules: async () => {
    const res = await apiFetch("/bookings/fixed/my");
    return res.success ? (res.data as any[]) || [] : [];
  },

  getScheduleDetail: async (scheduleId: string) => {
    const res = await apiFetch(`/bookings/fixed/${scheduleId}`);
    return res.success ? res.data : null;
  },
};

// ═══════════════════════════════════════════════════════════════
// USER MANAGEMENT API (Admin)
// ═══════════════════════════════════════════════════════════════

export const userApi = {
  getAll: async (filters?: {
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.role) params.set("role", filters.role);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    const res = await apiFetch<any>(`/users${qs ? "?" + qs : ""}`);
    if (res.success) {
      const raw = Array.isArray(res.data)
        ? res.data
        : res.data?.users || res.data?.data || [];
      return { users: raw.map(transformUser), pagination: res.pagination };
    }
    return { users: [], pagination: undefined };
  },

  getById: async (id: string): Promise<ApiUser | null> => {
    const res = await apiFetch<any>(`/users/${id}`);
    if (res.success && res.data) return transformUser(res.data);
    return null;
  },

  create: async (data: {
    username: string;
    password: string;
    full_name: string;
    email: string;
    phone: string;
    role?: string;
    address?: string;
    gender?: string;
    date_of_birth?: string;
    warehouse_id?: number;
  }) => {
    const res = await apiFetch<any>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.success && res.data)
      return { success: true, user: transformUser(res.data) };
    return { success: false, error: res.message };
  },

  update: async (id: string, data: Record<string, any>) => {
    const res = await apiFetch<any>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (res.success && res.data)
      return { success: true, user: transformUser(res.data) };
    return { success: false, error: res.message };
  },

  resetPassword: async (id: string, new_password: string) => {
    const res = await apiFetch<any>(`/users/${id}/password`, {
      method: "PUT",
      body: JSON.stringify({ new_password }),
    });
    return { success: res.success, message: res.message };
  },

  delete: async (id: string) => {
    return apiFetch(`/users/${id}`, { method: "DELETE" });
  },
};

// ═══════════════════════════════════════════════════════════════
// PAYMENT API
// ═══════════════════════════════════════════════════════════════

export const paymentApi = {
  /**
   * Tạo link thanh toán VNPay / MoMo
   * POST /payment/create
   * Returns: { paymentId, method, payUrl }
   */
  create: async (invoiceId: string, method: "vnpay" | "momo" | "sepay") => {
    const res = await apiFetch<{
      paymentId: string;
      method: string;
      payUrl?: string;
      qrImageUrl?: string;
      bankCode?: string;
      accountNumber?: string;
      transferContent?: string;
      amount?: number;
      checkoutUrl?: string;
      formFields?: Record<string, any>;
    }>("/payment/create", {
      method: "POST",
      body: JSON.stringify({ invoiceId, method }),
    });
    if (res.success && res.data) {
      return {
        success: true,
        paymentId: res.data.paymentId,
        payUrl: res.data.payUrl || null,
        method: res.data.method,
        qrImageUrl: res.data.qrImageUrl,
        bankCode: res.data.bankCode,
        accountNumber: res.data.accountNumber,
        transferContent: res.data.transferContent,
        amount: res.data.amount,
        checkoutUrl: res.data.checkoutUrl,
        formFields: res.data.formFields,
      };
    }
    return {
      success: false,
      error: res.message || "Không thể tạo liên kết thanh toán",
      paymentId: null,
      payUrl: null,
    };
  },

  /**
   * Lấy trạng thái thanh toán
   * GET /payment/:id
   */
  getStatus: async (paymentId: string) => {
    const res = await apiFetch<any>(`/payment/${paymentId}`);
    if (res.success && res.data) {
      return { success: true, data: res.data };
    }
    return { success: false, error: res.message, data: null };
  },
};
