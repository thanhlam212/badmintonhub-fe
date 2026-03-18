"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { formatVND, generateTimeSlots, getWeekDays } from "@/lib/utils"
import { branchApi, courtApi, bookingApi, type ApiCourt } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import {
  Eye, MapPin, Star,
  CheckCircle2, XCircle, Building2, DollarSign,
  ChevronLeft, ChevronRight, Check, Clock,
  CalendarDays, Users, Lock, AlertTriangle,
} from "lucide-react"

/* ─── Types ─── */
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

export default function EmployeeCourtsPage() {
  const { user } = useAuth()
  const [courtsData, setCourtsData] = useState<Court[]>([])
  const [branchesList, setBranchesList] = useState<{id: number; name: string}[]>([])
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [employeeAction, setEmployeeAction] = useState<"booked" | "hold" | "remove">("booked")
  const [bookingsVersion, setBookingsVersion] = useState(0)
  const [allBookings, setAllBookings] = useState<{courtId: number; dateLabel: string; time: string; status: string; bookedBy?: string; phone?: string}[]>([])

  // Load courts and branches from API
  useEffect(() => {
    courtApi.getAll().then(res => {
      if (Array.isArray(res)) {
        setCourtsData(res)
      }
    }).catch(() => setCourtsData([]))
    branchApi.getAll().then((res: any) => {
      if (Array.isArray(res)) setBranchesList(res.map((b: any) => ({ id: b.id, name: b.name })))
    }).catch(() => {})
  }, [])

  // Load bookings from API
  useEffect(() => {
    bookingApi.getAll({ limit: 1000 }).then((res: any) => {
      if (res.success && res.data) {
        const slots = res.data.map((b: any) => ({
          courtId: b.court_id,
          dateLabel: b.booking_date ? new Date(b.booking_date).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }) : "",
          time: b.start_time?.slice(0, 5) || "",
          status: b.status === "confirmed" ? "booked" : b.status === "hold" ? "hold" : "booked",
          bookedBy: b.customer_name || "",
        }))
        setAllBookings(slots)
      }
    }).catch(() => {})
  }, [bookingsVersion])

  /* Helper: convert warehouse name → branch name */
  const warehouseToBranchName = useCallback((warehouse?: string): string | null => {
    if (!warehouse) return null
    const area = warehouse.replace("Kho ", "")
    const branch = branchesList.find(b => b.name.includes(area))
    return branch ? branch.name : null
  }, [branchesList])

  /* ─── Determine employee's branch ─── */
  const employeeBranch = useMemo(() => warehouseToBranchName(user?.warehouse), [user?.warehouse, warehouseToBranchName])

  /* ─── Filter courts to employee's branch only ─── */
  const branchCourts = useMemo(() => {
    if (!employeeBranch) return []
    return courtsData.filter(c => c.branch === employeeBranch)
  }, [courtsData, employeeBranch])

  const filteredCourts = useMemo(() => {
    return branchCourts.filter(c => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false
      return true
    })
  }, [branchCourts, typeFilter])

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

  /* Employee click handler: toggle slot status */
  const handleSlotClick = useCallback(async (courtId: number, dateLabel: string, time: string, currentStatus: string) => {
    if (employeeAction === "remove") {
      // Find matching booking and cancel it
      const matching = allBookings.find(b => b.courtId === courtId && b.dateLabel === dateLabel && b.time === time)
      if (matching) {
        // For now, update local state; backend cancel would need booking ID
        setAllBookings(prev => prev.filter(b => !(b.courtId === courtId && b.dateLabel === dateLabel && b.time === time)))
      }
    } else {
      if (currentStatus !== "available") {
        setAllBookings(prev => prev.filter(b => !(b.courtId === courtId && b.dateLabel === dateLabel && b.time === time)))
      } else {
        // Add new booking via API
        try {
          // Parse date from dateLabel (e.g., "T2, 01/07")
          const parts = dateLabel.split(", ")[1]?.split("/")
          const bookingDate = parts ? `${new Date().getFullYear()}-${parts[1]}-${parts[0]}` : new Date().toISOString().split("T")[0]
          await bookingApi.create({
          courtId: courtId,
          bookingDate: bookingDate,
          timeStart: time,
          timeEnd: `${String(parseInt(time.split(":")[0]) + 1).padStart(2, "0")}:00`,
          people: 1,
          paymentMethod: "cash",
          customerName: user?.fullName || "Nhân viên",
          customerPhone: "0000000000",
        })
        } catch {}
        setAllBookings(prev => [...prev, { courtId, dateLabel, time, status: employeeAction, bookedBy: user?.fullName || "Nhân viên" }])
      }
    }
    setBookingsVersion(v => v + 1)
  }, [employeeAction, user?.fullName, allBookings])

  /* ─── KPI (branch-only) ─── */
  const totalCourts = branchCourts.length
  const availableCourts = branchCourts.filter(c => c.available).length
  const premiumVip = branchCourts.filter(c => c.type === "premium" || c.type === "vip").length
  const avgPrice = totalCourts > 0 ? Math.round(branchCourts.reduce((s, c) => s + c.price, 0) / totalCourts) : 0

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

  if (!employeeBranch) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertTriangle className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">Không xác định được chi nhánh của bạn.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Quản lý sân</h1>
          <p className="text-sm text-muted-foreground">
            Chi nhánh: <strong>{employeeBranch.replace("BadmintonHub ", "")}</strong> — Xem lịch đặt và quản lý slot
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 py-1.5 px-3 text-xs bg-blue-50 text-blue-700 border-blue-200">
          <Building2 className="h-3.5 w-3.5" />
          {employeeBranch.replace("BadmintonHub ", "")}
        </Badge>
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

      {/* ─── Filters (no branch filter — locked to employee's branch) ─── */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
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
                        {!c.available && <XCircle className="h-3 w-3 text-red-500" />}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Status */}
            {selectedCourt && (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-medium border",
                    selectedCourt.available
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  )}
                >
                  {selectedCourt.available ? <><CheckCircle2 className="h-3.5 w-3.5" /> Hoạt động</> : <><XCircle className="h-3.5 w-3.5" /> Tạm đóng</>}
                </span>
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
            {/* Legend + Action */}
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs"><span className="h-3 w-3 rounded bg-court-available" /> Trống</span>
              <span className="flex items-center gap-1.5 text-xs"><span className="h-3 w-3 rounded bg-court-booked" /> Đã đặt</span>
              <span className="flex items-center gap-1.5 text-xs"><span className="h-3 w-3 rounded bg-court-hold" /> Giữ chỗ</span>
              <span className="border-l pl-4 ml-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Click ô:</span>
                <Select value={employeeAction} onValueChange={(v: "booked" | "hold" | "remove") => setEmployeeAction(v)}>
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
                      const bookingEntry = (status === "booked" || status === "hold")
                        ? allBookings.find(b => b.courtId === selectedCourt!.id && b.dateLabel === d.label && b.time === time)
                        : null
                      const slotBtn = (
                        <button
                          key={`${d.label}-${time}`}
                          onClick={() => selectedCourt && handleSlotClick(selectedCourt.id, d.label, time, status)}
                          className={cn(
                            "h-8 w-full rounded-[4px] flex items-center justify-center text-[10px] font-medium transition-colors select-none cursor-pointer",
                            status === "available" && "bg-court-available text-green-700 hover:bg-green-200",
                            status === "booked" && "bg-court-booked text-red-600 hover:bg-red-200",
                            status === "hold" && "bg-court-hold text-amber-700 hover:bg-amber-200",
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
            <p className="text-sm">Chọn sân để xem lịch đặt</p>
          </CardContent>
        </Card>
      )}

      {/* ─── All courts mini cards ─── */}
      <details className="mt-6 group" open>
        <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2 mb-3 select-none">
          <Building2 className="h-4 w-4 text-primary" />
          Danh sách sân ({filteredCourts.length})
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
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </SheetTrigger>
                    <CourtDetailSheet court={court} />
                  </Sheet>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
