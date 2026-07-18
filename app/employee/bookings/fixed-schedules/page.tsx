"use client"

import type { MouseEvent, ReactNode } from "react"
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Repeat,
  Search,
  SkipForward,
  Smartphone,
  Trash2,
  User,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch, courtApi, fixedScheduleApi, paymentApi, type ApiCourt } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { cn, formatVND, formatFixedScheduleReference } from "@/lib/utils"

type AdjustType = "skip" | "reschedule" | "change_court"

type FixedSchedule = {
  id: string
  status: string
  cycle: string
  startDate: string
  endDate: string
  timeStart: string
  timeEnd: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  userId?: string | null
  user?: {
    id: string
    fullName: string
    email: string
    phone: string
    username?: string
  } | null
  occurrenceCount: number
  adjustmentLimit: number
  adjustmentUsed: number
  pendingAdjustmentCount?: number
  pricePerHourSnapshot?: number
  totalAmountSnapshot: number
  paymentMethod?: string
  court?: {
    id?: number
    name?: string
    type?: string
    branch?: {
      id?: number
      name?: string
      address?: string
    }
  }
  occurrenceSummary?: {
    total: number
    scheduled: number
    completed: number
    skipped: number
    cancelled: number
    upcoming?: FixedOccurrence[]
  }
  invoice?: {
    id: string
    code: string
    status: string
    paymentMethod: string
    totalSnapshot: number
  } | null
}

type FixedOccurrence = {
  id: string
  date: string
  dayLabel: string
  timeStart: string
  timeEnd: string
  status: string
  courtId?: number
  courtName?: string
  amountSnapshot?: number
  bookingId?: string | null
  bookingStatus?: string | null
}

type FixedScheduleDetail = FixedSchedule & {
  occurrences?: FixedOccurrence[]
  adjustments?: Array<{
    id: string
    occurrenceId?: string
    type: string
    oldDate?: string
    newDate?: string
    oldTimeStart?: string
    oldTimeEnd?: string
    newTimeStart?: string
    newTimeEnd?: string
    oldCourtId?: number
    newCourtId?: number
    note?: string
    createdAt: string
  }>
}

const scheduleStatusLabels: Record<string, string> = {
  active: "Đang hoạt động",
  pending: "Chờ thanh toán",
  deposited: "Đã đặt cọc",
  confirmed: "Đang hoạt động",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
}

const scheduleStatusClass: Record<string, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  deposited: "bg-blue-50 text-blue-700 border-blue-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
}

const occurrenceStatusLabels: Record<string, string> = {
  scheduled: "Sắp tới",
  rescheduled: "Đã dời",
  completed: "Hoàn thành",
  missed_checkin: "Quên check-in",
  skipped: "Báo nghỉ",
  cancelled: "Đã hủy",
}

const occurrenceStatusClass: Record<string, string> = {
  scheduled: "bg-green-50 text-green-700 border-green-200",
  rescheduled: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-slate-50 text-slate-700 border-slate-200",
  missed_checkin: "bg-red-50 text-red-700 border-red-200",
  skipped: "bg-zinc-50 text-zinc-600 border-zinc-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
}

const paymentLabels: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  sepay: "SePay / VietQR",
  vnpay: "VNPay",
  momo: "MoMo",
}

const fixedPaymentMethods = [
  { value: "cash", label: "Tiền mặt", desc: "Nhân viên thu tiền và xác nhận tay", icon: CreditCard },
  { value: "bank_transfer", label: "Chuyển khoản", desc: "Xác nhận tay sau khi kiểm tra giao dịch", icon: Building2 },
  { value: "sepay", label: "SePay", desc: "Tạo QR/chuyển khoản tự động đối soát", icon: Building2 },
  { value: "vnpay", label: "VNPay", desc: "Mở cổng VNPay", icon: CreditCard },
  { value: "momo", label: "MoMo", desc: "Mở ví MoMo", icon: Smartphone },
]

function submitPaymentForm(
  checkoutUrl: string,
  formFields: Record<string, unknown>,
) {
  const form = document.createElement("form")
  form.method = "POST"
  form.action = checkoutUrl
  Object.entries(formFields).forEach(([name, value]) => {
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = name
    input.value = String(value ?? "")
    form.appendChild(input)
  })
  document.body.appendChild(form)
  form.submit()
}

function isSchedulePaid(schedule: FixedSchedule | null) {
  return schedule?.invoice?.status === "paid"
}

function effectiveScheduleStatus(schedule: FixedSchedule) {
  if (schedule.status === "cancelled" || schedule.invoice?.status === "cancelled") return "cancelled"
  if (schedule.status === "completed") return "completed"
  if (isSchedulePaid(schedule)) return "confirmed"
  return schedule.status || "pending"
}

function canDeleteTrashSchedule(schedule: FixedSchedule | null) {
  if (!schedule) return false
  if (isSchedulePaid(schedule)) return false
  if (["confirmed", "active", "completed"].includes(schedule.status)) return false

  const invoiceStatus = schedule.invoice?.status
  return (
    ["pending", "cancelled"].includes(schedule.status) ||
    !invoiceStatus ||
    ["unpaid", "cancelled"].includes(invoiceStatus)
  )
}

function FixedScheduleStatusBadge({ schedule }: { schedule: FixedSchedule }) {
  const statusKey = effectiveScheduleStatus(schedule)
  const paid = isSchedulePaid(schedule)

  return (
    <Badge className={cn("inline-flex items-center gap-1 border", scheduleStatusClass[statusKey] || scheduleStatusClass.active)}>
      <span>{scheduleStatusLabels[statusKey] || statusKey}</span>
      {paid && <CheckCircle2 className="h-3.5 w-3.5" aria-label="Đã thanh toán" />}
    </Badge>
  )
}

function scheduleCode(schedule: FixedSchedule) {
  return schedule.invoice?.code || formatFixedScheduleReference(schedule.id, schedule.startDate)
}

function isActiveSchedule(schedule: FixedSchedule) {
  return !["completed", "cancelled"].includes(schedule.status)
}

function isAdjustableOccurrence(occurrence: FixedOccurrence) {
  return !["completed", "missed_checkin", "skipped", "cancelled"].includes(getOccurrenceDisplayStatus(occurrence))
}

function buildOccurrenceEndAt(occurrence: FixedOccurrence) {
  const date = normalizeDateInput(occurrence.date)
  if (!date || !occurrence.timeEnd) return null

  const endAt = new Date(`${date}T${occurrence.timeEnd}:00`)
  if (Number.isNaN(endAt.getTime())) return null

  const startAt = occurrence.timeStart
    ? new Date(`${date}T${occurrence.timeStart}:00`)
    : null
  if (startAt && !Number.isNaN(startAt.getTime()) && endAt <= startAt) {
    endAt.setDate(endAt.getDate() + 1)
  }

  return endAt
}

function isMissedCheckinOccurrence(occurrence: FixedOccurrence, now = new Date()) {
  if (!["scheduled", "rescheduled"].includes(occurrence.status)) return false
  if (occurrence.bookingStatus && occurrence.bookingStatus !== "confirmed") return false

  const endAt = buildOccurrenceEndAt(occurrence)
  return Boolean(endAt && now >= endAt)
}

