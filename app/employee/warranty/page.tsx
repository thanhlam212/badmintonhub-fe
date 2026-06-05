"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatVND } from "@/lib/utils"
import { salesOrderApi } from "@/lib/api"
<<<<<<< HEAD
import { cn } from "@/lib/utils"
import { Search, ShieldCheck, ShieldAlert, Clock, Loader2, Package } from "lucide-react"
=======
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
>>>>>>> fd4e817d37048e1dde400e5402e68ff66a1caecd

interface WarrantyItem { name: string; qty: number; price: number; warrantyMonths: number }
interface WarrantyRecord {
  orderId: string; exportDate: string; customer: string; phone: string
  items: WarrantyItem[]; total: number
  caseStatus: "active" | "processing" | "resolved" | "expired"
  caseNote: string
}

function getWarrantyMonths(name: string): number {
  const n = name.toLowerCase()
  if (n.includes("vợt") || n.includes("racket"))      return 12
  if (n.includes("giày") || n.includes("shoe"))       return 6
  if (n.includes("túi") || n.includes("balo"))        return 3
  if (n.includes("dây") || n.includes("string"))      return 1
  if (n.includes("cầu") || n.includes("shuttlecock")) return 0
  return 0
}

function expiryDate(exportDate: string, months: number): string | null {
  if (!months || !exportDate) return null
  const d = new Date(exportDate)
  d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString("vi-VN")
}

function isExpired(exportDate: string, months: number): boolean {
  if (!months || !exportDate) return false
  const expiry = new Date(exportDate); expiry.setMonth(expiry.getMonth() + months)
  return expiry < new Date()
}

