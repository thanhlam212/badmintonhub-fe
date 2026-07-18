"use client"

import {
  cn,
  formatVND,
  formatPNKReference,
  formatPXKReference,
  formatTransferReference,
  formatSalesOrderReference,
  formatBookingReference,
} from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Bell, CheckCircle2, Clock, XCircle, Play, FileText, Truck, Package, AlertTriangle, ShoppingCart } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { bookingApi, inventoryApi, transferApi, salesOrderApi, type ApiBooking } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

type NotificationSeverity = "info" | "warning" | "critical"
type NotificationCategory = "checkin" | "booking" | "inventory" | "sales" | "system"

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
  href?: string
}

type WarehouseScope = {
  warehouseId: number | null
  branchId: number | null
  isHub: boolean
}

type NotificationRouteFactory = {
  booking: (booking: ApiBooking) => string
  checkin: (booking: ApiBooking) => string
  inventory: (transaction: any) => string
  transfer: (transfer: any) => string
  sales: (order: any) => string
  lowStock: (item: any) => string
}

const CHECKIN_GRACE_MINUTES = 15
const CLEANUP_REMINDER_WINDOW_MINUTES = 180
const DISMISSED_NOTIFICATIONS_KEY = "badmintonhub_dismissed_notifications"

function toNumberOrNull(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function resolveWarehouseScope(user: any, warehouses: any[]): WarehouseScope | null {
  const warehouseId = toNumberOrNull(user?.warehouseId ?? user?.warehouse_id)
  if (!warehouseId) return null

  const warehouse = warehouses.find((item) => toNumberOrNull(item.id) === warehouseId)
  const branchId = toNumberOrNull(
    warehouse?.branchId ?? warehouse?.branch_id ?? warehouse?.branch?.id,
  )

  return {
    warehouseId,
    branchId,
    isHub: !branchId,
  }
}

function recordWarehouseId(record: any): number | null {
  return toNumberOrNull(
    record?.warehouseId ??
      record?.warehouse_id ??
      record?.fulfillingWarehouseId ??
      record?.fulfilling_warehouse_id,
  )
}

function recordBranchId(record: any): number | null {
  return toNumberOrNull(record?.branchId ?? record?.branch_id ?? record?.branch?.id)
}

function filterByWarehouseScope<T extends Record<string, any>>(
  items: T[],
  scope: WarehouseScope | null,
): T[] {
  if (!scope?.warehouseId) return []
  return items.filter((item) => recordWarehouseId(item) === scope.warehouseId)
}

function filterTransfersByWarehouseScope<T extends Record<string, any>>(
  items: T[],
  scope: WarehouseScope | null,
): T[] {
  if (!scope?.warehouseId) return []
  return items.filter((item) => {
    const fromWarehouseId = toNumberOrNull(item.fromWarehouseId ?? item.from_warehouse_id)
    const toWarehouseId = toNumberOrNull(item.toWarehouseId ?? item.to_warehouse_id)
    return fromWarehouseId === scope.warehouseId || toWarehouseId === scope.warehouseId
  })
}

function filterByBranchScope<T extends Record<string, any>>(
  items: T[],
  scope: WarehouseScope | null,
): T[] {
  if (!scope?.branchId) return []
  return items.filter((item) => recordBranchId(item) === scope.branchId)
}

function createNotificationRoutes(user: any, scope: WarehouseScope | null): NotificationRouteFactory {
  const isAdmin = user?.role === "admin"
  const isHub = !isAdmin && !!scope?.isHub
  const bookingBase = isAdmin ? "/admin/bookings" : "/employee/bookings"
  const checkinBase = isAdmin ? "/admin/checkin" : "/employee/checkin"
  const inventoryBase = isAdmin ? "/admin/inventory" : isHub ? "/hub/inventory" : "/employee/inventory"
  const transferBase = isAdmin ? "/admin/inventory" : isHub ? "/hub/transfers" : "/employee/inventory"
  const salesBase = isAdmin ? "/admin/orders" : isHub ? "/hub/orders" : "/employee/approval"

  return {
    booking: (booking) => `${bookingBase}?bookingId=${encodeURIComponent(booking.id)}`,
    checkin: (booking) => `${checkinBase}?bookingId=${encodeURIComponent(booking.id)}`,
    inventory: (transaction) => {
      const txId = transaction?.id ? `&txId=${encodeURIComponent(String(transaction.id))}` : ""
      const warehouseId = recordWarehouseId(transaction)
      return `${inventoryBase}?tab=history${warehouseId ? `&warehouseId=${warehouseId}` : ""}${txId}`
    },
    transfer: (transfer) => {
      const transferId = transfer?.id ? `&transferId=${encodeURIComponent(String(transfer.id))}` : ""
      return `${transferBase}?tab=transfers${transferId}`
    },
    sales: (order) => {
      const orderId = order?.id ? `&orderId=${encodeURIComponent(String(order.id))}` : ""
      return `${salesBase}?type=sale${orderId}`
    },
    lowStock: (item) => {
      const sku = item?.sku ? `&sku=${encodeURIComponent(String(item.sku))}` : ""
      const warehouseId = recordWarehouseId(item)
      return `${inventoryBase}?tab=overview${warehouseId ? `&warehouseId=${warehouseId}` : ""}${sku}`
    },
  }
}

const categoryMeta: Record<NotificationCategory, { label: string; dotClassName: string }> = {
  checkin: { label: "Check-in sân", dotClassName: "bg-amber-500" },
  booking: { label: "Đặt sân", dotClassName: "bg-blue-500" },
  inventory: { label: "Kho hàng", dotClassName: "bg-emerald-500" },
  sales: { label: "Bán hàng", dotClassName: "bg-violet-500" },
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

function buildCheckinNotifications(
  bookings: ApiBooking[],
  now = new Date(),
  routes?: NotificationRouteFactory,
): AppNotification[] {
  return bookings.flatMap<AppNotification>((booking): AppNotification[] => {
    const startAt = makeBookingDateTime(booking.bookingDate, booking.timeStart)
    const endAt = makeBookingDateTime(booking.bookingDate, booking.timeEnd)
    if (!startAt || !endAt) return []
    if (endAt <= startAt) endAt.setDate(endAt.getDate() + 1)

    const bookingRef = booking.bookingCode || formatBookingReference(booking.id, booking.createdAt)
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
          href: routes?.checkin(booking),
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
          href: routes?.checkin(booking),
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
      href: routes?.booking(booking),
    }]
  }).sort((a, b) => {
    const severityOrder: Record<NotificationSeverity, number> = { critical: 0, warning: 1, info: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity] || b.createdAt - a.createdAt
  })
}

