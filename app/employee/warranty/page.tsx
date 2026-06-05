"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { salesOrderApi } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { cn, formatSalesOrderReference } from "@/lib/utils"
import { Search, ShieldCheck, Clock, CheckCircle2, XCircle, Wrench } from "lucide-react"

type WarrantyCaseStatus = "new" | "processing" | "resolved" | "rejected" | "expired"

interface WarrantyLine {
  id: string
  sku?: string
  name: string
  qty: number
  months: number
  expiresAt: string
}

interface WarrantyRecord {
  id: string
  customer: string
  phone: string
  issuedAt: string
  expiresAt: string
  orderCode: string
  slipId: string
  status: WarrantyCaseStatus
  note: string
  updatedAt?: string
  updatedBy?: string
  items: WarrantyLine[]
}

const WARRANTY_CASES_KEY = "warrantyCases"

const statusConfig: Record<WarrantyCaseStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  new: { label: "Mới", cls: "bg-blue-100 text-blue-800 border-blue-200", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  processing: { label: "Đang xử lý", cls: "bg-amber-100 text-amber-800 border-amber-200", icon: <Wrench className="h-3.5 w-3.5" /> },
  resolved: { label: "Hoàn tất", cls: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: "Từ chối", cls: "bg-red-100 text-red-800 border-red-200", icon: <XCircle className="h-3.5 w-3.5" /> },
  expired: { label: "Hết hạn", cls: "bg-slate-200 text-slate-700 border-slate-300", icon: <Clock className="h-3.5 w-3.5" /> },
}

