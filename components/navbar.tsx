"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Menu, X, ShoppingCart, User, Phone, MapPin, LogOut, Shield, LogIn, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useCart } from "@/lib/cart-context"
import { Navbar3DBackground } from "@/components/navbar-3d"

// ═══════════════════════════════════════════════════════════════
// NAV LINKS CONFIG với Dropdown Support
// ═══════════════════════════════════════════════════════════════

const navLinks = [
  { href: "/", label: "Trang chủ" },
  { 
    label: "Đặt sân",
    submenu: [
      { href: "/courts", label: "Đặt sân đơn lẻ", description: "Đặt sân theo giờ, linh hoạt" },
      { 
        href: "/booking/fixed-schedule", 
        label: "Đặt lịch cố định", 
        badge: "Mới",
        description: "Gói tuần/tháng, giảm đến 10%"
      }
    ]
  },
  { href: "/shop", label: "Cửa hàng" },
  { href: "/my-bookings", label: "Lịch đặt/Đơn hàng" },
  { href: "/community", label: "Cộng đồng" },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [bookingMenuOpen, setBookingMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { totalItems } = useCart()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
      // Đóng dropdown khi scroll
      if (bookingMenuOpen) {
        setBookingMenuOpen(false)
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [bookingMenuOpen])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setBookingMenuOpen(false)
      }
    }

    if (bookingMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [bookingMenuOpen])

  // Check if current path is in booking submenu
  const isBookingMenuActive = pathname.startsWith('/courts') || pathname.startsWith('/booking/fixed-schedule')

  return (
    <>
      {/* Top Bar */}
      <div className="hidden lg:block bg-[#0A2416] text-white/80 text-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-2.5">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 transition-colors hover:text-white">
              <Phone className="h-3 w-3" />
              Hotline: <strong className="text-white">1900 1234</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              3 cơ sở tại Hà Nội
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Giờ mở cửa: <strong className="text-white">06:00 – 22:00</strong></span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-300 relative overflow-visible",
          scrolled
            ? "bg-[#0A2416]/90 backdrop-blur-md shadow-lg shadow-black/25"
            : "bg-[#0A2416] border-b border-white/10"
        )}
      >
        {/* Three.js 3D Background */}
        <Navbar3DBackground />

        <div className="relative z-10 px-4 sm:px-6 lg:px-8 h-16 sm:h-20">
          <div className="flex items-center justify-between h-full gap-4 sm:gap-8">
            {/* Logo - Bên trái */}
            <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
              <Image
                src="/logo.jpg"
                alt="BadmintonHub"
                width={42}
                height={42}
                className="rounded-xl transition-transform duration-300 group-hover:scale-105 border border-white/10"
              />
              <div className="flex flex-col leading-none">
                <span className="font-serif text-lg sm:text-xl font-extrabold tracking-tight text-white">
                  Badminton<span className="text-[#FF6B35]">Hub</span>
                </span>
                <span className="hidden sm:inline text-[11px] font-medium tracking-widest uppercase text-white/60">
                  Hệ thống sân cầu lông
                </span>
              </div>
            </Link>

            {/* Desktop Nav - Giữa */}
            <nav className="hidden md:flex items-center gap-3 flex-1 justify-center">
            {navLinks.map(link => {
              if (link.submenu) {
                // Dropdown menu item
                return (
                  <div
                    key={link.label}
                    className="relative"
                    ref={dropdownRef}
                  >
                    <button
                      onClick={() => setBookingMenuOpen(!bookingMenuOpen)}
                      className={cn(
                        "relative flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap group",
                        isBookingMenuActive
                          ? "text-[#FF6B35] bg-[#FF6B35]/10"
                          : "text-white/80 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <span>{link.label}</span>
                      <ChevronDown className={cn(
                        "h-3.5 w-3.5 transition-transform duration-300",
                        bookingMenuOpen && "rotate-180"
                      )} />
                      {isBookingMenuActive && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#FF6B35] rounded-full" />
                      )}
                    </button>

                    {/* Dropdown Content */}
                    <div 
                      className={cn(
                        "absolute top-full left-0 mt-2 w-64 bg-[#0B2C1C] rounded-xl shadow-xl border border-white/10 overflow-hidden transition-all duration-300 origin-top z-50",
                        bookingMenuOpen 
                          ? "opacity-100 scale-100 translate-y-0" 
                          : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                      )}
                    >
                      <div className="p-2">
                        {link.submenu.map((item) => {
                          const isActive = pathname === item.href
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setBookingMenuOpen(false)}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg transition-all duration-200 group/item relative",
                                isActive
                                  ? "bg-[#FF6B35]/10 text-[#FF6B35]"
                                  : "hover:bg-white/5 text-white/80 hover:text-white"
                              )}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm">{item.label}</span>
                                  {item.badge && (
                                    <span className="px-1.5 py-0.5 bg-[#FF6B35] text-white text-[9px] font-bold rounded-full animate-pulse">
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-white/50 mt-0.5">{item.description}</p>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              } else {
                // Regular menu item
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "relative flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap",
                      isActive
                        ? "text-[#FF6B35] bg-[#FF6B35]/10"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <span>{link.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#FF6B35] rounded-full" />
                    )}
                  </Link>
                )
              }
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center justify-end gap-2 shrink-0">
            {/* Cart */}
            <Link href="/shop">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-white/80 hover:text-white hover:bg-white/10 relative transition-all duration-200">
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-[#FF6B35] text-[9px] text-white font-bold">
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                )}
              </Button>
            </Link>

            {user ? (
              user.role === "guest" ? (
                /* Guest user - show register/login options */
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                    <div className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">
                      K
                    </div>
                    <span className="text-xs text-amber-400 font-medium">Khách</span>
                  </div>
                  <Link href="/login" onClick={() => logout()}>
                    <Button className="h-10 px-4 text-sm font-bold rounded-lg bg-[#FF6B35] text-white hover:bg-[#e85a28] shadow-md shadow-orange-950/25 transition-all duration-200 hover:-translate-y-0.5">
                      <LogIn className="h-4 w-4 mr-1.5" />
                      Đăng nhập
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => logout()}>
                    <Button variant="outline" className="h-10 px-4 border-white/20 text-white bg-transparent hover:bg-white/10 hover:text-white text-sm font-semibold rounded-lg transition-all duration-200">
                      Đăng ký
                    </Button>
                  </Link>
                </div>
              ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-9 rounded-lg text-white/80 hover:text-white hover:bg-white/10 gap-1.5 px-2 transition-all duration-200"
                  >
                    <div className="h-7 w-7 rounded-full bg-[#FF6B35]/20 text-[#FF6B35] flex items-center justify-center text-xs font-bold">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold max-w-[100px] truncate">{user.fullName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-[#0B2C1C] text-white border-white/10">
                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold">{user.fullName}</p>
                    <p className="text-xs text-white/60">@{user.username}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem asChild className="hover:bg-white/5 focus:bg-white/5 cursor-pointer">
                    <Link href="/my-bookings" className="cursor-pointer w-full flex items-center">
                      <User className="h-4 w-4 mr-2" /> Lịch đặt của tôi
                    </Link>
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem asChild className="hover:bg-white/5 focus:bg-white/5 cursor-pointer">
                      <Link href="/admin" className="cursor-pointer w-full flex items-center">
                        <Shield className="h-4 w-4 mr-2" /> Quản trị
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {user.role === "employee" && (
                    <DropdownMenuItem asChild className="hover:bg-white/5 focus:bg-white/5 cursor-pointer">
                      <Link href="/employee" className="cursor-pointer w-full flex items-center">
                        <Shield className="h-4 w-4 mr-2" /> Nhân viên
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => { logout(); router.push("/") }}
                    className="text-rose-400 hover:bg-rose-500/10 focus:text-rose-400 focus:bg-rose-500/10 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              )
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button
                    className="h-10 rounded-lg bg-[#FF6B35] text-white hover:bg-[#e85a28] gap-2 px-4 text-sm font-bold shadow-md shadow-orange-950/25 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Đăng nhập</span>
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline" className="h-10 rounded-lg border-white/20 text-white bg-transparent hover:bg-white/10 hover:text-white px-4 text-sm font-semibold transition-all duration-200">
                    Đăng ký
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {(!user || user.role === "guest") && (
            <Link
              href="/login"
              className="md:hidden ml-auto"
              onClick={() => {
                if (user?.role === "guest") logout()
              }}
            >
              <Button className="h-10 rounded-xl bg-[#FF6B35] text-white hover:bg-[#e85a28] px-3 text-sm font-bold shadow-md shadow-orange-950/25">
                <LogIn className="h-4 w-4 mr-1.5" />
                Đăng nhập
              </Button>
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden flex items-center justify-center h-11 w-11 rounded-xl text-white/80 hover:bg-white/10 transition-all duration-200 active:scale-95"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300 ease-in-out bg-[#0A2416]",
            mobileOpen ? "max-h-[600px] border-t border-white/10" : "max-h-0"
          )}
        >
          <div className="px-4 pb-5 pt-3">
            <nav className="flex flex-col gap-1">
              {navLinks.map(link => {
                if (link.submenu) {
                  // Mobile dropdown
                  const anySubmenuActive = link.submenu.some(item => pathname === item.href)
                  return (
                    <div key={link.label} className="space-y-1">
                      <button
                        onClick={() => setBookingMenuOpen(!bookingMenuOpen)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200",
                          anySubmenuActive
                            ? "text-[#FF6B35] bg-[#FF6B35]/10"
                            : "text-white/80 hover:text-white hover:bg-white/10"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span>{link.label}</span>
                        </div>
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform duration-300",
                          bookingMenuOpen && "rotate-180"
                        )} />
                      </button>
                      <div className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        bookingMenuOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
                      )}>
                        <div className="pl-4 space-y-1">
                          {link.submenu.map(item => {
                            const isActive = pathname === item.href
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                  "flex items-start gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                                  isActive
                                    ? "text-[#FF6B35] bg-[#FF6B35]/10"
                                    : "text-white/80 hover:text-white hover:bg-white/10"
                                )}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span>{item.label}</span>
                                    {item.badge && (
                                      <span className="px-1.5 py-0.5 bg-[#FF6B35] text-white text-[8px] font-bold rounded-full">
                                        {item.badge}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                } else {
                  const isActive = pathname === link.href
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200",
                        isActive
                          ? "text-[#FF6B35] bg-[#FF6B35]/10"
                          : "text-white/80 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <span>{link.label}</span>
                    </Link>
                  )
                }
              })}
            </nav>
            
            {/* Mobile Auth */}
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/10">
              {user && user.role === "guest" ? (
                /* Mobile Guest */
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-4 py-2">
                    <div className="h-8 w-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-bold">
                      K
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-400">Khách vãng lai</p>
                      <p className="text-xs text-amber-600/70">Đăng nhập để có thêm ưu đãi</p>
                    </div>
                  </div>
                  <div className="flex gap-2 px-4">
                    <Link href="/login" className="flex-1" onClick={() => { logout(); setMobileOpen(false) }}>
                      <Button className="w-full h-11 rounded-xl font-bold bg-[#FF6B35] text-white hover:bg-[#e85a28] transition-all duration-200">
                        Đăng nhập
                      </Button>
                    </Link>
                    <Link href="/register" className="flex-1" onClick={() => { logout(); setMobileOpen(false) }}>
                      <Button variant="outline" className="w-full h-11 rounded-xl font-semibold border-white/20 text-white bg-transparent hover:bg-white/10 hover:text-white transition-all duration-200">
                        Đăng ký
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : user ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-2">
                    <div className="h-8 w-8 rounded-full bg-[#FF6B35]/20 text-[#FF6B35] flex items-center justify-center text-sm font-bold">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{user.fullName}</p>
                      <p className="text-xs text-white/60">@{user.username}</p>
                    </div>
                  </div>
                  {user.role === "admin" && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
                    >
                      <Shield className="h-4 w-4" /> Quản trị
                    </Link>
                  )}
                  {user.role === "employee" && (
                    <Link
                      href="/employee"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
                    >
                      <Shield className="h-4 w-4" /> Nhân viên
                    </Link>
                  )}
                  <button
                    onClick={() => { logout(); setMobileOpen(false); router.push("/") }}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all duration-200 w-full text-left"
                  >
                    <LogOut className="h-4 w-4" /> Đăng xuất
                  </button>
                </>
              ) : (
                <div className="flex gap-2 px-4">
                  <Link href="/login" className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full h-11 rounded-xl bg-[#FF6B35] text-white hover:bg-[#e85a28] font-bold transition-all duration-200">
                      Đăng nhập
                    </Button>
                  </Link>
                  <Link href="/register" className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full h-11 border-white/20 text-white bg-transparent hover:bg-white/10 hover:text-white rounded-xl font-semibold transition-all duration-200">
                      Đăng ký
                    </Button>
                  </Link>
                </div>
              )}
            </div>
            {/* Mobile top info */}
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/10 text-xs text-white/50">
              <span className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> Hotline: <strong className="text-white">1900 1234</strong>
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" /> 3 cơ sở tại Hà Nội
              </span>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