const statusCfg = {
  active:     { label: "Đang bảo hành",  color: "bg-green-100 text-green-800 border-green-200", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  processing: { label: "Đang xử lý",     color: "bg-blue-100 text-blue-800 border-blue-200",    icon: <Clock className="h-3.5 w-3.5" />       },
  resolved:   { label: "Đã xử lý",       color: "bg-gray-100 text-gray-700 border-gray-200",    icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  expired:    { label: "Hết hạn",        color: "bg-red-100 text-red-800 border-red-200",        icon: <ShieldAlert className="h-3.5 w-3.5" /> },
}

export default function WarrantyPage() {
  const [records, setRecords]           = useState<WarrantyRecord[]>([])
  const [caseMap, setCaseMap]           = useState<Record<string, { status: string; note: string }>>({})
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState("")
  const [searchPhone, setSearchPhone]   = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selected, setSelected]         = useState<WarrantyRecord | null>(null)
  const [editStatus, setEditStatus]     = useState("active")
  const [editNote, setEditNote]         = useState("")

  const loadData = async () => {
    setLoading(true)
    const stored  = localStorage.getItem("warrantyCases")
    const cases   = stored ? JSON.parse(stored) : {}
    setCaseMap(cases)
    try {
      const res  = await salesOrderApi.getAll({ status: "exported" } as any)
      const data = (res as any).success && (res as any).data ? (res as any).data : []
      const built: WarrantyRecord[] = data.map((o: any) => {
        const id    = String(o.id)
        const date  = o.created_at ? new Date(o.created_at).toISOString().split("T")[0] : ""
        const items: WarrantyItem[] = (o.items || []).map((i: any) => ({
          name: i.product_name || i.name || "", qty: i.qty || 0,
          price: Number(i.price) || 0,
          warrantyMonths: getWarrantyMonths(i.product_name || i.name || ""),
        }))
<<<<<<< HEAD
        if (!items.some(it => it.warrantyMonths > 0)) return null
        const ov  = cases[id]
        const allExp = items.filter(it => it.warrantyMonths > 0).every(it => isExpired(date, it.warrantyMonths))
        const caseStatus = ov?.status ?? (allExp ? "expired" : "active")
        return { orderId: id, exportDate: date, customer: o.customer_name || "Khách lẻ",
          phone: o.customer_phone || "", items, total: Number(o.final_total) || 0,
          caseStatus, caseNote: ov?.note ?? "" } as WarrantyRecord
      }).filter(Boolean)
      setRecords(built)
    } catch {}
    setLoading(false)
=======

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
>>>>>>> fd4e817d37048e1dde400e5402e68ff66a1caecd
  }
  useEffect(() => { loadData() }, [])

  const filtered = useMemo(() => records.filter(r => {
    if (statusFilter !== "all" && r.caseStatus !== statusFilter) return false
    if (search && !r.customer.toLowerCase().includes(search.toLowerCase()) && !r.orderId.includes(search)) return false
    if (searchPhone && !r.phone.includes(searchPhone)) return false
    return true
  }), [records, statusFilter, search, searchPhone])

  const stats = { total: records.length, active: records.filter(r=>r.caseStatus==="active").length,
    processing: records.filter(r=>r.caseStatus==="processing").length, expired: records.filter(r=>r.caseStatus==="expired").length }

  const saveCase = (id: string, status: string, note: string) => {
    const updated = { ...caseMap, [id]: { status, note } }
    setCaseMap(updated); localStorage.setItem("warrantyCases", JSON.stringify(updated))
    setRecords(prev => prev.map(r => r.orderId === id ? { ...r, caseStatus: status as any, caseNote: note } : r))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Quản lý bảo hành</h1>
          <p className="text-sm text-muted-foreground">Theo dõi bảo hành sản phẩm đã bán</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Làm mới"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        {[
          { label: "Tổng hồ sơ",    value: stats.total,      bg: "bg-muted/50 text-muted-foreground",   icon: <Package className="h-5 w-5" />     },
          { label: "Đang BH",        value: stats.active,     bg: "bg-green-100 text-green-600",         icon: <ShieldCheck className="h-5 w-5" /> },
          { label: "Đang xử lý",    value: stats.processing, bg: "bg-blue-100 text-blue-600",           icon: <Clock className="h-5 w-5" />       },
          { label: "Hết hạn",       value: stats.expired,    bg: "bg-red-100 text-red-600",             icon: <ShieldAlert className="h-5 w-5" /> },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <span className={cn("p-2 rounded-lg inline-flex", kpi.bg)}>{kpi.icon}</span>
              <p className="font-serif text-2xl font-extrabold mt-3">{kpi.value}</p>
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm khách hàng, mã đơn..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Input placeholder="Số điện thoại..." value={searchPhone} onChange={e=>setSearchPhone(e.target.value)} className="h-9 w-36" />
        <div className="flex gap-1 flex-wrap">
          {(["all","active","processing","resolved","expired"] as const).map(s => (
            <Button key={s} variant={statusFilter===s?"default":"outline"} size="sm" className="text-xs h-8" onClick={()=>setStatusFilter(s)}>
              {s==="all" ? "Tất cả" : statusCfg[s as keyof typeof statusCfg]?.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
              <p className="text-muted-foreground">Không có hồ sơ bảo hành</p>
              <p className="text-xs text-muted-foreground mt-1">Tự động tạo từ đơn hàng đã xuất kho có sản phẩm bảo hành</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Mã đơn</TableHead>
                  <TableHead className="text-xs">Ngày xuất</TableHead>
                  <TableHead className="text-xs">Khách hàng</TableHead>
                  <TableHead className="text-xs">SP bảo hành</TableHead>
                  <TableHead className="text-xs">Hết hạn</TableHead>
                  <TableHead className="text-xs">Tình trạng</TableHead>
                  <TableHead className="text-xs text-center">TT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const warranted = r.items.filter(it=>it.warrantyMonths>0)
                  const cfg = statusCfg[r.caseStatus]
                  return (
                    <TableRow key={r.orderId} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs text-blue-600 font-semibold">{r.orderId.slice(0,8).toUpperCase()}</TableCell>
                      <TableCell className="text-xs">{r.exportDate}</TableCell>
                      <TableCell><p className="text-sm font-medium">{r.customer}</p>{r.phone&&<p className="text-xs text-muted-foreground">{r.phone}</p>}</TableCell>
                      <TableCell>
                        {warranted.map((it,i)=>(
                          <div key={i} className="text-xs"><span className="font-medium">{it.name}</span><span className="text-muted-foreground ml-1">×{it.qty} • {it.warrantyMonths}T</span></div>
                        ))}
                      </TableCell>
                      <TableCell>
                        {warranted.map((it,i)=>(
                          <div key={i} className={cn("text-xs",isExpired(r.exportDate,it.warrantyMonths)?"text-red-600 font-medium":"text-muted-foreground")}>
                            {expiryDate(r.exportDate,it.warrantyMonths)??'—'}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1 text-xs",cfg.color)}>{cfg.icon}{cfg.label}</Badge>
                        {r.caseNote&&<p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[100px]">{r.caseNote}</p>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" className="text-xs h-7"
                          onClick={()=>{setSelected(r);setEditStatus(r.caseStatus);setEditNote(r.caseNote)}}>
                          Sửa
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

      {selected && (
        <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null)}}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif">Cập nhật bảo hành – {selected.orderId.slice(0,8).toUpperCase()}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Khách</p><p className="font-semibold">{selected.customer}</p></div>
                <div><p className="text-xs text-muted-foreground">SĐT</p><p className="font-semibold">{selected.phone||"—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Ngày xuất</p><p className="font-semibold">{selected.exportDate}</p></div>
                <div><p className="text-xs text-muted-foreground">Giá trị</p><p className="font-semibold text-primary">{formatVND(selected.total)}</p></div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">SẢN PHẨM BẢO HÀNH</p>
                {selected.items.filter(it=>it.warrantyMonths>0).map((it,i)=>(
                  <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span>{it.name} ×{it.qty}</span>
                    <span className={cn("text-xs",isExpired(selected.exportDate,it.warrantyMonths)?"text-red-600":"text-muted-foreground")}>
                      HH: {expiryDate(selected.exportDate,it.warrantyMonths)}
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Tình trạng</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Đang bảo hành</SelectItem>
                    <SelectItem value="processing">Đang xử lý</SelectItem>
                    <SelectItem value="resolved">Đã xử lý xong</SelectItem>
                    <SelectItem value="expired">Hết hạn bảo hành</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Ghi chú</label>
                <Textarea value={editNote} onChange={e=>setEditNote(e.target.value)} placeholder="Ghi chú tình trạng..." rows={2} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Đóng</Button></DialogClose>
              <DialogClose asChild>
                <Button onClick={()=>saveCase(selected.orderId,editStatus,editNote)}>Lưu</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
