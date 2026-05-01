"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Bell, CheckCircle2, Clock, XCircle, Play, FileText, Truck, Package, AlertTriangle, Info } from "lucide-react"
import { useState } from "react"
import { Progress } from "@/components/ui/progress"

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
    pending: { label: "Chờ duyệt", className: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="h-3 w-3" /> },
    confirmed: { label: "Đã xác nhận", className: "bg-blue-100 text-blue-800 border-blue-200", icon: <CheckCircle2 className="h-3 w-3" /> },
    "in-transit": { label: "Đang vận chuyển", className: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: <Truck className="h-3 w-3" /> },
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
  const [notifs, setNotifs] = useState(defaultNotifications)
  const unreadCount = notifs.filter(n => !n.read).length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold font-serif text-sm">Thông báo</h4>
          <button
            onClick={() => setNotifs(notifs.map(n => ({ ...n, read: true })))}
            className="text-xs text-primary hover:underline"
          >
            Đánh dấu đã đọc
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
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