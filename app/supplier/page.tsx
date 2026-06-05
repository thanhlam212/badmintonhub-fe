"use client"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { POStatusBadge } from "@/components/shared"
import { formatVND } from "@/lib/utils"
import { cn } from "@/lib/utils"
import {
  Bell, Package, Truck, FileText, ChevronDown, ChevronUp,
  Upload, Calendar, CheckCircle2, Clock, Eye, Send
} from "lucide-react"

const supplierPOs = [
  {
    id: "PO-20260220-0004", status: "pending", createdDate: "2026-02-20",
    totalValue: 56000000, items: [
      { name: "Vot Yonex Astrox 88D Pro", qty: 10, unitCost: 3200000 },
      { name: "Cuoc Yonex BG65", qty: 100, unitCost: 85000 },
      { name: "Quan can Yonex AC102EX", qty: 200, unitCost: 25000 },
    ],
    buyer: "BadmintonHub",
    deliveryDate: "2026-03-05",
    notes: "Ưu tiên giao hàng trước ngày 05/03. Liên hệ trước khi giao.",
  },
  {
    id: "PO-20260210-0002", status: "in-transit", createdDate: "2026-02-10",
    totalValue: 32000000, items: [
      { name: "Vot Victor Thruster K 9900", qty: 8, unitCost: 2700000 },
      { name: "Tui vot Lining ABJT059", qty: 10, unitCost: 620000 },
    ],
    buyer: "BadmintonHub",
    deliveryDate: "2026-02-28",
    notes: "",
    tracking: "VD-20260210-8843",
    carrier: "Giao hàng nhanh",
    batch: "BATCH-VCT-2026-02",
  },
  {
    id: "PO-20260201-0001", status: "delivered", createdDate: "2026-02-01",
    totalValue: 48000000, items: [
      { name: "Vot Yonex Astrox 88D Pro", qty: 15, unitCost: 3200000 },
    ],
    buyer: "BadmintonHub",
    deliveryDate: "2026-02-15",
    notes: "",
  },
]

function DeliveryUpdateDialog() {
  const [dragOver, setDragOver] = useState(false)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Truck className="h-4 w-4 mr-2" /> Cập nhật giao hàng
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Cập nhật thông tin giao hàng</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm">Số lô hàng</Label>
            <Input className="mt-1" placeholder="BATCH-XXX-2026-XX" />
          </div>
          <div>
            <Label className="text-sm">Ngày giao dự kiến</Label>
            <Input className="mt-1" type="date" />
          </div>
          <div>
            <Label className="text-sm">Đơn vị vận chuyển</Label>
            <Input className="mt-1" placeholder="VD: Giao hàng nhanh, Viettel Post..." />
          </div>
          <div>
            <Label className="text-sm">Mã vận đơn</Label>
            <Input className="mt-1" placeholder="VD-YYYYMMDD-XXXX" />
          </div>
          <div>
            <Label className="text-sm">Tài liệu đính kèm</Label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false) }}
              className={cn(
                "mt-1 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Kéo thả file vào đây hoặc</p>
              <button className="text-sm text-primary font-medium hover:underline">chọn file</button>
              <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG (tối đa 10MB)</p>
            </div>
          </div>
          <div>
            <Label className="text-sm">Ghi chú</Label>
            <Textarea className="mt-1" placeholder="Ghi chú thêm..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Huỷ</Button>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Gửi cập nhật</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MiniTimeline({ status }: { status: string }) {
  const steps = [
    { label: "Nhận PO", done: true },
    { label: "Chuẩn bị", done: status !== "pending" },
    { label: "Giao hàng", done: status === "in-transit" || status === "delivered" },
    { label: "Hoàn thành", done: status === "delivered" },
  ]

  return (
    <div className="flex items-center gap-1 py-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center">
          <div className={cn(
            "h-2.5 w-2.5 rounded-full shrink-0",
            s.done ? "bg-secondary" : "bg-muted"
          )} />
          {i < steps.length - 1 && (
            <div className={cn(
              "h-0.5 w-8 mx-0.5",
              s.done ? "bg-secondary" : "bg-muted"
            )} />
          )}
        </div>
      ))}
      <span className="text-[10px] text-muted-foreground ml-2">
        {steps.filter(s => s.done).length}/{steps.length}
      </span>
    </div>
  )
}

