"use client"

import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { StockLevelIndicator } from "@/components/shared"
import { formatVND, formatPNKReference, formatPOReference } from "@/lib/utils"
import { purchaseOrderApi } from "@/lib/api"
import { useInventory } from "@/lib/inventory-context"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { exportInventoryCheckSheet } from "@/lib/export-inventory-check"
import { printWarehouseSlip } from "@/lib/print-utils"
import {
  Search, Package, AlertTriangle, XOctagon, DollarSign,
  Warehouse, FileSpreadsheet, FileText, Clock, CheckCircle2, Printer, ArrowDownToLine
} from "lucide-react"
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis
} from "@/components/ui/pagination"

const HUB_INV_PAGE_SIZE = 20

function formatHubImportSlipReference(slip: { id?: string; date?: string }) {
  return formatPNKReference(slip.id, slip.date)
}

function formatAdminSlipPOReference(slip: { poId?: string; poRawId?: string; poCreatedAt?: string; date?: string }) {
  const poValue = slip.poId || slip.poRawId
  return poValue ? formatPOReference(poValue, slip.poCreatedAt || slip.date) : ""
}

function describeAdminSlipNote(slip: { type?: string; note?: string; poId?: string; poRawId?: string; poCreatedAt?: string; date?: string }) {
  const poCode = formatAdminSlipPOReference(slip)
  if (poCode && slip.type === "import") return `Nhập kho theo PO ${poCode}`
  return slip.note || ""
}

