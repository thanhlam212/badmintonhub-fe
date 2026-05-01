// ═══════════════════════════════════════════════════════════════
// BadmintonHub — API Service Layer
// Kết nối frontend Next.js với backend NestJS
// ═══════════════════════════════════════════════════════════════

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// ─── Token management ───────────────────────────────────────
let authToken: string | null = null

export function setToken(token: string | null) {
  authToken = token
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('bh_token', token)
    } else {
      localStorage.removeItem('bh_token')
    }
  }
}

export function getToken(): string | null {
  if (authToken) return authToken
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('bh_token')
  }
  return authToken
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; pagination?: any }> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })
    const json = await res.json()

    if (!res.ok) {
      // NestJS lỗi: { statusCode, message, error }
      const message = Array.isArray(json.message)
        ? json.message[0]           // validation error trả về mảng
        : json.message || `Lỗi ${res.status}`
      return { success: false, message }
    }

    // NestJS trả data trực tiếp (array hoặc object)
    return { success: true, data: json }
  } catch (err: any) {
    console.error('API Error:', err)
    return { success: false, message: 'Không thể kết nối server' }
  }
}

// ─── Type definitions ────────────────────────────────────────

export interface ApiBranch {
  id: number
  name: string
  address: string
  lat: number
  lng: number
  phone: string | null
  email: string | null
}

export interface ApiCourt {
  id: number
  name: string
  branchId: number
  branch: string
  address: string
  lat: number
  lng: number
  type: string
  indoor: boolean
  price: number
  rating: number
  reviews: number
  image: string
  available: boolean
  amenities: string[]
  description: string
  hours: string
}

export interface ApiProduct {
  id: number
  sku: string
  name: string
  brand: string
  category: string
  price: number
  originalPrice: number | null
  rating: number
  reviews: number
  image: string | null
  description: string
  specs: Record<string, string>
  features: string[]
  inStock: boolean
  gender: string | null
  badges: string[]
}

export interface ApiUser {
  id: string
  username: string
  fullName: string
  email: string
  phone: string
  address: string | null
  gender: string | null
  dateOfBirth: string | null
  role: 'user' | 'admin' | 'employee' | 'guest'
  warehouseId: number | null
  branchId: number 
  createdAt: string
}

export interface ApiBooking {
  id: string
  courtId: number
  courtName: string
  branchName: string
  userId: string | null
  customerName: string
  customerPhone: string
  bookingDate: string
  timeStart: string
  timeEnd: string
  slots: number
  amount: number
  status: string
  paymentMethod: string | null
  note: string | null
  createdAt: string
  pricePerHour: number
}

export interface ApiOrder {
  id: string
  userId: string | null
  customerName: string
  customerPhone: string
  customerEmail: string | null
  shippingAddress: string
  amount: number
  status: string
  paymentMethod: string | null
  note: string | null
  items: ApiOrderItem[]
  createdAt: string
}

export interface ApiOrderItem {
  productId: number
  productName: string
  sku: string
  quantity: number
  price: number
}

// ─── Transform helpers ──────────────────────────────────────

function transformCourt(raw: any): ApiCourt {
  return {
    id: raw.id,
    name: raw.name,

    branchId: Number(raw.branchId ?? raw.branch?.id ?? 0),

    branch: raw.branch?.name ?? raw.branchName ?? '',
    address: raw.branch?.address ?? raw.address ?? '',
    lat: parseFloat(String(raw.branch?.lat ?? raw.lat ?? 0)),
    lng: parseFloat(String(raw.branch?.lng ?? raw.lng ?? 0)),

    type: raw.type ?? 'standard',
    indoor: raw.indoor ?? true,
    price: parseFloat(String(raw.price ?? 0)),
    rating: parseFloat(String(raw.rating ?? 0)),
    reviews: raw.reviewsCount ?? raw._count?.reviews ?? 0,
    available: raw.available ?? true,
    image: raw.image ?? raw.imageUrl ?? '',   // ← thêm dòng này

    amenities: (raw.amenities ?? []).map((a: any) =>
      typeof a === 'string' ? a : (a.amenity ?? '')
    ).filter(Boolean),

    description: raw.description ?? '',
    hours: raw.hours ?? '06:00 - 22:00',
  }
}

