"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Loader2,
  Package,
  ShoppingCart,
  Trophy,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api"
import { cn, formatVND } from "@/lib/utils"

type ReportRange = "today" | "week" | "month" | "30d" | "date" | "custom"

type EmployeeReport = {
  range: ReportRange
  label: string
  branch: { id: number | null; name: string }
  period: { from: string; to: string; description?: string }
  kpis: {
    totalRevenue: number
    bookingRevenue: number
    onlineRevenue: number
    posRevenue: number
    growthRate: number
    totalBookings: number
    totalOrders: number
    onlineOrders: number
    posOrders: number
    completedBookings: number
    cancelledBookings: number
    pendingBookings: number
    deliveredOrders: number
    pendingOrders: number
  }
  dailySeries: {
    date: string
    label: string
    booking: number
    online: number
    pos: number
    total: number
    bookings: number
    orders: number
  }[]
  topCourts: { name: string; revenue: number; bookings: number }[]
  topProducts: { name: string; qty: number; revenue: number }[]
  paymentMethods: { name: string; count: number }[]
  branchRevenue?: {
    branchId: number
    branchName: string
    bookingRevenue: number
    onlineRevenue: number
    posRevenue: number
    storeRevenue: number
    totalRevenue: number
    bookings: number
    orders: number
    courts: { name: string; revenue: number; bookings: number }[]
  }[]
}

const RANGE_OPTIONS: { value: ReportRange; label: string; desc: string; icon: ReactNode }[] = [
  { value: "today", label: "Hôm nay", desc: "Theo ngày", icon: <CalendarDays className="h-4 w-4" /> },
  { value: "week", label: "Tuần này", desc: "Từ thứ 2", icon: <CalendarRange className="h-4 w-4" /> },
  { value: "month", label: "Tháng này", desc: "Từ ngày 1", icon: <BarChart3 className="h-4 w-4" /> },
  { value: "30d", label: "30 ngày", desc: "Gần nhất", icon: <CalendarRange className="h-4 w-4" /> },
  { value: "date", label: "Theo ngày", desc: "Chọn 1 ngày", icon: <CalendarDays className="h-4 w-4" /> },
  { value: "custom", label: "Khoảng ngày", desc: "Từ ngày → đến ngày", icon: <CalendarRange className="h-4 w-4" /> },
]

const paymentLabel: Record<string, string> = {
  cash: "Tiền mặt",
  cod: "COD",
  sepay: "SePay",
  vnpay: "VNPay",
  momo: "MoMo",
  bank: "Chuyển khoản",
  bank_transfer: "Chuyển khoản",
}

function formatDate(value?: string) {
  if (!value) return ""
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}

