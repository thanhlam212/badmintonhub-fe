"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { authApi, setToken, getToken } from "@/lib/api"

export interface User {
  id: string
  username: string
  fullName: string
  email: string
  phone: string
  address?: string
  gender?: "nam" | "nữ"
  dateOfBirth?: string
  role: "user" | "admin" | "employee" | "guest"
  warehouse?: string
  warehouseId?: number | null
  branchId?: number | null
  createdAt: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>
  loginAsGuest: () => void
  logout: () => void
  updateProfile: (data: ProfileUpdateData) => Promise<{ success: boolean; error?: string }>
  findUserByPhone: (phone: string) => { success: boolean; username?: string; maskedEmail?: string; email?: string; error?: string }
  resetPassword: (username: string, newPassword: string) => { success: boolean; error?: string }
}

interface RegisterData {
  username: string
  password: string
  fullName: string
  email: string
  phone: string
  address?: string
  gender?: "nam" | "nữ"
  dateOfBirth?: string
}

interface ProfileUpdateData {
  fullName?: string
  email?: string
  phone?: string
  address?: string
  gender?: "nam" | "nữ"
  dateOfBirth?: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const SESSION_KEY = "badmintonhub_session"

// Warehouse ID → tên kho mapping
const WAREHOUSE_NAMES: Record<number, string> = {
  1: "Kho Cầu Giấy",
  2: "Kho Thanh Xuân",
  3: "Kho Long Biên",
  4: "Kho Hub",
}

function apiUserToUser(apiUser: any): User {
  // Handle cả camelCase (từ transformUser) lẫn snake_case (trực tiếp từ BE mapUser)
  const warehouseId = apiUser.warehouseId ?? apiUser.warehouse_id ?? undefined
  const branchId = apiUser.branchId ?? apiUser.branch_id ?? undefined
  return {
    id: apiUser.id,
    username: apiUser.username,
    fullName: apiUser.fullName || apiUser.full_name || '',
    email: apiUser.email || '',
    phone: apiUser.phone || '',
    address: apiUser.address || undefined,
    gender: (apiUser.gender || undefined) as "nam" | "nữ" | undefined,
    dateOfBirth: apiUser.dateOfBirth || apiUser.date_of_birth || undefined,
    role: apiUser.role || 'user',
    warehouseId: warehouseId ?? undefined,
    branchId: branchId ?? undefined,
    warehouse: warehouseId ? WAREHOUSE_NAMES[warehouseId] || undefined : undefined,
    createdAt: (apiUser.createdAt || apiUser.created_at)?.split("T")[0] || "",
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session on mount — nếu có token thì gọi API /me
  useEffect(() => {
    const restore = async () => {
      const token = getToken()
      if (token) {
        const res = await authApi.getProfile()
        if (res.success && res.user) {
          setUser(apiUserToUser(res.user))
        } else {
          // Token hết hạn hoặc không hợp lệ
          setToken(null)
          localStorage.removeItem(SESSION_KEY)
        }
      }
      setIsLoading(false)
    }
    restore()
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password)
    if (res.success && res.user) {
      const u = apiUserToUser(res.user)
      setUser(u)
      localStorage.setItem(SESSION_KEY, u.id)
      return { success: true }
    }
    return { success: false, error: res.error || "Đăng nhập thất bại" }
  }, [])

  const register = useCallback(async (data: RegisterData) => {
    const res = await authApi.register({
      username: data.username,
      password: data.password,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      address: data.address,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
    })
    if (res.success && res.user) {
      const u = apiUserToUser(res.user)
      setUser(u)
      localStorage.setItem(SESSION_KEY, u.id)
      return { success: true }
    }
    return { success: false, error: res.error || "Đăng ký thất bại" }
  }, [])

  const loginAsGuest = useCallback(() => {
    setToken(null)
    const guestUser: User = {
      id: `guest-${Date.now()}`,
      username: "guest",
      fullName: "Khách",
      email: "",
      phone: "",
      role: "guest",
      createdAt: new Date().toISOString().split("T")[0],
    }
    setUser(guestUser)
    localStorage.setItem(SESSION_KEY, guestUser.id)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem(SESSION_KEY)
  }, [])

  const updateProfile = useCallback(async (data: ProfileUpdateData) => {
    if (!user) return { success: false, error: "Chưa đăng nhập" }
    const res = await authApi.updateProfile({
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      address: data.address,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
    })
    if (res.success && res.user) {
      setUser(apiUserToUser(res.user))
      return { success: true }
    }
    return { success: false, error: res.error || "Cập nhật thất bại" }
  }, [user])

  // findUserByPhone & resetPassword: giữ tạm placeholder (cần thêm API endpoint nếu cần)
  const findUserByPhone = useCallback((_phone: string) => {
    return { success: false, error: "Tính năng đang cập nhật" }
  }, [])

  const resetPassword = useCallback((_username: string, _newPassword: string) => {
    return { success: false, error: "Tính năng đang cập nhật" }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, loginAsGuest, logout, updateProfile, findUserByPhone, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
