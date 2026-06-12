"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Bell, CheckCircle2, Clock, XCircle, Play, FileText, Truck, Package, AlertTriangle } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { bookingApi, type ApiBooking } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

type NotificationSeverity = "info" | "warning" | "critical"
type NotificationCategory = "checkin" | "booking" | "inventory" | "system"

type AppNotification = {
  id: string
  title: string
  message: string
  time: string
  category: NotificationCategory
  severity: NotificationSeverity
  createdAt: number
  dismissible: boolean
  read?: boolean
  priority?: "high" | "medium" | "low"
}

const CHECKIN_GRACE_MINUTES = 15
const CLEANUP_REMINDER_WINDOW_MINUTES = 180
const DISMISSED_NOTIFICATIONS_KEY = "badmintonhub_dismissed_notifications"

const categoryMeta: Record<NotificationCategory, { label: string; dotClassName: string }> = {
  checkin: { label: "Check-in sân", dotClassName: "bg-amber-500" },
  booking: { label: "Đặt sân", dotClassName: "bg-blue-500" },
  inventory: { label: "Kho hàng", dotClassName: "bg-emerald-500" },
  system: { label: "Hệ thống", dotClassName: "bg-slate-500" },
}

const severityMeta: Record<NotificationSeverity, { className: string; badgeClassName: string; label: string }> = {
  info: {
    className: "border-l-blue-500 bg-blue-50/70",
    badgeClassName: "bg-blue-100 text-blue-700 border-blue-200",
    label: "Thông tin",
  },
  warning: {
    className: "border-l-amber-500 bg-amber-50/80",
    badgeClassName: "bg-amber-100 text-amber-800 border-amber-200",
    label: "Cảnh báo",
  },
  critical: {
    className: "border-l-red-500 bg-red-50/85",
    badgeClassName: "bg-red-100 text-red-800 border-red-200",
    label: "Lỗi",
  },
}

function getBookingDatePart(value: string) {
  if (!value) return ""
  const directDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (directDate) return directDate

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function makeBookingDateTime(bookingDate: string, timeValue: string) {
  const datePart = getBookingDatePart(bookingDate)
  if (!datePart || !timeValue) return null

  const [rawHour = "0", rawMinute = "0"] = timeValue.split(":")
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  const date = new Date(`${datePart}T00:00:00`)
  date.setHours(Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0, 0, 0)

  return Number.isNaN(date.getTime()) ? null : date
}

function formatNotificationDate(date: Date) {
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function minutesSince(now: Date, date: Date) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000))
}

function buildCheckinNotifications(bookings: ApiBooking[], now = new Date()): AppNotification[] {
  return bookings.flatMap<AppNotification>((booking): AppNotification[] => {
    const startAt = makeBookingDateTime(booking.bookingDate, booking.timeStart)
    const endAt = makeBookingDateTime(booking.bookingDate, booking.timeEnd)
    if (!startAt || !endAt) return []
    if (endAt <= startAt) endAt.setDate(endAt.getDate() + 1)

    const bookingRef = booking.bookingCode || booking.id.slice(0, 8)
    const courtText = [booking.courtName || "Sân", booking.branchName].filter(Boolean).join(" - ")
    const customerText = [booking.customerName || "Khách", booking.customerPhone].filter(Boolean).join(" | ")
    const dateText = formatNotificationDate(startAt)
    const lateAt = new Date(startAt.getTime() + CHECKIN_GRACE_MINUTES * 60000)

    if (booking.status === "confirmed") {
      if (now >= endAt) {
        return [{
          id: `checkin-missed-${booking.id}`,
          title: "Lỗi sân chưa được check-in",
          message: `${courtText} đã hết khung giờ nhưng chưa được check-in. Booking ${bookingRef}${customerText ? ` - ${customerText}` : ""}.`,
          time: `Kết thúc ${booking.timeEnd} ${dateText}`,
          category: "checkin" as const,
          severity: "critical" as const,
          createdAt: endAt.getTime(),
          dismissible: false,
        }]
      }

      if (now >= lateAt) {
        return [{
          id: `checkin-late-${booking.id}`,
          title: "Sân chưa check-in",
          message: `${courtText} đã trễ check-in ${minutesSince(now, startAt)} phút. Booking ${bookingRef}${customerText ? ` - ${customerText}` : ""}.`,
          time: `Bắt đầu ${booking.timeStart} ${dateText}`,
          category: "checkin" as const,
          severity: "warning" as const,
          createdAt: lateAt.getTime(),
          dismissible: true,
        }]
      }

      return []
    }

    if (!["playing", "completed"].includes(booking.status)) return []

    const minutesAfterEnd = minutesSince(now, endAt)
    if (now < endAt || minutesAfterEnd > CLEANUP_REMINDER_WINDOW_MINUTES) return []

    return [{
      id: `cleanup-${booking.id}`,
      title: "Sân đã hết giờ",
      message: `${courtText} đã hết giờ. Nhân viên đến dọn sân. Booking ${bookingRef}${customerText ? ` - ${customerText}` : ""}.`,
      time: `Kết thúc ${booking.timeEnd} ${dateText}`,
      category: "booking" as const,
      severity: booking.status === "playing" ? "critical" as const : "warning" as const,
      createdAt: endAt.getTime(),
      dismissible: true,
    }]
  }).sort((a, b) => {
    const severityOrder: Record<NotificationSeverity, number> = { critical: 0, warning: 1, info: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity] || b.createdAt - a.createdAt
  })
}

