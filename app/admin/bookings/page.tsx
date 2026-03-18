"use client"

import { useState, useCallback, useEffect, useMemo, Fragment } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BookingStatusBadge, PaymentBadge } from "@/components/shared"
import { formatVND, generateTimeSlots } from "@/lib/utils"
import { branchApi, courtApi, bookingApi, ApiBooking, ApiBranch, ApiCourt } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  Search, Download, Plus, Eye, Edit2, Trash2, ChevronDown, ChevronUp,
  Calendar as CalendarIcon, Clock, Users, MapPin, Phone, Mail, CheckCircle2,
  Play, XCircle, QrCode, DollarSign, TrendingUp, AlertTriangle, LayoutList,
  CalendarDays, RefreshCw, ArrowUpDown,
  ChevronLeft, ChevronRight, X, Loader2, Printer, Building2
} from "lucide-react"

/* ─── Adapter types ─── */

interface BookingHistoryEntry {
  id: string; court: string; branch: string; date: string; day: string
  time: string; people: number; amount: number; status: string
  paymentMethod: string; customer: { name: string; phone: string; email: string }
  createdAt: string; courtId?: number; note?: string
}

interface CourtBookingEntry {
  courtId: number; dateLabel: string; time: string
  status: 'booked' | 'hold'; bookedBy?: string; bookingId?: string; phone?: string
}

interface BranchItem { id: number; name: string; address?: string }
interface CourtItem { id: number; name: string; branch: string; branchId: number; type: string; price: number; indoor?: boolean }

function apiToBooking(b: ApiBooking): BookingHistoryEntry {
  return {
    id: b.id, court: b.courtName, branch: b.branchName,
    date: b.bookingDate, day: "",
    time: `${b.timeStart} - ${b.timeEnd}`,
    people: b.slots || 2, amount: b.amount, status: b.status,
    paymentMethod: b.paymentMethod || "Cash",
    customer: { name: b.customerName, phone: b.customerPhone, email: "" },
    createdAt: b.createdAt, courtId: b.courtId, note: b.note || "",
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
    const dateLabel = `${d.getDate()}/${d.getMonth() + 1}`
    for (let h = start; h < end; h++) {
      slots.push({
        courtId: b.courtId, dateLabel,
        time: `${h.toString().padStart(2, '0')}:00`,
        status: "booked", bookedBy: b.customer.name,
        bookingId: b.id, phone: b.customer.phone,
      })
    }
  }
  return slots
}

/* ─── Helpers ─── */

function generateBookingId() {
  const now = new Date()
  const dateStr = `${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`
  const seq = Math.floor(Math.random() * 999) + 1
  return `BH-${dateStr}-${seq.toString().padStart(3, '0')}`
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch { return dateStr }
}

function formatDateShort(date: Date) {
  return `${date.getDate()}/${date.getMonth() + 1}`
}

const statusFlow: Record<string, string> = {
  pending: "confirmed",
  confirmed: "playing",
  playing: "completed",
}

const statusActionLabel: Record<string, string> = {
  pending: "Xác nhận",
  confirmed: "Check-in",
  playing: "Hoàn thành",
}

const timelineSteps = [
  { label: "Tạo", icon: <Plus className="h-3 w-3" /> },
  { label: "Xác nhận", icon: <CheckCircle2 className="h-3 w-3" /> },
  { label: "Check-in", icon: <Play className="h-3 w-3" /> },
  { label: "Hoàn thành", icon: <CheckCircle2 className="h-3 w-3" /> },
]

function getTimelineStep(status: string) {
  switch (status) {
    case "pending": return 0
    case "confirmed": return 1
    case "playing": return 2
    case "completed": return 3
    case "cancelled": return -1
    default: return 0
  }
}

/* ─── Detail Sheet ─── */