function getCancellerRoleLabel(role?: string | null) {
  switch (role) {
    case "admin":
      return "Admin"
    case "employee":
      return "Nhân viên"
    case "user":
      return "Khách hàng"
    default:
      return "Hệ thống"
  }
}

function buildCancellationNotifications(
  bookings: ApiBooking[],
  now = new Date(),
  routes?: NotificationRouteFactory,
): AppNotification[] {
  const recentWindowMs = 7 * 24 * 60 * 60 * 1000

  return bookings.flatMap<AppNotification>((booking) => {
    if (booking.status !== "cancelled" || !booking.cancelledAt) return []

    const cancelledAt = new Date(booking.cancelledAt)
    if (Number.isNaN(cancelledAt.getTime())) return []
    if (now.getTime() - cancelledAt.getTime() > recentWindowMs) return []

    const bookingRef = booking.bookingCode || formatBookingReference(booking.id, booking.createdAt)
    const courtText = [booking.courtName || "Sân", booking.branchName].filter(Boolean).join(" - ")
    const customerText = [booking.customerName || "Khách", booking.customerPhone].filter(Boolean).join(" | ")
    const reasonText = booking.cancellationReason?.trim() || "Không có lý do cụ thể."
    const cancelledBy = [getCancellerRoleLabel(booking.cancelledByRole), booking.cancelledByName].filter(Boolean).join(" - ")

    return [{
      id: `booking-cancelled-${booking.id}-${booking.cancelledAt}`,
      title: "Booking vừa bị hủy",
      message: `${courtText} đã bị hủy${cancelledBy ? ` bởi ${cancelledBy}` : ""}. Booking ${bookingRef}${customerText ? ` - ${customerText}` : ""}. Lý do: ${reasonText}`,
      time: `Hủy lúc ${cancelledAt.toLocaleString("vi-VN")}`,
      category: "booking" as const,
      severity: "warning" as const,
      createdAt: cancelledAt.getTime(),
      dismissible: true,
      href: routes?.booking(booking),
    }]
  }).sort((a, b) => b.createdAt - a.createdAt)
}

