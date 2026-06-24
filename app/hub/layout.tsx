"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { NotificationBell } from "@/components/shared"
import {
  LayoutDashboard, Package, Repeat, Scale,
  ChevronLeft, ChevronRight, Menu, LogOut, Warehouse, ShoppingCart
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RouteGuard } from "@/components/route-guard"
import { useAuth } from "@/lib/auth-context"
import { InventoryProvider } from "@/lib/inventory-context"

const navGroups = [
  {
    label: "Tổng quan",
    items: [
      { href: "/hub", icon: <LayoutDashboard className="h-5 w-5" />, label: "Dashboard" },
    ],
  },
  {
    label: "Kho hàng",
    items: [
      { href: "/hub/inventory", icon: <Package className="h-5 w-5" />, label: "Tồn kho Hub" },
      { href: "/hub/balance", icon: <Scale className="h-5 w-5" />, label: "Cân bằng tồn kho" },
      { href: "/hub/transfers", icon: <Repeat className="h-5 w-5" />, label: "Điều chuyển" },
    ],
  },
  {
    label: "Giao vận",
    items: [
      { href: "/hub/orders", icon: <ShoppingCart className="h-5 w-5" />, label: "Đơn hàng online" },
    ],
  },
]

function HubSidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: { collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

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
        "fixed inset-y-0 left-0 z-50 bg-[#2d1b69] text-slate-300 flex flex-col transition-all duration-300",
        collapsed ? "lg:w-16" : "lg:w-64",
        mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
      )}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-purple-800/50">
        <Image src="/logo.png" alt="BadmintonHub" width={48} height={48} className="rounded-lg shrink-0" />
        {!collapsed && <span className="font-serif text-lg font-extrabold text-white">Kho Hub</span>}
      </div>

      {/* User chip */}
      {!collapsed && user && (
        <div className="px-4 py-3 border-b border-purple-800/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-purple-700 flex items-center justify-center text-xs font-bold text-white">
              <Warehouse className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user.fullName}</p>
              <p className="text-xs text-purple-300">{user.email}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-purple-800/40 rounded text-xs text-purple-200">
            <Warehouse className="h-3 w-3" />
            <span>Kho Hub — Trung tâm phân phối</span>
          </div>
        </div>
      )}

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {navGroups.map(group => (
          <div key={group.label} className="mb-4">
            {!collapsed && <p className="px-3 mb-2 text-xs font-semibold text-purple-400/60 uppercase tracking-wider">{group.label}</p>}
            <div className="flex flex-col gap-0.5">
              {group.items.map(item => {
                const isActive = pathname === item.href || (item.href !== '/hub' && pathname.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href}
                    onClick={onMobileClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-purple-700 text-white font-semibold border-l-2 border-purple-400"
                        : "text-purple-300 hover:bg-purple-800/50 hover:text-white"
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
          className="hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-purple-400 hover:bg-purple-800/50 hover:text-white transition-colors w-full"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <><ChevronLeft className="h-5 w-5" /> <span>Thu gọn</span></>}
        </button>
      </div>
    </aside>
    </>
  )
}

function HubTopbar({ collapsed, onMobileMenu }: { collapsed: boolean; onMobileMenu: () => void }) {
  const pathname = usePathname()
  const { user } = useAuth()

  const breadcrumbMap: Record<string, string> = {
    '/hub': 'Dashboard',
    '/hub/inventory': 'Tồn kho Hub',
    '/hub/balance': 'Cân bằng tồn kho',
    '/hub/transfers': 'Điều chuyển',
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
          <span>Kho Hub</span>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">{breadcrumbMap[pathname] || 'Dashboard'}</span>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="h-8 w-8 rounded-full bg-purple-600/10 text-purple-600 flex items-center justify-center text-xs font-bold">
          <Warehouse className="h-4 w-4" />
        </div>
      </div>
    </header>
  )
}

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <RouteGuard requiredRole="employee">
      <InventoryProvider>
        <div className="min-h-screen bg-background">
          <HubSidebar 
            collapsed={collapsed} 
            onToggle={() => setCollapsed(!collapsed)} 
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
          />
          <HubTopbar collapsed={collapsed} onMobileMenu={() => setMobileOpen(true)} />
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
