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
import { formatVND } from "@/lib/utils"
import { salesOrderApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  Search, CheckCircle2, XCircle, Clock, Eye, Receipt,
  ArrowUpFromLine, Package, AlertTriangle, Loader2,
  DollarSign, ShoppingCart
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────
interface SalesOrder {
  id: string
  date: string
  time: string
  customer: string
  phone: string
  items: { productId: number; name: string; price: number; qty: number }[]
  total: number
  discount: number
  finalTotal: number
  paymentMethod: string
  note: string
  status: "pending" | "approved" | "rejected" | "exported"
  createdBy: string
  creatorName?: string
  approvedAt?: string
  approvedBy?: string
  rejectReason?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: "Chờ duyệt",  color: "bg-amber-100 text-amber-800 border-amber-200",  icon: <Clock        className="h-3.5 w-3.5" /> },
  approved: { label: "Đã duyệt",   color: "bg-blue-100 text-blue-800 border-blue-200",     icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: "Từ chối",    color: "bg-red-100 text-red-800 border-red-200",         icon: <XCircle      className="h-3.5 w-3.5" /> },
  exported: { label: "Đã xuất kho",color: "bg-green-100 text-green-800 border-green-200",  icon: <Package      className="h-3.5 w-3.5" /> },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.pending
  return (
    <Badge variant="outline" className={cn("gap-1 text-xs", cfg.color)}>
      {cfg.icon} {cfg.label}
    </Badge>
  )
}

