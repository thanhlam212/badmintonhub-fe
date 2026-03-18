"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { NotificationBell } from "@/components/shared"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard, CalendarCheck, Package, FileText, BarChart3,
  ChevronLeft, ChevronRight, Menu, Truck, Settings, LogOut, User, FlaskConical,
  Building2, ClipboardList
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RouteGuard } from "@/components/route-guard"
import { useAuth } from "@/lib/auth-context"
import { InventoryProvider } from '@/lib/inventory-context'

const navGroups = [
  {
    label: "Tổng quan",
    items: [
      { href: "/admin", icon: <LayoutDashboard className="h-5 w-5" />, label: "Dashboard" },
    ],
  },
  {
    label: "Quản lý",
    items: [
      { href: "/admin/bookings", icon: <CalendarCheck className="h-5 w-5" />, label: "Đặt sân" },
      { href: "/admin/courts", icon: <Building2 className="h-5 w-5" />, label: "Quản lý sân" },
      { href: "/admin/inventory", icon: <Package className="h-5 w-5" />, label: "Tồn kho" },
      { href: "/admin/purchase-orders", icon: <Truck className="h-5 w-5" />, label: "Đặt hàng" },
      { href: "/admin/orders", icon: <ClipboardList className="h-5 w-5" />, label: "Quản lý đơn" },
    ],
  },
  {
    label: "Báo cáo",
    items: [
      { href: "/admin/reports", icon: <BarChart3 className="h-5 w-5" />, label: "Báo cáo" },
    ],
  },
  {
    label: "Công cụ",
    items: [
      { href: "/admin/api-test", icon: <FlaskConical className="h-5 w-5" />, label: "Test API" },
    ],
  },
]

function AdminSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-40 bg-[#0F172A] text-slate-300 flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-slate-800">
        <Image src="/logo.png" alt="BadmintonHub" width={48} height={48} className="rounded-lg shrink-0" />
        {!collapsed && <span className="font-serif text-lg font-extrabold text-white">BadmintonHub</span>}
      </div>

      {/* User chip */}
      {!collapsed && user && (
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user.fullName}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {navGroups.map(group => (
          <div key={group.label} className="mb-4">
            {!collapsed && <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">{group.label}</p>}
            <div className="flex flex-col gap-0.5">
              {group.items.map(item => {
                const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-slate-700 text-white font-semibold border-l-2 border-primary"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    {item.icon}
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle + Logout */}
      <div className="px-2 pb-4 flex flex-col gap-1">
        <button
          onClick={() => { logout(); router.push("/") }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors w-full"
        >
          {collapsed ? <LogOut className="h-5 w-5" /> : <><LogOut className="h-5 w-5" /> <span>Đăng xuất</span></>}
        </button>
        <button
          onClick={onToggle}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors w-full"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <><ChevronLeft className="h-5 w-5" /> <span>Thu gọn</span></>}
        </button>
      </div>
    </aside>
  )
}

function AdminTopbar({ collapsed, onMobileMenu }: { collapsed: boolean; onMobileMenu: () => void }) {
  const pathname = usePathname()
  const { user } = useAuth()

  const breadcrumbMap: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/bookings': 'Đặt sân',
    '/admin/inventory': 'Tồn kho',
    '/admin/purchase-orders': 'Đặt hàng',
    '/admin/reports': 'Báo cáo',
    '/admin/api-test': 'Test API',
  }

  return (
    <header className={cn(
      "fixed top-0 right-0 z-30 h-16 bg-card border-b flex items-center justify-between px-4 transition-all duration-300",
      collapsed ? "left-16" : "left-64"
    )}>
      <div className="flex items-center gap-3">
        <button className="lg:hidden" onClick={onMobileMenu}>
          <Menu className="h-5 w-5" />
        </button>
        <nav className="text-sm text-muted-foreground">
          <span>Admin</span>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">{breadcrumbMap[pathname] || 'Dashboard'}</span>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
          {user?.fullName?.charAt(0)?.toUpperCase() || "A"}
        </div>
      </div>
    </header>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <RouteGuard requiredRole="admin">
      <InventoryProvider>  {/* ← bọc toàn bộ bên trong */}
        <div className="min-h-screen bg-background">
          <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
          <AdminTopbar collapsed={collapsed} onMobileMenu={() => { }} />
          <main className={cn(
            "pt-16 min-h-screen transition-all duration-300",
            collapsed ? "ml-16" : "ml-64"
          )}>
            <div className="p-6">
              {children}  {/* ← chỉ render 1 lần duy nhất */}
            </div>
          </main>
        </div>
      </InventoryProvider>
    </RouteGuard>
  )
}
