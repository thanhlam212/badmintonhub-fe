"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { StockLevelIndicator } from "@/components/shared"
import { formatVND } from "@/lib/utils"
import { purchaseOrderApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useInventory, type InventoryTransaction, type TransferRequest } from "@/lib/inventory-context"
import {
  Search, Package, AlertTriangle, XOctagon, DollarSign, Plus,
  Trash2, Eye, CheckCircle2, ArrowDownToLine, ArrowUpFromLine,
  FileText, ClipboardCheck, Clock, Inbox, Repeat, MapPin, ArrowRight, Truck, Download, Upload,
  UserCheck, Users, ChevronsUpDown, Check, FileSpreadsheet
} from "lucide-react"
import { exportInventoryCheckSheet } from "@/lib/export-inventory-check"
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis
} from "@/components/ui/pagination"

const EMP_INV_PAGE_SIZE = 20

interface GrnRow { sku: string; qty: number; cost: number }
interface ExportRow { sku: string; qty: number; reason: string }
interface TransferRow { sku: string; qty: number }

export default function EmployeeInventory() {
  const { user } = useAuth()
  const myWarehouse = user?.warehouse || ""
  const ctx = useInventory()
  const { inventory, transactions, transferRequests, adminSlips } = ctx

  const [suppliers, setSuppliers] = useState<{id: number; name: string}[]>([])
  useEffect(() => {
    purchaseOrderApi.getSuppliers().then((res: any) => {
      if (res.success && res.data) setSuppliers(res.data.map((s: any) => ({ id: s.id, name: s.name })))
    }).catch(() => {})
  }, [])

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [warehouseFilter, setWarehouseFilter] = useState("all")
  const [alertOnly, setAlertOnly] = useState(false)

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
  const [exportDate, setExportDate] = useState(new Date().toISOString().split("T")[0])
  const [exportNote, setExportNote] = useState("")
  const [exportSuccess, setExportSuccess] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState("overview")

  // Admin slips state
  const [slipFilter, setSlipFilter] = useState<"all" | "pending" | "processed">("all")
  const [slipDetailOpen, setSlipDetailOpen] = useState(false)
  const [selectedSlip, setSelectedSlip] = useState<typeof adminSlips[0] | null>(null)
  const [processingSlipId, setProcessingSlipId] = useState<string | null>(null)

  // Internal transfer state
  const [transferRows, setTransferRows] = useState<TransferRow[]>([{ sku: "", qty: 1 }])
  const [transferSource, setTransferSource] = useState("")
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0])
  const [transferReason, setTransferReason] = useState("")
  const [transferNote, setTransferNote] = useState("")
  const [transferCustomerName, setTransferCustomerName] = useState("")
  const [transferCustomerPhone, setTransferCustomerPhone] = useState("")
  const [transferPickupMethod, setTransferPickupMethod] = useState<"employee" | "delivery" | "customer">("employee")
  const [transferSuccess, setTransferSuccess] = useState(false)
  const [transferDetailOpen, setTransferDetailOpen] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRequest | null>(null)
  const [transferListFilter, setTransferListFilter] = useState<"all" | "pending" | "approved" | "in-transit" | "completed" | "rejected">("all")
  const [transferTab, setTransferTab] = useState<"phieu-di" | "yeu-cau">("phieu-di")
  const [empInvPage, setEmpInvPage] = useState(1)

  // Export transfer form state (for source warehouse to create phiếu xuất kho điều chuyển)
  const [exportTransferOpen, setExportTransferOpen] = useState(false)
  const [exportTransferTarget, setExportTransferTarget] = useState<TransferRequest | null>(null)
  const [exportTransferDate, setExportTransferDate] = useState(new Date().toISOString().split("T")[0])
  const [exportTransferNote, setExportTransferNote] = useState("")
  const [exportTransferQtys, setExportTransferQtys] = useState<Record<string, number>>({})

  // SKU combobox open state per row
  const [skuComboboxOpen, setSkuComboboxOpen] = useState<Record<number, boolean>>({})

  const categories = [...new Set(inventory.map(i => i.category))]
  const warehouses = [...new Set(inventory.map(i => i.warehouse))]

  // Công thức tổng hợp:
  // totalValue  = Σ(onHand × unitCost)               — tổng giá trị hàng vật lý trong kho
  // lowStock    = count where 0 < available ≤ reorderPoint
  // outOfStock  = count where available === 0
  const totalValue = useMemo(() => inventory.reduce((sum, i) => sum + i.onHand * i.unitCost, 0), [inventory])
  const lowStock = useMemo(() => inventory.filter(i => i.available > 0 && i.available <= i.reorderPoint).length, [inventory])
  const outOfStock = useMemo(() => inventory.filter(i => i.available === 0).length, [inventory])

  const summaryCards = [
    { title: "Tổng SKU", value: inventory.length.toString(), icon: <Package className="h-5 w-5" />, color: "bg-blue-100 text-blue-600" },
    { title: "Tổng giá trị", value: formatVND(totalValue), icon: <DollarSign className="h-5 w-5" />, color: "bg-green-100 text-green-600" },
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
  const empInvTotalPages = Math.max(1, Math.ceil(filtered.length / EMP_INV_PAGE_SIZE))
  const empInvSafePage = Math.min(empInvPage, empInvTotalPages)
  const paginatedFiltered = useMemo(() => {
    const start = (empInvSafePage - 1) * EMP_INV_PAGE_SIZE
    return filtered.slice(start, start + EMP_INV_PAGE_SIZE)
  }, [filtered, empInvSafePage])

  const getEmpInvPageNumbers = () => {
    const pages: (number | "...")[] = []
    if (empInvTotalPages <= 7) {
      for (let i = 1; i <= empInvTotalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (empInvSafePage > 3) pages.push("...")
      for (let i = Math.max(2, empInvSafePage - 1); i <= Math.min(empInvTotalPages - 1, empInvSafePage + 1); i++) pages.push(i)
      if (empInvSafePage < empInvTotalPages - 2) pages.push("...")
      pages.push(empInvTotalPages)
    }
    return pages
  }

  const handleGrnConfirm = () => {
    const validRows = grnRows.filter(r => r.sku && r.qty > 0)
    if (validRows.length === 0) return

    ctx.importItems({
      items: validRows.map(r => ({
        sku: r.sku,
        name: inventory.find(it => it.sku === r.sku)?.name || r.sku,
        qty: r.qty,
        cost: r.cost,
      })),
      warehouse: grnWarehouse || myWarehouse,
      note: grnNote,
      date: grnDate,
      operator: user?.fullName || "Nhân viên",
    })

    setGrnSuccess(true)
    setGrnRows([{ sku: "", qty: 1, cost: 0 }])
    setGrnNote("")
    // Mark admin slip as processed if this import was from an admin slip
    if (processingSlipId) {
      ctx.processAdminSlip(processingSlipId, user?.fullName || "Nhân viên")
      setProcessingSlipId(null)
    }
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
        reason: r.reason || exportNote,
      })),
      warehouse: myWarehouse,
      note: exportNote,
      date: exportDate,
      operator: user?.fullName || "Nhân viên",
    })

    if (!success) return

    setExportSuccess(true)
    setExportRows([{ sku: "", qty: 1, reason: "" }])
    setExportNote("")
    // Mark admin slip as processed if this export was from an admin slip
    if (processingSlipId) {
      ctx.processAdminSlip(processingSlipId, user?.fullName || "Nhân viên")
      setProcessingSlipId(null)
    }
    setTimeout(() => setExportSuccess(false), 3000)
  }

  // Redirect admin slip to import/export tab with pre-filled data
  const handleRedirectSlipToTab = (slip: typeof adminSlips[0]) => {
    if (slip.status === "processed") return
    setProcessingSlipId(slip.id)
    setSlipDetailOpen(false)
    setSelectedSlip(null)

    if (slip.type === "import") {
      // Pre-fill import (GRN) form
      setGrnRows(slip.items.map(item => ({
        sku: item.sku,
        qty: item.qty,
        cost: item.unitCost,
      })))
      setGrnWarehouse(slip.warehouse)
      setGrnSupplier(suppliers.find(s => s.name === slip.supplier)?.id.toString() || "")
      setGrnPo(slip.poId || "")
      setGrnDate(new Date().toISOString().split("T")[0])
      setGrnNote(`Phiếu admin: ${slip.id} — ${slip.note}`)
      setActiveTab("grn")
    } else {
      // Pre-fill export form
      setExportRows(slip.items.map(item => ({
        sku: item.sku,
        qty: item.qty,
        reason: `Phiếu admin: ${slip.id}`,
      })))
      setExportDate(new Date().toISOString().split("T")[0])
      setExportNote(`Phiếu admin: ${slip.id} — ${slip.note}`)
      setActiveTab("export")
    }
  }

  // Transfer items available in the source warehouse (the warehouse being requested from)
  const transferAvailableItems = useMemo(() => {
    if (!transferSource) return []
    return inventory.filter(i => i.warehouse === transferSource && i.available > 0)
  }, [inventory, transferSource])

  const handleTransferConfirm = () => {
    const validRows = transferRows.filter(r => r.sku && r.qty > 0)
    if (validRows.length === 0 || !myWarehouse || !transferSource || myWarehouse === transferSource) return

    // Check availability at source warehouse
    for (const row of validRows) {
      const item = inventory.find(i => i.sku === row.sku && i.warehouse === transferSource)
      if (!item || item.available < row.qty) return
    }

    ctx.createTransfer({
      date: transferDate,
      fromWarehouse: transferSource,
      toWarehouse: myWarehouse,
      items: validRows.map(row => {
        const item = inventory.find(i => i.sku === row.sku && i.warehouse === transferSource)
        return { sku: row.sku, name: item?.name || row.sku, qty: row.qty, available: item?.available || 0 }
      }),
      reason: transferReason,
      note: transferNote,
      status: "pending",
      pickupMethod: transferPickupMethod,
      createdBy: user?.fullName || "Nhân viên",
      customerName: transferCustomerName || undefined,
      customerPhone: transferCustomerPhone || undefined,
    })

    // NOTE: Items are NOT deducted yet — wait for source warehouse to approve & export

    setTransferSuccess(true)
    setTransferRows([{ sku: "", qty: 1 }])
    setTransferNote("")
    setTransferReason("")
    setTransferCustomerName("")
    setTransferCustomerPhone("")
    setTransferSource("")
    setTransferPickupMethod("employee")
    setTimeout(() => setTransferSuccess(false), 3000)
  }

  // Open export transfer form for a pending request
  const openExportTransferForm = (transfer: TransferRequest) => {
    setExportTransferTarget(transfer)
    setExportTransferDate(new Date().toISOString().split("T")[0])
    setExportTransferNote("")
    // Initialize qtys to 0 — employee must enter manually
    const qtys: Record<string, number> = {}
    transfer.items.forEach(item => {
      qtys[item.sku] = 0
    })
    setExportTransferQtys(qtys)
    setExportTransferOpen(true)
    // Close detail dialog if open
    setTransferDetailOpen(false)
  }

  // Confirm export transfer form → create export slip and update status
  const handleExportTransferConfirm = () => {
    if (!exportTransferTarget) return
    const t = exportTransferTarget

    // Validate all qtys > 0
    const allValid = t.items.every(item => (exportTransferQtys[item.sku] || 0) > 0)
    if (!allValid) return

    // Check availability
    for (const item of t.items) {
      const inv = inventory.find(i => i.sku === item.sku && i.warehouse === t.fromWarehouse)
      if (!inv || inv.available < (exportTransferQtys[item.sku] || 0)) return
    }

    ctx.exportTransferItems({
      transferId: t.id,
      qtys: exportTransferQtys,
      date: exportTransferDate,
      note: exportTransferNote || "Không có ghi chú",
      operator: user?.fullName || "Nhân viên",
    })

    // Clean up
    setExportTransferOpen(false)
    setExportTransferTarget(null)
    setExportTransferNote("")
    setExportTransferQtys({})
    setSelectedTransfer(null)
  }

  const handleUpdateTransferStatus = (id: string, newStatus: TransferRequest["status"]) => {
    if (newStatus === "completed") {
      // Destination warehouse confirms reception → add items to dest warehouse
      ctx.receiveTransferItems(id, user?.fullName || "Nhân viên")
    } else if (newStatus === "rejected") {
      ctx.updateTransferStatus(id, "rejected")
    } else if (newStatus === "in-transit") {
      // Handled by handleExportTransferConfirm instead
    } else {
      ctx.updateTransferStatus(id, newStatus)
    }
    setTransferDetailOpen(false)
    setSelectedTransfer(null)
  }

  // Phiếu đi: other warehouses requested goods FROM this warehouse → employee approves & exports
  const phieuDiTransfers = transferRequests.filter(t => t.fromWarehouse === myWarehouse)
  // Yêu cầu đã gửi: this warehouse's requests to other warehouses → track status
  const myRequestTransfers = transferRequests.filter(t => t.toWarehouse === myWarehouse)

  const filteredPhieuDi = phieuDiTransfers.filter(t => transferListFilter === "all" || t.status === transferListFilter)
  const filteredMyRequests = myRequestTransfers.filter(t => transferListFilter === "all" || t.status === transferListFilter)

  const pendingPhieuDiCount = phieuDiTransfers.filter(t => t.status === "pending").length
  const inTransitMyRequestsCount = myRequestTransfers.filter(t => t.status === "in-transit").length
  const pendingTransfersCount = pendingPhieuDiCount + inTransitMyRequestsCount

  const pickupMethodLabel = (method: TransferRequest["pickupMethod"]) => {
    switch (method) {
      case "employee": return "Nhân viên qua lấy"
      case "delivery": return "Giao vận qua lấy"
      case "customer": return "Khách qua lấy"
    }
  }

  const pickupMethodColor = (method: TransferRequest["pickupMethod"]) => {
    switch (method) {
      case "employee": return "bg-blue-100 text-blue-700"
      case "delivery": return "bg-amber-100 text-amber-700"
      case "customer": return "bg-pink-100 text-pink-700"
    }
  }

  const filteredSlips = adminSlips.filter(s => slipFilter === "all" || s.status === slipFilter)
  const pendingSlipsCount = adminSlips.filter(s => s.status === "pending").length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Quản lý kho hàng</h1>
          <p className="text-sm text-muted-foreground">Nhập kho, xuất kho và theo dõi tồn kho</p>
        </div>
        <div className="flex items-center gap-2">
          {myWarehouse && (
            <Badge className="bg-blue-100 text-blue-700 text-sm px-3 py-1.5 gap-1.5">
              <MapPin className="h-4 w-4" />
              {myWarehouse}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => {
              exportInventoryCheckSheet({
                items: filtered,
                warehouseFilter,
                categoryFilter,
                exportedBy: user?.fullName || "Nhân viên",
              })
            }}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Xuất phiếu kiểm kê
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

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); if (v !== "grn" && v !== "export") setProcessingSlipId(null) }}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="grn" className="gap-1.5"><ArrowDownToLine className="h-3.5 w-3.5" /> Nhập kho</TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5"><ArrowUpFromLine className="h-3.5 w-3.5" /> Xuất kho</TabsTrigger>
          <TabsTrigger value="transfer" className="gap-1.5">
            <Repeat className="h-3.5 w-3.5" /> Điều chuyển
            {pendingTransfersCount > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] rounded-full bg-purple-500 text-white text-[10px] px-1.5">{pendingTransfersCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="admin-slips" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Phiếu từ Admin
            {pendingSlipsCount > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] rounded-full bg-red-500 text-white text-[10px] px-1.5">{pendingSlipsCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Lịch sử</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm SKU, tên sản phẩm..."
                value={search}
                onChange={e => { setSearch(e.target.value); setEmpInvPage(1) }}
                className="pl-9 h-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setEmpInvPage(1) }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Danh mục" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả danh mục</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {warehouses.length > 1 && (
              <Select value={warehouseFilter} onValueChange={v => { setWarehouseFilter(v); setEmpInvPage(1) }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Kho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả kho</SelectItem>
                {warehouses.map(w => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            )}
            <div className="flex items-center gap-2">
              <Switch id="emp-alert-only" checked={alertOnly} onCheckedChange={v => { setAlertOnly(v); setEmpInvPage(1) }} />
              <Label htmlFor="emp-alert-only" className="text-sm">Chỉ cảnh báo</Label>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-2">
            Hiển thị {(empInvSafePage - 1) * EMP_INV_PAGE_SIZE + 1}–{Math.min(empInvSafePage * EMP_INV_PAGE_SIZE, filtered.length)} / {filtered.length} mục
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
                    <TableRow key={`${item.sku}-${item.warehouse}`} className={cn(
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
                      <TableCell className="font-mono text-xs text-blue-600">{item.sku}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{item.name}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                      </TableCell>
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

          {empInvTotalPages > 1 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setEmpInvPage(p => Math.max(1, p - 1))}
                      className={cn("cursor-pointer", empInvSafePage === 1 && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>
                  {getEmpInvPageNumbers().map((page, i) => (
                    <PaginationItem key={i}>
                      {page === "..." ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          isActive={page === empInvSafePage}
                          onClick={() => setEmpInvPage(page as number)}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setEmpInvPage(p => Math.min(empInvTotalPages, p + 1))}
                      className={cn("cursor-pointer", empInvSafePage === empInvTotalPages && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="grn">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5 text-green-600" /> Phiếu nhập kho mới
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {processingSlipId && activeTab === "grn" && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800">Đang xử lý phiếu từ Admin: <span className="font-mono">{processingSlipId}</span></p>
                    <p className="text-xs text-blue-600 mt-0.5">Kiểm tra sản phẩm và số lượng, sau đó bấm "Xác nhận nhập kho" để hoàn tất.</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800" onClick={() => { setProcessingSlipId(null); setGrnRows([{ sku: "", qty: 1, cost: 0 }]); setGrnNote("") }}>
                    Huỷ liên kết
                  </Button>
                </div>
              )}
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
                    <SelectContent>
                      {warehouses.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Nhà cung cấp</Label>
                  <Select value={grnSupplier} onValueChange={setGrnSupplier}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn NCC" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Tham chiếu PO</Label>
                  <Input className="mt-1" placeholder="PO-2026-xxx" value={grnPo} onChange={e => setGrnPo(e.target.value)} />
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
                          const newRows = [...grnRows]
                          newRows[i].sku = v
                          const item = inventory.find(it => it.sku === v)
                          if (item) newRows[i].cost = item.unitCost
                          setGrnRows(newRows)
                        }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Chọn sản phẩm" /></SelectTrigger>
                          <SelectContent>
                            {inventory.map(item => (
                              <SelectItem key={item.id} value={item.sku}>{item.sku} - {item.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min={1} value={row.qty}
                          onChange={e => {
                            const newRows = [...grnRows]
                            newRows[i].qty = parseInt(e.target.value) || 1
                            setGrnRows(newRows)
                          }}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min={0} value={row.cost}
                          onChange={e => {
                            const newRows = [...grnRows]
                            newRows[i].cost = parseInt(e.target.value) || 0
                            setGrnRows(newRows)
                          }}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatVND(row.qty * row.cost)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                          onClick={() => setGrnRows(grnRows.filter((_, idx) => idx !== i))}
                          disabled={grnRows.length === 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-between items-center bg-muted/50 px-4 py-3 rounded-lg">
                <span className="text-sm font-medium">Tổng cộng: {grnRows.filter(r => r.sku).length} sản phẩm</span>
                <span className="font-serif text-lg font-bold text-blue-600">{formatVND(grnRows.reduce((s, r) => s + r.qty * r.cost, 0))}</span>
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
                    <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={!grnRows.some(r => r.sku && r.qty > 0)}>
                      Xác nhận nhập kho
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-serif">Xác nhận nhập kho</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">Lưu ý</p>
                          <p className="text-xs text-amber-700 mt-1">Thao tác này sẽ cập nhật số lượng tồn kho. Vui lòng kiểm tra kỹ trước khi xác nhận.</p>
                        </div>
                      </div>
                      <div className="text-sm space-y-1">
                        <p>Số lượng sản phẩm: <strong>{grnRows.filter(r => r.sku).length}</strong></p>
                        <p>Tổng tiền: <strong className="text-blue-600">{formatVND(grnRows.reduce((s, r) => s + r.qty * r.cost, 0))}</strong></p>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Huỷ</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleGrnConfirm}>Xác nhận</Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <ArrowUpFromLine className="h-5 w-5 text-orange-600" /> Phiếu xuất kho mới
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {processingSlipId && activeTab === "export" && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800">Đang xử lý phiếu từ Admin: <span className="font-mono">{processingSlipId}</span></p>
                    <p className="text-xs text-blue-600 mt-0.5">Kiểm tra sản phẩm và số lượng, sau đó bấm "Xác nhận xuất kho" để hoàn tất.</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800" onClick={() => { setProcessingSlipId(null); setExportRows([{ sku: "", qty: 1, reason: "" }]); setExportNote("") }}>
                    Huỷ liên kết
                  </Button>
                </div>
              )}
              {exportSuccess && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium text-green-800">Xuất kho thành công! Số lượng tồn kho đã được cập nhật.</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm">Ngày xuất</Label>
                  <Input className="mt-1" type="date" value={exportDate} onChange={e => setExportDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">Ghi chú chung</Label>
                  <Input className="mt-1" placeholder="Lý do xuất kho..." value={exportNote} onChange={e => setExportNote(e.target.value)} />
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
                    const item = inventory.find(it => it.sku === row.sku)
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <Select value={row.sku} onValueChange={v => {
                            const newRows = [...exportRows]
                            newRows[i].sku = v
                            setExportRows(newRows)
                          }}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Chọn sản phẩm" /></SelectTrigger>
                            <SelectContent>
                              {inventory.filter(it => it.available > 0).map(item => (
                                <SelectItem key={item.id} value={item.sku}>{item.sku} - {item.name} (còn: {item.available})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-center font-medium">
                          {item ? item.available : "-"}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number" min={1} max={item?.available || 999} value={row.qty}
                            onChange={e => {
                              const newRows = [...exportRows]
                              newRows[i].qty = parseInt(e.target.value) || 1
                              setExportRows(newRows)
                            }}
                            className={cn("h-8 text-xs", item && row.qty > item.available && "border-red-400")}
                          />
                        </TableCell>
                        <TableCell>
                          <Select value={row.reason} onValueChange={v => {
                            const newRows = [...exportRows]
                            newRows[i].reason = v
                            setExportRows(newRows)
                          }}>
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
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                            onClick={() => setExportRows(exportRows.filter((_, idx) => idx !== i))}
                            disabled={exportRows.length === 1}
                          >
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
                    <Button className="bg-orange-600 hover:bg-orange-700 text-white" disabled={!exportRows.some(r => r.sku && r.qty > 0)}>
                      Xác nhận xuất kho
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-serif">Xác nhận xuất kho</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">Lưu ý</p>
                          <p className="text-xs text-amber-700 mt-1">Thao tác này sẽ trừ số lượng tồn kho. Vui lòng kiểm tra kỹ trước khi xác nhận.</p>
                        </div>
                      </div>
                      <div className="text-sm">
                        <p>Số lượng sản phẩm xuất: <strong>{exportRows.filter(r => r.sku).length}</strong></p>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Huỷ</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleExportConfirm}>Xác nhận</Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Internal Transfer Tab */}
        <TabsContent value="transfer">
          {/* Phiếu đi / Yêu cầu toggle */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant={transferTab === "phieu-di" ? "default" : "outline"}
              size="sm"
              onClick={() => { setTransferTab("phieu-di"); setTransferListFilter("all") }}
              className={transferTab === "phieu-di" ? "bg-purple-600 hover:bg-purple-700" : ""}
            >
              <Upload className="h-4 w-4 mr-1" /> Phiếu đi
              {pendingPhieuDiCount > 0 && <Badge className="ml-1.5 h-5 min-w-[20px] rounded-full bg-red-500 text-white text-[10px] px-1.5">{pendingPhieuDiCount}</Badge>}
            </Button>
            <Button
              variant={transferTab === "yeu-cau" ? "default" : "outline"}
              size="sm"
              onClick={() => { setTransferTab("yeu-cau"); setTransferListFilter("all") }}
              className={transferTab === "yeu-cau" ? "bg-teal-600 hover:bg-teal-700" : ""}
            >
              <Download className="h-4 w-4 mr-1" /> Yêu cầu đã gửi
              {inTransitMyRequestsCount > 0 && <Badge className="ml-1.5 h-5 min-w-[20px] rounded-full bg-amber-500 text-white text-[10px] px-1.5">{inTransitMyRequestsCount}</Badge>}
            </Button>
          </div>

          {transferTab === "yeu-cau" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Create transfer form */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Repeat className="h-5 w-5 text-purple-600" /> Tạo yêu cầu điều chuyển
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {transferSuccess && (
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <p className="text-sm font-medium text-green-800">Yêu cầu điều chuyển đã được tạo và gửi đến kho xuất để duyệt!</p>
                    </div>
                  )}

                  {/* Warehouse selector */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <Label className="text-sm flex items-center gap-1 mb-1">
                        <MapPin className="h-3.5 w-3.5 text-orange-500" /> Yêu cầu từ kho
                      </Label>
                      <Select value={transferSource} onValueChange={setTransferSource}>
                        <SelectTrigger><SelectValue placeholder="Chọn kho nguồn" /></SelectTrigger>
                        <SelectContent>
                          {warehouses.filter(w => w !== myWarehouse).map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end justify-center pb-2">
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <Label className="text-sm flex items-center gap-1 mb-1">
                        <MapPin className="h-3.5 w-3.5 text-green-500" /> Kho nhận (bạn)
                      </Label>
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border text-sm font-medium">
                        <Package className="h-4 w-4 text-blue-600" />
                        {myWarehouse || "Chưa gán kho"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <Inbox className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-blue-700">Yêu cầu sẽ được gửi đến nhân viên kho xuất để duyệt và xuất hàng</span>
                  </div>

                  {/* Pickup method selector */}
                  <div>
                    <Label className="text-sm mb-2 block">Hình thức lấy hàng</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["employee", "delivery", "customer"] as const).map(method => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setTransferPickupMethod(method)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-xs font-medium transition-all",
                            transferPickupMethod === method
                              ? "border-purple-500 bg-purple-50 text-purple-700"
                              : "border-muted hover:border-purple-200 text-muted-foreground"
                          )}
                        >
                          {method === "employee" && <UserCheck className="h-5 w-5" />}
                          {method === "delivery" && <Truck className="h-5 w-5" />}
                          {method === "customer" && <Users className="h-5 w-5" />}
                          {pickupMethodLabel(method)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Customer info - only for customer pickup */}
                  {transferPickupMethod === "customer" && <div className="p-3 rounded-lg border bg-blue-50/50 border-blue-200 space-y-3">
                    <p className="text-sm font-medium text-blue-800 flex items-center gap-1">Thông tin khách hàng</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Tên khách hàng</Label>
                        <Input className="mt-1 h-8 text-sm" placeholder="Nguyễn Văn A" value={transferCustomerName} onChange={e => setTransferCustomerName(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Số điện thoại</Label>
                        <Input className="mt-1 h-8 text-sm" placeholder="0901234567" value={transferCustomerPhone} onChange={e => setTransferCustomerPhone(e.target.value)} />
                      </div>
                    </div>
                  </div>}

                  {/* Reason & date */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Lý do</Label>
                      <Select value={transferReason} onValueChange={setTransferReason}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn lý do" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Khách yêu cầu">Khách yêu cầu hàng gần</SelectItem>
                          <SelectItem value="Hết hàng tại kho đích">Hết hàng tại kho đích</SelectItem>
                          <SelectItem value="Cân bằng tồn kho">Cân bằng tồn kho</SelectItem>
                          <SelectItem value="Bổ sung theo kế hoạch">Bổ sung theo kế hoạch</SelectItem>
                          <SelectItem value="Khác">Khác</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Ngày</Label>
                      <Input className="mt-1" type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} />
                    </div>
                  </div>

                  {/* Product rows */}
                  <div>
                    <Label className="text-sm mb-2 block">Sản phẩm điều chuyển</Label>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">SKU / Sản phẩm</TableHead>
                          <TableHead className="text-xs w-20 text-center">Tồn kho</TableHead>
                          <TableHead className="text-xs w-24">SL chuyển</TableHead>
                          <TableHead className="text-xs w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transferRows.map((row, i) => {
                          const item = transferAvailableItems.find(it => it.sku === row.sku)
                          return (
                            <TableRow key={i}>
                              <TableCell>
                                <Popover open={skuComboboxOpen[i] || false} onOpenChange={(open) => setSkuComboboxOpen(prev => ({ ...prev, [i]: open }))}>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full h-8 justify-between text-xs font-normal">
                                      {row.sku ? (
                                        <span className="truncate">
                                          <span className="font-mono text-blue-600">{row.sku}</span>
                                          {item && <span className="text-muted-foreground"> — {item.name}</span>}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">{transferSource ? "Nhập mã SP..." : "Chọn kho nguồn trước"}</span>
                                      )}
                                      <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[360px] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Nhập mã SKU hoặc tên sản phẩm..." className="h-9 text-xs" />
                                      <CommandList>
                                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                                          {transferSource ? "Không tìm thấy SP hoặc hết hàng" : "Chưa chọn kho nguồn"}
                                        </CommandEmpty>
                                        <CommandGroup heading={transferSource ? `Sản phẩm còn hàng tại ${transferSource}` : "Chưa chọn kho"}>
                                          {transferAvailableItems.map(avItem => (
                                            <CommandItem
                                              key={avItem.id}
                                              value={`${avItem.sku} ${avItem.name}`}
                                              onSelect={() => {
                                                const newRows = [...transferRows]
                                                newRows[i].sku = avItem.sku
                                                setTransferRows(newRows)
                                                setSkuComboboxOpen(prev => ({ ...prev, [i]: false }))
                                              }}
                                              className="text-xs"
                                            >
                                              <Check className={cn("mr-2 h-3.5 w-3.5", row.sku === avItem.sku ? "opacity-100" : "opacity-0")} />
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-mono text-blue-600 font-medium">{avItem.sku}</span>
                                                  <span className="text-muted-foreground truncate">{avItem.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                  <Badge variant="outline" className="text-[9px] h-4">{avItem.category}</Badge>
                                                  <span className={cn("text-[10px] font-medium", avItem.available <= avItem.reorderPoint ? "text-amber-600" : "text-green-600")}>
                                                    Còn: {avItem.available}
                                                  </span>
                                                </div>
                                              </div>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell className="text-center text-sm font-medium">
                                {item ? item.available : "-"}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number" min={1} max={item?.available || 999} value={row.qty}
                                  onChange={e => {
                                    const newRows = [...transferRows]
                                    newRows[i].qty = parseInt(e.target.value) || 1
                                    setTransferRows(newRows)
                                  }}
                                  className={cn("h-8 text-xs", item && row.qty > item.available && "border-red-400")}
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                                  onClick={() => setTransferRows(transferRows.filter((_, idx) => idx !== i))}
                                  disabled={transferRows.length === 1}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => setTransferRows([...transferRows, { sku: "", qty: 1 }])}>
                      <Plus className="h-4 w-4 mr-1" /> Thêm dòng
                    </Button>
                  </div>

                  <div>
                    <Label className="text-sm">Ghi chú</Label>
                    <Textarea className="mt-1" placeholder="Ghi chú phiếu điều chuyển..." value={transferNote} onChange={e => setTransferNote(e.target.value)} />
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => { setTransferRows([{ sku: "", qty: 1 }]); setTransferNote(""); setTransferReason(""); setTransferCustomerName(""); setTransferCustomerPhone(""); setTransferSource(""); setTransferPickupMethod("employee") }}>Huỷ</Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled={!myWarehouse || !transferSource || myWarehouse === transferSource || !transferRows.some(r => r.sku && r.qty > 0)}>
                          <Repeat className="h-4 w-4 mr-1" /> Tạo phiếu điều chuyển
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="font-serif">Xác nhận yêu cầu điều chuyển</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 justify-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <Badge variant="outline" className="text-sm">{transferSource}</Badge>
                            <ArrowRight className="h-4 w-4 text-purple-600" />
                            <Badge variant="outline" className="text-sm">{myWarehouse}</Badge>
                          </div>
                          {transferCustomerName && (
                            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200 text-sm">
                              <span className="text-blue-700">Khách hàng: <strong>{transferCustomerName}</strong> {transferCustomerPhone && `— ${transferCustomerPhone}`}</span>
                            </div>
                          )}
                          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-amber-800">Quy trình duyệt</p>
                              <p className="text-xs text-amber-700 mt-1">Yêu cầu sẽ được gửi đến nhân viên kho xuất để duyệt. Hàng chỉ được xuất kho sau khi được xác nhận.</p>
                            </div>
                          </div>
                          <div className="border rounded-lg divide-y">
                            {transferRows.filter(r => r.sku).map((row, idx) => {
                              const item = inventory.find(i => i.sku === row.sku)
                              return (
                                <div key={idx} className="flex items-center justify-between p-3 text-sm">
                                  <div>
                                    <p className="font-medium">{item?.name || row.sku}</p>
                                    <p className="text-xs text-muted-foreground">{row.sku}</p>
                                  </div>
                                  <span className="font-bold text-purple-600">×{row.qty}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <DialogFooter>
                          <DialogClose asChild><Button variant="outline">Huỷ</Button></DialogClose>
                          <DialogClose asChild>
                            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleTransferConfirm}>
                              Gửi yêu cầu điều chuyển
                            </Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>

              {/* My request list */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Download className="h-5 w-5 text-teal-600" /> Yêu cầu đã gửi
                    </CardTitle>
                    <Select value={transferListFilter} onValueChange={v => setTransferListFilter(v as typeof transferListFilter)}>
                      <SelectTrigger className="w-[150px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        <SelectItem value="pending">Chờ duyệt</SelectItem>
                        <SelectItem value="in-transit">Đang vận chuyển</SelectItem>
                        <SelectItem value="completed">Hoàn tất</SelectItem>
                        <SelectItem value="rejected">Từ chối</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredMyRequests.length === 0 ? (
                    <div className="py-8 text-center">
                      <Repeat className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                      <p className="text-sm text-muted-foreground">Chưa có yêu cầu nào</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {filteredMyRequests.map(t => (
                        <div key={t.id} className={cn(
                          "rounded-lg border p-3 hover:shadow-sm transition-all cursor-pointer",
                          t.status === "pending" && "border-amber-200 bg-amber-50/30",
                          t.status === "in-transit" && "border-blue-200 bg-blue-50/30",
                          t.status === "completed" && "border-green-200 bg-green-50/30",
                          t.status === "rejected" && "border-red-200 bg-red-50/30"
                        )} onClick={() => { setSelectedTransfer(t); setTransferDetailOpen(true) }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-mono text-xs font-bold text-purple-600">{t.id}</span>
                            <div className="flex items-center gap-1.5">
                              <Badge className={cn("text-[10px]", pickupMethodColor(t.pickupMethod))}>
                                {pickupMethodLabel(t.pickupMethod)}
                              </Badge>
                              <Badge className={cn("text-[10px]",
                                t.status === "pending" ? "bg-amber-100 text-amber-700" :
                                t.status === "in-transit" ? "bg-indigo-100 text-indigo-700" :
                                t.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                                "bg-red-100 text-red-700"
                              )}>
                                {t.status === "pending" ? "Chờ kho xuất duyệt" : t.status === "in-transit" ? "Đang vận chuyển" : t.status === "completed" ? "Hoàn tất" : "Bị từ chối"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs mb-1">
                            <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700">{t.fromWarehouse.replace("Kho ", "")}</Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="outline" className="text-[10px] border-green-300 text-green-700">{t.toWarehouse.replace("Kho ", "")}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {t.items.map((item, idx) => (
                              <span key={idx} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{item.name} ×{item.qty}</span>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {t.date}</span>
                            <span>{t.reason}</span>
                            {t.customerName && <span className="text-blue-600">KH: {t.customerName}</span>}
                          </div>
                          {/* Receipt confirmation for destination employee */}
                          {t.status === "in-transit" && (
                            <div className="flex items-center gap-2 pt-2 mt-2 border-t">
                              <Button className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs" size="sm" onClick={(e) => { e.stopPropagation(); handleUpdateTransferStatus(t.id, "completed") }}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Xác nhận đã nhận hàng
                              </Button>
                              <span className="text-[10px] text-muted-foreground ml-auto">Cập nhật tồn kho tại {myWarehouse}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {transferTab === "phieu-di" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Upload className="h-5 w-5 text-purple-600" /> Phiếu đi — Yêu cầu xuất hàng tại {myWarehouse}
                    {pendingPhieuDiCount > 0 && (
                      <Badge className="bg-red-500 text-white text-xs px-2">{pendingPhieuDiCount} chờ duyệt</Badge>
                    )}
                  </CardTitle>
                  <Select value={transferListFilter} onValueChange={v => setTransferListFilter(v as typeof transferListFilter)}>
                    <SelectTrigger className="w-[150px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="pending">Chờ duyệt</SelectItem>
                      <SelectItem value="in-transit">Đang vận chuyển</SelectItem>
                      <SelectItem value="completed">Hoàn tất</SelectItem>
                      <SelectItem value="rejected">Từ chối</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredPhieuDi.length === 0 ? (
                  <div className="py-12 text-center">
                    <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                    <p className="text-sm text-muted-foreground">Không có phiếu đi nào</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredPhieuDi.map(t => (
                      <div key={t.id} className={cn(
                        "rounded-lg border p-4 hover:shadow-md transition-all",
                        t.status === "pending" && "border-amber-300 bg-amber-50/50 ring-1 ring-amber-200",
                        t.status === "in-transit" && "border-blue-200 bg-blue-50/30",
                        t.status === "completed" && "border-green-200 bg-green-50/30",
                        t.status === "rejected" && "border-red-200 bg-red-50/30"
                      )}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm font-bold text-purple-600">{t.id}</span>
                              <Badge className={cn("text-[10px]", pickupMethodColor(t.pickupMethod))}>
                                {pickupMethodLabel(t.pickupMethod)}
                              </Badge>
                              <Badge className={cn("text-[10px]",
                                t.status === "pending" ? "bg-amber-100 text-amber-700" :
                                t.status === "in-transit" ? "bg-indigo-100 text-indigo-700" :
                                t.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                                "bg-red-100 text-red-700"
                              )}>
                                {t.status === "pending" ? "Chờ duyệt" : t.status === "in-transit" ? "Đã xuất — chờ nhận" : t.status === "completed" ? "Hoàn tất" : "Đã từ chối"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                              <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700">{t.fromWarehouse} (bạn)</Badge>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <Badge className="text-[10px] bg-teal-100 text-teal-700">{t.toWarehouse}</Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setSelectedTransfer(t); setTransferDetailOpen(true) }}>
                              <Eye className="h-3.5 w-3.5 mr-1" /> Chi tiết
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {t.items.map((item, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs font-normal">{item.name} ×{item.qty}</Badge>
                          ))}
                        </div>

                        <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {t.date}</span>
                          <span>Người yêu cầu: {t.createdBy}</span>
                          <span>Lý do: {t.reason}</span>
                          {t.customerName && <span className="text-blue-600">KH: {t.customerName} {t.customerPhone && `— ${t.customerPhone}`}</span>}
                        </div>

                        {t.note && (
                          <p className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded mb-3">{t.note}</p>
                        )}

                        {/* Action buttons for source warehouse employee — create export slip */}
                        {t.status === "pending" && (
                          <div className="flex items-center gap-2 pt-2 border-t">
                            <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={() => handleUpdateTransferStatus(t.id, "rejected")}>
                              Từ chối
                            </Button>
                            <Button className="bg-purple-600 hover:bg-purple-700 text-white h-8 text-xs" onClick={() => openExportTransferForm(t)}>
                              <FileText className="h-3.5 w-3.5 mr-1" /> Tạo phiếu xuất kho điều chuyển
                            </Button>
                            <span className="text-[10px] text-muted-foreground ml-auto">Tạo phiếu xuất để duyệt và xuất hàng từ {myWarehouse}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Transfer Detail Dialog */}
          <Dialog open={transferDetailOpen} onOpenChange={setTransferDetailOpen}>
            <DialogContent className="max-w-lg">
              {selectedTransfer && (
                <>
                  <DialogHeader>
                    <DialogTitle className="font-serif flex items-center gap-2">
                      <Repeat className="h-5 w-5 text-purple-600" />
                      Phiếu điều chuyển {selectedTransfer.id}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 justify-center p-3 bg-purple-50 rounded-lg">
                      <Badge variant="outline">{selectedTransfer.fromWarehouse}</Badge>
                      <ArrowRight className="h-4 w-4 text-purple-600" />
                      <Badge variant="outline">{selectedTransfer.toWarehouse}</Badge>
                    </div>

                    {/* Role indicator + pickup method */}
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <div className={cn("text-xs px-3 py-1.5 rounded-full",
                        selectedTransfer.fromWarehouse === myWarehouse ? "bg-purple-100 text-purple-700" : "bg-teal-100 text-teal-700"
                      )}>
                        {selectedTransfer.fromWarehouse === myWarehouse ? "Phiếu đi — bạn là kho xuất" : "Yêu cầu của bạn — bạn là kho nhận"}
                      </div>
                      <Badge className={cn("text-[10px]", pickupMethodColor(selectedTransfer.pickupMethod))}>
                        {selectedTransfer.pickupMethod === "employee" && <UserCheck className="h-3 w-3 mr-1" />}
                        {selectedTransfer.pickupMethod === "delivery" && <Truck className="h-3 w-3 mr-1" />}
                        {selectedTransfer.pickupMethod === "customer" && <Users className="h-3 w-3 mr-1" />}
                        {pickupMethodLabel(selectedTransfer.pickupMethod)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Ngày:</span> {selectedTransfer.date}</div>
                      <div><span className="text-muted-foreground">Lý do:</span> {selectedTransfer.reason}</div>
                      <div><span className="text-muted-foreground">Người yêu cầu:</span> {selectedTransfer.createdBy}</div>
                      <div>
                        <span className="text-muted-foreground">Trạng thái:</span>{" "}
                        <Badge className={cn("text-[10px] ml-1",
                          selectedTransfer.status === "pending" ? "bg-amber-100 text-amber-700" :
                          selectedTransfer.status === "in-transit" ? "bg-indigo-100 text-indigo-700" :
                          selectedTransfer.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                          selectedTransfer.status === "rejected" ? "bg-red-100 text-red-700" :
                          "bg-blue-100 text-blue-700"
                        )}>
                          {selectedTransfer.status === "pending" ? "Chờ duyệt" : selectedTransfer.status === "in-transit" ? "Đang vận chuyển" : selectedTransfer.status === "completed" ? "Hoàn tất" : "Từ chối"}
                        </Badge>
                      </div>
                    </div>
                    {selectedTransfer.customerName && (
                      <div className="p-2 bg-blue-50 rounded border border-blue-200 text-sm">
                        <span className="text-blue-700">Khách hàng: <strong>{selectedTransfer.customerName}</strong> {selectedTransfer.customerPhone && `— ${selectedTransfer.customerPhone}`}</span>
                      </div>
                    )}
                    {selectedTransfer.note && (
                      <div className="text-sm"><span className="text-muted-foreground">Ghi chú:</span> <span className="bg-muted/50 px-2 py-1 rounded inline-block">{selectedTransfer.note}</span></div>
                    )}
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
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <DialogClose asChild><Button variant="outline">Đóng</Button></DialogClose>
                    {/* Source warehouse employee can reject or create export slip */}
                    {selectedTransfer.status === "pending" && selectedTransfer.fromWarehouse === myWarehouse && (
                      <>
                        <Button variant="destructive" size="sm" onClick={() => handleUpdateTransferStatus(selectedTransfer.id, "rejected")}>
                          Từ chối
                        </Button>
                        <Button className="bg-purple-600 hover:bg-purple-700 text-white" size="sm" onClick={() => openExportTransferForm(selectedTransfer)}>
                          <FileText className="h-4 w-4 mr-1" /> Tạo phiếu xuất kho điều chuyển
                        </Button>
                      </>
                    )}
                    {/* Destination employee can confirm receipt */}
                    {selectedTransfer.status === "in-transit" && selectedTransfer.toWarehouse === myWarehouse && (
                      <Button className="bg-green-600 hover:bg-green-700 text-white" size="sm" onClick={() => handleUpdateTransferStatus(selectedTransfer.id, "completed")}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Xác nhận đã nhận hàng
                      </Button>
                    )}
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Export Transfer Form Dialog — source warehouse creates phiếu xuất kho điều chuyển */}
          <Dialog open={exportTransferOpen} onOpenChange={(open) => { setExportTransferOpen(open); if (!open) setExportTransferTarget(null) }}>
            <DialogContent className="max-w-2xl">
              {exportTransferTarget && (
                <>
                  <DialogHeader>
                    <DialogTitle className="font-serif flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-600" />
                      Tạo phiếu xuất kho điều chuyển
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                    {/* Transfer info header */}
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 space-y-2">
                      <div className="flex items-center gap-2 justify-center">
                        <Badge variant="outline" className="text-sm border-orange-300 text-orange-700">{exportTransferTarget.fromWarehouse} (bạn)</Badge>
                        <ArrowRight className="h-4 w-4 text-purple-600" />
                        <Badge variant="outline" className="text-sm border-teal-300 text-teal-700">{exportTransferTarget.toWarehouse}</Badge>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <Badge className={cn("text-[10px]", pickupMethodColor(exportTransferTarget.pickupMethod))}>
                          {exportTransferTarget.pickupMethod === "employee" && <UserCheck className="h-3 w-3 mr-1" />}
                          {exportTransferTarget.pickupMethod === "delivery" && <Truck className="h-3 w-3 mr-1" />}
                          {exportTransferTarget.pickupMethod === "customer" && <Users className="h-3 w-3 mr-1" />}
                          {pickupMethodLabel(exportTransferTarget.pickupMethod)}
                        </Badge>
                        <span className="text-xs text-purple-600 font-mono">{exportTransferTarget.id}</span>
                      </div>
                    </div>

                    {/* Request info */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Người yêu cầu:</span> <strong>{exportTransferTarget.createdBy}</strong></div>
                      <div><span className="text-muted-foreground">Ngày yêu cầu:</span> {exportTransferTarget.date}</div>
                      <div><span className="text-muted-foreground">Lý do:</span> {exportTransferTarget.reason}</div>
                      {exportTransferTarget.customerName && (
                        <div><span className="text-muted-foreground">Khách hàng:</span> <strong className="text-blue-600">{exportTransferTarget.customerName}</strong> {exportTransferTarget.customerPhone && `— ${exportTransferTarget.customerPhone}`}</div>
                      )}
                    </div>
                    {exportTransferTarget.note && (
                      <p className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">Ghi chú yêu cầu: {exportTransferTarget.note}</p>
                    )}

                    {/* Export items table */}
                    <div>
                      <Label className="text-sm mb-2 block font-medium">Sản phẩm xuất kho</Label>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">SKU</TableHead>
                            <TableHead className="text-xs">Sản phẩm</TableHead>
                            <TableHead className="text-xs text-center w-20">Yêu cầu</TableHead>
                            <TableHead className="text-xs text-center w-20">Tồn kho</TableHead>
                            <TableHead className="text-xs w-28">SL xuất</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {exportTransferTarget.items.map((item) => {
                            const inv = inventory.find(i => i.sku === item.sku && i.warehouse === exportTransferTarget.fromWarehouse)
                            const available = inv?.available || 0
                            const exportQty = exportTransferQtys[item.sku] || 0
                            return (
                              <TableRow key={item.sku}>
                                <TableCell className="font-mono text-xs text-blue-600">{item.sku}</TableCell>
                                <TableCell className="text-sm">{item.name}</TableCell>
                                <TableCell className="text-center text-sm font-medium text-purple-600">{item.qty}</TableCell>
                                <TableCell className="text-center text-sm">
                                  <span className={cn(available < item.qty ? "text-red-600 font-bold" : "text-green-600")}>{available}</span>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={available}
                                    value={exportQty || ""}
                                    placeholder="Nhập SL"
                                    onChange={e => {
                                      const val = parseInt(e.target.value) || 0
                                      setExportTransferQtys(prev => ({ ...prev, [item.sku]: val }))
                                    }}
                                    className={cn("h-8 text-xs text-center", exportQty > available ? "border-red-400 bg-red-50" : exportQty === 0 ? "border-amber-300 bg-amber-50/50" : "border-green-400 bg-green-50/50")}
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Export date & note */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Ngày xuất kho</Label>
                        <Input className="mt-1" type="date" value={exportTransferDate} onChange={e => setExportTransferDate(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-sm">Mã phiếu xuất</Label>
                        <div className="flex items-center gap-2 px-3 py-2 mt-1 bg-muted/50 rounded-md border text-sm font-mono text-purple-600">
                          XKDC-{exportTransferTarget.id}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Ghi chú xuất kho</Label>
                      <Textarea className="mt-1" placeholder="Ghi chú cho phiếu xuất kho điều chuyển..." value={exportTransferNote} onChange={e => setExportTransferNote(e.target.value)} />
                    </div>

                    {/* Warning if qty differs from requested */}
                    {exportTransferTarget.items.some(item => (exportTransferQtys[item.sku] || 0) !== item.qty) && (
                      <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">Số lượng xuất khác với số lượng yêu cầu. Kho nhận sẽ nhận đúng số lượng bạn xuất.</p>
                      </div>
                    )}

                    {/* Detailed summary */}
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-3">
                      <p className="text-sm font-semibold text-green-800 flex items-center gap-1.5"><ClipboardCheck className="h-4 w-4" /> Tóm tắt phiếu xuất kho điều chuyển</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Mã phiếu xuất:</span> <strong className="font-mono text-purple-600">XKDC-{exportTransferTarget.id}</strong></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Ngày xuất:</span> <strong>{exportTransferDate}</strong></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Kho xuất:</span> <strong className="text-orange-700">{exportTransferTarget.fromWarehouse}</strong></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Kho nhận:</span> <strong className="text-teal-700">{exportTransferTarget.toWarehouse}</strong></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Hình thức:</span> <strong>{pickupMethodLabel(exportTransferTarget.pickupMethod)}</strong></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Người yêu cầu:</span> <strong>{exportTransferTarget.createdBy}</strong></div>
                        {exportTransferTarget.customerName && (
                          <div className="flex justify-between col-span-2"><span className="text-muted-foreground">Khách hàng:</span> <strong className="text-blue-600">{exportTransferTarget.customerName} {exportTransferTarget.customerPhone && `— ${exportTransferTarget.customerPhone}`}</strong></div>
                        )}
                      </div>
                      <div className="border-t border-green-200 pt-2">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left font-medium pb-1">Sản phẩm</th>
                              <th className="text-center font-medium pb-1 w-20">Yêu cầu</th>
                              <th className="text-center font-medium pb-1 w-20">Xuất</th>
                              <th className="text-center font-medium pb-1 w-20">Chênh lệch</th>
                            </tr>
                          </thead>
                          <tbody>
                            {exportTransferTarget.items.map(item => {
                              const exportQty = exportTransferQtys[item.sku] || 0
                              const diff = exportQty - item.qty
                              return (
                                <tr key={item.sku} className="border-t border-green-100">
                                  <td className="py-1"><span className="font-medium">{item.name}</span> <span className="text-muted-foreground">({item.sku})</span></td>
                                  <td className="text-center text-purple-600 font-medium">{item.qty}</td>
                                  <td className="text-center font-bold">{exportQty > 0 ? exportQty : <span className="text-red-500">—</span>}</td>
                                  <td className={cn("text-center font-medium", diff === 0 ? "text-green-600" : diff < 0 ? "text-amber-600" : "text-blue-600")}>
                                    {exportQty > 0 ? (diff === 0 ? "✓" : diff > 0 ? `+${diff}` : diff) : "—"}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-green-300 font-semibold text-green-800">
                              <td className="pt-1.5">Tổng cộng</td>
                              <td className="text-center pt-1.5">{exportTransferTarget.items.reduce((s, i) => s + i.qty, 0)}</td>
                              <td className="text-center pt-1.5">{Object.values(exportTransferQtys).reduce((s, q) => s + q, 0)}</td>
                              <td className="text-center pt-1.5">
                                {(() => {
                                  const totalDiff = Object.values(exportTransferQtys).reduce((s, q) => s + q, 0) - exportTransferTarget.items.reduce((s, i) => s + i.qty, 0)
                                  return totalDiff === 0 ? "✓" : totalDiff > 0 ? `+${totalDiff}` : totalDiff
                                })()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {exportTransferNote && (
                        <div className="border-t border-green-200 pt-2 text-xs">
                          <span className="text-muted-foreground">Ghi chú:</span> <span className="italic">{exportTransferNote}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => { setExportTransferOpen(false); setExportTransferTarget(null) }}>Huỷ</Button>
                    <Button
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={
                        exportTransferTarget.items.some(item => {
                          const inv = inventory.find(i => i.sku === item.sku && i.warehouse === exportTransferTarget.fromWarehouse)
                          return (exportTransferQtys[item.sku] || 0) <= 0 || (exportTransferQtys[item.sku] || 0) > (inv?.available || 0)
                        })
                      }
                      onClick={handleExportTransferConfirm}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Xác nhận xuất kho điều chuyển
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Admin Slips Tab */}
        <TabsContent value="admin-slips">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Select value={slipFilter} onValueChange={v => setSlipFilter(v as typeof slipFilter)}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Lọc trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="pending">Chờ xử lý</SelectItem>
                <SelectItem value="processed">Đã xử lý</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 ml-auto">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {pendingSlipsCount} phiếu chờ xử lý
              </span>
            </div>
          </div>

          {filteredSlips.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">Không có phiếu nào</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredSlips.map(slip => (
                <Card key={slip.id} className={cn(
                  "hover:shadow-md transition-all",
                  slip.status === "pending" && "border-amber-200 bg-amber-50/30"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold text-blue-600">{slip.id}</span>
                          <Badge className={cn("text-[10px]",
                            slip.type === "import" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                          )}>
                            {slip.type === "import" ? "Nhập kho" : "Xuất kho"}
                          </Badge>
                          <Badge className={cn("text-[10px]",
                            slip.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                          )}>
                            {slip.status === "pending" ? "Chờ xử lý" : "Đã xử lý"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{slip.note}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {slip.date}</span>
                          <span>Kho: {slip.warehouse}</span>
                          {slip.supplier && <span>NCC: {slip.supplier}</span>}
                          {slip.poId && <span>PO: {slip.poId}</span>}
                          <span>Từ: {slip.createdBy}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {slip.items.map((item, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs font-normal">
                              {item.sku}: {item.name} ×{item.qty}
                            </Badge>
                          ))}
                        </div>
                        {slip.status === "processed" && slip.processedAt && (
                          <p className="text-xs text-emerald-600 mt-2">
                            Đã xử lý lúc {new Date(slip.processedAt).toLocaleString("vi-VN")} bởi {slip.processedBy}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedSlip(slip); setSlipDetailOpen(true) }}>
                          <Eye className="h-4 w-4 mr-1" /> Chi tiết
                        </Button>
                        {slip.status === "pending" && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleRedirectSlipToTab(slip)}>
                            <ClipboardCheck className="h-4 w-4 mr-1" /> Xử lý
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Slip Detail Dialog */}
          <Dialog open={slipDetailOpen} onOpenChange={setSlipDetailOpen}>
            <DialogContent className="max-w-lg">
              {selectedSlip && (
                <>
                  <DialogHeader>
                    <DialogTitle className="font-serif flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Chi tiết phiếu {selectedSlip.id}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Loại:</span> <Badge className={cn("ml-1 text-[10px]", selectedSlip.type === "import" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>{selectedSlip.type === "import" ? "Nhập kho" : "Xuất kho"}</Badge></div>
                      <div><span className="text-muted-foreground">Trạng thái:</span> <Badge className={cn("ml-1 text-[10px]", selectedSlip.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>{selectedSlip.status === "pending" ? "Chờ xử lý" : "Đã xử lý"}</Badge></div>
                      <div><span className="text-muted-foreground">Ngày tạo:</span> {selectedSlip.date}</div>
                      <div><span className="text-muted-foreground">Kho:</span> {selectedSlip.warehouse}</div>
                      {selectedSlip.supplier && <div><span className="text-muted-foreground">NCC:</span> {selectedSlip.supplier}</div>}
                      {selectedSlip.poId && <div><span className="text-muted-foreground">PO:</span> {selectedSlip.poId}</div>}
                      <div><span className="text-muted-foreground">Người tạo:</span> {selectedSlip.createdBy}</div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Ghi chú:</p>
                      <p className="text-sm bg-muted/50 p-2 rounded">{selectedSlip.note}</p>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">SKU</TableHead>
                          <TableHead className="text-xs">Sản phẩm</TableHead>
                          <TableHead className="text-xs text-center">SL</TableHead>
                          <TableHead className="text-xs text-right">Đơn giá</TableHead>
                          <TableHead className="text-xs text-right">Thành tiền</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSlip.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs text-blue-600">{item.sku}</TableCell>
                            <TableCell className="text-sm">{item.name}</TableCell>
                            <TableCell className="text-center text-sm font-medium">{item.qty}</TableCell>
                            <TableCell className="text-right text-sm">{formatVND(item.unitCost)}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{formatVND(item.qty * item.unitCost)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex justify-between items-center bg-muted/50 px-4 py-2 rounded-lg">
                      <span className="text-sm font-medium">Tổng giá trị phiếu</span>
                      <span className="font-serif text-lg font-bold text-blue-600">
                        {formatVND(selectedSlip.items.reduce((s, i) => s + i.qty * i.unitCost, 0))}
                      </span>
                    </div>
                    {selectedSlip.status === "processed" && selectedSlip.processedAt && (
                      <p className="text-xs text-emerald-600">Đã xử lý lúc {new Date(selectedSlip.processedAt).toLocaleString("vi-VN")} bởi {selectedSlip.processedBy}</p>
                    )}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Đóng</Button>
                    </DialogClose>
                    {selectedSlip.status === "pending" && (
                      <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleRedirectSlipToTab(selectedSlip)}>
                        <ClipboardCheck className="h-4 w-4 mr-1" /> {selectedSlip.type === "import" ? "Chuyển sang nhập kho" : "Chuyển sang xuất kho"}
                      </Button>
                    )}
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Transaction History */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Lịch sử nhập xuất kho</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground">Chưa có giao dịch nào trong phiên này</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Mã</TableHead>
                      <TableHead className="text-xs">Loại</TableHead>
                      <TableHead className="text-xs">Ngày</TableHead>
                      <TableHead className="text-xs">Sản phẩm</TableHead>
                      <TableHead className="text-xs text-center">Số lượng</TableHead>
                      <TableHead className="text-xs text-right">Giá trị</TableHead>
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
                            tx.type === "transfer-out" ? "bg-purple-100 text-purple-700" :
                            "bg-teal-100 text-teal-700"
                          )}>
                            {tx.type === "import" ? "Nhập kho" :
                             tx.type === "export" ? "Xuất bán hàng" :
                             tx.type === "transfer-out" ? "Xuất điều chuyển" :
                             "Nhận điều chuyển"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{tx.date}</TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{tx.productName}</p>
                          <p className="text-xs text-muted-foreground">{tx.sku}</p>
                        </TableCell>
                        <TableCell className={cn("text-center text-sm font-medium",
                          (tx.type === "import" || tx.type === "transfer-in") ? "text-green-600" : "text-orange-600"
                        )}>
                          {(tx.type === "import" || tx.type === "transfer-in") ? "+" : "-"}{tx.qty}
                        </TableCell>
                        <TableCell className="text-right text-sm">{tx.cost > 0 ? formatVND(tx.qty * tx.cost) : "-"}</TableCell>
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
