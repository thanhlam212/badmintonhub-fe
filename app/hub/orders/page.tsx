"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog"
import {
  Package, Truck, Search, Eye, CheckCircle2, Clock, PackageCheck,
  ArrowUpFromLine, MapPin, Phone, Mail, AlertCircle, RefreshCw, XCircle,
  Store, Warehouse, Navigation, Printer, Award
} from "lucide-react"
import { useState, useEffect } from "react"
import { formatVND, formatHDReference } from "@/lib/utils"
import { orderApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { findNearestWarehouse, getWarehousesByDistance, loadBranches } from "@/lib/nearest-warehouse"
import { useInventory } from "@/lib/inventory-context"
import { printWarehouseSlip, printWarrantyCard } from "@/lib/print-utils"

interface OrderItem {
  productId: number
  name: string
  price: number
  qty: number
}

interface Order {
  id: string
  rawId?: string
  items: OrderItem[]
  customer: { name: string; phone: string; email: string; address: string }
  note: string
  subtotal: number
  shippingFee: number
  total: number
  paymentMethod: string
  status: "pending" | "confirmed" | "processing" | "shipping" | "delivered" | "cancelled" | "refunded"
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
  pending: { label: "Chờ duyệt", color: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="h-3.5 w-3.5" /> },
  processing: { label: "Đang xử lý", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Package className="h-3.5 w-3.5" /> },
  shipping: { label: "Đang giao", color: "bg-purple-100 text-purple-800 border-purple-200", icon: <Truck className="h-3.5 w-3.5" /> },
  delivered: { label: "Hoàn thành", color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
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

function DeliveryMethodBadge({ order }: { order: Order }) {
  if (order.deliveryMethod === "pickup") {
    return (
      <Badge variant="outline" className="gap-1 bg-orange-50 text-orange-700 border-orange-200">
        <Store className="h-3 w-3" /> Nhận tại cửa hàng
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 bg-indigo-50 text-indigo-700 border-indigo-200">
      <Truck className="h-3 w-3" /> Giao tận nơi
    </Badge>
  )
}

function OrderDetailDialog({ order, onApprove, onStartDelivery, onDeliver, onCancel, inventoryData }: {
  order: Order
  onApprove: (warehouse: string) => void
  onStartDelivery: () => void
  onDeliver: () => void
  onCancel: () => void
  inventoryData?: { productId?: number; sku: string; name: string; warehouse: string; available: number }[]
}) {
  const [selectedWarehouse, setSelectedWarehouse] = useState(order.fulfillingWarehouse || "")

  // Show nearest warehouses for delivery orders
  const nearestWarehouses = order.customerCoords
    ? getWarehousesByDistance(order.customerCoords.lat, order.customerCoords.lng)
    : []

  const ALL_WAREHOUSES = ["Kho Cầu Giấy", "Kho Thanh Xuân", "Kho Long Biên", "Kho Hub"]

  // Build productId → sku mapping from inventory data
  const productIdToSku: Record<number, string> = {}
  if (inventoryData) {
    for (const inv of inventoryData) {
      if (inv.productId) {
        productIdToSku[inv.productId] = inv.sku
      }
    }
  }

  const orderSkus = order.items.map(item => ({
    productId: item.productId,
    name: item.name,
    sku: productIdToSku[item.productId] || String(item.productId),
    qtyNeeded: item.qty,
  })).filter(i => i.sku)

  const getWarehouseStock = (warehouse: string) => {
    if (!inventoryData) return { items: [] as { name: string; available: number; needed: number; enough: boolean }[], allEnough: false }
    const items = orderSkus.map(os => {
      const inv = inventoryData.find(i => i.sku === os.sku && i.warehouse === warehouse)
      const available = inv?.available ?? 0
      return { name: os.name, available, needed: os.qtyNeeded, enough: available >= os.qtyNeeded }
    })
    return { items, allEnough: items.every(i => i.enough) }
  }

  // Tự động chọn kho tốt nhất: ưu tiên kho gần nhất có đủ hàng, nếu không thì kho gần nhất bất kỳ
  useEffect(() => {
    if ((order.status !== "pending" && order.status !== "confirmed") || order.deliveryMethod === "pickup" || !inventoryData) return
    if (selectedWarehouse && getWarehouseStock(selectedWarehouse).allEnough) return // đã chọn kho đủ hàng

    // Thứ tự ưu tiên: kho gần nhất đủ hàng > kho bất kỳ đủ hàng > kho gần nhất (đơn gán sẵn)
    const warehouseOrder = nearestWarehouses.length > 0
      ? [...nearestWarehouses.map(w => w.warehouseName), "Kho Hub"]
      : ALL_WAREHOUSES

    const bestWarehouse = warehouseOrder.find(w => getWarehouseStock(w).allEnough)
    if (bestWarehouse) {
      setSelectedWarehouse(bestWarehouse)
    } else if (!selectedWarehouse && order.fulfillingWarehouse) {
      setSelectedWarehouse(order.fulfillingWarehouse)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, inventoryData])

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-serif text-xl flex items-center gap-2 flex-wrap">
          Đơn hàng {order.id}
          <StatusBadge status={order.status} />
          <DeliveryMethodBadge order={order} />
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 mt-2">
        {/* Fulfilling warehouse info */}
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-lg border",
          order.deliveryMethod === "pickup" ? "bg-orange-50 border-orange-200" : "bg-indigo-50 border-indigo-200"
        )}>
          <Warehouse className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              {order.deliveryMethod === "pickup"
                ? `Nhận tại: ${order.pickupBranchName || "Chi nhánh"}`
                : `Kho xuất: ${order.fulfillingWarehouse || "Chưa xác định"}`
              }
            </p>
            {order.deliveryMethod === "delivery" && nearestWarehouses.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Khoảng cách: {nearestWarehouses[0]?.distance.toFixed(1)} km từ khách hàng
              </p>
            )}
          </div>
        </div>

        {/* Distance table for delivery orders */}
        {order.deliveryMethod === "delivery" && nearestWarehouses.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Navigation className="h-4 w-4 text-primary" /> Khoảng cách đến các kho
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {nearestWarehouses.map((w, i) => (
                  <div key={w.warehouseName} className={cn(
                    "flex items-center justify-between p-2 rounded text-sm",
                    i === 0 ? "bg-green-50 border border-green-200 font-semibold" : "bg-muted/50"
                  )}>
                    <div className="flex items-center gap-2">
                      {i === 0 && <Badge className="bg-green-600 text-white text-[10px] h-5">Gần nhất</Badge>}
                      <span>{w.warehouseName}</span>
                    </div>
                    <span className="text-muted-foreground">{w.distance.toFixed(1)} km</span>
                  </div>
                ))}
                <div className="flex items-center justify-between p-2 rounded text-sm bg-muted/50">
                  <span>Kho Hub (trung tâm)</span>
                  <span className="text-muted-foreground">Dự phòng</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
              <p className="text-muted-foreground text-xs">
                {order.deliveryMethod === "pickup" ? "Địa chỉ nhận hàng" : "Địa chỉ giao hàng"}
              </p>
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
              {order.approvedAt && (
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold">Đã duyệt đơn {order.approvedBy && `bởi ${order.approvedBy}`}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.approvedAt).toLocaleString("vi-VN")}</p>
                  </div>
                </div>
              )}
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
                    <p className="font-semibold">NV Hub đang giao hàng</p>
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
                    <p className="font-semibold">
                      {order.deliveryMethod === "pickup" ? "Khách đã nhận hàng" : "Giao hàng thành công"}
                    </p>
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
                    {ALL_WAREHOUSES.map(w => {
                      const dist = nearestWarehouses.find(nw => nw.warehouseName === w)
                      return (
                        <th key={w} className="text-center py-2 px-1 font-semibold">
                          <div>{w.replace("Kho ", "")}</div>
                          {dist && <div className="text-[9px] font-normal text-muted-foreground">{dist.distance.toFixed(1)}km</div>}
                        </th>
                      )
                    })}
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

            {/* Warehouse selector with distance info */}
            <div className="pt-1">
              <p className="text-xs text-blue-700 mb-2">Chọn kho xuất hàng:</p>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn kho xuất" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_WAREHOUSES.map(w => {
                    const ws = getWarehouseStock(w)
                    const dist = nearestWarehouses.find(nw => nw.warehouseName === w)
                    return (
                      <SelectItem key={w} value={w}>
                        <span className="flex items-center gap-2">
                          {w}
                          {dist && <span className="text-[10px] text-muted-foreground">{dist.distance.toFixed(1)}km</span>}
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
                  Kho này thiếu hàng cho một số sản phẩm. Giao vận sẽ đi từ kho {selectedWarehouse}.
                </p>
              )}
              {nearestWarehouses.length > 0 && selectedWarehouse && selectedWarehouse !== nearestWarehouses[0]?.warehouseName && getWarehouseStock(selectedWarehouse).allEnough && (
                <p className="text-xs text-blue-600 mt-2">
                  ℹ Kho gần nhất là {nearestWarehouses[0]?.warehouseName} ({nearestWarehouses[0]?.distance.toFixed(1)} km) nhưng bạn đang chọn {selectedWarehouse}.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print actions bar - only when order is past pending */}
      {order.status !== "pending" && order.status !== "cancelled" && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
          <Printer className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground mr-auto">In chứng từ:</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs h-7"
            onClick={() => printWarehouseSlip({
              id: order.id,
              type: "export",
              date: new Date(order.processedAt || order.createdAt).toLocaleDateString("vi-VN"),
              warehouse: order.fulfillingWarehouse || "—",
              note: order.note || "",
              createdBy: order.approvedBy || "Hệ thống",
              assignedTo: order.customer.name,
              items: order.items.map(i => ({
                sku: productIdToSku[i.productId] || String(i.productId),
                name: i.name,
                qty: i.qty,
                unitCost: i.price,
              })),
            })}
          >
            <ArrowUpFromLine className="h-3.5 w-3.5" /> Phiếu xuất kho
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs h-7"
            onClick={() => printWarrantyCard({
              orderCode: order.id,
              date: order.createdAt,
              customerName: order.customer.name,
              customerPhone: order.customer.phone,
              customerEmail: order.customer.email,
              items: order.items.map(i => ({
                sku: productIdToSku[i.productId] || undefined,
                name: i.name,
                qty: i.qty,
                price: i.price,
              })),
            })}
          >
            <Award className="h-3.5 w-3.5" /> Phiếu bảo hành
          </Button>
        </div>
      )}

      <DialogFooter className="gap-2 mt-4">
        {(order.status === "pending" || order.status === "confirmed") && (
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

export default function HubOrdersPage() {
  const { user } = useAuth()
  const { inventory, refreshInventory } = useInventory()
  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [warehouseFilter, setWarehouseFilter] = useState("all")

  const loadOrders = async () => {
    try {
      const res = await orderApi.getAll()
      if (res.orders) {
        setOrders(res.orders.map((o: any) => {
          let fulfillingWarehouse = o.fulfillingWarehouse || ""
          if (o.fulfillingWarehouseId && !fulfillingWarehouse) {
            const wh = inventory.find(inv => inv.warehouseId === o.fulfillingWarehouseId)
            if (wh) fulfillingWarehouse = wh.warehouse
          }
          return {
            id: formatHDReference(o.orderCode || o.order_code || o.invoiceCode || o.invoice_code || o.sales_code || o.id, o.createdAt || o.created_at),
            rawId: String(o.id),
            items: (o.items || []).map((i: any) => ({ productId: i.productId || i.product_id, name: i.productName || i.name || "", price: i.price || 0, qty: i.quantity || i.qty || 0 })),
            customer: { name: o.customerName || "", phone: o.customerPhone || "", email: o.customerEmail || "", address: o.shippingAddress || "" },
            note: o.note || "", subtotal: o.totalAmount || 0, shippingFee: 0, total: o.totalAmount || 0,
            paymentMethod: o.paymentMethod || "", status: o.status || "pending", createdAt: o.createdAt || "",
            userId: o.userId || "", type: "online" as const, deliveryMethod: "delivery" as const,
            fulfillingWarehouse,
            customerCoords: o.customerCoords || undefined,
          }
        }))
      }
    } catch {}
  }

  useEffect(() => {
    loadBranches().then(() => loadOrders())
    const interval = setInterval(loadOrders, 5000)
    return () => clearInterval(interval)
  }, [])

  const updateOrderStatus = async (orderId: string, updates: Partial<Order>) => {
    const order = orders.find(o => o.id === orderId)
    const apiId = order?.rawId || orderId
    try {
      if (updates.status) {
        await orderApi.updateStatus(apiId, updates.status)
        if (updates.status === "processing" || updates.status === "cancelled") {
          refreshInventory().catch(() => {})
        }
      }
    } catch {}
    const updated = orders.map(o =>
      o.id === orderId ? { ...o, ...updates } : o
    )
    setOrders(updated)
    setSelectedOrder(updated.find(o => o.id === orderId) || null)
  }

  const handleApprove = (orderId: string, warehouse?: string) => {
    const updates: Partial<Order> = {
      status: "processing",
      processedAt: new Date().toISOString(),
      approvedBy: user?.fullName || "NV Hub",
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

  // Filter by search and warehouse
  const filteredOrders = orders.filter(o => {
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchSearch = o.id.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.phone.includes(q)
      if (!matchSearch) return false
    }
    // Warehouse filter
    if (warehouseFilter !== "all") {
      if (o.fulfillingWarehouse !== warehouseFilter) return false
    }
    return true
  })

  const pendingOrders = filteredOrders.filter(o => o.status === "pending" || o.status === "confirmed")
  const processingOrders = filteredOrders.filter(o => o.status === "processing")
  const shippingOrders = filteredOrders.filter(o => o.status === "shipping")
  const completedOrders = filteredOrders.filter(o => ["delivered", "cancelled"].includes(o.status))

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending" || o.status === "confirmed").length,
    processing: orders.filter(o => o.status === "processing").length,
    shipping: orders.filter(o => o.status === "shipping").length,
    delivered: orders.filter(o => o.status === "delivered").length,
    delivery: orders.filter(o => o.deliveryMethod === "delivery" || !o.deliveryMethod).length,
    pickup: orders.filter(o => o.deliveryMethod === "pickup").length,
  }

  const renderOrderCard = (order: Order) => (
    <Card key={order.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Order info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-primary">{order.id}</span>
              <StatusBadge status={order.status} />
              <DeliveryMethodBadge order={order} />
              <Badge variant="outline" className="text-xs">
                {paymentLabels[order.paymentMethod] || order.paymentMethod}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span>{order.customer.name}</span>
              <span>{order.customer.phone}</span>
              <span>{new Date(order.createdAt).toLocaleString("vi-VN")}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px] font-normal gap-1">
                <Warehouse className="h-3 w-3" />
                {order.fulfillingWarehouse || "Chưa xác định"}
              </Badge>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {order.items.map(i => `${i.name} x${i.qty}`).join(", ")}
              </p>
            </div>
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
                  onApprove={(wh) => handleApprove(order.id, wh)}
                  onStartDelivery={() => handleStartDelivery(order.id)}
                  onDeliver={() => handleDeliver(order.id)}
                  onCancel={() => handleCancel(order.id)}
                  inventoryData={inventory.map(i => ({ productId: i.productId, sku: i.sku, name: i.name, warehouse: i.warehouse, available: i.available }))}
                />
              )}
            </Dialog>

            {/* Quick actions */}
            {(order.status === "pending" || order.status === "confirmed") && (
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
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-extrabold text-slate-800">Quản lý đơn hàng online</h1>
          <p className="text-sm text-slate-500 mt-1">Duyệt đơn, xuất kho và quản lý giao vận từ tất cả chi nhánh</p>
        </div>
        <Button variant="outline" onClick={loadOrders} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Làm mới
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Chờ duyệt", value: stats.pending, color: "text-amber-600 bg-amber-50 border-amber-200", icon: <Clock className="h-5 w-5" /> },
          { label: "Đang xử lý", value: stats.processing, color: "text-blue-600 bg-blue-50 border-blue-200", icon: <Package className="h-5 w-5" /> },
          { label: "Đang giao", value: stats.shipping, color: "text-purple-600 bg-purple-50 border-purple-200", icon: <Truck className="h-5 w-5" /> },
          { label: "Hoàn thành", value: stats.delivered, color: "text-green-600 bg-green-50 border-green-200", icon: <CheckCircle2 className="h-5 w-5" /> },
          { label: "Nhận tại CH", value: stats.pickup, color: "text-orange-600 bg-orange-50 border-orange-200", icon: <Store className="h-5 w-5" /> },
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

      {/* Search + Warehouse filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã đơn, tên KH, SĐT..."
            className="pl-10"
          />
        </div>
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Lọc theo kho" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả kho</SelectItem>
            <SelectItem value="Kho Cầu Giấy">Kho Cầu Giấy</SelectItem>
            <SelectItem value="Kho Thanh Xuân">Kho Thanh Xuân</SelectItem>
            <SelectItem value="Kho Long Biên">Kho Long Biên</SelectItem>
            <SelectItem value="Kho Hub">Kho Hub</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            Chờ duyệt {stats.pending > 0 && <Badge className="bg-amber-500 text-white h-5 min-w-5 text-[10px]">{stats.pending}</Badge>}
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
                {tab.data.map(renderOrderCard)}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
