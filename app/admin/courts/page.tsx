"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { formatVND, generateTimeSlots, getWeekDays, isSlotPast } from "@/lib/utils"
import { branchApi, courtApi, bookingApi, ApiBooking, type ApiCourt } from "@/lib/api"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Eye, Edit2, MapPin, Star,
  CheckCircle2, XCircle, Building2, DollarSign,
  ChevronLeft, ChevronRight, Check, Clock,
  CalendarDays, Users, Lock, Trash2,
} from "lucide-react"

/* ─── Court type ─── */
type Court = ApiCourt

/* ─── Court type badge ─── */
function CourtTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    premium: { label: "Premium", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    vip: { label: "VIP", cls: "bg-purple-100 text-purple-700 border-purple-200" },
    standard: { label: "Standard", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  }
  const v = map[type] || map.standard
  return <Badge variant="outline" className={cn("text-[10px]", v.cls)}>{v.label}</Badge>
}

/* ════════════════════════════════════════════════════════════ */

export default function AdminCourtsPage() {
  const [courtsData, setCourtsData] = useState<Court[]>([])
  const [branchFilter, setBranchFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [adminAction, setAdminAction] = useState<"booked" | "hold" | "remove">("booked")
  const [bookingsVersion, setBookingsVersion] = useState(0)
  const [branchesList, setBranchesList] = useState<{id: number; name: string; address: string; lat: number; lng: number}[]>([])
  const [slotConfirm, setSlotConfirm] = useState<{bookingId: string; courtId: number; dateLabel: string; time: string; status: string; bookedBy?: string; bookingCode?: string} | null>(null)
  const [slotLoading, setSlotLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const [brRes, cRes] = await Promise.all([branchApi.getAll(), courtApi.getAll()])
        setBranchesList(brRes.map((b: any) => ({ id: b.id, name: b.name, address: b.address || "", lat: b.lat || 0, lng: b.lng || 0 })))
        setCourtsData(cRes)
      } catch {
        setCourtsData([])
      }
    }
    init()
  }, [])
  const persist = (next: Court[]) => { setCourtsData(next) }

  /* ─── Filtered courts for combo boxes ─── */
  const filteredCourts = useMemo(() => {
    return courtsData.filter(c => {
      if (branchFilter !== "all" && c.branchId.toString() !== branchFilter) return false
      if (typeFilter !== "all" && c.type !== typeFilter) return false
      return true
    })
  }, [courtsData, branchFilter, typeFilter])

  /* Auto-select first court when filter changes */
  useEffect(() => {
    if (filteredCourts.length > 0) {
      if (!selectedCourtId || !filteredCourts.find(c => c.id === selectedCourtId)) {
        setSelectedCourtId(filteredCourts[0].id)
      }
    } else {
      setSelectedCourtId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCourts])

  const selectedCourt = courtsData.find(c => c.id === selectedCourtId) || null

  /* ─── Calendar data ─── */
  const timeSlots = useMemo(() => generateTimeSlots(), [])

  const startDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [weekOffset])

  const weekDays = useMemo(() => getWeekDays(startDate), [startDate])
  const weekKey = weekDays.map(d => d.label).join(",")

  // Build availability from API bookings
  const [allBookings, setAllBookings] = useState<{bookingId: string; courtId: number; dateLabel: string; time: string; status: string; bookedBy?: string; phone?: string; bookingCode?: string}[]>([])
  useEffect(() => {
    bookingApi.getAll({ limit: 1000 }).then((res: any) => {
      const bookings = res.bookings || []
      const slots: {bookingId: string; courtId: number; dateLabel: string; time: string; status: string; bookedBy?: string; phone?: string; bookingCode?: string}[] = []
      for (const b of bookings) {
        if (!b.courtId || !b.timeStart || b.status === "cancelled") continue
        const start = parseInt(b.timeStart.split(":")[0])
        const end = parseInt(b.timeEnd.split(":")[0])
        const d = new Date(b.bookingDate)
        const dateLabel = `${d.getDate()}/${d.getMonth() + 1}`
        for (let h = start; h < end; h++) {
          slots.push({
            bookingId: b.id,
            courtId: b.courtId,
            dateLabel,
            time: `${h.toString().padStart(2, '0')}:00`,
            status: b.status === "hold" ? "hold" : "booked",
            bookedBy: b.customerName || "",
            phone: b.customerPhone || "",
            bookingCode: b.bookingCode || "",
          })
        }
      }
      setAllBookings(slots)
    }).catch(() => {})
  }, [bookingsVersion])
  const dayLabels = useMemo(() => weekDays.map(d => d.label), [weekKey])

  const courtAvailability = useMemo(() => {
    if (!selectedCourt) return {} as Record<string, Record<string, "available" | "booked" | "hold">>
    const result: Record<string, Record<string, "available" | "booked" | "hold">> = {}
    for (const dl of dayLabels) {
      result[dl] = {}
      const dayBookings = allBookings.filter(b => b.courtId === selectedCourt.id && b.dateLabel === dl)
      for (const b of dayBookings) {
        result[dl][b.time] = (b.status === "hold" ? "hold" : "booked") as "available" | "booked" | "hold"
      }
    }
    return result
  }, [selectedCourt, dayLabels, allBookings])

  /* Admin click handler: toggle slot status */
  const handleAdminSlotClick = useCallback(async (courtId: number, dateLabel: string, time: string, currentStatus: string) => {
    // Check if slot is past
    const parts = dateLabel.split("/")
    const slotDate = new Date(new Date().getFullYear(), parseInt(parts[1]) - 1, parseInt(parts[0]))
    if (isSlotPast(dateLabel, time) && currentStatus === "available") {
      toast.error("Không thể đặt chỗ cho khung giờ đã qua")
      return
    }
    if (adminAction === "remove") {
      // Remove mode: clicking a booked/hold slot → show confirmation to cancel
      if (currentStatus !== "available") {
        const matching = allBookings.find(b => b.courtId === courtId && b.dateLabel === dateLabel && b.time === time)
        if (matching) {
          setSlotConfirm({ bookingId: matching.bookingId, courtId, dateLabel, time, status: currentStatus, bookedBy: matching.bookedBy, bookingCode: matching.bookingCode })
        }
      }
      return
    }
    // Booked/Hold mode: clicking an existing booked/hold slot → show confirmation to cancel first
    if (currentStatus !== "available") {
      const matching = allBookings.find(b => b.courtId === courtId && b.dateLabel === dateLabel && b.time === time)
      if (matching) {
        setSlotConfirm({ bookingId: matching.bookingId, courtId, dateLabel, time, status: currentStatus, bookedBy: matching.bookedBy, bookingCode: matching.bookingCode })
      }
      return
    }
    // Available slot → create booking directly
    try {
      const parts = dateLabel.split("/")
      const bookingDate = parts.length >= 2 ? `${new Date().getFullYear()}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}` : new Date().toISOString().split("T")[0]
      const result = await bookingApi.create({
        courtId: courtId,        // ← đổi id → courtId
        bookingDate: bookingDate, // ← booking_date → bookingDate (camelCase)
        timeStart: time,          // ← time_start → timeStart
        timeEnd: `${String(parseInt(time.split(":")[0]) + 1).padStart(2, "0")}:00`, // ← time_end → timeEnd
        people: 1,                // ← slots → people
        paymentMethod: "cash",    // ← thêm field bắt buộc
        customerName: "Admin",    // ← customer_name → customerName
        customerPhone: "0000000000", // ← customer_phone → customerPhone
      })
      if (result.success) {
        toast.success("Đã đặt chỗ thành công")
      } else {
        toast.error(result.error || "Không thể đặt chỗ")
      }
    } catch {
      toast.error("Lỗi khi đặt chỗ")
    }
    setBookingsVersion(v => v + 1)
  }, [adminAction, allBookings])

  /* Confirm cancel/delete booking from slot */
  const handleConfirmCancelSlot = useCallback(async () => {
    if (!slotConfirm) return
    setSlotLoading(true)
    try {
      const res = await bookingApi.updateStatus(slotConfirm.bookingId, "cancelled")
      if (res.success) {
        toast.success("Đã hủy đặt chỗ thành công")
      } else {
        toast.error(res.error || "Không thể hủy đặt chỗ")
      }
    } catch {
      toast.error("Lỗi khi hủy đặt chỗ")
    }
    setSlotLoading(false)
    setSlotConfirm(null)
    setBookingsVersion(v => v + 1)
  }, [slotConfirm])

  /* ─── KPI ─── */
  const totalCourts = courtsData.length
  const availableCourts = courtsData.filter(c => c.available).length
  const premiumVip = courtsData.filter(c => c.type === "premium" || c.type === "vip").length
  const avgPrice = totalCourts > 0 ? Math.round(courtsData.reduce((s, c) => s + c.price, 0) / totalCourts) : 0

  /* ─── Slot stats for selected court/week ─── */
  const slotStats = useMemo(() => {
    const s = { total: 0, available: 0, booked: 0, hold: 0 }
    if (!selectedCourt) return s
    weekDays.forEach(d => {
      const day = courtAvailability[d.label]
      if (!day) return
      timeSlots.forEach(t => {
        s.total++
        const st = day[t] || "available"
        s[st]++
      })
    })
    return s
  }, [selectedCourt, courtAvailability, weekDays, timeSlots])

  /* ─── Edit form ─── */
  const [editCourt, setEditCourt] = useState<Court | null>(null)
  const [editName, setEditName] = useState("")
  const [editType, setEditType] = useState("standard")
  const [editPrice, setEditPrice] = useState(0)
  const [editAvailable, setEditAvailable] = useState(true)
  const [editIndoor, setEditIndoor] = useState(true)
  const [editHours, setEditHours] = useState("")
  const [editDesc, setEditDesc] = useState("")

  const openEdit = useCallback((court: Court) => {
    setEditCourt(court)
    setEditName(court.name)
    setEditType(court.type)
    setEditPrice(court.price)
    setEditAvailable(court.available)
    setEditIndoor(court.indoor)
    setEditHours(court.hours)
    setEditDesc(court.description)
    setShowEdit(true)
  }, [])

  const handleSaveEdit = () => {
    if (!editCourt) return
    persist(courtsData.map(c => c.id === editCourt.id ? {
      ...c, name: editName, type: editType, price: editPrice,
      available: editAvailable, indoor: editIndoor, hours: editHours, description: editDesc,
    } : c))
    setShowEdit(false)
  }

  const toggleAvailable = (id: number) => {
    persist(courtsData.map(c => c.id === id ? { ...c, available: !c.available } : c))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Quản lý sân</h1>
          <p className="text-sm text-muted-foreground">Quản lý sân và xem lịch đặt theo thời gian</p>
        </div>
      </div>

      {/* ─── KPI ─── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        {[
          { title: "Tổng số sân", value: totalCourts.toString(), icon: <Building2 className="h-5 w-5" />, color: "bg-primary/10 text-primary" },
          { title: "Đang hoạt động", value: availableCourts.toString(), icon: <CheckCircle2 className="h-5 w-5" />, color: "bg-green-100 text-green-600" },
          { title: "Premium / VIP", value: premiumVip.toString(), icon: <Star className="h-5 w-5" />, color: "bg-amber-100 text-amber-600" },
          { title: "Giá TB / giờ", value: formatVND(avgPrice), icon: <DollarSign className="h-5 w-5" />, color: "bg-secondary/10 text-secondary" },
        ].map((card, i) => (
          <Card key={i} className="hover:-translate-y-0.5 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className={cn("p-2 rounded-lg", card.color)}>{card.icon}</span>
              </div>
              <p className="font-serif text-2xl font-extrabold mt-3">{card.value}</p>
              <p className="text-sm text-muted-foreground">{card.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Combo-box Filters ─── */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Branch combo */}
            <div className="w-[220px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Chi nhánh</Label>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Chi nhánh" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả chi nhánh</SelectItem>
                  {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name.replace("BadmintonHub ", "")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Type combo */}
            <div className="w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Loại sân</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Loại sân" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Court combo */}
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Chọn sân</Label>
              <Select
                value={selectedCourtId?.toString() || ""}
                onValueChange={(v) => setSelectedCourtId(parseInt(v))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Chọn sân..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredCourts.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      <span className="flex items-center gap-2">
                        {c.name}
                        <span className="text-muted-foreground text-xs">
                          — {c.branch.replace("BadmintonHub ", "")}
                        </span>
                        {!c.available && <XCircle className="h-3 w-3 text-red-500" />}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Actions */}
            {selectedCourt && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-9" onClick={() => openEdit(selectedCourt)}>
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Sửa
                </Button>
                <button
                  onClick={() => toggleAvailable(selectedCourt.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-medium cursor-pointer transition-colors border",
                    selectedCourt.available
                      ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                  )}
                >
                  {selectedCourt.available ? <><CheckCircle2 className="h-3.5 w-3.5" /> Hoạt động</> : <><XCircle className="h-3.5 w-3.5" /> Tạm đóng</>}
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Court info strip ─── */}
      {selectedCourt && (
        <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">{selectedCourt.name}</span>
            <CourtTypeBadge type={selectedCourt.type} />
            {selectedCourt.indoor
              ? <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-600 border-sky-200">Indoor</Badge>
              : <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-600 border-orange-200">Outdoor</Badge>}
          </div>
          <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {selectedCourt.branch}</span>
          <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {selectedCourt.hours}</span>
          <span className="font-semibold text-primary">{formatVND(selectedCourt.price)}/h</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> {selectedCourt.rating} ({selectedCourt.reviews})
          </span>
        </div>
      )}

      {/* ─── Slot statistics strip ─── */}
      {selectedCourt && (
        <div className="flex flex-wrap gap-3 mb-4">
          <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs bg-muted/50">
            <CalendarDays className="h-3.5 w-3.5" /> Tổng slot: <strong>{slotStats.total}</strong>
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs bg-green-50 text-green-700 border-green-200">
            <Check className="h-3.5 w-3.5" /> Trống: <strong>{slotStats.available}</strong>
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs bg-red-50 text-red-700 border-red-200">
            <Lock className="h-3.5 w-3.5" /> Đã đặt: <strong>{slotStats.booked}</strong>
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs bg-amber-50 text-amber-700 border-amber-200">
            <Users className="h-3.5 w-3.5" /> Giữ chỗ: <strong>{slotStats.hold}</strong>
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto self-center">
            Tỉ lệ lấp đầy: <strong>{slotStats.total ? Math.round(((slotStats.booked + slotStats.hold) / slotStats.total) * 100) : 0}%</strong>
          </span>
        </div>
      )}

      {/* ─── Time slot grid ─── */}
      {selectedCourt ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" /> Lịch đặt sân
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                  disabled={weekOffset === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[140px] text-center">
                  {weekDays[0]?.label} — {weekDays[6]?.label}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(weekOffset + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Legend + Admin action */}
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs"><span className="h-3 w-3 rounded bg-court-available" /> Trống</span>
              <span className="flex items-center gap-1.5 text-xs"><span className="h-3 w-3 rounded bg-court-booked" /> Đã đặt</span>
              <span className="flex items-center gap-1.5 text-xs"><span className="h-3 w-3 rounded bg-court-hold" /> Giữ chỗ</span>
              <span className="flex items-center gap-1.5 text-xs"><span className="h-3 w-3 rounded bg-court-past" /> Đã qua</span>
              <span className="border-l pl-4 ml-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Click ô:</span>
                <Select value={adminAction} onValueChange={(v: "booked" | "hold" | "remove") => setAdminAction(v)}>
                  <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booked">Đặt chỗ</SelectItem>
                    <SelectItem value="hold">Giữ chỗ</SelectItem>
                    <SelectItem value="remove">Xóa / Mở lại</SelectItem>
                  </SelectContent>
                </Select>
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-4">
            <div className="overflow-x-auto px-4">
              <div className="min-w-[700px]">
                {/* Day headers */}
                <div className="grid grid-cols-[56px_repeat(7,1fr)] gap-1 mb-1 sticky top-0 bg-background z-10 pb-1 border-b">
                  <div className="text-center text-[10px] text-muted-foreground font-medium py-1">Giờ</div>
                  {weekDays.map(d => (
                    <div key={d.label} className="text-center py-1">
                      <div className="text-[10px] text-muted-foreground">{d.dayName}</div>
                      <div className="text-xs font-semibold">{d.label}</div>
                    </div>
                  ))}
                </div>
                {/* Rows */}
                {timeSlots.map(time => (
                  <div key={time} className="grid grid-cols-[56px_repeat(7,1fr)] gap-1 mb-[3px]">
                    <div className="text-[11px] text-muted-foreground flex items-center justify-end pr-2 font-mono">{time}</div>
                    {weekDays.map(d => {
                      const status = courtAvailability[d.label]?.[time] || "available"
                      const past = isSlotPast(d.label, time)
                      const bookingEntry = (status === "booked" || status === "hold")
                        ? allBookings.find(b => b.courtId === selectedCourt!.id && b.dateLabel === d.label && b.time === time)
                        : null
                      if (past && status === "available") {
                        return (
                          <div
                            key={`${d.label}-${time}`}
                            className="h-8 w-full rounded-[4px] flex items-center justify-center text-[10px] font-medium bg-court-past text-slate-400 cursor-not-allowed select-none"
                          >
                            <Lock className="h-3 w-3" />
                          </div>
                        )
                      }
                      const slotBtn = (
                        <button
                          key={`${d.label}-${time}`}
                          onClick={() => !past && selectedCourt && handleAdminSlotClick(selectedCourt.id, d.label, time, status)}
                          disabled={past && status === "available"}
                          className={cn(
                            "h-8 w-full rounded-[4px] flex items-center justify-center text-[10px] font-medium transition-colors select-none",
                            past
                              ? "bg-court-past text-slate-400 cursor-not-allowed"
                              : status === "available" ? "bg-court-available text-green-700 hover:bg-green-200 cursor-pointer" : "",
                            !past && status === "booked" && "bg-court-booked text-red-600 hover:bg-red-200 cursor-pointer",
                            !past && status === "hold" && "bg-court-hold text-amber-700 hover:bg-amber-200 cursor-pointer",
                            past && status === "booked" && "bg-court-booked/60 text-red-400 cursor-not-allowed",
                            past && status === "hold" && "bg-court-hold/60 text-amber-500 cursor-not-allowed",
                          )}
                        >
                          {status === "booked" ? "Đã đặt" : status === "hold" ? "Giữ chỗ" : ""}
                        </button>
                      )
                      if (bookingEntry && (bookingEntry.bookedBy || bookingEntry.phone)) {
                        return (
                          <Tooltip key={`${d.label}-${time}`}>
                            <TooltipTrigger asChild>
                              {slotBtn}
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-foreground text-background rounded-lg px-3 py-2 text-xs shadow-lg max-w-[200px]">
                              <div className="space-y-0.5">
                                {bookingEntry.bookedBy && (
                                  <p className="font-semibold">{bookingEntry.bookedBy}</p>
                                )}
                                {bookingEntry.phone && (
                                  <p className="text-background/80">📞 {bookingEntry.phone}</p>
                                )}
                                <p className="text-background/60 text-[10px]">{d.dayName} {d.label} • {time}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )
                      }
                      return slotBtn
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
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Chọn chi nhánh và sân để xem lịch đặt</p>
          </CardContent>
        </Card>
      )}

      {/* ─── All courts mini cards ─── */}
      <details className="mt-6 group" open>
        <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2 mb-3 select-none">
          <Building2 className="h-4 w-4 text-primary" />
          Danh sách tất cả sân ({filteredCourts.length})
          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
        </summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCourts.map(court => (
            <Card
              key={court.id}
              className={cn(
                "cursor-pointer transition-all hover:-translate-y-0.5",
                selectedCourtId === court.id && "ring-2 ring-primary shadow-md"
              )}
              onClick={() => setSelectedCourtId(court.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{court.name}</span>
                    <CourtTypeBadge type={court.type} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </SheetTrigger>
                      <CourtDetailSheet court={court} />
                    </Sheet>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(court) }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{court.branch.replace("BadmintonHub ", "")}</span>
                  <span className="font-semibold text-primary">{formatVND(court.price)}/h</span>
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500" /> {court.rating}
                  </span>
                  {court.indoor
                    ? <Badge variant="outline" className="text-[9px] py-0 h-4 bg-sky-50 text-sky-600 border-sky-200">Indoor</Badge>
                    : <Badge variant="outline" className="text-[9px] py-0 h-4 bg-orange-50 text-orange-600 border-orange-200">Outdoor</Badge>}
                  <span className={cn(
                    "ml-auto inline-flex items-center gap-1 text-[10px] font-medium",
                    court.available ? "text-green-600" : "text-red-500"
                  )}>
                    {court.available ? <><CheckCircle2 className="h-3 w-3" /> Hoạt động</> : <><XCircle className="h-3 w-3" /> Tạm đóng</>}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </details>

      {/* ─── Edit Dialog ─── */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Chỉnh sửa sân</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Tên sân</Label>
              <Input className="mt-1" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Loại sân</Label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Giá / giờ (VND)</Label>
                <Input className="mt-1" type="number" min={0} value={editPrice} onChange={e => setEditPrice(parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Switch checked={editIndoor} onCheckedChange={setEditIndoor} />
                <Label className="text-sm">{editIndoor ? "Indoor" : "Outdoor"}</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editAvailable} onCheckedChange={setEditAvailable} />
                <Label className="text-sm">{editAvailable ? "Hoạt động" : "Tạm đóng"}</Label>
              </div>
            </div>
            <div>
              <Label className="text-sm">Giờ mở cửa</Label>
              <Input className="mt-1" value={editHours} onChange={e => setEditHours(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">Mô tả</Label>
              <Textarea className="mt-1" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Huỷ</Button></DialogClose>
            <Button onClick={handleSaveEdit} className="bg-primary hover:bg-primary/90 text-primary-foreground">Lưu thay đổi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm cancel/delete booking dialog */}
      <AlertDialog open={!!slotConfirm} onOpenChange={open => { if (!open) setSlotConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Hủy đặt chỗ
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Bạn có chắc muốn hủy đặt chỗ này?</p>
                {slotConfirm && (
                  <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                    <p><strong>Thời gian:</strong> {slotConfirm.dateLabel} • {slotConfirm.time}</p>
                    {slotConfirm.bookedBy && <p><strong>Khách:</strong> {slotConfirm.bookedBy}</p>}
                    {slotConfirm.bookingCode && <p><strong>Mã đặt:</strong> {slotConfirm.bookingCode}</p>}
                    <p><strong>Trạng thái:</strong> {slotConfirm.status === "hold" ? "Giữ chỗ" : "Đã đặt"}</p>
                  </div>
                )}
                <p className="text-destructive text-xs">Hành động này không thể hoàn tác.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={slotLoading}>Không</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancelSlot} disabled={slotLoading} className="bg-destructive text-white hover:bg-destructive/90">
              {slotLoading ? "Đang xử lý..." : "Xác nhận hủy"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}

/* ─── Court Detail Sheet ─── */
function CourtDetailSheet({ court }: { court: Court }) {
  return (
    <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
      <SheetHeader>
        <SheetTitle className="font-serif">Chi tiết sân</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-lg">{court.name}</p>
            <p className="text-sm text-muted-foreground">{court.branch}</p>
          </div>
          <CourtTypeBadge type={court.type} />
        </div>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Giá / giờ</span>
              <span className="font-bold text-primary">{formatVND(court.price)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Loại</span>
              <span>{court.indoor ? "Indoor" : "Outdoor"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Giờ mở cửa</span>
              <span>{court.hours}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Đánh giá</span>
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />{court.rating} ({court.reviews} reviews)
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Trạng thái</span>
              <span className={court.available ? "text-green-600" : "text-red-600"}>
                {court.available ? "Hoạt động" : "Tạm đóng"}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Địa chỉ</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              {court.address}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Mô tả</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground">{court.description}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Tiện nghi</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-1.5">
              {court.amenities.map((a, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </SheetContent>
  )
}