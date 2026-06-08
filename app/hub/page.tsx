"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Warehouse, Package, AlertTriangle, XOctagon, TrendingDown,
  ArrowRight, Scale
} from "lucide-react"
import { formatVND } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useInventory } from "@/lib/inventory-context"

const BRANCH_WAREHOUSES = ["Kho Cầu Giấy", "Kho Thanh Xuân", "Kho Long Biên"]

export default function HubDashboard() {
  const { user } = useAuth()
  const { inventory, transferRequests } = useInventory()

  const hubItems = useMemo(() => inventory.filter(i => i.warehouse === "Kho Hub"), [inventory])
  const branchItems = useMemo(() => inventory.filter(i => BRANCH_WAREHOUSES.includes(i.warehouse)), [inventory])

  const hubTotalValue = useMemo(() => hubItems.reduce((sum, i) => sum + i.onHand * i.unitCost, 0), [hubItems])
  const hubTotalSKU = hubItems.length
  const hubTotalQty = useMemo(() => hubItems.reduce((sum, i) => sum + i.onHand, 0), [hubItems])

  // Count branch items that are low stock or out of stock
  const branchLowStock = useMemo(() => branchItems.filter(i => i.available > 0 && i.available <= i.reorderPoint), [branchItems])
  const branchOutOfStock = useMemo(() => branchItems.filter(i => i.available === 0), [branchItems])

  // Pending transfers from Hub
  const pendingTransfers = transferRequests.filter(t =>
    t.fromWarehouse === "Kho Hub" && (t.status === "pending" || t.status === "in-transit")
  )

  // Per-warehouse summary
  const warehouseSummary = useMemo(() => {
    return BRANCH_WAREHOUSES.map(wh => {
      const items = inventory.filter(i => i.warehouse === wh)
      const totalQty = items.reduce((s, i) => s + i.onHand, 0)
      const totalValue = items.reduce((s, i) => s + i.onHand * i.unitCost, 0)
      const lowCount = items.filter(i => i.available > 0 && i.available <= i.reorderPoint).length
      const outCount = items.filter(i => i.available === 0).length
      return { warehouse: wh, totalSKU: items.length, totalQty, totalValue, lowCount, outCount }
    })
  }, [inventory])

  const stats = [
    { title: "Tổng SKU Hub", value: hubTotalSKU.toString(), icon: <Package className="h-5 w-5" />, color: "bg-purple-100 text-purple-600" },
    { title: "Tổng số lượng Hub", value: hubTotalQty.toLocaleString("vi-VN"), icon: <Warehouse className="h-5 w-5" />, color: "bg-blue-100 text-blue-600" },
    { title: "Chi nhánh sắp hết", value: branchLowStock.length.toString(), icon: <AlertTriangle className="h-5 w-5" />, color: "bg-amber-100 text-amber-600", alert: branchLowStock.length > 0 },
    { title: "Chi nhánh hết hàng", value: branchOutOfStock.length.toString(), icon: <XOctagon className="h-5 w-5" />, color: "bg-red-100 text-red-600", alert: branchOutOfStock.length > 0 },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold text-foreground">
            Kho Hub — Trung tâm phân phối
          </h1>
          <p className="text-sm text-muted-foreground">
            Xin chào, {user?.fullName}! Tổng giá trị kho Hub: {formatVND(hubTotalValue)}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((stat, i) => (
          <Card key={i} className={cn("hover:-translate-y-0.5 transition-all", stat.alert && "border-red-200")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className={cn("p-2 rounded-lg", stat.color)}>{stat.icon}</span>
              </div>
              <p className="font-serif text-2xl font-extrabold mt-3">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Per-warehouse summary */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-purple-600" /> Tổng quan các kho chi nhánh
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Kho</TableHead>
                  <TableHead className="text-xs text-center">SKU</TableHead>
                  <TableHead className="text-xs text-center">Số lượng</TableHead>
                  <TableHead className="text-xs text-right">Giá trị</TableHead>
                  <TableHead className="text-xs text-center">Cảnh báo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouseSummary.map(wh => (
                  <TableRow key={wh.warehouse}>
                    <TableCell className="text-sm font-medium">{wh.warehouse}</TableCell>
                    <TableCell className="text-center text-sm">{wh.totalSKU}</TableCell>
                    <TableCell className="text-center text-sm">{wh.totalQty.toLocaleString("vi-VN")}</TableCell>
                    <TableCell className="text-right text-sm">{formatVND(wh.totalValue)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {wh.lowCount > 0 && (
                          <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                            <AlertTriangle className="h-3 w-3 mr-0.5" /> {wh.lowCount}
                          </Badge>
                        )}
                        {wh.outCount > 0 && (
                          <Badge className="bg-red-100 text-red-700 text-[10px]">
                            <XOctagon className="h-3 w-3 mr-0.5" /> {wh.outCount}
                          </Badge>
                        )}
                        {wh.lowCount === 0 && wh.outCount === 0 && (
                          <Badge className="bg-green-100 text-green-700 text-[10px]">Ổn</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Items needing restock */}
        <Card className={branchLowStock.length + branchOutOfStock.length > 0 ? "border-amber-200" : ""}>
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-amber-600" /> Chi nhánh cần bổ sung
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">SKU</TableHead>
                  <TableHead className="text-xs">Sản phẩm</TableHead>
                  <TableHead className="text-xs">Kho</TableHead>
                  <TableHead className="text-xs text-center">Khả dụng</TableHead>
                  <TableHead className="text-xs text-center">Ngưỡng</TableHead>
                  <TableHead className="text-xs text-center">Thiếu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...branchOutOfStock, ...branchLowStock].slice(0, 10).map((item, idx) => {
                  const deficit = Math.max(0, item.reorderPoint * 2 - item.available)
                  return (
                    <TableRow key={`${item.sku}-${item.warehouse}-${idx}`} className={cn(
                      item.available === 0 ? "bg-red-50/50" : "bg-amber-50/50"
                    )}>
                      <TableCell className="font-mono text-xs text-primary">{item.sku}</TableCell>
                      <TableCell className="text-sm">{item.name}</TableCell>
                      <TableCell className="text-xs">{item.warehouse}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn(
                          "text-xs",
                          item.available === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {item.available}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">{item.reorderPoint}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-semibold text-red-600">-{deficit}</span>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {branchOutOfStock.length + branchLowStock.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Tất cả chi nhánh đều đủ hàng!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Pending transfers */}
      {pendingTransfers.length > 0 && (
        <Card className="mt-6 border-purple-200">
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <Scale className="h-5 w-5 text-purple-600" /> Điều chuyển đang xử lý ({pendingTransfers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Mã</TableHead>
                  <TableHead className="text-xs">Ngày</TableHead>
                  <TableHead className="text-xs">Đến kho</TableHead>
                  <TableHead className="text-xs">Sản phẩm</TableHead>
                  <TableHead className="text-xs text-center">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTransfers.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs text-purple-600">{t.reference}</TableCell>
                    <TableCell className="text-sm">{t.date}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        Kho Hub <ArrowRight className="h-3 w-3" /> {t.toWarehouse}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{t.items.map(i => `${i.name} (x${i.qty})`).join(", ")}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "text-xs",
                        t.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {t.status === "pending" ? "Chờ xuất" : "Đang vận chuyển"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
