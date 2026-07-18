"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth-context"
import { bookingApi, branchApi, courtApi, type ApiCourt } from "@/lib/api"
import { cn, formatDateLabel, formatSlotRange, formatVND, generateTimeSlots, getWeekDays, isSlotPast } from "@/lib/utils"
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Lock,
  MapPin,
  Star,
  Users,
  XCircle,
} from "lucide-react"

type Court = ApiCourt

type CourtSlotBooking = {
  bookingId: string
  bookingCode?: string
  courtId: number
  dateLabel: string
  time: string
  status: "booked" | "hold"
  bookedBy?: string
  phone?: string
  customerEmail?: string | null
}

type CancelTarget = CourtSlotBooking & {
  dayName: string
}

function CourtTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    premium: { label: "Premium", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    vip: { label: "VIP", cls: "bg-purple-100 text-purple-700 border-purple-200" },
    standard: { label: "Standard", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  }
  const value = map[type] || map.standard
  return (
    <Badge variant="outline" className={cn("text-[10px]", value.cls)}>
      {value.label}
    </Badge>
  )
}

export default function EmployeeCourtsPage() {
  const { user } = useAuth()
  const [courtsData, setCourtsData] = useState<Court[]>([])
  const [branchesList, setBranchesList] = useState<{ id: number; name: string }[]>([])
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [employeeAction, setEmployeeAction] = useState<"booked" | "hold">("booked")
  const [bookingsVersion, setBookingsVersion] = useState(0)
  const [allBookings, setAllBookings] = useState<CourtSlotBooking[]>([])
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    courtApi.getAll({ includeUnavailable: true }).then((res) => {
      if (Array.isArray(res)) setCourtsData(res)
    }).catch(() => setCourtsData([]))

    branchApi.getAll().then((res: any) => {
      if (Array.isArray(res)) {
        setBranchesList(res.map((branch: any) => ({ id: branch.id, name: branch.name })))
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false

    const fetchBookings = () => {
      bookingApi.getAll({ limit: 1000 }).then((res: any) => {
        if (cancelled) return

        const slots: CourtSlotBooking[] = []
        for (const booking of res.bookings || []) {
          if (booking.status === "cancelled" || !booking.courtId || !booking.timeStart) continue

          const dateLabel = booking.bookingDate ? formatDateLabel(new Date(booking.bookingDate)) : ""
          if (!dateLabel) continue

          const startHour = parseInt(booking.timeStart.split(":")[0] || "0", 10)
          const endHour = booking.timeEnd ? parseInt(booking.timeEnd.split(":")[0] || "0", 10) : startHour + 1
          const slotStatus: "booked" | "hold" =
            booking.status === "hold" || booking.status === "pending" || booking.status === "deposited"
              ? "hold"
              : "booked"

          for (let hour = startHour; hour < endHour; hour += 1) {
            slots.push({
              bookingId: booking.id,
              bookingCode: booking.bookingCode,
              courtId: booking.courtId,
              dateLabel,
              time: `${String(hour).padStart(2, "0")}:00`,
              status: slotStatus,
              bookedBy: booking.customerName || "",
              phone: booking.customerPhone || "",
              customerEmail: booking.customerEmail || null,
            })
          }
        }

        setAllBookings(slots)
      }).catch(() => {})
    }

    fetchBookings()
    const refreshTimer = window.setInterval(fetchBookings, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
    }
  }, [bookingsVersion])

  const warehouseToBranchName = useCallback((warehouse?: string): string | null => {
    if (!warehouse) return null
    const area = warehouse.replace("Kho ", "")
    const branch = branchesList.find((item) => item.name.includes(area))
    return branch ? branch.name : null
  }, [branchesList])

  const employeeBranch = useMemo(
    () => warehouseToBranchName(user?.warehouse),
    [user?.warehouse, warehouseToBranchName],
  )

  const branchCourts = useMemo(() => {
    if (!employeeBranch) return []
    return courtsData.filter((court) => court.branch === employeeBranch)
  }, [courtsData, employeeBranch])

  const filteredCourts = useMemo(() => {
    return branchCourts.filter((court) => typeFilter === "all" || court.type === typeFilter)
  }, [branchCourts, typeFilter])

  useEffect(() => {
    if (filteredCourts.length === 0) {
      setSelectedCourtId(null)
      return
    }

    if (!selectedCourtId || !filteredCourts.find((court) => court.id === selectedCourtId)) {
      setSelectedCourtId(filteredCourts[0].id)
    }
  }, [filteredCourts, selectedCourtId])

  const selectedCourt = courtsData.find((court) => court.id === selectedCourtId) || null
  const timeSlots = useMemo(() => generateTimeSlots(), [])

  const startDate = useMemo(() => {
    const value = new Date()
    value.setDate(value.getDate() + weekOffset * 7)
    return value
  }, [weekOffset])

  const weekDays = useMemo(() => getWeekDays(startDate), [startDate])
  const weekKey = weekDays.map((day) => day.label).join(",")
  const dayLabels = useMemo(() => weekDays.map((day) => day.label), [weekKey])

  const courtAvailability = useMemo(() => {
    if (!selectedCourt) return {} as Record<string, Record<string, "available" | "booked" | "hold">>

    const result: Record<string, Record<string, "available" | "booked" | "hold">> = {}
    for (const dateLabel of dayLabels) {
      result[dateLabel] = {}
      const dayBookings = allBookings.filter(
        (booking) => booking.courtId === selectedCourt.id && booking.dateLabel === dateLabel,
      )
      for (const booking of dayBookings) {
        result[dateLabel][booking.time] = booking.status
      }
    }
    return result
  }, [allBookings, dayLabels, selectedCourt])

  const handleSlotClick = useCallback(async (courtId: number, dateLabel: string, time: string, currentStatus: string) => {
    if (!selectedCourt) return

    if (currentStatus !== "available") {
      toast("Ô này đã có booking. Nhấn chuột phải để hủy và nhập lý do.")
      return
    }

    const parts = dateLabel.split("/")
    const day = Number(parts[0])
    const month = Number(parts[1])
    const slotDate = new Date(new Date().getFullYear(), month - 1, day)

    if (isSlotPast(slotDate, time)) {
      toast.error("Không thể thao tác với khung giờ đã qua.")
      return
    }

    try {
      const bookingDate = parts.length >= 2
        ? `${slotDate.getFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        : new Date().toISOString().split("T")[0]

      const created = await bookingApi.create({
        court_id: courtId,
        booking_date: bookingDate,
        time_start: time,
        time_end: `${String(parseInt(time.split(":")[0] || "0", 10) + 1).padStart(2, "0")}:00`,
        slots: 1,
        customer_name: user?.fullName || "Nhân viên",
        customer_phone: user?.phone || "0000000000",
        customer_email: user?.email || undefined,
        payment_method: "cash",
      })

      if (!created.success || !created.booking) {
        toast.error(created.error || "Không thể tạo booking cho ô này.")
        return
      }

      if (employeeAction === "booked") {
        const confirmed = await bookingApi.confirm(created.booking.id)
        if (!confirmed.success) {
          toast.error(confirmed.error || "Đã tạo booking giữ chỗ nhưng chưa xác nhận được.")
        } else {
          toast.success("Đã đặt chỗ thành công.")
        }
      } else {
        toast.success("Đã tạo giữ chỗ thành công.")
      }

      setBookingsVersion((value) => value + 1)
      window.dispatchEvent(new Event("bh-notifications-refresh"))
    } catch (error: any) {
      toast.error(error?.message || "Không thể thao tác với ô này.")
    }
  }, [employeeAction, selectedCourt, user?.email, user?.fullName, user?.phone])

  const openCancelDialog = useCallback((booking: CourtSlotBooking, dayName: string) => {
    setCancelTarget({ ...booking, dayName })
    setCancelReason("")
  }, [])

  const handleCancelBooking = useCallback(async () => {
    if (!cancelTarget) return

    const reason = cancelReason.trim()
    if (!reason) {
      toast.error("Vui lòng nhập lý do hủy sân.")
      return
    }

    setCancelLoading(true)
    try {
      const result = await bookingApi.cancel(cancelTarget.bookingId, { reason })
      if (!result.success) {
        toast.error(result.error || "Không thể hủy booking này.")
        return
      }

      toast.success("Đã hủy booking. Thông báo đã được gửi theo cấu hình hệ thống.")
      setCancelTarget(null)
      setCancelReason("")
      setBookingsVersion((value) => value + 1)
      window.dispatchEvent(new Event("bh-notifications-refresh"))
    } finally {
      setCancelLoading(false)
    }
  }, [cancelReason, cancelTarget])

  const totalCourts = branchCourts.length
  const availableCourts = branchCourts.filter((court) => court.available).length
  const premiumVip = branchCourts.filter((court) => court.type === "premium" || court.type === "vip").length
  const avgPrice = totalCourts > 0
    ? Math.round(branchCourts.reduce((sum, court) => sum + court.price, 0) / totalCourts)
    : 0

  const slotStats = useMemo(() => {
    const stats = { total: 0, available: 0, booked: 0, hold: 0 }
    if (!selectedCourt) return stats

    weekDays.forEach((day) => {
      const courtDay = courtAvailability[day.label]
      if (!courtDay) return
      timeSlots.forEach((time) => {
        stats.total += 1
        const status = courtDay[time] || "available"
        stats[status] += 1
      })
    })

    return stats
  }, [courtAvailability, selectedCourt, timeSlots, weekDays])

  if (!employeeBranch) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertTriangle className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm">Không xác định được chi nhánh của bạn.</p>
      </div>
    )
  }

  return (
    <>
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-extrabold">Quản lý sân</h1>
            <p className="text-sm text-muted-foreground">
              Chi nhánh: <strong>{employeeBranch.replace("BadmintonHub ", "")}</strong> - Xem lịch đặt và quản lý slot
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
            <Building2 className="h-3.5 w-3.5" />
            {employeeBranch.replace("BadmintonHub ", "")}
          </Badge>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { title: "Tổng số sân", value: totalCourts.toString(), icon: <Building2 className="h-5 w-5" />, color: "bg-primary/10 text-primary" },
            { title: "Đang hoạt động", value: availableCourts.toString(), icon: <CheckCircle2 className="h-5 w-5" />, color: "bg-green-100 text-green-600" },
            { title: "Premium / VIP", value: premiumVip.toString(), icon: <Star className="h-5 w-5" />, color: "bg-amber-100 text-amber-600" },
            { title: "Giá TB / giờ", value: formatVND(avgPrice), icon: <DollarSign className="h-5 w-5" />, color: "bg-secondary/10 text-secondary" },
          ].map((card) => (
            <Card key={card.title} className="transition-all hover:-translate-y-0.5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className={cn("rounded-lg p-2", card.color)}>{card.icon}</span>
                </div>
                <p className="mt-3 font-serif text-2xl font-extrabold">{card.value}</p>
                <p className="text-sm text-muted-foreground">{card.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-[160px]">
                <Label className="mb-1 block text-xs text-muted-foreground">Loại sân</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Loại sân" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả loại</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[220px] flex-1">
                <Label className="mb-1 block text-xs text-muted-foreground">Chọn sân</Label>
                <Select value={selectedCourtId?.toString() || ""} onValueChange={(value) => setSelectedCourtId(parseInt(value, 10))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Chọn sân..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCourts.map((court) => (
                      <SelectItem key={court.id} value={court.id.toString()}>
                        <span className="flex items-center gap-2">
                          {court.name}
                          {!court.available && <XCircle className="h-3 w-3 text-red-500" />}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCourt && (
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium",
                      selectedCourt.available
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-red-200 bg-red-50 text-red-700",
                    )}
                  >
                    {selectedCourt.available ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Hoạt động
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5" /> Tạm đóng
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedCourt && (
          <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{selectedCourt.name}</span>
              <CourtTypeBadge type={selectedCourt.type} />
              {selectedCourt.indoor ? (
                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-[10px] text-sky-600">Indoor</Badge>
              ) : (
                <Badge variant="outline" className="border-orange-200 bg-orange-50 text-[10px] text-orange-600">Outdoor</Badge>
              )}
            </div>
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {selectedCourt.branch}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {selectedCourt.hours}
            </span>
            <span className="font-semibold text-primary">{formatVND(selectedCourt.price)}/h</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {selectedCourt.rating} ({selectedCourt.reviews})
            </span>
          </div>
        )}

        {selectedCourt && (
          <div className="mb-4 flex flex-wrap gap-3">
            <Badge variant="outline" className="gap-1.5 bg-muted/50 px-2.5 py-1 text-xs">
              <CalendarDays className="h-3.5 w-3.5" /> Tổng slot: <strong>{slotStats.total}</strong>
            </Badge>
            <Badge variant="outline" className="gap-1.5 border-green-200 bg-green-50 px-2.5 py-1 text-xs text-green-700">
              <Check className="h-3.5 w-3.5" /> Trống: <strong>{slotStats.available}</strong>
            </Badge>
            <Badge variant="outline" className="gap-1.5 border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700">
              <Lock className="h-3.5 w-3.5" /> Đã đặt: <strong>{slotStats.booked}</strong>
            </Badge>
            <Badge variant="outline" className="gap-1.5 border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
              <Users className="h-3.5 w-3.5" /> Giữ chỗ: <strong>{slotStats.hold}</strong>
            </Badge>
            <span className="ml-auto self-center text-xs text-muted-foreground">
              Tỉ lệ lấp đầy: <strong>{slotStats.total ? Math.round(((slotStats.booked + slotStats.hold) / slotStats.total) * 100) : 0}%</strong>
            </span>
          </div>
        )}

        {selectedCourt ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 font-serif text-lg">
                  <CalendarDays className="h-5 w-5 text-primary" /> Lịch đặt sân
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                    disabled={weekOffset === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[140px] text-center text-sm font-medium">
                    {weekDays[0]?.label} - {weekDays[6]?.label}
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(weekOffset + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs"><span className="h-3 w-3 rounded bg-court-available" /> Trống</span>
                <span className="flex items-center gap-1.5 text-xs"><span className="h-3 w-3 rounded bg-court-booked" /> Đã đặt</span>
                <span className="flex items-center gap-1.5 text-xs"><span className="h-3 w-3 rounded bg-court-hold" /> Giữ chỗ</span>
                <span className="ml-2 flex items-center gap-2 border-l pl-4">
                  <span className="text-xs text-muted-foreground">Click ô trống:</span>
                  <Select value={employeeAction} onValueChange={(value: "booked" | "hold") => setEmployeeAction(value)}>
                    <SelectTrigger className="h-7 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="booked">Đặt chỗ</SelectItem>
                      <SelectItem value="hold">Giữ chỗ</SelectItem>
                    </SelectContent>
                  </Select>
                </span>
                <span className="text-xs text-muted-foreground">
                  Chuột phải ô đã có booking để hủy và nhập lý do.
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-0 pb-4">
              <div className="overflow-x-auto px-4">
                <div className="min-w-[700px]">
                  <div className="sticky top-0 z-10 mb-1 grid grid-cols-[90px_repeat(7,1fr)] gap-1 border-b bg-background pb-1">
                    <div className="py-1 text-center text-[10px] font-medium text-muted-foreground">Giờ</div>
                    {weekDays.map((day) => (
                      <div key={day.label} className="py-1 text-center">
                        <div className="text-[10px] text-muted-foreground">{day.dayName}</div>
                        <div className="text-xs font-semibold">{day.label}</div>
                      </div>
                    ))}
                  </div>

                  {timeSlots.map((time) => (
                    <div key={time} className="mb-[3px] grid grid-cols-[90px_repeat(7,1fr)] gap-1">
                      <div className="flex items-center justify-end pr-2 font-mono text-[10px] text-muted-foreground">{formatSlotRange(time)}</div>
                      {weekDays.map((day) => {
                        const status = courtAvailability[day.label]?.[time] || "available"
                        const bookingEntry = status === "available"
                          ? null
                          : allBookings.find(
                              (booking) => booking.courtId === selectedCourt.id && booking.dateLabel === day.label && booking.time === time,
                            ) || null

                        const slotButton = (
                          <button
                            key={`${day.label}-${time}`}
                            type="button"
                            onClick={() => handleSlotClick(selectedCourt.id, day.label, time, status)}
                            onContextMenu={(event) => {
                              if (!bookingEntry) return
                              event.preventDefault()
                              openCancelDialog(bookingEntry, day.dayName)
                            }}
                            className={cn(
                              "flex h-8 w-full cursor-pointer items-center justify-center rounded-[4px] text-[10px] font-medium transition-colors select-none",
                              status === "available" && "bg-court-available text-green-700 hover:bg-green-200",
                              status === "booked" && "bg-court-booked text-red-600 hover:bg-red-200",
                              status === "hold" && "bg-court-hold text-amber-700 hover:bg-amber-200",
                            )}
                          >
                            {status === "booked" ? "Đã đặt" : status === "hold" ? "Giữ chỗ" : ""}
                          </button>
                        )

                        if (bookingEntry && (bookingEntry.bookedBy || bookingEntry.phone || bookingEntry.bookingCode)) {
                          return (
                            <Tooltip key={`${day.label}-${time}`}>
                              <TooltipTrigger asChild>{slotButton}</TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[220px] rounded-lg bg-foreground px-3 py-2 text-xs text-background shadow-lg">
                                <div className="space-y-0.5">
                                  {bookingEntry.bookedBy && <p className="font-semibold">{bookingEntry.bookedBy}</p>}
                                  {bookingEntry.phone && <p className="text-background/80">SĐT: {bookingEntry.phone}</p>}
                                  {bookingEntry.bookingCode && <p className="text-background/80">Mã: {bookingEntry.bookingCode}</p>}
                                  <p className="text-[10px] text-background/60">{day.dayName} {day.label} - {time}</p>
                                  <p className="pt-1 text-[10px] text-background/60">Chuột phải để hủy booking.</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )
                        }

                        return slotButton
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Building2 className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">Chọn sân để xem lịch đặt</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open && !cancelLoading) {
            setCancelTarget(null)
            setCancelReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy booking sân</DialogTitle>
          </DialogHeader>

          {cancelTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p><strong>Khách:</strong> {cancelTarget.bookedBy || "Khách hàng"}</p>
                {cancelTarget.phone && <p><strong>SĐT:</strong> {cancelTarget.phone}</p>}
                {cancelTarget.bookingCode && <p><strong>Mã booking:</strong> {cancelTarget.bookingCode}</p>}
                <p><strong>Thời gian:</strong> {cancelTarget.dayName} {cancelTarget.dateLabel} - {cancelTarget.time}</p>
                <p><strong>Trạng thái:</strong> {cancelTarget.status === "hold" ? "Giữ chỗ" : "Đã đặt"}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cancel-reason">Lý do hủy</Label>
                <Textarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="Nhập lý do để hệ thống gửi thông báo cho admin và khách hàng..."
                  rows={4}
                  disabled={cancelLoading}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (cancelLoading) return
                setCancelTarget(null)
                setCancelReason("")
              }}
              disabled={cancelLoading}
            >
              Đóng
            </Button>
            <Button variant="destructive" onClick={handleCancelBooking} disabled={cancelLoading}>
              {cancelLoading ? "Đang hủy..." : "Xác nhận hủy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
