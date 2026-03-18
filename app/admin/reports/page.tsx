"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { formatVND } from "@/lib/utils"
import { cn } from "@/lib/utils"
import {
  Download, TrendingUp, TrendingDown, DollarSign, CalendarCheck,
  Activity, ShoppingBag, Loader2
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ComposedChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend
} from "recharts"
import { apiFetch } from "@/lib/api"

// ─── Types ───────────────────────────────────────
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
  topProducts: { name: string; qty: number; revenue: number }[]
  hourlyDistribution: { hour: string; bookings: number }[]
  paymentMethods: { name: string; value: number; color: string }[]
}

const datePresets = [
  { label: "Hôm nay",   value: "today" },
  { label: "7 ngày",    value: "7d" },
  { label: "30 ngày",   value: "30d" },
  { label: "Tháng này", value: "month" },
]

function getHeatmapColor(occupancy: number) {
  if (occupancy <= 30) return "bg-green-200 text-green-900"
  if (occupancy <= 60) return "bg-amber-200 text-amber-900"
  if (occupancy <= 85) return "bg-orange-300 text-orange-900"
  return "bg-red-400 text-red-50"
}

function generateHeatmapData() {
  const data: { day: number; weekday: number; occupancy: number }[] = []
  for (let d = 1; d <= 28; d++) {
    data.push({ day: d, weekday: (d - 1) % 7, occupancy: Math.floor(Math.random() * 100) })
  }
  return data
}

function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[1,2,3,4].map(i => (
        <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
      ))}
    </div>
  )
}

export default function AdminReports() {
  const [activePreset, setActivePreset] = useState("30d")
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const heatmapData = generateHeatmapData()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await apiFetch(`/stats/dashboard?range=${activePreset}`)
        if (res.success && res.data) {
          setStats(res.data as DashboardStats)
        }
      } catch (e) {
        console.error('Failed to load stats:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [activePreset])

  const kpis = stats ? [
    {
      title: "Tổng doanh thu",
      value: formatVND(stats.kpis.totalRevenue),
      change: `${stats.kpis.growthRate >= 0 ? '+' : ''}${stats.kpis.growthRate}%`,
      up: stats.kpis.growthRate >= 0,
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      title: "Doanh thu đặt sân",
      value: formatVND(stats.kpis.bookingRevenue),
      change: `${stats.kpis.totalBookings} đơn`,
      up: true,
      icon: <CalendarCheck className="h-5 w-5" />,
    },
    {
      title: "Doanh thu shop",
      value: formatVND(stats.kpis.shopRevenue),
      change: `${stats.kpis.totalOrders} đơn`,
      up: true,
      icon: <ShoppingBag className="h-5 w-5" />,
    },
    {
      title: "Khách hàng mới",
      value: `${stats.kpis.totalUsers}`,
      change: "trong kỳ",
      up: true,
      icon: <Activity className="h-5 w-5" />,
    },
  ] : []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Báo cáo</h1>
          <p className="text-sm text-muted-foreground">Phân tích và thống kê</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" /> Export
        </Button>
      </div>

      {/* Date Presets */}
      <div className="flex items-center gap-2 mb-6">
        {datePresets.map(p => (
          <button
            key={p.value}
            onClick={() => setActivePreset(p.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              activePreset === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {p.label}
          </button>
        ))}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
      </div>

      <Tabs defaultValue="revenue">
        <TabsList className="mb-4">
          <TabsTrigger value="revenue">Doanh Thu</TabsTrigger>
          <TabsTrigger value="occupancy">Công Suất Sân</TabsTrigger>
          <TabsTrigger value="inventory">Tồn Kho</TabsTrigger>
        </TabsList>

        {/* ── Revenue Tab ── */}
        <TabsContent value="revenue" className="space-y-6">

          {/* KPI Cards */}
          {loading ? <KPISkeleton /> : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kpis.map((kpi, i) => (
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
          )}

          {/* Weekly Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Doanh thu 7 ngày gần nhất</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-80 w-full" /> : (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={stats?.weeklyRevenue || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number) => [formatVND(value), '']}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="booking" stackId="1" stroke="#FF6B35" fill="#FF6B35" fillOpacity={0.3} name="Đặt sân" />
                    <Area type="monotone" dataKey="shop" stackId="1" stroke="#1F6B3A" fill="#1F6B3A" fillOpacity={0.3} name="Cửa hàng" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top Courts + Payment Methods */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg">Top sân theo doanh thu</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-60 w-full" /> : (
                  stats?.topCourts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={stats?.topCourts || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip formatter={(value: number) => [formatVND(value), 'Doanh thu']} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                        <Bar dataKey="revenue" fill="#FF6B35" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg">Phương thức thanh toán</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-60 w-full" /> : (
                  stats?.paymentMethods.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={stats?.paymentMethods || []} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="value">
                            {(stats?.paymentMethods || []).map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`${value}%`, '']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex justify-center flex-wrap gap-4 mt-2">
                        {(stats?.paymentMethods || []).map(d => (
                          <div key={d.name} className="flex items-center gap-1.5 text-xs">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                            <span className="text-muted-foreground">{d.name} ({d.value}%)</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Top sản phẩm bán chạy</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="p-4"><Skeleton className="h-40 w-full" /></div> : (
                stats?.topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">Sản phẩm</TableHead>
                        <TableHead className="text-xs text-center">Đã bán</TableHead>
                        <TableHead className="text-xs text-right">Doanh thu</TableHead>
                        <TableHead className="text-xs w-32">Tỷ trọng</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(stats?.topProducts || []).map((p, i) => {
                        const maxRev = Math.max(...(stats?.topProducts || []).map(x => x.revenue))
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-sm font-bold text-primary">{i + 1}</TableCell>
                            <TableCell className="text-sm font-medium">{p.name}</TableCell>
                            <TableCell className="text-center text-sm">{p.qty}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{formatVND(p.revenue)}</TableCell>
                            <TableCell><Progress value={(p.revenue / maxRev) * 100} className="h-1.5" /></TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Occupancy Tab ── */}
        <TabsContent value="occupancy" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-lg">Công suất sân - Tháng hiện tại</CardTitle>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-200" /> 0-30%</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-200" /> 31-60%</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-orange-300" /> 61-85%</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-400" /> 86%+</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {heatmapData.map((d, i) => (
                  <div
                    key={i}
                    className={cn("aspect-square rounded-md flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-105", getHeatmapColor(d.occupancy))}
                    title={`Ngày ${d.day}: ${d.occupancy}% công suất`}
                  >
                    <span className="text-xs font-bold">{d.day}</span>
                    <span className="text-[10px]">{d.occupancy}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Phân bổ booking theo giờ</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-72 w-full" /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats?.hourlyDistribution || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                    <Bar dataKey="bookings" name="Bookings" radius={[4, 4, 0, 0]}>
                      {(stats?.hourlyDistribution || []).map((entry, i) => (
                        <Cell key={i} fill={entry.bookings >= 10 ? "#FF6B35" : "#e2e8f0"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p className="text-xs text-muted-foreground text-center mt-2">Giờ cao điểm được highlight màu cam</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Inventory Tab ── */}
        <TabsContent value="inventory" className="space-y-6">
          <Card>
            <CardContent className="p-8 flex flex-col items-center justify-center text-center">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-serif text-lg font-bold">Báo cáo tồn kho</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">Xem chi tiết tại mục Tồn kho trong menu Quản lý.</p>
              <Button className="mt-4" variant="outline" asChild>
                <a href="/admin/inventory">Đi đến Tồn kho</a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}