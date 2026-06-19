"use client"

import { useState, useCallback, useEffect, useMemo, Fragment, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BookingStatusBadge, PaymentBadge } from "@/components/shared"
import { formatBookingReference, formatDateLabel, formatVND, generateTimeSlots, isSlotPast } from "@/lib/utils"
import { branchApi, courtApi, bookingApi, userApi, ApiBooking, ApiBranch, ApiCourt, ApiUser } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import {
  Search, Plus, Eye, Edit2, ChevronDown, ChevronUp,
  Calendar as CalendarIcon, Clock, Users, MapPin, Phone, Mail, CheckCircle2,
  Play, QrCode, DollarSign, TrendingUp, AlertTriangle,
  CalendarDays, RefreshCw, ArrowUpDown, Lock, Repeat,
  ChevronLeft, ChevronRight, X, Loader2, Building2
} from "lucide-react"

/* ─── Types ─── */

interface BookingHistoryEntry {
  id: string; bookingCode: string; court: string; branch: string; date: string; day: string
  time: string; people: number; amount: number; status: string
  paymentMethod: string; customer: { name: string; phone: string; email: string }
  createdAt: string; courtId?: number; note?: string; placedBy?: string; placedByRole?: 'admin' | 'employee' | ''
}

interface CourtBookingEntry {
  courtId: number; dateLabel: string; time: string
  status: 'booked' | 'hold'; bookedBy?: string; placedBy?: string; placedByRole?: 'admin' | 'employee' | ''; bookingId?: string; bookingCode?: string; phone?: string
}

interface BranchItem { id: number; name: string; address?: string }
interface CourtItem { id: number; name: string; branch: string; branchId: number; type: string; price: number; indoor?: boolean }

interface BookingTimingState {
  startAt: Date
  endAt: Date
  checkinOpensAt: Date
  canCheckin: boolean
  minutesUntilCheckin: number
  remainingMs: number
  isEnded: boolean
}

interface CheckinWarningState {
  bookingId: string
  bookingCode: string
  court: string
  availableAt: string
  minutesUntilCheckin: number
}

interface CompletionNotice {
  bookingId: string
  bookingCode: string
  court: string
  endTime: string
}

/* ─── Helpers ─── */

function apiToBooking(b: ApiBooking): BookingHistoryEntry {
  const customerName = b.customerName?.trim() || "Khách"
  const customerPhone = b.customerPhone?.trim() || ""
  const displayBookingCode = formatBookingReference(b.bookingCode || b.id, b.createdAt)
  return {
    id: b.id, bookingCode: displayBookingCode, court: b.courtName, branch: b.branchName,
    date: b.bookingDate, day: "",
    time: `${b.timeStart} - ${b.timeEnd}`,
    people: b.slots || 2, amount: b.amount, status: b.status,
    paymentMethod: b.paymentMethod || "Cash",
    customer: { name: customerName, phone: customerPhone, email: "" },
    createdAt: b.createdAt, courtId: b.courtId, note: b.note || "", placedBy: b.placedBy || "", placedByRole: (b.placedByRole || "") as "admin" | "employee" | "",
  }
}

function bookingsToSlots(bookings: BookingHistoryEntry[]): CourtBookingEntry[] {
  const slots: CourtBookingEntry[] = []
  for (const b of bookings) {
    if (!b.courtId || !b.time || b.status === "cancelled") continue
    const parts = b.time.split(" - ")
    if (parts.length < 2) continue
    const start = parseInt(parts[0].split(":")[0])
    const end = parseInt(parts[1].split(":")[0])
    const d = new Date(b.date)
    const dateLabel = formatDateLabel(d)
    const bookedByLabel = b.customer.name?.trim() || b.customer.phone?.trim() || b.bookingCode
    for (let h = start; h < end; h++) {
      slots.push({
        courtId: b.courtId, dateLabel,
        time: `${h.toString().padStart(2, '0')}:00`,
        status: b.status === "hold" ? "hold" : "booked", bookedBy: bookedByLabel, placedBy: b.placedBy?.trim() || "", placedByRole: (b.placedByRole || "") as "admin" | "employee" | "",
        bookingId: b.id, bookingCode: b.bookingCode, phone: b.customer.phone,
      })
    }
  }
  return slots
}

function generateBookingId() {
  return formatBookingReference(`tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`, new Date())
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  } catch { return dateStr }
}

const CHECKIN_EARLY_MINUTES = 15

function parseTimeRange(timeRange: string) {
  const [start = "", end = ""] = timeRange.split(" - ").map((part) => part.trim())
  return { start, end }
}