function buildInventoryNotifications(transactions: any[], routes?: NotificationRouteFactory): AppNotification[] {
  const recentWindowMs = 7 * 24 * 60 * 60 * 1000 // 7 days
  const now = Date.now()

  return transactions
    .filter((tx) => {
      const txTime = tx.createdAt ? new Date(tx.createdAt).getTime() : tx.date ? new Date(tx.date).getTime() : 0
      return txTime && (now - txTime <= recentWindowMs)
    })
    .map((tx) => {
      const txTime = tx.createdAt ? new Date(tx.createdAt).getTime() : tx.date ? new Date(tx.date).getTime() : 0
      const isImport = tx.type === "import"
      const code = isImport
        ? formatPNKReference(tx.code || tx.id, tx.createdAt || tx.date)
        : formatPXKReference(tx.code || tx.id, tx.createdAt || tx.date)
      const productName = tx.productName || tx.product_name || tx.name || tx.sku || ""
      const warehouseName = tx.warehouseName || tx.warehouse_name || tx.warehouse || ""
      const title = isImport ? "Nhập kho mới" : "Xuất kho mới"
      const message = isImport 
        ? `Nhập thành công ${tx.qty || tx.quantity || 0} sản phẩm "${productName}" vào kho "${warehouseName}". Mã: ${code}`
        : `Xuất thành công ${tx.qty || tx.quantity || 0} sản phẩm "${productName}" khỏi kho "${warehouseName}". Lý do: ${tx.note || "Không ghi chú"}. Mã: ${code}`

      return {
        id: `inventory-tx-${tx.id}`,
        title,
        message,
        time: new Date(txTime).toLocaleString("vi-VN"),
        category: "inventory" as const,
        severity: isImport ? ("info" as const) : ("warning" as const),
        createdAt: txTime,
        dismissible: true,
        href: routes?.inventory(tx),
      }
    })
}

function buildTransferNotifications(transfers: any[], routes?: NotificationRouteFactory): AppNotification[] {
  const recentWindowMs = 7 * 24 * 60 * 60 * 1000 // 7 days
  const now = Date.now()

  return transfers
    .filter((tf) => {
      const tfTime = tf.created_at ? new Date(tf.created_at).getTime() : tf.createdAt ? new Date(tf.createdAt).getTime() : tf.date ? new Date(tf.date).getTime() : 0
      return tfTime && (now - tfTime <= recentWindowMs)
    })
    .map((tf) => {
      const tfTime = tf.created_at ? new Date(tf.created_at).getTime() : tf.createdAt ? new Date(tf.createdAt).getTime() : tf.date ? new Date(tf.date).getTime() : 0
      const reference = formatTransferReference(tf.reference || tf.code || tf.id, tf.created_at || tf.createdAt || tf.date)
      const fromWh = tf.from_warehouse_name || tf.fromWarehouseName || tf.fromWarehouse || ""
      const toWh = tf.to_warehouse_name || tf.toWarehouseName || tf.toWarehouse || ""
      const itemsCount = tf.items ? tf.items.length : 0

      let title = "Yêu cầu điều chuyển"
      let severity: NotificationSeverity = "info"
      let statusLabel = ""

      if (tf.status === "pending") {
        title = "Chờ duyệt điều chuyển"
        statusLabel = "Đang chờ duyệt"
        severity = "warning"
      } else if (tf.status === "approved" || tf.status === "in_transit" || tf.status === "in-transit") {
        title = "Đang vận chuyển liên kho"
        statusLabel = "Đang vận chuyển"
        severity = "info"
      } else if (tf.status === "completed") {
        title = "Điều chuyển hoàn tất"
        statusLabel = "Đã hoàn thành"
        severity = "info"
      } else if (tf.status === "rejected") {
        title = "Từ chối điều chuyển"
        statusLabel = "Đã bị từ chối"
        severity = "critical"
      }

      return {
        id: `transfer-notif-${tf.id}`,
        title,
        message: `Mã ${reference}: Điều chuyển ${itemsCount} mặt hàng từ kho "${fromWh}" sang kho "${toWh}". Trạng thái: ${statusLabel}.`,
        time: new Date(tfTime).toLocaleString("vi-VN"),
        category: "inventory" as const,
        severity,
        createdAt: tfTime,
        dismissible: true,
        href: routes?.transfer(tf),
      }
    })
}

