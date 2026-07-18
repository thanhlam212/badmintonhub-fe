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
import {
  formatHDReference,
  formatPOReference,
  formatVND,
  formatTransferReference,
  formatPNKReference,
  formatPXKReference,
  formatSalesOrderReference,
} from "@/lib/utils"
import { Eye, Printer, Search } from "lucide-react"

export type AuditDocCategory = "invoice" | "export" | "import" | "transfer" | "purchase" | "other"
type AuditDocSource = "sales-order" | "online-order" | "inventory-transaction" | "transfer-request" | "purchase-order" | "export-slip" | "admin-slip"
type AuditDocKind =
  | "invoice-sale"
  | "invoice-online"
  | "export-sale"
  | "export-online"
  | "export-transfer"
  | "export-admin"
  | "export-other"
  | "import-transfer"
  | "import-po"
  | "import-admin"
  | "import-other"
  | "transfer-request"
  | "purchase-order"

interface AuditDocument {
  id: string
  code: string
  category: AuditDocCategory
  source: AuditDocSource
  kind: AuditDocKind
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

const auditKindLabel: Record<AuditDocKind, string> = {
  "invoice-sale": "Hóa đơn POS",
  "invoice-online": "Hóa đơn online",
  "export-sale": "Xuất bán POS",
  "export-online": "Xuất bán online",
  "export-transfer": "Xuất điều chuyển",
  "export-admin": "Xuất nội bộ",
  "export-other": "Xuất khác",
  "import-transfer": "Nhập điều chuyển",
  "import-po": "Nhập từ PO",
  "import-admin": "Nhập nội bộ",
  "import-other": "Nhập khác",
  "transfer-request": "Phiếu điều chuyển",
  "purchase-order": "PO",
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

function normalizeDateKey(value?: string | number | Date) {
  if (!value) return ""
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return ""
    const isoDate = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
    if (isoDate) return isoDate[1]
  }
  return formatLocalDate(value)
}

function buildWarehouseDocCode(prefix: "PNK" | "PXK", rawId?: string, createdAt?: string | number | Date) {
  return prefix === "PNK"
    ? formatPNKReference(rawId, createdAt ? new Date(createdAt) : null)
    : formatPXKReference(rawId, createdAt ? new Date(createdAt) : null)
}

function buildTransferWarehouseDocCode(prefix: "PNK" | "PXK", transferCode: string, createdAt?: string | number | Date) {
  return buildWarehouseDocCode(prefix, transferCode, createdAt)
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ""
}

function getWarehouseName(raw: any) {
  return firstText(
    raw?.warehouse_name,
    raw?.warehouseName,
    raw?.warehouse?.name,
    raw?.warehouse,
    raw?.fulfillingWarehouseName,
    raw?.fulfillingWarehouse,
    raw?.fulfilling_warehouse_name,
  )
}

function getFromWarehouseName(raw: any) {
  return firstText(raw?.from_warehouse_name, raw?.fromWarehouseName, raw?.fromWarehouse, raw?.from_warehouse, "Kho nguồn")
}

function getToWarehouseName(raw: any) {
  return firstText(raw?.to_warehouse_name, raw?.toWarehouseName, raw?.toWarehouse, raw?.to_warehouse, "Kho đích")
}

function getPOCode(raw: any) {
  const rawCode = firstText(raw?.po_code, raw?.poCode, raw?.order_code, raw?.orderCode, raw?.poId, raw?.po_id, raw?.poRawId, raw?.po_raw_id, raw?.id)
  return rawCode ? formatPOReference(rawCode, raw?.poCreatedAt || raw?.po_created_at || raw?.created_at || raw?.createdAt || raw?.createdDate || raw?.date) : ""
}

function getLinkedPOCode(raw: any) {
  const rawCode = firstText(raw?.po_code, raw?.poCode, raw?.order_code, raw?.orderCode, raw?.poId, raw?.po_id, raw?.poRawId, raw?.po_raw_id)
  return rawCode ? formatPOReference(rawCode, raw?.poCreatedAt || raw?.po_created_at || raw?.created_at || raw?.createdAt || raw?.createdDate || raw?.date) : ""
}

function getSalesCode(raw: any) {
  return formatSalesOrderReference(raw?.sales_code || raw?.orderCode || raw?.order_code || raw?.code || raw?.id, raw?.created_at || raw?.createdAt)
}

function getOnlineOrderCode(raw: any) {
  return formatHDReference(raw?.orderCode || raw?.order_code || raw?.invoiceCode || raw?.invoice_code || raw?.code || raw?.id, raw?.createdAt || raw?.created_at)
}

function describeOnlineFulfillment(raw: any) {
  const method = firstText(raw?.deliveryMethod, raw?.delivery_method)
  const methodText = method === "pickup" ? "khách nhận tại cửa hàng" : "giao hàng online"
  const warehouse = getWarehouseName(raw)
  return warehouse ? `${methodText} từ ${warehouse}` : methodText
}

function getTransferCreatorText(raw: any) {
  const role = firstText(raw?.createdByRole, raw?.created_by_role)
  const warehouse = firstText(raw?.createdByWarehouseName, raw?.created_by_warehouse_name)
  if (role === "admin") return "Admin tạo"
  if (role === "employee") {
    if (normalizeText(warehouse).includes("hub")) return "Hub tạo"
    return warehouse ? `${warehouse} tạo` : "Nhân viên kho tạo"
  }
  return ""
}

function describeTransfer(raw: any, transferCode: string, direction: "request" | "export" | "import") {
  const fromWarehouse = getFromWarehouseName(raw)
  const toWarehouse = getToWarehouseName(raw)
  const creator = getTransferCreatorText(raw)
  const suffix = creator ? ` - ${creator}` : ""
  if (direction === "export") return `Xuất điều chuyển ${transferCode}: từ ${fromWarehouse} đến ${toWarehouse}${suffix}`
  if (direction === "import") return `Nhập từ điều chuyển ${transferCode}: từ ${fromWarehouse} vào ${toWarehouse}${suffix}`
  return `Điều chuyển ${transferCode}: ${fromWarehouse} → ${toWarehouse}${suffix}`
}

function getInventoryDocKind(tx: any, category: AuditDocCategory): AuditDocKind {
  const rawType = String(tx?.type || "").replace(/_/g, "-")
  const text = normalizeText(`${rawType} ${tx?.source || ""} ${tx?.reason || ""} ${tx?.note || ""}`)
  if (rawType === "transfer-in") return "import-transfer"
  if (rawType === "transfer-out") return "export-transfer"
  if (category === "import" && (getLinkedPOCode(tx) || text.includes("po "))) return "import-po"
  if (category === "import") return "import-other"
  return text.includes("transfer") || text.includes("dieu chuyen") ? "export-transfer" : "export-other"
}

function describeInventoryTransaction(tx: any, category: AuditDocCategory, kind: AuditDocKind) {
  const product = firstText(tx?.product_name, tx?.productName, tx?.name, "Sản phẩm")
  const qty = Number(tx?.qty || tx?.quantity || 0)
  const warehouse = getWarehouseName(tx) || "Kho"
  const poCode = getLinkedPOCode(tx)
  const transferCode = tx?.transfer_code || tx?.transferCode || tx?.transferId || tx?.transfer_id
    ? formatTransferReference(tx?.transfer_code || tx?.transferCode || tx?.transferId || tx?.transfer_id, tx?.date || tx?.created_at)
    : ""

  if (kind === "import-po") return `Nhập kho từ PO ${poCode || "chưa rõ"} vào ${warehouse}: ${product} x${qty}`
  if (kind === "import-transfer") return `Nhập kho từ điều chuyển${transferCode ? ` ${transferCode}` : ""} vào ${warehouse}: ${product} x${qty}`
  if (kind === "export-transfer") return `Xuất kho điều chuyển${transferCode ? ` ${transferCode}` : ""} từ ${warehouse}: ${product} x${qty}`
  return `${category === "import" ? "Nhập kho" : "Xuất kho"} tại ${warehouse}: ${product} x${qty}`
}

function getWarehouseFromTransfer(raw: any, category: AuditDocCategory) {
  if (category === "export") return String(raw?.from_warehouse_name || raw?.fromWarehouse || raw?.fromWarehouseName || raw?.from_warehouse || "Kho")
  if (category === "import") return String(raw?.to_warehouse_name || raw?.toWarehouse || raw?.toWarehouseName || raw?.to_warehouse || "Kho")
  return String(raw?.warehouse_name || raw?.warehouse || "Kho")
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
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
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
        warehouse: doc.source === "transfer-request"
          ? getWarehouseFromTransfer(raw, doc.category)
          : String(raw?.warehouse_name || raw?.warehouse || doc.subject || "Kho"),
        supplier: raw?.supplier_name || raw?.supplier,
        poId: doc.kind === "import-po"
          ? getLinkedPOCode(raw) || getPOCode(raw) || doc.summary
          : raw?.po_code || raw?.order_code || raw?.poId || (doc.kind === "export-sale" || doc.kind === "export-online" ? doc.summary : undefined),
        note: String(doc.kind === "import-po" ? doc.summary : raw?.note || doc.summary || ""),
        createdBy: String(raw?.created_by_name || raw?.createdBy || raw?.operator || ""),
        assignedTo: String(raw?.assigned_to || raw?.assignedTo || raw?.customer_name || raw?.customerName || raw?.to_warehouse_name || raw?.toWarehouse || ""),
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
          const code = getSalesCode(order)
          pushDoc({
            id: `sales-${String(order?.id || code)}`,
            code,
	            category: "invoice",
	            source: "sales-order",
	            kind: "invoice-sale",
	            date: formatLocalDate(order?.created_at),
            subject: String(order?.customer_name || "Khách"),
            summary: `Hóa đơn bán tại shop/POS - trạng thái ${String(order?.status || "chưa rõ")}`,
	            raw: order,
	          })
	          if (order?.status === "approved" || order?.status === "exported") {
	            const exportCode = buildWarehouseDocCode("PXK", String(order?.id || code), order?.created_at)
	            pushDoc({
	              id: `sales-export-${String(order?.id || exportCode)}`,
	              code: exportCode,
	              category: "export",
	              source: "sales-order",
	              kind: "export-sale",
	              date: formatLocalDate(order?.approved_at || order?.created_at),
	              subject: String(order?.customer_name || "Khach"),
	              summary: `Xuất kho bán tại shop/POS - hóa đơn ${code}`,
	              raw: order,
	            })
	          }
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
	            kind: "invoice-online",
	            date: formatLocalDate(order?.createdAt || order?.created_at),
            subject: String(order?.customerName || order?.customer_name || "Khách"),
            summary: `Hóa đơn bán online - trạng thái ${String(order?.status || "chưa rõ")}`,
            raw: order,
          })
          const onlineStatus = String(order?.status || "").replace(/_/g, "-")
          if (["processing", "shipping", "delivered", "completed"].includes(onlineStatus)) {
            const exportCode = buildWarehouseDocCode("PXK", String(order?.id || code), order?.updatedAt || order?.updated_at || order?.createdAt || order?.created_at)
            pushDoc({
              id: `online-export-${String(order?.id || exportCode)}`,
              code: exportCode,
              category: "export",
              source: "online-order",
              kind: "export-online",
              date: formatLocalDate(order?.updatedAt || order?.updated_at || order?.createdAt || order?.created_at),
              subject: String(order?.customerName || order?.customer_name || "Khách"),
              summary: `Xuất kho bán online - ${describeOnlineFulfillment(order)} - hóa đơn ${code}`,
              raw: order,
            })
          }
        }
      } catch {}

      try {
        const txRes: any = await inventoryApi.getTransactions()
        const transactions = txRes?.success && Array.isArray(txRes.data) ? txRes.data : []
        for (const tx of transactions) {
          const rawType = String(tx?.type || "").replace(/_/g, "-")
          const category: AuditDocCategory = rawType === "import" || rawType === "transfer-in" ? "import" : "export"
          const prefix = category === "import" ? "PNK" : "PXK"
          const kind = getInventoryDocKind(tx, category)
          pushDoc({
            id: `inventory-${String(tx?.id || "")}`,
            code: buildWarehouseDocCode(prefix, String(tx?.id || ""), tx?.date || tx?.created_at),
	            category,
	            source: "inventory-transaction",
	            kind,
	            date: formatLocalDate(tx?.date),
            subject: String(tx?.warehouse_name || tx?.warehouse || "Kho"),
            summary: describeInventoryTransaction(tx, category, kind),
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

        for (const transfer of sortedTransfers) {
          const date = formatLocalDate(transfer?.created_at || transfer?.date)
          const transferCode = formatTransferReference(transfer?.code || transfer?.id, transfer?.created_at || transfer?.date)

          pushDoc({
            id: `transfer-${String(transfer?.id || transferCode)}`,
            code: transferCode,
	            category: "transfer",
	            source: "transfer-request",
	            kind: "transfer-request",
	            date,
            subject: `${getFromWarehouseName(transfer)} → ${getToWarehouseName(transfer)}`,
	            summary: `${describeTransfer(transfer, transferCode, "request")}${firstText(transfer?.reason, transfer?.note) ? ` - ${firstText(transfer?.reason, transfer?.note)}` : ""}`,
	            raw: transfer,
	          })
	          const transferStatus = String(transfer?.status || "").replace(/_/g, "-")
	          if (transferStatus === "in-transit" || transferStatus === "completed") {
	            pushDoc({
	              id: `transfer-export-${String(transfer?.id || transferCode)}`,
	              code: buildTransferWarehouseDocCode("PXK", transferCode, transfer?.created_at || transfer?.date),
	              category: "export",
	              source: "transfer-request",
	              kind: "export-transfer",
	              date,
	              subject: getFromWarehouseName(transfer),
	              summary: describeTransfer(transfer, transferCode, "export"),
	              raw: transfer,
	            })
	          }
	          if (transferStatus === "completed") {
	            pushDoc({
	              id: `transfer-import-${String(transfer?.id || transferCode)}`,
	              code: buildTransferWarehouseDocCode("PNK", transferCode, transfer?.completed_at || transfer?.completedAt || transfer?.created_at || transfer?.date),
	              category: "import",
	              source: "transfer-request",
	              kind: "import-transfer",
	              date: formatLocalDate(transfer?.completed_at || transfer?.completedAt || transfer?.created_at || transfer?.date),
	              subject: getToWarehouseName(transfer),
	              summary: describeTransfer(transfer, transferCode, "import"),
	              raw: transfer,
	            })
	          }
	        }
      } catch {}

      try {
        const poRes: any = await purchaseOrderApi.getAll()
        const purchaseOrders = poRes?.success && Array.isArray(poRes.data) ? poRes.data : []
        for (const po of purchaseOrders) {
          const code = formatPOReference(po?.po_code || po?.order_code || po?.id, po?.created_at || po?.createdDate)
          pushDoc({
            id: `po-${String(po?.id || code)}`,
            code,
	            category: "purchase",
	            source: "purchase-order",
	            kind: "purchase-order",
	            date: formatLocalDate(po?.created_at || po?.createdDate),
            subject: String(po?.supplier_name || po?.supplier || "Nhà cung cấp"),
            summary: `Đơn đặt hàng NCC ${code} - ${String(po?.status || "chưa rõ")}`,
	            raw: po,
	          })
	          if (String(po?.status || "") === "received") {
	            pushDoc({
	              id: `po-import-${String(po?.id || code)}`,
	              code: buildWarehouseDocCode("PNK", String(po?.id || code), po?.created_at || po?.createdDate),
	              category: "import",
	              source: "purchase-order",
	              kind: "import-po",
	              date: formatLocalDate(po?.received_at || po?.updated_at || po?.created_at || po?.createdDate),
	              subject: String(po?.warehouse_name || po?.warehouse || "Kho"),
	              summary: `Nhập kho từ PO ${code} - nhà cung cấp ${String(po?.supplier_name || po?.supplier || "chưa rõ")}`,
	              raw: po,
	            })
	          }
	        }
      } catch {}

      try {
        const rawSlips = JSON.parse(localStorage.getItem("exportSlips") || "[]")
        for (const slip of Array.isArray(rawSlips) ? rawSlips : []) {
          const code = buildWarehouseDocCode("PXK", String(slip?.id || ""), slip?.date)
          if (!code) continue
          pushDoc({
            id: `export-slip-${code}`,
            code,
	            category: "export",
	            source: "export-slip",
	            kind: "export-sale",
	            date: String(slip?.date || ""),
            subject: String(slip?.customer || "Khách"),
            summary: `Xuất kho bán tại shop/POS - hóa đơn ${formatHDReference(slip?.orderCode || slip?.orderId || slip?.id, slip?.date)}`,
            raw: slip,
          })
        }
      } catch {}

      try {
        const rawAdminSlips = JSON.parse(localStorage.getItem(ADMIN_SLIPS_KEY) || "[]")
        for (const adminSlip of Array.isArray(rawAdminSlips) ? rawAdminSlips : []) {
          const rawType = String(adminSlip?.type || "")
          const category: AuditDocCategory = rawType === "import" ? "import" : "export"
          const linkedPOCode = getLinkedPOCode(adminSlip)
          const code = buildWarehouseDocCode(category === "import" ? "PNK" : "PXK", String(adminSlip?.id || ""), adminSlip?.date)
          pushDoc({
            id: `admin-slip-${String(adminSlip?.id || "")}`,
            code,
	            category,
	            source: "admin-slip",
	            kind: category === "import" ? (linkedPOCode ? "import-po" : "import-admin") : "export-admin",
	            date: String(adminSlip?.date || ""),
            subject: String(adminSlip?.warehouse || "Kho"),
            summary: linkedPOCode
              ? `Nhập kho từ PO ${linkedPOCode} vào ${String(adminSlip?.warehouse || "Kho")}`
              : `${category === "import" ? "Nhập kho nội bộ" : "Xuất kho nội bộ"} tại ${String(adminSlip?.warehouse || "Kho")}${adminSlip?.note ? ` - ${String(adminSlip.note)}` : ""}`,
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
      const docDate = normalizeDateKey(doc.date)
      if (dateFrom && (!docDate || docDate < dateFrom)) return false
      if (dateTo && (!docDate || docDate > dateTo)) return false
      if (!q) return true
      const haystack = normalizeText(`${doc.code} ${doc.date} ${auditKindLabel[doc.kind]} ${doc.subject} ${doc.summary}`)
      return haystack.includes(q)
    })
  }, [docs, categoryFilter, dateFrom, dateTo, query])

  const hasActiveFilters = Boolean(query.trim() || categoryFilter !== "all" || dateFrom || dateTo)

  const clearFilters = () => {
    setQuery("")
    setCategoryFilter("all")
    setDateFrom("")
    setDateTo("")
  }

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
            <div className="flex items-center gap-2">
              <Label htmlFor="audit-date-from" className="text-xs text-muted-foreground whitespace-nowrap">Từ ngày</Label>
              <Input
                id="audit-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-9 w-[155px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="audit-date-to" className="text-xs text-muted-foreground whitespace-nowrap">Đến ngày</Label>
              <Input
                id="audit-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-9 w-[155px]"
              />
            </div>
            {hasActiveFilters && (
              <Button type="button" variant="outline" size="sm" className="h-9" onClick={clearFilters}>
                Xóa lọc
              </Button>
            )}
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
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[200px]">Mã phiếu</TableHead>
                    <TableHead className="text-xs w-[120px]">Danh mục</TableHead>
                    <TableHead className="text-xs w-[150px]">Nghiệp vụ</TableHead>
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
                      <TableCell className="text-xs font-medium whitespace-nowrap">{auditKindLabel[doc.kind]}</TableCell>
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
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[11px] ${auditCategoryMeta[selectedDoc.category].cls}`}>
                      {auditCategoryMeta[selectedDoc.category].label}
                    </Badge>
                    <Badge variant="secondary" className="text-[11px]">
                      {auditKindLabel[selectedDoc.kind]}
                    </Badge>
                  </div>
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
                      <span className="text-muted-foreground">Nghiệp vụ</span>
                      <span className="text-right">{auditKindLabel[selectedDoc.kind]}</span>
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