function buildBookingDateTime(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return null
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null

  const [hour = "0", minute = "0"] = timeValue.split(":")
  date.setHours(Number(hour) || 0, Number(minute) || 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function getBookingTimingState(booking: BookingHistoryEntry, now: Date): BookingTimingState | null {
  const { start, end } = parseTimeRange(booking.time)
  const startAt = buildBookingDateTime(booking.date, start)
  const endAt = buildBookingDateTime(booking.date, end)
  if (!startAt || !endAt) return null

  if (endAt <= startAt) {
    endAt.setDate(endAt.getDate() + 1)
  }

  const checkinOpensAt = new Date(startAt.getTime() - CHECKIN_EARLY_MINUTES * 60_000)
  const remainingMs = endAt.getTime() - now.getTime()
  const minutesUntilCheckin = Math.max(0, Math.ceil((checkinOpensAt.getTime() - now.getTime()) / 60_000))

  return {
    startAt,
    endAt,
    checkinOpensAt,
    canCheckin: now >= checkinOpensAt && now < endAt,
    minutesUntilCheckin,
    remainingMs,
    isEnded: remainingMs <= 0,
  }
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function formatTimeOnly(date: Date) {
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/* ─── Status flow ─── */

const statusFlow: Record<string, string> = {
  hold: "confirmed",
  pending: "confirmed",
  confirmed: "playing",
  playing: "completed",
}

const MISSED_CHECKIN_STATUS = "missed_checkin"
const statusTabValues = ["all", "hold", "pending", "confirmed", MISSED_CHECKIN_STATUS, "playing", "completed", "cancelled"]
const activeTabAfterReloadKey = "employeeBookings.activeTabAfterReload"

function consumeActiveTabAfterReload() {
  if (typeof window === "undefined") return null

  const savedTab = window.sessionStorage.getItem(activeTabAfterReloadKey)
  if (savedTab && statusTabValues.includes(savedTab)) {
    window.sessionStorage.removeItem(activeTabAfterReloadKey)
    return savedTab
  }

  return null
}

const statusActionLabel: Record<string, string> = {
  hold: "Xác nhận thanh toán",
  pending: "Xác nhận",
  confirmed: "Check-in",
  playing: "Hoàn thành",
}

const timelineSteps = ["pending", "confirmed", "playing", "completed"]

function getTimelineStep(status: string) {
  const idx = timelineSteps.indexOf(status)
  return idx >= 0 ? idx : 0
}

function isMissedCheckinBooking(booking: BookingHistoryEntry, timing: BookingTimingState | null) {
  return booking.status === "confirmed" && !!timing?.isEnded
}

function getBookingDisplayStatus(booking: BookingHistoryEntry, now: Date) {
  const timing = getBookingTimingState(booking, now)
  return isMissedCheckinBooking(booking, timing) ? MISSED_CHECKIN_STATUS : booking.status
}

/* ─── Booking Detail Sheet ─── */

function BookingDetailSheet({
  booking,
  now,
  onStatusChange,
}: {
  booking: BookingHistoryEntry
  now: Date
  onStatusChange: (booking: BookingHistoryEntry, status: string) => void
}) {
  const step = getTimelineStep(booking.status)
  const timing = getBookingTimingState(booking, now)
  const displayStatus = isMissedCheckinBooking(booking, timing) ? MISSED_CHECKIN_STATUS : booking.status
  const showEarlyCheckinWarning =
    booking.status === "confirmed" &&
    timing &&
    !timing.canCheckin &&
    !timing.isEnded &&
    timing.minutesUntilCheckin > 0

  return (
    <SheetContent className="sm:max-w-[480px] overflow-y-auto">
      <SheetHeader>
        <SheetTitle className="font-serif text-xl">Chi tiết booking</SheetTitle>
      </SheetHeader>

      <div className="mt-6 space-y-6">
        {/* Booking Code */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Mã booking</p>
            <p className="font-mono text-lg font-bold text-primary">{booking.bookingCode}</p>
          </div>
          <BookingStatusBadge status={displayStatus} />
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-1">
          {timelineSteps.map((s, i) => (
            <Fragment key={s}>
              <div className={cn(
                "flex items-center justify-center h-7 w-7 rounded-full text-[10px] font-bold",
                i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {i + 1}
              </div>
              {i < timelineSteps.length - 1 && (
                <div className={cn("flex-1 h-0.5", i < step ? "bg-primary" : "bg-muted")} />
              )}
            </Fragment>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground -mt-4 px-1">
          <span>Chờ</span><span>Xác nhận</span><span>Check-in</span><span>Xong</span>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Sân</p>
              <p className="text-sm font-medium">{booking.court}</p>
              <p className="text-xs text-muted-foreground">{booking.branch}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Ngày & giờ</p>
              <p className="text-sm font-medium">{booking.date}</p>
              <p className="text-xs text-muted-foreground">{booking.time}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Số người</p>
              <p className="text-sm font-medium">{booking.people} người</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Tổng tiền</p>
              <p className="text-sm font-bold text-primary">{formatVND(booking.amount)}</p>
              <PaymentBadge method={booking.paymentMethod} />
            </div>
          </div>
        </div>

        {showEarlyCheckinWarning && timing && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900">Chưa đến giờ check-in</h4>
                <p className="mt-1 text-sm text-amber-800">
                  Nhân viên chỉ được check-in sớm tối đa {CHECKIN_EARLY_MINUTES} phút.
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Có thể check-in từ {formatTimeOnly(timing.checkinOpensAt)}. Còn {timing.minutesUntilCheckin} phút.
                </p>
              </div>
            </div>
          </div>
        )}

        {booking.status === "playing" && timing && (
          <div className={cn(
            "rounded-lg border p-4",
            timing.isEnded ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
          )}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">
                  {timing.isEnded ? "Sân đã hết giờ" : "Đếm ngược thời gian chơi"}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {timing.isEnded ? "Hệ thống đang chuyển booking sang hoàn thành." : `Kết thúc lúc ${formatTimeOnly(timing.endAt)}.`}
                </p>
              </div>
              <div className={cn(
                "rounded-lg px-3 py-2 text-sm font-bold tabular-nums",
                timing.isEnded ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              )}>
                {formatCountdown(timing.remainingMs)}
              </div>
            </div>
          </div>
        )}

        {/* Customer */}
        <div className="rounded-lg border p-4 space-y-2">
          <h4 className="text-sm font-semibold">Khách hàng</h4>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
              {booking.customer.name.split(' ').pop()?.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium">{booking.customer.name}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{booking.customer.phone}</span>
                {booking.customer.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{booking.customer.email}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Note */}
        {booking.note && (
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-semibold mb-1">Ghi chú</h4>
            <p className="text-sm text-muted-foreground">{booking.note}</p>
          </div>
        )}

        {/* Actions */}
        {booking.status === "hold" && (
          <>
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => onStatusChange(booking, "confirmed")}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Xác nhận thanh toán
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-red-500 border-red-200 hover:bg-red-50">Huỷ giữ chỗ</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-serif">Huỷ giữ chỗ?</AlertDialogTitle>
                  <AlertDialogDescription>Booking <strong>{booking.bookingCode}</strong> sẽ bị huỷ và slot sân được giải phóng.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Quay lại</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onStatusChange(booking, "cancelled")} className="bg-red-600 hover:bg-red-700">Huỷ</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
        {statusFlow[booking.status] && booking.status !== "hold" && displayStatus !== MISSED_CHECKIN_STATUS && (
          <Button className="w-full" onClick={() => onStatusChange(booking, statusFlow[booking.status])}>
            {booking.status === "pending" && <><CheckCircle2 className="h-4 w-4 mr-2" /> Xác nhận booking</>}
            {booking.status === "confirmed" && <><Play className="h-4 w-4 mr-2" /> Check-in</>}
            {booking.status === "playing" && <><CheckCircle2 className="h-4 w-4 mr-2" /> Hoàn thành</>}
          </Button>
        )}

        {(booking.status === "pending" || booking.status === "hold") && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full text-red-500 border-red-200 hover:bg-red-50">Huỷ booking</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-serif">Huỷ booking?</AlertDialogTitle>
                <AlertDialogDescription>Booking <strong>{booking.bookingCode}</strong> sẽ bị huỷ và slot sân được giải phóng.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Quay lại</AlertDialogCancel>
                <AlertDialogAction onClick={() => onStatusChange(booking, "cancelled")} className="bg-red-600 hover:bg-red-700">Huỷ booking</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Timestamps */}
        <div className="text-xs text-muted-foreground">
          <p>Tạo lúc: {booking.createdAt ? formatDate(booking.createdAt) : "—"}</p>
        </div>
      </div>
    </SheetContent>
  )
}

/* ─── Create / Edit Booking Dialog ─── */

function BookingFormDialog({
  open,
  onOpenChange,
  editBooking,
  courts: allCourts,
  branches,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editBooking: BookingHistoryEntry | null
  courts: CourtItem[]
  branches: BranchItem[]
  onSave: (booking: BookingHistoryEntry, isEdit: boolean) => void
}) {
  const isEdit = !!editBooking

  // Form state
  const [branchId, setBranchId] = useState<string>("")
  const [courtId, setCourtId] = useState<string>("")
  const [bookingDate, setBookingDate] = useState<Date | undefined>(undefined)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [people, setPeople] = useState(2)
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("Cash")
  const [status, setStatus] = useState("confirmed")
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (editBooking) {
        const court = allCourts.find(c => c.name === editBooking.court)
        const branch = court ? branches.find(b => b.id === court.branchId) : branches.find(b => b.name === editBooking.branch)
        setBranchId(branch ? String(branch.id) : "")
        setCourtId(court ? String(court.id) : "")
        try {
          const d = new Date(editBooking.date)
          if (!isNaN(d.getTime())) setBookingDate(d)
        } catch { /* ignore */ }
        const timeParts = editBooking.time.split(" - ")
        if (timeParts.length === 2) {
          setStartTime(timeParts[0].trim())
          setEndTime(timeParts[1].trim())
        }
        setPeople(editBooking.people)
        setCustomerName(editBooking.customer.name)
        setCustomerPhone(editBooking.customer.phone)
        setCustomerEmail(editBooking.customer.email)
        setPaymentMethod(editBooking.paymentMethod)
        setStatus(editBooking.status)
        setNote(editBooking.note || "")
      } else {
        // Auto-select employee's branch
        if (branches.length === 1) {
          setBranchId(String(branches[0].id))
        } else {
          setBranchId("")
        }
        setCourtId("")
        setBookingDate(new Date())
        setStartTime("")
        setEndTime("")
        setPeople(2)
        setCustomerName("")
        setCustomerPhone("")
        setCustomerEmail("")
        setPaymentMethod("Cash")
        setStatus("confirmed")
        setNote("")
        setErrors({})
      }
    }
  }, [open, editBooking, allCourts, branches])

  const filteredCourts = useMemo(() => {
    if (!branchId) return allCourts
    return allCourts.filter(c => c.branchId === parseInt(branchId))
  }, [branchId, allCourts])

  const selectedCourt = useMemo(() => {
    return allCourts.find(c => c.id === parseInt(courtId))
  }, [courtId, allCourts])

  const timeSlots = generateTimeSlots()

  const slotCount = useMemo(() => {
    if (!startTime || !endTime) return 0
    const startH = parseInt(startTime.split(":")[0])
    const endH = parseInt(endTime.split(":")[0])
    return Math.max(0, endH - startH)
  }, [startTime, endTime])

  const totalPrice = (selectedCourt?.price || 0) * slotCount

  const endTimeOptions = useMemo(() => {
    if (!startTime) return []
    const startH = parseInt(startTime.split(":")[0])
    const options: string[] = []
    for (let h = startH + 1; h <= 22; h++) {
      options.push(`${h.toString().padStart(2, '0')}:00`)
    }
    return options
  }, [startTime])

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!branchId) newErrors.branch = "Chọn chi nhánh"
    if (!courtId) newErrors.court = "Chọn sân"
    if (!bookingDate) newErrors.date = "Chọn ngày"
    if (!startTime) newErrors.startTime = "Chọn giờ bắt đầu"
    if (!endTime) newErrors.endTime = "Chọn giờ kết thúc"
    if (startTime && endTime && startTime >= endTime) newErrors.endTime = "Giờ kết thúc phải sau giờ bắt đầu"
    if (!customerName.trim()) newErrors.name = "Nhập tên khách"
    if (!customerPhone.trim()) newErrors.phone = "Nhập SĐT"
    else if (!/^0\d{9}$/.test(customerPhone)) newErrors.phone = "SĐT không hợp lệ"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    if (!selectedCourt || !bookingDate) return

    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

    const entry: BookingHistoryEntry = {
      id: editBooking?.id || generateBookingId(),
      bookingCode: editBooking?.bookingCode || generateBookingId(),
      court: selectedCourt.name,
      branch: selectedCourt.branch,
      date: `${bookingDate.getFullYear()}-${(bookingDate.getMonth() + 1).toString().padStart(2, '0')}-${bookingDate.getDate().toString().padStart(2, '0')}`,
      day: dayNames[bookingDate.getDay()],
      time: `${startTime} - ${endTime}`,
      people,
      amount: totalPrice,
      status,
      paymentMethod,
      customer: { name: customerName, phone: customerPhone, email: customerEmail },
      createdAt: editBooking?.createdAt || new Date().toISOString(),
      note,
    }

    onSave(entry, isEdit)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {isEdit ? "Sửa booking" : "Đặt sân trực tiếp (POS)"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {/* Branch & Court */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Chi nhánh <span className="text-red-500">*</span></Label>
              <Select value={branchId} onValueChange={(v) => { setBranchId(v); setCourtId("") }}>
                <SelectTrigger className={cn("mt-1.5", errors.branch && "border-red-500")}>
                  <SelectValue placeholder="Chọn chi nhánh" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.branch && <p className="text-xs text-red-500 mt-1">{errors.branch}</p>}
            </div>
            <div>
              <Label className="text-sm font-medium">Sân <span className="text-red-500">*</span></Label>
              <Select value={courtId} onValueChange={setCourtId} disabled={!branchId}>
                <SelectTrigger className={cn("mt-1.5", errors.court && "border-red-500")}>
                  <SelectValue placeholder="Chọn sân" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCourts.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} — {formatVND(c.price)}/h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.court && <p className="text-xs text-red-500 mt-1">{errors.court}</p>}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium">Ngày <span className="text-red-500">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1.5 justify-start text-left font-normal", !bookingDate && "text-muted-foreground", errors.date && "border-red-500")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {bookingDate ? `${String(bookingDate.getDate()).padStart(2,'0')}/${String(bookingDate.getMonth()+1).padStart(2,'0')}` : "Chọn ngày"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={bookingDate} onSelect={setBookingDate} />
                </PopoverContent>
              </Popover>
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>
            <div>
              <Label className="text-sm font-medium">Giờ bắt đầu <span className="text-red-500">*</span></Label>
              <Select value={startTime} onValueChange={(v) => { setStartTime(v); setEndTime("") }}>
                <SelectTrigger className={cn("mt-1.5", errors.startTime && "border-red-500")}>
                  <SelectValue placeholder="Từ" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.startTime && <p className="text-xs text-red-500 mt-1">{errors.startTime}</p>}
            </div>
            <div>
              <Label className="text-sm font-medium">Giờ kết thúc <span className="text-red-500">*</span></Label>
              <Select value={endTime} onValueChange={setEndTime} disabled={!startTime}>
                <SelectTrigger className={cn("mt-1.5", errors.endTime && "border-red-500")}>
                  <SelectValue placeholder="Đến" />
                </SelectTrigger>
                <SelectContent>
                  {endTimeOptions.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.endTime && <p className="text-xs text-red-500 mt-1">{errors.endTime}</p>}
            </div>
          </div>

          {/* Price preview */}
          {selectedCourt && slotCount > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
              <span className="text-sm text-muted-foreground">{slotCount} giờ × {formatVND(selectedCourt.price)}</span>
              <span className="font-serif text-lg font-bold text-primary">{formatVND(totalPrice)}</span>
            </div>
          )}

          {/* People */}
          <div>
            <Label className="text-sm font-medium">Số người chơi</Label>
            <div className="flex items-center gap-3 mt-1.5">
              <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setPeople(Math.max(1, people - 1))}>-</Button>
              <span className="font-bold w-8 text-center">{people}</span>
              <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setPeople(Math.min(10, people + 1))}>+</Button>
            </div>
          </div>

          {/* Customer */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Thông tin khách hàng</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Họ tên <span className="text-red-500">*</span></Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} className={cn("mt-1", errors.name && "border-red-500")} placeholder="Nguyễn Văn A" />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label className="text-xs">Số điện thoại <span className="text-red-500">*</span></Label>
                <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className={cn("mt-1", errors.phone && "border-red-500")} placeholder="0901234567" />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="mt-1" placeholder="email@example.com" />
            </div>
          </div>

          {/* Payment & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Thanh toán</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Tiền mặt</SelectItem>
                  <SelectItem value="MoMo">MoMo</SelectItem>
                  <SelectItem value="VNPay">VNPay</SelectItem>
                  <SelectItem value="Bank transfer">Chuyển khoản</SelectItem>
                  <SelectItem value="Wallet">Ví BH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Trạng thái</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Đã xác nhận</SelectItem>
                  <SelectItem value="playing">Đang chơi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Note */}
          <div>
            <Label className="text-sm font-medium">Ghi chú</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} className="mt-1.5" placeholder="Ghi chú nội bộ..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {isEdit ? "Lưu thay đổi" : "Đặt sân"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Schedule View ─── */

function ScheduleView({
  allCourts,
  courtBookings,
  branches,
  onRefresh,
}: {
  allCourts: CourtItem[]
  courtBookings: CourtBookingEntry[]
  branches: BranchItem[]
  onRefresh: () => void
}) {
  const [selectedBranch, setSelectedBranch] = useState(branches.length > 0 ? String(branches[0].id) : "")
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date())

  // Quick-book dialog state
  const [quickBookOpen, setQuickBookOpen] = useState(false)
  const [quickBookSlot, setQuickBookSlot] = useState<{ courtId: number; courtName: string; time: string; timeEnd: string; price: number; durationHours: number; totalPrice: number } | null>(null)
  const [qbName, setQbName] = useState("")
  const [qbPhone, setQbPhone] = useState("")
  const [qbPayment, setQbPayment] = useState("cash")
  const [qbNote, setQbNote] = useState("")
  const [qbRecurring, setQbRecurring] = useState(false)
  const [qbWeeks, setQbWeeks] = useState("4")
  const [qbSaving, setQbSaving] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ courtId: number; time: string } | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<{ courtId: number; time: string } | null>(null)

  // User account picker state
  const [qbUserSearch, setQbUserSearch] = useState("")
  const [qbUserResults, setQbUserResults] = useState<ApiUser[]>([])
  const [qbSelectedUser, setQbSelectedUser] = useState<ApiUser | null>(null)
  const [qbUserLoading, setQbUserLoading] = useState(false)
  const [qbUserPickerOpen, setQbUserPickerOpen] = useState(false)
  const qbUserSearchCacheRef = useRef<Map<string, ApiUser[]>>(new Map())
  const qbUserSearchReqRef = useRef(0)

  // Debounced user search
  useEffect(() => {
    const keyword = qbUserSearch.trim().toLowerCase()
    if (!qbUserPickerOpen) {
      setQbUserResults([])
      setQbUserLoading(false)
      return
    }

    const cacheKey = keyword || "__all__"
    const cached = qbUserSearchCacheRef.current.get(cacheKey)
    if (cached) {
      setQbUserResults(cached)
      setQbUserLoading(false)
      return
    }

    const timer = setTimeout(async () => {
      const requestId = ++qbUserSearchReqRef.current
      setQbUserLoading(true)
      try {
        const res = await userApi.getAll({ ...(keyword && { search: keyword }), limit: 10, role: 'user' })
        if (requestId !== qbUserSearchReqRef.current) return
        let users = res.users || []
        if (keyword && users.length === 0) {
          const fallback = await userApi.getAll({ search: keyword, limit: 10 })
          if (requestId !== qbUserSearchReqRef.current) return
          users = fallback.users || []
        }
        qbUserSearchCacheRef.current.set(cacheKey, users)
        setQbUserResults(users)
      } catch { setQbUserResults([]) }
      finally {
        if (requestId === qbUserSearchReqRef.current) {
          setQbUserLoading(false)
        }
      }
    }, keyword ? 250 : 0)
    return () => clearTimeout(timer)
  }, [qbUserSearch, qbUserPickerOpen])

  useEffect(() => {
    if (branches.length > 0 && !selectedBranch) {
      setSelectedBranch(String(branches[0].id))
    }
  }, [branches, selectedBranch])

  const branchCourts = useMemo(() => {
    return allCourts.filter(c => c.branchId === parseInt(selectedBranch))
  }, [selectedBranch, allCourts])

  const dateLabel = formatDateLabel(scheduleDate)
  const timeSlots = generateTimeSlots()

  const scheduleMap = useMemo(() => {
    const map: Record<number, Record<string, { status: string; bookedBy?: string; placedBy?: string; placedByRole?: 'admin' | 'employee' | ''; bookingId?: string; bookingCode?: string; phone?: string }>> = {}
    branchCourts.forEach(c => {
      map[c.id] = {}
      timeSlots.forEach(t => { map[c.id][t] = { status: "available" } })
    })
    courtBookings.forEach(b => {
      if (map[b.courtId] && b.dateLabel === dateLabel) {
        map[b.courtId][b.time] = { status: b.status, bookedBy: b.bookedBy, placedBy: b.placedBy, placedByRole: b.placedByRole, bookingId: b.bookingId, bookingCode: b.bookingCode, phone: b.phone }
      }
    })
    return map
  }, [branchCourts, courtBookings, dateLabel, timeSlots])

  const navigateDate = (offset: number) => {
    const d = new Date(scheduleDate)
    d.setDate(d.getDate() + offset)
    setScheduleDate(d)
  }

  const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

  const stats = useMemo(() => {
    let totalSlots = 0, bookedSlots = 0, holdSlots = 0
    branchCourts.forEach(c => {
      const slots = scheduleMap[c.id] || {}
      Object.values(slots).forEach(v => {
        totalSlots++
        if (v.status === "booked") bookedSlots++
        if (v.status === "hold") holdSlots++
      })
    })
    return { totalSlots, bookedSlots, holdSlots, freeSlots: totalSlots - bookedSlots - holdSlots }
  }, [branchCourts, scheduleMap])

  const resetSelection = useCallback(() => {
    setIsSelecting(false)
    setSelectionStart(null)
    setSelectionEnd(null)
  }, [])

  const getRangeSlots = useCallback((start: { courtId: number; time: string }, end: { courtId: number; time: string }) => {
    if (start.courtId !== end.courtId) return [] as string[]
    const startIdx = timeSlots.indexOf(start.time)
    const endIdx = timeSlots.indexOf(end.time)
    if (startIdx < 0 || endIdx < 0) return [] as string[]
    const minIdx = Math.min(startIdx, endIdx)
    const maxIdx = Math.max(startIdx, endIdx)
    return timeSlots.slice(minIdx, maxIdx + 1)
  }, [timeSlots])

  const isSlotBookable = useCallback((courtId: number, time: string) => {
    const cell = scheduleMap[courtId]?.[time]
    const isUnavailable = cell?.status === "booked" || cell?.status === "hold"
    return !isUnavailable && !isSlotPast(scheduleDate, time)
  }, [scheduleMap, scheduleDate])

  const selectionPreview = useMemo(() => {
    if (!selectionStart || !selectionEnd || selectionStart.courtId !== selectionEnd.courtId) {
      return { courtId: null as number | null, slots: [] as string[] }
    }
    const slots = getRangeSlots(selectionStart, selectionEnd)
    if (slots.length === 0) return { courtId: null as number | null, slots: [] as string[] }
    if (!slots.every((slot) => isSlotBookable(selectionStart.courtId, slot))) {
      return { courtId: null as number | null, slots: [] as string[] }
    }
    return { courtId: selectionStart.courtId, slots }
  }, [selectionStart, selectionEnd, getRangeSlots, isSlotBookable])

  const selectedSlotSet = useMemo(() => new Set(selectionPreview.slots), [selectionPreview.slots])

  const openQuickBookDialog = useCallback((court: CourtItem, startTime: string, durationHours: number) => {
    const endH = parseInt(startTime.split(":")[0]) + durationHours
    const endTimeStr = `${endH.toString().padStart(2, '0')}:00`
    const totalPrice = court.price * durationHours
    setQuickBookSlot({
      courtId: court.id,
      courtName: court.name,
      time: startTime,
      timeEnd: endTimeStr,
      price: court.price,
      durationHours,
      totalPrice,
    })
    setQbName("")
    setQbPhone("")
    setQbPayment("cash")
    setQbNote("")
    setQbRecurring(false)
    setQbWeeks("4")
    setQbSelectedUser(null)
    setQbUserSearch("")
    setQbUserResults([])
    setQuickBookOpen(true)
  }, [])

  const finalizeSelection = useCallback(() => {
    if (!isSelecting || !selectionStart) return
    const end = selectionEnd ?? selectionStart
    const slots = getRangeSlots(selectionStart, end)
    const selectedCourt = branchCourts.find((court) => court.id === selectionStart.courtId)
    if (!selectedCourt || slots.length === 0) {
      resetSelection()
      return
    }
    if (!slots.every((slot) => isSlotBookable(selectionStart.courtId, slot))) {
      resetSelection()
      return
    }
    openQuickBookDialog(selectedCourt, slots[0], slots.length)
    resetSelection()
  }, [isSelecting, selectionStart, selectionEnd, getRangeSlots, branchCourts, isSlotBookable, openQuickBookDialog, resetSelection])

  useEffect(() => {
    if (!isSelecting) return
    const handleWindowMouseUp = () => finalizeSelection()
    window.addEventListener("mouseup", handleWindowMouseUp)
    return () => window.removeEventListener("mouseup", handleWindowMouseUp)
  }, [isSelecting, finalizeSelection])

  useEffect(() => {
    resetSelection()
  }, [selectedBranch, scheduleDate, resetSelection])

  // Submit quick-book
  const handleQuickBook = async () => {
    if (!quickBookSlot || !qbName.trim() || !qbPhone.trim()) return
    setQbSaving(true)
    try {
      const dateStr = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getDate()).padStart(2, '0')}`
      if (qbRecurring) {
        await bookingApi.createRecurring({
          court_id: quickBookSlot.courtId,
          time_start: quickBookSlot.time,
          time_end: quickBookSlot.timeEnd,
          start_date: dateStr,
          weeks: parseInt(qbWeeks),
          customer_name: qbName.trim(),
          customer_phone: qbPhone.trim(),
          amount: quickBookSlot.totalPrice,
          payment_method: qbPayment,
          note: qbNote.trim(),
          ...(qbSelectedUser ? { user_id: qbSelectedUser.id } : {}),
        })
      } else {
        await bookingApi.create({
          court_id: quickBookSlot.courtId,
          booking_date: dateStr,
          time_start: quickBookSlot.time,
          time_end: quickBookSlot.timeEnd,
          slots: 1,
          customer_name: qbName.trim(),
          customer_phone: qbPhone.trim(),
          amount: quickBookSlot.totalPrice,
          payment_method: qbPayment,
          note: qbNote.trim(),
          ...(qbSelectedUser ? { user_id: qbSelectedUser.id } : {}),
        })
      }
      setQuickBookOpen(false)
      onRefresh()
    } catch {
      alert("Lỗi khi đặt lịch. Vui lòng thử lại.")
    } finally {
      setQbSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branches.map(b => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[200px] justify-center">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {dayNames[scheduleDate.getDay()]}, {String(scheduleDate.getDate()).padStart(2,'0')}/{String(scheduleDate.getMonth()+1).padStart(2,'0')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={scheduleDate} onSelect={d => d && setScheduleDate(d)} /></PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-xs ml-1" onClick={() => setScheduleDate(new Date())}>Hôm nay</Button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="font-medium text-muted-foreground">
            Đặt: <strong className="text-foreground">{stats.bookedSlots}</strong> / {stats.totalSlots}
            {stats.holdSlots > 0 && <> · Giữ: <strong className="text-amber-600">{stats.holdSlots}</strong></>}
          </span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-100 border border-green-300" /> Trống</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary/20 border border-primary/40" /> Đã đặt</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-100 border border-amber-300" /> Giữ chỗ</span>
        </div>
      </div>

      {/* Schedule Grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2.5 text-left font-medium w-[100px] border-r">Giờ</th>
                {branchCourts.map(c => (
                  <th key={c.id} className="px-2 py-2.5 text-center font-medium min-w-[130px]">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-semibold">{c.name.split(' - ')[0]}</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[9px] px-1.5 h-4">
                          {c.type === "premium" ? "Premium" : c.type === "vip" ? "VIP" : "Standard"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{formatVND(c.price)}/h</span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((time, ti) => {
                const endH = parseInt(time.split(":")[0]) + 1
                const endTimeStr = `${endH.toString().padStart(2, '0')}:00`
                const past = isSlotPast(scheduleDate, time)
                return (
                  <tr key={time} className={cn("border-b hover:bg-muted/30 transition-colors", ti % 2 === 0 && "bg-muted/10", past && "opacity-60")}>
                    <td className={cn("sticky left-0 z-10 bg-background px-3 py-1.5 font-mono text-muted-foreground whitespace-nowrap border-r", past && "line-through")}>
                      {time} - {endTimeStr}
                    </td>
                    {branchCourts.map(c => {
                      const cell = scheduleMap[c.id]?.[time]
                      const isBooked = cell?.status === "booked"
                      const isHold = cell?.status === "hold"
                      const isEmpty = !isBooked && !isHold
                      const bookedByLabel = cell?.bookedBy?.trim() || cell?.phone?.trim() || "Đã đặt"
                      const placedByLabel = cell?.placedBy?.trim() || ""
                      const placedByRole = cell?.placedByRole || ""
                      const canBook = isEmpty && !past
                      const isSelected = selectionPreview.courtId === c.id && selectedSlotSet.has(time)
                      return (
                        <td key={c.id} className="px-1 py-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  onMouseDown={canBook ? (e) => {
                                    e.preventDefault()
                                    setIsSelecting(true)
                                    setSelectionStart({ courtId: c.id, time })
                                    setSelectionEnd({ courtId: c.id, time })
                                  } : undefined}
                                  onMouseEnter={canBook && isSelecting && selectionStart?.courtId === c.id ? () => {
                                    setSelectionEnd({ courtId: c.id, time })
                                  } : undefined}
                                  onMouseUp={canBook && isSelecting ? () => finalizeSelection() : undefined}
                                  className={cn(
                                    "rounded-md px-2 py-1.5 text-center transition-colors min-h-[32px] flex items-center justify-center select-none",
                                    isEmpty && !past && !isSelected && "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:border-green-800 cursor-pointer hover:bg-green-100 hover:border-green-400 hover:shadow-sm",
                                    isEmpty && past && "bg-court-past text-slate-400 border border-slate-200",
                                    isSelected && "bg-secondary/20 text-secondary border border-secondary/40 ring-1 ring-secondary/40 cursor-pointer",
                                    isBooked && "bg-primary/10 text-primary border border-primary/30 font-medium",
                                    isHold && "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800",
                                  )}>
                                  {isBooked && <span className="truncate max-w-[110px]">{bookedByLabel}</span>}
                                  {isHold && <span className="truncate max-w-[110px]">Giữ chỗ</span>}
                                  {isEmpty && past && <Lock className="h-3 w-3" />}
                                  {isEmpty && !past && !isSelected && <Plus className="h-3 w-3 opacity-40" />}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isBooked ? (
                                  <div className="text-xs">
                                    <p className="font-semibold">{bookedByLabel}</p>
                                    <p className={cn(
                                      "text-muted-foreground",
                                      placedByRole === "admin" && "text-blue-600",
                                      placedByRole === "employee" && "text-amber-600"
                                    )}>Ai đặt: {placedByLabel || "Khách"}</p>
                                    {cell.phone && <p className="text-muted-foreground">SĐT: {cell.phone}</p>}
                                    {(cell.bookingCode || cell.bookingId) && <p className="text-muted-foreground">Mã: {formatBookingReference(cell.bookingCode || cell.bookingId)}</p>}
                                    <p className="text-muted-foreground">{time} - {endTimeStr}</p>
                                  </div>
                                ) : isHold ? (
                                  <p>Đang giữ chỗ</p>
                                ) : isSelected && isSelecting ? (
                                  <p>Thả chuột để đặt {selectionPreview.slots.length} giờ</p>
                                ) : past ? (
                                  <p>Đã qua giờ</p>
                                ) : (
                                  <p>Kéo chuột để bôi đen đặt sân</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Quick-Book Dialog */}
      <Dialog open={quickBookOpen} onOpenChange={setQuickBookOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Đặt lịch nhanh
            </DialogTitle>
          </DialogHeader>
          {quickBookSlot && (
            <div className="space-y-4">
              {/* Slot info */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sân:</span>
                  <span className="font-semibold">{quickBookSlot.courtName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ngày:</span>
                  <span className="font-medium">{dayNames[scheduleDate.getDay()]}, {String(scheduleDate.getDate()).padStart(2,'0')}/{String(scheduleDate.getMonth()+1).padStart(2,'0')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Giờ:</span>
                  <span className="font-medium">{quickBookSlot.time} - {quickBookSlot.timeEnd}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Thời lượng:</span>
                  <span className="font-medium">{quickBookSlot.durationHours} giờ</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Giá:</span>
                  <span className="font-semibold text-primary">{formatVND(quickBookSlot.totalPrice)}</span>
                </div>
              </div>

              {/* Account picker */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Chọn tài khoản (tuỳ chọn)
                </Label>
                {qbSelectedUser ? (
                  <div className="flex items-center justify-between rounded-lg border bg-primary/5 p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                        {qbSelectedUser.fullName?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{qbSelectedUser.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">{qbSelectedUser.phone} · {qbSelectedUser.email}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => {
                      setQbSelectedUser(null)
                      setQbName("")
                      setQbPhone("")
                      setQbUserPickerOpen(false)
                    }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Tìm tên, SĐT hoặc email..."
                      className="pl-8 h-9 text-sm"
                      value={qbUserSearch}
                      onChange={e => setQbUserSearch(e.target.value)}
                      onFocus={() => setQbUserPickerOpen(true)}
                      onClick={() => setQbUserPickerOpen(true)}
                    />
                    {qbUserLoading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    {qbUserPickerOpen && (qbUserResults.length > 0 || (!qbUserLoading && qbUserSearch.trim())) && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border bg-popover shadow-lg max-h-[200px] overflow-y-auto">
                        {qbUserResults.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Khong tim thay tai khoan</div>
                        ) : qbUserResults.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2 border-b last:border-b-0 transition-colors"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setQbSelectedUser(u)
                              setQbName(u.fullName || "")
                              setQbPhone(u.phone || "")
                              setQbUserSearch("")
                              setQbUserResults([])
                              setQbUserPickerOpen(false)
                            }}
                          >
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                              {u.fullName?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{u.fullName}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{u.phone}{u.email ? ` · ${u.email}` : ""}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Customer info */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tên khách hàng *</Label>
                  <Input placeholder="Nhập tên khách hàng" value={qbName} onChange={e => setQbName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Số điện thoại *</Label>
                  <Input placeholder="0xxx xxx xxx" value={qbPhone} onChange={e => setQbPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Thanh toán</Label>
                  <Select value={qbPayment} onValueChange={setQbPayment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Tiền mặt</SelectItem>
                      <SelectItem value="transfer">Chuyển khoản</SelectItem>
                      <SelectItem value="momo">MoMo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Ghi chú</Label>
                  <Textarea placeholder="Ghi chú thêm..." value={qbNote} onChange={e => setQbNote(e.target.value)} className="h-16 resize-none" />
                </div>
              </div>

              {/* Recurring toggle */}
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Đặt lịch cố định</p>
                      <p className="text-xs text-muted-foreground">Lặp lại mỗi {dayNames[scheduleDate.getDay()]} hàng tuần</p>
                    </div>
                  </div>
                  <Switch checked={qbRecurring} onCheckedChange={setQbRecurring} />
                </div>
                {qbRecurring && (
                  <div className="space-y-2 pt-1 border-t">
                    <Label className="text-xs font-medium">Số tuần</Label>
                    <Select value={qbWeeks} onValueChange={setQbWeeks}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4 tuần (1 tháng)</SelectItem>
                        <SelectItem value="8">8 tuần (2 tháng)</SelectItem>
                        <SelectItem value="12">12 tuần (3 tháng)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Sẽ tạo {qbWeeks} booking vào {dayNames[scheduleDate.getDay()]} từ {quickBookSlot.time} - {quickBookSlot.timeEnd}.
                      Tổng: <strong className="text-foreground">{formatVND(quickBookSlot.totalPrice * parseInt(qbWeeks))}</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setQuickBookOpen(false)} disabled={qbSaving}>Huỷ</Button>
            <Button onClick={handleQuickBook} disabled={qbSaving || !qbName.trim() || !qbPhone.trim()}>
              {qbSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {qbRecurring ? `Đặt ${qbWeeks} tuần` : "Đặt lịch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Court usage cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {branchCourts.map(c => {
          const slots = scheduleMap[c.id] || {}
          const total = Object.keys(slots).length
          const booked = Object.values(slots).filter(v => v.status === "booked").length
          const pct = total > 0 ? Math.round((booked / total) * 100) : 0
          return (
            <Card key={c.id} className="hover:-translate-y-0.5 transition-all">
              <CardContent className="p-3">
                <p className="text-sm font-semibold truncate">{c.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{booked}/{total} slot</span>
                  <Badge variant={pct > 80 ? "destructive" : pct > 50 ? "default" : "secondary"} className="text-[10px]">
                    {pct}%
                  </Badge>
                </div>
                <div className="h-1.5 rounded-full bg-muted mt-2">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function EmployeeBookings() {
  const { user } = useAuth()

  // Data
  const [bookings, setBookings] = useState<BookingHistoryEntry[]>([])
  const [courtBookings, setCourtBookings] = useState<CourtBookingEntry[]>([])
  const [allCourts, setAllCourts] = useState<CourtItem[]>([])
  const [branches, setBranches] = useState<BranchItem[]>([])
  const [employeeBranch, setEmployeeBranch] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // UI state
  const [activeTab, setActiveTab] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "schedule">("list")
  const [search, setSearch] = useState("")
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [sortField, setSortField] = useState<"date" | "amount" | "createdAt">("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [editBooking, setEditBooking] = useState<BookingHistoryEntry | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [checkinWarning, setCheckinWarning] = useState<CheckinWarningState | null>(null)
  const [completionNotices, setCompletionNotices] = useState<CompletionNotice[]>([])
  const autoCompletedRef = useRef<Record<string, boolean>>({})

  const enqueueCompletionNotice = useCallback((notice: CompletionNotice) => {
    setCompletionNotices((current) =>
      current.some((item) => item.bookingId === notice.bookingId) ? current : [...current, notice],
    )
  }, [])

  useEffect(() => {
    const savedTab = consumeActiveTabAfterReload()
    if (savedTab) setActiveTab(savedTab)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // Load data from API
  useEffect(() => {
    const init = async () => {
      try {
        const [brRes, cRes] = await Promise.all([branchApi.getAll(), courtApi.getAll()])
        const branchList: BranchItem[] = brRes.map((b: any) => ({ id: b.id, name: b.name, address: b.address }))
        const courtList: CourtItem[] = cRes.map((c: any) => ({ id: c.id, name: c.name, branch: c.branchName || c.branch, branchId: c.branchId, type: c.type, price: c.price, indoor: c.indoor }))

        // Determine employee's branch from warehouse
        let empBranch: string | null = null
        if (user?.warehouse) {
          const area = user.warehouse.replace("Kho ", "")
          const found = branchList.find(b => b.name.includes(area))
          if (found) empBranch = found.name
        }
        setEmployeeBranch(empBranch)

        // Filter branches/courts to employee's branch
        if (empBranch) {
          const myBranch = branchList.filter(b => b.name === empBranch)
          setBranches(myBranch)
          setAllCourts(courtList.filter(c => c.branch === empBranch))
        } else {
          setBranches(branchList)
          setAllCourts(courtList)
        }
      } catch {}
      await refreshData()
      setHydrated(true)
    }
    init()
  }, [user?.warehouse])

  const refreshData = useCallback(async () => {
    try {
      const res = await bookingApi.getAll({ limit: 500 })
      let bks: BookingHistoryEntry[] = (res.bookings || []).map(apiToBooking)
      // Filter to employee's branch
      const branchName = employeeBranch
      if (branchName) {
        bks = bks.filter(b => b.branch.includes(branchName))
      }
      setBookings(bks)
      setCourtBookings(bookingsToSlots(bks))
    } catch {}
  }, [employeeBranch])

  // Re-fetch when employeeBranch is determined
  useEffect(() => {
    if (employeeBranch) {
      refreshData()
    }
  }, [employeeBranch, refreshData])

  useEffect(() => {
    if (!hydrated) return
    const refreshTimer = window.setInterval(refreshData, 60_000)
    return () => window.clearInterval(refreshTimer)
  }, [hydrated, refreshData])

  // Status change
  const handleStatusChange = useCallback(async (id: string, newStatus: string) => {
    try {
      const res = await bookingApi.updateStatus(id, newStatus)
      if (!res.success) {
        throw new Error(res.error || "Loi cap nhat trang thai")
      }

      setBookings((current) =>
        current.map((booking) =>
          booking.id === id
            ? res.booking
              ? apiToBooking(res.booking)
              : { ...booking, status: newStatus }
            : booking,
        ),
      )

      if (newStatus === "confirmed") {
        setActiveTab("confirmed")
        setExpandedRow(null)
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(activeTabAfterReloadKey, "confirmed")
          window.location.reload()
        }
        return
      }

      await refreshData()
    } catch { alert("Lỗi cập nhật trạng thái") }
  }, [refreshData])

  const handleBookingAction = useCallback(async (booking: BookingHistoryEntry, newStatus: string) => {
    if (newStatus === "playing") {
      const timing = getBookingTimingState(booking, new Date())
      if (timing && !timing.canCheckin) {
        setCheckinWarning({
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          court: booking.court,
          availableAt: formatTimeOnly(timing.checkinOpensAt),
          minutesUntilCheckin: timing.minutesUntilCheckin,
        })
        return
      }
    }

    await handleStatusChange(booking.id, newStatus)
  }, [handleStatusChange])

  useEffect(() => {
    const playingBookings = bookings.filter((booking) => booking.status === "playing")
    playingBookings.forEach((booking) => {
      const timing = getBookingTimingState(booking, now)
      if (!timing || !timing.isEnded || autoCompletedRef.current[booking.id]) return

      autoCompletedRef.current[booking.id] = true
      enqueueCompletionNotice({
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        court: booking.court,
        endTime: formatTimeOnly(timing.endAt),
      })

      void (async () => {
        try {
          await bookingApi.updateStatus(booking.id, "completed")
        } finally {
          await refreshData()
        }
      })()
    })
  }, [bookings, now, enqueueCompletionNotice, refreshData])

  // Save booking (create or edit)
  const handleSaveBooking = useCallback(async (booking: BookingHistoryEntry, isEdit: boolean) => {
    try {
      if (isEdit) {
        await bookingApi.updateStatus(booking.id, booking.status)
      } else {
        const court = allCourts.find(c => c.name === booking.court)
        if (!court) return
        const timeParts = booking.time.split(" - ")
        await bookingApi.create({
          court_id: court.id,
          booking_date: booking.date,
          time_start: timeParts[0]?.trim() || "",
          time_end: timeParts[1]?.trim() || "",
          slots: booking.people,
          customer_name: booking.customer.name,
          customer_phone: booking.customer.phone,
          amount: booking.amount,
          payment_method: booking.paymentMethod,
          note: booking.note || "",
        })
      }
      await refreshData()
    } catch { alert("Lỗi lưu booking") }
  }, [allCourts, refreshData])

  // Open edit dialog
  const handleOpenEdit = useCallback((booking: BookingHistoryEntry) => {
    setEditBooking(booking)
    setFormOpen(true)
  }, [])

  // Open create dialog
  const handleOpenCreate = useCallback(() => {
    setEditBooking(null)
    setFormOpen(true)
  }, [])

  /* ─── Computed ─── */

  const kpis = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    const todayBookings = bookings.filter(b => b.date === today || b.createdAt?.startsWith(today))
    const totalRevenue = bookings.filter(b => b.status !== "cancelled").reduce((sum, b) => sum + b.amount, 0)
    const pendingCount = bookings.filter(b => b.status === "pending").length
    const playingCount = bookings.filter(b => b.status === "playing").length
    return { total: bookings.length, totalRevenue, todayCount: todayBookings.length, pendingCount, playingCount }
  }, [bookings])

  const statusTabs = useMemo(() => [
    { value: "all", label: "Tất cả", count: bookings.length },
    { value: "hold", label: "Giữ chỗ", count: bookings.filter(b => b.status === "hold").length },
    { value: "pending", label: "Chờ xác nhận", count: bookings.filter(b => b.status === "pending").length },
    { value: "confirmed", label: "Đã xác nhận", count: bookings.filter(b => getBookingDisplayStatus(b, now) === "confirmed").length },
    { value: MISSED_CHECKIN_STATUS, label: "Chưa check-in", count: bookings.filter(b => getBookingDisplayStatus(b, now) === MISSED_CHECKIN_STATUS).length },
    { value: "playing", label: "Đang chơi", count: bookings.filter(b => b.status === "playing").length },
    { value: "completed", label: "Hoàn thành", count: bookings.filter(b => b.status === "completed").length },
    { value: "cancelled", label: "Đã huỷ", count: bookings.filter(b => b.status === "cancelled").length },
  ], [bookings, now])

  const filtered = useMemo(() => {
    let result = [...bookings]

    if (activeTab !== "all") {
      result = result.filter(b => getBookingDisplayStatus(b, now) === activeTab)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(b =>
        b.id.toLowerCase().includes(q) ||
        b.bookingCode.toLowerCase().includes(q) ||
        b.customer.name.toLowerCase().includes(q) ||
        b.customer.phone.includes(q) ||
        b.court.toLowerCase().includes(q)
      )
    }

    if (dateFilter) {
      const filterStr = `${dateFilter.getFullYear()}-${(dateFilter.getMonth() + 1).toString().padStart(2, '0')}-${dateFilter.getDate().toString().padStart(2, '0')}`
      result = result.filter(b => b.date === filterStr || b.date.includes(`${String(dateFilter.getDate()).padStart(2,'0')}/${String(dateFilter.getMonth()+1).padStart(2,'0')}`))
    }

    result.sort((a, b) => {
      const cmp =
        sortField === "amount"
          ? a.amount - b.amount
          : sortField === "date"
            ? a.date.localeCompare(b.date)
            : (a.createdAt || "").localeCompare(b.createdAt || "")
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  }, [bookings, activeTab, search, dateFilter, sortField, sortDir, now])

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("desc") }
  }

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Quản lý đặt sân</h1>
          <p className="text-sm text-muted-foreground">
            {employeeBranch ? `Chi nhánh: ${employeeBranch}` : "Quản lý booking tại chi nhánh"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-1" /> Làm mới
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" /> Đặt sân
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="hover:-translate-y-0.5 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-lg bg-primary/10 text-primary"><CalendarIcon className="h-5 w-5" /></span>
              <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5"><TrendingUp className="h-3 w-3" /> Hôm nay: {kpis.todayCount}</span>
            </div>
            <p className="font-serif text-2xl font-extrabold mt-3">{kpis.total}</p>
            <p className="text-sm text-muted-foreground">Tổng booking</p>
          </CardContent>
        </Card>
        <Card className="hover:-translate-y-0.5 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-lg bg-green-100 text-green-600"><DollarSign className="h-5 w-5" /></span>
            </div>
            <p className="font-serif text-2xl font-extrabold mt-3">{formatVND(kpis.totalRevenue)}</p>
            <p className="text-sm text-muted-foreground">Doanh thu sân</p>
          </CardContent>
        </Card>
        <Card className={cn("hover:-translate-y-0.5 transition-all", kpis.pendingCount > 0 && "border-amber-200 bg-amber-50")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className={cn("p-2 rounded-lg", kpis.pendingCount > 0 ? "bg-amber-100 text-amber-600" : "bg-blue-50 text-blue-600")}><Clock className="h-5 w-5" /></span>
              {kpis.pendingCount > 0 && <AlertTriangle className="h-4 w-4 text-amber-500" />}
            </div>
            <p className="font-serif text-2xl font-extrabold mt-3">{kpis.pendingCount}</p>
            <p className="text-sm text-muted-foreground">Chờ xác nhận</p>
          </CardContent>
        </Card>
        <Card className={cn("hover:-translate-y-0.5 transition-all", kpis.playingCount > 0 && "border-green-200 bg-green-50")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-lg bg-green-100 text-green-600"><Play className="h-5 w-5" /></span>
            </div>
            <p className="font-serif text-2xl font-extrabold mt-3">{kpis.playingCount}</p>
            <p className="text-sm text-muted-foreground">Đang chơi</p>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="gap-1.5" onClick={() => setViewMode("list")}>
            <CalendarDays className="h-4 w-4" /> Danh sách
          </Button>
          <Button variant={viewMode === "schedule" ? "default" : "ghost"} size="sm" className="gap-1.5" onClick={() => setViewMode("schedule")}>
            <Building2 className="h-4 w-4" /> Lịch sân
          </Button>
        </div>
      </div>

      {/* Schedule View */}
      {viewMode === "schedule" && (
        <ScheduleView
          allCourts={allCourts}
          courtBookings={courtBookings}
          branches={branches}
          onRefresh={refreshData}
        />
      )}

      {/* List View */}
      {viewMode === "list" && (
        <>
          {/* Status Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="bg-muted/50 h-10">
              {statusTabs.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs gap-1.5 data-[state=active]:text-primary">
                  {tab.label}
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{tab.count}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm mã booking, tên, SĐT..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
              {search && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-1.5", dateFilter && "bg-primary/10 text-primary border-primary/30")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFilter ? `${String(dateFilter.getDate()).padStart(2,'0')}/${String(dateFilter.getMonth()+1).padStart(2,'0')}` : "Lọc ngày"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFilter} onSelect={setDateFilter} />
                {dateFilter && (
                  <div className="p-2 border-t">
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setDateFilter(undefined)}>Bỏ lọc ngày</Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <CalendarIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="font-serif font-bold text-lg">Chưa có booking nào</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  {search || dateFilter
                    ? "Không tìm thấy booking phù hợp với bộ lọc. Thử thay đổi điều kiện tìm kiếm."
                    : "Khi khách hàng đặt sân, booking sẽ xuất hiện ở đây. Hoặc bạn có thể đặt sân trực tiếp."}
                </p>
                {!search && !dateFilter && (
                  <Button className="mt-4" onClick={handleOpenCreate}>
                    <Plus className="h-4 w-4 mr-2" /> Đặt sân đầu tiên
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Table */}
          {filtered.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Mã booking</TableHead>
                      <TableHead className="text-xs">Khách hàng</TableHead>
                      <TableHead className="text-xs">Ai đặt</TableHead>
                      <TableHead className="text-xs">Sân</TableHead>
                      <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("date")}>
                        <span className="flex items-center gap-1">Ngày <ArrowUpDown className="h-3 w-3" /></span>
                      </TableHead>
                      <TableHead className="text-xs">Giờ</TableHead>
                      <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("amount")}>
                        <span className="flex items-center gap-1">Tiền <ArrowUpDown className="h-3 w-3" /></span>
                      </TableHead>
                      <TableHead className="text-xs">Thanh toán</TableHead>
                      <TableHead className="text-xs">Trạng thái</TableHead>
                      <TableHead className="text-xs w-[120px]">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((booking, idx) => {
                      const timing = getBookingTimingState(booking, now)
                      const isMissedCheckin = isMissedCheckinBooking(booking, timing)
                      const displayStatus = isMissedCheckin ? MISSED_CHECKIN_STATUS : booking.status
                      const isCheckinBlocked =
                        booking.status === "confirmed" &&
                        !!timing &&
                        !timing.canCheckin &&
                        !timing.isEnded

                      return (
                      <Fragment key={booking.id}>
                        <TableRow
                          className={cn(
                            "cursor-pointer hover:bg-muted/50 transition-colors",
                            idx % 2 !== 0 && "bg-muted/20",
                          )}
                          onClick={() => setExpandedRow(expandedRow === booking.id ? null : booking.id)}
                        >
                          <TableCell className="font-mono text-xs text-primary font-semibold">{booking.bookingCode}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                                {booking.customer.name.split(' ').pop()?.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{booking.customer.name}</p>
                                <p className="text-xs text-muted-foreground">{booking.customer.phone}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "text-xs font-medium",
                              booking.placedByRole === "admin" && "text-blue-600",
                              booking.placedByRole === "employee" && "text-amber-600"
                            )}>{booking.placedBy || ""}</span>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{booking.court}</p>
                          </TableCell>
                          <TableCell className="text-sm">{booking.date}</TableCell>
                          <TableCell className="text-sm">{booking.time}</TableCell>
                          <TableCell className="text-sm font-medium">{formatVND(booking.amount)}</TableCell>
                          <TableCell><PaymentBadge method={booking.paymentMethod} /></TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <BookingStatusBadge status={displayStatus} />
                              {isMissedCheckin && timing && (
                                <p className="text-[11px] font-semibold text-red-600">
                                  Đã qua giờ chơi, khách chưa check-in
                                </p>
                              )}
                              {booking.status === "confirmed" && isCheckinBlocked && timing && (
                                <p className="text-[11px] font-medium text-amber-600">
                                  Check-in sau {timing.minutesUntilCheckin} phút
                                </p>
                              )}
                              {booking.status === "playing" && timing && (
                                <p className={cn(
                                  "text-[11px] font-semibold tabular-nums",
                                  timing.isEnded ? "text-red-600" : "text-green-700"
                                )}>
                                  {timing.isEnded ? "Da het gio" : `Con ${formatCountdown(timing.remainingMs)}`}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                              {/* Quick status action */}
                              {statusFlow[booking.status] && !isMissedCheckin && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                          "h-7 w-7 hover:bg-green-50",
                                          isCheckinBlocked ? "text-amber-600" : "text-green-600"
                                        )}
                                        onClick={() => handleBookingAction(booking, statusFlow[booking.status])}
                                      >
                                        {booking.status === "hold" && <CheckCircle2 className="h-3.5 w-3.5" />}
                                        {booking.status === "pending" && <CheckCircle2 className="h-3.5 w-3.5" />}
                                        {booking.status === "confirmed" && (isCheckinBlocked ? <Lock className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />)}
                                        {booking.status === "playing" && <CheckCircle2 className="h-3.5 w-3.5" />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {booking.status === "confirmed" && isCheckinBlocked && timing
                                        ? `Chi duoc check-in som ${CHECKIN_EARLY_MINUTES} phut`
                                        : statusActionLabel[booking.status]}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {/* View detail */}
                              <Sheet>
                                <SheetTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                </SheetTrigger>
                                <BookingDetailSheet booking={booking} now={now} onStatusChange={handleBookingAction} />
                              </Sheet>
                              {/* Edit */}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(booking)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              {/* Expand toggle */}
                              <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted" onClick={(e) => { e.stopPropagation(); setExpandedRow(expandedRow === booking.id ? null : booking.id) }}>
                                {expandedRow === booking.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedRow === booking.id && (
                          <TableRow key={`${booking.id}-expanded`}>
                            <TableCell colSpan={10} className="bg-muted/30 p-4">
                              <div className="flex items-center gap-8">
                                <div className="h-24 w-24 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                                  <QrCode className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div className="flex-1 grid grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Số người</p>
                                    <p className="text-sm font-medium">{booking.people} người</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Email</p>
                                    <p className="text-sm font-medium">{booking.customer.email || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Ngày tạo</p>
                                    <p className="text-sm font-medium">{booking.createdAt ? formatDate(booking.createdAt) : "—"}</p>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )})}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>Hiển thị {filtered.length} / {bookings.length} booking</span>
              <span>Doanh thu (đã lọc): <strong className="text-foreground">{formatVND(filtered.filter(b => b.status !== "cancelled").reduce((s, b) => s + b.amount, 0))}</strong></span>
            </div>
          )}
        </>
      )}

      <Dialog open={!!checkinWarning} onOpenChange={(open) => !open && setCheckinWarning(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Chưa đến giờ check-in</DialogTitle>
          </DialogHeader>
          {checkinWarning && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">{checkinWarning.bookingCode}</p>
                    <p className="mt-1 text-amber-800">{checkinWarning.court}</p>
                    <p className="mt-2 text-amber-700">
                      Chỉ được check-in sớm tối đa {CHECKIN_EARLY_MINUTES} phút.
                    </p>
                    <p className="mt-1 text-amber-700">
                      Có thể check-in từ {checkinWarning.availableAt}. Còn {checkinWarning.minutesUntilCheckin} phút.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCheckinWarning(null)}>Đã hiểu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completionNotices.length > 0} onOpenChange={(open) => {
        if (!open) {
          setCompletionNotices((current) => current.slice(1))
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Booking hoàn thành</DialogTitle>
          </DialogHeader>
          {completionNotices[0] && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">{completionNotices[0].bookingCode}</p>
                    <p className="mt-1 text-green-800">{completionNotices[0].court}</p>
                    <p className="mt-2 text-green-700">
                      Sân đã hết giờ lúc {completionNotices[0].endTime} và booking đã được chuyển sang hoàn thành.
                    </p>
                    <p className="mt-1 text-green-700">Nhân viên đến dọn sân.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCompletionNotices((current) => current.slice(1))}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking Form Dialog */}
      <BookingFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editBooking={editBooking}
        courts={allCourts}
        branches={branches}
        onSave={handleSaveBooking}
      />
    </div>
  )
}