function buildSalesOrderNotifications(orders: any[], routes?: NotificationRouteFactory): AppNotification[] {
  const recentWindowMs = 7 * 24 * 60 * 60 * 1000 // 7 days
  const now = Date.now()

  return orders
    .filter((o) => {
      const oTime = o.created_at ? new Date(o.created_at).getTime() : o.createdAt ? new Date(o.createdAt).getTime() : 0
      return oTime && (now - oTime <= recentWindowMs)
    })
    .map((o) => {
      const oTime = o.created_at ? new Date(o.created_at).getTime() : o.createdAt ? new Date(o.createdAt).getTime() : 0
      const customer = o.customer_name || o.customerName || "Khách lẻ"
      const totalAmount = o.final_total ?? o.finalTotal ?? o.total ?? 0
      const itemsCount = (o.items || []).reduce((acc: number, item: any) => acc + (item.qty || item.quantity || 1), 0)

      let title = "Đơn bán hàng"
      let severity: NotificationSeverity = "info"
      let statusLabel = ""

      if (o.status === "pending") {
        title = "Đơn bán hàng chờ duyệt"
        statusLabel = "Chờ duyệt"
        severity = "warning"
      } else if (o.status === "approved") {
        title = "Đơn hàng đã được duyệt"
        statusLabel = "Đã duyệt, chờ xuất kho"
        severity = "info"
      } else if (o.status === "exported") {
        title = "Đơn hàng đã xuất kho"
        statusLabel = "Đã xuất kho"
        severity = "info"
      } else if (o.status === "completed") {
        title = "Đơn hàng hoàn tất"
        statusLabel = "Đã hoàn thành"
        severity = "info"
      } else if (o.status === "rejected" || o.status === "cancelled") {
        title = "Đơn hàng bị từ chối/hủy"
        statusLabel = "Đã hủy"
        severity = "critical"
      }

      return {
        id: `sales-order-${o.id}`,
        title,
        message: `Mã ${formatSalesOrderReference(o.orderCode || o.order_code || o.sales_code || o.code || o.id, o.created_at || o.createdAt)}: Khách ${customer} mua ${itemsCount} sản phẩm. Tổng tiền: ${formatVND(totalAmount)}. Trạng thái: ${statusLabel}.`,
        time: new Date(oTime).toLocaleString("vi-VN"),
        category: "sales" as const,
        severity,
        createdAt: oTime,
        dismissible: true,
        href: routes?.sales(o),
      }
    })
}