function mapOrder(o: any): SalesOrder {
  return {
    id:            String(o.id),
    date:          o.created_at ? new Date(o.created_at).toLocaleDateString("vi-VN")  : "",
    time:          o.created_at ? new Date(o.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "",
    customer:      o.customer_name  || "Khách lẻ",
    phone:         o.customer_phone || "",
    items:         (o.items || []).map((i: any) => ({
      productId: i.product_id,
      name:      i.product_name || i.name || "",
      price:     Number(i.price) || 0,
      qty:       i.qty  || i.quantity || 0,
    })),
    total:         Number(o.total)       || 0,
    discount:      Number(o.discount)    || 0,
    finalTotal:    Number(o.final_total) || Number(o.total) || 0,
    paymentMethod: o.payment_method  || "",
    note:          o.note            || "",
    status:        o.status          || "pending",
    createdBy:     o.created_by      || "",
    creatorName:   o.creator_name    || "",
    approvedAt:    o.approved_at,
    approvedBy:    o.approved_by,
    rejectReason:  o.reject_reason,
  }
}

// ─── Order Detail Dialog ──────────────────────────────────────────────────────
function OrderDetail({ order }: { order: SalesOrder }) {
  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-muted-foreground text-xs">Khách hàng</p><p className="font-semibold">{order.customer}</p></div>
        <div><p className="text-muted-foreground text-xs">Điện thoại</p><p className="font-semibold">{order.phone || "—"}</p></div>
        <div><p className="text-muted-foreground text-xs">Ngày tạo</p><p className="font-semibold">{order.date} {order.time}</p></div>
        <div><p className="text-muted-foreground text-xs">Người tạo</p><p className="font-semibold">{order.creatorName || order.createdBy || "—"}</p></div>
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
        <div className="flex justify-between"><span className="text-muted-foreground">Tạm tính</span><span>{formatVND(order.total)}</span></div>
        {order.discount > 0 && (
          <div className="flex justify-between"><span className="text-muted-foreground">Giảm giá</span><span className="text-red-600">-{formatVND(order.discount)}</span></div>
        )}
        <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
          <span>Tổng thanh toán</span>
          <span className="text-primary">{formatVND(order.finalTotal)}</span>
        </div>
      </div>
      {order.note && <div className="text-sm"><p className="text-muted-foreground text-xs">Ghi chú</p><p>{order.note}</p></div>}
      {order.rejectReason && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm">
          <p className="text-red-800 font-medium">Lý do từ chối: {order.rejectReason}</p>
          {order.approvedAt && (
            <p className="text-xs text-red-600 mt-1">{new Date(order.approvedAt).toLocaleString("vi-VN")}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ApprovalPage() {
  const [orders, setOrders]           = useState<SalesOrder[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [rejectReason, setRejectReason] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ── Load data from backend ──────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true)
    try {
      const res = await salesOrderApi.getAll()
      if ((res as any).success && (res as any).data) {
        setOrders((res as any).data.map(mapOrder))
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // ── Stats ───────────────────────────────────────────────────────────────
  const pendingCount  = orders.filter(o => o.status === "pending").length
  const approvedCount = orders.filter(o => o.status === "approved").length
  const exportedCount = orders.filter(o => o.status === "exported").length
  const totalRevenue  = orders
    .filter(o => o.status === "approved" || o.status === "exported")
    .reduce((s, o) => s + o.finalTotal, 0)

  // ── Filter ──────────────────────────────────────────────────────────────
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

  const pendingExport = orders.filter(o => o.status === "approved")
  const doneExport    = orders.filter(o => o.status === "exported")

  // ── Actions ─────────────────────────────────────────────────────────────

  // Duyệt đơn hàng
  const handleApprove = async (orderId: string) => {
    setActionLoading(orderId + "_approve")
    try {
      const res = await salesOrderApi.approve(orderId)
      if ((res as any).success !== false) await loadData()
    } catch {}
    setActionLoading(null)
  }

  // Từ chối đơn hàng
  const handleReject = async (orderId: string, reason: string) => {
    if (!reason.trim()) return
    setActionLoading(orderId + "_reject")
    try {
      await salesOrderApi.reject(orderId, reason)
      await loadData()
    } catch {}
    setRejectReason("")
    setActionLoading(null)
  }

  // Xuất kho (complete) – backend sẽ tự động trừ kho + gửi email
  const handleExport = async (orderId: string) => {
    setActionLoading(orderId + "_export")
    try {
      const res = await salesOrderApi.complete(orderId)
      if ((res as any).success !== false) await loadData()
    } catch {}
    setActionLoading(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Duyệt đơn hàng</h1>
          <p className="text-sm text-muted-foreground">Duyệt đơn bán hàng và xác nhận xuất kho</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Làm mới"}
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        {[
          { label: "Chờ duyệt",   value: pendingCount,  icon: <Clock className="h-5 w-5" />,        bg: "bg-amber-100 text-amber-600"  },
          { label: "Đã duyệt",    value: approvedCount, icon: <CheckCircle2 className="h-5 w-5" />,  bg: "bg-blue-100 text-blue-600"    },
          { label: "Đã xuất kho", value: exportedCount, icon: <Package className="h-5 w-5" />,       bg: "bg-green-100 text-green-600"  },
          { label: "Doanh thu",   value: formatVND(totalRevenue), icon: <DollarSign className="h-5 w-5" />, bg: "bg-primary/10 text-primary" },
        ].map(kpi => (
          <Card key={kpi.label} className="hover:-translate-y-0.5 transition-all">
            <CardContent className="p-4">
              <span className={cn("p-2 rounded-lg inline-flex", kpi.bg)}>{kpi.icon}</span>
              <p className="font-serif text-2xl font-extrabold mt-3">{kpi.value}</p>
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="mb-4">
          <TabsTrigger value="orders" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Đơn hàng
            {pendingCount > 0 && <Badge className="ml-1 bg-amber-500 text-white text-[10px] h-5 px-1.5">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="slips" className="gap-1.5">
            <ArrowUpFromLine className="h-3.5 w-3.5" /> Phiếu xuất kho
            {pendingExport.length > 0 && <Badge className="ml-1 bg-orange-500 text-white text-[10px] h-5 px-1.5">{pendingExport.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Đơn hàng ─────────────────────────────────────────────── */}
        <TabsContent value="orders">
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
            <div className="flex gap-1 flex-wrap">
              {[
                { value: "all",      label: "Tất cả"    },
                { value: "pending",  label: "Chờ duyệt" },
                { value: "approved", label: "Đã duyệt"  },
                { value: "exported", label: "Đã xuất"   },
                { value: "rejected", label: "Từ chối"   },
              ].map(tab => (
                <Button
                  key={tab.value}
                  variant={statusFilter === tab.value ? "default" : "outline"}
                  size="sm" className="text-xs h-8"
                  onClick={() => setStatusFilter(tab.value)}
                >
                  {tab.label}
                  {tab.value !== "all" && (() => {
                    const cnt = orders.filter(o => o.status === tab.value).length
                    return cnt > 0 ? <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{cnt}</Badge> : null
                  })()}
                </Button>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" /></div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-16 text-center">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground">Không có đơn hàng nào</p>
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
                      <TableHead className="text-xs text-center">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map(order => (
                      <TableRow key={order.id} className={cn("hover:bg-muted/50", order.status === "pending" && "bg-amber-50/30")}>
                        <TableCell className="font-mono text-xs text-blue-600 font-semibold">{order.id.slice(0, 8).toUpperCase()}</TableCell>
                        <TableCell className="text-xs">{order.date}<br /><span className="text-muted-foreground">{order.time}</span></TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{order.customer}</p>
                          {order.phone && <p className="text-xs text-muted-foreground">{order.phone}</p>}
                        </TableCell>
                        <TableCell className="text-center text-sm">{order.items.reduce((s, i) => s + i.qty, 0)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-primary">{formatVND(order.finalTotal)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{order.paymentMethod}</Badge></TableCell>
                        <TableCell><StatusBadge status={order.status} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            {/* View detail */}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader>
                                  <DialogTitle className="font-serif flex items-center gap-2 text-base">
                                    Đơn {order.id.slice(0,8).toUpperCase()} <StatusBadge status={order.status} />
                                  </DialogTitle>
                                </DialogHeader>
                                <OrderDetail order={order} />
                              </DialogContent>
                            </Dialog>

                            {/* Approve */}
                            {order.status === "pending" && (
                              <>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-50">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle className="font-serif">Duyệt đơn hàng</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-3 mt-2">
                                      <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                        <div className="text-sm">
                                          <p className="font-medium text-blue-800">Xác nhận duyệt đơn hàng</p>
                                          <p className="text-xs text-blue-700 mt-1">
                                            Sau khi duyệt, đơn hàng sẽ chuyển sang trạng thái <strong>Đã duyệt</strong> và chờ xác nhận xuất kho.
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-sm space-y-1">
                                        <p>Khách hàng: <strong>{order.customer}</strong></p>
                                        <p>Số sản phẩm: <strong>{order.items.reduce((s, i) => s + i.qty, 0)}</strong></p>
                                        <p>Tổng tiền: <strong className="text-primary">{formatVND(order.finalTotal)}</strong></p>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <DialogClose asChild><Button variant="outline">Huỷ</Button></DialogClose>
                                      <DialogClose asChild>
                                        <Button
                                          className="bg-green-600 hover:bg-green-700 text-white"
                                          disabled={actionLoading === order.id + "_approve"}
                                          onClick={() => handleApprove(order.id)}
                                        >
                                          {actionLoading === order.id + "_approve"
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <><CheckCircle2 className="h-4 w-4 mr-1" /> Duyệt đơn</>
                                          }
                                        </Button>
                                      </DialogClose>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>

                                {/* Reject */}
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50">
                                      <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle className="font-serif">Từ chối đơn hàng</DialogTitle>
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
                                          placeholder="Nhập lý do từ chối..."
                                          value={rejectReason}
                                          onChange={e => setRejectReason(e.target.value)}
                                          rows={3}
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <DialogClose asChild><Button variant="outline">Huỷ</Button></DialogClose>
                                      <DialogClose asChild>
                                        <Button
                                          variant="destructive"
                                          disabled={!rejectReason.trim() || actionLoading === order.id + "_reject"}
                                          onClick={() => handleReject(order.id, rejectReason)}
                                        >
                                          <XCircle className="h-4 w-4 mr-1" /> Từ chối
                                        </Button>
                                      </DialogClose>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </>
                            )}

                            {/* Export (approved → exported) */}
                            {order.status === "approved" && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-600 hover:bg-orange-50">
                                    <Package className="h-3.5 w-3.5" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle className="font-serif">Xác nhận xuất kho</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-3 mt-2">
                                    <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                                      <Package className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                                      <div className="text-sm">
                                        <p className="font-medium text-orange-800">Xác nhận xuất kho đơn hàng này?</p>
                                        <p className="text-xs text-orange-700 mt-1">
                                          Hệ thống sẽ <strong>trừ tồn kho</strong> và gửi <strong>email hóa đơn</strong> cho khách hàng.
                                        </p>
                                      </div>
                                    </div>
                                    <div className="border rounded-lg overflow-hidden">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="text-xs">Sản phẩm</TableHead>
                                            <TableHead className="text-xs text-center">SL</TableHead>
                                            <TableHead className="text-xs text-right">Thành tiền</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {order.items.map((item, i) => (
                                            <TableRow key={i}>
                                              <TableCell className="text-xs">{item.name}</TableCell>
                                              <TableCell className="text-xs text-center">{item.qty}</TableCell>
                                              <TableCell className="text-xs text-right">{formatVND(item.price * item.qty)}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                    <div className="flex justify-between font-bold text-sm border-t pt-2">
                                      <span>Tổng xuất kho</span>
                                      <span className="text-primary">{formatVND(order.finalTotal)}</span>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <DialogClose asChild><Button variant="outline">Huỷ</Button></DialogClose>
                                    <DialogClose asChild>
                                      <Button
                                        className="bg-orange-600 hover:bg-orange-700 text-white"
                                        disabled={actionLoading === order.id + "_export"}
                                        onClick={() => handleExport(order.id)}
                                      >
                                        {actionLoading === order.id + "_export"
                                          ? <Loader2 className="h-4 w-4 animate-spin" />
                                          : <><Package className="h-4 w-4 mr-1" /> Xác nhận xuất kho</>
                                        }
                                      </Button>
                                    </DialogClose>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
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

        {/* ── Tab: Phiếu xuất kho ──────────────────────────────────────────── */}
        <TabsContent value="slips">
          <div className="space-y-6">
            {/* Pending export */}
            {pendingExport.length > 0 && (
              <Card className="border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <ArrowUpFromLine className="h-5 w-5 text-orange-600" /> Chờ xuất kho
                    <Badge className="bg-orange-500 text-white ml-2">{pendingExport.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingExport.map(order => (
                    <div key={order.id} className="border rounded-lg p-4 bg-orange-50/30 hover:bg-orange-50/60 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-semibold text-orange-600">{order.id.slice(0,8).toUpperCase()}</span>
                            <StatusBadge status={order.status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Khách: <strong>{order.customer}</strong>
                            {order.phone && <> • {order.phone}</>}
                            {" • "}{order.date}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {order.items.map((item, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {item.name} ×{item.qty}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-primary">{formatVND(order.finalTotal)}</p>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white text-xs gap-1 mt-2">
                                <Package className="h-3.5 w-3.5" /> Xuất kho
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle className="font-serif">Xác nhận xuất kho</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3 mt-2">
                                <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                                  <Package className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                                  <div className="text-sm">
                                    <p className="font-medium text-orange-800">Xuất kho & hoàn thành đơn hàng</p>
                                    <p className="text-xs text-orange-700 mt-1">
                                      Hệ thống sẽ tự động <strong>trừ tồn kho</strong> và gửi <strong>email hóa đơn</strong> cho khách.
                                    </p>
                                  </div>
                                </div>
                                <div className="text-sm space-y-1">
                                  <p>Khách: <strong>{order.customer}</strong></p>
                                  <p>Tổng xuất: <strong className="text-primary">{formatVND(order.finalTotal)}</strong></p>
                                </div>
                              </div>
                              <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Huỷ</Button></DialogClose>
                                <DialogClose asChild>
                                  <Button
                                    className="bg-orange-600 hover:bg-orange-700 text-white"
                                    disabled={actionLoading === order.id + "_export"}
                                    onClick={() => handleExport(order.id)}
                                  >
                                    <Package className="h-4 w-4 mr-1" /> Xác nhận xuất kho
                                  </Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Done export */}
            {doneExport.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-green-600" /> Đã xuất kho
                    <Badge className="bg-green-500 text-white ml-2">{doneExport.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {doneExport.slice(0, 20).map(order => (
                    <div key={order.id} className="border rounded-lg p-3 flex items-center justify-between gap-4 bg-green-50/20">
                      <div>
                        <span className="font-mono text-sm font-semibold text-green-700">{order.id.slice(0,8).toUpperCase()}</span>
                        <span className="text-xs text-muted-foreground ml-2">{order.customer} • {order.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-green-700">{formatVND(order.finalTotal)}</span>
                        <StatusBadge status="exported" />
                      </div>
                    </div>
                  ))}
                  {doneExport.length > 20 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">... và {doneExport.length - 20} đơn khác</p>
                  )}
                </CardContent>
              </Card>
            )}

            {pendingExport.length === 0 && doneExport.length === 0 && (
              <div className="py-16 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">Chưa có phiếu xuất kho nào</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