function transformProduct(raw: any): ApiProduct {
  return {
    id: raw.id,
    sku: raw.sku,
    name: raw.name,
    brand: raw.brand,
    category: raw.category,
    price: parseFloat(raw.price),
    originalPrice: raw.originalPrice ? parseFloat(raw.originalPrice) : null,
    rating: parseFloat(raw.rating) || 0,
    reviews: raw.reviewsCount || 0,
    image: raw.image,
    description: raw.description || '',
    specs: raw.specs || {},
    features: raw.features || [],
    inStock: raw.inStock,
    gender: raw.gender,
    badges: raw.badges?.map((b: any) => b.badge) || [],
  }
}

function transformUser(raw: any): ApiUser {
  // NestJS đã trả về camelCase, không cần convert nhiều
  return {
    id: raw.id,
    username: raw.username,
    fullName: raw.fullName,
    email: raw.email,
    phone: raw.phone,
    address: raw.address || null,
    gender: raw.gender || null,
    dateOfBirth: raw.dateOfBirth || null,
    role: raw.role,
    warehouseId: raw.warehouseId || null,
    branchId: raw.branchId ?? raw.branch_id ?? raw.warehouseId ?? 0,
    createdAt: raw.createdAt?.split('T')[0] || '',
  }
}

function transformBooking(raw: any): ApiBooking {
  return {
    id: raw.id,
    courtId: raw.courtId,
    courtName: raw.court?.name || '',
    branchName: raw.branch?.name || '',
    userId: raw.userId,
    customerName: raw.customerName,
    customerPhone: raw.customerPhone,
    bookingDate: raw.bookingDate,
    timeStart: raw.timeStart,
    timeEnd: raw.timeEnd,
    slots: raw.people || raw.slots || 1,
    amount: parseFloat(raw.amount),
    status: raw.status,
    paymentMethod: raw.paymentMethod,
    note: raw.note || null,
    createdAt: raw.createdAt,
    pricePerHour: parseFloat(String(raw.pricePerHour ?? raw.price_per_hour ?? 0))
  }
}

function transformOrder(raw: any): ApiOrder {
  return {
    id: raw.id,
    userId: raw.userId,
    customerName: raw.customerName,
    customerPhone: raw.customerPhone,
    customerEmail: raw.customerEmail || null,
    shippingAddress: raw.customerAddress || '',
    amount: parseFloat(raw.total),
    status: raw.status,
    paymentMethod: raw.paymentMethod,
    note: raw.note || null,
    items: (raw.items || []).map((item: any) => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.product?.sku || '',
      quantity: item.qty,
      price: parseFloat(item.price),
    })),
    createdAt: raw.createdAt,
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTH API
// ═══════════════════════════════════════════════════════════════

export const authApi = {
  // NestJS: POST /auth/login — body dùng "identifier" (username hoặc email)
  // Response: { message, user, accessToken }
  login: async (username: string, password: string) => {
    const res = await apiFetch<{ message: string; user: any; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: username, password }),
    })
    if (res.success && res.data) {
      setToken(res.data.accessToken)           // ← NestJS dùng accessToken (không phải token)
      return { success: true, user: transformUser(res.data.user), token: res.data.accessToken }
    }
    return { success: false, error: res.message || 'Đăng nhập thất bại' }
  },

  // NestJS: POST /auth/register — body dùng camelCase
  // Response: { message, user, accessToken }
  register: async (data: {
    username: string; password: string; fullName: string;
    email: string; phone: string; address?: string;
    gender?: string; dateOfBirth?: string
  }) => {
    const res = await apiFetch<{ message: string; user: any; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: data.username,
        password: data.password,
        fullName: data.fullName,       
        email: data.email,
        phone: data.phone,
        address: data.address,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth, 
      }),
    })
    if (res.success && res.data) {
      setToken(res.data.accessToken)
      return { success: true, user: transformUser(res.data.user), token: res.data.accessToken }
    }
    return { success: false, error: res.message || 'Đăng ký thất bại' }
  },

  // NestJS: GET /auth/profile (không phải /auth/me)
  getProfile: async () => {
    const res = await apiFetch<any>('/auth/profile')
    if (res.success && res.data) {
      return { success: true, user: transformUser(res.data) }
    }
    return { success: false, error: res.message }
  },

  // NestJS: chưa có endpoint này → cần thêm sau
  updateProfile: async (data: {
    fullName?: string; email?: string; phone?: string;
    address?: string; gender?: string; dateOfBirth?: string
  }) => {
    const res = await apiFetch<any>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data), // NestJS nhận camelCase
    })
    if (res.success && res.data) {
      return { success: true, user: transformUser(res.data) }
    }
    return { success: false, error: res.message }
  },

  // NestJS: PATCH /auth/change-password
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await apiFetch('/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify({ oldPassword: currentPassword, newPassword }),
    })
    return { success: res.success, error: res.message }
  },
}

