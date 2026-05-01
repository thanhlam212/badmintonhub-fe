"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, CalendarClock, Check, Loader2, Repeat, SkipForward } from "lucide-react"
import { bookingApi, courtApi, type ApiCourt } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatVND } from "@/lib/utils"
import { cn } from "@/lib/utils"

type FixedOccurrence = {
  date: string
  dayLabel: string
  courtId: number
  courtName: string
  timeStart: string
  timeEnd: string
  available: boolean
  conflicts: { time: string; status: string; bookedBy?: string }[]
  pricePerHour: number
  amount: number
  skip: boolean
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function FixedBookingContent() {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuth()
  const [courts, setCourts] = useState<ApiCourt[]>([])
  const [loadingCourts, setLoadingCourts] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<any>(null)
  const [occurrences, setOccurrences] = useState<FixedOccurrence[]>([])

  const today = useMemo(() => new Date(), [])
  const [courtId, setCourtId] = useState(params.get("courtId") || "")
  const [cycle, setCycle] = useState<"weekly" | "monthly">("weekly")
  const [startDate, setStartDate] = useState(toDateInput(addDays(today, 1)))
  const [endDate, setEndDate] = useState(toDateInput(addDays(today, 30)))
  const [timeStart, setTimeStart] = useState("19:00")
  const [timeEnd, setTimeEnd] = useState("21:00")
  const [paymentMethod, setPaymentMethod] = useState("bank")
  const [customerName, setCustomerName] = useState(user?.fullName || "")
  const [customerPhone, setCustomerPhone] = useState(user?.phone || "")
  const [customerEmail, setCustomerEmail] = useState(user?.email || "")

  useEffect(() => {
    courtApi.getAll().then((data) => {
      setCourts(data)
      if (!courtId && data[0]) setCourtId(String(data[0].id))
      setLoadingCourts(false)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    setCustomerName(user.fullName || "")
    setCustomerPhone(user.phone || "")
    setCustomerEmail(user.email || "")
  }, [user?.id])

  const totalAmount = occurrences
    .filter((item) => !item.skip && item.available)
    .reduce((sum, item) => sum + item.amount, 0)

  const selectedCount = occurrences.filter((item) => !item.skip && item.available).length
  const conflictCount = occurrences.filter((item) => !item.available && !item.skip).length

  const handlePreview = async () => {
    setError("")
    setPreviewing(true)
    const res = await bookingApi.previewFixed({
      courtId: Number(courtId),
      cycle,
      startDate,
      endDate,
      timeStart,
      timeEnd,
    })
    setPreviewing(false)
    if (!res.success || !res.data) {
      setError(res.error || "Không thể kiểm tra lịch cố định")
      return
    }
    setPreview(res.data)
    setOccurrences(res.data.occurrences)
  }

  const updateOccurrence = (index: number, patch: Partial<FixedOccurrence>) => {
    setOccurrences((prev) => prev.map((item, i) => i === index ? { ...item, ...patch, available: patch.skip ? item.available : item.available } : item))
  }

  const recheckOccurrence = async (index: number) => {
    const item = occurrences[index]
    const res = await bookingApi.previewFixed({
      courtId: item.courtId,
      cycle: "weekly",
      startDate: item.date,
      endDate: item.date,
      timeStart: item.timeStart,
      timeEnd: item.timeEnd,
    })
    if (res.success && res.data?.occurrences?.[0]) {
      const next = res.data.occurrences[0]
      setOccurrences((prev) => prev.map((old, i) => i === index ? { ...old, ...next, skip: false } : old))
    }
  }

  const handleConfirm = async () => {
    setError("")
    if (!customerName.trim() || !customerPhone.trim()) {
      setError("Vui lòng nhập tên và số điện thoại khách hàng")
      return
    }
    if (conflictCount > 0) {
      setError("Vẫn còn buổi bị trùng. Hãy đổi sân/giờ hoặc bỏ qua buổi đó trước khi xác nhận.")
      return
    }
    setSubmitting(true)
    const res = await bookingApi.confirmFixed({
      courtId: Number(courtId),
      cycle,
      startDate,
      endDate,
      timeStart,
      timeEnd,
      paymentMethod,
      customerName,
      customerPhone,
      customerEmail,
      userId: user?.role !== "guest" ? user?.id : undefined,
      adjustmentLimit: 2,
      occurrences: occurrences.map((item) => ({
        date: item.date,
        courtId: item.courtId,
        timeStart: item.timeStart,
        timeEnd: item.timeEnd,
        skip: item.skip || !item.available,
      })),
    })
    setSubmitting(false)
    if (!res.success) {
      setError(res.error || "Không thể tạo lịch cố định")
      return
    }
    localStorage.setItem("completedFixedBooking", JSON.stringify(res.data))
    router.push("/my-bookings")
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Repeat className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Lịch đặt sân cố định</span>
          </div>
          <h1 className="font-serif text-2xl font-extrabold">Tạo gói đặt sân theo tuần hoặc theo tháng</h1>
          <p className="text-sm text-muted-foreground">
            Hệ thống sẽ kiểm tra từng buổi. Buổi bị trùng có thể đổi sân, đổi giờ hoặc bỏ qua trước khi thanh toán.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Thông tin gói</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Sân mặc định</Label>
                <Select value={courtId} onValueChange={setCourtId} disabled={loadingCourts}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Chọn sân" />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((court) => (
                      <SelectItem key={court.id} value={String(court.id)}>
                        {court.name} - {formatVND(court.price)}/h
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Chu kỳ</Label>
                  <Select value={cycle} onValueChange={(v) => setCycle(v as "weekly" | "monthly")}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Hàng tuần</SelectItem>
                      <SelectItem value="monthly">Hàng tháng</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Thanh toán</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Chuyển khoản</SelectItem>
                      <SelectItem value="momo">MoMo</SelectItem>
                      <SelectItem value="cash">Tiền mặt/cọc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Từ ngày</Label>
                  <Input className="mt-1.5" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>Đến ngày</Label>
                  <Input className="mt-1.5" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Bắt đầu</Label>
                  <Input className="mt-1.5" type="time" step="3600" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
                </div>
                <div>
                  <Label>Kết thúc</Label>
                  <Input className="mt-1.5" type="time" step="3600" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div>
                  <Label>Họ tên</Label>
                  <Input className="mt-1.5" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <Label>Số điện thoại</Label>
                  <Input className="mt-1.5" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input className="mt-1.5" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                </div>
              </div>

              <Button className="w-full gap-2 font-semibold" onClick={handlePreview} disabled={!courtId || previewing}>
                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                Kiểm tra lịch
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="font-serif text-lg">Danh sách buổi</CardTitle>
                  {preview && (
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{selectedCount} buổi hợp lệ</Badge>
                      {conflictCount > 0 && <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{conflictCount} buổi trùng</Badge>}
                      <Badge className="bg-primary text-primary-foreground">{formatVND(totalAmount)}</Badge>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {occurrences.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-14 text-center">
                    <CalendarClock className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 font-medium">Chưa có lịch kiểm tra</p>
                    <p className="text-sm text-muted-foreground">Chọn thông tin gói rồi bấm kiểm tra lịch.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {occurrences.map((item, index) => (
                      <div
                        key={`${item.date}-${index}`}
                        className={cn(
                          "rounded-lg border p-4",
                          item.skip
                            ? "bg-muted/50 opacity-70"
                            : item.available
                              ? "border-green-200 bg-green-50/40"
                              : "border-red-200 bg-red-50/50"
                        )}
                      >
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{item.date}</span>
                              <span className="text-sm text-muted-foreground">{item.timeStart} - {item.timeEnd}</span>
                              {item.skip ? (
                                <Badge variant="outline" className="gap-1"><SkipForward className="h-3 w-3" /> Bỏ qua</Badge>
                              ) : item.available ? (
                                <Badge className="bg-green-600 gap-1"><Check className="h-3 w-3" /> Hợp lệ</Badge>
                              ) : (
                                <Badge className="bg-red-600">Bị trùng</Badge>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.courtName} - {formatVND(item.amount)}
                            </p>
                            {!item.available && !item.skip && (
                              <p className="mt-1 text-xs text-red-600">
                                Trùng slot: {item.conflicts.map((c) => c.time).join(", ")}
                              </p>
                            )}
                          </div>

                          <div className="grid gap-2 sm:grid-cols-[180px_110px_110px_auto_auto]">
                            <Select
                              value={String(item.courtId)}
                              onValueChange={(value) => updateOccurrence(index, {
                                courtId: Number(value),
                                courtName: courts.find((court) => court.id === Number(value))?.name || item.courtName,
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {courts.map((court) => (
                                  <SelectItem key={court.id} value={String(court.id)}>{court.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input type="time" step="3600" value={item.timeStart} onChange={(e) => updateOccurrence(index, { timeStart: e.target.value })} />
                            <Input type="time" step="3600" value={item.timeEnd} onChange={(e) => updateOccurrence(index, { timeEnd: e.target.value })} />
                            <Button variant="outline" onClick={() => recheckOccurrence(index)}>Kiểm tra</Button>
                            <Button
                              variant={item.skip ? "default" : "outline"}
                              onClick={() => updateOccurrence(index, { skip: !item.skip })}
                            >
                              {item.skip ? "Dùng lại" : "Bỏ qua"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {occurrences.length > 0 && (
              <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">Tổng thanh toán: <span className="text-primary">{formatVND(totalAmount)}</span></p>
                    <p className="text-sm text-muted-foreground">
                      Gói này cho phép khách điều chỉnh tối đa 2 buổi trong tháng mà không ảnh hưởng toàn bộ lịch.
                    </p>
                  </div>
                  <Button className="font-semibold" onClick={handleConfirm} disabled={submitting || selectedCount === 0}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Xác nhận gói cố định
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function FixedBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    }>
      <FixedBookingContent />
    </Suspense>
  )
}
