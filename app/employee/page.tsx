"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ShoppingCart, Package, DollarSign, CalendarCheck, ArrowDownToLine
} from "lucide-react"
import { formatVND } from "@/lib/utils"
import { inventoryApi, orderApi, bookingApi, apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"

export default function EmployeeDashboard() {
  const { user } = useAuth()
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [recentOrders, setRecentOrders]   = useState<any[]>([])
  const [recentBookings, setRecentBookings] = useState<any[]>([])
  const [stats, setStats]                 = useState<any>(null)
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    Promise.all([
      // Stats hôm nay
      apiFetch('/stats/dashboard?range=today').then(res => {
        if (res.success && res.data) setStats(res.data)
      }).catch(() => {}),

      // Đơn hàng shop gần đây
      orderApi.getAll().then(res => {
        setRecentOrders((res.orders || []).slice(0, 5))
      }).catch(() => {}),

      // Booking gần đây
      bookingApi.getAll({ limit: 5 }).then(res => {
        setRecentBookings(res.bookings || [])
      }).catch(() => {}),

      // Cảnh báo tồn kho
      inventoryApi.getLowStock().then((res: any) => {
        if (res.success && res.data) setLowStockItems(res.data.map((i: any) => ({
          id: i.id, name: i.product_name || i.name || "", sku: i.sku || "",
          warehouse: i.warehouse_name || "", available: i.quantity ?? 0,
          reorderPoint: i.reorder_point ?? i.min_quantity ?? 10,
        })))
      }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const todayStats = [
    {
      title: "Đơn hàng shop hôm nay",
      value: loading ? "..." : String(stats?.kpis?.totalOrders ?? 0),
      icon: <ShoppingCart className="h-5 w-5" />,
      color: "bg-blue-100 text-blue-600",
    },
    {
      title: "Doanh thu hôm nay",
      value: loading ? "..." : formatVND(stats?.kpis?.totalRevenue ?? 0),
      icon: <DollarSign className="h-5 w-5" />,
      color: "bg-green-100 text-green-600",
    },
    {
      title: "Booking hôm nay",
      value: loading ? "..." : String(stats?.kpis?.totalBookings ?? 0),
      icon: <CalendarCheck className="h-5 w-5" />,
      color: "bg-purple-100 text-purple-600",
    },
    {
      title: "Sản phẩm sắp hết",
      value: loading ? "..." : String(lowStockItems.length),
      icon: <ArrowDownToLine className="h-5 w-5" />,
      color: lowStockItems.length > 0 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600",
    },
  ]

  const paymentLabel: Record<string, string> = {
    cod: "Tiền mặt", momo: "MoMo", vnpay: "VNPay",
    bank: "Chuyển khoản", cash: "Tiền mặt",
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold text-foreground">
            Xin chào, {user?.fullName || "Nhân viên"}! 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {todayStats.map((stat, i) => (
          <Card key={i} className="hover:-translate-y-0.5 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className={cn("p-2 rounded-lg", stat.color)}>{stat.icon}</span>
              </div>
              {loading
                ? <Skeleton className="h-8 w-24 mt-3" />
                : <p className="font-serif text-2xl font-extrabold mt-3">{stat.value}</p>
              }
              <p className="text-sm text-muted-foreground">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" /> Đơn hàng gần đây
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4"><Skeleton className="h-32 w-full" /></div>
            ) : recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Chưa có đơn hàng</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Khách hàng</TableHead>
                    <TableHead className="text-xs text-center">SL SP</TableHead>
                    <TableHead className="text-xs text-right">Tổng tiền</TableHead>
                    <TableHead className="text-xs">Thanh toán</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="text-sm font-medium">{order.customerName}</TableCell>
                      <TableCell className="text-center text-sm">
                        {(order.items || []).reduce((s: number, i: any) => s + (i.quantity || i.qty || 0), 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatVND(order.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {paymentLabel[order.paymentMethod?.toLowerCase()] || order.paymentMethod || 'N/A'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card className={lowStockItems.length > 0 ? "border-amber-200" : ""}>
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-600" /> Cảnh báo tồn kho
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Không có sản phẩm nào sắp hết hàng</p>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.sku} • {item.warehouse}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={item.available === 0 ? "destructive" : "outline"} className="text-xs">
                        {item.available === 0 ? "Hết hàng" : `Còn ${item.available}`}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">Mức đặt lại: {item.reorderPoint}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}