export default function EmployeeReportsPage() {
  const [range, setRange] = useState<ReportRange>("today")
  const today = new Date().toISOString().slice(0, 10)
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [report, setReport] = useState<EmployeeReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError("")
      const params = new URLSearchParams({ range })
      if (range === "date") params.set("from", fromDate)
      if (range === "custom") {
        params.set("from", fromDate)
        params.set("to", toDate)
      }
      const res = await apiFetch<EmployeeReport>(`/stats/employee-report?${params.toString()}`)
      if (cancelled) return
      if (!res.success || !res.data) {
        setError(res.message || "Không thể tải báo cáo")
        setReport(null)
      } else {
        setReport(res.data)
      }
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [range, fromDate, toDate])

  const kpis = useMemo(() => {
    const data = report?.kpis
    return [
      {
        label: "Tổng doanh thu",
        value: data ? formatVND(data.totalRevenue) : "...",
        sub: data ? `${data.growthRate >= 0 ? "+" : ""}${data.growthRate}% so với kỳ trước` : "Đang tải",
        icon: <CircleDollarSign className="h-5 w-5" />,
        color: "bg-green-100 text-green-700",
      },
      {
        label: "Doanh thu sân",
        value: data ? formatVND(data.bookingRevenue) : "...",
        sub: data ? `${data.totalBookings} lịch đặt` : "Đang tải",
        icon: <CalendarDays className="h-5 w-5" />,
        color: "bg-blue-100 text-blue-700",
      },
      {
        label: "Đơn online",
        value: data ? formatVND(data.onlineRevenue) : "...",
        sub: data ? `${data.onlineOrders} đơn` : "Đang tải",
        icon: <ShoppingCart className="h-5 w-5" />,
        color: "bg-orange-100 text-orange-700",
      },
      {
        label: "Bán tại quầy",
        value: data ? formatVND(data.posRevenue) : "...",
        sub: data ? `${data.posOrders} đơn` : "Đang tải",
        icon: <Package className="h-5 w-5" />,
        color: "bg-purple-100 text-purple-700",
      },
    ]
  }, [report])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-foreground">Báo cáo chi nhánh</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi doanh thu, lịch đặt sân và đơn hàng của chi nhánh nhân viên.
          </p>
          {report && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-green-600 text-white">Chi nhánh: {report.branch.name}</Badge>
              <Badge variant="outline">
                {report.period.description || `${formatDate(report.period.from)} → ${formatDate(report.period.to)}`}
              </Badge>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              className={cn(
                "rounded-xl border px-3 py-2 text-left transition-all",
                range === option.value
                  ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-border bg-card hover:border-blue-200 hover:bg-blue-50/40",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                {option.icon}
                {option.label}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{option.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {(range === "date" || range === "custom") && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                {range === "date" ? "Ngày xem báo cáo" : "Từ ngày"}
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="h-10 rounded-xl border px-3 text-sm"
              />
            </div>
            {range === "custom" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Đến ngày</label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="h-10 rounded-xl border px-3 text-sm"
                />
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Report tính từ <strong>{formatDate(fromDate)}</strong>
              {range === "custom" && <> đến <strong>{formatDate(toDate)}</strong></>}.
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm font-medium text-red-600">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className={cn("rounded-xl p-2", item.color)}>{item.icon}</span>
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {loading ? (
                <Skeleton className="mt-4 h-8 w-32" />
              ) : (
                <p className="mt-4 font-serif text-2xl font-extrabold">{item.value}</p>
              )}
              <p className="text-sm font-medium">{item.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Doanh thu theo ngày
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-80 w-full" />
            ) : !report?.dailySeries?.length ? (
              <EmptyState text="Chưa có dữ liệu doanh thu trong khoảng này." />
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                    />
                    <Tooltip formatter={(value: any) => formatVND(Number(value))} />
                    <Bar dataKey="booking" stackId="a" name="Sân" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="online" stackId="a" name="Online" fill="#F97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pos" stackId="a" name="Tại quầy" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-green-600" />
              Vận hành
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : report ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatBox label="Lịch chờ/xác nhận" value={report.kpis.pendingBookings} />
                  <StatBox label="Lịch hoàn thành" value={report.kpis.completedBookings} />
                  <StatBox label="Lịch đã hủy" value={report.kpis.cancelledBookings} />
                  <StatBox label="Đơn cần xử lý" value={report.kpis.pendingOrders} />
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Phương thức thanh toán</p>
                  <div className="mt-3 space-y-2">
                    {report.paymentMethods.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Chưa có giao dịch.</p>
                    ) : report.paymentMethods.map((method) => (
                      <div key={method.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          {paymentLabel[method.name.toLowerCase()] || method.name}
                        </span>
                        <Badge variant="outline">{method.count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RankingTable
          title="Doanh thu từng sân"
          icon={<Trophy className="h-5 w-5 text-amber-600" />}
          rows={report?.topCourts || []}
          loading={loading}
          emptyText="Chưa có sân phát sinh doanh thu."
          columns={[
            { key: "name", label: "Sân" },
            { key: "bookings", label: "Lượt", align: "center" },
            { key: "revenue", label: "Doanh thu", align: "right", money: true },
          ]}
        />

        <RankingTable
          title="Top sản phẩm bán chạy"
          icon={<Package className="h-5 w-5 text-purple-600" />}
          rows={report?.topProducts || []}
          loading={loading}
          emptyText="Chưa có sản phẩm bán trong kỳ."
          columns={[
            { key: "name", label: "Sản phẩm" },
            { key: "qty", label: "SL", align: "center" },
            { key: "revenue", label: "Doanh thu", align: "right", money: true },
          ]}
        />
      </div>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="font-serif text-2xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function RankingTable({
  title,
  icon,
  rows,
  columns,
  loading,
  emptyText,
}: {
  title: string
  icon: ReactNode
  rows: any[]
  columns: { key: string; label: string; align?: "left" | "center" | "right"; money?: boolean }[]
  loading: boolean
  emptyText: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState text={emptyText} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      "text-xs",
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right",
                    )}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row.name}-${index}`}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "text-sm",
                        column.key === "name" && "font-medium",
                        column.align === "center" && "text-center",
                        column.align === "right" && "text-right font-semibold",
                      )}
                    >
                      {column.money ? formatVND(Number(row[column.key] || 0)) : row[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
