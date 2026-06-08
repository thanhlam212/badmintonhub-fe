"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { StockLevelIndicator } from "@/components/shared"
import { formatVND } from "@/lib/utils"
import { purchaseOrderApi } from "@/lib/api"
import { useInventory, type TransferRequest } from "@/lib/inventory-context"
import { cn } from "@/lib/utils"
import {
  Search, Package, AlertTriangle, XOctagon, DollarSign, Plus,
  Trash2, Eye, CheckCircle2, ArrowDownToLine, ArrowUpFromLine,
  FileText, Repeat, ArrowRight, Clock, Inbox, UserCheck, Truck, Users,
  Send, RefreshCw, FileSpreadsheet
} from "lucide-react"
import { exportInventoryCheckSheet } from "@/lib/export-inventory-check"
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis
} from "@/components/ui/pagination"

const INV_PAGE_SIZE = 20

interface GrnRow { sku: string; qty: number; cost: number }
interface ExportRow { sku: string; qty: number; reason: string }
interface SlipItemRow { sku: string; qty: number; unitCost: number }

export default function AdminInventory() {
  const ctx = useInventory()
  const { inventory, transactions, transferRequests, adminSlips } = ctx

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [warehouseFilter, setWarehouseFilter] = useState("all")
  const [alertOnly, setAlertOnly] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  // GRN state
  const [grnRows, setGrnRows] = useState<GrnRow[]>([{ sku: "", qty: 1, cost: 0 }])
  const [grnWarehouse, setGrnWarehouse] = useState("")
  const [grnSupplier, setGrnSupplier] = useState("")
  const [grnPo, setGrnPo] = useState("")
  const [grnDate, setGrnDate] = useState(new Date().toISOString().split("T")[0])
  const [grnNote, setGrnNote] = useState("")
  const [grnSuccess, setGrnSuccess] = useState(false)

  // Export state
  const [exportRows, setExportRows] = useState<ExportRow[]>([{ sku: "", qty: 1, reason: "" }])
  const [exportWarehouse, setExportWarehouse] = useState("")
  const [exportDate, setExportDate] = useState(new Date().toISOString().split("T")[0])
  const [exportNote, setExportNote] = useState("")
  const [exportSuccess, setExportSuccess] = useState(false)

  // Create slip state
  const [slipType, setSlipType] = useState<"import" | "export">("import")
  const [slipWarehouse, setSlipWarehouse] = useState("")
  const [slipSupplier, setSlipSupplier] = useState("")
  const [slipPo, setSlipPo] = useState("")
  const [slipItems, setSlipItems] = useState<SlipItemRow[]>([{ sku: "", qty: 1, unitCost: 0 }])
  const [slipNote, setSlipNote] = useState("")
  const [slipSuccess, setSlipSuccess] = useState(false)
  const [slipFilter, setSlipFilter] = useState<"all" | "pending" | "processed">("all")
  const [invPage, setInvPage] = useState(1)

  // Transfer management state
  const [transferFilter, setTransferFilter] = useState<"all" | "pending" | "in-transit" | "completed" | "rejected">("all")
  const [transferDetailOpen, setTransferDetailOpen] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRequest | null>(null)

  const [suppliers, setSuppliers] = useState<{id: number; name: string}[]>([])
  useEffect(() => {
    purchaseOrderApi.getSuppliers().then((res: any) => {
      if (res.success && res.data) setSuppliers(res.data.map((s: any) => ({ id: s.id, name: s.name })))
    }).catch(() => {})
  }, [])

  const categories = [...new Set(inventory.map(i => i.category))]
  const warehouses = [...new Set(inventory.map(i => i.warehouse))]

  // Công thức tổng hợp:
  // totalValue  = Σ(onHand × unitCost)               — tổng giá trị hàng vật lý trong kho
  // lowStock    = count where 0 < available ≤ reorderPoint
  // outOfStock  = count where available === 0
  const totalValue = useMemo(() => inventory.reduce((sum, i) => sum + i.onHand * i.unitCost, 0), [inventory])
  const lowStock = useMemo(() => inventory.filter(i => i.available > 0 && i.available <= i.reorderPoint).length, [inventory])
  const outOfStock = useMemo(() => inventory.filter(i => i.available === 0).length, [inventory])
  const pendingSlipsCount = adminSlips.filter(s => s.status === "pending").length
  const pendingTransfersCount = transferRequests.filter(t => t.status === "pending").length

  const summaryCards = [
    { title: "Tổng SKU", value: inventory.length.toString(), icon: <Package className="h-5 w-5" />, color: "bg-primary/10 text-primary" },
    { title: "Tổng giá trị", value: formatVND(totalValue), icon: <DollarSign className="h-5 w-5" />, color: "bg-secondary/10 text-secondary" },
    { title: "Sắp hết hàng", value: lowStock.toString(), icon: <AlertTriangle className="h-5 w-5" />, color: "bg-amber-100 text-amber-600", alert: lowStock > 0 },
    { title: "Hết hàng", value: outOfStock.toString(), icon: <XOctagon className="h-5 w-5" />, color: "bg-red-100 text-red-600", alert: outOfStock > 0 },
  ]

  const filtered = inventory.filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.sku.toLowerCase().includes(search.toLowerCase())) return false
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false
    if (warehouseFilter !== "all" && item.warehouse !== warehouseFilter) return false
    if (alertOnly && item.available > item.reorderPoint) return false
    return true
  })

  // Pagination
  const invTotalPages = Math.max(1, Math.ceil(filtered.length / INV_PAGE_SIZE))
  const invSafePage = Math.min(invPage, invTotalPages)
  const paginatedFiltered = useMemo(() => {
    const start = (invSafePage - 1) * INV_PAGE_SIZE
    return filtered.slice(start, start + INV_PAGE_SIZE)
  }, [filtered, invSafePage])

  const getInvPageNumbers = () => {
    const pages: (number | "...")[] = []
    if (invTotalPages <= 7) {
      for (let i = 1; i <= invTotalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (invSafePage > 3) pages.push("...")
      for (let i = Math.max(2, invSafePage - 1); i <= Math.min(invTotalPages - 1, invSafePage + 1); i++) pages.push(i)
      if (invSafePage < invTotalPages - 2) pages.push("...")
      pages.push(invTotalPages)
    }
    return pages
  }

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleGrnConfirm = () => {
    const validRows = grnRows.filter(r => r.sku && r.qty > 0)
    if (validRows.length === 0 || !grnWarehouse) return

    ctx.importItems({
      items: validRows.map(r => ({
        sku: r.sku,
        name: inventory.find(it => it.sku === r.sku)?.name || r.sku,
        qty: r.qty,
        cost: r.cost,
      })),
      warehouse: grnWarehouse,
      note: grnNote,
      date: grnDate,
      operator: "Admin",
    })

    setGrnSuccess(true)
    setGrnRows([{ sku: "", qty: 1, cost: 0 }])
    setGrnNote("")
    setTimeout(() => setGrnSuccess(false), 3000)
  }

  const handleExportConfirm = () => {
    const validRows = exportRows.filter(r => r.sku && r.qty > 0)
    if (validRows.length === 0) return

    const success = ctx.exportItems({
      items: validRows.map(r => ({
        sku: r.sku,
        name: inventory.find(it => it.sku === r.sku)?.name || r.sku,
        qty: r.qty,
        reason: r.reason,
      })),
      warehouse: exportWarehouse,
      note: exportNote,
      date: exportDate,
      operator: "Admin",
    })

    if (!success) return

    setExportSuccess(true)
    setExportRows([{ sku: "", qty: 1, reason: "" }])
    setExportNote("")
    setTimeout(() => setExportSuccess(false), 3000)
  }

  const handleCreateSlip = () => {
    const validItems = slipItems.filter(i => i.sku && i.qty > 0)
    if (validItems.length === 0 || !slipWarehouse) return

    ctx.createAdminSlip({
      type: slipType,
      source: "admin",
      poId: slipPo || undefined,
      supplier: slipType === "import" ? suppliers.find(s => s.id.toString() === slipSupplier)?.name : undefined,
      date: new Date().toISOString().split("T")[0],
      warehouse: slipWarehouse,
      items: validItems.map(item => ({
        sku: item.sku,
        name: inventory.find(i => i.sku === item.sku)?.name || item.sku,
        qty: item.qty,
        unitCost: item.unitCost,
      })),
      note: slipNote,
      status: "pending",
      createdBy: "Admin",
      assignedTo: "Nhân viên kho",
    })

    setSlipSuccess(true)
    setSlipItems([{ sku: "", qty: 1, unitCost: 0 }])
    setSlipNote("")
    setSlipPo("")
    setTimeout(() => setSlipSuccess(false), 3000)
  }

  const handleAdminTransferAction = (id: string, action: "rejected") => {
    ctx.updateTransferStatus(id, action)
    setTransferDetailOpen(false)
    setSelectedTransfer(null)
  }

  const filteredSlips = adminSlips.filter(s => slipFilter === "all" || s.status === slipFilter)
  const filteredTransfers = transferRequests.filter(t => transferFilter === "all" || t.status === transferFilter)

  const pickupMethodLabel = (method: TransferRequest["pickupMethod"]) => {
    switch (method) {
      case "employee": return "NV qua lấy"
      case "delivery": return "Giao vận"
      case "customer": return "Khách lấy"
    }
  }

  const pickupMethodColor = (method: TransferRequest["pickupMethod"]) => {
    switch (method) {
      case "employee": return "bg-blue-100 text-blue-700"
      case "delivery": return "bg-amber-100 text-amber-700"
      case "customer": return "bg-pink-100 text-pink-700"
    }
  }

  const exportAvailableItems = useMemo(() => {
    if (!exportWarehouse) return inventory.filter(i => i.available > 0)
    return inventory.filter(i => i.warehouse === exportWarehouse && i.available > 0)
  }, [inventory, exportWarehouse])

  // Deduplicate SKUs for select (show unique SKUs)
  const uniqueSkuItems = useMemo(() => {
    const seen = new Set<string>()
    return inventory.filter(i => {
      if (seen.has(i.sku)) return false
      seen.add(i.sku)
      return true
    })
  }, [inventory])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Quản lý tồn kho</h1>
          <p className="text-sm text-muted-foreground">Theo dõi, nhập xuất và điều chuyển hàng tồn kho</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => {
              exportInventoryCheckSheet({
                items: filtered,
                warehouseFilter,
                categoryFilter,
                exportedBy: "Admin",
              })
            }}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Xuất phiếu kiểm kê
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={ctx.resetAll}>
            <RefreshCw className="h-3.5 w-3.5" /> Reset dữ liệu
          </Button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {summaryCards.map((card, i) => (
          <Card key={i} className={cn("hover:-translate-y-0.5 transition-all", card.alert && "border-red-200")}>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="grn" className="gap-1.5"><ArrowDownToLine className="h-3.5 w-3.5" /> Nhập kho</TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5"><ArrowUpFromLine className="h-3.5 w-3.5" /> Xuất hàng</TabsTrigger>
          <TabsTrigger value="slips" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Tạo phiếu
            {pendingSlipsCount > 0 && <Badge className="ml-1 h-5 min-w-[20px] rounded-full bg-amber-500 text-white text-[10px] px-1.5">{pendingSlipsCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="transfers" className="gap-1.5">
            <Repeat className="h-3.5 w-3.5" /> Điều chuyển
            {pendingTransfersCount > 0 && <Badge className="ml-1 h-5 min-w-[20px] rounded-full bg-purple-500 text-white text-[10px] px-1.5">{pendingTransfersCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history">Lịch sử</TabsTrigger>
        </TabsList>

        {/* ═══════════════════ OVERVIEW TAB ═══════════════════ */}
        <TabsContent value="overview">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Tìm SKU, tên sản phẩm..." value={search} onChange={e => { setSearch(e.target.value); setInvPage(1) }} className="pl-9 h-9" />
            </div>
            <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setInvPage(1) }}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Danh mục" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả danh mục</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={warehouseFilter} onValueChange={v => { setWarehouseFilter(v); setInvPage(1) }}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Kho" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả kho</SelectItem>
                {warehouses.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch id="alert-only" checked={alertOnly} onCheckedChange={v => { setAlertOnly(v); setInvPage(1) }} />
              <Label htmlFor="alert-only" className="text-sm">Chỉ cảnh báo</Label>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-2">
            Hiển thị {(invSafePage - 1) * INV_PAGE_SIZE + 1}–{Math.min(invSafePage * INV_PAGE_SIZE, filtered.length)} / {filtered.length} mục
          </p>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-12"></TableHead>
                    <TableHead className="text-xs">SKU</TableHead>
                    <TableHead className="text-xs">Sản phẩm</TableHead>
                    <TableHead className="text-xs">Danh mục</TableHead>
                    <TableHead className="text-xs">Kho</TableHead>
                    <TableHead className="text-xs text-center">Tồn kho</TableHead>
                    <TableHead className="text-xs text-center">Đã đặt</TableHead>
                    <TableHead className="text-xs text-center">Khả dụng</TableHead>
                    <TableHead className="text-xs text-center">Điểm đặt lại</TableHead>
                    <TableHead className="text-xs text-right">Đơn giá</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedFiltered.map((item, idx) => (
                    <TableRow key={`${item.sku}-${item.warehouseId ?? idx}`} className={cn(
                      "hover:bg-muted/50",
                      idx % 2 !== 0 && "bg-muted/20",
                      item.available === 0 && "bg-red-50/50",
                      item.available > 0 && item.available <= item.reorderPoint && "bg-amber-50/50"
                    )}>
                      <TableCell>
                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-primary">{item.sku}</TableCell>
                      <TableCell><p className="text-sm font-medium">{item.name}</p></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{item.category}</Badge></TableCell>
                      <TableCell className="text-sm">{item.warehouse}</TableCell>
                      <TableCell className="text-center text-sm">{item.onHand}</TableCell>
                      <TableCell className="text-center text-sm">{item.reserved}</TableCell>
                      <TableCell className="text-center">
                        <StockLevelIndicator available={item.available} reorderPoint={item.reorderPoint} />
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">{item.reorderPoint}</TableCell>
                      <TableCell className="text-right text-sm">{formatVND(item.unitCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {invTotalPages > 1 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setInvPage(p => Math.max(1, p - 1))}
                      className={cn("cursor-pointer", invSafePage === 1 && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>
                  {getInvPageNumbers().map((page, i) => (
                    <PaginationItem key={i}>
                      {page === "..." ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          isActive={page === invSafePage}
                          onClick={() => setInvPage(page as number)}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setInvPage(p => Math.min(invTotalPages, p + 1))}
                      className={cn("cursor-pointer", invSafePage === invTotalPages && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════ IMPORT (GRN) TAB ═══════════════════ */}
        <TabsContent value="grn">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5 text-secondary" /> Phiếu nhập kho mới
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {grnSuccess && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium text-green-800">Nhập kho thành công! Số lượng tồn kho đã được cập nhật.</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label className="text-sm">Kho</Label>
                  <Select value={grnWarehouse} onValueChange={setGrnWarehouse}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn kho" /></SelectTrigger>
                    <SelectContent>{warehouses.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Nhà cung cấp</Label>
                  <Select value={grnSupplier} onValueChange={setGrnSupplier}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn NCC" /></SelectTrigger>
                    <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Tham chiếu PO</Label>
                  <Input className="mt-1" placeholder="PO-YYYYMMDD-XXXX" value={grnPo} onChange={e => setGrnPo(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">Ngày nhập</Label>
                  <Input className="mt-1" type="date" value={grnDate} onChange={e => setGrnDate(e.target.value)} />
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">SKU / Sản phẩm</TableHead>
                    <TableHead className="text-xs w-24">Số lượng</TableHead>
                    <TableHead className="text-xs w-36">Đơn giá</TableHead>
                    <TableHead className="text-xs w-36 text-right">Thành tiền</TableHead>
                    <TableHead className="text-xs w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grnRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Select value={row.sku} onValueChange={v => {
                          const newRows = [...grnRows]; newRows[i].sku = v
                          const item = inventory.find(it => it.sku === v)
                          if (item) newRows[i].cost = item.unitCost
                          setGrnRows(newRows)
                        }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Chọn sản phẩm" /></SelectTrigger>
                          <SelectContent>{uniqueSkuItems.map(item => (
                            <SelectItem key={item.sku} value={item.sku}>{item.sku} - {item.name}</SelectItem>
                          ))}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={1} value={row.qty} onChange={e => { const newRows = [...grnRows]; newRows[i].qty = parseInt(e.target.value) || 1; setGrnRows(newRows) }} className="h-8 text-xs" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} value={row.cost} onChange={e => { const newRows = [...grnRows]; newRows[i].cost = parseInt(e.target.value) || 0; setGrnRows(newRows) }} className="h-8 text-xs" />
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatVND(row.qty * row.cost)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setGrnRows(grnRows.filter((_, idx) => idx !== i))} disabled={grnRows.length === 1}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-between items-center bg-muted/50 px-4 py-3 rounded-lg">
                <span className="text-sm font-medium">Tổng cộng: {grnRows.filter(r => r.sku).length} sản phẩm</span>
                <span className="font-serif text-lg font-bold text-primary">{formatVND(grnRows.reduce((s, r) => s + r.qty * r.cost, 0))}</span>
              </div>

              <div>
                <Label className="text-sm">Ghi chú</Label>
                <Textarea className="mt-1" placeholder="Ghi chú phiếu nhập..." value={grnNote} onChange={e => setGrnNote(e.target.value)} />
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setGrnRows([...grnRows, { sku: "", qty: 1, cost: 0 }])}>
                  <Plus className="h-4 w-4 mr-1" /> Thêm dòng
                </Button>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => { setGrnRows([{ sku: "", qty: 1, cost: 0 }]); setGrnNote("") }}>Huỷ</Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-secondary hover:bg-secondary/90 text-secondary-foreground" disabled={!grnRows.some(r => r.sku && r.qty > 0) || !grnWarehouse}>
                      Xác nhận nhập kho
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle className="font-serif">Xác nhận nhập kho</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">Lưu ý</p>
                          <p className="text-xs text-amber-700 mt-1">Thao tác này sẽ cập nhật số lượng tồn kho ngay lập tức.</p>
                        </div>
                      </div>
                      <div className="text-sm space-y-1">
                        <p>Kho: <strong>{grnWarehouse}</strong></p>
                        <p>Số lượng sản phẩm: <strong>{grnRows.filter(r => r.sku).length}</strong></p>
                        <p>Tổng tiền: <strong className="text-primary">{formatVND(grnRows.reduce((s, r) => s + r.qty * r.cost, 0))}</strong></p>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="outline">Huỷ</Button></DialogClose>
                      <DialogClose asChild><Button className="bg-secondary hover:bg-secondary/90 text-secondary-foreground" onClick={handleGrnConfirm}>Xác nhận</Button></DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ EXPORT TAB ═══════════════════ */}
        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <ArrowUpFromLine className="h-5 w-5 text-primary" /> Phiếu xuất hàng mới
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {exportSuccess && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium text-green-800">Xuất hàng thành công!</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label className="text-sm">Kho xuất</Label>
                  <Select value={exportWarehouse} onValueChange={setExportWarehouse}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn kho" /></SelectTrigger>
                    <SelectContent>{warehouses.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Ngày xuất</Label>
                  <Input className="mt-1" type="date" value={exportDate} onChange={e => setExportDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">Ghi chú chung</Label>
                  <Input className="mt-1" placeholder="Lý do xuất hàng..." value={exportNote} onChange={e => setExportNote(e.target.value)} />
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">SKU / Sản phẩm</TableHead>
                    <TableHead className="text-xs w-24">Tồn kho</TableHead>
                    <TableHead className="text-xs w-24">Số lượng xuất</TableHead>
                    <TableHead className="text-xs w-48">Lý do</TableHead>
                    <TableHead className="text-xs w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exportRows.map((row, i) => {
                    const item = exportAvailableItems.find(it => it.sku === row.sku)
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <Select value={row.sku} onValueChange={v => { const newRows = [...exportRows]; newRows[i].sku = v; setExportRows(newRows) }}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Chọn sản phẩm" /></SelectTrigger>
                            <SelectContent>
                              {exportAvailableItems.map(item => (
                                <SelectItem key={item.id + item.warehouse} value={item.sku}>{item.sku} - {item.name} (còn: {item.available})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-center font-medium">{item ? item.available : "-"}</TableCell>
                        <TableCell>
                          <Input type="number" min={1} max={item?.available || 999} value={row.qty} onChange={e => { const newRows = [...exportRows]; newRows[i].qty = parseInt(e.target.value) || 1; setExportRows(newRows) }} className={cn("h-8 text-xs", item && row.qty > item.available && "border-red-400")} />
                        </TableCell>
                        <TableCell>
                          <Select value={row.reason} onValueChange={v => { const newRows = [...exportRows]; newRows[i].reason = v; setExportRows(newRows) }}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Chọn lý do" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Bán hàng">Bán hàng</SelectItem>
                              <SelectItem value="Chuyển kho">Chuyển kho</SelectItem>
                              <SelectItem value="Hàng lỗi">Hàng lỗi / Trả NCC</SelectItem>
                              <SelectItem value="Tặng/Khuyến mãi">Tặng / Khuyến mãi</SelectItem>
                              <SelectItem value="Khác">Khác</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setExportRows(exportRows.filter((_, idx) => idx !== i))} disabled={exportRows.length === 1}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setExportRows([...exportRows, { sku: "", qty: 1, reason: "" }])}>
                  <Plus className="h-4 w-4 mr-1" /> Thêm dòng
                </Button>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => { setExportRows([{ sku: "", qty: 1, reason: "" }]); setExportNote("") }}>Huỷ</Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!exportRows.some(r => r.sku && r.qty > 0)}>
                      Xác nhận xuất hàng
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle className="font-serif">Xác nhận xuất hàng</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">Thao tác này sẽ trừ số lượng tồn kho.</p>
                      </div>
                      <div className="text-sm">
                        <p>Kho xuất: <strong>{exportWarehouse || "Chưa chọn"}</strong></p>
                        <p>Số lượng sản phẩm: <strong>{exportRows.filter(r => r.sku).length}</strong></p>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="outline">Huỷ</Button></DialogClose>
                      <DialogClose asChild><Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleExportConfirm}>Xác nhận</Button></DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ CREATE SLIPS TAB ═══════════════════ */}
        <TabsContent value="slips">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Create slip form */}
            <Card>
              <CardHeader>
                <CardTitle className="font-serif flex items-center gap-2">
                  <Send className="h-5 w-5 text-blue-600" /> Tạo phiếu cho nhân viên
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {slipSuccess && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="text-sm font-medium text-green-800">Phiếu đã được tạo! Nhân viên kho sẽ thấy trong tab &ldquo;Phiếu từ Admin&rdquo;.</p>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <p className="text-xs text-blue-700">Phiếu sẽ xuất hiện trong tab &ldquo;Phiếu từ Admin&rdquo; ở trang nhân viên kho. Nhân viên sẽ xử lý và cập nhật tồn kho.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSlipType("import")} className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all",
                    slipType === "import" ? "border-green-500 bg-green-50 text-green-700" : "border-muted hover:border-green-200 text-muted-foreground"
                  )}>
                    <ArrowDownToLine className="h-5 w-5" /> Phiếu nhập kho
                  </button>
                  <button type="button" onClick={() => setSlipType("export")} className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all",
                    slipType === "export" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-muted hover:border-orange-200 text-muted-foreground"
                  )}>
                    <ArrowUpFromLine className="h-5 w-5" /> Phiếu xuất kho
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm">Kho</Label>
                    <Select value={slipWarehouse} onValueChange={setSlipWarehouse}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn kho" /></SelectTrigger>
                      <SelectContent>{warehouses.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {slipType === "import" && (
                    <div>
                      <Label className="text-sm">Nhà cung cấp</Label>
                      <Select value={slipSupplier} onValueChange={setSlipSupplier}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn NCC" /></SelectTrigger>
                        <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  {slipType === "import" && (
                    <div>
                      <Label className="text-sm">Tham chiếu PO</Label>
                      <Input className="mt-1" placeholder="PO-YYYYMMDD-XXXX" value={slipPo} onChange={e => setSlipPo(e.target.value)} />
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-sm mb-2 block">Sản phẩm</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">SKU / Sản phẩm</TableHead>
                        <TableHead className="text-xs w-20">SL</TableHead>
                        <TableHead className="text-xs w-28">Đơn giá</TableHead>
                        <TableHead className="text-xs w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slipItems.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Select value={row.sku} onValueChange={v => {
                              const newItems = [...slipItems]; newItems[i].sku = v
                              const item = inventory.find(it => it.sku === v)
                              if (item) newItems[i].unitCost = item.unitCost
                              setSlipItems(newItems)
                            }}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Chọn SP" /></SelectTrigger>
                              <SelectContent>{uniqueSkuItems.map(item => (
                                <SelectItem key={item.sku} value={item.sku}>{item.sku} - {item.name}</SelectItem>
                              ))}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={1} value={row.qty} onChange={e => { const newItems = [...slipItems]; newItems[i].qty = parseInt(e.target.value) || 1; setSlipItems(newItems) }} className="h-8 text-xs" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} value={row.unitCost} onChange={e => { const newItems = [...slipItems]; newItems[i].unitCost = parseInt(e.target.value) || 0; setSlipItems(newItems) }} className="h-8 text-xs" />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setSlipItems(slipItems.filter((_, idx) => idx !== i))} disabled={slipItems.length === 1}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setSlipItems([...slipItems, { sku: "", qty: 1, unitCost: 0 }])}>
                    <Plus className="h-4 w-4 mr-1" /> Thêm dòng
                  </Button>
                </div>

                <div>
                  <Label className="text-sm">Ghi chú</Label>
                  <Textarea className="mt-1" placeholder="Ghi chú phiếu..." value={slipNote} onChange={e => setSlipNote(e.target.value)} />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => { setSlipItems([{ sku: "", qty: 1, unitCost: 0 }]); setSlipNote("") }}>Huỷ</Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!slipItems.some(i => i.sku && i.qty > 0) || !slipWarehouse}>
                        <Send className="h-4 w-4 mr-1" /> Tạo phiếu
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle className="font-serif">Xác nhận tạo phiếu</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <FileText className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium text-blue-800">Phiếu {slipType === "import" ? "nhập" : "xuất"} kho tại {slipWarehouse}</p>
                            <p className="text-xs text-blue-600 mt-0.5">Nhân viên kho sẽ nhận và xử lý phiếu này</p>
                          </div>
                        </div>
                        <div className="border rounded-lg divide-y">
                          {slipItems.filter(i => i.sku).map((item, idx) => {
                            const inv = inventory.find(i => i.sku === item.sku)
                            return (
                              <div key={idx} className="flex items-center justify-between p-3 text-sm">
                                <div>
                                  <p className="font-medium">{inv?.name || item.sku}</p>
                                  <p className="text-xs text-muted-foreground">{item.sku}</p>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold">×{item.qty}</span>
                                  <p className="text-xs text-muted-foreground">{formatVND(item.unitCost)}/sp</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex justify-between items-center bg-muted/50 px-3 py-2 rounded-lg text-sm">
                          <span>Tổng giá trị</span>
                          <strong className="text-blue-600">{formatVND(slipItems.reduce((s, i) => s + i.qty * i.unitCost, 0))}</strong>
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Huỷ</Button></DialogClose>
                        <DialogClose asChild><Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreateSlip}>Tạo phiếu</Button></DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Slip list */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Inbox className="h-5 w-5 text-blue-600" /> Danh sách phiếu
                    {pendingSlipsCount > 0 && <Badge className="bg-amber-500 text-white text-xs px-2">{pendingSlipsCount} chờ</Badge>}
                  </CardTitle>
                  <Select value={slipFilter} onValueChange={v => setSlipFilter(v as typeof slipFilter)}>
                    <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="pending">Chờ xử lý</SelectItem>
                      <SelectItem value="processed">Đã xử lý</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredSlips.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                    <p className="text-sm text-muted-foreground">Chưa có phiếu nào</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {filteredSlips.map(slip => (
                      <div key={slip.id} className={cn(
                        "rounded-lg border p-3 hover:shadow-sm transition-all",
                        slip.status === "pending" && "border-amber-200 bg-amber-50/30",
                        slip.status === "processed" && "border-green-200 bg-green-50/30"
                      )}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-xs font-bold text-blue-600">{slip.id}</span>
                          <div className="flex items-center gap-1.5">
                            <Badge className={cn("text-[10px]",
                              slip.type === "import" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                            )}>{slip.type === "import" ? "Nhập" : "Xuất"}</Badge>
                            <Badge className={cn("text-[10px]",
                              slip.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                            )}>{slip.status === "pending" ? "Chờ xử lý" : "Đã xử lý"}</Badge>
                          </div>
                        </div>
                        <p className="text-sm">{slip.warehouse}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {slip.items.map((item, idx) => (
                            <span key={idx} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{item.name} ×{item.qty}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {slip.date}</span>
                          {slip.supplier && <span>NCC: {slip.supplier}</span>}
                          {slip.poId && <span>PO: {slip.poId}</span>}
                        </div>
                        {slip.status === "processed" && slip.processedAt && (
                          <p className="text-[10px] text-emerald-600 mt-1">
                            Xử lý lúc {new Date(slip.processedAt).toLocaleString("vi-VN")} bởi {slip.processedBy}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ TRANSFER MANAGEMENT TAB ═══════════════════ */}
        <TabsContent value="transfers">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <span className="p-2 rounded-lg bg-purple-100 text-purple-600 inline-flex"><Repeat className="h-4 w-4" /></span>
                  <p className="font-serif text-xl font-extrabold mt-2">{transferRequests.length}</p>
                  <p className="text-xs text-muted-foreground">Tổng điều chuyển</p>
                </CardContent>
              </Card>
              <Card className={cn(pendingTransfersCount > 0 && "border-amber-200")}>
                <CardContent className="p-4">
                  <span className="p-2 rounded-lg bg-amber-100 text-amber-600 inline-flex"><Clock className="h-4 w-4" /></span>
                  <p className="font-serif text-xl font-extrabold mt-2">{pendingTransfersCount}</p>
                  <p className="text-xs text-muted-foreground">Chờ duyệt</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <span className="p-2 rounded-lg bg-indigo-100 text-indigo-600 inline-flex"><Truck className="h-4 w-4" /></span>
                  <p className="font-serif text-xl font-extrabold mt-2">{transferRequests.filter(t => t.status === "in-transit").length}</p>
                  <p className="text-xs text-muted-foreground">Đang vận chuyển</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <span className="p-2 rounded-lg bg-emerald-100 text-emerald-600 inline-flex"><CheckCircle2 className="h-4 w-4" /></span>
                  <p className="font-serif text-xl font-extrabold mt-2">{transferRequests.filter(t => t.status === "completed").length}</p>
                  <p className="text-xs text-muted-foreground">Hoàn tất</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-3">
              <Select value={transferFilter} onValueChange={v => setTransferFilter(v as typeof transferFilter)}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="pending">Chờ duyệt</SelectItem>
                  <SelectItem value="in-transit">Đang vận chuyển</SelectItem>
                  <SelectItem value="completed">Hoàn tất</SelectItem>
                  <SelectItem value="rejected">Đã từ chối</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{filteredTransfers.length} phiếu</span>
            </div>

            {filteredTransfers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Repeat className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground">Không có phiếu điều chuyển nào</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredTransfers.map(t => (
                  <Card key={t.id} className={cn(
                    "hover:shadow-md transition-all",
                    t.status === "pending" && "border-amber-200 bg-amber-50/30",
                    t.status === "in-transit" && "border-indigo-200 bg-indigo-50/30",
                    t.status === "completed" && "border-green-200 bg-green-50/30",
                    t.status === "rejected" && "border-red-200 bg-red-50/30"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-mono text-sm font-bold text-purple-600">{t.reference}</span>
                            <Badge className={cn("text-[10px]", pickupMethodColor(t.pickupMethod))}>
                              {t.pickupMethod === "employee" && <UserCheck className="h-3 w-3 mr-0.5" />}
                              {t.pickupMethod === "delivery" && <Truck className="h-3 w-3 mr-0.5" />}
                              {t.pickupMethod === "customer" && <Users className="h-3 w-3 mr-0.5" />}
                              {pickupMethodLabel(t.pickupMethod)}
                            </Badge>
                            <Badge className={cn("text-[10px]",
                              t.status === "pending" ? "bg-amber-100 text-amber-700" :
                              t.status === "in-transit" ? "bg-indigo-100 text-indigo-700" :
                              t.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                              "bg-red-100 text-red-700"
                            )}>
                              {t.status === "pending" ? "Chờ duyệt" : t.status === "in-transit" ? "Đang vận chuyển" : t.status === "completed" ? "Hoàn tất" : "Đã từ chối"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs mb-1.5">
                            <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700">{t.fromWarehouse}</Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="outline" className="text-[10px] border-teal-300 text-teal-700">{t.toWarehouse}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {t.items.map((item, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs font-normal">{item.name} ×{item.qty}</Badge>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {t.date}</span>
                            <span>Người yêu cầu: {t.createdBy}</span>
                            <span>Lý do: {t.reason}</span>
                            {t.customerName && <span className="text-blue-600">KH: {t.customerName}</span>}
                          </div>
                          {t.approvedBy && <p className="text-xs text-indigo-600 mt-1">Duyệt bởi: {t.approvedBy}</p>}
                          {t.completedAt && <p className="text-xs text-emerald-600 mt-1">Hoàn tất: {new Date(t.completedAt).toLocaleString("vi-VN")}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => { setSelectedTransfer(t); setTransferDetailOpen(true) }}>
                            <Eye className="h-4 w-4 mr-1" /> Chi tiết
                          </Button>
                          {t.status === "pending" && (
                            <Button variant="destructive" size="sm" onClick={() => handleAdminTransferAction(t.id, "rejected")}>
                              Từ chối
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Transfer Detail Dialog */}
          <Dialog open={transferDetailOpen} onOpenChange={setTransferDetailOpen}>
            <DialogContent className="max-w-lg">
              {selectedTransfer && (
                <>
                  <DialogHeader>
                    <DialogTitle className="font-serif flex items-center gap-2">
                      <Repeat className="h-5 w-5 text-purple-600" /> Phiếu {selectedTransfer.reference}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 justify-center p-3 bg-purple-50 rounded-lg">
                      <Badge variant="outline">{selectedTransfer.fromWarehouse}</Badge>
                      <ArrowRight className="h-4 w-4 text-purple-600" />
                      <Badge variant="outline">{selectedTransfer.toWarehouse}</Badge>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Badge className={cn("text-[10px]",
                        selectedTransfer.status === "pending" ? "bg-amber-100 text-amber-700" :
                        selectedTransfer.status === "in-transit" ? "bg-indigo-100 text-indigo-700" :
                        selectedTransfer.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}>
                        {selectedTransfer.status === "pending" ? "Chờ duyệt" : selectedTransfer.status === "in-transit" ? "Đang vận chuyển" : selectedTransfer.status === "completed" ? "Hoàn tất" : "Đã từ chối"}
                      </Badge>
                      <Badge className={cn("text-[10px]", pickupMethodColor(selectedTransfer.pickupMethod))}>{pickupMethodLabel(selectedTransfer.pickupMethod)}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Ngày:</span> {selectedTransfer.date}</div>
                      <div><span className="text-muted-foreground">Lý do:</span> {selectedTransfer.reason}</div>
                      <div><span className="text-muted-foreground">Người yêu cầu:</span> {selectedTransfer.createdBy}</div>
                      {selectedTransfer.approvedBy && <div><span className="text-muted-foreground">Duyệt bởi:</span> {selectedTransfer.approvedBy}</div>}
                    </div>
                    {selectedTransfer.customerName && (
                      <div className="p-2 bg-blue-50 rounded border border-blue-200 text-sm">
                        Khách hàng: <strong>{selectedTransfer.customerName}</strong> {selectedTransfer.customerPhone && `— ${selectedTransfer.customerPhone}`}
                      </div>
                    )}
                    {selectedTransfer.note && <p className="text-sm bg-muted/50 p-2 rounded">{selectedTransfer.note}</p>}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">SKU</TableHead>
                          <TableHead className="text-xs">Sản phẩm</TableHead>
                          <TableHead className="text-xs text-center">SL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedTransfer.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs text-blue-600">{item.sku}</TableCell>
                            <TableCell className="text-sm">{item.name}</TableCell>
                            <TableCell className="text-center text-sm font-bold text-purple-600">{item.qty}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Đóng</Button></DialogClose>
                    {selectedTransfer.status === "pending" && (
                      <Button variant="destructive" size="sm" onClick={() => handleAdminTransferAction(selectedTransfer.id, "rejected")}>
                        Từ chối yêu cầu
                      </Button>
                    )}
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ═══════════════════ TRANSACTION HISTORY TAB ═══════════════════ */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Lịch sử nhập xuất</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Chưa có giao dịch nào</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Mã</TableHead>
                      <TableHead className="text-xs">Loại</TableHead>
                      <TableHead className="text-xs">Ngày</TableHead>
                      <TableHead className="text-xs">Sản phẩm</TableHead>
                      <TableHead className="text-xs">Kho</TableHead>
                      <TableHead className="text-xs text-center">Số lượng</TableHead>
                      <TableHead className="text-xs text-right">Giá trị</TableHead>
                      <TableHead className="text-xs">Người thực hiện</TableHead>
                      <TableHead className="text-xs">Ghi chú</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-xs">{tx.id.slice(0, 15)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-xs",
                            tx.type === "import" ? "bg-green-100 text-green-700" :
                            tx.type === "export" ? "bg-orange-100 text-orange-700" :
                            tx.type === "transfer-out" ? "bg-purple-100 text-purple-700" : "bg-teal-100 text-teal-700"
                          )}>
                            {tx.type === "import" ? "Nhập" : tx.type === "export" ? "Xuất" : tx.type === "transfer-out" ? "Xuất DC" : "Nhận DC"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{tx.date}</TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{tx.productName}</p>
                          <p className="text-xs text-muted-foreground">{tx.sku}</p>
                        </TableCell>
                        <TableCell className="text-xs">{tx.warehouse || "-"}</TableCell>
                        <TableCell className={cn("text-center text-sm font-medium",
                          (tx.type === "import" || tx.type === "transfer-in") ? "text-green-600" : "text-orange-600"
                        )}>
                          {(tx.type === "import" || tx.type === "transfer-in") ? "+" : "-"}{tx.qty}
                        </TableCell>
                        <TableCell className="text-right text-sm">{tx.cost > 0 ? formatVND(tx.qty * tx.cost) : "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{tx.operator || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{tx.note || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