// ═══════════════════════════════════════════════════════════════
// BRANCHES API
// ═══════════════════════════════════════════════════════════════

export const branchApi = {
  getAll: async (): Promise<ApiBranch[]> => {
    const res = await apiFetch<any[]>('/branches')
    if (res.success && res.data) {
      return res.data.map((b: any) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        lat: parseFloat(b.lat),
        lng: parseFloat(b.lng),
        phone: b.phone,
        email: b.email,
      }))
    }
    return []
  },
}

// ═══════════════════════════════════════════════════════════════
// COURTS API
// ═══════════════════════════════════════════════════════════════

export const courtApi = {
  getAll: async (filters?: { branchId?: number; type?: string; indoor?: boolean }): Promise<ApiCourt[]> => {
    const params = new URLSearchParams()
    if (filters?.branchId) params.set('branchId', String(filters.branchId))
    if (filters?.type) params.set('type', filters.type)
    if (filters?.indoor !== undefined) params.set('indoor', String(filters.indoor))
    const qs = params.toString()
    const res = await apiFetch<any[]>(`/courts${qs ? '?' + qs : ''}`)
    if (res.success && res.data) return res.data.map(transformCourt)
    return []
  },

  getById: async (id: number): Promise<ApiCourt | null> => {
    const res = await apiFetch<any>(`/courts/${id}`)
    if (res.success && res.data) return transformCourt(res.data)
    return null
  },

  getSlots: async (courtId: number, date: string) => {
    const res = await apiFetch<any[]>(`/courts/${courtId}/slots?date=${date}`)
    if (res.success && res.data) return res.data
    return []
  },

  // ← ĐÃ THÊM LẠI getReviews
  getReviews: async (courtId: number) => {
    const res = await apiFetch<any[]>(`/courts/${courtId}/reviews`)
    if (res.success && res.data) return res.data
    return []
  },
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTS API
// ═══════════════════════════════════════════════════════════════

export const productApi = {
  getAll: async (filters?: {
    category?: string; brand?: string; gender?: string;
    search?: string; page?: number; limit?: number
  }): Promise<{ products: ApiProduct[]; pagination?: any }> => {
    const params = new URLSearchParams()
    if (filters?.category) params.set('category', filters.category)
    if (filters?.brand) params.set('brand', filters.brand)
    if (filters?.gender) params.set('gender', filters.gender)
    if (filters?.search) params.set('search', filters.search)
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.limit) params.set('limit', String(filters.limit))
    const qs = params.toString()
    const res = await apiFetch<any>(`/products${qs ? '?' + qs : ''}`)
    if (res.success && res.data) {
      const list = res.data.products || res.data
      return {
        products: list.map(transformProduct),
        pagination: res.data.meta || null,
      }
    }
    return { products: [] }
  },

  getById: async (id: number): Promise<ApiProduct | null> => {
    const res = await apiFetch<any>(`/products/${id}`)
    if (res.success && res.data) return transformProduct(res.data)
    return null
  },

   getCategories: async (): Promise<string[]> => {
    const res = await apiFetch<string[]>('/products/categories')
    if (res.success && res.data) return res.data
    return []
  },

  getBrands: async (): Promise<string[]> => {
    const res = await apiFetch<string[]>('/products/brands')
    if (res.success && res.data) return res.data
    return []
  },
}

