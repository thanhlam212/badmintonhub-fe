"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Package, Truck, Search, Eye, CheckCircle2, Clock, PackageCheck,
  ArrowUpFromLine, MapPin, Phone, Mail, AlertCircle, RefreshCw, XCircle, Store, Warehouse
} from "lucide-react"
import { useState, useEffect } from "react"
import { formatVND } from "@/lib/utils"
import { orderApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useInventory } from "@/lib/inventory-context"

interface OrderItem {
  productId: number
  name: string
  price: number
  qty: number
}

interface Order {
  id: string
  items: OrderItem[]
  customer: { name: string; phone: string; email: string; address: string }
  note: string
  subtotal: number
  shippingFee: number
  total: number
  paymentMethod: string
  status: "pending" | "processing" | "shipping" | "delivered" | "cancelled"
  createdAt: string
  userId: string
  type: "online"
  deliveryMethod?: "delivery" | "pickup"
  pickupBranch?: number
  pickupBranchName?: string
  fulfillingWarehouse?: string
  customerCoords?: { lat: number; lng: number }
  processedAt?: string
  shippedAt?: string
  deliveredAt?: string
  approvedBy?: string
  approvedAt?: string
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Chờ xử lý", color: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="h-3.5 w-3.5" /> },
  processing: { label: "Đang xử lý", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Package className="h-3.5 w-3.5" /> },
  shipping: { label: "Đang giao", color: "bg-purple-100 text-purple-800 border-purple-200", icon: <Truck className="h-3.5 w-3.5" /> },
  delivered: { label: "Đã giao", color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  cancelled: { label: "Đã hủy", color: "bg-red-100 text-red-800 border-red-200", icon: <XCircle className="h-3.5 w-3.5" /> },
}

const paymentLabels: Record<string, string> = {
  cod: "COD",
  momo: "MoMo",
  vnpay: "VNPay",
  bank: "Chuyển khoản",
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.pending
  return (
    <Badge variant="outline" className={cn("gap-1", cfg.color)}>
      {cfg.icon} {cfg.label}
    </Badge>
  )
}

function OrderDetailDialog({ order, onApprove, onStartDelivery, onDeliver, onCancel, inventoryData }: {
  order: Order
  onApprove: (warehouse: string) => void
  onStartDelivery: () => void
  onDeliver: () => void
  onCancel: () => void
  inventoryData?: { sku: string; name: string; warehouse: string; available: number }[]
}) {
  const [selectedWarehouse, setSelectedWarehouse] = useState(order.fulfillingWarehouse || "")

  // Tính tồn kho theo từng kho cho sản phẩm trong đơn
  const ALL_WAREHOUSES = ["Kho Cầu Giấy", "Kho Thanh Xuân", "Kho Long Biên", "Kho Hub"]

  // Build productId → sku mapping from inventory data
  const productIdToSkuMap: Record<number, string> = {}
  if (inventoryData) {
    for (const inv of inventoryData) {
      if (inv.sku) productIdToSkuMap[parseInt(inv.sku)] = inv.sku
    }
  }

  const orderSkus = order.items.map(item => ({
    productId: item.productId,
    name: item.name,
    sku: productIdToSkuMap[item.productId] || String(item.productId),
    qtyNeeded: item.qty,
  })).filter(i => i.sku)

  // Kiểm tra mỗi kho có đủ hàng cho tất cả sản phẩm không
  const getWarehouseStock = (warehouse: string) => {
    if (!inventoryData) return { items: [] as { name: string; available: number; needed: number; enough: boolean }[], allEnough: false }
    const items = orderSkus.map(os => {
      const inv = inventoryData.find(i => i.sku === os.sku && i.warehouse === warehouse)
      const available = inv?.available ?? 0
      return { name: os.name, available, needed: os.qtyNeeded, enough: available >= os.qtyNeeded }
    })
    return { items, allEnough: items.every(i => i.enough) }
  }

  // Tự động chọn kho đã gán (kho gần khách) — nếu đủ hàng thì dùng luôn
  useEffect(() => {
    if (order.status !== "pending" || order.deliveryMethod === "pickup" || !inventoryData) return
    if (selectedWarehouse && getWarehouseStock(selectedWarehouse).allEnough) return

    // Ưu tiên kho đã gán từ checkout (gần khách nhất), rồi thử các kho khác
    const assigned = order.fulfillingWarehouse
    if (assigned && getWarehouseStock(assigned).allEnough) {
      setSelectedWarehouse(assigned)
      return
    }
    // Thử kho khác có đủ hàng
    const bestAlt = ALL_WAREHOUSES.find(w => getWarehouseStock(w).allEnough)
    if (bestAlt) {
      setSelectedWarehouse(bestAlt)
    } else if (!selectedWarehouse && assigned) {
      setSelectedWarehouse(assigned)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, inventoryData])

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-serif text-xl flex items-center gap-2">
          Đơn hàng {order.id}
          <StatusBadge status={order.status} />
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 mt-2">
        {/* Customer Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Thông tin khách hàng
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Họ tên</p>
              <p className="font-semibold">{order.customer.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">SĐT</p>
              <p className="font-semibold flex items-center gap-1">
                <Phone className="h-3 w-3" /> {order.customer.phone}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Email</p>
              <p className="font-semibold flex items-center gap-1">
                <Mail className="h-3 w-3" /> {order.customer.email}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Địa chỉ giao hàng</p>
              <p className="font-semibold">{order.customer.address}</p>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Sản phẩm ({order.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left py-2 px-3 font-semibold text-xs">Sản phẩm</th>
                    <th className="text-center py-2 px-3 font-semibold text-xs">SL</th>
                    <th className="text-right py-2 px-3 font-semibold text-xs">Đơn giá</th>
                    <th className="text-right py-2 px-3 font-semibold text-xs">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map(item => (
                    <tr key={item.productId} className="border-t">
                      <td className="py-2 px-3">{item.name}</td>
                      <td className="py-2 px-3 text-center">{item.qty}</td>
                      <td className="py-2 px-3 text-right">{formatVND(item.price)}</td>
                      <td className="py-2 px-3 text-right font-semibold">{formatVND(item.price * item.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tạm tính</span>
                <span>{formatVND(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vận chuyển</span>
                <span>{order.shippingFee === 0 ? "Miễn phí" : formatVND(order.shippingFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Thanh toán</span>
                <span>{paymentLabels[order.paymentMethod] || order.paymentMethod}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Tổng cộng</span>
                <span className="text-primary">{formatVND(order.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {order.note && (
          <div className="p-3 rounded-lg bg-muted text-sm">
            <span className="font-semibold">Ghi chú:</span> {order.note}
          </div>
        )}

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Lịch sử đơn hàng</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="font-semibold">Đặt hàng thành công</p>
                  <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString("vi-VN")}</p>
                </div>
              </div>
              {order.processedAt && (
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Package className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold">Đã xuất kho</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.processedAt).toLocaleString("vi-VN")}</p>
                  </div>
                </div>
              )}
              {order.shippedAt && (
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Truck className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold">NV giao vận đang giao hàng</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.shippedAt).toLocaleString("vi-VN")}</p>
                  </div>
                </div>
              )}
              {order.deliveredAt && (
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                    <PackageCheck className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold">Giao hàng thành công</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.deliveredAt).toLocaleString("vi-VN")}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>


      </div>

      {/* Warehouse stock overview + selector for pending orders */}
      {order.status === "pending" && order.deliveryMethod !== "pickup" && inventoryData && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <Warehouse className="h-4 w-4" /> Tồn kho theo từng kho
            </p>

            {/* Stock matrix table */}
            <div className="rounded-lg border border-blue-200 overflow-hidden bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-blue-100/60">
                    <th className="text-left py-2 px-2 font-semibold">Sản phẩm</th>
                    <th className="text-center py-2 px-1 font-semibold">Cần</th>
                    {ALL_WAREHOUSES.map(w => (
                      <th key={w} className="text-center py-2 px-1 font-semibold">
                        {w.replace("Kho ", "")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orderSkus.map(os => (
                    <tr key={os.sku} className="border-t border-blue-100">
                      <td className="py-1.5 px-2 max-w-[180px] truncate" title={os.name}>{os.name}</td>
                      <td className="py-1.5 px-1 text-center font-semibold">{os.qtyNeeded}</td>
                      {ALL_WAREHOUSES.map(w => {
                        const inv = inventoryData.find(i => i.sku === os.sku && i.warehouse === w)
                        const avail = inv?.available ?? 0
                        const enough = avail >= os.qtyNeeded
                        return (
                          <td key={w} className={cn(
                            "py-1.5 px-1 text-center font-mono font-semibold",
                            avail === 0 ? "text-red-500 bg-red-50" :
                            !enough ? "text-amber-600 bg-amber-50" :
                            "text-green-600 bg-green-50"
                          )}>
                            {avail}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-blue-200 bg-blue-50/50">
                    <td colSpan={2} className="py-1.5 px-2 font-semibold text-xs">Đủ hàng?</td>
                    {ALL_WAREHOUSES.map(w => {
                      const ws = getWarehouseStock(w)
                      return (
                        <td key={w} className="py-1.5 px-1 text-center">
                          {ws.allEnough ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-400 mx-auto" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Warehouse selector */}
            <div className="pt-1">
              <p className="text-xs text-blue-700 mb-2">Chọn kho xuất hàng:</p>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn kho xuất" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_WAREHOUSES.map(w => {
                    const ws = getWarehouseStock(w)
                    return (
                      <SelectItem key={w} value={w}>
                        <span className="flex items-center gap-2">
                          {w}
                          {ws.allEnough ? (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Đủ hàng</span>
                          ) : (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Thiếu hàng</span>
                          )}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              {selectedWarehouse && !getWarehouseStock(selectedWarehouse).allEnough && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Kho này thiếu hàng cho một số sản phẩm. Vận chuyển sẽ đi từ kho {selectedWarehouse}.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <DialogFooter className="gap-2 mt-4">
        {order.status === "pending" && (
          <>
            <Button
              onClick={() => onApprove(selectedWarehouse)}
              disabled={!selectedWarehouse && order.deliveryMethod !== "pickup"}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1"
            >
              <ArrowUpFromLine className="h-4 w-4" /> Duyệt & Xuất kho
            </Button>
            <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={onCancel}>
              <XCircle className="h-4 w-4 mr-1" /> Hủy đơn
            </Button>
          </>
        )}
        {order.status === "processing" && order.deliveryMethod !== "pickup" && (
          <Button onClick={onStartDelivery} className="bg-purple-600 hover:bg-purple-700 text-white gap-1">
            <Truck className="h-4 w-4" /> Bắt đầu giao hàng
          </Button>
        )}
        {order.status === "processing" && order.deliveryMethod === "pickup" && (
          <Button onClick={onDeliver} className="bg-green-600 hover:bg-green-700 text-white gap-1">
            <PackageCheck className="h-4 w-4" /> Xác nhận khách đã nhận
          </Button>
        )}
        {order.status === "shipping" && (
          <Button onClick={onDeliver} className="bg-green-600 hover:bg-green-700 text-white gap-1">
            <PackageCheck className="h-4 w-4" /> Xác nhận đã giao
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  )
}

export default function EmployeeOrdersPage() {
  const { user } = useAuth()
  const { inventory } = useInventory()
  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadOrders = async () => {
    try {
      const res = await orderApi.getAll()
      if (res.orders) {
        const allOrders: Order[] = res.orders.map((o: any) => ({
          id: String(o.id),
          items: (o.items || []).map((i: any) => ({ productId: i.productId || i.product_id, name: i.productName || i.name || "", price: i.price || 0, qty: i.quantity || i.qty || 0 })),
          customer: { name: o.customerName || "", phone: o.customerPhone || "", email: o.customerEmail || "", address: o.shippingAddress || "" },
          note: o.note || "", subtotal: o.amount || 0, shippingFee: 0, total: o.amount || 0,
          paymentMethod: o.paymentMethod || "", status: o.status || "pending", createdAt: o.createdAt || "",
          userId: o.userId || "", type: "online" as const, deliveryMethod: "delivery" as const,
          fulfillingWarehouse: o.fulfillingWarehouse || "",
        }))
        const myWarehouse = user?.warehouse
        if (myWarehouse) {
          setOrders(allOrders.filter(o => o.fulfillingWarehouse === myWarehouse || !o.fulfillingWarehouse))
        } else {
          setOrders(allOrders)
        }
      }
    } catch {}
  }

  useEffect(() => {
    loadOrders()
    // Poll for new orders every 5 seconds
    const interval = setInterval(loadOrders, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const updateOrderStatus = async (orderId: string, updates: Partial<Order>) => {
    try {
      if (updates.status) {
        await orderApi.updateStatus(orderId, updates.status)
      }
    } catch {}
    const updated = orders.map(o => o.id === orderId ? { ...o, ...updates } : o)
    setOrders(updated)
    setSelectedOrder(updated.find(o => o.id === orderId) || null)
  }

  const handleProcess = (orderId: string, warehouse?: string) => {
    const updates: Partial<Order> = {
      status: "processing",
      processedAt: new Date().toISOString(),
      approvedBy: user?.fullName || "Nhân viên",
      approvedAt: new Date().toISOString(),
    }
    if (warehouse) {
      updates.fulfillingWarehouse = warehouse
    }
    updateOrderStatus(orderId, updates)
  }

  const handleStartDelivery = (orderId: string) => {
    updateOrderStatus(orderId, {
      status: "shipping",
      shippedAt: new Date().toISOString(),
    })
  }

  const handleDeliver = (orderId: string) => {
    updateOrderStatus(orderId, {
      status: "delivered",
      deliveredAt: new Date().toISOString(),
    })
  }

  const handleCancel = (orderId: string) => {
    updateOrderStatus(orderId, { status: "cancelled" })
  }

  const filteredOrders = orders.filter(o => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return o.id.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.phone.includes(q)
  })

  const pendingOrders = filteredOrders.filter(o => o.status === "pending")
  const processingOrders = filteredOrders.filter(o => o.status === "processing")
  const shippingOrders = filteredOrders.filter(o => o.status === "shipping")
  const completedOrders = filteredOrders.filter(o => ["delivered", "cancelled"].includes(o.status))

  const stats = {
    pending: orders.filter(o => o.status === "pending").length,
    processing: orders.filter(o => o.status === "processing").length,
    shipping: orders.filter(o => o.status === "shipping").length,
    delivered: orders.filter(o => o.status === "delivered").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-extrabold text-slate-800">Quản lý đơn hàng</h1>
          <p className="text-sm text-slate-500 mt-1">Nhận đơn online, duyệt đơn và xuất kho</p>
        </div>
        <Button variant="outline" onClick={loadOrders} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Làm mới
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Chờ xử lý", value: stats.pending, color: "text-amber-600 bg-amber-50 border-amber-200", icon: <Clock className="h-5 w-5" /> },
          { label: "Đang xử lý", value: stats.processing, color: "text-blue-600 bg-blue-50 border-blue-200", icon: <Package className="h-5 w-5" /> },
          { label: "Đang giao", value: stats.shipping, color: "text-purple-600 bg-purple-50 border-purple-200", icon: <Truck className="h-5 w-5" /> },
          { label: "Đã giao", value: stats.delivered, color: "text-green-600 bg-green-50 border-green-200", icon: <CheckCircle2 className="h-5 w-5" /> },
        ].map(s => (
          <Card key={s.label} className={cn("border", s.color.split(" ").pop())}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", s.color)}>
                {s.icon}
              </div>
              <div>
                <p className="text-2xl font-extrabold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo mã đơn, tên KH, SĐT..."
          className="pl-10"
        />
      </div>

      {/* Orders tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            Chờ xử lý {stats.pending > 0 && <Badge className="bg-amber-500 text-white h-5 min-w-5 text-[10px]">{stats.pending}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="processing">Đang xử lý</TabsTrigger>
          <TabsTrigger value="shipping">Đang giao</TabsTrigger>
          <TabsTrigger value="completed">Hoàn thành</TabsTrigger>
        </TabsList>

        {[
          { value: "pending", data: pendingOrders },
          { value: "processing", data: processingOrders },
          { value: "shipping", data: shippingOrders },
          { value: "completed", data: completedOrders },
        ].map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {tab.data.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-semibold text-muted-foreground">Chưa có đơn hàng nào</p>
                  <p className="text-sm text-muted-foreground mt-1">Đơn hàng mới sẽ hiển thị ở đây</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tab.data.map(order => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        {/* Order info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-primary">{order.id}</span>
                            <StatusBadge status={order.status} />
                            {order.deliveryMethod === "pickup" ? (
                              <Badge variant="outline" className="gap-1 text-xs bg-orange-50 text-orange-700 border-orange-200">
                                <Store className="h-3 w-3" /> Nhận tại CH
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                                <Truck className="h-3 w-3" /> Giao tận nơi
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {paymentLabels[order.paymentMethod] || order.paymentMethod}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                            <span>{order.customer.name}</span>
                            <span>{order.customer.phone}</span>
                            <span>{new Date(order.createdAt).toLocaleString("vi-VN")}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {order.items.map(i => `${i.name} x${i.qty}`).join(", ")}
                          </p>
                          {order.fulfillingWarehouse && (
                            <Badge variant="secondary" className="text-[10px] font-normal gap-1 mt-1">
                              <Warehouse className="h-3 w-3" />
                              {order.fulfillingWarehouse}
                            </Badge>
                          )}
                        </div>

                        {/* Amount & Actions */}
                        <div className="flex items-center gap-3 shrink-0">
                          <p className="font-serif font-bold text-primary text-lg">{formatVND(order.total)}</p>

                          <Dialog open={dialogOpen && selectedOrder?.id === order.id} onOpenChange={(open) => {
                            setDialogOpen(open)
                            if (!open) setSelectedOrder(null)
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => { setSelectedOrder(order); setDialogOpen(true) }}
                              >
                                <Eye className="h-4 w-4" /> Chi tiết
                              </Button>
                            </DialogTrigger>
                            {selectedOrder && selectedOrder.id === order.id && (
                              <OrderDetailDialog
                                order={selectedOrder}
                                onApprove={(wh) => handleProcess(order.id, wh)}
                                onStartDelivery={() => handleStartDelivery(order.id)}
                                onDeliver={() => handleDeliver(order.id)}
                                onCancel={() => handleCancel(order.id)}
                                inventoryData={inventory.map(i => ({ sku: i.sku, name: i.name, warehouse: i.warehouse, available: i.available }))}
                              />
                            )}
                          </Dialog>

                          {/* Quick actions */}
                          {order.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => { setSelectedOrder(order); setDialogOpen(true) }}
                              className="bg-blue-600 hover:bg-blue-700 text-white gap-1"
                            >
                              <ArrowUpFromLine className="h-4 w-4" /> Duyệt đơn
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