// Default notifications (will be replaced by real API later)
const defaultNotifications = [
  { id: 1, title: "Đơn hàng mới", message: "Có 3 đơn hàng mới cần xử lý", time: "5 phút trước", read: false, priority: "high" as const },
  { id: 2, title: "Tồn kho thấp", message: "5 sản phẩm sắp hết hàng", time: "1 giờ trước", read: false, priority: "medium" as const },
  { id: 3, title: "Hệ thống", message: "Sao lưu dữ liệu hoàn tất", time: "3 giờ trước", read: true, priority: "low" as const },
]

// Booking Status Badge
export function BookingStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    pending: { label: "Chờ xác nhận", className: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="h-3 w-3" /> },
    deposited: { label: "Đã đặt cọc", className: "bg-orange-100 text-orange-800 border-orange-200", icon: <CheckCircle2 className="h-3 w-3" /> },
    confirmed: { label: "Đã xác nhận", className: "bg-blue-100 text-blue-800 border-blue-200", icon: <CheckCircle2 className="h-3 w-3" /> },
    playing: { label: "Đang chơi", className: "bg-green-100 text-green-800 border-green-200", icon: <Play className="h-3 w-3" /> },
    completed: { label: "Hoàn thành", className: "bg-gray-100 text-gray-600 border-gray-200", icon: <CheckCircle2 className="h-3 w-3" /> },
    cancelled: { label: "Đã huỷ", className: "bg-red-100 text-red-800 border-red-200", icon: <XCircle className="h-3 w-3" /> },
  }
  const c = config[status] || config.pending
  return (
    <Badge variant="outline" className={cn("flex items-center gap-1 text-xs font-medium", c.className)}>
      {c.icon} {c.label}
    </Badge>
  )
}

// PO Status Badge
export function POStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    draft: { label: "Nháp", className: "bg-gray-100 text-gray-600 border-gray-200", icon: <FileText className="h-3 w-3" /> },
    sent: { label: "Đã gửi NCC", className: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="h-3 w-3" /> },
    pending: { label: "Chờ duyệt", className: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="h-3 w-3" /> },
    confirmed: { label: "Đã xác nhận", className: "bg-blue-100 text-blue-800 border-blue-200", icon: <CheckCircle2 className="h-3 w-3" /> },
    shipping: { label: "Đang vận chuyển", className: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: <Truck className="h-3 w-3" /> },
    "in-transit": { label: "Đang vận chuyển", className: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: <Truck className="h-3 w-3" /> },
    received: { label: "Đã nhận", className: "bg-green-100 text-green-800 border-green-200", icon: <Package className="h-3 w-3" /> },
    delivered: { label: "Đã nhận", className: "bg-green-100 text-green-800 border-green-200", icon: <Package className="h-3 w-3" /> },
    cancelled: { label: "Đã huỷ", className: "bg-red-100 text-red-800 border-red-200", icon: <XCircle className="h-3 w-3" /> },
  }
  const c = config[status] || config.draft
  return (
    <Badge variant="outline" className={cn("flex items-center gap-1 text-xs font-medium", c.className)}>
      {c.icon} {c.label}
    </Badge>
  )
}

