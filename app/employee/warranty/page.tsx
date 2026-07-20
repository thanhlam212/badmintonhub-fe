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
import { orderApi, salesOrderApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Search, ShieldCheck, ShieldAlert, Clock, Loader2, Package } from "lucide-react"

interface WarrantyItem { name: string; qty: number; price: number; warrantyMonths: number }
interface WarrantyRecord {
  orderId: string; warrantyCode: string; invoiceCode: string; exportDate: string; customer: string; phone: string
  source?: "offline" | "online"
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
      const [salesRes, onlineRes] = await Promise.all([
        salesOrderApi.getAll({ status: "exported" } as any),
        orderApi.getAll({ status: "delivered" }),
      ])
      const data = (salesRes as any).success && (salesRes as any).data ? (salesRes as any).data : []
      const built: WarrantyRecord[] = data.map((o: any) => {
        const id    = String(o.id)
        const date  = o.created_at ? new Date(o.created_at).toISOString().split("T")[0] : ""
        const items: WarrantyItem[] = (o.items || []).map((i: any) => ({
          name: i.product_name || i.name || "", qty: i.qty || 0,
          price: Number(i.price) || 0,
          warrantyMonths: getWarrantyMonths(i.product_name || i.name || ""),
        }))
        if (!items.some(it => it.warrantyMonths > 0)) return null
        const invoiceCode = String(o.invoice_code || o.invoiceCode || o.order_code || o.orderCode || o.sales_code || id)
        const warrantyCode = String(o.warranty_code || o.warrantyCode || `BH-${invoiceCode}`)
        const ov  = cases[warrantyCode] || cases[id]
        const allExp = items.filter(it => it.warrantyMonths > 0).every(it => isExpired(date, it.warrantyMonths))
        const caseStatus = ov?.status ?? (allExp ? "expired" : "active")
        return { orderId: id, warrantyCode, invoiceCode, exportDate: date, customer: o.customer_name || "Khách lẻ",
          phone: o.customer_phone || "", items, total: Number(o.final_total) || 0,
          caseStatus, caseNote: ov?.note ?? "", source: "offline" } as WarrantyRecord
      }).filter(Boolean)
      const onlineBuilt: WarrantyRecord[] = ((onlineRes as any).orders || []).map((o: any) => {
        const id = String(o.rawId || o.id)
        const date = o.createdAt ? new Date(o.createdAt).toISOString().split("T")[0] : ""
        const invoiceCode = String(o.invoiceCode || o.orderCode || o.id)
        const warrantyCode = String(o.warrantyCode || `BH-${invoiceCode}`)
        const items: WarrantyItem[] = (o.items || []).map((i: any) => ({
          name: i.productName || i.product_name || i.name || "",
          qty: i.quantity || i.qty || 0,
          price: Number(i.price) || 0,
          warrantyMonths: getWarrantyMonths(i.productName || i.product_name || i.name || ""),
        }))
        if (!items.some(it => it.warrantyMonths > 0)) return null
        const ov = cases[warrantyCode] || cases[id]
        const allExp = items.filter(it => it.warrantyMonths > 0).every(it => isExpired(date, it.warrantyMonths))
        const caseStatus = ov?.status ?? (allExp ? "expired" : "active")
        return {
          orderId: id,
          warrantyCode,
          invoiceCode,
          exportDate: date,
          customer: o.customerName || o.customer?.name || "Khách lẻ",
          phone: o.customerPhone || o.customer?.phone || "",
          items,
          total: Number(o.totalAmount || o.amount || o.total) || 0,
          caseStatus,
          caseNote: ov?.note ?? "",
          source: "online",
        } as WarrantyRecord
      }).filter(Boolean)
      setRecords([...built, ...onlineBuilt].sort((a, b) => b.exportDate.localeCompare(a.exportDate)))
    } catch {}
    setLoading(false)
  }
  useEffect(() => { loadData() }, [])

  const filtered = useMemo(() => records.filter(r => {
    if (statusFilter !== "all" && r.caseStatus !== statusFilter) return false
    if (
      search &&
      !r.customer.toLowerCase().includes(search.toLowerCase()) &&
      !r.orderId.includes(search) &&
      !r.warrantyCode.toLowerCase().includes(search.toLowerCase()) &&
      !r.invoiceCode.toLowerCase().includes(search.toLowerCase())
    ) return false
    if (searchPhone && !r.phone.includes(searchPhone)) return false
    return true
  }), [records, statusFilter, search, searchPhone])

  const stats = { total: records.length, active: records.filter(r=>r.caseStatus==="active").length,
    processing: records.filter(r=>r.caseStatus==="processing").length, expired: records.filter(r=>r.caseStatus==="expired").length }

  const saveCase = (id: string, status: string, note: string) => {
    const record = records.find(r => r.orderId === id || r.warrantyCode === id)
    const key = record?.warrantyCode || id
    const updated = { ...caseMap, [key]: { status, note } }
    setCaseMap(updated); localStorage.setItem("warrantyCases", JSON.stringify(updated))
    setRecords(prev => prev.map(r => r.orderId === id || r.warrantyCode === id ? { ...r, caseStatus: status as any, caseNote: note } : r))
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
                      <TableCell className="font-mono text-xs">
                        <p className="font-semibold text-blue-600">{r.warrantyCode}</p>
                        <p className="text-[10px] text-muted-foreground">{r.invoiceCode}</p>
                        {r.source === "online" && (
                          <Badge variant="outline" className="mt-1 text-[10px] font-sans">Online</Badge>
                        )}
                      </TableCell>
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
              <DialogTitle className="font-serif">Cập nhật bảo hành – {selected.warrantyCode}</DialogTitle>
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
