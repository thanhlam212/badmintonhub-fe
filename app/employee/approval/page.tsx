"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { formatVND, formatSalesOrderReference } from "@/lib/utils"
import { salesOrderApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useInventory } from "@/lib/inventory-context"
import {
  Search, CheckCircle2, XCircle, Clock, Eye, FileText,
  ArrowUpFromLine, Receipt, Package, AlertTriangle, Printer,
  DollarSign, ShoppingCart
} from "lucide-react"

/* ─── Types ─── */
interface CartItem {
  productId: number
  name: string
  price: number
  qty: number
}

interface SalesOrder {
  id: string
  rawId?: string
  date: string
  time: string
  customer: string
  phone: string
  items: CartItem[]
  total: number
  discount: number
  finalTotal: number
  paymentMethod: string
  note: string
  status: "pending" | "approved" | "rejected" | "exported"
  createdBy: string
  approvedAt?: string
  approvedBy?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectReason?: string
  exportSlipId?: string
}

interface ExportSlip {
  id: string
  orderId: string
  orderRawId?: string
  date: string
  items: { name: string; qty: number; price: number }[]
  total: number
  customer: string
  note: string
  status: "pending" | "completed"
  createdBy: string
  completedAt?: string
  completedBy?: string
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Chờ duyệt", color: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="h-3.5 w-3.5" /> },
  approved: { label: "Đã duyệt", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: "Từ chối", color: "bg-red-100 text-red-800 border-red-200", icon: <XCircle className="h-3.5 w-3.5" /> },
  exported: { label: "Đã xuất kho", color: "bg-green-100 text-green-800 border-green-200", icon: <Package className="h-3.5 w-3.5" /> },
}

const slipStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ xuất", color: "bg-amber-100 text-amber-800 border-amber-200" },
  completed: { label: "Đã xuất", color: "bg-green-100 text-green-800 border-green-200" },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.pending
  return <Badge variant="outline" className={cn("gap-1", cfg.color)}>{cfg.icon} {cfg.label}</Badge>
}