function getOccurrenceDisplayStatus(occurrence: FixedOccurrence) {
  return isMissedCheckinOccurrence(occurrence) ? "missed_checkin" : occurrence.status
}

function employeeBranchName(warehouse?: string | null) {
  if (!warehouse) return null
  return warehouse.replace(/^Kho\s+/i, "").trim()
}

function normalizeSearchText(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
}

function normalizeDateInput(date?: string) {
  if (!date) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  const parsed = new Date(date)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  return date
}

function formatCycle(cycle: string) {
  if (cycle === "daily") return "Lặp theo ngày"
  return cycle === "monthly" ? "Hàng tháng" : "Hàng tuần"
}

export default function EmployeeFixedSchedulesPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState<FixedSchedule[]>([])
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [selected, setSelected] = useState<FixedScheduleDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [occurrenceFilter, setOccurrenceFilter] = useState("adjustable")
  const [selectedOcc, setSelectedOcc] = useState<FixedOccurrence | null>(null)
  const [adjustType, setAdjustType] = useState<AdjustType | null>(null)
  const [newDate, setNewDate] = useState("")
  const [newTimeStart, setNewTimeStart] = useState("")
  const [newTimeEnd, setNewTimeEnd] = useState("")
  const [newCourtId, setNewCourtId] = useState<number | null>(null)
  const [reason, setReason] = useState("")
  const [checkingSlot, setCheckingSlot] = useState(false)
  const [slotAvailable, setSlotAvailable] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [courtOptions, setCourtOptions] = useState<ApiCourt[]>([])
  const [loadingCourts, setLoadingCourts] = useState(false)
  const [fixedPaymentMethod, setFixedPaymentMethod] = useState("sepay")
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [adjustmentLimitInput, setAdjustmentLimitInput] = useState("")
  const [savingAdjustmentLimit, setSavingAdjustmentLimit] = useState(false)
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null)
  const [fixedPaymentId, setFixedPaymentId] = useState<string | null>(null)
  const [fixedPaymentInfo, setFixedPaymentInfo] = useState<{
    qrImageUrl?: string
    bankCode?: string
    accountNumber?: string
    transferContent?: string
    amount?: number
    payUrl?: string | null
    checkoutUrl?: string | null
    formFields?: Record<string, unknown> | null
  } | null>(null)

  const branchKeyword = employeeBranchName(user?.warehouse)
  const employeeBranchId = user?.branchId || null

  const loadSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fixedScheduleApi.getFixedSchedules(
        employeeBranchId ? { branchId: employeeBranchId } : undefined,
      )
      setSchedules(data as FixedSchedule[])
    } catch (error: any) {
      toast.error(error?.message || "Không thể tải danh sách lịch cố định")
    } finally {
      setLoading(false)
    }
  }, [employeeBranchId])

  useEffect(() => {
    void loadSchedules()
  }, [loadSchedules])

  const branchSchedules = useMemo(() => {
    if (employeeBranchId) {
      return schedules.filter(schedule => Number(schedule.court?.branch?.id) === employeeBranchId)
    }
    if (!branchKeyword) return schedules

    const normalizedBranchKeyword = normalizeSearchText(branchKeyword)
    return schedules.filter(schedule => {
      const branchName = normalizeSearchText(schedule.court?.branch?.name)
      const warehouseName = normalizeSearchText(`Kho ${schedule.court?.branch?.name || ""}`)
      return branchName.includes(normalizedBranchKeyword) || warehouseName.includes(normalizedBranchKeyword)
    })
  }, [branchKeyword, employeeBranchId, schedules])

  const filtered = useMemo(() => {
    const q = normalizeSearchText(query.trim())
    return branchSchedules.filter(schedule => {
      const matchesStatus =
        status === "all" ||
        (status === "active" ? isActiveSchedule(schedule) : schedule.status === status)

      if (!matchesStatus) return false
      if (!q) return true

      return (
        normalizeSearchText(scheduleCode(schedule)).includes(q) ||
        normalizeSearchText(schedule.customerName).includes(q) ||
        schedule.customerPhone?.includes(q) ||
        normalizeSearchText(schedule.customerEmail).includes(q) ||
        normalizeSearchText(schedule.user?.fullName).includes(q) ||
        normalizeSearchText(schedule.user?.email).includes(q) ||
        normalizeSearchText(schedule.user?.username).includes(q) ||
        schedule.user?.phone?.includes(q) ||
        normalizeSearchText(schedule.court?.name).includes(q) ||
        normalizeSearchText(schedule.court?.branch?.name).includes(q)
      )
    })
  }, [branchSchedules, query, status])

  const stats = useMemo(() => ({
    total: branchSchedules.length,
    active: branchSchedules.filter(isActiveSchedule).length,
    pendingAdjustments: branchSchedules.reduce((sum, s) => sum + (s.pendingAdjustmentCount || 0), 0),
    completed: branchSchedules.filter(s => s.status === "completed").length,
  }), [branchSchedules])

  const adjustmentLeft = selected
    ? Math.max(0, (selected.adjustmentLimit || 0) - (selected.adjustmentUsed || 0))
    : 0
  const selectedPaid = isSchedulePaid(selected)

  const filteredOccurrences = useMemo(() => {
    const occurrences = selected?.occurrences || []
    if (occurrenceFilter === "all") return occurrences
    if (occurrenceFilter === "adjustable") return occurrences.filter(isAdjustableOccurrence)
    return occurrences.filter(occ => getOccurrenceDisplayStatus(occ) === occurrenceFilter)
  }, [occurrenceFilter, selected])

  const resetAdjustForm = useCallback(() => {
    setSelectedOcc(null)
    setAdjustType(null)
    setNewDate("")
    setNewTimeStart("")
    setNewTimeEnd("")
    setNewCourtId(null)
    setReason("")
    setSlotAvailable(null)
    setCourtOptions([])
  }, [])

  const openDetail = async (schedule: FixedSchedule) => {
    setDetailLoading(true)
    resetAdjustForm()
    setFixedPaymentId(null)
    setFixedPaymentInfo(null)
    setFixedPaymentMethod(schedule.invoice?.paymentMethod || schedule.paymentMethod || "sepay")
    setAdjustmentLimitInput(String(schedule.adjustmentLimit ?? 0))
    setSelected(schedule as FixedScheduleDetail)
    try {
      const detail = await fixedScheduleApi.getFixedScheduleDetail(schedule.id)
      if (detail) {
        setSelected(detail as FixedScheduleDetail)
        setAdjustmentLimitInput(String((detail as FixedScheduleDetail).adjustmentLimit ?? 0))
      }
    } catch (error: any) {
      toast.error(error?.message || "Không thể tải chi tiết lịch cố định")
    } finally {
      setDetailLoading(false)
    }
  }

  const reloadSelected = useCallback(async () => {
    if (!selected) return
    const detail = await fixedScheduleApi.getFixedScheduleDetail(selected.id)
    if (detail) setSelected(detail as FixedScheduleDetail)
  }, [selected])

  const handleReviewAdjustmentRequest = async (
    adjustmentId: string,
    approve: boolean,
    reason?: string,
  ) => {
    const trimmedReason = reason?.trim()
    if (!approve && !trimmedReason) {
      toast.error("Vui lòng nhập lý do từ chối")
      return
    }
    try {
      const res = await apiFetch(`/bookings/fixed/adjustments/${adjustmentId}/review`, {
        method: "PATCH",
        body: JSON.stringify({ approve, reason: trimmedReason }),
      })
      if (!res.success) {
        throw new Error(res.message || "Không thể xử lý yêu cầu")
      }
      toast.success(res.message || (approve ? "Đã duyệt yêu cầu" : "Đã từ chối yêu cầu"))
      await reloadSelected()
      await loadSchedules()
    } catch (error: any) {
      toast.error(error?.message || "Không thể xử lý yêu cầu")
      throw error
    }
  }

  const handleSaveAdjustmentLimit = async () => {
    if (!selected) return

    const nextLimit = Number(adjustmentLimitInput)
    if (!Number.isInteger(nextLimit) || nextLimit < 0 || nextLimit > 20) {
      toast.error("Số lượt đổi phải là số nguyên từ 0 đến 20")
      return
    }
    if (nextLimit < (selected.adjustmentUsed || 0)) {
      toast.error(`Số lượt đổi không được nhỏ hơn số lượt đã dùng (${selected.adjustmentUsed || 0})`)
      return
    }

    setSavingAdjustmentLimit(true)
    try {
      const updated = await fixedScheduleApi.updateAdjustmentLimit(selected.id, nextLimit)
      setSelected((current) =>
        current
          ? {
              ...current,
              adjustmentLimit: updated?.adjustmentLimit ?? nextLimit,
              adjustmentUsed: updated?.adjustmentUsed ?? current.adjustmentUsed,
            }
          : current,
      )
      toast.success("Đã cập nhật số lượt đổi lịch cố định")
      await loadSchedules()
    } catch (error: any) {
      toast.error(error?.message || "Không thể cập nhật số lượt đổi")
    } finally {
      setSavingAdjustmentLimit(false)
    }
  }

  const handleDeleteTrashSchedule = async (schedule: FixedSchedule, event?: MouseEvent) => {
    event?.stopPropagation()

    if (!canDeleteTrashSchedule(schedule)) {
      toast.error("Chỉ được xóa gói/hóa đơn rác chưa thanh toán hoặc đã hủy")
      return
    }

    const ok = window.confirm(
      `Xóa gói ${scheduleCode(schedule)} và các hóa đơn/slot rác liên quan? Thao tác này không áp dụng cho gói đã thanh toán.`,
    )
    if (!ok) return

    setDeletingScheduleId(schedule.id)
    try {
      await fixedScheduleApi.deleteTrash(schedule.id)
      toast.success("Đã xóa hóa đơn/gói rác")
      if (selected?.id === schedule.id) {
        setSelected(null)
        resetAdjustForm()
        setFixedPaymentId(null)
        setFixedPaymentInfo(null)
      }
      await loadSchedules()
    } catch (error: any) {
      toast.error(error?.message || "Không thể xóa hóa đơn/gói rác")
    } finally {
      setDeletingScheduleId(null)
    }
  }

  const selectOccurrence = async (occurrence: FixedOccurrence) => {
    if (!selected) return
    if (!selectedPaid) {
      toast.error("Gói lịch cố định chưa thanh toán. Vui lòng xác nhận thanh toán trước.")
      return
    }
    setSelectedOcc(occurrence)
    setAdjustType(null)
    setNewDate(normalizeDateInput(occurrence.date))
    setNewTimeStart(occurrence.timeStart)
    setNewTimeEnd(occurrence.timeEnd)
    setNewCourtId(null)
    setReason("")
    setSlotAvailable(null)
    setCourtOptions([])

    const branchId = selected.court?.branch?.id
    const type = selected.court?.type
    if (branchId && type) {
      setLoadingCourts(true)
      try {
        const courts = await courtApi.getAll({ branchId, type })
        setCourtOptions(courts.filter(court => court.id !== (occurrence.courtId || selected.court?.id)))
      } catch {
        toast.error("Không thể tải danh sách sân để đổi")
      } finally {
        setLoadingCourts(false)
      }
    }
  }

  const handleCheckSlot = async () => {
    if (!selected || !selectedOcc || !newTimeStart || !newTimeEnd) return
    const targetCourtId =
      adjustType === "change_court"
        ? newCourtId
        : selectedOcc.courtId || selected.court?.id

    if (!targetCourtId) {
      toast.error("Vui lòng chọn sân cần kiểm tra")
      return
    }

    setCheckingSlot(true)
    setSlotAvailable(null)
    try {
      const result = await fixedScheduleApi.checkSlot({
        courtId: targetCourtId,
        date: newDate || normalizeDateInput(selectedOcc.date),
        timeStart: newTimeStart,
        timeEnd: newTimeEnd,
      })
      const target = result?.courts?.find((court: any) => Number(court.id) === Number(targetCourtId))
      const available = Boolean(target?.available)
      setSlotAvailable(available)
      if (available) toast.success("Khung giờ này còn trống")
      else toast.error("Khung giờ/sân này đã bị đặt")
    } catch (error: any) {
      toast.error(error?.message || "Không thể kiểm tra slot")
    } finally {
      setCheckingSlot(false)
    }
  }

  const refreshPaymentState = async () => {
    await Promise.all([reloadSelected(), loadSchedules()])
  }

  const handleConfirmManualPayment = async () => {
    if (!selected) return
    setPaymentProcessing(true)
    try {
      await fixedScheduleApi.confirmPayment(selected.id, fixedPaymentMethod)
      toast.success("Đã xác nhận thanh toán lịch cố định")
      setFixedPaymentId(null)
      setFixedPaymentInfo(null)
      await refreshPaymentState()
    } catch (error: any) {
      toast.error(error?.message || "Không thể xác nhận thanh toán")
    } finally {
      setPaymentProcessing(false)
    }
  }

  const handleCreateOnlinePayment = async () => {
    if (!selected?.invoice?.id) {
      toast.error("Không tìm thấy hóa đơn của gói lịch cố định")
      return
    }

    if (!["sepay", "vnpay", "momo"].includes(fixedPaymentMethod)) {
      await handleConfirmManualPayment()
      return
    }

    setPaymentProcessing(true)
    try {
      const result = await paymentApi.create(
        selected.invoice.id,
        fixedPaymentMethod as "sepay" | "vnpay" | "momo",
      )
      if (!result.success || !result.paymentId) {
        toast.error(result.error || "Không thể tạo thanh toán")
        return
      }

      setFixedPaymentId(result.paymentId)
      const externalUrl = result.payUrl || result.checkoutUrl || null
      setFixedPaymentInfo({
        qrImageUrl: result.qrImageUrl,
        bankCode: result.bankCode,
        accountNumber: result.accountNumber,
        transferContent: result.transferContent,
        amount: result.amount,
        payUrl: externalUrl,
        checkoutUrl: result.checkoutUrl,
        formFields: result.formFields,
      })

      if (result.checkoutUrl && result.formFields) {
        submitPaymentForm(result.checkoutUrl, result.formFields)
        return
      }

      if (result.payUrl) {
        window.open(result.payUrl, "_blank", "noopener,noreferrer")
      }

      if (result.qrImageUrl) {
        toast.success("Đã tạo QR thanh toán. Cho khách quét QR rồi bấm kiểm tra trạng thái.")
      } else if (externalUrl) {
        toast.success("Đã mở cổng thanh toán. Nếu tab mới không mở, bấm “Mở lại cổng thanh toán”.")
      } else {
        toast.warning("Đã tạo phiên thanh toán nhưng chưa nhận được QR/link. Kiểm tra cấu hình phương thức thanh toán.")
      }
      await refreshPaymentState()
    } catch (error: any) {
      toast.error(error?.message || "Không thể tạo thanh toán")
    } finally {
      setPaymentProcessing(false)
    }
  }

  const handleCheckFixedPaymentStatus = async () => {
    if (!fixedPaymentId) {
      await refreshPaymentState()
      return
    }

    setPaymentProcessing(true)
    try {
      const status = await paymentApi.getStatus(fixedPaymentId)
      const paymentStatus = status.data?.status
      const invoiceStatus = status.data?.invoiceStatus
      await refreshPaymentState()
      if (status.success && (paymentStatus === "success" || invoiceStatus === "paid")) {
        toast.success("Thanh toán đã được xác nhận")
      } else {
        toast.info("Thanh toán chưa được ghi nhận")
      }
    } catch (error: any) {
      toast.error(error?.message || "Không thể kiểm tra thanh toán")
    } finally {
      setPaymentProcessing(false)
    }
  }

  const handleSubmitAdjust = async () => {
    if (!selected || !selectedOcc || !adjustType) return

    if (!selectedPaid) {
      toast.error("Gói lịch cố định chưa thanh toán. Vui lòng xác nhận thanh toán trước khi sửa/dời.")
      return
    }

    if (adjustmentLeft <= 0) {
      toast.error("Gói này đã hết lượt điều chỉnh")
      return
    }

    if (adjustType !== "skip") {
      if (!newTimeStart || !newTimeEnd) {
        toast.error("Vui lòng nhập giờ mới")
        return
      }
      if (adjustType === "change_court" && !newCourtId) {
        toast.error("Vui lòng chọn sân mới")
        return
      }
      if (slotAvailable !== true) {
        toast.error("Vui lòng kiểm tra khả dụng trước khi xác nhận")
        return
      }
    }

    setSubmitting(true)
    try {
      await fixedScheduleApi.adjustOccurrence(selected.id, selectedOcc.id, {
        type: adjustType,
        ...(adjustType === "change_court" && newCourtId ? { newCourtId } : {}),
        ...(adjustType !== "skip"
          ? {
              newDate: adjustType === "reschedule" ? newDate : undefined,
              newTimeStart,
              newTimeEnd,
            }
          : {}),
        reason: reason.trim() || undefined,
      })

      toast.success(
        adjustType === "skip"
          ? "Đã báo nghỉ buổi này"
          : adjustType === "change_court"
            ? "Đã đổi sân cho buổi này"
            : "Đã dời lịch cho buổi này",
      )
      resetAdjustForm()
      await Promise.all([reloadSelected(), loadSchedules()])
    } catch (error: any) {
      toast.error(error?.message || "Không thể điều chỉnh buổi này")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Lịch cố định</h1>
          <p className="text-sm text-muted-foreground">
            Danh sách riêng để kiểm tra gói cố định, xem từng buổi và dời/sửa buổi khi khách cần.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {branchKeyword ? `Chi nhánh: ${branchKeyword}` : "Tất cả chi nhánh"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tổng gói" value={stats.total} />
        <StatCard label="Đang hoạt động" value={stats.active} />
        <StatCard label="Yêu cầu đổi lịch" value={stats.pendingAdjustments} />
        <StatCard label="Hoàn thành" value={stats.completed} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Tìm tên khách, SĐT, mã gói, sân..."
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full lg:w-[190px]">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="active">Đang hoạt động</SelectItem>
                <SelectItem value="pending">Chờ thanh toán</SelectItem>
                <SelectItem value="completed">Hoàn thành</SelectItem>
                <SelectItem value="cancelled">Đã hủy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-14 text-center">
              <Repeat className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-semibold">Không có gói lịch cố định phù hợp</p>
              <p className="mt-1 text-xs text-muted-foreground">Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã gói</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Sân</TableHead>
                    <TableHead>Chu kỳ</TableHead>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Buổi</TableHead>
                    <TableHead>Lượt sửa</TableHead>
                    <TableHead>Tổng tiền</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(schedule => (
                    <TableRow
                      key={schedule.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(schedule)}
                    >
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {scheduleCode(schedule)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold">{schedule.customerName}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {schedule.customerPhone}
                          </p>
                          {(schedule.user?.email || schedule.customerEmail) && (
                            <p className="text-xs text-muted-foreground">
                              {schedule.user?.email || schedule.customerEmail}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{schedule.court?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{schedule.court?.branch?.name || "—"}</p>
                      </TableCell>
                      <TableCell className="text-sm">{formatCycle(schedule.cycle)}</TableCell>
                      <TableCell className="text-sm">
                        <p>{schedule.startDate} → {schedule.endDate}</p>
                        <p className="text-xs text-muted-foreground">{schedule.timeStart} - {schedule.timeEnd}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {schedule.occurrenceSummary?.total ?? schedule.occurrenceCount}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            (schedule.adjustmentLimit || 0) > (schedule.adjustmentUsed || 0)
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {schedule.adjustmentUsed || 0}/{schedule.adjustmentLimit || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatVND(schedule.totalAmountSnapshot || Number(schedule.invoice?.totalSnapshot || 0))}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <FixedScheduleStatusBadge schedule={schedule} />
                          {(schedule.pendingAdjustmentCount || 0) > 0 && (
                            <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                              {schedule.pendingAdjustmentCount} yêu cầu đổi lịch
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canDeleteTrashSchedule(schedule) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              aria-label="Xóa hóa đơn rác"
                              disabled={deletingScheduleId === schedule.id}
                              onClick={(event) => handleDeleteTrashSchedule(schedule, event)}
                            >
                              {deletingScheduleId === schedule.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" aria-label="Xem chi tiết">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
            resetAdjustForm()
            setFixedPaymentId(null)
            setFixedPaymentInfo(null)
          }
        }}
      >
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-[1600px] overflow-y-auto sm:max-w-[1600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-xl">
              <Repeat className="h-5 w-5 text-primary" />
              Chi tiết lịch cố định
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 md:grid-cols-5">
                <Info icon={<User className="h-4 w-4" />} label="Khách hàng" value={`${selected.customerName} · ${selected.customerPhone}`} />
                <Info icon={<User className="h-4 w-4" />} label="Tài khoản" value={selected.user ? `${selected.user.fullName} · ${selected.user.email}` : "Khách vãng lai"} />
                <Info icon={<MapPin className="h-4 w-4" />} label="Sân" value={`${selected.court?.name || "—"} · ${selected.court?.branch?.name || "—"}`} />
                <Info icon={<CalendarDays className="h-4 w-4" />} label="Chu kỳ" value={formatCycle(selected.cycle)} />
                <Info icon={<RefreshCw className="h-4 w-4" />} label="Lượt sửa" value={`${selected.adjustmentUsed || 0}/${selected.adjustmentLimit || 0} đã dùng`} />
              </div>

              <Card className="border-blue-100 bg-blue-50/40">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="fixed-adjustment-limit">Số lượt đổi lịch cố định</Label>
                    <p className="text-xs text-muted-foreground">
                      Nhân viên có thể chỉnh quota đổi lịch cho gói này. Tối thiểu bằng số lượt đã dùng: {selected.adjustmentUsed || 0}.
                    </p>
                  </div>
                  <div className="flex w-full gap-2 md:w-auto">
                    <Input
                      id="fixed-adjustment-limit"
                      type="number"
                      min={selected.adjustmentUsed || 0}
                      max={20}
                      value={adjustmentLimitInput}
                      onChange={(event) => setAdjustmentLimitInput(event.target.value)}
                      className="w-full md:w-28"
                    />
                    <Button
                      type="button"
                      className="shrink-0 gap-2"
                      disabled={savingAdjustmentLimit}
                      onClick={handleSaveAdjustmentLimit}
                    >
                      {savingAdjustmentLimit && <Loader2 className="h-4 w-4 animate-spin" />}
                      Lưu lượt đổi
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <FixedPaymentPanel
                selected={selected}
                selectedPaid={selectedPaid}
                canDeleteTrash={canDeleteTrashSchedule(selected)}
                deletingTrash={deletingScheduleId === selected.id}
                fixedPaymentMethod={fixedPaymentMethod}
                fixedPaymentInfo={fixedPaymentInfo}
                paymentProcessing={paymentProcessing}
                onDeleteTrash={(event) => handleDeleteTrashSchedule(selected, event)}
                onPaymentMethodChange={(method) => {
                  setFixedPaymentMethod(method)
                  setFixedPaymentId(null)
                  setFixedPaymentInfo(null)
                }}
                onConfirmManualPayment={handleConfirmManualPayment}
                onCreateOnlinePayment={handleCreateOnlinePayment}
                onCheckPaymentStatus={handleCheckFixedPaymentStatus}
              />

              <PendingAdjustmentRequests
                adjustments={selected.adjustments || []}
                onReview={handleReviewAdjustmentRequest}
              />

              <div className={cn(
                "rounded-xl border p-3 text-sm",
                adjustmentLeft > 0
                  ? "border-blue-100 bg-blue-50 text-blue-700"
                  : "border-red-100 bg-red-50 text-red-700",
              )}>
                {adjustmentLeft > 0
                  ? `Gói này còn ${adjustmentLeft} lượt điều chỉnh. Mỗi lần báo nghỉ, dời ngày/giờ hoặc đổi sân sẽ tính 1 lượt.`
                  : "Gói này đã hết lượt điều chỉnh. Nhân viên vẫn xem được chi tiết nhưng không thể sửa/dời thêm."}
              </div>

              <FixedScheduleCalendarView occurrences={selected.occurrences || []} />

              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <Card>
                  <CardContent className="space-y-4 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Danh sách buổi</h3>
                        <p className="text-xs text-muted-foreground">
                          Chọn từng buổi để sửa/dời, không thao tác hàng loạt cả gói.
                        </p>
                      </div>
                      <Select value={occurrenceFilter} onValueChange={setOccurrenceFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="adjustable">Có thể sửa</SelectItem>
                          <SelectItem value="all">Tất cả</SelectItem>
                          <SelectItem value="scheduled">Sắp tới</SelectItem>
                          <SelectItem value="rescheduled">Đã dời</SelectItem>
                          <SelectItem value="completed">Hoàn thành</SelectItem>
                          <SelectItem value="missed_checkin">Quên check-in</SelectItem>
                          <SelectItem value="skipped">Báo nghỉ</SelectItem>
                          <SelectItem value="cancelled">Đã hủy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {detailLoading ? (
                      <div className="flex h-48 items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="max-h-[520px] overflow-y-auto rounded-xl border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ngày</TableHead>
                              <TableHead>Giờ</TableHead>
                              <TableHead>Sân</TableHead>
                              <TableHead>Booking</TableHead>
                              <TableHead>Trạng thái</TableHead>
                              <TableHead />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredOccurrences.map(occ => {
                              const canAdjust = selectedPaid && isAdjustableOccurrence(occ) && adjustmentLeft > 0
                              const active = selectedOcc?.id === occ.id
                              const displayStatus = getOccurrenceDisplayStatus(occ)
                              return (
                                <TableRow
                                  key={occ.id}
                                  className={cn(canAdjust && "cursor-pointer", active && "bg-blue-50/60")}
                                  onClick={() => canAdjust && selectOccurrence(occ)}
                                >
                                  <TableCell>
                                    <p className="font-medium">{occ.dayLabel || occ.date}</p>
                                    <p className="text-xs text-muted-foreground">{occ.date}</p>
                                  </TableCell>
                                  <TableCell>{occ.timeStart} - {occ.timeEnd}</TableCell>
                                  <TableCell>{occ.courtName || selected.court?.name || "—"}</TableCell>
                                  <TableCell className="font-mono text-xs">{occ.bookingId?.slice(0, 8) || "—"}</TableCell>
                                  <TableCell>
                                    <Badge className={cn("border", occurrenceStatusClass[displayStatus] || occurrenceStatusClass.scheduled)}>
                                      {occurrenceStatusLabels[displayStatus] || displayStatus}
                                    </Badge>
                                    {displayStatus === "missed_checkin" && (
                                      <p className="mt-1 text-[11px] font-medium text-red-600">
                                        Đã qua giờ, khách chưa check-in
                                      </p>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      size="sm"
                                      variant={active ? "default" : "outline"}
                                      disabled={!canAdjust}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        if (canAdjust) void selectOccurrence(occ)
                                      }}
                                    >
                                      Sửa/dời
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                            {filteredOccurrences.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                                  Không có buổi phù hợp với bộ lọc.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-4 p-4">
                    {!selectedOcc ? (
                      <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                        <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
                        <p className="mt-3 text-sm font-semibold">Chọn một buổi để sửa</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Nhân viên có thể báo nghỉ, dời ngày/giờ hoặc đổi sân cho đúng buổi khách yêu cầu.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-xl border bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground">Buổi đang chọn</p>
                          <p className="font-semibold">{selectedOcc.dayLabel || selectedOcc.date} · {selectedOcc.date}</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedOcc.courtName || selected.court?.name || "—"} · {selectedOcc.timeStart} - {selectedOcc.timeEnd}
                          </p>
                        </div>

                        <div className="grid gap-2">
                          <Label>Loại điều chỉnh</Label>
                          <div className="grid gap-2">
                            <AdjustButton
                              active={adjustType === "reschedule"}
                              icon={<RefreshCw className="h-4 w-4" />}
                              title="Dời ngày/giờ"
                              description="Chuyển buổi này sang ngày hoặc khung giờ khác"
                              onClick={() => {
                                setAdjustType("reschedule")
                                setSlotAvailable(null)
                              }}
                            />
                            <AdjustButton
                              active={adjustType === "change_court"}
                              icon={<MapPin className="h-4 w-4" />}
                              title="Đổi sân"
                              description="Chuyển sang sân khác cùng chi nhánh/loại sân"
                              onClick={() => {
                                setAdjustType("change_court")
                                setSlotAvailable(null)
                              }}
                            />
                            <AdjustButton
                              active={adjustType === "skip"}
                              icon={<SkipForward className="h-4 w-4" />}
                              title="Báo nghỉ"
                              description="Hủy riêng buổi này, không hủy cả gói"
                              onClick={() => {
                                setAdjustType("skip")
                                setSlotAvailable(null)
                              }}
                            />
                          </div>
                        </div>

                        {adjustType === "reschedule" && (
                          <div className="space-y-3">
                            <div className="grid gap-2">
                              <Label>Ngày mới</Label>
                              <Input
                                type="date"
                                value={newDate}
                                min={new Date().toISOString().slice(0, 10)}
                                onChange={(event) => {
                                  setNewDate(event.target.value)
                                  setSlotAvailable(null)
                                }}
                              />
                            </div>
                            <TimeInputs
                              start={newTimeStart}
                              end={newTimeEnd}
                              onStart={(value) => {
                                setNewTimeStart(value)
                                setSlotAvailable(null)
                              }}
                              onEnd={(value) => {
                                setNewTimeEnd(value)
                                setSlotAvailable(null)
                              }}
                            />
                            <SlotCheckButton
                              loading={checkingSlot}
                              available={slotAvailable}
                              onClick={handleCheckSlot}
                            />
                          </div>
                        )}

                        {adjustType === "change_court" && (
                          <div className="space-y-3">
                            <TimeInputs
                              start={newTimeStart}
                              end={newTimeEnd}
                              onStart={(value) => {
                                setNewTimeStart(value)
                                setSlotAvailable(null)
                              }}
                              onEnd={(value) => {
                                setNewTimeEnd(value)
                                setSlotAvailable(null)
                              }}
                            />
                            <div className="grid gap-2">
                              <Label>Sân mới</Label>
                              {loadingCourts ? (
                                <div className="flex h-20 items-center justify-center rounded-xl border">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                </div>
                              ) : courtOptions.length === 0 ? (
                                <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                                  Không có sân khác cùng loại trong chi nhánh.
                                </div>
                              ) : (
                                <div className="grid max-h-44 gap-2 overflow-y-auto">
                                  {courtOptions.map(court => (
                                    <button
                                      key={court.id}
                                      type="button"
                                      onClick={() => {
                                        setNewCourtId(court.id)
                                        setSlotAvailable(null)
                                      }}
                                      className={cn(
                                        "rounded-xl border p-3 text-left text-sm transition",
                                        newCourtId === court.id
                                          ? "border-primary bg-primary/5"
                                          : "hover:border-primary/40",
                                      )}
                                    >
                                      <p className="font-semibold">{court.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {court.branch} · {formatVND(court.price)}/giờ
                                      </p>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <SlotCheckButton
                              loading={checkingSlot}
                              available={slotAvailable}
                              onClick={handleCheckSlot}
                              disabled={!newCourtId}
                            />
                          </div>
                        )}

                        {adjustType && (
                          <>
                            <div className="grid gap-2">
                              <Label>Lý do / ghi chú</Label>
                              <Textarea
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                placeholder="VD: khách bận, đổi sang giờ khác, nhân viên hỗ trợ..."
                                rows={3}
                              />
                            </div>
                            <Button
                              className="w-full gap-2"
                              disabled={submitting || (adjustType !== "skip" && slotAvailable !== true)}
                              onClick={handleSubmitAdjust}
                            >
                              {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : adjustType === "skip" ? (
                                <SkipForward className="h-4 w-4" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                              {adjustType === "skip"
                                ? "Xác nhận báo nghỉ"
                                : adjustType === "change_court"
                                  ? "Xác nhận đổi sân"
                                  : "Xác nhận dời lịch"}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 font-serif text-2xl font-extrabold">{value}</p>
      </CardContent>
    </Card>
  )
}

function getMondayDate(dateStr: string): Date {
  const parts = dateStr.split("-")
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10) - 1
  const d = parseInt(parts[2], 10)
  const dateObj = new Date(y, m, d)
  const day = dateObj.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(dateObj)
  monday.setDate(dateObj.getDate() + diffToMonday)
  return monday
}

function formatDateISO(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function formatDateDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function FixedScheduleCalendarView({
  occurrences,
}: {
  occurrences: FixedOccurrence[]
}) {
  if (!occurrences.length) return null

  // Group occurrences by their week's Monday (represented as ISO date string)
  const weeksMap = new Map<string, typeof occurrences>()
  occurrences.forEach((occ) => {
    const mondayKey = formatDateISO(getMondayDate(occ.date))
    if (!weeksMap.has(mondayKey)) {
      weeksMap.set(mondayKey, [])
    }
    weeksMap.get(mondayKey)!.push(occ)
  })

  const sortedWeeks = Array.from(weeksMap.keys()).sort()

  const WEEKDAYS = [
    { dayNum: 1, label: "Thứ Hai" },
    { dayNum: 2, label: "Thứ Ba" },
    { dayNum: 3, label: "Thứ Tư" },
    { dayNum: 4, label: "Thứ Năm" },
    { dayNum: 5, label: "Thứ Sáu" },
    { dayNum: 6, label: "Thứ Bảy" },
    { dayNum: 0, label: "Chủ Nhật" },
  ]

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-4.5 w-4.5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Lịch cố định dạng tuần</h3>
            <p className="text-xs text-muted-foreground">
              Theo dõi danh sách các buổi đặt theo từng tuần dễ dàng hơn.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[900px] gap-2 text-xs"
            style={{ gridTemplateColumns: "140px repeat(7, minmax(100px, 1fr))" }}
          >
            {/* Header Row */}
            <div className="rounded-lg bg-muted/70 p-2.5 font-bold text-muted-foreground flex flex-col justify-center">
              Khoảng thời gian
            </div>
            {WEEKDAYS.map((wd) => (
              <div key={wd.dayNum} className="rounded-lg bg-muted/70 p-2 text-center font-bold flex flex-col justify-center">
                {wd.label}
              </div>
            ))}

            {/* Rows */}
            {sortedWeeks.map((mondayKey, idx) => {
              const mondayParts = mondayKey.split("-")
              const mondayYear = parseInt(mondayParts[0], 10)
              const mondayMonth = parseInt(mondayParts[1], 10) - 1
              const mondayDay = parseInt(mondayParts[2], 10)
              const mondayDate = new Date(mondayYear, mondayMonth, mondayDay)

              const sundayDate = new Date(mondayDate)
              sundayDate.setDate(mondayDate.getDate() + 6)

              const startStr = formatDateDMY(mondayDate)
              const endStr = formatDateDMY(sundayDate)
              
              const weekOccs = weeksMap.get(mondayKey) || []

              return (
                <Fragment key={mondayKey}>
                  {/* Week Column */}
                  <div className="rounded-lg bg-muted/30 p-2.5 flex flex-col justify-center border border-muted/40 bg-muted/20">
                    <p className="font-bold text-foreground text-sm">Tuần {idx + 1}</p>
                    <div className="text-[10.5px] text-muted-foreground mt-1 space-y-0.5 leading-tight">
                      <p className="whitespace-nowrap font-medium">{startStr}</p>
                      <p className="text-gray-400">đến</p>
                      <p className="whitespace-nowrap font-medium">{endStr}</p>
                    </div>
                  </div>

                  {/* Day Columns */}
                  {WEEKDAYS.map((wd) => {
                    const dayOccs = weekOccs.filter((occ) => {
                      const parts = occ.date.split("-")
                      const y = parseInt(parts[0], 10)
                      const m = parseInt(parts[1], 10) - 1
                      const d = parseInt(parts[2], 10)
                      const dateObj = new Date(y, m, d)
                      return dateObj.getDay() === wd.dayNum
                    })

                    // Sort day occurrences by start time
                    dayOccs.sort((a, b) => a.timeStart.localeCompare(b.timeStart))

                    return (
                      <div
                        key={wd.dayNum}
                        className={cn(
                          "min-h-[72px] rounded-lg border p-2 flex flex-col justify-center gap-1.5",
                          dayOccs.length > 0
                            ? "border-solid border-border/80 bg-background"
                            : "border-dashed border-border/40 bg-muted/5 text-muted-foreground/30 text-center flex items-center justify-center font-medium"
                        )}
                      >
                        {dayOccs.length > 0 ? (
                          dayOccs.map((occ) => {
                            const displayStatus = getOccurrenceDisplayStatus(occ)
                            const isCompleted = displayStatus === "completed"
                            const isMissedCheckin = displayStatus === "missed_checkin"
                            const isSkipped = displayStatus === "skipped" || displayStatus === "cancelled"
                            const isRescheduled = displayStatus === "rescheduled"
                            return (
                              <div
                                key={occ.id}
                                className={cn(
                                  "rounded-lg p-2 text-left border text-[11px] leading-snug shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:scale-[1.01]",
                                  isCompleted
                                    ? "border-blue-200 bg-blue-50/70 text-blue-800"
                                    : isMissedCheckin
                                      ? "border-red-200 bg-red-50/80 text-red-800"
                                      : isSkipped
                                        ? "border-gray-200 bg-gray-50 text-gray-400 line-through opacity-75"
                                        : isRescheduled
                                          ? "border-amber-200 bg-amber-50/70 text-amber-800"
                                          : "border-green-200 bg-green-50/70 text-green-800"
                                )}
                              >
                                <div className="font-bold flex items-center justify-between gap-1">
                                  <span className="truncate">{occ.courtName || "Sân"}</span>
                                  <span className={cn(
                                    "text-[9px] px-1 py-0.2 rounded font-semibold shrink-0 uppercase tracking-wider scale-90 origin-right",
                                    isCompleted ? "bg-blue-100 text-blue-700" :
                                    isMissedCheckin ? "bg-red-100 text-red-700" :
                                    isSkipped ? "bg-gray-200 text-gray-500" :
                                    isRescheduled ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                                  )}>
                                    {occurrenceStatusLabels[displayStatus] || displayStatus}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                  {occ.timeStart}–{occ.timeEnd}
                                </p>
                              </div>
                            )
                          })
                        ) : (
                          <span className="text-[11px]">—</span>
                        )}
                      </div>
                    )
                  })}
                </Fragment>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PendingAdjustmentRequests({
  adjustments,
  onReview,
}: {
  adjustments: NonNullable<FixedScheduleDetail["adjustments"]>
  onReview: (adjustmentId: string, approve: boolean, reason?: string) => Promise<void>
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const pending = adjustments.filter((item) =>
    item.note?.startsWith("[CUSTOMER_ADJUST_REQUEST_PENDING]"),
  )

  if (pending.length === 0) return null

  const submitReview = async (adjustmentId: string, approve: boolean) => {
    const reason = rejectReason.trim()
    if (!approve && !reason) {
      toast.error("Vui lòng nhập lý do từ chối")
      return
    }

    setReviewingId(adjustmentId)
    try {
      await onReview(adjustmentId, approve, approve ? undefined : reason)
      setRejectingId(null)
      setRejectReason("")
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardContent className="space-y-3 p-4">
        <div>
          <h3 className="font-bold text-blue-950">Yêu cầu điều chỉnh từ khách</h3>
          <p className="text-xs text-blue-800">
            Khách chỉ gửi yêu cầu. Nhân viên duyệt thì hệ thống mới áp dụng thay đổi.
          </p>
        </div>
        <div className="space-y-2">
          {pending.map((request) => (
            <div key={request.id} className="rounded-xl border bg-white p-3">
              <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                <p><span className="font-semibold text-foreground">Loại:</span> {request.type}</p>
                <p><span className="font-semibold text-foreground">Ngày mới:</span> {request.newDate ? normalizeDateInput(request.newDate) : "—"}</p>
                <p><span className="font-semibold text-foreground">Giờ mới:</span> {request.newTimeStart || "—"} – {request.newTimeEnd || "—"}</p>
                <p><span className="font-semibold text-foreground">Sân mới:</span> {request.newCourtId || "—"}</p>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {request.note?.replace("[CUSTOMER_ADJUST_REQUEST_PENDING]", "").trim() || "Không có ghi chú"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={reviewingId === request.id}
                  onClick={() => submitReview(request.id, true)}
                >
                  {reviewingId === request.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Duyệt & áp dụng
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={reviewingId === request.id}
                  onClick={() => {
                    setRejectingId(request.id)
                    setRejectReason("")
                  }}
                >
                  <XCircle className="h-4 w-4" /> Từ chối
                </Button>
              </div>
              {rejectingId === request.id && (
                <form
                  className="mt-3 space-y-2 rounded-xl border border-red-200 bg-red-50 p-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void submitReview(request.id, false)
                  }}
                >
                  <div className="space-y-1">
                    <Label htmlFor={`reject-reason-${request.id}`} className="text-xs font-semibold text-red-700">
                      Lý do từ chối <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id={`reject-reason-${request.id}`}
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="Ví dụ: Khung giờ mới đã có lịch, vui lòng chọn giờ khác."
                      className="min-h-24 bg-white"
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={reviewingId === request.id}
                      onClick={() => {
                        setRejectingId(null)
                        setRejectReason("")
                      }}
                    >
                      Hủy
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      variant="destructive"
                      disabled={reviewingId === request.id || !rejectReason.trim()}
                      className="gap-2"
                    >
                      {reviewingId === request.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      Xác nhận từ chối
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function FixedPaymentPanel({
  selected,
  selectedPaid,
  canDeleteTrash,
  deletingTrash,
  fixedPaymentMethod,
  fixedPaymentInfo,
  paymentProcessing,
  onDeleteTrash,
  onPaymentMethodChange,
  onConfirmManualPayment,
  onCreateOnlinePayment,
  onCheckPaymentStatus,
}: {
  selected: FixedScheduleDetail
  selectedPaid: boolean
  canDeleteTrash: boolean
  deletingTrash: boolean
  fixedPaymentMethod: string
  fixedPaymentInfo: {
    qrImageUrl?: string
    bankCode?: string
    accountNumber?: string
    transferContent?: string
    amount?: number
    payUrl?: string | null
    checkoutUrl?: string | null
    formFields?: Record<string, unknown> | null
  } | null
  paymentProcessing: boolean
  onDeleteTrash: (event: MouseEvent) => void
  onPaymentMethodChange: (method: string) => void
  onConfirmManualPayment: () => void
  onCreateOnlinePayment: () => void
  onCheckPaymentStatus: () => void
}) {
  return (
    <Card className={cn("border", selectedPaid ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/60")}>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold">Thanh toán lịch cố định</h3>
              <FixedScheduleStatusBadge schedule={selected} />
              {canDeleteTrash && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={deletingTrash}
                  onClick={onDeleteTrash}
                >
                  {deletingTrash ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Xóa hóa đơn rác
                </Button>
              )}
            </div>
            <div className="mt-2 grid gap-1 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
              <p>Mã hóa đơn: <span className="font-mono font-semibold text-foreground">{selected.invoice?.code || scheduleCode(selected)}</span></p>
              <p>Số tiền: <span className="font-semibold text-foreground">{formatVND(Number(selected.invoice?.totalSnapshot || selected.totalAmountSnapshot || 0))}</span></p>
              <p>Phương thức: <span className="font-semibold text-foreground">{paymentLabels[selected.invoice?.paymentMethod || selected.paymentMethod || ""] || selected.invoice?.paymentMethod || selected.paymentMethod || "—"}</span></p>
            </div>
            {!selectedPaid && (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Gói chưa thanh toán nên chưa được sửa/dời buổi. Nhân viên cần xác nhận thanh toán hoặc tạo phiên thanh toán trước.
              </p>
            )}
          </div>

          {!selectedPaid && (
            <div className="w-full space-y-3 rounded-xl border bg-white/80 p-3 xl:max-w-[560px]">
              <Label>Phương thức thanh toán</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {fixedPaymentMethods.map(method => {
                  const Icon = method.icon
                  const active = fixedPaymentMethod === method.value
                  return (
                    <button
                      key={method.value}
                      type="button"
                      className={cn(
                        "rounded-xl border p-3 text-left transition",
                        active ? "border-primary bg-primary/5" : "hover:border-primary/40",
                      )}
                      onClick={() => onPaymentMethodChange(method.value)}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Icon className="h-4 w-4" />
                        {method.label}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{method.desc}</span>
                    </button>
                  )
                })}
              </div>

              {fixedPaymentInfo?.qrImageUrl && (
                <div className="grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-[120px_1fr]">
                  <img src={fixedPaymentInfo.qrImageUrl} alt="QR thanh toán lịch cố định" className="h-28 w-28 rounded-lg border object-contain" />
                  <div className="space-y-1 text-xs">
                    <p><span className="text-muted-foreground">Ngân hàng:</span> <strong>{fixedPaymentInfo.bankCode}</strong></p>
                    <p><span className="text-muted-foreground">Số TK:</span> <strong>{fixedPaymentInfo.accountNumber}</strong></p>
                    <p><span className="text-muted-foreground">Nội dung:</span> <strong>{fixedPaymentInfo.transferContent}</strong></p>
                    <p><span className="text-muted-foreground">Số tiền:</span> <strong>{formatVND(Number(fixedPaymentInfo.amount || selected.invoice?.totalSnapshot || 0))}</strong></p>
                  </div>
                </div>
              )}

              {fixedPaymentInfo && !fixedPaymentInfo.qrImageUrl && !fixedPaymentInfo.payUrl && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Đã tạo phiên thanh toán nhưng backend không trả về QR hoặc link thanh toán. Với SePay, hãy kiểm tra cấu hình VietQR/checkout trong file env; với VNPay/MoMo, kiểm tra cấu hình cổng thanh toán.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {fixedPaymentMethod === "cash" || fixedPaymentMethod === "bank_transfer" ? (
                  <Button className="gap-2" disabled={paymentProcessing} onClick={onConfirmManualPayment}>
                    {paymentProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Xác nhận đã thanh toán
                  </Button>
                ) : (
                  <>
                    <Button className="gap-2" disabled={paymentProcessing} onClick={onCreateOnlinePayment}>
                      {paymentProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      Tạo thanh toán
                    </Button>
                    <Button variant="outline" className="gap-2" disabled={paymentProcessing} onClick={onCheckPaymentStatus}>
                      <RefreshCw className="h-4 w-4" />
                      Kiểm tra trạng thái
                    </Button>
                    {fixedPaymentInfo?.payUrl && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (fixedPaymentInfo.checkoutUrl && fixedPaymentInfo.formFields) {
                            submitPaymentForm(fixedPaymentInfo.checkoutUrl, fixedPaymentInfo.formFields)
                            return
                          }
                          window.open(fixedPaymentInfo.payUrl || "", "_blank", "noopener,noreferrer")
                        }}
                      >
                        Mở lại cổng thanh toán
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  )
}

function AdjustButton({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 text-left transition",
        active ? "border-primary bg-primary/5" : "hover:border-primary/40",
      )}
    >
      <span className={cn("mt-0.5", active ? "text-primary" : "text-muted-foreground")}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}

function TimeInputs({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string
  end: string
  onStart: (value: string) => void
  onEnd: (value: string) => void
}) {
  return (
    <div className="grid gap-2">
      <Label>Khung giờ</Label>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Input type="time" value={start} onChange={(event) => onStart(event.target.value)} />
        <span className="text-xs text-muted-foreground">đến</span>
        <Input type="time" value={end} onChange={(event) => onEnd(event.target.value)} />
      </div>
    </div>
  )
}

function SlotCheckButton({
  loading,
  available,
  disabled,
  onClick,
}: {
  loading: boolean
  available: boolean | null
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <div className="space-y-2">
      <Button variant="outline" className="w-full gap-2" disabled={loading || disabled} onClick={onClick}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        Kiểm tra khả dụng
      </Button>
      {available !== null && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium",
            available ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700",
          )}
        >
          {available ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {available ? "Khung giờ này còn trống" : "Khung giờ/sân này đã bị đặt"}
        </div>
      )}
    </div>
  )
}
