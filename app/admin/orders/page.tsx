"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from "@/components/ui/pagination"
import { formatVND, formatSalesOrderReference, formatHDReference } from "@/lib/utils"
import { useInventory } from "@/lib/inventory-context"
import { orderApi, purchaseOrderApi, salesOrderApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  Search, Eye, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  ShoppingCart, FileText, Package, Truck, CheckCircle2, Clock,
  XCircle, Filter,
} from "lucide-react"

// ── Types ──
interface POItemData { sku: string; name: string; qty: number; unitCost: number }
interface PurchaseOrder {
  id: string; supplier: string; status: string; createdDate: string;
  totalValue: number; items: POItemData[]; warehouse: string; note: string;
}

interface OrderItem { productId: number; name: string; price: number; qty: number }
interface SalesOrder {
  id: string; rawId?: string; items: OrderItem[]; customer: { name: string; phone: string; email: string; address: string }
  note: string; subtotal: number; shippingFee: number; total: number; paymentMethod: string
  status: string; createdAt: string; userId: string; type: string
  fulfillingWarehouse?: string; approvedBy?: string
}

// ── Unified row type ──
interface UnifiedOrder {
  id: string
  type: "import" | "export" | "transfer" | "sale" | "po"
  date: string
  description: string
  warehouse: string
  qty: number
  value: number
  status: string
  raw: any
}

// ── Status badge ──
function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Chờ xử lý", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    processing: { label: "Đang xử lý", cls: "bg-blue-100 text-blue-700 border-blue-200" },
    approved: { label: "Đã duyệt", cls: "bg-cyan-100 text-cyan-700 border-cyan-200" },
    confirmed: { label: "Xác nhận", cls: "bg-cyan-100 text-cyan-700 border-cyan-200" },
    "in-transit": { label: "Vận chuyển", cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
    shipping: { label: "Đang giao", cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
    completed: { label: "Hoàn thành", cls: "bg-green-100 text-green-700 border-green-200" },
    delivered: { label: "Đã nhận", cls: "bg-green-100 text-green-700 border-green-200" },
    processed: { label: "Đã xử lý", cls: "bg-green-100 text-green-700 border-green-200" },
    cancelled: { label: "Đã huỷ", cls: "bg-red-100 text-red-700 border-red-200" },
    rejected: { label: "Từ chối", cls: "bg-red-100 text-red-700 border-red-200" },
    draft: { label: "Nháp", cls: "bg-gray-100 text-gray-600 border-gray-200" },
  }
  const v = map[status] || { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" }
  return <Badge variant="outline" className={cn("text-[10px]", v.cls)}>{v.label}</Badge>
}

function OrderTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    import: { label: "Nhập kho", icon: <ArrowDownToLine className="h-3 w-3" />, cls: "bg-green-50 text-green-700 border-green-200" },
    export: { label: "Xuất kho", icon: <ArrowUpFromLine className="h-3 w-3" />, cls: "bg-orange-50 text-orange-700 border-orange-200" },
    transfer: { label: "Điều chuyển", icon: <ArrowLeftRight className="h-3 w-3" />, cls: "bg-blue-50 text-blue-700 border-blue-200" },
    sale: { label: "Bán hàng", icon: <ShoppingCart className="h-3 w-3" />, cls: "bg-purple-50 text-purple-700 border-purple-200" },
    po: { label: "Đặt hàng", icon: <Truck className="h-3 w-3" />, cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  }
  const v = map[type] || { label: type, icon: <FileText className="h-3 w-3" />, cls: "bg-gray-50 text-gray-600" }
  return <Badge variant="outline" className={cn("text-[10px] gap-1", v.cls)}>{v.icon}{v.label}</Badge>
}

const PAGE_SIZE = 20