export default function SupplierPortal() {
  const [expandedPO, setExpandedPO] = useState<string | null>(null)

  const pendingPOs = supplierPOs.filter(p => p.status === "pending")
  const inProgressPOs = supplierPOs.filter(p => p.status === "in-transit")
  const completedPOs = supplierPOs.filter(p => p.status === "delivered")

  return (
    <div className="min-h-screen bg-background">
      {/* Navy Header */}
      <header className="bg-[#1E3A5F] text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="BadmintonHub" width={48} height={48} className="rounded-lg shrink-0" />
            <div>
              <h1 className="font-serif text-lg font-bold">BadmintonHub</h1>
              <p className="text-xs text-blue-200">Cổng Nhà Cung Cấp</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-white/10 transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold">
                2
              </span>
            </button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">YV</div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">Yonex Viet Nam</p>
                <p className="text-xs text-blue-200">Nguyen Thanh Son</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Alert Banner */}
        {pendingPOs.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 border-l-4 border-l-primary rounded-lg">
            <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Bạn có {pendingPOs.length} đơn hàng mới cần xử lý</p>
              <p className="text-xs text-muted-foreground mt-0.5">Vui lòng xác nhận hoặc từ chối các đơn hàng trong vòng 24 giờ.</p>
            </div>
          </div>
        )}

        {/* KPI Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="hover:-translate-y-0.5 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-amber-100 text-amber-600"><Clock className="h-5 w-5" /></span>
                <div>
                  <p className="font-serif text-2xl font-extrabold">{pendingPOs.length}</p>
                  <p className="text-sm text-muted-foreground">Chờ xử lý</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:-translate-y-0.5 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-blue-100 text-blue-600"><Truck className="h-5 w-5" /></span>
                <div>
                  <p className="font-serif text-2xl font-extrabold">{inProgressPOs.length}</p>
                  <p className="text-sm text-muted-foreground">Đang giao</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:-translate-y-0.5 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-green-100 text-green-600"><CheckCircle2 className="h-5 w-5" /></span>
                <div>
                  <p className="font-serif text-2xl font-extrabold">{completedPOs.length}</p>
                  <p className="text-sm text-muted-foreground">Hoàn thành</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending POs */}
        {pendingPOs.length > 0 && (
          <div>
            <h2 className="font-serif text-lg font-bold mb-3">Đơn hàng chờ xử lý</h2>
            <div className="space-y-3">
              {pendingPOs.map(po => (
                <Card key={po.id} className="border-l-4 border-l-primary hover:-translate-y-0.5 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm text-primary font-semibold">{po.id}</p>
                          <POStatusBadge status={po.status} />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Ngày tạo: {po.createdDate}</p>
                        <p className="text-sm mt-0.5">{po.items.length} sản phẩm - <span className="font-semibold text-primary">{formatVND(po.totalValue)}</span></p>
                        {po.notes && (
                          <p className="text-xs text-muted-foreground mt-2 italic bg-muted/50 p-2 rounded">{po.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" /> Chi tiết
                        </Button>
                        <Button size="sm" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Xác nhận
                        </Button>
                      </div>
                    </div>

                    {/* Items preview */}
                    <div className="mt-3 pt-3 border-t">
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
                          {po.items.map((item, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm">{item.name}</TableCell>
                              <TableCell className="text-center text-sm">{item.qty}</TableCell>
                              <TableCell className="text-right text-sm">{formatVND(item.unitCost)}</TableCell>
                              <TableCell className="text-right text-sm font-medium">{formatVND(item.qty * item.unitCost)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* In-Progress POs */}
        {inProgressPOs.length > 0 && (
          <div>
            <h2 className="font-serif text-lg font-bold mb-3">Đang giao hàng</h2>
            <div className="space-y-3">
              {inProgressPOs.map(po => (
                <Card key={po.id} className="border-l-4 border-l-blue-500 hover:-translate-y-0.5 transition-all">
                  <CardContent className="p-4">
                    <Collapsible open={expandedPO === po.id} onOpenChange={(open) => setExpandedPO(open ? po.id : null)}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-sm text-primary font-semibold">{po.id}</p>
                            <POStatusBadge status={po.status} />
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">Ngày giao dự kiến: {po.deliveryDate}</p>
                          <p className="text-sm mt-0.5">{po.items.length} sản phẩm - <span className="font-semibold text-primary">{formatVND(po.totalValue)}</span></p>
                          <MiniTimeline status={po.status} />
                        </div>
                        <div className="flex items-center gap-2">
                          <DeliveryUpdateDialog />
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              {expandedPO === po.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>

                      <CollapsibleContent>
                        <div className="mt-3 pt-3 border-t space-y-3">
                          {/* Tracking Info */}
                          {'tracking' in po && (
                            <div className="grid grid-cols-2 gap-3 bg-muted/50 p-3 rounded-lg">
                              <div>
                                <p className="text-xs text-muted-foreground">Số lô hàng</p>
                                <p className="text-sm font-medium">{po.batch}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Mã vận đơn</p>
                                <p className="text-sm font-medium font-mono">{po.tracking}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Đơn vị vận chuyển</p>
                                <p className="text-sm font-medium">{po.carrier}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Ngày giao dự kiến</p>
                                <p className="text-sm font-medium">{po.deliveryDate}</p>
                              </div>
                            </div>
                          )}

                          {/* Items Table */}
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
                              {po.items.map((item, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-sm">{item.name}</TableCell>
                                  <TableCell className="text-center text-sm">{item.qty}</TableCell>
                                  <TableCell className="text-right text-sm">{formatVND(item.unitCost)}</TableCell>
                                  <TableCell className="text-right text-sm font-medium">{formatVND(item.qty * item.unitCost)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Completed POs */}
        {completedPOs.length > 0 && (
          <div>
            <h2 className="font-serif text-lg font-bold mb-3">Đã hoàn thành</h2>
            <div className="space-y-3">
              {completedPOs.map(po => (
                <Card key={po.id} className="border-l-4 border-l-green-500 opacity-80">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm text-muted-foreground">{po.id}</p>
                          <POStatusBadge status={po.status} />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{po.items.length} sản phẩm - {formatVND(po.totalValue)}</p>
                        <p className="text-xs text-muted-foreground">Đã giao: {po.deliveryDate}</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-1" /> Xem
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