export default function HubInventoryPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const ctx = useInventory()
  const { inventory, adminSlips } = ctx

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [alertOnly, setAlertOnly] = useState(false)
  const [hubInvPage, setHubInvPage] = useState(1)

  useEffect(() => {
    const sku = searchParams.get("sku")
    if (sku) {
      setSearch(sku)
      setHubInvPage(1)
    }
  }, [searchParams])

  // Hub only items
  const hubItems = useMemo(() => inventory.filter(i => i.warehouse === "Kho Hub"), [inventory])

  const categories = [...new Set(hubItems.map(i => i.category))]

  const totalValue = useMemo(() => hubItems.reduce((sum, i) => sum + i.onHand * i.unitCost, 0), [hubItems])
  const totalQty = useMemo(() => hubItems.reduce((sum, i) => sum + i.onHand, 0), [hubItems])
  const lowStock = useMemo(() => hubItems.filter(i => i.available > 0 && i.available <= i.reorderPoint).length, [hubItems])
  const outOfStock = useMemo(() => hubItems.filter(i => i.available === 0).length, [hubItems])

  const filtered = hubItems.filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.sku.toLowerCase().includes(search.toLowerCase())) return false
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false
    if (alertOnly && item.available > item.reorderPoint) return false
    return true
  })

  // Pagination
  const hubInvTotalPages = Math.max(1, Math.ceil(filtered.length / HUB_INV_PAGE_SIZE))
  const hubInvSafePage = Math.min(hubInvPage, hubInvTotalPages)
  const paginatedFiltered = useMemo(() => {
    const start = (hubInvSafePage - 1) * HUB_INV_PAGE_SIZE
    return filtered.slice(start, start + HUB_INV_PAGE_SIZE)
  }, [filtered, hubInvSafePage])

  const getHubInvPageNumbers = () => {
    const pages: (number | "...")[] = []
    if (hubInvTotalPages <= 7) {
      for (let i = 1; i <= hubInvTotalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (hubInvSafePage > 3) pages.push("...")
      for (let i = Math.max(2, hubInvSafePage - 1); i <= Math.min(hubInvTotalPages - 1, hubInvSafePage + 1); i++) pages.push(i)
      if (hubInvSafePage < hubInvTotalPages - 2) pages.push("...")
      pages.push(hubInvTotalPages)
    }
    return pages
  }

  const stats = [
    { title: "Tổng SKU Hub", value: hubItems.length.toString(), icon: <Package className="h-5 w-5" />, color: "bg-purple-100 text-purple-600" },
    { title: "Tổng giá trị", value: formatVND(totalValue), icon: <DollarSign className="h-5 w-5" />, color: "bg-blue-100 text-blue-600" },
    { title: "Sắp hết hàng", value: lowStock.toString(), icon: <AlertTriangle className="h-5 w-5" />, color: "bg-amber-100 text-amber-600", alert: lowStock > 0 },
    { title: "Hết hàng", value: outOfStock.toString(), icon: <XOctagon className="h-5 w-5" />, color: "bg-red-100 text-red-600", alert: outOfStock > 0 },
  ]

  const pendingImportSlips = useMemo(
    () => adminSlips.filter(s => s.type === "import" && s.status === "pending" && s.warehouse === "Kho Hub"),
    [adminSlips]
  )

  const handleProcessImportSlip = async (slip: typeof pendingImportSlips[0]) => {
    if (slip.poRawId) {
      const res = await purchaseOrderApi.updateStatus(slip.poRawId, "received")
      if (!res.success) {
        alert(res.error || "Không thể nhận hàng theo PO")
        return
      }
    } else {
      await ctx.importItems({
        warehouse: slip.warehouse,
        date: new Date().toISOString().split("T")[0],
        note: describeAdminSlipNote(slip) || `Nhập theo phiếu ${formatHubImportSlipReference(slip)}`,
        operator: user?.fullName || "NV Hub",
        items: slip.items.map(item => ({
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          cost: item.unitCost,
        })),
      })
    }

    await ctx.processAdminSlip(slip.id, user?.fullName || "NV Hub")
    await ctx.refreshInventory()
  }

  const printImportSlip = (slip: typeof pendingImportSlips[0]) => {
    printWarehouseSlip({
      id: formatHubImportSlipReference(slip),
      type: "import",
      date: slip.date,
      warehouse: slip.warehouse,
      supplier: slip.supplier,
      poId: formatAdminSlipPOReference(slip),
      note: describeAdminSlipNote(slip),
      createdBy: slip.createdBy,
      assignedTo: slip.assignedTo || slip.warehouse,
      processedBy: user?.fullName || "NV Hub",
      items: slip.items,
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-purple-600" /> Tồn kho Hub
          </h1>
          <p className="text-sm text-muted-foreground">
            Tổng {totalQty.toLocaleString("vi-VN")} sản phẩm trong kho Hub
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => {
            exportInventoryCheckSheet({
              items: filtered,
              warehouseFilter: "Kho Hub",
              categoryFilter,
              exportedBy: user?.fullName || "NV Hub",
            })
          }}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> Xuất phiếu kiểm kê
        </Button>
      </div>

      {pendingImportSlips.length > 0 && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Phiếu nhập kho Hub đang chờ xử lý
              <Badge className="bg-emerald-600 text-white">{pendingImportSlips.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingImportSlips.slice(0, 5).map(slip => (
              <div key={slip.id} className="rounded-xl border bg-white p-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-emerald-700">{formatHubImportSlipReference(slip)}</span>
                    <Badge className="bg-amber-100 text-amber-700">
                      <Clock className="h-3 w-3 mr-1" /> Chờ nhập
                    </Badge>
                    {formatAdminSlipPOReference(slip) && <Badge variant="outline">PO: {formatAdminSlipPOReference(slip)}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{describeAdminSlipNote(slip) || "Phiếu nhập từ admin/PO"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {slip.items.map(item => (
                      <Badge key={`${slip.id}-${item.sku}`} variant="outline" className="text-xs font-normal bg-white">
                        {item.sku}: {item.name} × {item.qty}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href="/hub/transfers">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      <ArrowDownToLine className="h-4 w-4 mr-1" /> Sang Điều chuyển
                    </Button>
                  </a>
                </div>
              </div>
            ))}
            {pendingImportSlips.length > 5 && (
              <p className="text-xs text-muted-foreground">Còn {pendingImportSlips.length - 5} phiếu khác. Vào Điều chuyển để lọc và xử lý chi tiết.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((stat, i) => (
          <Card key={i} className={cn("hover:-translate-y-0.5 transition-all", stat.alert && "border-red-200")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className={cn("p-2 rounded-lg", stat.color)}>{stat.icon}</span>
              </div>
              <p className="font-serif text-2xl font-extrabold mt-3">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm SKU, tên sản phẩm..." value={search} onChange={e => { setSearch(e.target.value); setHubInvPage(1) }} className="pl-9 h-9" />
        </div>
        <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setHubInvPage(1) }}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Danh mục" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả danh mục</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="alert-hub" checked={alertOnly} onCheckedChange={v => { setAlertOnly(v); setHubInvPage(1) }} />
          <Label htmlFor="alert-hub" className="text-sm">Chỉ cảnh báo</Label>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-2">
        Hiển thị {(hubInvSafePage - 1) * HUB_INV_PAGE_SIZE + 1}–{Math.min(hubInvSafePage * HUB_INV_PAGE_SIZE, filtered.length)} / {filtered.length} mục
      </p>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-12"></TableHead>
                <TableHead className="text-xs">SKU</TableHead>
                <TableHead className="text-xs">Sản phẩm</TableHead>
                <TableHead className="text-xs">Danh mục</TableHead>
                <TableHead className="text-xs text-center">Tồn kho</TableHead>
                <TableHead className="text-xs text-center">Khả dụng</TableHead>
                <TableHead className="text-xs text-center">Ngưỡng đặt lại</TableHead>
                <TableHead className="text-xs text-right">Đơn giá</TableHead>
                <TableHead className="text-xs text-right">Giá trị tồn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedFiltered.map((item, idx) => (
                <TableRow key={item.id} className={cn(
                  "hover:bg-muted/50",
                  idx % 2 !== 0 && "bg-muted/20",
                  item.available === 0 && "bg-red-50/50",
                  item.available > 0 && item.available <= item.reorderPoint && "bg-amber-50/50"
                )}>
                  <TableCell>
                    <div className="h-10 w-10 rounded-md bg-purple-100 flex items-center justify-center">
                      <Package className="h-4 w-4 text-purple-600" />
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-primary">{item.sku}</TableCell>
                  <TableCell><p className="text-sm font-medium">{item.name}</p></TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{item.category}</Badge></TableCell>
                  <TableCell className="text-center text-sm">{item.onHand}</TableCell>
                  <TableCell className="text-center">
                    <StockLevelIndicator available={item.available} reorderPoint={item.reorderPoint} />
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">{item.reorderPoint}</TableCell>
                  <TableCell className="text-right text-sm">{formatVND(item.unitCost)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatVND(item.onHand * item.unitCost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {hubInvTotalPages > 1 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setHubInvPage(p => Math.max(1, p - 1))}
                  className={cn("cursor-pointer", hubInvSafePage === 1 && "pointer-events-none opacity-50")}
                />
              </PaginationItem>
              {getHubInvPageNumbers().map((page, i) => (
                <PaginationItem key={i}>
                  {page === "..." ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      isActive={page === hubInvSafePage}
                      onClick={() => setHubInvPage(page as number)}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setHubInvPage(p => Math.min(hubInvTotalPages, p + 1))}
                  className={cn("cursor-pointer", hubInvSafePage === hubInvTotalPages && "pointer-events-none opacity-50")}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
