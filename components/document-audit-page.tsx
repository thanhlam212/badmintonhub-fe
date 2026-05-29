"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { inventoryApi, orderApi, purchaseOrderApi, salesOrderApi, transferApi } from "@/lib/api"
import { printOrderInvoice, printTransferSlip, printWarehouseSlip } from "@/lib/print-utils"
import { formatHDReference, formatPOReference, formatVND } from "@/lib/utils"
import { Eye, Printer, Search } from "lucide-react"

export type AuditDocCategory = "invoice" | "export" | "import" | "transfer" | "purchase" | "other"
type AuditDocSource = "sales-order" | "online-order" | "inventory-transaction" | "transfer-request" | "purchase-order" | "export-slip" | "admin-slip"

interface AuditDocument {
  id: string
  code: string
  category: AuditDocCategory
  source: AuditDocSource
  date: string
  subject: string
  summary: string
  raw: any
}

interface DocumentLine {
  sku?: string
  name: string
  qty: number
  unitPrice: number
}

const ADMIN_SLIPS_KEY = "bh_admin_slips"

const auditCategoryMeta: Record<AuditDocCategory, { label: string; cls: string }> = {
  invoice: { label: "Hóa đơn", cls: "bg-violet-100 text-violet-800 border-violet-200" },
  export: { label: "Xuất kho", cls: "bg-orange-100 text-orange-800 border-orange-200" },
  import: { label: "Nhập kho", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  transfer: { label: "Điều chuyển", cls: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  purchase: { label: "PO", cls: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  other: { label: "Khác", cls: "bg-slate-100 text-slate-800 border-slate-200" },
}

function normalizeText(value?: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function formatLocalDate(value?: string | number | Date) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ""
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function buildWarehouseDocCode(prefix: "PNK" | "PXK", rawId?: string) {
  const raw = String(rawId || "").trim()
  if (!raw) return ""
  if (new RegExp(`^${prefix}-`, "i").test(raw)) return raw.toUpperCase()
  const normalized = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  return `${prefix}-${normalized.slice(0, 8)}`
}

function getDocumentLines(doc: AuditDocument): DocumentLine[] {
  const raw = doc.raw || {}
  if (doc.source === "sales-order") {
    return (Array.isArray(raw.items) ? raw.items : []).map((item: any) => ({
      sku: item?.sku || undefined,
      name: item?.product_name || item?.name || "Sản phẩm",
      qty: Number(item?.qty || item?.quantity || 0),
      unitPrice: Number(item?.price || 0),
    }))
  }

  if (doc.source === "online-order") {
    return (Array.isArray(raw.items) ? raw.items : []).map((item: any) => ({
      sku: item?.sku || undefined,
      name: item?.productName || item?.product_name || item?.name || "Sản phẩm",
      qty: Number(item?.quantity || item?.qty || 0),
      unitPrice: Number(item?.price || 0),
    }))
  }

  if (doc.source === "purchase-order") {
    const items = Array.isArray(raw.po_items) ? raw.po_items : Array.isArray(raw.items) ? raw.items : []
    return items.map((item: any) => ({
      sku: item?.sku || undefined,
      name: item?.name || item?.product_name || "Sản phẩm",
      qty: Number(item?.qty || item?.quantity || 0),
      unitPrice: Number(item?.unit_cost || item?.unitCost || item?.price || 0),
    }))
  }

  if (doc.source === "transfer-request") {
    return (Array.isArray(raw.items) ? raw.items : []).map((item: any) => ({
      sku: item?.sku || undefined,
      name: item?.name || item?.product_name || "Sản phẩm",
      qty: Number(item?.qty || item?.quantity || 0),
      unitPrice: 0,
    }))
  }

  if (doc.source === "inventory-transaction") {
    return [{
      sku: raw?.sku || undefined,
      name: raw?.product_name || raw?.name || "Sản phẩm",
      qty: Number(raw?.qty || raw?.quantity || 0),
      unitPrice: Number(raw?.cost || raw?.unit_cost || 0),
    }]
  }

  if (doc.source === "admin-slip") {
    return (Array.isArray(raw.items) ? raw.items : []).map((item: any) => ({
      sku: item?.sku || undefined,
      name: item?.name || "Sản phẩm",
      qty: Number(item?.qty || 0),
      unitPrice: Number(item?.unitCost || item?.unit_cost || 0),
    }))
  }

  if (doc.source === "export-slip") {
    return (Array.isArray(raw.items) ? raw.items : []).map((item: any) => ({
      sku: item?.sku || undefined,
      name: item?.name || "Sản phẩm",
      qty: Number(item?.qty || item?.quantity || 0),
      unitPrice: Number(item?.price || item?.unitCost || 0),
    }))
  }

  return []
}

export function DocumentAuditPage({ title, subtitle }: { title: string; subtitle: string }) {
  const [docs, setDocs] = useState<AuditDocument[]>([])
  const [query, setQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<"all" | AuditDocCategory>("all")
  const [selectedDoc, setSelectedDoc] = useState<AuditDocument | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const openDetails = (doc: AuditDocument) => {
    setSelectedDoc(doc)
    setDetailOpen(true)
  }

  const handlePrint = (doc: AuditDocument) => {
    const raw = doc.raw || {}
    const lines = getDocumentLines(doc)

    if (doc.category === "transfer") {
      printTransferSlip({
        code: doc.code,
        date: doc.date,
        fromWarehouse: String(raw?.from_warehouse_name || raw?.fromWarehouse || ""),
        toWarehouse: String(raw?.to_warehouse_name || raw?.toWarehouse || ""),
        reason: String(raw?.reason || ""),
        note: String(raw?.note || ""),
        status: String(raw?.status || ""),
        createdBy: String(raw?.created_by_name || raw?.createdBy || ""),
        pickupMethod: String(raw?.pickup_method || raw?.pickupMethod || "employee"),
        items: lines.map((line) => ({ sku: line.sku || "", name: line.name, qty: line.qty })),
      })
      return
    }

    if (doc.category === "import" || doc.category === "export") {
      printWarehouseSlip({
        id: doc.code,
        type: doc.category,
        date: doc.date,
        warehouse: String(raw?.warehouse_name || raw?.warehouse || doc.subject || "Kho"),
        supplier: raw?.supplier_name || raw?.supplier,
        poId: raw?.po_code || raw?.order_code || raw?.poId,
        note: String(raw?.note || doc.summary || ""),
        createdBy: String(raw?.created_by_name || raw?.createdBy || raw?.operator || ""),
        assignedTo: String(raw?.assigned_to || raw?.assignedTo || ""),
        processedBy: raw?.processed_by || raw?.processedBy,
        items: lines.map((line) => ({
          sku: line.sku || "",
          name: line.name,
          qty: line.qty,
          unitCost: line.unitPrice,
        })),
      })
      return
    }

    if (doc.category === "purchase") {
      printWarehouseSlip({
        id: doc.code,
        type: "import",
        date: doc.date,
        warehouse: String(raw?.warehouse_name || raw?.warehouse || "Kho"),
        supplier: raw?.supplier_name || raw?.supplier,
        poId: doc.code,
        note: String(raw?.note || ""),
        createdBy: String(raw?.created_by_name || raw?.createdBy || ""),
        assignedTo: "",
        processedBy: raw?.processed_by || raw?.processedBy,
        items: lines.map((line) => ({
          sku: line.sku || "",
          name: line.name,
          qty: line.qty,
          unitCost: line.unitPrice,
        })),
      })
      return
    }

    const subtotal = Number(raw?.subtotal || raw?.amount || raw?.totalAmount || raw?.total || lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0))
    const total = Number(raw?.total || raw?.amount || raw?.totalAmount || subtotal)

    printOrderInvoice({
      code: doc.code,
      date: String(raw?.created_at || raw?.createdAt || doc.date),
      customerName: String(raw?.customer_name || raw?.customerName || "Khách"),
      customerPhone: raw?.customer_phone || raw?.customerPhone,
      customerEmail: raw?.customer_email || raw?.customerEmail,
      address: raw?.shipping_address || raw?.shippingAddress,
      paymentMethod: raw?.payment_method || raw?.paymentMethod,
      note: raw?.note,
      items: lines.map((line) => ({
        name: line.name,
        sku: line.sku,
        qty: line.qty,
        price: line.unitPrice,
      })),
      subtotal,
      total,
    })
  }

  useEffect(() => {
    const loadDocs = async () => {
      const docMap = new Map<string, AuditDocument>()
      const pushDoc = (doc: AuditDocument) => {
        const code = String(doc.code || "").trim().toUpperCase()
        if (!code) return
        const key = `${doc.category}|${code}`
        if (!docMap.has(key)) {
          docMap.set(key, { ...doc, code })
        }
      }

      try {
        const salesRes: any = await salesOrderApi.getAll()
        const salesOrders = salesRes?.success && Array.isArray(salesRes.data) ? salesRes.data : []
        for (const order of salesOrders) {
          const code = formatHDReference(order?.sales_code || order?.id, order?.created_at)
          pushDoc({
            id: `sales-${String(order?.id || code)}`,
            code,
            category: "invoice",
            source: "sales-order",
            date: formatLocalDate(order?.created_at),
            subject: String(order?.customer_name || "Khách"),
            summary: String(order?.status || ""),
            raw: order,
          })
        }
      } catch {}

      try {
        const onlineRes: any = await orderApi.getAll()
        const onlineOrders = Array.isArray(onlineRes?.orders) ? onlineRes.orders : []
        for (const order of onlineOrders) {
          const code = formatHDReference(order?.orderCode || order?.order_code || order?.code || order?.id, order?.createdAt || order?.created_at)
          pushDoc({
            id: `online-${String(order?.id || code)}`,
            code,
            category: "invoice",
            source: "online-order",
            date: formatLocalDate(order?.createdAt || order?.created_at),
            subject: String(order?.customerName || order?.customer_name || "Khách"),
            summary: String(order?.status || ""),
            raw: order,
          })
        }
      } catch {}

      try {
        const txRes: any = await inventoryApi.getTransactions()
        const transactions = txRes?.success && Array.isArray(txRes.data) ? txRes.data : []
        for (const tx of transactions) {
          const rawType = String(tx?.type || "").replace(/_/g, "-")
          const category: AuditDocCategory = rawType === "import" || rawType === "transfer-in" ? "import" : "export"
          const prefix = category === "import" ? "PNK" : "PXK"
          pushDoc({
            id: `inventory-${String(tx?.id || "")}`,
            code: buildWarehouseDocCode(prefix, String(tx?.id || "")),
            category,
            source: "inventory-transaction",
            date: formatLocalDate(tx?.date),
            subject: String(tx?.warehouse_name || tx?.warehouse || "Kho"),
            summary: `${String(tx?.product_name || tx?.name || "Sản phẩm")} x${Number(tx?.qty || tx?.quantity || 0)}`,
            raw: tx,
          })
        }
      } catch {}

      try {
        const transferRes: any = await transferApi.getAll()
        const transfers = transferRes?.success && Array.isArray(transferRes.data) ? transferRes.data : []
        const sortedTransfers = [...transfers].sort((left, right) => {
          const leftDate = formatLocalDate(left?.created_at || left?.date)
          const rightDate = formatLocalDate(right?.created_at || right?.date)
          const byDate = leftDate.localeCompare(rightDate)
          if (byDate !== 0) return byDate
          return String(left?.id || "").localeCompare(String(right?.id || ""))
        })

        const transferCountByDay: Record<string, number> = {}
        for (const transfer of sortedTransfers) {
          const date = formatLocalDate(transfer?.created_at || transfer?.date)
          const dayToken = date.replace(/-/g, "")
          transferCountByDay[dayToken] = (transferCountByDay[dayToken] || 0) + 1
          const transferCode = String(transfer?.code || `DC-${dayToken}-${String(transferCountByDay[dayToken]).padStart(3, "0")}`)

          pushDoc({
            id: `transfer-${String(transfer?.id || transferCode)}`,
            code: transferCode,
            category: "transfer",
            source: "transfer-request",
            date,
            subject: `${String(transfer?.from_warehouse_name || transfer?.fromWarehouse || "Kho nguồn")} → ${String(transfer?.to_warehouse_name || transfer?.toWarehouse || "Kho đích")}`,
            summary: String(transfer?.reason || transfer?.note || ""),
            raw: transfer,
          })
        }
      } catch {}

      try {
        const poRes: any = await purchaseOrderApi.getAll()
        const purchaseOrders = poRes?.success && Array.isArray(poRes.data) ? poRes.data : []
        for (const po of purchaseOrders) {
          const code = formatPOReference(po?.po_code || po?.order_code || po?.id)
          pushDoc({
            id: `po-${String(po?.id || code)}`,
            code,
            category: "purchase",
            source: "purchase-order",
            date: formatLocalDate(po?.created_at || po?.createdDate),
            subject: String(po?.supplier_name || po?.supplier || "Nhà cung cấp"),
            summary: String(po?.status || ""),
            raw: po,
          })
        }
      } catch {}

      try {
        const rawSlips = JSON.parse(localStorage.getItem("exportSlips") || "[]")
        for (const slip of Array.isArray(rawSlips) ? rawSlips : []) {
          const code = String(slip?.id || "").trim()
          if (!code) continue
          pushDoc({
            id: `export-slip-${code}`,
            code,
            category: "export",
            source: "export-slip",
            date: String(slip?.date || ""),
            subject: String(slip?.customer || "Khách"),
            summary: `ĐH ${String(slip?.orderCode || slip?.orderId || "—")}`,
            raw: slip,
          })
        }
      } catch {}

      try {
        const rawAdminSlips = JSON.parse(localStorage.getItem(ADMIN_SLIPS_KEY) || "[]")
        for (const adminSlip of Array.isArray(rawAdminSlips) ? rawAdminSlips : []) {
          const rawType = String(adminSlip?.type || "")
          const category: AuditDocCategory = rawType === "import" ? "import" : "export"
          pushDoc({
            id: `admin-slip-${String(adminSlip?.id || "")}`,
            code: String(adminSlip?.id || ""),
            category,
            source: "admin-slip",
            date: String(adminSlip?.date || ""),
            subject: String(adminSlip?.warehouse || "Kho"),
            summary: String(adminSlip?.note || ""),
            raw: adminSlip,
          })
        }
      } catch {}

      const nextDocs = Array.from(docMap.values()).sort((left, right) => {
        const byDate = String(right.date || "").localeCompare(String(left.date || ""))
        if (byDate !== 0) return byDate
        return String(left.code).localeCompare(String(right.code))
      })

      setDocs(nextDocs)
    }

    loadDocs()

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "exportSlips" || event.key === ADMIN_SLIPS_KEY) {
        loadDocs()
      }
    }

    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const filteredDocs = useMemo(() => {
    const q = normalizeText(query.trim())
    return docs.filter((doc) => {
      if (categoryFilter !== "all" && doc.category !== categoryFilter) return false
      if (!q) return true
      const haystack = normalizeText(`${doc.code} ${doc.subject} ${doc.summary}`)
      return haystack.includes(q)
    })
  }, [docs, categoryFilter, query])

  const selectedLines = useMemo(() => {
    if (!selectedDoc) return [] as DocumentLine[]
    return getDocumentLines(selectedDoc)
  }, [selectedDoc])

  const selectedTotal = useMemo(() => {
    return selectedLines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
  }, [selectedLines])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-extrabold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm">Tìm mã phiếu chứng từ</Label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nhập mã: PXK / PNK / DC / HD / PO..."
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={(value: "all" | AuditDocCategory) => setCategoryFilter(value)}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả danh mục</SelectItem>
                <SelectItem value="invoice">Hóa đơn</SelectItem>
                <SelectItem value="export">Xuất kho</SelectItem>
                <SelectItem value="import">Nhập kho</SelectItem>
                <SelectItem value="transfer">Điều chuyển</SelectItem>
                <SelectItem value="purchase">PO</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="h-8 px-2.5">{filteredDocs.length} kết quả</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Kết quả rà soát</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredDocs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Không tìm thấy chứng từ phù hợp.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[200px]">Mã phiếu</TableHead>
                    <TableHead className="text-xs w-[120px]">Danh mục</TableHead>
                    <TableHead className="text-xs w-[130px]">Ngày</TableHead>
                    <TableHead className="text-xs">Đối tượng</TableHead>
                    <TableHead className="text-xs">Mô tả</TableHead>
                    <TableHead className="text-xs w-[110px] text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-mono text-xs text-primary font-semibold whitespace-nowrap">{doc.code}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${auditCategoryMeta[doc.category].cls}`}>
                          {auditCategoryMeta[doc.category].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{doc.date || "—"}</TableCell>
                      <TableCell className="text-sm">{doc.subject || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{doc.summary || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDetails(doc)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handlePrint(doc)}>
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-[620px] overflow-y-auto">
          {selectedDoc && (
            <>
              <SheetHeader>
                <SheetTitle className="font-serif">Chi tiết chứng từ {selectedDoc.code}</SheetTitle>
              </SheetHeader>

              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={`text-[11px] ${auditCategoryMeta[selectedDoc.category].cls}`}>
                    {auditCategoryMeta[selectedDoc.category].label}
                  </Badge>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => handlePrint(selectedDoc)}>
                    <Printer className="h-3.5 w-3.5" /> In phiếu
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Mã chứng từ</span>
                      <span className="font-mono text-xs text-primary">{selectedDoc.code}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Ngày</span>
                      <span>{selectedDoc.date || "—"}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Đối tượng</span>
                      <span className="text-right">{selectedDoc.subject || "—"}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Mô tả</span>
                      <span className="text-right">{selectedDoc.summary || "—"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="font-serif text-base">Dòng hàng</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {selectedLines.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">Chứng từ này không có danh sách dòng hàng chi tiết.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table className="min-w-[560px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs w-[130px]">SKU</TableHead>
                              <TableHead className="text-xs">Sản phẩm</TableHead>
                              <TableHead className="text-xs text-center w-[70px]">SL</TableHead>
                              <TableHead className="text-xs text-right w-[120px]">Đơn giá</TableHead>
                              <TableHead className="text-xs text-right w-[130px]">Thành tiền</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedLines.map((line, index) => (
                              <TableRow key={`${line.name}-${index}`}>
                                <TableCell className="font-mono text-[11px] text-primary">{line.sku || "—"}</TableCell>
                                <TableCell className="text-sm">{line.name}</TableCell>
                                <TableCell className="text-center text-sm">{line.qty}</TableCell>
                                <TableCell className="text-right text-sm">{line.unitPrice > 0 ? formatVND(line.unitPrice) : "—"}</TableCell>
                                <TableCell className="text-right text-sm font-medium">{line.unitPrice > 0 ? formatVND(line.qty * line.unitPrice) : "—"}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell colSpan={4} className="text-right text-sm font-semibold">Tổng cộng</TableCell>
                              <TableCell className="text-right text-sm font-bold text-primary">{selectedTotal > 0 ? formatVND(selectedTotal) : "—"}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
