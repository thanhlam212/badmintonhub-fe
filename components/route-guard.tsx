"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

interface RouteGuardProps {
  children: React.ReactNode
  requiredRole?: "user" | "admin" | "employee"
}

export function RouteGuard({ children, requiredRole }: RouteGuardProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
      return
    }

    // Admin có tất cả quyền
    if (user.role === "admin") return

    // Guest không được truy cập trang yêu cầu role cụ thể
    if (user.role === "guest" && requiredRole) {
      router.replace("/")
      return
    }

    if (requiredRole === "admin" && (user.role as string) !== "admin") {
      router.replace("/")
      return
    }

    // Employee hoặc admin đều truy cập được trang employee
    if (requiredRole === "employee" && (user.role as string) !== "employee" && (user.role as string) !== "admin") {
      router.replace("/")
      return
    }
  }, [user, isLoading, requiredRole, router, pathname])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!user) return null
  if ((user.role as string) === "guest" && requiredRole) return null
  if (requiredRole === "admin" && (user.role as string) !== "admin") return null
  if (requiredRole === "employee" && (user.role as string) !== "employee" && (user.role as string) !== "admin") return null

  return <>{children}</>
}