// ═══════════════════════════════════════════════════════════════
// BOOKINGS API
// ═══════════════════════════════════════════════════════════════

export const bookingApi = {

  // GET /api/bookings (Admin/Employee)
  getAll: async (filters?: {
    status?: string; branchId?: number; date?: string;
    phone?: string; limit?: number; 
  }) => {
    const params = new URLSearchParams()
    if (filters?.status)   params.set('status', filters.status)
    if (filters?.branchId) params.set('branchId', String(filters.branchId))
    if (filters?.date)     params.set('date', filters.date)
    if (filters?.phone)    params.set('phone', filters.phone)
    const qs = params.toString()
    const res = await apiFetch<any[]>(`/bookings${qs ? '?' + qs : ''}`)
    if (res.success && res.data) {
      return { bookings: res.data.map(transformBooking) }
    }
    return { bookings: [] }
  },

  // GET /api/bookings/my (User tự xem)
  getMyBookings: async (): Promise<ApiBooking[]> => {
    const res = await apiFetch<any[]>('/bookings/my')
    if (res.success && res.data) return res.data.map(transformBooking)
    return []
  },

  // GET /api/bookings/user/:userId (Admin xem của 1 user)
  getByUser: async (userId: string): Promise<ApiBooking[]> => {
    const res = await apiFetch<any[]>(`/bookings/user/${userId}`)
    if (res.success && res.data) return res.data.map(transformBooking)
    return []
  },

  // GET /api/bookings/:id
  getById: async (id: string): Promise<ApiBooking | null> => {
    const res = await apiFetch<any>(`/bookings/${id}`)
    if (res.success && res.data) return transformBooking(res.data)
    return null
  },

  // POST /api/bookings — Đặt sân (camelCase cho NestJS)
  create: async (data: {
    courtId: number; bookingDate: string;
    timeStart: string; timeEnd: string;
    people?: number; paymentMethod: string;
    customerName: string; customerPhone: string;
    customerEmail?: string; userId?: string;
  }) => {
    const res = await apiFetch<any>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    if (res.success && res.data) {
      return { success: true, booking: transformBooking(res.data) }
    }
    return { success: false, error: res.message }
  },

  // PATCH /api/bookings/:id/confirm
  confirm: async (id: string) => {
    const res = await apiFetch<any>(`/bookings/${id}/confirm`, { method: 'PATCH' })
    return { success: res.success, error: res.message }
  },

  // PATCH /api/bookings/:id/cancel
  cancel: async (id: string) => {
    const res = await apiFetch<any>(`/bookings/${id}/cancel`, { method: 'PATCH' })
    return { success: res.success, error: res.message }
  },

  // PATCH /api/bookings/:id/status — Admin đổi trạng thái
  updateStatus: async (id: string, status: string) => {
    // Map từ action → endpoint đúng
    if (status === 'confirmed') {
      const res = await apiFetch<any>(`/bookings/${id}/confirm`, { method: 'PATCH' })
      return { success: res.success, error: res.message }
    }
    if (status === 'cancelled') {
      const res = await apiFetch<any>(`/bookings/${id}/cancel`, { method: 'PATCH' })
      return { success: res.success, error: res.message }
    }
    // playing, completed → dùng /status
    const res = await apiFetch<any>(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    return { success: res.success, error: res.message }
  },

  // DELETE /api/bookings/:id — (cần thêm endpoint này vào NestJS)
  delete: async (id: string) => {
    const res = await apiFetch(`/bookings/${id}/cancel`, { method: 'PATCH' })
    return { success: res.success }
  },

  previewFixed: async (data: {
    courtId: number
    cycle: "weekly" | "monthly"
    startDate: string
    endDate: string
    timeStart: string
    timeEnd: string
  }) => {
    const res = await apiFetch<any>('/bookings/fixed/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return { success: res.success, data: res.data, error: res.message }
  },

  confirmFixed: async (data: {
    courtId: number
    cycle: "weekly" | "monthly"
    startDate: string
    endDate: string
    timeStart: string
    timeEnd: string
    paymentMethod: string
    customerName: string
    customerPhone: string
    customerEmail?: string
    userId?: string
    adjustmentLimit?: number
    occurrences: {
      date: string
      courtId: number
      timeStart: string
      timeEnd: string
      skip: boolean
    }[]
  }) => {
    const res = await apiFetch<any>('/bookings/fixed/confirm', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return { success: res.success, data: res.data, error: res.message }
  },
}

// ═══════════════════════════════════════════════════════════════
// ORDERS API
// ═══════════════════════════════════════════════════════════════

export const orderApi = {
  getAll: async (filters?: { status?: string; userId?: string }) => {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.userId) params.set('userId', filters.userId)
    const qs = params.toString()
    const res = await apiFetch<any[]>(`/orders${qs ? '?' + qs : ''}`)
    if (res.success && res.data) {
      return { orders: res.data.map(transformOrder) }
    }
    return { orders: [] }
  },

  getById: async (id: string): Promise<ApiOrder | null> => {
    const res = await apiFetch<any>(`/orders/${id}`)
    if (res.success && res.data) return transformOrder(res.data)
    return null
  },

  getMyOrders: async (): Promise<ApiOrder[]> => {
    const res = await apiFetch<any[]>('/orders/my')
    if (res.success && res.data) return res.data.map(transformOrder)
    return []
  },

  create: async (data: {
    customer_name: string
    customer_phone: string
    customer_email?: string
    shipping_address: string
    payment_method?: string
    note?: string
    items: { product_id: number; quantity: number; price: number }[]
    }) => {
      const res = await apiFetch<any>('/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (res.success && res.data) {
        return { success: true, order: transformOrder(res.data) }
      }
      return { success: false, error: res.message }
    },

    updateStatus: async (id: string, status: string) => {
    const res = await apiFetch<any>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    return { success: res.success, error: res.message }
  },
}

// ═══════════════════════════════════════════════════════════════
// INVENTORY API
// ═══════════════════════════════════════════════════════════════

export const inventoryApi = {
  // GET /inventory → danh sách tồn kho
  getAll: async () => {
    try {
      const data = await apiFetch('/inventory')
      const list = Array.isArray(data) ? data : (data as any)?.data ?? []
      return { success: true, data: list }
    } catch {
      return { success: false, data: [] }
    }
  },
 
  // GET /inventory/transactions → lịch sử nhập/xuất
  getTransactions: async () => {
    try {
      const data = await apiFetch('/inventory/transactions')
      const list = Array.isArray(data) ? data : (data as any)?.data ?? []
      return { success: true, data: list }
    } catch {
      return { success: false, data: [] }
    }
  },
 
  // GET /warehouse/warehouses → danh sách kho (dùng để map tên → id)
  getWarehouses: async () => {
    try {
      const data = await apiFetch('/warehouse/warehouses')
      const list = Array.isArray(data) ? data : (data as any)?.data ?? []
      return { success: true, data: list }
    } catch {
      return { success: false, data: [] }
    }
  },
 
  // GET /inventory/low-stock → sản phẩm sắp hết hàng
  getLowStock: async () => {
    try {
      const data = await apiFetch('/inventory/low-stock')
      const list = Array.isArray(data) ? data : (data as any)?.data ?? []
      return { success: true, data: list }
    } catch {
      return { success: false, data: [] }
    }
  },
 
  // POST /inventory/import → nhập kho
  importStock: async (payload: {
    warehouse_id: number
    sku: string
    quantity: number
    note?: string
  }) => {
    try {
      const data = await apiFetch('/inventory/import', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      return { success: true, data }
    } catch (e: any) {
      return { success: false, error: e?.message }
    }
  },
 
  // POST /inventory/export → xuất kho
  exportStock: async (payload: {
    warehouse_id: number
    sku: string
    quantity: number
    note?: string
  }) => {
    try {
      const data = await apiFetch('/inventory/export', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      return { success: true, data }
    } catch (e: any) {
      return { success: false, error: e?.message }
    }
  },
}
// ═══════════════════════════════════════════════════════════════
// TRANSFERS API
// ═══════════════════════════════════════════════════════════════

export const transferApi = {
  // GET /transfers → danh sách phiếu chuyển kho
  getAll: async () => {
    try {
      const data = await apiFetch('/transfers')
      const list = Array.isArray(data) ? data : (data as any)?.data ?? []
      return { success: true, data: list }
    } catch {
      return { success: false, data: [] }
    }
  },
 
  // POST /transfers → tạo phiếu chuyển kho
  create: async (payload: {
    from_warehouse_id: number
    to_warehouse_id: number
    note?: string
    items: { sku: string; quantity: number }[]
  }) => {
    try {
      const data = await apiFetch('/transfers', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      return { success: true, data }
    } catch (e: any) {
      return { success: false, error: e?.message, data: null }
    }
  },
 
  // PATCH /transfers/:id/status → cập nhật trạng thái
  updateStatus: async (id: string, status: string) => {
    try {
      const data = await apiFetch(`/transfers/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      return { success: true, data }
    } catch (e: any) {
      return { success: false, error: e?.message }
    }
  },
}

// ═══════════════════════════════════════════════════════════════
// PURCHASE ORDERS API
// ═══════════════════════════════════════════════════════════════

export const purchaseOrderApi = {
  getAll: async (filters?: { status?: string; supplierId?: number }) => {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.supplierId) params.set('supplierId', String(filters.supplierId))
    const qs = params.toString()
    return apiFetch(`/warehouse/purchase-orders${qs ? '?' + qs : ''}`)
  },

  getById: async (id: string) => apiFetch(`/warehouse/purchase-orders/${id}`),

  create: async (dto: {
    supplier_id: number
    warehouse_id: number
    note?: string
    items: { sku: string; quantity: number; price: number }[]
  }) => {
    try {
      const data = await apiFetch('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: dto.supplier_id,
          warehouseId: dto.warehouse_id,
          note: dto.note || '',
          items: dto.items.map(i => ({
            sku: i.sku,
            qty: i.quantity,
            unitCost: i.price,
          })),
        }),
      })
      return { success: true, data }
    } catch (e: any) {
      return { success: false, error: e?.message }
    }
  },

   getSuppliers: async () => {
    try {
      const data = await apiFetch('/warehouse/suppliers')
      const list = Array.isArray(data) ? data : (data as any)?.data ?? []
      return { success: true, data: list }
    } catch {
      return { success: true, data: [] } // fallback rỗng nếu chưa có BE
    }
  },
}

// ═══════════════════════════════════════════════════════════════
// SALES ORDERS API
// ═══════════════════════════════════════════════════════════════

export const salesOrderApi = {
  getAll: async (filters?: { status?: string; branchId?: number }) => {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.branchId) params.set('branchId', String(filters.branchId))
    const qs = params.toString()
    return apiFetch(`/sales${qs ? '?' + qs : ''}`)
  },

  getById: async (id: string) => apiFetch(`/sales/${id}`),

  create: async (dto: {
    branch_id?: number
    customer_name?: string
    customer_phone?: string
    note?: string
    items: { sku: string; quantity: number; price: number }[]
  }) => {
    try {
      const data = await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName: dto.customer_name || 'Khách lẻ',
          customerPhone: dto.customer_phone || '',
          note: dto.note || '',
          paymentMethod: 'cash',
          items: dto.items.map(i => ({
            productId: i.sku,   // BE nhận productId
            productName: '',
            price: i.price,
            qty: i.quantity,
          })),
        }),
      })
      return { success: true, data }
    } catch (e: any) {
      return { success: false, error: e?.message }
    }
  },

  approve: async (id: string) => apiFetch(`/sales/${id}/approve`, { method: 'PATCH' }),
  reject: async (id: string, reason?: string) => {
    return apiFetch(`/sales/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ rejectReason: reason }),
    })
  },
}