function buildLowStockNotifications(lowStockItems: any[], routes?: NotificationRouteFactory): AppNotification[] {
  return lowStockItems.map((item) => {
    const name = item.product_name || item.name || ""
    const sku = item.sku || ""
    const quantity = item.quantity ?? item.available ?? 0
    return {
      id: `low-stock-${recordWarehouseId(item) ?? "all"}-${sku}`,
      title: "Cảnh báo hết hàng / tồn thấp",
      message: `Sản phẩm "${name}" (${sku}) sắp hết hàng. Hiện chỉ còn ${quantity} trong kho. Hãy lên kế hoạch tạo đơn PO nhập thêm hàng.`,
      time: "Cập nhật thực tế",
      category: "inventory" as const,
      severity: "critical" as const,
      createdAt: Date.now(),
      dismissible: false,
      href: routes?.lowStock(item),
    }
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
    missed_checkin: { label: "Chưa check-in", className: "bg-red-100 text-red-800 border-red-200", icon: <AlertTriangle className="h-3 w-3" /> },
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

export function NotificationBell() {
  const { user } = useAuth()
  const router = useRouter()
  const [notifs, setNotifs] = useState<AppNotification[]>([])
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<NotificationCategory | "all">("all")
  
  const unreadCount = notifs.length
  const dismissedSet = useMemo(() => new Set(dismissedIds), [dismissedIds])

  const loadNotifications = useCallback(async () => {
    if (!user || !["admin", "employee"].includes(user.role)) {
      setNotifs([])
      return
    }

    setIsLoading(true)
    try {
      const isAdmin = user.role === "admin"
      let scope: WarehouseScope | null = null
      let scopedBranchId: number | undefined

      if (!isAdmin) {
        const warehouseRes = await inventoryApi.getWarehouses().catch(() => ({ success: false, data: [] }))
        const warehouses = warehouseRes.success ? warehouseRes.data : []
        scope = resolveWarehouseScope(user, warehouses)

        if (!scope?.warehouseId) {
          setNotifs([])
          return
        }

        scopedBranchId = scope.branchId ?? undefined
      }

      const [bookingsRes, txRes, transfersRes, salesRes, lowStockRes] = await Promise.all([
        isAdmin || scopedBranchId
          ? bookingApi.getAll(scopedBranchId ? { branchId: scopedBranchId } : undefined).catch(() => ({ bookings: [] }))
          : Promise.resolve({ bookings: [] }),
        inventoryApi.getTransactions().catch(() => ({ success: false, data: [] })),
        transferApi.getAll().catch(() => ({ success: false, data: [] })),
        isAdmin || scopedBranchId
          ? salesOrderApi.getAll(scopedBranchId ? { branchId: scopedBranchId } : undefined).catch(() => ({ success: false, data: [] }))
          : Promise.resolve({ success: false, data: [] }),
        inventoryApi.getLowStock().catch(() => ({ success: false, data: [] })),
      ])

      const bookings = bookingsRes.bookings || []
      const rawTransactions = txRes.success ? txRes.data : []
      const rawTransfers = transfersRes.success ? transfersRes.data : []
      const rawSalesOrders = (salesRes as any)?.data || []
      const rawLowStockItems = lowStockRes.success ? lowStockRes.data : []

      const transactions = isAdmin ? rawTransactions : filterByWarehouseScope(rawTransactions, scope)
      const transfers = isAdmin ? rawTransfers : filterTransfersByWarehouseScope(rawTransfers, scope)
      const salesOrders = isAdmin ? rawSalesOrders : filterByBranchScope(rawSalesOrders, scope)
      const lowStockItems = isAdmin ? rawLowStockItems : filterByWarehouseScope(rawLowStockItems, scope)
      const routes = createNotificationRoutes(user, scope)

      const generated = [
        ...buildCheckinNotifications(bookings, new Date(), routes),
        ...buildCancellationNotifications(bookings, new Date(), routes),
        ...buildInventoryNotifications(transactions, routes),
        ...buildTransferNotifications(transfers, routes),
        ...buildSalesOrderNotifications(salesOrders, routes),
        ...buildLowStockNotifications(lowStockItems, routes),
      ].sort((a, b) => {
        const severityOrder: Record<NotificationSeverity, number> = { critical: 0, warning: 1, info: 2 }
        return severityOrder[a.severity] - severityOrder[b.severity] || b.createdAt - a.createdAt
      })

      setNotifs(generated.filter((item) => item.severity === "critical" || !dismissedSet.has(item.id)))
    } catch (error) {
      console.error("Failed to load notifications", error)
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
    const refresh = () => loadNotifications()
    window.addEventListener("bh-notifications-refresh", refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("bh-notifications-refresh", refresh)
    }
  }, [loadNotifications])

  const persistDismissedIds = (nextIds: string[]) => {
    setDismissedIds(nextIds)
    localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(nextIds))
  }

  const dismissNotification = (id: string) => {
    persistDismissedIds(Array.from(new Set([...dismissedIds, id])))
    setNotifs((current) => current.filter((item) => item.id !== id || !item.dismissible))
  }

  const openNotification = (item: AppNotification) => {
    if (!item.href) return
    router.push(item.href)
  }

  const dismissWarnings = () => {
    const warningIds = notifs.filter((item) => item.dismissible).map((item) => item.id)
    if (warningIds.length === 0) return

    persistDismissedIds(Array.from(new Set([...dismissedIds, ...warningIds])))
    setNotifs((current) => current.filter((item) => !item.dismissible))
  }

  const filteredNotifs = useMemo(() => {
    if (activeCategory === "all") return notifs
    return notifs.filter((item) => item.category === activeCategory)
  }, [notifs, activeCategory])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-muted transition-all duration-200 active:scale-95" aria-label="Thông báo">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-pulse-green">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] max-w-[calc(100vw-1.5rem)] p-0 shadow-lg border border-border/60 bg-popover/95 backdrop-blur-md rounded-xl overflow-hidden animate-fade-in-up" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/10">
          <div>
            <h4 className="font-semibold text-sm">Thông báo</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLoading ? "Đang cập nhật..." : `${unreadCount} thông báo cần xử lý`}
            </p>
          </div>
          <button
            onClick={dismissWarnings}
            disabled={!notifs.some((item) => item.dismissible)}
            className="text-xs text-primary font-medium hover:underline disabled:pointer-events-none disabled:text-muted-foreground transition-colors"
          >
            Bỏ qua cảnh báo
          </button>
        </div>

        {/* Tab Filter Pills */}
        <div className="flex flex-wrap gap-1.5 p-3 border-b bg-muted/5">
          {(["all", ...Object.keys(categoryMeta)] as (NotificationCategory | "all")[]).map((category) => {
            const count = category === "all"
              ? notifs.length
              : notifs.filter((item) => item.category === category).length
            
            const meta = category !== "all" ? categoryMeta[category] : null
            const label = category === "all" ? "Tất cả" : meta!.label
            const isActive = activeCategory === category

            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 active:scale-95",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "bg-background border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {meta && <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClassName)} />}
                <span>{label}</span>
                <span className={cn(
                  "text-[10px] rounded-full px-1.5 py-0.2 ml-0.5",
                  isActive ? "bg-primary-foreground/25 text-primary-foreground" : "bg-muted text-muted-foreground/80"
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Notifications List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40 scrollbar-thin">
          {filteredNotifs.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center">
              <div className="p-3 rounded-full bg-emerald-50 text-emerald-500 mb-3 animate-pulse-green">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">Hộp thư trống</p>
              <p className="text-xs text-muted-foreground mt-1 px-4 leading-relaxed">
                Các thông báo về check-in, đơn hàng mới, điều chuyển kho hay tồn kho sắp hết sẽ hiển thị ở đây.
              </p>
            </div>
          ) : (
            filteredNotifs.map((item) => {
              const severity = severityMeta[item.severity]
              const catMeta = categoryMeta[item.category]
              return (
                <div
                  key={item.id}
                  role={item.href ? "button" : undefined}
                  tabIndex={item.href ? 0 : undefined}
                  onClick={() => openNotification(item)}
                  onKeyDown={(event) => {
                    if (!item.href) return
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      openNotification(item)
                    }
                  }}
                  className={cn(
                    "border-l-4 p-3.5 transition-all duration-200 hover:bg-muted/40 relative group",
                    item.href && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-1",
                    item.severity === "critical"
                      ? "border-l-red-500 bg-red-50/25"
                      : item.severity === "warning"
                        ? "border-l-amber-500 bg-amber-50/25"
                        : "border-l-blue-500 bg-blue-50/25"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="mt-0.5 shrink-0">
                      {item.severity === "critical" ? (
                        <div className="p-1 rounded-full bg-red-100 dark:bg-red-950/40">
                          <XCircle className="h-3.5 w-3.5 text-red-600" />
                        </div>
                      ) : item.severity === "warning" ? (
                        <div className="p-1 rounded-full bg-amber-100 dark:bg-amber-950/40">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                      ) : (
                        <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-950/40">
                          <Bell className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground leading-none">
                          {item.title}
                        </span>
                        <Badge variant="outline" className={cn("h-4 px-1 text-[9px] font-medium leading-none shrink-0", severity.badgeClassName)}>
                          {severity.label}
                        </Badge>
                        <Badge variant="secondary" className="h-4 px-1 text-[9px] font-medium leading-none shrink-0 bg-muted/65 text-muted-foreground border-none">
                          {catMeta.label}
                        </Badge>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {item.message}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3 inline" />
                          {item.time}
                        </span>
                        {item.dismissible && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              dismissNotification(item.id)
                            }}
                            className="text-[10px] font-medium px-2 py-0.5 rounded border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-85 group-hover:opacity-100"
                          >
                            Bỏ qua
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
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
