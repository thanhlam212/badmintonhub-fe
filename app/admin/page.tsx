"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { BookingStatusBadge } from "@/components/shared"
import { TrendingUp, TrendingDown, CalendarCheck, DollarSign, Activity, AlertTriangle, Users } from "lucide-react"
import { formatVND } from "@/lib/utils"
import { bookingApi, inventoryApi, apiFetch, ApiBooking } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

// ─── Types ───────────────────────────────────
interface DashboardStats {
  kpis: {
    totalRevenue: number
    bookingRevenue: number
    shopRevenue: number
    growthRate: number
    totalBookings: number
    totalOrders: number
    totalUsers: number
  }
  weeklyRevenue: { day: string; booking: number; shop: number }[]
  topCourts: { name: string; revenue: number; bookings: number }[]
  paymentMethods: { name: string; value: number; color: string }[]
}

const COURT_COLORS = ["#FF6B35", "#1F6B3A", "#0F172A", "#0d6efd", "#d63384"]

export default function AdminDashboard() {
  const [stats, setStats]               = useState<DashboardStats | null>(null)
  const [recentBookings, setRecentBookings] = useState<ApiBooking[]>([])
  const [stockAlerts, setStockAlerts]   = useState<any[]>([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    Promise.all([
      // Stats thật từ BE
      apiFetch('/stats/dashboard?range=7d').then(res => {
        if (res.success && res.data) setStats(res.data as DashboardStats)
      }).catch(() => {}),

      // Booking gần đây
      bookingApi.getAll({ limit: 5 }).then(res => {
        setRecentBookings(res.bookings || [])
      }).catch(() => {}),

      // Cảnh báo tồn kho
      inventoryApi.getLowStock().then(res => {
        if (res.success && res.data) setStockAlerts(res.data)
      }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  // ─── KPI Cards từ data thật ───────────────
  const kpis = stats ? [
    {
      title: "Tổng doanh thu (7 ngày)",
      value: formatVND(stats.kpis.totalRevenue),
      change: `${stats.kpis.growthRate >= 0 ? '+' : ''}${stats.kpis.growthRate}%`,
      up: stats.kpis.growthRate >= 0,
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      title: "Booking (7 ngày)",
      value: String(stats.kpis.totalBookings),
      change: `+${stats.kpis.totalOrders} đơn shop`,
      up: true,
      icon: <CalendarCheck className="h-5 w-5" />,
    },
    {
      title: "Doanh thu đặt sân",
      value: formatVND(stats.kpis.bookingRevenue),
      change: `shop: ${formatVND(stats.kpis.shopRevenue)}`,
      up: true,
      icon: <Activity className="h-5 w-5" />,
    },
    {
      title: "Khách hàng mới",
      value: String(stats.kpis.totalUsers),
      change: "trong 7 ngày",
      up: true,
      icon: <Users className="h-5 w-5" />,
    },
  ] : []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {loading ? (
          [1,2,3,4].map(i => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))
        ) : kpis.map((kpi, i) => (
          <Card key={i} className="hover:-translate-y-0.5 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-primary/10 text-primary">{kpi.icon}</span>
                <span className={cn("flex items-center gap-0.5 text-xs font-semibold", kpi.up ? "text-green-600" : "text-red-600")}>
                  {kpi.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {kpi.change}
                </span>
              </div>
              <p className="font-serif text-2xl font-extrabold mt-3">{kpi.value}</p>
              <p className="text-sm text-muted-foreground">{kpi.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        {/* Area Chart — doanh thu 7 ngày */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Doanh thu 7 ngày</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-72 w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={stats?.weeklyRevenue || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [formatVND(value), '']}
                  />
                  <Area type="monotone" dataKey="booking" stackId="1" stroke="#FF6B35" fill="#FF6B35" fillOpacity={0.3} name="Đặt sân" />
                  <Area type="monotone" dataKey="shop" stackId="1" stroke="#1F6B3A" fill="#1F6B3A" fillOpacity={0.3} name="Cửa hàng" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut Chart — top courts */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Top sân đặt nhiều</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-60 w-full" /> : (
              stats?.topCourts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stats?.topCourts || []}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={80}
                        paddingAngle={5} dataKey="bookings"
                        nameKey="name"
                      >
                        {(stats?.topCourts || []).map((_, i) => (
                          <Cell key={i} fill={COURT_COLORS[i % COURT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} booking`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {(stats?.topCourts || []).slice(0, 3).map((c, i) => (
                      <div key={c.name} className="flex items-center gap-1.5 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COURT_COLORS[i] }} />
                        <span className="text-muted-foreground truncate">{c.name} ({c.bookings})</span>
                      </div>
                    ))}
                  </div>
                </>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Bookings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                Booking gần đây
                <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-1" /> Live
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Chưa có booking</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Khách</TableHead>
                    <TableHead className="text-xs">Sân</TableHead>
                    <TableHead className="text-xs">Giờ</TableHead>
                    <TableHead className="text-xs">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentBookings.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="text-sm">{b.customerName}</TableCell>
                      <TableCell className="text-sm">{b.courtName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.timeStart} - {b.timeEnd}</TableCell>
                      <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Cảnh báo tồn kho</CardTitle>
          </CardHeader>
          <CardContent>
            {stockAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Không có cảnh báo</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Sản phẩm</TableHead>
                    <TableHead className="text-xs">Tồn kho</TableHead>
                    <TableHead className="text-xs">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockAlerts.map((item: any, idx: number) => (
                    <TableRow key={`${item.sku}-${idx}`} className="bg-amber-50/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{item.product_name || item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.sku}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-sm font-semibold", (item.quantity || 0) === 0 ? "text-red-600" : "text-amber-600")}>
                          {item.quantity ?? item.available ?? 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" className="text-xs h-7">Tạo PO</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}