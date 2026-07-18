"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { NotificationBell } from "@/components/shared"
import {
  LayoutDashboard, Package, ShoppingCart,
  ChevronLeft, ChevronRight, Menu, LogOut,
  ArrowDownToLine, ArrowUpFromLine, ClipboardList,
  ClipboardCheck, Repeat, Building2,
  QrCode, CalendarCheck, Wrench, FolderSearch, ShieldCheck,
  BarChart3
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RouteGuard } from "@/components/route-guard"
import { useAuth } from "@/lib/auth-context"
import { InventoryProvider } from "@/lib/inventory-context"

const navGroups = [
  {
    label: "Tổng quan",
    items: [
      { href: "/employee", icon: <LayoutDashboard className="h-5 w-5" />, label: "Dashboard" },
      { href: "/employee/reports", icon: <BarChart3 className="h-5 w-5" />, label: "Báo cáo" },
    ],
  },
  {
    label: "Đặt sân",
    items: [
      { href: "/employee/bookings", icon: <CalendarCheck className="h-5 w-5" />, label: "Quản lý đặt sân" },
      { href: "/employee/bookings/fixed-schedules", icon: <Repeat className="h-5 w-5" />, label: "Lịch cố định" },
      { href: "/employee/checkin", icon: <QrCode className="h-5 w-5" />, label: "Check-in QR" },
      { href: "/employee/courts", icon: <Building2 className="h-5 w-5" />, label: "Quản lý sân" },
      { href: "/employee/court-services", icon: <Wrench className="h-5 w-5" />, label: "Dịch vụ sân" },
    ],
  },
  {
    label: "Bán hàng",
    items: [
      { href: "/employee/sales", icon: <ShoppingCart className="h-5 w-5" />, label: "Bán hàng" },
      { href: "/employee/approval", icon: <ClipboardCheck className="h-5 w-5" />, label: "Duyệt đơn" },
      { href: "/employee/orders", icon: <ClipboardList className="h-5 w-5" />, label: "Đơn hàng online" },
      { href: "/employee/warranty", icon: <ShieldCheck className="h-5 w-5" />, label: "Bảo hành" },
    ],
  },
  {
    label: "Kho hàng",
    items: [
      { href: "/employee/inventory", icon: <Package className="h-5 w-5" />, label: "Tồn kho" },
      { href: "/employee/document-audit", icon: <FolderSearch className="h-5 w-5" />, label: "Rà soát chứng từ" },
    ],
  },
]

function EmployeeSidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: { collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const activeHref = navGroups
    .flatMap(group => group.items)
    .map(item => item.href)
    .sort((a, b) => b.length - a.length)
    .find(href => pathname === href || (href !== "/employee" && pathname.startsWith(`${href}/`)))

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden" 
          onClick={onMobileClose}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-gradient-to-b from-[#17365F] via-[#17365F] to-[#102744] text-[#B7C5D8] flex flex-col shadow-2xl shadow-slate-950/20 transition-all duration-300",
        collapsed ? "lg:w-16" : "lg:w-64",
        mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
      )}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-white/10">
        <Image src="/logo.png" alt="BadmintonHub" width={48} height={48} className="rounded-lg shrink-0" />
        {!collapsed && <span className="font-serif text-lg font-extrabold text-white">Nhân viên</span>}
      </div>

      {/* User chip */}
      {!collapsed && user && (
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/10 ring-1 ring-white/15 flex items-center justify-center text-xs font-bold text-white">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user.fullName}</p>
              <p className="text-xs text-[#8FA5C1]">{user.email}</p>
            </div>
          </div>
          {user.warehouse && (
            <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 border border-white/10 text-xs text-[#D8E7FF]">
              <Package className="h-3 w-3" />
              <span>{user.warehouse}</span>
            </div>
          )}
        </div>
      )}

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {navGroups.map(group => (
          <div key={group.label} className="mb-4">
            {!collapsed && <p className="px-3 mb-2 text-xs font-semibold text-[#7F95B3] uppercase tracking-wider">{group.label}</p>}
            <div className="flex flex-col gap-0.5">
              {group.items.map(item => {
                const isActive = activeHref === item.href
                return (
                  <Link key={item.href} href={item.href}
                    onClick={onMobileClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                      isActive
                        ? "bg-[#2563EB] text-white font-semibold shadow-md shadow-blue-950/25 ring-1 ring-white/10"
                        : "text-[#B7C5D8] hover:bg-white/10 hover:text-white"
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
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-rose-200 hover:bg-rose-500/10 hover:text-white transition-colors w-full"
        >
          {collapsed ? <LogOut className="h-5 w-5" /> : <><LogOut className="h-5 w-5" /> <span>Đăng xuất</span></>}
        </button>
        <button
          onClick={onToggle}
          className="hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#B7C5D8] hover:bg-white/10 hover:text-white transition-colors w-full"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <><ChevronLeft className="h-5 w-5" /> <span>Thu gọn</span></>}
        </button>
      </div>
    </aside>
    </>
  )
}

function EmployeeTopbar({ collapsed, onMobileMenu }: { collapsed: boolean; onMobileMenu: () => void }) {
  const pathname = usePathname()
  const { user } = useAuth()

  const breadcrumbMap: Record<string, string> = {
    '/employee': 'Dashboard',
    '/employee/reports': 'Báo cáo',
    '/employee/bookings': 'Quản lý đặt sân',
    '/employee/bookings/fixed-schedules': 'Lịch cố định',
    '/employee/checkin': 'Check-in QR',
    '/employee/courts': 'Quản lý sân',
    '/employee/court-services': 'Dịch vụ sân',
    '/employee/sales': 'Bán hàng',
    '/employee/approval': 'Duyệt đơn',
    '/employee/orders': 'Đơn hàng online',
    '/employee/warranty': 'Bảo hành',
    '/employee/inventory': 'Tồn kho',
    '/employee/document-audit': 'Rà soát chứng từ',
  }

  return (
    <header className={cn(
      "fixed top-0 right-0 left-0 z-30 h-16 bg-card border-b flex items-center justify-between px-4 transition-all duration-300",
      collapsed ? "lg:left-16" : "lg:left-64"
    )}>
      <div className="flex items-center gap-3">
        <button className="lg:hidden" onClick={onMobileMenu}>
          <Menu className="h-5 w-5" />
        </button>
        <nav className="text-sm text-muted-foreground">
          <span>Nhân viên</span>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">{breadcrumbMap[pathname] || 'Dashboard'}</span>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="h-8 w-8 rounded-full bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center text-xs font-bold">
          {user?.fullName?.charAt(0)?.toUpperCase() || "N"}
        </div>
      </div>
    </header>
  )
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = useAuth()
  const router = useRouter()

  // Hub employees should not access regular employee pages
  useEffect(() => {
    if (user?.role === "employee" && user?.warehouse === "Kho Hub") {
      router.replace("/hub")
    }
  }, [user, router])

  if (user?.role === "employee" && user?.warehouse === "Kho Hub") return null

  return (
    <RouteGuard requiredRole="employee">
      <InventoryProvider>
        <div className="min-h-screen bg-background">
          <EmployeeSidebar 
            collapsed={collapsed} 
            onToggle={() => setCollapsed(!collapsed)} 
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
          />
          <EmployeeTopbar collapsed={collapsed} onMobileMenu={() => setMobileOpen(true)} />
          <main className={cn(
            "pt-16 min-h-screen transition-all duration-300",
            collapsed ? "ml-0 lg:ml-16" : "ml-0 lg:ml-64"
          )}>
            <div className="p-6">
              {children}
            </div>
          </main>
        </div>
      </InventoryProvider>
    </RouteGuard>
  )
}
