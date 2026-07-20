"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { POStatusBadge } from "@/components/shared"
import { formatPOReference, formatVND } from "@/lib/utils"
import { inventoryApi, purchaseOrderApi } from "@/lib/api"
import { printWarehouseSlip } from "@/lib/print-utils"
import { cn } from "@/lib/utils"
import {
  Search, Plus, Eye, FileText, Truck, Package, Clock,
  CheckCircle2, XCircle, Phone, Mail, MapPin, Calendar,
  Send, ChevronRight, Warehouse, Trash2, Printer
} from "lucide-react"
import { useInventory } from "@/lib/inventory-context"

// ── Types ──────────────────────────────────────────────────────────────────
interface POItemData { sku: string; name: string; qty: number; unitCost: number }
interface PurchaseOrder {
  id: string; code: string; supplier: string; status: string; createdDate: string;
  totalValue: number; items: POItemData[]; warehouse: string; note: string;
  warehouseId?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const poStepperSteps = [
  { label: "Tạo", icon: <FileText className="h-3 w-3" /> },
  { label: "Gửi", icon: <Send className="h-3 w-3" /> },
  { label: "Xác nhận", icon: <CheckCircle2 className="h-3 w-3" /> },
  { label: "Vận chuyển", icon: <Truck className="h-3 w-3" /> },
  { label: "Đã nhận", icon: <Package className="h-3 w-3" /> },
]

function getPOStep(status: string) {
  switch (status) {
    case "draft": return 0
    case "sent": return 1
    case "confirmed": return 2
    case "shipping": return 3
    case "received": return 4
    case "cancelled": return -1
    default: return 0
  }
}

const ALL_WAREHOUSES = ["Kho Hub", "Kho Cầu Giấy", "Kho Thanh Xuân", "Kho Long Biên"]

function buildWarehouseSlipCode(prefix: "PNK" | "PXK", seed?: string) {
  const source = String(seed || Date.now()).replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  return `${prefix}-${new Date().getFullYear()}-${source.slice(-6)}`
}

function mapPurchaseOrder(p: any): PurchaseOrder {
  const rawId = String(p.id || "")
  const createdAt = p.createdAt || p.created_at || null
  const items = p.items || p.po_items || []

  return {
    id: rawId,
    code: formatPOReference(p.poCode || p.po_code || p.orderCode || p.order_code || rawId, createdAt),
    supplier: p.supplierName || p.supplier_name || p.supplier || "",
    status: p.status || "draft",
    createdDate: createdAt ? new Date(createdAt).toISOString().split("T")[0] : "",
    totalValue: Number(p.totalValue ?? p.total_value ?? 0),
    items: items.map((i: any) => ({
      sku: i.sku,
      name: i.name || i.product_name || "",
      qty: i.qty || i.quantity || 0,
      unitCost: i.unitCost || i.unit_cost || i.price || 0,
    })),
    warehouse: p.warehouseName || p.warehouse_name || p.warehouse || "Kho Hub",
    warehouseId: p.warehouseId ?? p.warehouse_id,
    note: p.note || "",
  }
}

// ── PO Detail Sheet ────────────────────────────────────────────────────────
function PODetailSheet({ po, suppliers, onUpdateStatus }: { po: PurchaseOrder; suppliers: any[]; onUpdateStatus: (id: string, status: string) => void }) {
  const step = getPOStep(po.status)
  const supplier = suppliers.find((s: any) => s.name === po.supplier)
  const safeItems = Array.isArray(po.items) ? po.items : []
  const subtotal = safeItems.reduce((s, i) => s + i.qty * i.unitCost, 0)
  const vat = subtotal * 0.08
  const total = subtotal + vat
  const ctx = useInventory()
  const { adminSlips, createAdminSlip } = ctx
  const poImportSlip = adminSlips.find(s => s.type === "import" && (s.poRawId === po.id || s.poId === po.code))

  const printPOImportSlip = (id: string, date: string, statusNote = `Nhap kho theo PO ${po.code} - ${po.supplier}`) => {
    printWarehouseSlip({
      id,
      type: "import",
      date,
      warehouse: po.warehouse,
      supplier: po.supplier,
      poId: po.code,
      note: statusNote,
      createdBy: "Admin",
      assignedTo: po.warehouse,
      items: safeItems.map(i => ({ sku: i.sku, name: i.name, qty: i.qty, unitCost: i.unitCost })),
    })
  }

  const handleCreateImportSlip = async () => {
    if (poImportSlip) return
    const slipDate = new Date().toISOString().split("T")[0]
    const slipId = await createAdminSlip({
      type: "import",
      source: "admin",
      poId: po.code,
      poRawId: po.id,
      supplierId: supplier?.id,
      supplier: po.supplier,
      date: slipDate,
      warehouse: po.warehouse,
      items: safeItems.map(i => ({ sku: i.sku, name: i.name, qty: i.qty, unitCost: i.unitCost })),
      note: `Nhap kho theo PO ${po.code} - ${po.supplier}`,
      status: "pending",
      createdBy: "Admin",
      assignedTo: po.warehouse,
    })
    await ctx.refreshInventory()
    printPOImportSlip(slipId || buildWarehouseSlipCode("PNK", po.id || po.code), slipDate)
  }

  return (
    <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto">
      <SheetHeader>
        <SheetTitle className="font-serif">Chi tiết đơn hàng</SheetTitle>
      </SheetHeader>

      <div className="mt-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sm text-primary font-semibold">{po.code}</p>
            <p className="text-muted-foreground text-sm mt-0.5">{po.supplier}</p>
          </div>
          <POStatusBadge status={po.status} />
        </div>

        {/* Stepper */}
        {po.status !== "cancelled" && (
          <div className="flex items-center gap-0.5">
            {poStepperSteps.map((s, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-full shrink-0 transition-colors",
                    i <= step ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {s.icon}
                  </div>
                  <span className={cn("text-[10px]", i <= step ? "text-secondary font-medium" : "text-muted-foreground")}>{s.label}</span>
                </div>
                {i < poStepperSteps.length - 1 && (
                  <div className={cn("h-0.5 flex-1 mx-1 rounded-full -mt-4", i < step ? "bg-secondary" : "bg-muted")} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* PO Items Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sản phẩm ({safeItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
                {safeItems.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <p className="text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                    </TableCell>
                    <TableCell className="text-center text-sm">{item.qty}</TableCell>
                    <TableCell className="text-right text-sm">{formatVND(item.unitCost)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatVND(item.qty * item.unitCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-4 border-t space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tạm tính</span>
                <span>{formatVND(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT (8%)</span>
                <span>{formatVND(vat)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1.5 border-t">
                <span>Tổng cộng</span>
                <span className="text-primary">{formatVND(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Kho nhận hàng</span>
              <span className="font-medium">{po.warehouse}</span>
            </div>
            {po.note && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ghi chú</span>
                <span>{po.note}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supplier Info */}
        {supplier && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Nhà cung cấp</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <p className="font-medium">{supplier.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> {supplier.phone}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> {supplier.email}
              </div>
              <p className="text-sm text-muted-foreground">Liên hệ: {supplier.contact}</p>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 sticky bottom-0 bg-card pt-3 border-t">
          {po.status === "draft" && (
            <>
              <Button variant="outline" className="flex-1" onClick={() => onUpdateStatus(po.id, "cancelled")}>
                <XCircle className="h-4 w-4 mr-1" /> Huỷ
              </Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => onUpdateStatus(po.id, "sent")}>
                <Send className="h-4 w-4 mr-1" /> Gửi NCC
              </Button>
            </>
          )}
          {po.status === "sent" && (
            <>
              <Button variant="outline" className="flex-1" onClick={() => onUpdateStatus(po.id, "cancelled")}>
                <XCircle className="h-4 w-4 mr-1" /> Huỷ
              </Button>
              <Button className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground" onClick={() => onUpdateStatus(po.id, "confirmed")}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Xác nhận
              </Button>
            </>
          )}
          {po.status === "confirmed" && (
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onUpdateStatus(po.id, "shipping")}>
              <Truck className="h-4 w-4 mr-1" /> Đánh dấu vận chuyển
            </Button>
          )}
          {po.status === "shipping" && (
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">Nhập vào kho:</Label>
                <span className="text-sm font-medium">{po.warehouse}</span>
              </div>
              {poImportSlip ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 space-y-2">
                  <div>
                    Đã tạo phiếu nhập kho <span className="font-mono font-semibold">{poImportSlip.id}</span>. Chờ kho xác nhận nhập.
                  </div>
                  <Button variant="outline" size="sm" className="h-8 bg-white" onClick={() => printPOImportSlip(poImportSlip.id, poImportSlip.date, poImportSlip.note)}>
                    <Printer className="h-4 w-4 mr-1" /> In phieu
                  </Button>
                </div>
              ) : (
                <Button className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                  onClick={handleCreateImportSlip}>
                  <Package className="h-4 w-4 mr-1" /> Tạo phiếu nhập kho → {po.warehouse}
                </Button>
              )}
            </div>
          )}
          {po.status === "received" && (
            <div className="flex items-center gap-2 text-sm text-green-600 w-full justify-center py-2">
              <CheckCircle2 className="h-4 w-4" /> Đã nhận hàng và nhập kho
            </div>
          )}
        </div>
      </div>
    </SheetContent>
  )
}

interface POItem { sku: string; name: string; qty: number; unitCost: number }

export default function AdminPurchaseOrders() {
  const [activeTab, setActiveTab] = useState("all")
  const [search, setSearch] = useState("")
  const [createStep, setCreateStep] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [poWarehouse, setPoWarehouse] = useState("Kho Hub")
  const [poNote, setPoNote] = useState("")

  // PO list state (API-backed)
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([])
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const ctx = useInventory()

  useEffect(() => {
    const init = async () => {
      try {
        const [poRes, supRes, whRes] = await Promise.all([
          purchaseOrderApi.getAll(),
          purchaseOrderApi.getSuppliers(),
          inventoryApi.getWarehouses(),
        ])
        if (poRes.success && poRes.data) {
          setPurchaseOrders(poRes.data.map(mapPurchaseOrder))
        }
        if (supRes.success && supRes.data) setSuppliers(supRes.data)
        if (whRes.success && whRes.data) setWarehouses(whRes.data)
      } catch {}
      // Use inventory from context for SKU lookup
      setInventoryItems(ctx.inventory)
    }
    init()
  }, [ctx.inventory])

  const refreshPOs = async () => {
    try {
      const res = await purchaseOrderApi.getAll()
      if (res.success && res.data) {
        setPurchaseOrders(res.data.map(mapPurchaseOrder))
      }
    } catch {}
  }

  // PO creation state
  const [selectedSupplier, setSelectedSupplier] = useState<typeof suppliers[0] | null>(null)
  const [poItems, setPoItems] = useState<POItemData[]>([])
  const [addSku, setAddSku] = useState("")
  const [addQty, setAddQty] = useState(1)
  const [supplierSearch, setSupplierSearch] = useState("")

  const uniqueSkuItems = useMemo(() => {
    const seen = new Set<string>()
    return inventoryItems.filter((i: any) => {
      const sku = i.sku
      if (!sku || seen.has(sku)) return false
      seen.add(sku)
      return true
    })
  }, [inventoryItems])

  const warehouseOptions = warehouses.length > 0 ? warehouses : ALL_WAREHOUSES.map((name, idx) => ({ id: idx + 1, name }))

  const filteredSuppliers = suppliers.filter(s =>
    !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || String(s.contact || s.contactPerson || "").toLowerCase().includes(supplierSearch.toLowerCase())
  )

  const poSubtotal = poItems.reduce((s, i) => s + i.qty * i.unitCost, 0)
  const poVat = poSubtotal * 0.08
  const poTotal = poSubtotal + poVat

  const handleAddItem = () => {
    if (!addSku || addQty <= 0) return
    const item = uniqueSkuItems.find((i: any) => i.sku === addSku)
    if (!item) return
    const existing = poItems.find(i => i.sku === addSku)
    if (existing) {
      setPoItems(prev => prev.map(i => i.sku === addSku ? { ...i, qty: i.qty + addQty } : i))
    } else {
      setPoItems(prev => [...prev, { sku: item.sku, name: item.name, qty: addQty, unitCost: item.unitCost }])
    }
    setAddSku("")
    setAddQty(1)
  }

  const handleRemoveItem = (sku: string) => {
    setPoItems(prev => prev.filter(i => i.sku !== sku))
  }

  const handleOpenCreate = () => {
    setCreateStep(0)
    setSelectedSupplier(null)
    setPoItems([])
    setAddSku("")
    setAddQty(1)
    setPoWarehouse("Kho Hub")
    setPoNote("")
    setSupplierSearch("")
  }

  const handleCreatePO = async () => {
    if (poItems.length === 0 || !selectedSupplier) return
    const selectedWarehouse = warehouses.find(w => w.name === poWarehouse)
    const warehouseId = selectedWarehouse?.id ?? inventoryItems.find((i: any) => i.warehouse === poWarehouse)?.warehouseId
    if (!warehouseId) {
      alert("Không tìm thấy kho nhận hàng")
      return
    }
    try {
      const res = await purchaseOrderApi.create({
        supplier_id: selectedSupplier.id,
        warehouse_id: warehouseId,
        note: poNote,
        items: poItems.map(i => ({ sku: i.sku, quantity: i.qty, price: i.unitCost })),
      })
      if (!res.success) {
        alert(res.error || "Loi tao PO")
        return
      }
      await refreshPOs()
      setShowCreate(false)
    } catch { alert("Lỗi tạo PO") }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await purchaseOrderApi.updateStatus(id, status)
      if (!res.success) {
        alert(res.error || "Loi cap nhat trang thai")
        return
      }
      await ctx.refreshInventory()
      await refreshPOs()
    } catch { alert("Lỗi cập nhật trạng thái") }
  }

  const filtered = purchaseOrders.filter(po => {
    if (activeTab !== "all" && po.status !== activeTab) return false
    if (search && !po.code.toLowerCase().includes(search.toLowerCase()) && !po.id.toLowerCase().includes(search.toLowerCase()) && !po.supplier.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Đơn đặt hàng</h1>
          <p className="text-sm text-muted-foreground">Quản lý đơn đặt hàng từ nhà cung cấp</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" /> Tạo PO
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif">Tạo đơn đặt hàng mới</DialogTitle>
            </DialogHeader>

            {/* Create PO Stepper */}
            <div className="flex items-center gap-2 mb-4">
              {["Chọn NCC", "Sản phẩm", "Xác nhận"].map((label, i) => (
                <div key={i} className="flex items-center flex-1">
                  <div className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold shrink-0",
                    i <= createStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {i < createStep ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={cn("ml-2 text-sm", i <= createStep ? "font-medium" : "text-muted-foreground")}>{label}</span>
                  {i < 2 && <div className={cn("h-0.5 flex-1 mx-3 rounded-full", i < createStep ? "bg-primary" : "bg-muted")} />}
                </div>
              ))}
            </div>

            {/* Step Content */}
            {createStep === 0 && (
              <div className="space-y-3">
                <Input placeholder="Tìm nhà cung cấp..." className="h-9" value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} />
                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto">
                  {filteredSuppliers.map(s => (
                    <Card key={s.id} className={cn("cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 transition-all", selectedSupplier?.id === s.id && "border-primary bg-primary/5")} onClick={() => { setSelectedSupplier(s); setCreateStep(1) }}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.contact} - {s.phone}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {createStep === 1 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">NCC: <strong className="text-foreground">{selectedSupplier?.name}</strong></p>
                <div className="flex items-center gap-2">
                  <Select value={addSku} onValueChange={setAddSku}>
                    <SelectTrigger className="flex-1 h-9"><SelectValue placeholder="Chọn sản phẩm" /></SelectTrigger>
                    <SelectContent>
                      {uniqueSkuItems.map(item => (
                        <SelectItem key={item.sku} value={item.sku}>{item.sku} - {item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="SL" className="w-20 h-9" type="number" min={1} value={addQty} onChange={e => setAddQty(Math.max(1, parseInt(e.target.value) || 1))} />
                  <Button variant="outline" size="sm" onClick={handleAddItem} disabled={!addSku}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Thêm
                  </Button>
                </div>

                {poItems.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Sản phẩm</TableHead>
                          <TableHead className="text-xs text-center w-24">SL</TableHead>
                          <TableHead className="text-xs text-right">Đơn giá</TableHead>
                          <TableHead className="text-xs text-right">Thành tiền</TableHead>
                          <TableHead className="text-xs w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {poItems.map((item) => (
                          <TableRow key={item.sku}>
                            <TableCell>
                              <p className="text-sm font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number" min={1}
                                className="h-7 w-16 mx-auto text-center text-xs"
                                value={item.qty}
                                onChange={e => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1)
                                  setPoItems(prev => prev.map(i => i.sku === item.sku ? { ...i, qty: val } : i))
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm whitespace-nowrap">{formatVND(item.unitCost)}</TableCell>
                            <TableCell className="text-right text-sm font-medium whitespace-nowrap">{formatVND(item.qty * item.unitCost)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleRemoveItem(item.sku)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Chưa có sản phẩm nào. Chọn sản phẩm và bấm "Thêm".</p>
                  </div>
                )}

                {poItems.length > 0 && (
                  <div className="text-right text-sm font-medium pt-2 border-t">
                    Tạm tính: <span className="text-primary">{formatVND(poSubtotal)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCreateStep(0)}>Quay lại</Button>
                  <Button onClick={() => setCreateStep(2)} disabled={poItems.length === 0} className="bg-primary hover:bg-primary/90 text-primary-foreground">Tiếp tục</Button>
                </div>
              </div>
            )}

            {createStep === 2 && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Nhà cung cấp</span>
                      <span className="font-medium">{selectedSupplier?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Số sản phẩm</span>
                      <span className="font-medium">{poItems.length} sản phẩm ({poItems.reduce((s, i) => s + i.qty, 0)} đơn vị)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tạm tính</span>
                      <span>{formatVND(poSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">VAT (8%)</span>
                      <span>{formatVND(poVat)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold pt-2 border-t">
                      <span>Tổng giá trị</span>
                      <span className="text-primary">{formatVND(poTotal)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Chi tiết SP */}
                <div className="max-h-[150px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Sản phẩm</TableHead>
                        <TableHead className="text-xs text-center">SL</TableHead>
                        <TableHead className="text-xs text-right">Thành tiền</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {poItems.map(item => (
                        <TableRow key={item.sku}>
                          <TableCell className="text-xs">{item.name}</TableCell>
                          <TableCell className="text-center text-xs">{item.qty}</TableCell>
                          <TableCell className="text-right text-xs">{formatVND(item.qty * item.unitCost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <Label className="text-sm flex items-center gap-1"><Warehouse className="h-3.5 w-3.5" /> Kho nhận hàng</Label>
                  <Select value={poWarehouse} onValueChange={setPoWarehouse}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {warehouseOptions.map(w => (
                        <SelectItem key={w.id} value={w.name}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Mặc định nhập về Kho Hub. Admin có thể chọn nhập thẳng vào kho chi nhánh.</p>
                </div>
                <div>
                  <Label className="text-sm">Ghi chú</Label>
                  <Textarea className="mt-1" placeholder="Ghi chú cho NCC..." value={poNote} onChange={e => setPoNote(e.target.value)} />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCreateStep(1)}>Quay lại</Button>
                  <Button onClick={handleCreatePO} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">Tạo đơn hàng</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {[
          { title: "Tổng PO", value: purchaseOrders.length.toString(), icon: <FileText className="h-5 w-5" />, color: "bg-primary/10 text-primary" },
          { title: "Đã gửi NCC", value: purchaseOrders.filter(p => p.status === "sent").length.toString(), icon: <Clock className="h-5 w-5" />, color: "bg-amber-100 text-amber-600" },
          { title: "Đang vận chuyển", value: purchaseOrders.filter(p => p.status === "shipping").length.toString(), icon: <Truck className="h-5 w-5" />, color: "bg-blue-100 text-blue-600" },
          { title: "Tổng giá trị", value: formatVND(purchaseOrders.reduce((s, p) => s + p.totalValue, 0)), icon: <Package className="h-5 w-5" />, color: "bg-secondary/10 text-secondary" },
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

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList className="bg-muted/50 h-10">
          {[
            { value: "all", label: "Tất cả", count: purchaseOrders.length },
            { value: "draft", label: "Nháp", count: purchaseOrders.filter(p => p.status === "draft").length },
            { value: "sent", label: "Đã gửi", count: purchaseOrders.filter(p => p.status === "sent").length },
            { value: "confirmed", label: "Đã xác nhận", count: purchaseOrders.filter(p => p.status === "confirmed").length },
            { value: "shipping", label: "Vận chuyển", count: purchaseOrders.filter(p => p.status === "shipping").length },
            { value: "received", label: "Đã nhận", count: purchaseOrders.filter(p => p.status === "received").length },
          ].map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs gap-1.5 data-[state=active]:text-primary">
              {tab.label}
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{tab.count}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm mã PO, NCC..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* PO Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Mã PO</TableHead>
                <TableHead className="text-xs">Nhà cung cấp</TableHead>
                <TableHead className="text-xs">Ngày tạo</TableHead>
                <TableHead className="text-xs text-center">Số SP</TableHead>
                <TableHead className="text-xs text-right">Giá trị</TableHead>
                <TableHead className="text-xs">Trạng thái</TableHead>
                <TableHead className="text-xs w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((po, idx) => (
                <TableRow key={po.id} className={cn("hover:bg-muted/50", idx % 2 !== 0 && "bg-muted/20")}>
                  <TableCell className="font-mono text-xs text-primary font-semibold">{po.code}</TableCell>
                  <TableCell className="text-sm">{po.supplier}</TableCell>
                  <TableCell className="text-sm">{po.createdDate}</TableCell>
                  <TableCell className="text-center text-sm">{Array.isArray(po.items) ? po.items.length : 0}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatVND(po.totalValue)}</TableCell>
                  <TableCell><POStatusBadge status={po.status} /></TableCell>
                  <TableCell>
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </SheetTrigger>
                      <PODetailSheet po={po} suppliers={suppliers} onUpdateStatus={handleUpdateStatus} />
                    </Sheet>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
