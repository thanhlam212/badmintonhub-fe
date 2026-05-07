"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Menu, X, ShoppingCart, User, Phone, MapPin, LogOut, Shield, LogIn, ChevronDown, Calendar, Sparkles } from "lucide-react"
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

// ═══════════════════════════════════════════════════════════════
// NAV LINKS CONFIG với Dropdown Support
// ═══════════════════════════════════════════════════════════════

const navLinks = [
  { href: "/", label: "Trang chủ", icon: "🏠" },
  { 
    label: "Đặt sân",
    icon: "🏸",
    submenu: [
      { href: "/courts", label: "Đặt sân đơn lẻ", icon: "🏸", description: "Đặt sân theo giờ, linh hoạt" },
      { 
        href: "/booking/fixed-schedule", 
        label: "Đặt lịch cố định", 
        icon: "📅",
        badge: "Mới",
        description: "Gói tuần/tháng, giảm đến 10%"
      }
    ]
  },
  { href: "/shop", label: "Cửa hàng", icon: "🛍️" },
  { href: "/my-bookings", label: "Lịch đặt", icon: "📋" },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [bookingMenuOpen, setBookingMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { totalItems } = useCart()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

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
              3 cơ sở tại TP.HCM
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
          "sticky top-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-lg shadow-black/5"
            : "bg-white border-b border-gray-100"
        )}
      >
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="relative">
              <Image
                src="/logo.jpg"
                alt="BadmintonHub"
                width={56}
                height={56}
                className="rounded-xl transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-serif text-xl font-extrabold tracking-tight text-[#0A2416]">
                Badminton<span className="text-primary">Hub</span>
              </span>
              <span className="text-[11px] font-medium tracking-widest uppercase text-muted-foreground">
                Hệ thống sân cầu lông
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => {
              if (link.submenu) {
                // Dropdown menu item
                return (
                  <div
                    key={link.label}
                    className="relative"
                    onMouseEnter={() => setBookingMenuOpen(true)}
                    onMouseLeave={() => setBookingMenuOpen(false)}
                  >
                    <button
                      className={cn(
                        "relative flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap group",
                        isBookingMenuActive
                          ? "text-primary bg-primary/8"
                          : "text-gray-600 hover:text-[#0A2416] hover:bg-gray-50"
                      )}
                    >
                      <span>{link.icon}</span>
                      <span>{link.label}</span>
                      <ChevronDown className={cn(
                        "h-3.5 w-3.5 transition-transform duration-300",
                        bookingMenuOpen && "rotate-180"
                      )} />
                      {isBookingMenuActive && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-primary rounded-full" />
                      )}
                    </button>

                    {/* Dropdown Content */}
                    <div 
                      className={cn(
                        "absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 origin-top",
                        bookingMenuOpen 
                          ? "opacity-100 scale-100 translate-y-0" 
                          : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                      )}
                    >
                      <div className="p-2">
                        {link.submenu.map((item, idx) => {
                          const isActive = pathname === item.href
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg transition-all duration-200 group/item relative",
                                isActive
                                  ? "bg-primary/10 text-primary"
                                  : "hover:bg-gray-50 text-gray-700"
                              )}
                            >
                              <span className="text-xl mt-0.5 group-hover/item:scale-110 transition-transform duration-200">
                                {item.icon}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm">{item.label}</span>
                                  {item.badge && (
                                    <span className="px-1.5 py-0.5 bg-green-600 text-white text-[9px] font-bold rounded-full animate-pulse">
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
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
                        ? "text-primary bg-primary/8"
                        : "text-gray-600 hover:text-[#0A2416] hover:bg-gray-50"
                    )}
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-primary rounded-full" />
                    )}
                  </Link>
                )
              }
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/shop">
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-lg text-gray-600 hover:text-[#0A2416] hover:bg-gray-100 transition-all duration-200 hover:scale-105"
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-sm animate-bounce">
                    {totalItems}
                  </span>
                )}
              </Button>
            </Link>

            {user ? (
              user.role === "guest" ? (
                /* Guest user - show register/login options */
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200">
                    <div className="h-6 w-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold">
                      K
                    </div>
                    <span className="text-xs text-amber-700 font-medium">Khách</span>
                  </div>
                  <Link href="/login" onClick={() => logout()}>
                    <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-md border-[#1F6B3A] text-[#1F6B3A] hover:bg-[#1F6B3A]/5 transition-all duration-200">
                      <LogIn className="h-3.5 w-3.5 mr-1" />
                      Đăng nhập
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => logout()}>
                    <Button size="sm" className="h-8 bg-[#1F6B3A] text-white hover:bg-[#185a30] text-xs font-semibold rounded-md transition-all duration-200 hover:shadow-md">
                      Đăng ký
                    </Button>
                  </Link>
                </div>
              ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-9 rounded-lg text-gray-600 hover:text-[#0A2416] hover:bg-gray-100 gap-1.5 px-2 transition-all duration-200"
                  >
                    <div className="h-7 w-7 rounded-full bg-[#1F6B3A]/10 text-[#1F6B3A] flex items-center justify-center text-xs font-bold">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold max-w-[100px] truncate">{user.fullName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/my-bookings" className="cursor-pointer">
                      <User className="h-4 w-4 mr-2" /> Lịch đặt của tôi
                    </Link>
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer">
                        <Shield className="h-4 w-4 mr-2" /> Quản trị
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {user.role === "employee" && (
                    <DropdownMenuItem asChild>
                      <Link href="/employee" className="cursor-pointer">
                        <Shield className="h-4 w-4 mr-2" /> Nhân viên
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { logout(); router.push("/") }}
                    className="text-red-600 focus:text-red-600 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              )
            ) : (
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="h-9 rounded-lg text-gray-600 hover:text-[#0A2416] hover:bg-gray-100 gap-1.5 px-3 transition-all duration-200"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="text-sm font-semibold">Đăng nhập</span>
                </Button>
              </Link>
            )}

            <div className="w-px h-6 bg-gray-200 mx-1" />
            
            {/* Primary CTA */}
            <Link href="/courts">
              <Button className="bg-[#1F6B3A] text-white hover:bg-[#185a30] font-semibold rounded-lg px-5 h-9 text-sm shadow-md shadow-green-900/15 transition-all duration-200 hover:shadow-lg hover:shadow-green-900/20 hover:-translate-y-0.5">
                🏸 Đặt sân ngay
              </Button>
            </Link>

            {/* ✨ Secondary CTA - Fixed Schedule */}
            <Link href="/booking/fixed-schedule">
              <Button 
                variant="outline" 
                className="relative border-2 border-green-600 text-green-700 hover:bg-green-50 font-semibold rounded-lg px-4 h-9 text-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden group"
              >
                <span className="relative z-10 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>Gói cố định</span>
                </span>
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-[9px] font-bold rounded-full shadow-sm z-20 animate-pulse">
                  MỚI
                </span>
                {/* Sparkle effect on hover */}
                <Sparkles className="absolute top-1 right-8 h-3 w-3 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden flex items-center justify-center h-11 w-11 rounded-xl text-gray-600 hover:bg-gray-100 transition-all duration-200 active:scale-95"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300 ease-in-out bg-white",
            mobileOpen ? "max-h-[600px] border-t border-gray-100" : "max-h-0"
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
                            ? "text-primary bg-primary/8"
                            : "text-gray-600 hover:text-[#0A2416] hover:bg-gray-50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span>{link.icon}</span>
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
                                    ? "text-primary bg-primary/8"
                                    : "text-gray-600 hover:text-[#0A2416] hover:bg-gray-50"
                                )}
                              >
                                <span className="text-base mt-0.5">{item.icon}</span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span>{item.label}</span>
                                    {item.badge && (
                                      <span className="px-1.5 py-0.5 bg-green-600 text-white text-[8px] font-bold rounded-full">
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
                          ? "text-primary bg-primary/8"
                          : "text-gray-600 hover:text-[#0A2416] hover:bg-gray-50"
                      )}
                    >
                      <span>{link.icon}</span>
                      <span>{link.label}</span>
                    </Link>
                  )
                }
              })}
            </nav>
            
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <Link href="/courts" className="flex-1" onClick={() => setMobileOpen(false)}>
                <Button className="w-full bg-[#1F6B3A] text-white hover:bg-[#185a30] font-semibold rounded-xl shadow-md transition-all duration-200 active:scale-95">
                  🏸 Đặt sân ngay
                </Button>
              </Link>
            </div>

            {/* Mobile Auth */}
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-gray-100">
              {user && user.role === "guest" ? (
                /* Mobile Guest */
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-4 py-2">
                    <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-bold">
                      K
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Khách vãng lai</p>
                      <p className="text-xs text-amber-600">Đăng nhập để có thêm ưu đãi</p>
                    </div>
                  </div>
                  <div className="flex gap-2 px-4">
                    <Link href="/login" className="flex-1" onClick={() => { logout(); setMobileOpen(false) }}>
                      <Button variant="outline" className="w-full rounded-xl font-semibold border-[#1F6B3A] text-[#1F6B3A] transition-all duration-200">
                        Đăng nhập
                      </Button>
                    </Link>
                    <Link href="/register" className="flex-1" onClick={() => { logout(); setMobileOpen(false) }}>
                      <Button className="w-full bg-[#1F6B3A] text-white hover:bg-[#185a30] rounded-xl font-semibold transition-all duration-200">
                        Đăng ký
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : user ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-2">
                    <div className="h-8 w-8 rounded-full bg-[#1F6B3A]/10 text-[#1F6B3A] flex items-center justify-center text-sm font-bold">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{user.fullName}</p>
                      <p className="text-xs text-gray-500">@{user.username}</p>
                    </div>
                  </div>
                  {user.role === "admin" && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl text-gray-600 hover:text-[#0A2416] hover:bg-gray-50 transition-all duration-200"
                    >
                      <Shield className="h-4 w-4" /> Quản trị
                    </Link>
                  )}
                  {user.role === "employee" && (
                    <Link
                      href="/employee"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl text-gray-600 hover:text-[#0A2416] hover:bg-gray-50 transition-all duration-200"
                    >
                      <Shield className="h-4 w-4" /> Nhân viên
                    </Link>
                  )}
                  <button
                    onClick={() => { logout(); setMobileOpen(false); router.push("/") }}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200"
                  >
                    <LogOut className="h-4 w-4" /> Đăng xuất
                  </button>
                </>
              ) : (
                <div className="flex gap-2 px-4">
                  <Link href="/login" className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full rounded-xl font-semibold transition-all duration-200">
                      Đăng nhập
                    </Button>
                  </Link>
                  <Link href="/register" className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full bg-[#1F6B3A] text-white hover:bg-[#185a30] rounded-xl font-semibold transition-all duration-200">
                      Đăng ký
                    </Button>
                  </Link>
                </div>
              )}
            </div>
            {/* Mobile top info */}
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
              <span className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> Hotline: <strong className="text-gray-700">1900 1234</strong>
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" /> 3 cơ sở tại TP.HCM
              </span>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}