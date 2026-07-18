"use client"

import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { formatPNKReference, formatPOReference, formatPXKReference, formatTransferReference } from "@/lib/utils"
import { printWarehouseSlip } from "@/lib/print-utils"
import { purchaseOrderApi } from "@/lib/api"
import { useInventory, type TransferRequest } from "@/lib/inventory-context"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import {
  Repeat, ArrowRight, Eye, Package, Clock, CheckCircle2,
  XOctagon, Truck, Warehouse, Plus, Send, Trash2, Minus,
  ArrowDownToLine, Printer, Search
} from "lucide-react"

const BRANCH_WAREHOUSES = ["Kho Cầu Giấy", "Kho Thanh Xuân", "Kho Long Biên"]

interface NewTransferItem {
  sku: string
  name: string
  qty: number
  available: number
  unitCost: number
}

function normalizeHubSearch(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function normalizeDateKey(value?: string | number | Date) {
  if (!value) return ""
  if (typeof value === "string") {
    const trimmed = value.trim()
    const isoDate = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
    if (isoDate) return isoDate[1]
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function isWithinDateRange(value: string | number | Date | undefined, from: string, to: string) {
  const date = normalizeDateKey(value)
  if (from && (!date || date < from)) return false
  if (to && (!date || date > to)) return false
  return true
}

export default function HubTransfersPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const {
    inventory, transferRequests, transactions, adminSlips,
    createTransfer, exportTransferItems, receiveTransferItems, updateTransferStatus,
    importItems, processAdminSlip, refreshInventory,
  } = useInventory()

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in-transit" | "completed" | "rejected">("all")
  const [query, setQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRequest | null>(null)

  // Create transfer dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newToWarehouse, setNewToWarehouse] = useState("")
  const [newReason, setNewReason] = useState("")
  const [newNote, setNewNote] = useState("")
  const [newItems, setNewItems] = useState<NewTransferItem[]>([])
  const [addSku, setAddSku] = useState("")
  const [addQty, setAddQty] = useState(1)
  const [createSuccess, setCreateSuccess] = useState(false)

  // Action confirmations
  const [actionOpen, setActionOpen] = useState(false)
  const [actionTransfer, setActionTransfer] = useState<TransferRequest | null>(null)
  const [actionType, setActionType] = useState<"export" | "receive" | "reject">("export")
  const [actionSuccess, setActionSuccess] = useState(false)

  type HubWarehouseDoc = {
    key: string
    code: string
    kind: "transfer" | "export-transfer" | "import-transfer" | "import-po"
    date: string
    source: string
    target: string
    summary: string
    status: string
    transfer?: TransferRequest
    slip?: typeof adminSlips[number]
  }

  const hubItems = useMemo(() => inventory.filter(i => i.warehouse === "Kho Hub"), [inventory])

  // Only show transfers involving Hub
  const hubTransfers = useMemo(() =>
    transferRequests.filter(t => t.fromWarehouse === "Kho Hub" || t.toWarehouse === "Kho Hub"),
    [transferRequests]
  )

  const normalizedQuery = useMemo(() => normalizeHubSearch(query.trim()), [query])

  const matchesQuery = (parts: unknown[]) => {
    if (!normalizedQuery) return true
    return normalizeHubSearch(parts.join(" ")).includes(normalizedQuery)
  }

  const filtered = useMemo(() => hubTransfers.filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false
    if (!isWithinDateRange(t.date, dateFrom, dateTo)) return false
    return matchesQuery([
      t.reference,
      t.date,
      t.fromWarehouse,
      t.toWarehouse,
      t.status,
      t.reason,
      t.note,
      t.items.map(i => `${i.sku} ${i.name} ${i.qty}`).join(" "),
    ])
  }), [hubTransfers, statusFilter, dateFrom, dateTo, normalizedQuery])

  useEffect(() => {
    const transferId = searchParams.get("transferId")
    if (!transferId) return

    const transfer = hubTransfers.find((item) => item.id === transferId || item.reference === transferId)
    if (!transfer) return

    setStatusFilter("all")
    setSelectedTransfer(transfer)
    setDetailOpen(true)
  }, [hubTransfers, searchParams])

  // Hub related transactions
  const hubTransactions = useMemo(() =>
    transactions.filter(t => t.warehouse === "Kho Hub"),
    [transactions]
  )

  const findTransferForTransaction = (txn: typeof transactions[number]) => {
    const note = String(txn.note || "")
    const uuidMatch = note.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]
    const shortMatch = note.match(/\[([0-9a-f]{8})\]/i)?.[1]
    return hubTransfers.find(t =>
      (uuidMatch && t.id.toLowerCase() === uuidMatch.toLowerCase()) ||
      (shortMatch && t.id.toLowerCase().startsWith(shortMatch.toLowerCase())) ||
      note.includes(t.reference)
    )
  }

  const formatHubTransactionReference = (txn: typeof transactions[number]) => {
    const transfer = txn.type === "transfer-out" || txn.type === "transfer-in"
      ? findTransferForTransaction(txn)
      : null
    if (txn.type === "import" || txn.type === "transfer-in") {
      return formatPNKReference(transfer?.reference || txn.id, txn.date)
    }
    return formatPXKReference(transfer?.reference || txn.id, txn.date)
  }

  const formatHubTransactionNote = (txn: typeof transactions[number]) => {
    const transfer = findTransferForTransaction(txn)
    if (transfer && txn.type === "transfer-out") {
      return `Xuất điều chuyển ${transfer.reference}: Kho Hub → ${transfer.toWarehouse}`
    }
    if (transfer && txn.type === "transfer-in") {
      return `Nhập điều chuyển ${transfer.reference}: ${transfer.fromWarehouse} → Kho Hub`
    }
    return txn.note
  }

  const receivedTransfers = useMemo(
    () => hubTransfers.filter(t => t.toWarehouse === "Kho Hub" && t.status === "completed"),
    [hubTransfers],
  )

  const formatAdminSlipPOReference = (slip: { poId?: string; poRawId?: string; poCreatedAt?: string; date?: string }) => {
    const poValue = slip.poId || slip.poRawId
    return poValue ? formatPOReference(poValue, slip.poCreatedAt || slip.date) : ""
  }

  const describeAdminSlipNote = (slip: { type?: string; note?: string; poId?: string; poRawId?: string; poCreatedAt?: string; date?: string }) => {
    const poCode = formatAdminSlipPOReference(slip)
    if (poCode && slip.type === "import") return `Nhập kho theo PO ${poCode}`
    return slip.note || ""
  }

  const hubImportSlips = useMemo(
    () => adminSlips.filter(slip => slip.type === "import" && slip.warehouse === "Kho Hub"),
    [adminSlips],
  )

  const hubWarehouseDocs = useMemo<HubWarehouseDoc[]>(() => {
    const docs: HubWarehouseDoc[] = []

    for (const transfer of hubTransfers) {
      docs.push({
        key: `dc-${transfer.id}`,
        code: transfer.reference,
        kind: "transfer",
        date: transfer.date,
        source: transfer.fromWarehouse,
        target: transfer.toWarehouse,
        summary: `Phiếu điều chuyển ${transfer.fromWarehouse} → ${transfer.toWarehouse}`,
        status: transfer.status,
        transfer,
      })

      if (transfer.fromWarehouse === "Kho Hub" && ["in-transit", "completed"].includes(transfer.status)) {
        docs.push({
          key: `pxk-transfer-${transfer.id}`,
          code: formatPXKReference(transfer.reference, transfer.date),
          kind: "export-transfer",
          date: transfer.date,
          source: "Kho Hub",
          target: transfer.toWarehouse,
          summary: `Xuất điều chuyển theo ${transfer.reference}`,
          status: transfer.status,
          transfer,
        })
      }

      if (transfer.toWarehouse === "Kho Hub" && transfer.status === "completed") {
        docs.push({
          key: `pnk-transfer-${transfer.id}`,
          code: formatPNKReference(transfer.reference, transfer.completedAt || transfer.date),
          kind: "import-transfer",
          date: transfer.completedAt ? new Date(transfer.completedAt).toISOString().slice(0, 10) : transfer.date,
          source: transfer.fromWarehouse,
          target: "Kho Hub",
          summary: `Nhập điều chuyển theo ${transfer.reference}`,
          status: transfer.status,
          transfer,
        })
      }
    }

    for (const slip of hubImportSlips) {
      const poCode = formatAdminSlipPOReference(slip)
      docs.push({
        key: `pnk-po-${slip.id}`,
        code: formatPNKReference(slip.id, slip.date),
        kind: poCode ? "import-po" : "import-transfer",
        date: slip.date,
        source: slip.supplier || "Admin",
        target: slip.warehouse,
        summary: poCode ? `Nhập kho theo PO ${poCode}` : describeAdminSlipNote(slip),
        status: slip.status,
        slip,
      })
    }

    return docs.sort((a, b) => b.date.localeCompare(a.date) || a.code.localeCompare(b.code))
  }, [hubImportSlips, hubTransfers])

  const filteredHubWarehouseDocs = useMemo(() => hubWarehouseDocs.filter(doc => {
    if (!isWithinDateRange(doc.date, dateFrom, dateTo)) return false
    return matchesQuery([doc.code, doc.date, doc.kind, doc.source, doc.target, doc.summary, doc.status])
  }), [hubWarehouseDocs, dateFrom, dateTo, normalizedQuery])

  const filteredReceivedTransfers = useMemo(() => receivedTransfers.filter(t => {
    const receivedDate = t.completedAt ? new Date(t.completedAt).toISOString().slice(0, 10) : t.date
    if (!isWithinDateRange(receivedDate, dateFrom, dateTo)) return false
    return matchesQuery([
      formatPNKReference(t.reference, t.completedAt || t.date),
      t.reference,
      receivedDate,
      t.fromWarehouse,
      t.toWarehouse,
      t.items.map(i => `${i.sku} ${i.name} ${i.qty}`).join(" "),
      t.status,
    ])
  }), [receivedTransfers, dateFrom, dateTo, normalizedQuery])

  const filteredHubTransactions = useMemo(() => hubTransactions.filter(txn => {
    if (!isWithinDateRange(txn.date, dateFrom, dateTo)) return false
    return matchesQuery([
      formatHubTransactionReference(txn),
      txn.date,
      txn.type,
      txn.sku,
      txn.productName,
      txn.qty,
      formatHubTransactionNote(txn),
    ])
  }), [hubTransactions, dateFrom, dateTo, normalizedQuery])

  const hasActiveHubFilters = Boolean(query.trim() || statusFilter !== "all" || dateFrom || dateTo)

  const clearHubFilters = () => {
    setQuery("")
    setStatusFilter("all")
    setDateFrom("")
    setDateTo("")
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge className="bg-amber-100 text-amber-700 text-xs"><Clock className="h-3 w-3 mr-1" /> Chờ xuất</Badge>
      case "in-transit": return <Badge className="bg-blue-100 text-blue-700 text-xs"><Truck className="h-3 w-3 mr-1" /> Đang vận chuyển</Badge>
      case "completed": return <Badge className="bg-green-100 text-green-700 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" /> Hoàn thành</Badge>
      case "rejected": return <Badge className="bg-red-100 text-red-700 text-xs"><XOctagon className="h-3 w-3 mr-1" /> Từ chối</Badge>
      default: return <Badge variant="outline" className="text-xs">{status}</Badge>
    }
  }

  const docKindLabel: Record<HubWarehouseDoc["kind"], string> = {
    transfer: "Phiếu DC",
    "export-transfer": "PXK điều chuyển",
    "import-transfer": "PNK điều chuyển",
    "import-po": "PNK theo PO",
  }

  const docStatusBadge = (doc: HubWarehouseDoc) => {
    if (doc.slip) {
      return doc.status === "pending"
        ? <Badge className="bg-amber-100 text-amber-700 text-xs"><Clock className="h-3 w-3 mr-1" /> Chờ nhập</Badge>
        : <Badge className="bg-green-100 text-green-700 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" /> Đã nhập</Badge>
    }
    return statusBadge(doc.status)
  }

  const printHubImportSlip = (slip: typeof adminSlips[number]) => {
    printWarehouseSlip({
      id: formatPNKReference(slip.id, slip.date),
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

  const handleProcessHubImportSlip = async (slip: typeof adminSlips[number]) => {
    if (slip.poRawId) {
      const res = await purchaseOrderApi.updateStatus(slip.poRawId, "received")
      if (!res.success) {
        alert(res.error || "Không thể nhập kho theo PO")
        return
      }
    } else {
      await importItems({
        warehouse: slip.warehouse,
        date: new Date().toISOString().split("T")[0],
        note: describeAdminSlipNote(slip) || `Nhập theo phiếu ${formatPNKReference(slip.id, slip.date)}`,
        operator: user?.fullName || "NV Hub",
        items: slip.items.map(item => ({
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          cost: item.unitCost,
        })),
      })
    }

    await processAdminSlip(slip.id, user?.fullName || "NV Hub")
    await refreshInventory()
  }

  const stats = useMemo(() => ({
    total: hubTransfers.length,
    pending: hubTransfers.filter(t => t.status === "pending").length,
    inTransit: hubTransfers.filter(t => t.status === "in-transit").length,
    completed: hubTransfers.filter(t => t.status === "completed").length,
  }), [hubTransfers])

  // ─── Create transfer handler ─────────────────────────────────────────────
  const handleAddItem = () => {
    if (!addSku) return
    if (newItems.find(i => i.sku === addSku)) return // already added
    const item = hubItems.find(i => i.sku === addSku)
    if (!item) return
    setNewItems([...newItems, {
      sku: item.sku, name: item.name, qty: addQty, available: item.available, unitCost: item.unitCost
    }])
    setAddSku("")
    setAddQty(1)
  }

  const handleCreateTransfer = async () => {
    if (!newToWarehouse || newItems.length === 0) return
    const today = new Date().toISOString().slice(0, 10)
    const transferId = await createTransfer({
      date: today,
      fromWarehouse: "Kho Hub",
      toWarehouse: newToWarehouse,
      items: newItems.map(i => ({ sku: i.sku, name: i.name, qty: i.qty, available: i.available })),
      reason: newReason || "Điều chuyển từ Hub",
      note: newNote,
      status: "pending",
      pickupMethod: "delivery",
      createdBy: user?.fullName || "NV Hub",
    })
    if (transferId) {
      setCreateSuccess(true)
      setTimeout(() => {
        setCreateSuccess(false)
        setCreateOpen(false)
        setNewToWarehouse("")
        setNewReason("")
        setNewNote("")
        setNewItems([])
      }, 1500)
    }
  }

  // ─── Action handlers (export / receive / reject) ──────────────────────────
  const openAction = (t: TransferRequest, type: "export" | "receive" | "reject") => {
    setActionTransfer(t)
    setActionType(type)
    setActionSuccess(false)
    setActionOpen(true)
  }

  const handleAction = async () => {
    if (!actionTransfer) return
    const today = new Date().toISOString().slice(0, 10)

    if (actionType === "export") {
      // Hub exports items → status "in-transit"
      const qtys: Record<string, number> = {}
      actionTransfer.items.forEach(i => { qtys[i.sku] = i.qty })
      await exportTransferItems({
        transferId: actionTransfer.id,
        qtys,
        date: today,
        note: `Xuất hàng điều chuyển ${actionTransfer.reference} đến ${actionTransfer.toWarehouse}`,
        operator: user?.fullName || "NV Hub"
      })
    } else if (actionType === "receive") {
      // Hub receives items from branch → status "completed"
      await receiveTransferItems(actionTransfer.id, user?.fullName || "NV Hub")
    } else if (actionType === "reject") {
      await updateTransferStatus(actionTransfer.id, "rejected")
    }
    setActionSuccess(true)
    setTimeout(() => { setActionSuccess(false); setActionOpen(false) }, 1200)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold flex items-center gap-2">
            <Repeat className="h-6 w-6 text-purple-600" /> Quản lý điều chuyển
          </h1>
          <p className="text-sm text-muted-foreground">
            Tạo, xuất hàng, nhận hàng và theo dõi phiếu điều chuyển
          </p>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => { setCreateSuccess(false); setCreateOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Tạo phiếu điều chuyển
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="font-serif text-2xl font-extrabold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Tổng phiếu</p>
          </CardContent>
        </Card>
        <Card className={stats.pending > 0 ? "border-amber-200" : ""}>
          <CardContent className="p-4">
            <p className="font-serif text-2xl font-extrabold text-amber-600">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">Chờ xuất</p>
          </CardContent>
        </Card>
        <Card className={stats.inTransit > 0 ? "border-blue-200" : ""}>
          <CardContent className="p-4">
            <p className="font-serif text-2xl font-extrabold text-blue-600">{stats.inTransit}</p>
            <p className="text-sm text-muted-foreground">Đang vận chuyển</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="font-serif text-2xl font-extrabold text-green-600">{stats.completed}</p>
            <p className="text-sm text-muted-foreground">Hoàn thành</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[280px] max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mã phiếu, chứng từ, kho, SKU, sản phẩm..."
            className="h-9 pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="pending">Chờ xuất</SelectItem>
            <SelectItem value="in-transit">Đang vận chuyển</SelectItem>
            <SelectItem value="completed">Hoàn thành</SelectItem>
            <SelectItem value="rejected">Từ chối</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Label htmlFor="hub-transfer-date-from" className="text-xs text-muted-foreground whitespace-nowrap">Từ ngày</Label>
          <Input
            id="hub-transfer-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-9 w-[155px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="hub-transfer-date-to" className="text-xs text-muted-foreground whitespace-nowrap">Đến ngày</Label>
          <Input
            id="hub-transfer-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-9 w-[155px]"
          />
        </div>
        {hasActiveHubFilters && (
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={clearHubFilters}>
            Xóa lọc
          </Button>
        )}
        <Badge variant="secondary" className="h-8 px-2.5">
          {filtered.length} phiếu / {filteredHubWarehouseDocs.length} chứng từ
        </Badge>
      </div>

      {/* Transfers table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Mã phiếu</TableHead>
                <TableHead className="text-xs">Ngày</TableHead>
                <TableHead className="text-xs">Từ kho</TableHead>
                <TableHead className="text-xs">Đến kho</TableHead>
                <TableHead className="text-xs">Sản phẩm</TableHead>
                <TableHead className="text-xs text-center">Trạng thái</TableHead>
                <TableHead className="text-xs text-center">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Không có phiếu điều chuyển nào
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs text-purple-600">{t.reference}</TableCell>
                  <TableCell className="text-sm">{t.date}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      {t.fromWarehouse === "Kho Hub" && <Warehouse className="h-3 w-3 text-purple-600" />}
                      {t.fromWarehouse}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      {t.toWarehouse === "Kho Hub" && <Warehouse className="h-3 w-3 text-purple-600" />}
                      {t.toWarehouse}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm max-w-[180px] truncate">
                    {t.items.map(i => `${i.name} (x${i.qty})`).join(", ")}
                  </TableCell>
                  <TableCell className="text-center">{statusBadge(t.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {/* Xuất hàng: Hub is source, status pending */}
                      {t.fromWarehouse === "Kho Hub" && t.status === "pending" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                          onClick={() => openAction(t, "export")}>
                          <Send className="h-3 w-3 mr-1" /> Xuất
                        </Button>
                      )}
                      {/* Nhận hàng: Hub is destination, status in-transit */}
                      {t.toWarehouse === "Kho Hub" && t.status === "in-transit" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs border-green-200 text-green-600 hover:bg-green-50"
                          onClick={() => openAction(t, "receive")}>
                          <ArrowDownToLine className="h-3 w-3 mr-1" /> Nhận
                        </Button>
                      )}
                      {/* Từ chối: pending transfers */}
                      {t.status === "pending" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => openAction(t, "reject")}>
                          <XOctagon className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={() => { setSelectedTransfer(t); setDetailOpen(true) }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Hub warehouse documents */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" /> Chứng từ kho Hub
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Mã chứng từ</TableHead>
                <TableHead className="text-xs">Nghiệp vụ</TableHead>
                <TableHead className="text-xs">Ngày</TableHead>
                <TableHead className="text-xs">Nguồn</TableHead>
                <TableHead className="text-xs">Đích</TableHead>
                <TableHead className="text-xs">Nội dung</TableHead>
                <TableHead className="text-xs text-center">Trạng thái</TableHead>
                <TableHead className="text-xs text-center">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHubWarehouseDocs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Chưa có chứng từ kho Hub
                  </TableCell>
                </TableRow>
              )}
              {filteredHubWarehouseDocs.map(doc => (
                <TableRow key={doc.key}>
                  <TableCell className="font-mono text-xs text-primary">{doc.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{docKindLabel[doc.kind]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{doc.date}</TableCell>
                  <TableCell className="text-sm">{doc.source}</TableCell>
                  <TableCell className="text-sm">{doc.target}</TableCell>
                  <TableCell className="text-sm max-w-[260px] truncate">{doc.summary}</TableCell>
                  <TableCell className="text-center">{docStatusBadge(doc)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {doc.transfer && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => { setSelectedTransfer(doc.transfer!); setDetailOpen(true) }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {doc.slip && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => printHubImportSlip(doc.slip!)}>
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {doc.slip?.status === "pending" && (
                        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleProcessHubImportSlip(doc.slip!)}>
                          <ArrowDownToLine className="h-3 w-3 mr-1" /> Nhập kho
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Received transfer import slips */}
      {filteredReceivedTransfers.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-green-600" /> Phiếu đã nhập vào Kho Hub
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Mã phiếu nhập</TableHead>
                  <TableHead className="text-xs">Phiếu điều chuyển</TableHead>
                  <TableHead className="text-xs">Ngày</TableHead>
                  <TableHead className="text-xs">Từ kho</TableHead>
                  <TableHead className="text-xs">Sản phẩm</TableHead>
                  <TableHead className="text-xs text-center">Trạng thái</TableHead>
                  <TableHead className="text-xs text-center">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceivedTransfers.map(t => (
                  <TableRow key={`received-${t.id}`}>
                    <TableCell className="font-mono text-xs text-green-700">
                      {formatPNKReference(t.reference, t.completedAt || t.date)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-purple-600">{t.reference}</TableCell>
                    <TableCell className="text-sm">{t.completedAt ? new Date(t.completedAt).toISOString().slice(0, 10) : t.date}</TableCell>
                    <TableCell className="text-sm">{t.fromWarehouse}</TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate">
                      {t.items.map(i => `${i.name} (x${i.qty})`).join(", ")}
                    </TableCell>
                    <TableCell className="text-center">{statusBadge(t.status)}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={() => { setSelectedTransfer(t); setDetailOpen(true) }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Hub transactions */}
      {filteredHubTransactions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" /> Giao dịch gần đây (Kho Hub)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Mã GD</TableHead>
                  <TableHead className="text-xs">Ngày</TableHead>
                  <TableHead className="text-xs">Loại</TableHead>
                  <TableHead className="text-xs">SKU</TableHead>
                  <TableHead className="text-xs">Sản phẩm</TableHead>
                  <TableHead className="text-xs text-center">SL</TableHead>
                  <TableHead className="text-xs">Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHubTransactions.slice(0, 20).map(txn => (
                  <TableRow key={txn.id}>
                    <TableCell className="font-mono text-[11px]">{formatHubTransactionReference(txn)}</TableCell>
                    <TableCell className="text-sm">{txn.date}</TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "text-xs",
                        txn.type === "transfer-out" ? "bg-red-100 text-red-700" :
                        txn.type === "transfer-in" ? "bg-green-100 text-green-700" :
                        txn.type === "import" ? "bg-blue-100 text-blue-700" :
                        "bg-orange-100 text-orange-700"
                      )}>
                        {txn.type === "transfer-out" ? "Xuất DC" :
                         txn.type === "transfer-in" ? "Nhận DC" :
                         txn.type === "import" ? "Nhập kho" : "Xuất kho"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{txn.sku}</TableCell>
                    <TableCell className="text-sm">{txn.productName}</TableCell>
                    <TableCell className="text-center text-sm font-medium">{txn.qty}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{formatHubTransactionNote(txn)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ═══ Create Transfer Dialog ═══ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-600" /> Tạo phiếu điều chuyển từ Hub
            </DialogTitle>
          </DialogHeader>

          {createSuccess ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="font-medium text-green-700">Tạo phiếu điều chuyển thành công!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Từ kho</Label>
                  <Input className="mt-1" value="Kho Hub" disabled />
                </div>
                <div>
                  <Label className="text-sm">Đến kho <span className="text-red-500">*</span></Label>
                  <Select value={newToWarehouse} onValueChange={setNewToWarehouse}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn kho đích" /></SelectTrigger>
                    <SelectContent>
                      {BRANCH_WAREHOUSES.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm">Lý do</Label>
                <Input className="mt-1" placeholder="VD: Cân bằng tồn kho, bổ sung hàng..." value={newReason} onChange={e => setNewReason(e.target.value)} />
              </div>

              {/* Add item row */}
              <div>
                <Label className="text-sm">Thêm sản phẩm</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Select value={addSku} onValueChange={setAddSku}>
                    <SelectTrigger className="flex-1 h-9"><SelectValue placeholder="Chọn SP từ kho Hub" /></SelectTrigger>
                    <SelectContent>
                      {hubItems.filter(i => i.available > 0 && !newItems.find(ni => ni.sku === i.sku)).map(item => (
                        <SelectItem key={item.sku} value={item.sku}>
                          {item.sku} - {item.name} (có: {item.available})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input className="w-20 h-9" type="number" min={1} value={addQty}
                    onChange={e => setAddQty(Math.max(1, parseInt(e.target.value) || 1))} />
                  <Button variant="outline" size="sm" className="h-9" onClick={handleAddItem} disabled={!addSku}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Items list */}
              {newItems.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">SKU</TableHead>
                      <TableHead className="text-xs">Sản phẩm</TableHead>
                      <TableHead className="text-xs text-center">Khả dụng</TableHead>
                      <TableHead className="text-xs text-center">SL chuyển</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newItems.map((item, idx) => (
                      <TableRow key={item.sku}>
                        <TableCell className="font-mono text-xs text-primary">{item.sku}</TableCell>
                        <TableCell className="text-sm">{item.name}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{item.available}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                              onClick={() => { const ni = [...newItems]; ni[idx].qty = Math.max(1, ni[idx].qty - 1); setNewItems(ni) }}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="font-medium text-sm w-8 text-center">{item.qty}</span>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                              onClick={() => { const ni = [...newItems]; ni[idx].qty = Math.min(item.available, ni[idx].qty + 1); setNewItems(ni) }}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500"
                            onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div>
                <Label className="text-sm">Ghi chú</Label>
                <Textarea className="mt-1" placeholder="Ghi chú thêm..." value={newNote} onChange={e => setNewNote(e.target.value)} rows={2} />
              </div>
            </div>
          )}

          {!createSuccess && (
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Hủy</Button>
              </DialogClose>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleCreateTransfer} disabled={!newToWarehouse || newItems.length === 0}>
                <Send className="h-4 w-4 mr-2" /> Tạo phiếu
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Action Confirm Dialog ═══ */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              {actionType === "export" && <><Send className="h-5 w-5 text-blue-600" /> Xác nhận xuất hàng</>}
              {actionType === "receive" && <><ArrowDownToLine className="h-5 w-5 text-green-600" /> Xác nhận nhận hàng</>}
              {actionType === "reject" && <><XOctagon className="h-5 w-5 text-red-600" /> Xác nhận từ chối</>}
            </DialogTitle>
          </DialogHeader>

          {actionSuccess ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="font-medium text-green-700">Thao tác thành công!</p>
            </div>
          ) : actionTransfer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Mã phiếu</p>
                  <p className="font-mono font-medium text-purple-600">{actionTransfer.reference}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Trạng thái hiện tại</p>
                  <div className="mt-0.5">{statusBadge(actionTransfer.status)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Từ kho</p>
                  <p className="font-medium">{actionTransfer.fromWarehouse}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Đến kho</p>
                  <p className="font-medium">{actionTransfer.toWarehouse}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">SKU</TableHead>
                    <TableHead className="text-xs">Sản phẩm</TableHead>
                    <TableHead className="text-xs text-center">SL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actionTransfer.items.map(item => (
                    <TableRow key={item.sku}>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell className="text-sm">{item.name}</TableCell>
                      <TableCell className="text-center font-medium">{item.qty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {actionType === "export" && (
                <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                  Hàng sẽ được trừ khỏi Kho Hub và chuyển trạng thái sang &quot;Đang vận chuyển&quot;.
                </p>
              )}
              {actionType === "receive" && (
                <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                  Hàng sẽ được cộng vào Kho Hub và phiếu chuyển sang &quot;Hoàn thành&quot;.
                </p>
              )}
              {actionType === "reject" && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  Phiếu điều chuyển sẽ bị từ chối. Tồn kho không thay đổi.
                </p>
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Hủy</Button>
                </DialogClose>
                <Button
                  className={cn(
                    actionType === "export" ? "bg-blue-600 hover:bg-blue-700" :
                    actionType === "receive" ? "bg-green-600 hover:bg-green-700" :
                    "bg-red-600 hover:bg-red-700",
                    "text-white"
                  )}
                  onClick={handleAction}
                >
                  {actionType === "export" && "Xác nhận xuất hàng"}
                  {actionType === "receive" && "Xác nhận nhận hàng"}
                  {actionType === "reject" && "Xác nhận từ chối"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Transfer Detail Dialog ═══ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Repeat className="h-5 w-5 text-purple-600" />
              Chi tiết điều chuyển {selectedTransfer?.reference}
            </DialogTitle>
          </DialogHeader>
          {selectedTransfer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Ngày tạo</p>
                  <p className="font-medium">{selectedTransfer.date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Trạng thái</p>
                  <div className="mt-0.5">{statusBadge(selectedTransfer.status)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Từ kho</p>
                  <p className="font-medium">{selectedTransfer.fromWarehouse}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Đến kho</p>
                  <p className="font-medium">{selectedTransfer.toWarehouse}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Người tạo</p>
                  <p className="font-medium">{selectedTransfer.createdBy}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Lý do</p>
                  <p className="font-medium">{selectedTransfer.reason}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">SKU</TableHead>
                    <TableHead className="text-xs">Sản phẩm</TableHead>
                    <TableHead className="text-xs text-center">Số lượng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedTransfer.items.map(item => (
                    <TableRow key={item.sku}>
                      <TableCell className="font-mono text-xs text-primary">{item.sku}</TableCell>
                      <TableCell className="text-sm">{item.name}</TableCell>
                      <TableCell className="text-center font-medium">{item.qty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {selectedTransfer.note && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <p className="text-muted-foreground text-xs mb-1">Ghi chú:</p>
                  <p>{selectedTransfer.note}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Đóng</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