function BookingDetailSheet({
  booking,
  onStatusChange,
  onEdit,
}: {
  booking: BookingHistoryEntry
  onStatusChange: (id: string, newStatus: string) => void
  onEdit: (booking: BookingHistoryEntry) => void
}) {
  const step = getTimelineStep(booking.status)

  return (
    <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
      <SheetHeader>
        <SheetTitle className="font-serif">Chi tiết booking</SheetTitle>
      </SheetHeader>

      <div className="mt-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sm text-primary font-semibold">{booking.id}</p>
            <p className="text-lg font-serif font-bold mt-1">{booking.court}</p>
          </div>
          <BookingStatusBadge status={booking.status} />
        </div>

        {/* Timeline */}
        {booking.status !== "cancelled" && (
          <div className="flex items-center gap-1">
            {timelineSteps.map((s, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-full shrink-0 transition-colors",
                  i <= step ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {s.icon}
                </div>
                {i < timelineSteps.length - 1 && (
                  <div className={cn(
                    "h-0.5 flex-1 mx-1 rounded-full",
                    i < step ? "bg-secondary" : "bg-muted"
                  )} />
                )}
              </div>
            ))}
          </div>
        )}
        {booking.status !== "cancelled" && (
          <div className="flex justify-between px-1">
            {timelineSteps.map((s, i) => (
              <span key={i} className={cn("text-[10px] text-center", i <= step ? "text-secondary font-medium" : "text-muted-foreground")}>
                {s.label}
              </span>
            ))}
          </div>
        )}

        {/* Booking Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Ngày</p>
                  <p className="text-sm font-medium">{booking.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Giờ</p>
                  <p className="text-sm font-medium">{booking.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Chi nhánh</p>
                  <p className="text-sm font-medium">{booking.branch}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Số người</p>
                  <p className="text-sm font-medium">{booking.people} người</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Thông tin khách hàng</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                {booking.customer.name.split(' ').pop()?.charAt(0)}
              </div>
              <div>
                <p className="font-medium">{booking.customer.name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{booking.customer.phone}</span>
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{booking.customer.email}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Thanh toán</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Phương thức</span>
              <PaymentBadge method={booking.paymentMethod} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Tổng tiền</span>
              <span className="font-serif text-lg font-bold text-primary">{formatVND(booking.amount)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Booking time */}
        <div className="text-xs text-muted-foreground">
          Ngày tạo: {booking.createdAt ? formatDate(booking.createdAt) : "—"}
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="h-32 w-32 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
            <QrCode className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {booking.status === "pending" && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground">Xác nhận</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-serif">Xác nhận booking?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Bạn có chắc muốn xác nhận booking <strong>{booking.id}</strong> cho khách <strong>{booking.customer.name}</strong>?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Huỷ</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onStatusChange(booking.id, "confirmed")} className="bg-secondary hover:bg-secondary/90">Xác nhận</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex-1">Từ chối</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-serif">Từ chối booking?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Bạn có chắc muốn từ chối booking <strong>{booking.id}</strong>? Hành động này không thể hoàn tác.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Quay lại</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onStatusChange(booking.id, "cancelled")} className="bg-red-600 hover:bg-red-700">Từ chối</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {booking.status === "confirmed" && (
            <Button className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground" onClick={() => onStatusChange(booking.id, "playing")}>Check-in</Button>
          )}
          {booking.status === "playing" && (
            <Button className="flex-1" onClick={() => onStatusChange(booking.id, "completed")}>Hoàn thành</Button>
          )}
        </div>
        {/* Edit / Print */}
        {booking.status !== "cancelled" && booking.status !== "completed" && (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onEdit(booking)}>
              <Edit2 className="h-4 w-4 mr-2" /> Sửa
            </Button>
            <Button variant="outline" className="flex-1">
              <Printer className="h-4 w-4 mr-2" /> In phiếu
            </Button>
          </div>
        )}
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
  const [paymentMethod, setPaymentMethod] = useState("MoMo")
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
      } else {
        setBranchId("")
        setCourtId("")
        setBookingDate(undefined)
        setStartTime("")
        setEndTime("")
        setPeople(2)
        setCustomerName("")
        setCustomerPhone("")
        setCustomerEmail("")
        setPaymentMethod("MoMo")
        setStatus("confirmed")
        setNote("")
        setErrors({})
      }
    }
  }, [open, editBooking, allCourts])

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
    }

    onSave(entry, isEdit)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {isEdit ? "Sửa booking" : "Tạo booking mới"}
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
                    {bookingDate ? formatDateShort(bookingDate) : "Chọn ngày"}
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
                  <SelectItem value="MoMo">MoMo</SelectItem>
                  <SelectItem value="VNPay">VNPay</SelectItem>
                  <SelectItem value="Bank transfer">Chuyển khoản</SelectItem>
                  <SelectItem value="Wallet">Ví BH</SelectItem>
                  <SelectItem value="Cash">Tiền mặt</SelectItem>
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
                  <SelectItem value="pending">Chờ xác nhận</SelectItem>
                  <SelectItem value="confirmed">Đã xác nhận</SelectItem>
                  <SelectItem value="playing">Đang chơi</SelectItem>
                  <SelectItem value="completed">Hoàn thành</SelectItem>
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
            {isEdit ? "Lưu thay đổi" : "Tạo booking"}
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
}: {
  allCourts: CourtItem[]
  courtBookings: CourtBookingEntry[]
  bookingHistory: BookingHistoryEntry[]
  branches: BranchItem[]
  onRefresh: () => void
}) {
  const [selectedBranch, setSelectedBranch] = useState(branches.length > 0 ? String(branches[0].id) : "")
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date())

  const branchCourts = useMemo(() => {
    return allCourts.filter(c => c.branchId === parseInt(selectedBranch))
  }, [selectedBranch, allCourts])

  const dateLabel = formatDateShort(scheduleDate)
  const timeSlots = generateTimeSlots()

  // Build map: courtId → time → booking info
  const scheduleMap = useMemo(() => {
    const map: Record<number, Record<string, { status: string; bookedBy?: string; bookingId?: string }>> = {}
    branchCourts.forEach(c => {
      map[c.id] = {}
      timeSlots.forEach(t => { map[c.id][t] = { status: "available" } })
    })
    courtBookings.forEach(b => {
      if (map[b.courtId] && b.dateLabel === dateLabel) {
        map[b.courtId][b.time] = { status: b.status, bookedBy: b.bookedBy, bookingId: b.bookingId }
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

  // Summary stats
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
                  {dayNames[scheduleDate.getDay()]}, {dateLabel}
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

        {/* Summary & Legend */}
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
                return (
                  <tr key={time} className={cn("border-b hover:bg-muted/30 transition-colors", ti % 2 === 0 && "bg-muted/10")}>
                    <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-mono text-muted-foreground whitespace-nowrap border-r">
                      {time} - {endTimeStr}
                    </td>
                    {branchCourts.map(c => {
                      const cell = scheduleMap[c.id]?.[time]
                      const isBooked = cell?.status === "booked"
                      const isHold = cell?.status === "hold"
                      const isEmpty = !isBooked && !isHold
                      return (
                        <td key={c.id} className="px-1 py-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={cn(
                                  "rounded-md px-2 py-1.5 text-center transition-colors min-h-[32px] flex items-center justify-center",
                                  isEmpty && "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:border-green-800",
                                  isBooked && "bg-primary/10 text-primary border border-primary/30 font-medium",
                                  isHold && "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                                )}>
                                  {isBooked && <span className="truncate max-w-[110px]">{cell.bookedBy || "Đã đặt"}</span>}
                                  {isHold && "Giữ chỗ"}
                                  {isEmpty && "—"}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isBooked ? (
                                  <div className="text-xs">
                                    <p className="font-semibold">{cell.bookedBy}</p>
                                    {cell.bookingId && <p className="text-muted-foreground">Mã: {cell.bookingId}</p>}
                                    <p className="text-muted-foreground">{time} - {endTimeStr}</p>
                                  </div>
                                ) : isHold ? (
                                  <p>Đang giữ chỗ</p>
                                ) : (
                                  <p>Trống — có thể đặt</p>
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

      {/* Branch court usage cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {branchCourts.map(c => {
          const slots = scheduleMap[c.id] || {}
          const total = Object.keys(slots).length
          const booked = Object.values(slots).filter(v => v.status === "booked").length
          const hold = Object.values(slots).filter(v => v.status === "hold").length
          const pct = total > 0 ? Math.round(((booked + hold) / total) * 100) : 0
          return (
            <Card key={c.id} className="hover:-translate-y-0.5 transition-all">
              <CardContent className="p-3">
                <p className="text-sm font-semibold truncate">{c.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{booked + hold}/{total} slot</span>
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

export default function AdminBookings() {
  // Data
  const [bookings, setBookings] = useState<BookingHistoryEntry[]>([])
  const [courtBookings, setCourtBookings] = useState<CourtBookingEntry[]>([])
  const [allCourts, setAllCourts] = useState<CourtItem[]>([])
  const [branches, setBranches] = useState<BranchItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  // UI state
  const [activeTab, setActiveTab] = useState("all")
  const [viewMode, setViewMode] = useState<"list" | "schedule">("list")
  const [search, setSearch] = useState("")
  const [branchFilter, setBranchFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sortField, setSortField] = useState<"date" | "amount" | "createdAt">("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [editBooking, setEditBooking] = useState<BookingHistoryEntry | null>(null)

  // Load data from API
  useEffect(() => {
    const init = async () => {
      try {
        const [brRes, cRes] = await Promise.all([branchApi.getAll(), courtApi.getAll()])
        setBranches(brRes.map((b: any) => ({ id: b.id, name: b.name, address: b.address })))
        setAllCourts(cRes.map((c: any) => ({ id: c.id, name: c.name, branch: c.branchName || c.branch, branchId: c.branchId, type: c.type, price: c.price, indoor: c.indoor })))
      } catch {}
      await refreshData()
      setHydrated(true)
    }
    init()
  }, [])

  const refreshData = useCallback(async () => {
    try {
      const res = await bookingApi.getAll({ limit: 500 })
      const bks = (res.bookings || []).map(apiToBooking)
      setBookings(bks)
      setCourtBookings(bookingsToSlots(bks))
    } catch {}
  }, [])

  // Status change
  const handleStatusChange = useCallback(async (id: string, newStatus: string) => {
    try {
      await bookingApi.updateStatus(id, newStatus)
      await refreshData()
    } catch { alert("Lỗi cập nhật trạng thái") }
  }, [refreshData])

  // Delete booking
  const handleDelete = useCallback(async (id: string) => {
    try {
      await bookingApi.delete(id)
      await refreshData()
    } catch { alert("Lỗi xoá booking") }
  }, [refreshData])

  // Batch status change
  const handleBatchStatus = useCallback(async (newStatus: string) => {
    try {
      for (const id of selectedIds) {
        await bookingApi.updateStatus(id, newStatus)
      }
      setSelectedIds([])
      await refreshData()
    } catch { alert("Lỗi cập nhật hàng loạt") }
  }, [selectedIds, refreshData])

  // Save booking (create or edit)
  const handleSaveBooking = useCallback(async (booking: BookingHistoryEntry, isEdit: boolean) => {
    try {
      if (isEdit) {
        // Update status via API (limited edit capability)
        await bookingApi.updateStatus(booking.id, booking.status)
      } else {
        const court = allCourts.find(c => c.name === booking.court)
        if (!court) return
        const timeParts = booking.time.split(" - ")
        await bookingApi.create({
          courtId:       court.id,
          bookingDate:   booking.date,
          timeStart:     timeParts[0]?.trim() || "",
          timeEnd:       timeParts[1]?.trim() || "",
          people:        booking.people,
          customerName:  booking.customer.name,
          customerPhone: booking.customer.phone,
          paymentMethod: booking.paymentMethod,
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
    { value: "pending", label: "Chờ xác nhận", count: bookings.filter(b => b.status === "pending").length },
    { value: "confirmed", label: "Đã xác nhận", count: bookings.filter(b => b.status === "confirmed").length },
    { value: "playing", label: "Đang chơi", count: bookings.filter(b => b.status === "playing").length },
    { value: "completed", label: "Hoàn thành", count: bookings.filter(b => b.status === "completed").length },
    { value: "cancelled", label: "Đã huỷ", count: bookings.filter(b => b.status === "cancelled").length },
  ], [bookings])

  const filtered = useMemo(() => {
    let result = [...bookings]

    if (activeTab !== "all") {
      result = result.filter(b => b.status === activeTab)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(b =>
        b.id.toLowerCase().includes(q) ||
        b.customer.name.toLowerCase().includes(q) ||
        b.customer.phone.includes(q) ||
        b.court.toLowerCase().includes(q)
      )
    }

    if (branchFilter !== "all") {
      result = result.filter(b => b.branch.includes(branchFilter))
    }

    if (dateFilter) {
      const filterStr = `${dateFilter.getFullYear()}-${(dateFilter.getMonth() + 1).toString().padStart(2, '0')}-${dateFilter.getDate().toString().padStart(2, '0')}`
      result = result.filter(b => b.date === filterStr || b.date.includes(formatDateShort(dateFilter)))
    }

    result.sort((a, b) => {
      let cmp = 0
      if (sortField === "amount") cmp = a.amount - b.amount
      else if (sortField === "date") cmp = a.date.localeCompare(b.date)
      else cmp = (a.createdAt || "").localeCompare(b.createdAt || "")
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  }, [bookings, activeTab, search, branchFilter, dateFilter, sortField, sortDir])

  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([])
    else setSelectedIds(filtered.map(b => b.id))
  }
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

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
          <p className="text-sm text-muted-foreground">Quản lý, theo dõi và điều phối booking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-1" /> Làm mới
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" /> Tạo booking
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
            <p className="text-sm text-muted-foreground">Tổng doanh thu</p>
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
            <LayoutList className="h-4 w-4" /> Danh sách
          </Button>
          <Button variant={viewMode === "schedule" ? "default" : "ghost"} size="sm" className="gap-1.5" onClick={() => setViewMode("schedule")}>
            <CalendarDays className="h-4 w-4" /> Lịch sân
          </Button>
        </div>
      </div>

      {/* Schedule View */}
      {viewMode === "schedule" && (
        <ScheduleView
          allCourts={allCourts}
          courtBookings={courtBookings}
          bookingHistory={bookings}
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

            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[200px] h-9">
                <Building2 className="h-3.5 w-3.5 mr-1 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Chi nhánh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả chi nhánh</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-1.5", dateFilter && "bg-primary/10 text-primary border-primary/30")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFilter ? formatDateShort(dateFilter) : "Lọc ngày"}
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

            <div className="flex-1" />

            {/* Batch actions */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-1.5 border border-primary/20">
                <span className="text-xs font-medium text-primary">{selectedIds.length} đã chọn</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 text-xs">Xác nhận</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-serif">Xác nhận {selectedIds.length} booking?</AlertDialogTitle>
                      <AlertDialogDescription>Các booking đang ở trạng thái &quot;chờ&quot; sẽ được chuyển sang &quot;đã xác nhận&quot;.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Huỷ</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleBatchStatus("confirmed")} className="bg-secondary hover:bg-secondary/90">Xác nhận</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="h-7 text-xs">Huỷ booking</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-serif">Huỷ {selectedIds.length} booking?</AlertDialogTitle>
                      <AlertDialogDescription>Hành động này không thể hoàn tác. Tất cả slot sân liên quan sẽ được giải phóng.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Quay lại</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleBatchStatus("cancelled")} className="bg-red-600 hover:bg-red-700">Huỷ booking</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds([])}>Bỏ chọn</Button>
              </div>
            )}

            <Button variant="outline" size="sm" className="h-9"><Download className="h-4 w-4 mr-1" /> Excel</Button>
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <CalendarIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="font-serif font-bold text-lg">Chưa có booking nào</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  {search || branchFilter !== "all" || dateFilter
                    ? "Không tìm thấy booking phù hợp với bộ lọc. Thử thay đổi điều kiện tìm kiếm."
                    : "Khi khách hàng đặt sân, booking sẽ xuất hiện ở đây. Hoặc bạn có thể tạo booking thủ công."}
                </p>
                {!search && branchFilter === "all" && !dateFilter && (
                  <Button className="mt-4" onClick={handleOpenCreate}>
                    <Plus className="h-4 w-4 mr-2" /> Tạo booking đầu tiên
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
                      <TableHead className="w-10">
                        <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                      </TableHead>
                      <TableHead className="text-xs">Mã booking</TableHead>
                      <TableHead className="text-xs">Khách hàng</TableHead>
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
                      <TableHead className="text-xs w-[160px]">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((booking, idx) => (
                      <Fragment key={booking.id}>
                        <TableRow
                          className={cn(
                            "cursor-pointer hover:bg-muted/50 transition-colors",
                            idx % 2 !== 0 && "bg-muted/20",
                            selectedIds.includes(booking.id) && "bg-primary/5"
                          )}
                          onClick={() => setExpandedRow(expandedRow === booking.id ? null : booking.id)}
                        >
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.includes(booking.id)}
                              onCheckedChange={() => toggleSelect(booking.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs text-primary font-semibold">{booking.id}</TableCell>
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
                            <div>
                              <p className="text-sm">{booking.court}</p>
                              <p className="text-xs text-muted-foreground">{booking.branch}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{booking.date}</TableCell>
                          <TableCell className="text-sm">{booking.time}</TableCell>
                          <TableCell className="text-sm font-medium">{formatVND(booking.amount)}</TableCell>
                          <TableCell><PaymentBadge method={booking.paymentMethod} /></TableCell>
                          <TableCell><BookingStatusBadge status={booking.status} /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                              {/* Quick status action */}
                              {statusFlow[booking.status] && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-green-600 hover:bg-green-50"
                                        onClick={() => handleStatusChange(booking.id, statusFlow[booking.status])}
                                      >
                                        {booking.status === "pending" && <CheckCircle2 className="h-3.5 w-3.5" />}
                                        {booking.status === "confirmed" && <Play className="h-3.5 w-3.5" />}
                                        {booking.status === "playing" && <CheckCircle2 className="h-3.5 w-3.5" />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{statusActionLabel[booking.status]}</TooltipContent>
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
                                <BookingDetailSheet booking={booking} onStatusChange={handleStatusChange} onEdit={handleOpenEdit} />
                              </Sheet>
                              {/* Edit */}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(booking)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              {/* Delete */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="font-serif">Xoá booking?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Bạn có chắc muốn xoá booking <strong>{booking.id}</strong>? Hành động này không thể hoàn tác và sẽ giải phóng slot sân.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Quay lại</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(booking.id)} className="bg-red-600 hover:bg-red-700">Xoá</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
                                <div className="flex-1 grid grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Chi nhánh</p>
                                    <p className="text-sm font-medium">{booking.branch}</p>
                                  </div>
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
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>Hiển thị {filtered.length} / {bookings.length} booking</span>
              <span>Tổng doanh thu (đã lọc): <strong className="text-foreground">{formatVND(filtered.filter(b => b.status !== "cancelled").reduce((s, b) => s + b.amount, 0))}</strong></span>
            </div>
          )}
        </>
      )}

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