/**
 * Stock Level Indicator
 * ─────────────────────────────────────────────────────────────────────────────
 * Công thức:
 *   maxCapacity  = max ?? reorderPoint × 3          (ngưỡng trần để tính %)
 *   stockPct     = min(available / maxCapacity × 100, 100)
 *
 * Ngưỡng màu:
 *   available === 0                 → ĐỎ  (hết hàng)
 *   0 < available < reorderPoint    → ĐỎ  (nguy hiểm, dưới điểm đặt lại)
 *   available === reorderPoint      → VÀNG (đúng ngưỡng đặt lại)
 *   available > reorderPoint        → XANH (bình thường)
 */
export function StockLevelIndicator({ available, reorderPoint, max }: { available: number; reorderPoint: number; max?: number }) {
  const maxCapacity = max || reorderPoint * 3
  const stockPct = Math.min((available / maxCapacity) * 100, 100)
  const color = available === 0 ? "bg-red-500" : available < reorderPoint ? "bg-red-500" : available === reorderPoint ? "bg-amber-500" : "bg-green-500"
  const textColor = available === 0 ? "text-red-600" : available < reorderPoint ? "text-red-600" : available === reorderPoint ? "text-amber-600" : "text-green-600"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-semibold", textColor)}>
              {available}
              {available <= reorderPoint && <AlertTriangle className="inline ml-1 h-3 w-3" />}
            </span>
            <div className="h-1.5 w-16 rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${stockPct}%` }} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Tồn kho: {available} | Điểm đặt lại: {reorderPoint}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Notification Bell
export function NotificationBell() {
  const { user } = useAuth()
  const [notifs, setNotifs] = useState<AppNotification[]>([])
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const unreadCount = notifs.length

  const dismissedSet = useMemo(() => new Set(dismissedIds), [dismissedIds])

  const loadNotifications = useCallback(async () => {
    if (!user || !["admin", "employee"].includes(user.role)) {
      setNotifs([])
      return
    }

    setIsLoading(true)
    try {
      const res = await bookingApi.getAll()
      const generated = buildCheckinNotifications(res.bookings || [])
      setNotifs(generated.filter((item) => item.severity === "critical" || !dismissedSet.has(item.id)))
    } catch (error) {
      console.error("Failed to load booking notifications", error)
    } finally {
      setIsLoading(false)
    }
  }, [dismissedSet, user])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setDismissedIds(parsed.filter((id) => typeof id === "string"))
      }
    } catch {
      setDismissedIds([])
    }
  }, [])

  useEffect(() => {
    loadNotifications()
    const timer = window.setInterval(loadNotifications, 60000)
    return () => window.clearInterval(timer)
  }, [loadNotifications])

  const persistDismissedIds = (nextIds: string[]) => {
    setDismissedIds(nextIds)
    localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(nextIds))
  }

  const dismissNotification = (id: string) => {
    persistDismissedIds(Array.from(new Set([...dismissedIds, id])))
    setNotifs((current) => current.filter((item) => item.id !== id || !item.dismissible))
  }

  const dismissWarnings = () => {
    const warningIds = notifs.filter((item) => item.dismissible).map((item) => item.id)
    if (warningIds.length === 0) return

    persistDismissedIds(Array.from(new Set([...dismissedIds, ...warningIds])))
    setNotifs((current) => current.filter((item) => !item.dismissible))
  }

  const groupedNotifs = useMemo(() => {
    const categories: NotificationCategory[] = ["checkin", "booking", "inventory", "system"]
    return categories
      .map((category) => ({
        category,
        items: notifs.filter((item) => item.category === category),
      }))
      .filter((group) => group.items.length > 0)
  }, [notifs])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Thông báo">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] max-w-[calc(100vw-1.5rem)] p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <div>
            <h4 className="font-semibold font-serif text-sm">Thông báo</h4>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Đang cập nhật..." : `${unreadCount} thông báo cần xử lý`}
            </p>
          </div>
          <button
            onClick={dismissWarnings}
            disabled={!notifs.some((item) => item.dismissible)}
            className="text-xs text-primary hover:underline disabled:pointer-events-none disabled:text-muted-foreground"
          >
            Bỏ qua cảnh báo
          </button>
        </div>
        <div className="hidden">
          <h4 className="font-semibold font-serif text-sm">Thông báo</h4>
          <button
            onClick={dismissWarnings}
            disabled={!notifs.some((item) => item.dismissible)}
            className="text-xs text-primary hover:underline disabled:pointer-events-none disabled:text-muted-foreground"
          >
            Đánh dấu đã đọc
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b p-3">
          {(Object.keys(categoryMeta) as NotificationCategory[]).map((category) => {
            const count = notifs.filter((item) => item.category === category).length
            const meta = categoryMeta[category]
            return (
              <div key={category} className="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                <span className={cn("h-2 w-2 rounded-full", meta.dotClassName)} />
                <span className="font-medium">{meta.label}</span>
                <span className="text-muted-foreground">{count}</span>
              </div>
            )
          })}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {groupedNotifs.length === 0 ? (
            <div className="p-6 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-medium">Chưa có thông báo mới</p>
              <p className="mt-1 text-xs text-muted-foreground">Nhắc check-in trễ và sân hết giờ sẽ tự hiện ở đây.</p>
            </div>
          ) : (
            groupedNotifs.map((group) => {
              const meta = categoryMeta[group.category]
              return (
                <div key={group.category} className="border-b last:border-b-0">
                  <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-3 py-2 text-xs font-semibold backdrop-blur">
                    <span className={cn("h-2 w-2 rounded-full", meta.dotClassName)} />
                    <span>{meta.label}</span>
                    <span className="text-muted-foreground">({group.items.length})</span>
                  </div>
                  {group.items.map((item) => {
                    const severity = severityMeta[item.severity]
                    return (
                      <div key={item.id} className={cn("border-l-4 px-3 py-3", severity.className)}>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {item.severity === "critical" ? (
                              <XCircle className="h-4 w-4 text-red-600" />
                            ) : item.severity === "warning" ? (
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                            ) : (
                              <Bell className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">{item.title}</p>
                              <Badge variant="outline" className={cn("h-5 px-1.5 text-[11px]", severity.badgeClassName)}>
                                {severity.label}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.message}</p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-medium text-muted-foreground">{item.time}</p>
                              {item.dismissible && (
                                <button
                                  onClick={() => dismissNotification(item.id)}
                                  className="shrink-0 rounded-md border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                                >
                                  Bỏ qua
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        <div className="hidden">
          {notifs.map(n => {
            const borderColor = n.priority === 'high' ? 'border-l-red-500' : n.priority === 'medium' ? 'border-l-amber-500' : 'border-l-blue-500'
            return (
              <div key={n.id} className={cn("flex gap-3 p-3 border-b last:border-b-0 border-l-3 cursor-pointer hover:bg-muted/50 transition-colors", borderColor, !n.read && "bg-blue-50")}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{n.time}</p>
                </div>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Payment Badge
export function PaymentBadge({ method }: { method: string }) {
  const config: Record<string, string> = {
    "MoMo": "bg-pink-100 text-pink-800",
    "VNPay": "bg-blue-100 text-blue-800",
    "Bank transfer": "bg-cyan-100 text-cyan-800",
    "Wallet": "bg-green-100 text-green-800",
  }
  return (
    <Badge variant="outline" className={cn("text-xs", config[method] || "bg-gray-100 text-gray-600")}>
      {method}
    </Badge>
  )
}