/* ─── Main Page ─── */
export default function ApprovalPage() {
  const { user } = useAuth()
  const { refreshInventory } = useInventory()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [exportSlips, setExportSlips] = useState<ExportSlip[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [rejectReason, setRejectReason] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null)

  // Load from API
  const loadData = async () => {
    try {
      const res = await salesOrderApi.getAll()
      if ((res as any).success && (res as any).data) {
        setOrders((res as any).data.map((o: any) => ({
          id: formatSalesOrderReference(o.sales_code || o.orderCode || o.order_code || o.code || o.id, o.created_at),
          rawId: String(o.id),
          date: o.created_at ? new Date(o.created_at).toISOString().split("T")[0] : "",
          time: o.created_at ? new Date(o.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "",
          customer: o.customer_name || "Khách lẻ", phone: o.customer_phone || "",
          items: (o.items || []).map((i: any) => ({ productId: i.product_id, name: i.product_name || i.name || "", price: i.price || 0, qty: i.qty || i.quantity || 0 })),
          total: o.total || 0, discount: o.discount || 0, finalTotal: o.final_total || o.total || 0,
          paymentMethod: o.payment_method || "", note: o.note || "",
          status: o.status || "pending", createdBy: o.created_by || "",
          approvedAt: o.approved_at, approvedBy: o.approved_by,
          rejectedAt: o.rejected_at, rejectedBy: o.rejected_by, rejectReason: o.reject_reason,
        })))
      }
    } catch {}
    // Export slips still from localStorage (no backend endpoint)
    try {
      const storedSlips = localStorage.getItem("exportSlips")
      if (storedSlips) setExportSlips(JSON.parse(storedSlips))
    } catch {}
  }
  useEffect(() => { loadData() }, [])

  // Save orders — update local state (API calls done per-action)
  const saveOrders = (updated: SalesOrder[]) => {
    setOrders(updated)
  }

  const saveSlips = (updated: ExportSlip[]) => {
    setExportSlips(updated)
    localStorage.setItem("exportSlips", JSON.stringify(updated))
  }

  // Filter
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q)
      }
      return true
    })
  }, [orders, statusFilter, search])

  // Stats
  const pendingCount = orders.filter(o => o.status === "pending").length
  const approvedCount = orders.filter(o => o.status === "approved").length
  const exportedCount = orders.filter(o => o.status === "exported").length
  const totalRevenue = orders
    .filter(o => o.status === "approved" || o.status === "exported")
    .reduce((s, o) => s + o.finalTotal, 0)

  // Approve order → call API then generate export slip
  const handleApprove = async (order: SalesOrder) => {
    try {
      const res = await salesOrderApi.approve(order.rawId || order.id)
      if (!res.success) { console.error("Approve failed:", res.error); return }
    } catch (err) { console.error("Approve error:", err); return }
    const now = new Date()
    const slipId = `PXK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(exportSlips.length + 1).padStart(3, "0")}`

    const slip: ExportSlip = {
      id: slipId,
      orderId: order.id,
      orderRawId: order.rawId || order.id,
      date: now.toISOString().split("T")[0],
      items: order.items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
      total: order.finalTotal,
      customer: order.customer,
      note: `Xuất kho theo đơn ${order.id}`,
      status: "pending",
      createdBy: user?.fullName || "Nhân viên",
    }

    const updatedOrders = orders.map(o =>
      o.id === order.id
        ? { ...o, status: "approved" as const, approvedAt: now.toISOString(), approvedBy: user?.fullName, exportSlipId: slipId }
        : o
    )

    const updatedSlips = [slip, ...exportSlips]

    saveOrders(updatedOrders)
    saveSlips(updatedSlips)
  }

  // Reject order
  const handleReject = async (order: SalesOrder, reason: string) => {
    try {
      await salesOrderApi.reject(order.rawId || order.id, reason)
    } catch {}
    const now = new Date()
    const updatedOrders = orders.map(o =>
      o.id === order.id
        ? { ...o, status: "rejected" as const, rejectedAt: now.toISOString(), rejectedBy: user?.fullName, rejectReason: reason }
        : o
    )
    saveOrders(updatedOrders)
    setRejectReason("")
  }

  // Complete export slip → update order status to "exported"
  const handleCompleteSlip = async (slip: ExportSlip) => {
    const now = new Date()
    // Call BE to mark order as exported
    try {
      const res = await salesOrderApi.complete(slip.orderRawId || slip.orderId)
      if (!res.success) {
        alert(res.error || "Không thể xuất kho. Vui lòng kiểm tra tồn kho và thử lại.")
        return
      }
      await refreshInventory().catch(() => {})
    } catch {
      alert("Không thể xuất kho. Vui lòng kiểm tra kết nối và thử lại.")
      return
    }

    const updatedSlips = exportSlips.map(s =>
      s.id === slip.id
        ? { ...s, status: "completed" as const, completedAt: now.toISOString(), completedBy: user?.fullName }
        : s
    )
    saveSlips(updatedSlips)

    // Update linked order
    const updatedOrders = orders.map(o =>
      o.id === slip.orderId
        ? { ...o, status: "exported" as const }
        : o
    )
    saveOrders(updatedOrders)

    // Save warehouse transaction to localStorage for inventory page
    const existingTxns = JSON.parse(localStorage.getItem("warehouseTransactions") || "[]")
    const newTxns = slip.items.map((item, i) => ({
      id: `${slip.id}-${i}`,
      type: "export",
      source: "sales",
      slipId: slip.id,
      orderId: slip.orderId,
      date: now.toISOString().split("T")[0],
      productName: item.name,
      qty: item.qty,
      price: item.price,
      note: slip.note,
      processedBy: user?.fullName,
    }))
    localStorage.setItem("warehouseTransactions", JSON.stringify([...newTxns, ...existingTxns]))
  }

  const pendingSlips = exportSlips.filter(s => s.status === "pending")
  const completedSlips = exportSlips.filter(s => s.status === "completed")

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Duyệt đơn hàng</h1>
          <p className="text-sm text-muted-foreground">Duyệt đơn bán hàng và quản lý phiếu xuất kho</p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="hover:-translate-y-0.5 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-lg bg-amber-100 text-amber-600"><Clock className="h-5 w-5" /></span>
            </div>
            <p className="font-serif text-2xl font-extrabold mt-3">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">Chờ duyệt</p>
          </CardContent>
        </Card>
        <Card className="hover:-translate-y-0.5 transition-all">
          <CardContent className="p-4">
            <span className="p-2 rounded-lg bg-blue-100 text-blue-600"><CheckCircle2 className="h-5 w-5" /></span>
            <p className="font-serif text-2xl font-extrabold mt-3">{approvedCount}</p>
            <p className="text-sm text-muted-foreground">Đã duyệt</p>
          </CardContent>
        </Card>
        <Card className="hover:-translate-y-0.5 transition-all">
          <CardContent className="p-4">
            <span className="p-2 rounded-lg bg-green-100 text-green-600"><Package className="h-5 w-5" /></span>
            <p className="font-serif text-2xl font-extrabold mt-3">{exportedCount}</p>
            <p className="text-sm text-muted-foreground">Đã xuất kho</p>
          </CardContent>
        </Card>
        <Card className="hover:-translate-y-0.5 transition-all">
          <CardContent className="p-4">
            <span className="p-2 rounded-lg bg-primary/10 text-primary"><DollarSign className="h-5 w-5" /></span>
            <p className="font-serif text-2xl font-extrabold mt-3">{formatVND(totalRevenue)}</p>
            <p className="text-sm text-muted-foreground">Doanh thu đã duyệt</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="mb-4">
          <TabsTrigger value="orders" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Đơn hàng
            {pendingCount > 0 && <Badge className="ml-1 bg-amber-500 text-white text-[10px] h-5 px-1.5">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="slips" className="gap-1.5">
            <ArrowUpFromLine className="h-3.5 w-3.5" /> Phiếu xuất kho
            {pendingSlips.length > 0 && <Badge className="ml-1 bg-orange-500 text-white text-[10px] h-5 px-1.5">{pendingSlips.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm mã đơn, khách hàng..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex gap-1">
              {[
                { value: "all", label: "Tất cả" },
                { value: "pending", label: "Chờ duyệt" },
                { value: "approved", label: "Đã duyệt" },
                { value: "exported", label: "Đã xuất" },
                { value: "rejected", label: "Từ chối" },
              ].map(tab => (
                <Button
                  key={tab.value}
                  variant={statusFilter === tab.value ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setStatusFilter(tab.value)}
                >
                  {tab.label}
                  {tab.value !== "all" && (() => {
                    const count = orders.filter(o => o.status === tab.value).length
                    return count > 0 ? <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{count}</Badge> : null
                  })()}
                </Button>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredOrders.length === 0 ? (
                <div className="py-16 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground">Không có đơn hàng nào</p>
                  <p className="text-xs text-muted-foreground mt-1">Đơn hàng từ bán hàng sẽ hiển thị tại đây</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Mã đơn</TableHead>
                      <TableHead className="text-xs">Thời gian</TableHead>
                      <TableHead className="text-xs">Khách hàng</TableHead>
                      <TableHead className="text-xs text-center">Sản phẩm</TableHead>
                      <TableHead className="text-xs text-right">Tổng tiền</TableHead>
                      <TableHead className="text-xs">PTTT</TableHead>
                      <TableHead className="text-xs">Trạng thái</TableHead>
                      <TableHead className="text-xs">Phiếu XK</TableHead>
                      <TableHead className="text-xs text-center">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map(order => (
                      <TableRow key={order.id} className={cn(
                        "hover:bg-muted/50",
                        order.status === "pending" && "bg-amber-50/30"
                      )}>
                        <TableCell className="font-mono text-xs text-blue-600 font-semibold">{order.id}</TableCell>
                        <TableCell className="text-sm">{order.date} {order.time}</TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{order.customer}</p>
                          {order.phone && <p className="text-xs text-muted-foreground">{order.phone}</p>}
                        </TableCell>
                        <TableCell className="text-center text-sm">{order.items.reduce((s, i) => s + i.qty, 0)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-primary">{formatVND(order.finalTotal)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{order.paymentMethod}</Badge></TableCell>
                        <TableCell><StatusBadge status={order.status} /></TableCell>
                        <TableCell className="text-xs">
                          {order.exportSlipId ? (
                            <span className="font-mono text-orange-600">{order.exportSlipId}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            {/* Detail dialog */}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedOrder(order)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader>
                                  <DialogTitle className="font-serif flex items-center gap-2">
                                    Chi tiết đơn {order.id} <StatusBadge status={order.status} />
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 mt-2">
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <p className="text-muted-foreground text-xs">Khách hàng</p>
                                      <p className="font-semibold">{order.customer}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs">Điện thoại</p>
                                      <p className="font-semibold">{order.phone || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs">Ngày tạo</p>
                                      <p className="font-semibold">{order.date} {order.time}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs">Người tạo</p>
                                      <p className="font-semibold">{order.createdBy}</p>
                                    </div>
                                  </div>
                                  <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="text-xs">Sản phẩm</TableHead>
                                          <TableHead className="text-xs text-center">SL</TableHead>
                                          <TableHead className="text-xs text-right">Đơn giá</TableHead>
                                          <TableHead className="text-xs text-right">Thành tiền</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {order.items.map((item, i) => (
                                          <TableRow key={i}>
                                            <TableCell className="text-sm">{item.name}</TableCell>
                                            <TableCell className="text-sm text-center">{item.qty}</TableCell>
                                            <TableCell className="text-sm text-right">{formatVND(item.price)}</TableCell>
                                            <TableCell className="text-sm text-right font-medium">{formatVND(item.price * item.qty)}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                  <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Tạm tính</span>
                                      <span>{formatVND(order.total)}</span>
                                    </div>
                                    {order.discount > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Giảm giá</span>
                                        <span className="text-red-600">-{formatVND(order.discount)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                                      <span>Tổng thanh toán</span>
                                      <span className="text-primary">{formatVND(order.finalTotal)}</span>
                                    </div>
                                  </div>
                                  {order.note && (
                                    <div className="text-sm">
                                      <p className="text-muted-foreground text-xs">Ghi chú</p>
                                      <p>{order.note}</p>
                                    </div>
                                  )}
                                  {order.rejectReason && (
                                    <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm">
                                      <p className="text-red-800 font-medium">Lý do từ chối: {order.rejectReason}</p>
                                      <p className="text-xs text-red-600 mt-1">Bởi {order.rejectedBy} • {order.rejectedAt ? new Date(order.rejectedAt).toLocaleString("vi-VN") : ""}</p>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>

                            {/* Approve button */}
                            {order.status === "pending" && (
                              <>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle className="font-serif">Duyệt đơn hàng {order.id}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-3 mt-2">
                                      <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                        <div className="text-sm">
                                          <p className="font-medium text-blue-800">Xác nhận duyệt đơn hàng</p>
                                          <p className="text-xs text-blue-700 mt-1">Sau khi duyệt, hệ thống sẽ tự động tạo <strong>Phiếu xuất kho</strong> cho đơn hàng này.</p>
                                        </div>
                                      </div>
                                      <div className="text-sm space-y-1">
                                        <p>Khách hàng: <strong>{order.customer}</strong></p>
                                        <p>Số SP: <strong>{order.items.reduce((s, i) => s + i.qty, 0)}</strong></p>
                                        <p>Tổng tiền: <strong className="text-primary">{formatVND(order.finalTotal)}</strong></p>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <DialogClose asChild>
                                        <Button variant="outline">Huỷ</Button>
                                      </DialogClose>
                                      <DialogClose asChild>
                                        <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApprove(order)}>
                                          <CheckCircle2 className="h-4 w-4 mr-1" /> Duyệt & Tạo phiếu XK
                                        </Button>
                                      </DialogClose>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>

                                {/* Reject button */}
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50">
                                      <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle className="font-serif">Từ chối đơn hàng {order.id}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-3 mt-2">
                                      <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                                        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                                        <div className="text-sm">
                                          <p className="font-medium text-red-800">Từ chối đơn hàng?</p>
                                          <p className="text-xs text-red-700 mt-1">Đơn hàng sẽ bị huỷ và không thể khôi phục.</p>
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium mb-1.5 block">Lý do từ chối <span className="text-red-500">*</span></label>
                                        <Textarea
                                          placeholder="Nhập lý do từ chối đơn hàng..."
                                          value={rejectReason}
                                          onChange={e => setRejectReason(e.target.value)}
                                          rows={3}
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <DialogClose asChild>
                                        <Button variant="outline">Huỷ</Button>
                                      </DialogClose>
                                      <DialogClose asChild>
                                        <Button
                                          variant="destructive"
                                          disabled={!rejectReason.trim()}
                                          onClick={() => handleReject(order, rejectReason)}
                                        >
                                          <XCircle className="h-4 w-4 mr-1" /> Từ chối
                                        </Button>
                                      </DialogClose>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Slips Tab */}
        <TabsContent value="slips">
          <div className="space-y-6">
            {/* Pending slips */}
            {pendingSlips.length > 0 && (
              <Card className="border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <ArrowUpFromLine className="h-5 w-5 text-orange-600" /> Phiếu xuất kho chờ xử lý
                    <Badge className="bg-orange-500 text-white ml-2">{pendingSlips.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingSlips.map(slip => (
                    <div key={slip.id} className="border rounded-lg p-4 bg-orange-50/30 hover:bg-orange-50/60 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-orange-600">{slip.id}</span>
                            <Badge variant="outline" className={slipStatusConfig.pending.color}>
                              {slipStatusConfig.pending.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Đơn hàng: <span className="font-mono text-blue-600">{slip.orderId}</span> • Khách: <strong>{slip.customer}</strong> • Ngày: {slip.date}
                          </p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white text-xs gap-1">
                              <Package className="h-3.5 w-3.5" /> Xác nhận xuất kho
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="font-serif">Xác nhận xuất kho {slip.id}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3 mt-2">
                              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-sm">
                                  <p className="font-medium text-amber-800">Lưu ý</p>
                                  <p className="text-xs text-amber-700 mt-1">Xác nhận sẽ trừ số lượng tồn kho tương ứng. Vui lòng kiểm tra hàng thực tế trước khi xác nhận.</p>
                                </div>
                              </div>
                              <div className="border rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">Sản phẩm</TableHead>
                                      <TableHead className="text-xs text-center">SL</TableHead>
                                      <TableHead className="text-xs text-right">Đơn giá</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {slip.items.map((item, i) => (
                                      <TableRow key={i}>
                                        <TableCell className="text-sm">{item.name}</TableCell>
                                        <TableCell className="text-sm text-center">{item.qty}</TableCell>
                                        <TableCell className="text-sm text-right">{formatVND(item.price)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              <p className="text-sm font-bold text-right">Tổng: <span className="text-primary">{formatVND(slip.total)}</span></p>
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Huỷ</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => handleCompleteSlip(slip)}>
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Xác nhận xuất kho
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>

                      {/* Items preview */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {slip.items.map((item, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {item.name} × {item.qty}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Completed slips */}
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" /> Lịch sử phiếu xuất kho
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completedSlips.length === 0 && pendingSlips.length === 0 ? (
                  <div className="py-12 text-center">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">Chưa có phiếu xuất kho nào</p>
                    <p className="text-xs text-muted-foreground mt-1">Phiếu sẽ được tạo tự động khi duyệt đơn hàng</p>
                  </div>
                ) : completedSlips.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Chưa có phiếu đã hoàn thành</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Mã phiếu</TableHead>
                        <TableHead className="text-xs">Đơn hàng</TableHead>
                        <TableHead className="text-xs">Ngày</TableHead>
                        <TableHead className="text-xs">Khách hàng</TableHead>
                        <TableHead className="text-xs text-center">Số SP</TableHead>
                        <TableHead className="text-xs text-right">Tổng</TableHead>
                        <TableHead className="text-xs">Trạng thái</TableHead>
                        <TableHead className="text-xs">Người xử lý</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedSlips.map(slip => (
                        <TableRow key={slip.id}>
                          <TableCell className="font-mono text-xs text-orange-600 font-semibold">{slip.id}</TableCell>
                          <TableCell className="font-mono text-xs text-blue-600">{slip.orderId}</TableCell>
                          <TableCell className="text-sm">{slip.date}</TableCell>
                          <TableCell className="text-sm">{slip.customer}</TableCell>
                          <TableCell className="text-center text-sm">{slip.items.reduce((s, i) => s + i.qty, 0)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">{formatVND(slip.total)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={slipStatusConfig.completed.color}>
                              {slipStatusConfig.completed.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{slip.completedBy || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
