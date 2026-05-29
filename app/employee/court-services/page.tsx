"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { branchApi, bookingApi, courtApi, inventoryApi, type ApiCourt } from "@/lib/api"
import { formatBookingReference, formatVND } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Printer,
  RefreshCw,
  Star,
  Users,
  Wallet,
} from "lucide-react"
import { printCourtServiceInvoice } from "@/lib/print-utils"
import { type CourtServiceCheckoutMetaByBooking } from "@/lib/court-services-storage"

type Court = ApiCourt
type ServiceCategory = "racket" | "apparel" | "water" | "shoes"

interface ServiceOption {
  key: string
  name: string
  price: number
  category: ServiceCategory
  sku?: string
  sourceWarehouseId?: number
  sourceWarehouseLabel?: string
  sourceIsHub?: boolean
}

interface ServiceLine extends ServiceOption {
  qty: number
  staffNote?: string
}

interface InventoryCatalogItem {
  sku: string
  name: string
  category: string
  warehouse: string
  warehouse_name?: string
  warehouseId?: number
  warehouse_id?: number
  available?: number
  isHub?: boolean
  is_hub?: boolean
}

interface BookingItem {
  bookingId: string
  courtId: number
  bookingDate: string
  timeStart: string
  timeEnd: string
  status: "booked" | "hold"
  customerName: string
  customerPhone: string
  bookingCode: string
  placedBy: string
  amount: number
  serviceLines: ServiceLine[]
  servicePaidHash: string | null
  servicePaidAt: string | null
}

const SERVICE_OPTIONS: ServiceOption[] = [
  { key: "default-racket", name: "Thue vot", price: 30000, category: "racket" },
  { key: "default-apparel", name: "Thue ao quan", price: 40000, category: "apparel" },
  { key: "default-shoes", name: "Thue giay", price: 35000, category: "shoes" },
  { key: "default-water", name: "Mua nuoc", price: 10000, category: "water" },
]

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  water: "Nuoc uong",
  racket: "Vot",
  apparel: "Ao quan",
  shoes: "Giay",
}

const CATEGORY_DEFAULT_PRICE: Record<ServiceCategory, number> = {
  water: 10000,
  racket: 30000,
  apparel: 40000,
  shoes: 35000,
}

const SERVICE_CATEGORY_ORDER: ServiceCategory[] = ["water", "racket", "apparel", "shoes"]
const MAX_RENTAL_ITEMS_PER_CATEGORY = 2
const RENTAL_CATEGORY_SET = new Set<ServiceCategory>(["racket", "apparel", "shoes"])

function getCategoryLimit(category: ServiceCategory) {
  return RENTAL_CATEGORY_SET.has(category) ? MAX_RENTAL_ITEMS_PER_CATEGORY : null
}

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function resolveServiceCategory(category: string, name: string): ServiceCategory | null {
  const normalizedCategory = normalizeText(category)
  const normalizedName = normalizeText(name)
  const combined = `${normalizedCategory} ${normalizedName}`

  if (combined.includes("nuoc") || combined.includes("drink") || combined.includes("chai")) return "water"
  if (combined.includes("vot") || combined.includes("racket")) return "racket"
  if (combined.includes("quan ao") || combined.includes("ao") || combined.includes("quan")) return "apparel"
  if (combined.includes("giay") || combined.includes("shoe")) return "shoes"

  return null
}

function isServiceNameValidForCategory(category: ServiceCategory, name: string) {
  const normalized = normalizeText(name)

  if (category === "water") {
    return normalized.includes("nuoc") || normalized.includes("drink") || normalized.includes("chai")
  }

  if (category === "racket") {
    const isRacket = normalized.includes("vot") || normalized.includes("racket")
    const isAccessory = normalized.includes("balo") || normalized.includes("bag") || normalized.includes("tui") || normalized.includes("bao")
    return isRacket && !isAccessory
  }

  if (category === "apparel") {
    return normalized.includes("quan") || normalized.includes("ao") || normalized.includes("shirt") || normalized.includes("short")
  }

  return normalized.includes("giay") || normalized.includes("shoe") || normalized.includes("sneaker")
}