function normalizePhone(value: string) {
  return String(value || "").replace(/\D/g, "")
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

function parseWarrantyIdFromNote(note?: string) {
  const source = String(note || "")
  const match = source.match(/(?:PBH\s*)?(BH-[A-Z0-9-]+)/i)
  return match?.[1] || ""
}

function getWarrantyMonths(category?: string, name?: string) {
  const source = normalizeText(`${category || ""} ${name || ""}`)
  if (source.includes("vot") || source.includes("racket")) return 3
  if (source.includes("giay") || source.includes("shoe") || source.includes("sneaker")) return 1
  return 0
}

function addMonths(date: Date, months: number) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function sanitizeDigits(value?: string) {
  return String(value || "").replace(/\D/g, "")
}

function buildWarrantyLineId(baseId: string, index: number) {
  return `${baseId}-${String(index + 1).padStart(3, "0")}`
}

function expandWarrantyItemsFromProducts(
  items: Array<{ sku?: string; name: string; category?: string; qty: number }>,
  issuedAt: Date,
  baseWarrantyId: string,
) {
  const lines: WarrantyLine[] = []
  let sequence = 0

  for (const item of items) {
    const months = getWarrantyMonths(item.category, item.name)
    if (months <= 0) continue

    const quantity = Math.max(0, Number(item.qty || 0))
    for (let unit = 0; unit < quantity; unit += 1) {
      lines.push({
        id: buildWarrantyLineId(baseWarrantyId, sequence),
        sku: item.sku || undefined,
        name: item.name,
        qty: 1,
        months,
        expiresAt: formatLocalDate(addMonths(issuedAt, months)),
      })
      sequence += 1
    }
  }

  return lines
}

export default function EmployeeWarrantyPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState<WarrantyRecord[]>([])
  const [searchText, setSearchText] = useState("")
  const [searchPhone, setSearchPhone] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | WarrantyCaseStatus>("all")
  const [selectedRecord, setSelectedRecord] = useState<WarrantyRecord | null>(null)
  const [editStatus, setEditStatus] = useState<WarrantyCaseStatus>("new")
  const [editNote, setEditNote] = useState("")

  useEffect(() => {
    const loadRecords = async () => {
      const today = formatLocalDate()
      let orders: any[] = []
      try {
        const res: any = await salesOrderApi.getAll()
        if (res?.success && Array.isArray(res.data)) {
          orders = res.data
        }
      } catch {}

      const orderMap = new Map<string, any>()
      for (const order of orders) {
        const orderId = String(order?.id || "")
        if (orderId) orderMap.set(orderId, order)
        const orderCode = String(order?.sales_code || "")
        if (orderCode) orderMap.set(orderCode, order)
      }

      const stateMapRaw = localStorage.getItem(WARRANTY_CASES_KEY)
      const stateMap: Record<string, { status: WarrantyCaseStatus; note: string; updatedAt?: string; updatedBy?: string }> = stateMapRaw
        ? JSON.parse(stateMapRaw)
        : {}

      const rawSlips = JSON.parse(localStorage.getItem("exportSlips") || "[]")
      const nextRecords: WarrantyRecord[] = []
      const usedWarrantyByCustomer = new Map<string, string>()

      for (const [slipIndex, slip] of (Array.isArray(rawSlips) ? rawSlips : []).entries()) {
        const order = orderMap.get(String(slip?.orderId || "")) || orderMap.get(String(slip?.orderCode || ""))
        const warrantyIdFromNote = parseWarrantyIdFromNote(slip?.note)
        const warrantyIdFromRaw = String(slip?.warranty?.id || slip?.warrantyId || slip?.warranty_code || "")
        const resolvedWarrantyId = warrantyIdFromRaw || warrantyIdFromNote
        const generatedBaseId = `BH-${String(slip?.id || `MIG-${slipIndex + 1}`).slice(4)}`
        let warrantyId = String(resolvedWarrantyId || generatedBaseId)

        const rawWarrantyItems: WarrantyLine[] = Array.isArray(slip?.warranty?.items)
          ? slip.warranty.items.reduce((acc: WarrantyLine[], line: any, lineIndex: number) => {
              const qty = Math.max(0, Number(line?.qty || 0))
              if (qty <= 0) return acc
              const lineBaseId = String(line?.id || buildWarrantyLineId(warrantyId, lineIndex))
              for (let unit = 0; unit < qty; unit += 1) {
                acc.push({
                  id: qty === 1 ? lineBaseId : `${lineBaseId}-${unit + 1}`,
                  sku: line?.sku || undefined,
                  name: line?.name || "Sản phẩm",
                  qty: 1,
                  months: Number(line?.months || 0),
                  expiresAt: line?.expiresAt || slip?.date || today,
                })
              }
              return acc
            }, [])
          : []

        const fallbackItems: WarrantyLine[] = Array.isArray(order?.items)
          ? expandWarrantyItemsFromProducts(
              order.items.map((item: any) => ({
                sku: item?.sku || undefined,
                name: item?.product_name || item?.name || "Sản phẩm",
                category: item?.category,
                qty: Number(item?.qty || item?.quantity || 0),
              })),
              new Date(String(slip?.date || today)),
              warrantyId,
            )
          : []

        const warrantyItems = rawWarrantyItems.length > 0 ? rawWarrantyItems : fallbackItems
        if (!warrantyId && warrantyItems.length > 0) {
          warrantyId = `BH-${String(slip?.id || "").slice(4)}`
        }

        if (!warrantyId) continue

        const issuedAt = String(slip?.warranty?.issuedAt || slip?.date || today)
        const phone = String(slip?.warranty?.phone || order?.customer_phone || "")
        const customer = String(slip?.warranty?.customer || slip?.customer || order?.customer_name || "Khách")

        const customerKey = `${normalizeText(customer)}|${normalizePhone(phone)}`
        const owner = usedWarrantyByCustomer.get(warrantyId)
        if (!owner) {
          usedWarrantyByCustomer.set(warrantyId, customerKey)
        } else if (owner !== customerKey) {
          const suffixSeed = sanitizeDigits(phone || customer) || String(slipIndex + 1)
          const suffix = suffixSeed.slice(-4).padStart(4, "0")
          const nextWarrantyId = `${warrantyId}-${suffix}`
          warrantyId = nextWarrantyId
          usedWarrantyByCustomer.set(nextWarrantyId, customerKey)
        }

        const normalizedWarrantyItems = warrantyItems.map((item, index) => ({
          ...item,
          id: item.id || buildWarrantyLineId(warrantyId, index),
        }))

        const expiresAt = normalizedWarrantyItems.length > 0
          ? [...normalizedWarrantyItems].sort((a, b) => String(b.expiresAt).localeCompare(String(a.expiresAt)))[0].expiresAt
          : issuedAt

        const savedState = stateMap[warrantyId]
        const baseStatus: WarrantyCaseStatus = expiresAt < today ? "expired" : "new"

        nextRecords.push({
          id: warrantyId,
          customer,
          phone,
          issuedAt,
          expiresAt,
          orderCode: formatSalesOrderReference(slip?.orderCode || order?.sales_code || order?.orderCode || order?.order_code || order?.invoiceCode || order?.invoice_code || order?.code || order?.id || slip?.orderId || "", order?.created_at || order?.createdAt || slip?.date || today),
          slipId: String(slip?.id || ""),
          status: savedState?.status || baseStatus,
          note: savedState?.note || "",
          updatedAt: savedState?.updatedAt,
          updatedBy: savedState?.updatedBy,
          items: normalizedWarrantyItems,
        })
      }

      nextRecords.sort((a, b) => {
        const byDate = String(b.issuedAt).localeCompare(String(a.issuedAt))
        if (byDate !== 0) return byDate
        return String(a.id).localeCompare(String(b.id))
      })

      setRecords(nextRecords)
    }

    loadRecords()

    const intervalId = window.setInterval(() => {
      loadRecords()
    }, 10000)

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "exportSlips" || event.key === WARRANTY_CASES_KEY) {
        loadRecords()
      }
    }

    const onFocus = () => loadRecords()

    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", onFocus)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onFocus)
    }
  }, [])

  const filteredRecords = useMemo(() => {
    const normalizedPhone = normalizePhone(searchPhone)
    const q = searchText.trim().toLowerCase()

    return records.filter((record) => {
      if (statusFilter !== "all" && record.status !== statusFilter) return false
      if (normalizedPhone && !normalizePhone(record.phone).includes(normalizedPhone)) return false
      if (q) {
        const haystack = `${record.id} ${record.customer} ${record.orderCode} ${record.slipId}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [records, searchPhone, searchText, statusFilter])

  const stats = useMemo(() => {
    return {
      total: records.length,
      processing: records.filter(r => r.status === "processing").length,
      resolved: records.filter(r => r.status === "resolved").length,
      expired: records.filter(r => r.status === "expired").length,
    }
  }, [records])

  const openManageDialog = (record: WarrantyRecord) => {
    setSelectedRecord(record)
    setEditStatus(record.status)
    setEditNote(record.note)
  }

  const saveCase = () => {
    if (!selectedRecord) return

    const updatedAt = new Date().toISOString()
    const updatedBy = user?.fullName || "Nhân viên"

    const nextRecords = records.map((record) =>
      record.id === selectedRecord.id
        ? { ...record, status: editStatus, note: editNote.trim(), updatedAt, updatedBy }
        : record
    )
    setRecords(nextRecords)

    const map: Record<string, { status: WarrantyCaseStatus; note: string; updatedAt?: string; updatedBy?: string }> = {}
    for (const record of nextRecords) {
      map[record.id] = {
        status: record.status,
        note: record.note,
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy,
      }
    }
    localStorage.setItem(WARRANTY_CASES_KEY, JSON.stringify(map))
    setSelectedRecord(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-extrabold">Quản lý bảo hành</h1>
        <p className="text-sm text-muted-foreground">Tìm phiếu bảo hành theo số điện thoại khách và xử lý trạng thái bảo hành.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tổng phiếu</p><p className="text-xl font-bold mt-1">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Đang xử lý</p><p className="text-xl font-bold mt-1 text-amber-700">{stats.processing}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Hoàn tất</p><p className="text-xl font-bold mt-1 text-green-700">{stats.resolved}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Hết hạn</p><p className="text-xl font-bold mt-1 text-slate-600">{stats.expired}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Tìm theo mã BH, khách hàng, đơn hàng, mã phiếu"
                className="pl-9"
              />
            </div>
            <Input
              value={searchPhone}
              onChange={(event) => setSearchPhone(event.target.value)}
              placeholder="Tìm theo số điện thoại"
              className="w-[220px]"
            />
            <Select value={statusFilter} onValueChange={(value: "all" | WarrantyCaseStatus) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="new">Mới</SelectItem>
                <SelectItem value="processing">Đang xử lý</SelectItem>
                <SelectItem value="resolved">Hoàn tất</SelectItem>
                <SelectItem value="rejected">Từ chối</SelectItem>
                <SelectItem value="expired">Hết hạn</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Danh sách phiếu bảo hành</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Không tìm thấy phiếu bảo hành phù hợp.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Mã BH</TableHead>
                  <TableHead className="text-xs">Khách hàng</TableHead>
                  <TableHead className="text-xs">SĐT</TableHead>
                  <TableHead className="text-xs">Đơn hàng</TableHead>
                  <TableHead className="text-xs">Ngày cấp</TableHead>
                  <TableHead className="text-xs">HSD gần nhất</TableHead>
                  <TableHead className="text-xs text-center">Số dòng</TableHead>
                  <TableHead className="text-xs">Trạng thái</TableHead>
                  <TableHead className="text-xs text-center">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => {
                  const cfg = statusConfig[record.status]
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-xs text-blue-700 font-semibold">{record.id}</TableCell>
                      <TableCell className="text-sm">{record.customer}</TableCell>
                      <TableCell className="text-sm">{record.phone || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-purple-700">{record.orderCode || "—"}</TableCell>
                      <TableCell className="text-sm">{record.issuedAt}</TableCell>
                      <TableCell className="text-sm">{record.expiresAt}</TableCell>
                      <TableCell className="text-center text-sm">{record.items.length}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1", cfg.cls)}>{cfg.icon} {cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openManageDialog(record)}>
                          Quản lý
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedRecord && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif">Xử lý phiếu bảo hành {selectedRecord.id}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-sm">
                  <div><span className="text-muted-foreground">Khách hàng:</span> <strong>{selectedRecord.customer}</strong></div>
                  <div><span className="text-muted-foreground">SĐT:</span> <strong>{selectedRecord.phone || "—"}</strong></div>
                  <div><span className="text-muted-foreground">Đơn hàng:</span> <strong className="font-mono text-xs">{selectedRecord.orderCode || "—"}</strong></div>
                  <div><span className="text-muted-foreground">Phiếu XK:</span> <strong className="font-mono text-xs">{selectedRecord.slipId || "—"}</strong></div>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                  <Table className="min-w-[680px] table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-[190px]">Mã BH SP</TableHead>
                        <TableHead className="text-xs">Sản phẩm</TableHead>
                        <TableHead className="text-xs text-center w-[60px]">SL</TableHead>
                        <TableHead className="text-xs text-center w-[100px]">BH (tháng)</TableHead>
                        <TableHead className="text-xs w-[120px] whitespace-nowrap">HSD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRecord.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Phiếu này chưa có dòng bảo hành chi tiết.</TableCell>
                        </TableRow>
                      ) : (
                        selectedRecord.items.map((item, index) => (
                          <TableRow key={`${item.name}-${index}`}>
                            <TableCell className="font-mono text-[11px] text-blue-700 whitespace-nowrap">{item.id}</TableCell>
                            <TableCell className="text-sm break-words">{item.name}</TableCell>
                            <TableCell className="text-center text-sm">{item.qty}</TableCell>
                            <TableCell className="text-center text-sm">{item.months}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">{item.expiresAt}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2">
                  <Label>Trạng thái xử lý</Label>
                  <Select value={editStatus} onValueChange={(value: WarrantyCaseStatus) => setEditStatus(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Mới</SelectItem>
                      <SelectItem value="processing">Đang xử lý</SelectItem>
                      <SelectItem value="resolved">Hoàn tất</SelectItem>
                      <SelectItem value="rejected">Từ chối</SelectItem>
                      <SelectItem value="expired">Hết hạn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ghi chú xử lý</Label>
                  <Textarea
                    rows={3}
                    value={editNote}
                    onChange={(event) => setEditNote(event.target.value)}
                    placeholder="Nhập mô tả xử lý bảo hành..."
                  />
                </div>

                {selectedRecord.updatedAt && (
                  <p className="text-xs text-muted-foreground">
                    Cập nhật gần nhất: {new Date(selectedRecord.updatedAt).toLocaleString("vi-VN")}
                    {selectedRecord.updatedBy ? ` • ${selectedRecord.updatedBy}` : ""}
                  </p>
                )}
              </div>

              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setSelectedRecord(null)}>Đóng</Button>
                <Button onClick={saveCase}>Lưu xử lý</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