export default function AdminAllOrdersPage() {
  const { transactions, transferRequests, adminSlips } = useInventory()
  const [activeTab, setActiveTab] = useState("all")
  const [search, setSearch] = useState("")
  const [warehouseFilter, setWarehouseFilter] = useState("all")
  const [page, setPage] = useState(1)

  // Load POs and sales from API
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        const poRes = await purchaseOrderApi.getAll()
        if (poRes.success && poRes.data) {
          setPurchaseOrders(poRes.data.map((p: any) => ({
            id: String(p.id), supplier: p.supplier_name || p.supplier || "",
            status: p.status || "draft",
            createdDate: p.created_at ? new Date(p.created_at).toISOString().split("T")[0] : "",
            totalValue: p.total_value ?? 0, items: (p.po_items || []).map((i: any) => ({ sku: i.sku, name: i.name || i.product_name || "", qty: i.qty || i.quantity || 0, unitCost: i.unit_cost || i.unitCost || i.price || 0 })),
            warehouse: p.warehouse_name || "Kho Hub", note: p.note || "",
          })))
        }
      } catch {}
      try {
        const soRes = await salesOrderApi.getAll()
        if (soRes.success && soRes.data) {
          setSalesOrders(soRes.data.map((o: any) => ({
            id: formatSalesOrderReference(o.sales_code || o.orderCode || o.order_code || o.code || o.id, o.created_at),
            rawId: String(o.id),
            items: (o.items || []).map((i: any) => ({ productId: i.product_id, name: i.product_name || i.name || "", price: i.price || 0, qty: i.qty || i.quantity || 0 })),
            customer: { name: o.customer_name || "", phone: o.customer_phone || "", email: o.customer_email || "", address: o.shipping_address || "" },
            note: o.note || "", subtotal: o.amount || 0, shippingFee: 0, total: o.amount || 0,
            paymentMethod: o.payment_method || "", status: o.status || "", createdAt: o.created_at || "",
            userId: o.user_id || "", type: "sale", fulfillingWarehouse: o.warehouse_name || "", approvedBy: o.approved_by || "",
          })))
        }
      } catch {}
      // Also load customer orders
      try {
        const orRes = await orderApi.getAll()
        if (orRes.orders && orRes.orders.length > 0) {
          setSalesOrders(prev => {
            const existingIds = new Set(prev.map(s => s.rawId || s.id))
            const newOrders = orRes.orders.filter((o: any) => !existingIds.has(String(o.id))).map((o: any) => ({
              id: formatHDReference(o.orderCode || o.order_code || o.invoiceCode || o.invoice_code || o.sales_code || o.id, o.createdAt || o.created_at),
              rawId: String(o.id),
              items: (o.items || []).map((i: any) => ({ productId: i.productId || i.product_id, name: i.productName || i.name || "", price: i.price || 0, qty: i.quantity || i.qty || 0 })),
              customer: { name: o.customerName || "", phone: o.customerPhone || "", email: o.customerEmail || "", address: o.shippingAddress || "" },
              note: o.note || "", subtotal: o.totalAmount || 0, shippingFee: 0, total: o.totalAmount || 0,
              paymentMethod: o.paymentMethod || "", status: o.status || "", createdAt: o.createdAt || "",
              userId: o.userId || "", type: "sale", fulfillingWarehouse: "", approvedBy: "",
            }))
            return [...prev, ...newOrders]
          })
        }
      } catch {}
    }
    loadData()
  }, [])

  // Merge all data into unified rows
  const allOrders = useMemo<UnifiedOrder[]>(() => {
    const rows: UnifiedOrder[] = []

    // Transactions (GRN imports & exports)
    for (const tx of transactions) {
      if (tx.type === "transfer-out" || tx.type === "transfer-in") continue // handled by transferRequests
      rows.push({
        id: tx.id,
        type: tx.type === "import" ? "import" : "export",
        date: tx.date,
        description: `${tx.productName} (${tx.sku}) x${tx.qty}`,
        warehouse: tx.warehouse || "",
        qty: tx.qty,
        value: tx.qty * tx.cost,
        status: "completed",
        raw: tx,
      })
    }

    // Transfer requests
    for (const tr of transferRequests) {
      const totalQty = tr.items.reduce((s, i) => s + i.qty, 0)
      rows.push({
        id: tr.id,
        type: "transfer",
        date: tr.date,
        description: `${tr.fromWarehouse} → ${tr.toWarehouse} (${tr.items.length} SP)`,
        warehouse: `${tr.fromWarehouse} → ${tr.toWarehouse}`,
        qty: totalQty,
        value: 0,
        status: tr.status,
        raw: tr,
      })
    }

    // Admin slips
    for (const slip of adminSlips) {
      const totalQty = slip.items.reduce((s, i) => s + i.qty, 0)
      const totalVal = slip.items.reduce((s, i) => s + i.qty * i.unitCost, 0)
      rows.push({
        id: slip.id,
        type: slip.type === "import" ? "import" : "export",
        date: slip.date,
        description: `Phiếu admin: ${slip.note}`,
        warehouse: slip.warehouse,
        qty: totalQty,
        value: totalVal,
        status: slip.status,
        raw: slip,
      })
    }

    // POs
    for (const po of purchaseOrders) {
      const items = Array.isArray(po.items) ? po.items : []
      const totalQty = items.reduce((s, i) => s + i.qty, 0)
      rows.push({
        id: po.id,
        type: "po",
        date: po.createdDate,
        description: `${po.supplier} (${items.length} SP)`,
        warehouse: po.warehouse || "",
        qty: totalQty,
        value: po.totalValue,
        status: po.status,
        raw: po,
      })
    }

    // Sales orders
    for (const ord of salesOrders) {
      const totalQty = ord.items.reduce((s, i) => s + i.qty, 0)
      rows.push({
        id: ord.id,
        type: "sale",
        date: ord.createdAt?.slice(0, 10) || "",
        description: `${ord.customer?.name || "Khách"} (${ord.items.length} SP)`,
        warehouse: ord.fulfillingWarehouse || "",
        qty: totalQty,
        value: ord.total,
        status: ord.status,
        raw: ord,
      })
    }

    // Sort by date desc
    rows.sort((a, b) => b.date.localeCompare(a.date))
    return rows
  }, [transactions, transferRequests, adminSlips, purchaseOrders, salesOrders])

  // Filter
  const filtered = useMemo(() => {
    return allOrders.filter(o => {
      if (activeTab !== "all" && o.type !== activeTab) return false
      if (warehouseFilter !== "all" && !o.warehouse.includes(warehouseFilter)) return false
      if (search) {
        const q = search.toLowerCase()
        if (!o.id.toLowerCase().includes(q) && !o.description.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [allOrders, activeTab, warehouseFilter, search])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => { setPage(1) }, [activeTab, warehouseFilter, search])
  const paginatedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function getPageNumbers() {
    const pages: (number | "ellipsis")[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push("ellipsis")
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
      if (page < totalPages - 2) pages.push("ellipsis")
      pages.push(totalPages)
    }
    return pages
  }

  // Warehouses for filter
  const warehouses = useMemo(() => {
    const set = new Set<string>()
    allOrders.forEach(o => {
      if (o.warehouse) {
        // Handle transfer "A → B" format
        o.warehouse.split(" → ").forEach(w => set.add(w.trim()))
      }
    })
    return Array.from(set).sort()
  }, [allOrders])

  // KPI counts
  const typeCounts = useMemo(() => {
    const c = { import: 0, export: 0, transfer: 0, sale: 0, po: 0 }
    allOrders.forEach(o => { c[o.type]++ })
    return c
  }, [allOrders])

  const tabItems = [
    { value: "all", label: "Tất cả", count: allOrders.length },
    { value: "import", label: "Nhập kho", count: typeCounts.import },
    { value: "export", label: "Xuất kho", count: typeCounts.export },
    { value: "transfer", label: "Điều chuyển", count: typeCounts.transfer },
    { value: "sale", label: "Bán hàng", count: typeCounts.sale },
    { value: "po", label: "Đặt hàng", count: typeCounts.po },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Quản lý đơn hàng</h1>
          <p className="text-sm text-muted-foreground">Toàn bộ đơn nhập, xuất, điều chuyển và bán hàng</p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-6">
        {[
          { title: "Nhập kho", value: typeCounts.import, icon: <ArrowDownToLine className="h-5 w-5" />, color: "bg-green-100 text-green-600" },
          { title: "Xuất kho", value: typeCounts.export, icon: <ArrowUpFromLine className="h-5 w-5" />, color: "bg-orange-100 text-orange-600" },
          { title: "Điều chuyển", value: typeCounts.transfer, icon: <ArrowLeftRight className="h-5 w-5" />, color: "bg-blue-100 text-blue-600" },
          { title: "Bán hàng", value: typeCounts.sale, icon: <ShoppingCart className="h-5 w-5" />, color: "bg-purple-100 text-purple-600" },
          { title: "Đặt hàng NCC", value: typeCounts.po, icon: <Truck className="h-5 w-5" />, color: "bg-cyan-100 text-cyan-600" },
        ].map((card, i) => (
          <Card key={i} className="hover:-translate-y-0.5 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className={cn("p-2 rounded-lg", card.color)}>{card.icon}</span>
              </div>
              <p className="font-serif text-2xl font-extrabold mt-3">{card.value}</p>
              <p className="text-sm text-muted-foreground">{card.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList className="bg-muted/50 h-10 flex-wrap">
          {tabItems.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs gap-1.5 data-[state=active]:text-primary">
              {tab.label}
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{tab.count}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm mã đơn, mô tả..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Kho" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả kho</SelectItem>
            {warehouses.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length} đơn
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Mã đơn</TableHead>
                <TableHead className="text-xs">Loại</TableHead>
                <TableHead className="text-xs">Ngày</TableHead>
                <TableHead className="text-xs">Mô tả</TableHead>
                <TableHead className="text-xs">Kho</TableHead>
                <TableHead className="text-xs text-center">SL</TableHead>
                <TableHead className="text-xs text-right">Giá trị</TableHead>
                <TableHead className="text-xs">Trạng thái</TableHead>
                <TableHead className="text-xs w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Không tìm thấy đơn nào</p>
                  </TableCell>
                </TableRow>
              ) : paginatedRows.map((row, idx) => (
                <TableRow key={`${row.type}-${row.id}`} className={cn("hover:bg-muted/50", idx % 2 !== 0 && "bg-muted/20")}>
                  <TableCell className="font-mono text-xs text-primary font-semibold max-w-[140px] truncate">{row.id}</TableCell>
                  <TableCell><OrderTypeBadge type={row.type} /></TableCell>
                  <TableCell className="text-sm">{row.date}</TableCell>
                  <TableCell className="text-sm max-w-[250px] truncate">{row.description}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{row.warehouse || "—"}</TableCell>
                  <TableCell className="text-center text-sm">{row.qty}</TableCell>
                  <TableCell className="text-right text-sm font-medium whitespace-nowrap">
                    {row.value > 0 ? formatVND(row.value) : "—"}
                  </TableCell>
                  <TableCell><OrderStatusBadge status={row.status} /></TableCell>
                  <TableCell>
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                      </SheetTrigger>
                      <OrderDetailSheet row={row} />
                    </Sheet>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious className="cursor-pointer" onClick={() => setPage(p => Math.max(1, p - 1))} />
              </PaginationItem>
              {getPageNumbers().map((n, i) =>
                n === "ellipsis" ? (
                  <PaginationItem key={`e-${i}`}><PaginationEllipsis /></PaginationItem>
                ) : (
                  <PaginationItem key={n}>
                    <PaginationLink className="cursor-pointer" isActive={n === page} onClick={() => setPage(n as number)}>{n}</PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext className="cursor-pointer" onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}

// ── Detail Sheet ──
function OrderDetailSheet({ row }: { row: UnifiedOrder }) {
  return (
    <SheetContent className="w-full sm:max-w-[500px] overflow-y-auto">
      <SheetHeader>
        <SheetTitle className="font-serif">Chi tiết đơn</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sm text-primary font-semibold">{row.id}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{row.date}</p>
          </div>
          <div className="flex items-center gap-2">
            <OrderTypeBadge type={row.type} />
            <OrderStatusBadge status={row.status} />
          </div>
        </div>

        {/* Common info */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mô tả</span>
              <span className="text-right max-w-[250px]">{row.description}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Kho</span>
              <span className="font-medium">{row.warehouse || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Số lượng</span>
              <span>{row.qty}</span>
            </div>
            {row.value > 0 && (
              <div className="flex justify-between text-sm font-bold pt-2 border-t">
                <span>Giá trị</span>
                <span className="text-primary">{formatVND(row.value)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Type-specific details */}
        {row.type === "import" && row.raw?.type === "import" && row.raw?.sku && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Chi tiết nhập kho</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">SKU</span>
                <span className="font-mono">{row.raw.sku}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sản phẩm</span>
                <span>{row.raw.productName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Đơn giá</span>
                <span>{formatVND(row.raw.cost)}</span>
              </div>
              {row.raw.operator && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Người thực hiện</span>
                  <span>{row.raw.operator}</span>
                </div>
              )}
              {row.raw.note && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ghi chú</span>
                  <span className="text-right max-w-[200px]">{row.raw.note}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {row.type === "transfer" && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Chi tiết điều chuyển</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Kho nguồn</span>
                <span>{row.raw.fromWarehouse}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Kho đích</span>
                <span>{row.raw.toWarehouse}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Lý do</span>
                <span className="text-right max-w-[200px]">{row.raw.reason}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phương thức</span>
                <span>{row.raw.pickupMethod === "employee" ? "Nhân viên lấy" : row.raw.pickupMethod === "delivery" ? "Giao hàng" : "Khách đến lấy"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Người tạo</span>
                <span>{row.raw.createdBy}</span>
              </div>
              {row.raw.items && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium mb-1">Sản phẩm:</p>
                  {row.raw.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs text-muted-foreground">
                      <span>{item.name}</span>
                      <span>x{item.qty}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {row.type === "po" && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Chi tiết đặt hàng NCC</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nhà cung cấp</span>
                <span className="font-medium">{row.raw.supplier}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Kho nhận</span>
                <span>{row.raw.warehouse}</span>
              </div>
              {row.raw.note && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ghi chú</span>
                  <span className="text-right max-w-[200px]">{row.raw.note}</span>
                </div>
              )}
              {Array.isArray(row.raw.items) && row.raw.items.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium mb-1">Sản phẩm:</p>
                  {row.raw.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{item.name} ({item.sku})</span>
                      <span>x{item.qty} — {formatVND(item.unitCost)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {row.type === "sale" && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Chi tiết đơn bán</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {row.raw.customer && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Khách hàng</span>
                    <span className="font-medium">{row.raw.customer.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">SĐT</span>
                    <span>{row.raw.customer.phone}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span>{row.raw.customer.email}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Thanh toán</span>
                <span>{row.raw.paymentMethod || "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tạm tính</span>
                <span>{formatVND(row.raw.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phí vận chuyển</span>
                <span>{formatVND(row.raw.shippingFee || 0)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t">
                <span>Tổng</span>
                <span className="text-primary">{formatVND(row.raw.total || 0)}</span>
              </div>
              {row.raw.items && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium mb-1">Sản phẩm:</p>
                  {row.raw.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span>x{item.qty} — {formatVND(item.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Admin slip detail */}
        {(row.type === "import" || row.type === "export") && row.raw?.source === "admin" && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Phiếu Admin</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Người tạo</span>
                <span>{row.raw.createdBy}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gán cho</span>
                <span>{row.raw.assignedTo}</span>
              </div>
              {row.raw.supplier && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">NCC</span>
                  <span>{row.raw.supplier}</span>
                </div>
              )}
              {row.raw.poId && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">PO tham chiếu</span>
                  <span className="font-mono">{row.raw.poId}</span>
                </div>
              )}
              {row.raw.processedBy && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Người xử lý</span>
                  <span>{row.raw.processedBy}</span>
                </div>
              )}
              {row.raw.items && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium mb-1">Sản phẩm:</p>
                  {row.raw.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{item.name} ({item.sku})</span>
                      <span>x{item.qty} — {formatVND(item.unitCost)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </SheetContent>
  )
}