function formatDateInput(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function toMinuteOfDay(time: string) {
  const [hour, minute] = String(time || "00:00").split(":")
  const h = Number.parseInt(hour || "0", 10)
  const m = Number.parseInt(minute || "0", 10)
  return h * 60 + m
}

function getBranchFromWarehouse(warehouse: string | undefined, branches: { id: number; name: string }[]) {
  if (!warehouse) return null
  const area = warehouse.replace("Kho ", "")
  return branches.find((branch) => branch.name.includes(area))?.name || null
}

function buildServiceHash(lines: ServiceLine[]) {
  return JSON.stringify(
    [...lines]
      .map((line) => ({
        key: line.key,
        qty: line.qty,
        price: line.price,
        note: line.staffNote || "",
        sku: line.sku || "",
        warehouseId: line.sourceWarehouseId || 0,
      }))
      .sort((left, right) => `${left.key}-${left.note}`.localeCompare(`${right.key}-${right.note}`))
  )
}

export default function EmployeeCourtServicesPage() {
  const { user } = useAuth()
  const [courts, setCourts] = useState<Court[]>([])
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([])
  const [now, setNow] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [servicesByBooking, setServicesByBooking] = useState<Record<string, ServiceLine[]>>({})
  const [savedServicesByBooking, setSavedServicesByBooking] = useState<Record<string, ServiceLine[]>>({})
  const [checkoutMetaByBooking, setCheckoutMetaByBooking] = useState<CourtServiceCheckoutMetaByBooking>({})
  const [dirtyBookings, setDirtyBookings] = useState<Record<string, boolean>>({})
  const dirtyBookingsRef = useRef<Record<string, boolean>>({})
  const [warehouseServiceCatalog, setWarehouseServiceCatalog] = useState<ServiceOption[]>([])
  const [hubWarehouseId, setHubWarehouseId] = useState<number | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  useEffect(() => {
    courtApi.getAll().then((data) => {
      if (Array.isArray(data)) setCourts(data)
    }).catch(() => setCourts([]))

    branchApi.getAll().then((data: any) => {
      if (Array.isArray(data)) {
        setBranches(data.map((branch: any) => ({ id: branch.id, name: branch.name })))
      }
    }).catch(() => setBranches([]))
  }, [])

  const employeeBranch = useMemo(
    () => getBranchFromWarehouse(user?.warehouse, branches),
    [user?.warehouse, branches]
  )

  const branchCourts = useMemo(() => {
    if (!employeeBranch) return []
    return courts.filter((court) => court.branch === employeeBranch)
  }, [courts, employeeBranch])

  useEffect(() => {
    dirtyBookingsRef.current = dirtyBookings
  }, [dirtyBookings])

  useEffect(() => {
    let active = true

    const loadWarehouseCatalog = async () => {
      try {
        const response: any = await inventoryApi.getAll()
        const rows: InventoryCatalogItem[] = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
          ? response
          : []

        const hubRow = rows.find((item) => Boolean(item.isHub ?? item.is_hub))
        const resolvedHubId = Number(hubRow?.warehouseId ?? hubRow?.warehouse_id ?? 0) || null
        if (active) {
          setHubWarehouseId(resolvedHubId)
        }

        const scopedRows = rows.filter((item) => {
          const warehouseId = Number(item.warehouseId ?? item.warehouse_id ?? 0)
          const warehouseName = item.warehouse || item.warehouse_name || ""
          const itemIsHub = Boolean(item.isHub ?? item.is_hub)

          if (typeof user?.warehouseId === "number" && warehouseId > 0) {
            return warehouseId === Number(user.warehouseId) || itemIsHub
          }
          if (user?.warehouse && warehouseName) {
            return warehouseName === user.warehouse || itemIsHub
          }
          return itemIsHub || true
        })

        const dynamicOptions = scopedRows
          .filter((item) => Number(item.available || 0) > 0)
          .reduce<ServiceOption[]>((accumulator, item) => {
            const category = resolveServiceCategory(item.category, item.name)
            if (!category) return accumulator
            if (!isServiceNameValidForCategory(category, item.name)) return accumulator
            const warehouseId = Number(item.warehouseId ?? item.warehouse_id ?? 0) || undefined
            const itemIsHub = Boolean(item.isHub ?? item.is_hub)
            const sourceLabel = itemIsHub ? "Tong kho" : "Kho chi nhanh"
            accumulator.push({
              key: `inventory-${item.sku}-${warehouseId || "na"}`,
              sku: item.sku,
              name: `${item.name} (${sourceLabel})`,
              price: CATEGORY_DEFAULT_PRICE[category],
              category,
              sourceWarehouseId: warehouseId,
              sourceWarehouseLabel: sourceLabel,
              sourceIsHub: itemIsHub,
            })
            return accumulator
          }, [])

        const uniqueMap = new Map<string, ServiceOption>()
        for (const option of dynamicOptions) {
          if (!uniqueMap.has(option.key)) {
            uniqueMap.set(option.key, option)
          }
        }

        const finalCatalog = uniqueMap.size > 0 ? Array.from(uniqueMap.values()) : SERVICE_OPTIONS
        if (active) {
          setWarehouseServiceCatalog(finalCatalog)
        }
      } catch {
        if (active) {
          setWarehouseServiceCatalog(SERVICE_OPTIONS)
        }
      }
    }

    loadWarehouseCatalog()

    return () => {
      active = false
    }
  }, [user?.warehouseId, user?.warehouse])

  const fetchBookings = useCallback(async () => {
    if (!employeeBranch) {
      setBookings([])
      return
    }

    setIsSyncing(true)
    const date = formatDateInput(selectedDate)
    try {
      const res = await bookingApi.getAll({ date, limit: 2000 }) as any
      const bookingRows = res.bookings || []
      const branchCourtIds = new Set(branchCourts.map((court) => court.id))
      const mapped: BookingItem[] = bookingRows
        .filter((booking: any) => branchCourtIds.has(booking.courtId) && booking.status !== "cancelled")
        .map((booking: any) => ({
          bookingId: booking.id,
          courtId: booking.courtId,
          bookingDate: booking.bookingDate,
          timeStart: booking.timeStart,
          timeEnd: booking.timeEnd,
          status: booking.status === "hold" ? "hold" : "booked",
          customerName: booking.customerName || "Khach",
          customerPhone: booking.customerPhone || "",
          bookingCode: booking.bookingCode || "",
          placedBy: booking.placedBy || "",
          amount: Number(booking.amount || 0),
          serviceLines: Array.isArray(booking.serviceLines) ? booking.serviceLines : [],
          servicePaidHash: booking.servicePaidHash || null,
          servicePaidAt: booking.servicePaidAt || null,
        }))
      setBookings(mapped)
      const savedMap: Record<string, ServiceLine[]> = {}
      const metaMap: CourtServiceCheckoutMetaByBooking = {}
      for (const booking of mapped) {
        savedMap[booking.bookingId] = booking.serviceLines || []
        const savedHash = buildServiceHash(booking.serviceLines || [])
        metaMap[booking.bookingId] = {
          savedHash,
          paidHash: booking.servicePaidHash || undefined,
          paidAt: booking.servicePaidAt || undefined,
        }
      }
      setSavedServicesByBooking(savedMap)
      setCheckoutMetaByBooking(metaMap)
      setServicesByBooking((previous) => {
        const next: Record<string, ServiceLine[]> = {}
        for (const booking of mapped) {
          next[booking.bookingId] = dirtyBookingsRef.current[booking.bookingId]
            ? (previous[booking.bookingId] || [])
            : (savedMap[booking.bookingId] || [])
        }
        return next
      })
      setLastSyncedAt(new Date())
    } catch {
      setBookings([])
    } finally {
      setIsSyncing(false)
    }
  }, [branchCourts, employeeBranch, selectedDate])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  useEffect(() => {
    if (!employeeBranch) return
    const intervalId = window.setInterval(() => {
      fetchBookings()
    }, 10000)
    return () => window.clearInterval(intervalId)
  }, [employeeBranch, fetchBookings])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  const currentTimeLabel = useMemo(
    () => now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    [now]
  )
  const isSelectedDateToday = useMemo(() => isSameDay(selectedDate, now), [selectedDate, now])

  const bookingsByCourt = useMemo(() => {
    const record: Record<number, BookingItem[]> = {}
    for (const court of branchCourts) {
      record[court.id] = bookings
        .filter((booking) => booking.courtId === court.id)
        .sort((left, right) => left.timeStart.localeCompare(right.timeStart))
    }
    return record
  }, [bookings, branchCourts])

  const courtNameById = useMemo(() => {
    const map: Record<number, string> = {}
    for (const court of branchCourts) {
      map[court.id] = court.name
    }
    return map
  }, [branchCourts])

  const getServiceTotalForBooking = useCallback((bookingId: string) => {
    return (servicesByBooking[bookingId] || []).reduce((sum, line) => sum + line.price * line.qty, 0)
  }, [servicesByBooking])

  const getBookingServiceHash = useCallback((bookingId: string) => {
    return buildServiceHash(servicesByBooking[bookingId] || [])
  }, [servicesByBooking])

  const getBookingCheckoutStatus = useCallback((bookingId: string) => {
    const lines = servicesByBooking[bookingId] || []
    if (lines.length === 0) return "empty" as const

    const hash = getBookingServiceHash(bookingId)
    const savedHash = buildServiceHash(savedServicesByBooking[bookingId] || [])
    const meta = checkoutMetaByBooking[bookingId]

    if (meta?.paidHash && meta.paidHash === hash) return "paid" as const
    if (savedHash === hash) return "saved" as const
    return "draft" as const
  }, [checkoutMetaByBooking, getBookingServiceHash, savedServicesByBooking, servicesByBooking])

  const courtRevenueCurrentDate = useMemo(() => {
    return bookings.reduce((sum, booking) => sum + booking.amount, 0)
  }, [bookings])

  const serviceRevenueCurrentDate = useMemo(() => {
    return bookings.reduce((sum, booking) => sum + getServiceTotalForBooking(booking.bookingId), 0)
  }, [bookings, getServiceTotalForBooking])

  const serviceCatalogByCategory = useMemo(() => {
    const grouped: Record<ServiceCategory, ServiceOption[]> = {
      water: [],
      racket: [],
      apparel: [],
      shoes: [],
    }

    for (const option of warehouseServiceCatalog) {
      grouped[option.category].push(option)
    }

    for (const category of SERVICE_CATEGORY_ORDER) {
      const limit = getCategoryLimit(category)
      const sorted = grouped[category]
        .sort((left, right) => {
          const sourceOrder = Number(Boolean(left.sourceIsHub)) - Number(Boolean(right.sourceIsHub))
          if (sourceOrder !== 0) return sourceOrder
          return left.name.localeCompare(right.name)
        })

      grouped[category] = typeof limit === "number" ? sorted.slice(0, limit) : sorted
    }

    return grouped
  }, [warehouseServiceCatalog])

  const endedBookings = useMemo(() => {
    const selectedDateLabel = formatDateInput(selectedDate)
    const nowDateLabel = formatDateInput(now)
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    return bookings.filter((booking) => {
      if (selectedDateLabel < nowDateLabel) return true
      if (selectedDateLabel > nowDateLabel) return false
      return toMinuteOfDay(booking.timeEnd) <= nowMinutes
    })
  }, [bookings, selectedDate, now])

  const endSessionServiceTotal = useMemo(() => {
    return endedBookings.reduce((sum, booking) => sum + getServiceTotalForBooking(booking.bookingId), 0)
  }, [endedBookings, getServiceTotalForBooking])

  const getCurrentBooking = useCallback((courtId: number) => {
    if (!isSelectedDateToday) return undefined
    const rows = bookingsByCourt[courtId] || []
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    return rows.find((booking) => {
      const startMinutes = toMinuteOfDay(booking.timeStart)
      const endMinutes = toMinuteOfDay(booking.timeEnd)
      return nowMinutes >= startMinutes && nowMinutes < endMinutes
    })
  }, [bookingsByCourt, isSelectedDateToday, now])

  const occupiedCourtsAtCurrentHour = useMemo(() => {
    if (!isSelectedDateToday) return 0
    return branchCourts.reduce((total, court) => {
      return total + (getCurrentBooking(court.id) ? 1 : 0)
    }, 0)
  }, [branchCourts, getCurrentBooking, isSelectedDateToday])

  const resolveServiceWarehouseId = useCallback((service: ServiceOption | ServiceLine) => {
    if (service.sourceWarehouseId) {
      return service.sourceWarehouseId
    }
    if (service.category !== "water") return null
    const sameSkuHub = warehouseServiceCatalog.find((item) =>
      item.category === "water" && item.sourceIsHub && item.sku && item.sku === service.sku && item.sourceWarehouseId
    )
    if (sameSkuHub?.sourceWarehouseId) {
      return sameSkuHub.sourceWarehouseId
    }
    return hubWarehouseId
  }, [warehouseServiceCatalog, hubWarehouseId])

  const exportWaterFromHub = useCallback(async (booking: BookingItem, service: ServiceOption, staffNote?: string) => {
    if (service.category !== "water") return true
    if (!service.sku) {
      toast.error("Máº«u nÆ°á»›c chÆ°a cÃ³ SKU nÃªn chÆ°a thá»ƒ trá»« kho.")
      return false
    }

    const warehouseId = resolveServiceWarehouseId(service)
    if (!warehouseId) {
      toast.error("KhÃ´ng tÃ¬m tháº¥y Tá»•ng kho Ä‘á»ƒ trá»« nÆ°á»›c.")
      return false
    }

    const response: any = await inventoryApi.exportStock({
      warehouse_id: warehouseId,
      sku: service.sku,
      quantity: 1,
      note: `DV sÃ¢n ${booking.bookingCode || booking.bookingId} | ${service.name}${staffNote ? ` | ${staffNote}` : ""}`,
    })

    if (!response?.success) {
      toast.error(response?.message || "Trá»« tá»“n tá»•ng kho tháº¥t báº¡i.")
      return false
    }

    return true
  }, [resolveServiceWarehouseId])

  const addService = useCallback((bookingId: string, service: ServiceOption, staffNote?: string) => {
    const normalizedNote = String(staffNote || "").trim()
    setServicesByBooking((previous) => {
      const current = previous[bookingId] || []
      const exists = current.find(
        (line) => line.key === service.key && (line.staffNote || "") === normalizedNote
      )
      const next = exists
        ? current.map((line) =>
            line.key === service.key && (line.staffNote || "") === normalizedNote
              ? { ...line, qty: line.qty + 1 }
              : line
          )
        : [...current, { ...service, qty: 1, staffNote: normalizedNote || undefined }]
      return { ...previous, [bookingId]: next }
    })
    setDirtyBookings((previous) => ({ ...previous, [bookingId]: true }))
    toast.success(`Da them: ${service.name}`)
  }, [])

  const addServiceWithStaffNote = useCallback(async (booking: BookingItem, service: ServiceOption) => {
    const categoryLimit = getCategoryLimit(service.category)
    const currentCategoryQty = (servicesByBooking[booking.bookingId] || [])
      .filter((line) => line.category === service.category)
      .reduce((sum, line) => sum + line.qty, 0)

    if (typeof categoryLimit === "number" && currentCategoryQty >= categoryLimit) {
      toast.error(`Danh muc ${CATEGORY_LABELS[service.category]} chi cho thue toi da ${categoryLimit} san pham moi san.`)
      return
    }

    const staffNote = window.prompt(`Ghi chu nhan vien cho ${service.name} (tuy chon):`, "") || ""
    addService(booking.bookingId, service, staffNote)
  }, [addService, servicesByBooking])

  const saveBookingServices = useCallback(async (bookingId: string) => {
    const lines = servicesByBooking[bookingId] || []
    const response = await bookingApi.updateServices(bookingId, {
      service_lines: lines,
      paid_hash: null,
      paid_at: null,
    })
    if (!response.success || !response.booking) {
      toast.error(response.error || "Khong the luu dich vu vao he thong.")
      return
    }

    const savedLines = (response.booking.serviceLines || []) as ServiceLine[]
    const savedHash = buildServiceHash(savedLines)
    setSavedServicesByBooking((previous) => ({ ...previous, [bookingId]: savedLines }))
    setServicesByBooking((previous) => ({ ...previous, [bookingId]: savedLines }))
    setCheckoutMetaByBooking((previous) => ({
      ...previous,
      [bookingId]: {
        savedHash,
        paidHash: response.booking?.servicePaidHash || undefined,
        paidAt: response.booking?.servicePaidAt || undefined,
      },
    }))
    setDirtyBookings((previous) => ({ ...previous, [bookingId]: false }))
    toast.success("Da luu danh sach dich vu vao DB.")
  }, [servicesByBooking])

  const checkoutBookingServices = useCallback(async (booking: BookingItem) => {
    const bookingId = booking.bookingId
    const lines = servicesByBooking[bookingId] || []
    if (lines.length === 0) {
      toast.error("Booking nay chua co dich vu de thanh toan.")
      return
    }

    const hash = getBookingServiceHash(bookingId)
    const savedHash = buildServiceHash(savedServicesByBooking[bookingId] || [])
    const meta = checkoutMetaByBooking[bookingId]
    if (!savedHash || savedHash !== hash) {
      toast.error("Hay bam Luu dich vu truoc khi thanh toan.")
      return
    }
    if (meta?.paidHash === hash) {
      toast.error("Booking nay da duoc thanh toan dich vu.")
      return
    }

    for (const line of lines) {
      if (!line.sku) continue

      const warehouseId = resolveServiceWarehouseId(line)
      if (!warehouseId) {
        toast.error(`Khong tim thay kho de tru ${line.name}.`)
        return
      }

      const response: any = await inventoryApi.exportStock({
        warehouse_id: warehouseId,
        sku: line.sku,
        quantity: line.qty,
        note: `DV san ${booking.bookingCode || booking.bookingId} | ${line.name}${line.staffNote ? ` | ${line.staffNote}` : ""}`,
      })

      if (!response?.success) {
        toast.error(response?.message || `Tru kho that bai cho ${line.name}.`)
        return
      }
    }

    const paidAt = new Date().toISOString()
    const response = await bookingApi.updateServices(bookingId, {
      service_lines: lines,
      paid_hash: hash,
      paid_at: paidAt,
    })
    if (!response.success || !response.booking) {
      toast.error(response.error || "Khong the cap nhat thanh toan dich vu.")
      return
    }

    setSavedServicesByBooking((previous) => ({ ...previous, [bookingId]: lines }))
    setCheckoutMetaByBooking((previous) => ({
      ...previous,
      [bookingId]: {
        savedHash: hash,
        paidHash: hash,
        paidAt,
      },
    }))
    setDirtyBookings((previous) => ({ ...previous, [bookingId]: false }))
    toast.success("Da thanh toan va tru kho dich vu.")
  }, [checkoutMetaByBooking, getBookingServiceHash, resolveServiceWarehouseId, savedServicesByBooking, servicesByBooking])

  const handlePrintServiceInvoice = useCallback((booking: BookingItem) => {
    const lines = servicesByBooking[booking.bookingId] || []
    const serviceTotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0)
    const courtFee = booking.amount || 0
    printCourtServiceInvoice({
      code: `DV-${formatBookingReference(booking.bookingCode || booking.bookingId)}`,
      date: `${booking.bookingDate} ${now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`,
      customerName: booking.customerName || "KhÃ¡ch",
      customerPhone: booking.customerPhone || undefined,
      courtName: courtNameById[booking.courtId] || `SÃ¢n #${booking.courtId}`,
      timeSlot: `${booking.timeStart} - ${booking.timeEnd}`,
      courtFee,
      services: lines.map((line) => ({
        name: line.name,
        qty: line.qty,
        price: line.price,
        note: line.staffNote,
      })),
      serviceTotal,
      total: courtFee + serviceTotal,
      printedBy: user?.fullName || "NhÃ¢n viÃªn",
    })
  }, [servicesByBooking, now, courtNameById, user?.fullName])

  const clearServices = useCallback((bookingId: string) => {
    setServicesByBooking((previous) => {
      const next = { ...previous }
      next[bookingId] = []
      return next
    })
    setDirtyBookings((previous) => ({ ...previous, [bookingId]: true }))
    toast.success("Da xoa danh sach dich vu tam thoi.")
  }, [])

  const shiftDate = (amount: number) => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + amount)
    setSelectedDate(next)
  }

  if (!employeeBranch) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Building2 className="h-10 w-10 opacity-40 mb-3" />
        <p className="text-sm">Khong xac dinh duoc chi nhanh tu kho nhan vien.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Dich vu tai san</h1>
          <p className="text-sm text-muted-foreground">Moi san la mot anh san. Chuot phai de them dich vu vao danh sach tam. Bam Luu de ghi vao DB.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Gio he thong: <strong>{now.toLocaleTimeString("vi-VN")}</strong>
            {lastSyncedAt && <> • Dong bo: <strong>{lastSyncedAt.toLocaleTimeString("vi-VN")}</strong></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Badge variant="outline" className="h-9 px-3 gap-2">
            <CalendarDays className="h-3.5 w-3.5" />
            {selectedDate.toLocaleDateString("vi-VN")}
          </Badge>
          <Button variant="outline" size="icon" onClick={() => shiftDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Badge variant="default" className="h-9 px-3 gap-2 font-mono text-sm">
            <Clock className="h-3.5 w-3.5" />
            {now.toLocaleTimeString("vi-VN")}
          </Badge>
          <Button variant="outline" onClick={fetchBookings} disabled={isSyncing} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
            {isSyncing ? "Dang dong bo" : "Lam moi"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Chi nhanh</p>
            <p className="text-sm font-semibold mt-1">{employeeBranch.replace("BadmintonHub ", "")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">So san hien thi</p>
            <p className="text-xl font-bold mt-1">{branchCourts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">San co nguoi choi tai thoi diem hien tai</p>
            <p className="text-xl font-bold mt-1">{occupiedCourtsAtCurrentHour}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {isSelectedDateToday ? `Theo thoi gian thuc (${currentTimeLabel})` : "Ngay lich su"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tien san (ngay chon)</p>
            <p className="text-xl font-bold mt-1">{formatVND(courtRevenueCurrentDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tien dich vu (ngay chon)</p>
            <p className="text-xl font-bold mt-1 text-primary">{formatVND(serviceRevenueCurrentDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tong dich vu cuoi buoi</p>
            <p className="text-xl font-bold mt-1 text-emerald-600">{formatVND(endSessionServiceTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
        Goi y: chuot phai truc tiep len anh san dang co khach de them dich vu. Khi san co nguoi choi o gio hien tai, icon nguoi choi se hien o giua san.
      </div>
      <div className="text-xs text-muted-foreground border rounded-lg px-3 py-2">
        Danh muc hien thi tu kho nhan vien ({user?.warehouse || "Kho chua gan"}) va Tong kho; nhom do thue hien toi da {MAX_RENTAL_ITEMS_PER_CATEGORY} mau, nuoc uong khong gioi han so luong:
        <span className="ml-1 font-medium">
          {SERVICE_CATEGORY_ORDER
            .filter((category) => serviceCatalogByCategory[category].length > 0)
            .map((category) => CATEGORY_LABELS[category])
            .join(" • ") || "Mac dinh"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {branchCourts.map((court) => {
          const courtBookings = bookingsByCourt[court.id] || []
          const activeBooking = getCurrentBooking(court.id)
          const activeServices = activeBooking ? (servicesByBooking[activeBooking.bookingId] || []) : []
          const serviceTotal = activeServices.reduce((sum, line) => sum + line.qty * line.price, 0)
          const checkoutStatus = activeBooking ? getBookingCheckoutStatus(activeBooking.bookingId) : "empty"
          const isActiveDirty = activeBooking ? !!dirtyBookings[activeBooking.bookingId] : false

          const menuContent = (
            <ContextMenuContent className="w-[260px]">
              <ContextMenuLabel>Dich vu tai {court.name}</ContextMenuLabel>
              <ContextMenuSeparator />
              {SERVICE_CATEGORY_ORDER.map((category) => {
                const categoryOptions = serviceCatalogByCategory[category]
                const categoryLimit = getCategoryLimit(category)
                const activeCategoryQty = activeBooking
                  ? activeServices
                      .filter((line) => line.category === category)
                      .reduce((sum, line) => sum + line.qty, 0)
                  : 0
                const categoryLimitReached = activeBooking && typeof categoryLimit === "number"
                  ? activeCategoryQty >= categoryLimit
                  : false

                return (
                  <div key={`${court.id}-${category}`}>
                    <ContextMenuLabel className="text-xs text-muted-foreground py-1">
                      {CATEGORY_LABELS[category]}
                      {activeBooking && typeof categoryLimit === "number" ? ` (${activeCategoryQty}/${categoryLimit})` : ""}
                    </ContextMenuLabel>
                    {categoryOptions.length === 0 ? (
                      <ContextMenuItem disabled>Kho nay chua co mau</ContextMenuItem>
                    ) : (
                      categoryOptions.map((service) => (
                        <ContextMenuItem
                          key={`${court.id}-${service.key}`}
                          disabled={!activeBooking || categoryLimitReached}
                          onClick={() => activeBooking && addServiceWithStaffNote(activeBooking, service)}
                        >
                          <span className="truncate max-w-[180px]">{service.name}</span>
                          <ContextMenuShortcut>{formatVND(service.price)}</ContextMenuShortcut>
                        </ContextMenuItem>
                      ))
                    )}
                    {activeBooking && categoryLimitReached && typeof categoryLimit === "number" && (
                      <ContextMenuItem disabled>
                        Da dat toi da {categoryLimit} san pham
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                  </div>
                )
              })}
              {!activeBooking ? (
                <ContextMenuItem disabled>Khung gio nay san dang trong</ContextMenuItem>
              ) : activeServices.length === 0 ? (
                <ContextMenuItem disabled>Chua co dich vu</ContextMenuItem>
              ) : (
                <>
                  {activeServices.map((service) => (
                    <ContextMenuItem key={`${activeBooking.bookingId}-${service.key}-${service.staffNote || "none"}`} disabled>
                      <span className="truncate max-w-[180px]">
                        {service.name} x {service.qty}
                        {service.staffNote ? ` (${service.staffNote})` : ""}
                      </span>
                      <ContextMenuShortcut>{formatVND(service.qty * service.price)}</ContextMenuShortcut>
                    </ContextMenuItem>
                  ))}
                  <ContextMenuItem disabled>
                    Tong dich vu
                    <ContextMenuShortcut>{formatVND(serviceTotal)}</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => clearServices(activeBooking.bookingId)}>Xoa danh sach dich vu tam</ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          )

          return (
            <Card key={court.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span className="truncate">{court.name}</span>
                  <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                    <Wallet className="h-3 w-3" /> {formatVND(court.price)}/h
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ContextMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ContextMenuTrigger asChild>
                        <div className={cn(
                          "relative mx-auto w-full max-w-[220px] aspect-[7/12] rounded-lg border overflow-hidden cursor-context-menu",
                          activeBooking ? "border-emerald-400" : "border-border"
                        )}>
                          <Image
                            src="/anhsancaulongicon.png"
                            alt={`SÃ¢n ${court.name}`}
                            fill
                            sizes="220px"
                            className="object-cover"
                            priority={false}
                          />
                          <div className="absolute top-2 left-2">
                            <Badge variant="outline" className="text-[10px] bg-background/90">{currentTimeLabel}</Badge>
                          </div>
                          <div className="absolute top-2 right-2 flex gap-1">
                            <Badge variant="outline" className="text-[10px] bg-background/90">{court.indoor ? "Indoor" : "Outdoor"}</Badge>
                            <Badge variant="outline" className="text-[10px] bg-background/90 gap-1"><Star className="h-3 w-3" />{court.rating}</Badge>
                          </div>

                          {activeBooking && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg ring-2 ring-background animate-pulse">
                                <Users className="h-5 w-5" />
                              </div>
                            </div>
                          )}

                          <div className="absolute bottom-2 left-2 right-2 rounded-md border bg-background/90 px-2 py-1.5 text-[11px]">
                            {activeBooking ? (
                              <>
                                <p className="font-semibold truncate">{activeBooking.customerName || "Khach"}</p>
                                <p className="text-muted-foreground truncate">Het san: {activeBooking.timeEnd}</p>
                              </>
                            ) : (
                              <p className="text-muted-foreground">Trong khung gio nay</p>
                            )}
                          </div>
                        </div>
                      </ContextMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[260px] text-xs">
                      {activeBooking ? (
                        <div className="space-y-1">
                          <p className="font-semibold">{activeBooking.customerName}</p>
                          {activeBooking.customerPhone && <p>SDT: {activeBooking.customerPhone}</p>}
                          <p>Ma: {formatBookingReference(activeBooking.bookingCode || activeBooking.bookingId)}</p>
                          {activeBooking.placedBy && <p>Ai dat: {activeBooking.placedBy}</p>}
                          <p>Khung gio: {activeBooking.timeStart} - {activeBooking.timeEnd}</p>
                          <p className="font-semibold">Het luc: {activeBooking.timeEnd}</p>
                          <p>Tien san: {formatVND(activeBooking.amount || 0)}</p>
                          <p>Tien dich vu: {formatVND(serviceTotal)}</p>
                          {activeServices.length > 0 && (
                            <p>Dich vu: {activeServices.map((service) => `${service.name} x ${service.qty}${service.staffNote ? `(${service.staffNote})` : ""}`).join(", ")}</p>
                          )}
                        </div>
                      ) : (
                        <p>Hien chua co nguoi choi tai {currentTimeLabel}.</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  {menuContent}
                </ContextMenu>

                <div className="rounded-md border bg-muted/20 p-2 text-xs space-y-1">
                  {activeBooking ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          "font-medium",
                          activeBooking.status === "hold" ? "text-amber-700" : "text-emerald-700"
                        )}>
                          {activeBooking.status === "hold" ? "Giu cho" : "Dang choi"}
                        </span>
                        <span className="text-muted-foreground">{activeBooking.timeStart} - {activeBooking.timeEnd}</span>
                      </div>
                      {activeServices.length > 0 ? (
                        <div className="text-emerald-700">
                          <p className="text-foreground">Tien san: {formatVND(activeBooking.amount || 0)}</p>
                          <p>Tong dich vu: {formatVND(serviceTotal)}</p>
                          <p className="text-[11px]">
                            Trang thai: {checkoutStatus === "paid" ? "Da thanh toan" : checkoutStatus === "saved" ? "Da luu" : "Chua luu"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {activeServices.map((line) => `${line.name} x ${line.qty}${line.staffNote ? ` (${line.staffNote})` : ""}`).join(" • ")}
                          </p>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">Chua co dich vu tai san.</div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!isActiveDirty && activeServices.length === 0}
                          onClick={() => saveBookingServices(activeBooking.bookingId)}
                        >
                          Luu dich vu
                        </Button>
                        <Button
                          size="sm"
                          disabled={activeServices.length === 0 || checkoutStatus !== "saved"}
                          onClick={() => checkoutBookingServices(activeBooking)}
                        >
                          Thanh toan va tru kho
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">Khong co booking tai thoi diem hien tai.</div>
                  )}
                </div>

                <div className="rounded-md border bg-background p-2">
                  <p className="text-[11px] font-semibold mb-1">Lich trong ngay</p>
                  {courtBookings.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Chua co booking.</p>
                  ) : (
                    <div className="space-y-1">
                      {courtBookings.map((booking) => (
                        <div key={`${court.id}-${booking.bookingId}`} className="text-[11px] flex items-center justify-between gap-2">
                          <span className="truncate">{booking.customerName || "Khach"}</span>
                          <span className="text-muted-foreground shrink-0">{booking.timeStart} - {booking.timeEnd}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cuoi buoi / Chot dich vu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {endedBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chua co booking nao ket thuc de chot hoa don dich vu.</p>
          ) : (
            endedBookings.map((booking) => {
              const serviceLines = servicesByBooking[booking.bookingId] || []
              const serviceTotal = serviceLines.reduce((sum, line) => sum + line.price * line.qty, 0)
              const courtFee = booking.amount || 0
              const checkoutStatus = getBookingCheckoutStatus(booking.bookingId)
              const isDirty = !!dirtyBookings[booking.bookingId]
              return (
                <div key={`end-${booking.bookingId}`} className="rounded-md border p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      {booking.customerName || "Khach"} • {courtNameById[booking.courtId] || `San #${booking.courtId}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {booking.timeStart} - {booking.timeEnd} • Ma {formatBookingReference(booking.bookingCode || booking.bookingId)}
                    </p>
                    <p className="text-xs">
                      Tien san: <span className="font-semibold">{formatVND(courtFee)}</span> • Tien dich vu: <span className="font-semibold text-primary">{formatVND(serviceTotal)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Trang thai dich vu: {checkoutStatus === "paid" ? "Da thanh toan" : checkoutStatus === "saved" ? "Da luu" : checkoutStatus === "draft" ? "Chua luu" : "Chua co dich vu"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!isDirty && serviceLines.length === 0}
                      onClick={() => saveBookingServices(booking.bookingId)}
                    >
                      Luu dich vu
                    </Button>
                    <Button
                      size="sm"
                      disabled={serviceLines.length === 0 || checkoutStatus !== "saved"}
                      onClick={() => checkoutBookingServices(booking)}
                    >
                      Thanh toan va tru kho
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handlePrintServiceInvoice(booking)}>
                      <Printer className="h-3.5 w-3.5" /> Xuat hoa don dich vu
                    </Button>
                </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" /> Icon nguoi choi tu cap nhat theo dong ho realtime tren trang.
      </div>
      <div className="text-xs text-muted-foreground">Chuột phải vao anh san de chon mau dich vu theo kho chi nhanh va tong kho; khi bam Luu moi ghi vao DB, khi bam Thanh toan moi tru kho.</div>
    </div>
  )
}
