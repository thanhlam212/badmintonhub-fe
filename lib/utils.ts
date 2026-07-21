import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formatting and helper functions migrated from mock-data.ts

export const WEATHER_API_KEY = "8a4755cdd81b4bdcb9973512251210"

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + '\u0111'
}

export function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = 6; h < 22; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`)
  }
  return slots
}

export function formatSlotRange(startTime: string): string {
  const h = parseInt(startTime.split(":")[0], 10)
  const endH = h + 1
  return `${startTime}–${endH.toString().padStart(2, "0")}:00`
}

export function getWeekDays(startDate: Date = new Date()): { date: Date; label: string; dayName: string }[] {
  const days = []
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    days.push({
      date: d,
      label: formatDateLabel(d),
      dayName: dayNames[d.getDay()],
    })
  }
  return days
}

/**
 * CHUẨN DUY NHẤT cho dateLabel: "d/M" (không padding).
 * Ví dụ: 5/6, 12/11, 1/1
 * Cả bookings/page.tsx và courts/page.tsx PHẢI dùng hàm này để so khớp slot.
 */
export function formatDateLabel(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}`
}

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh'

function getBusinessNowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string) => parts.find(part => part.type === type)?.value || '0'
  const hour = Number(get('hour')) % 24
  const minute = Number(get('minute'))

  return {
    dateToken: `${get('year')}-${get('month')}-${get('day')}`,
    year: Number(get('year')),
    minutes: hour * 60 + minute,
  }
}

function slotDateToken(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isSlotPast(dateLabel: string | Date, time: string): boolean {
  // Do not disable a slot when data is incomplete.
  if (!dateLabel || !time) return false

  const [hour, minute = 0] = time.split(':').map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return false

  const now = getBusinessNowParts()
  const slotMinutes = hour * 60 + minute

  if (dateLabel instanceof Date) {
    const token = slotDateToken(
      dateLabel.getFullYear(),
      dateLabel.getMonth() + 1,
      dateLabel.getDate(),
    )
    if (token < now.dateToken) return true
    if (token > now.dateToken) return false
    return slotMinutes <= now.minutes
  }

  const parts = dateLabel.split('/')
  if (parts.length < 2) return false

  const day = Number(parts[0])
  const month = Number(parts[1])
  if (isNaN(day) || isNaN(month)) return false

  const year = parts[2] ? Number(parts[2]) : now.year
  const token = slotDateToken(year, month, day)
  if (token < now.dateToken) return true
  if (token > now.dateToken) return false
  return slotMinutes <= now.minutes
}

// Document reference formatters

type ProjectDocPrefix = "MB" | "BK" | "FS" | "OD" | "SO" | "PO" | "VD" | "DC" | "PNK" | "PXK"

const PROJECT_DOC_CODE_PATTERN = /^(MB|BK|FS|OD|SO|PO|VD|DC|PNK|PXK)-\d{8}-\d{4}$/i

function buildProjectReference(prefix: ProjectDocPrefix, value?: string | null, createdAt?: string | Date | null): string {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  if (PROJECT_DOC_CODE_PATTERN.test(raw)) return raw.toUpperCase()

  const date = createdAt ? new Date(createdAt) : new Date()
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  const yyyy = String(safeDate.getFullYear())
  const mm = String(safeDate.getMonth() + 1).padStart(2, "0")
  const dd = String(safeDate.getDate()).padStart(2, "0")

  const normalized = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  let seq = 0
  for (const ch of normalized || `${prefix}${yyyy}${mm}${dd}`) {
    seq = (seq * 31 + ch.charCodeAt(0)) % 10000
  }

  return `${prefix}-${yyyy}${mm}${dd}-${String(Math.abs(seq) % 10000).padStart(4, "0")}`
}

export function formatPOReference(value?: string | null, createdAt?: string | Date | null): string {
  return buildProjectReference("PO", value, createdAt)
}


export function formatHDReference(value?: string | null, createdAt?: string | Date | null, fallbackPrefix: "OD" | "SO" = "OD"): string {
  const raw = String(value ?? "").trim()
  if (/^(OD|SO)-\d{8}-\d{4}$/i.test(raw)) return raw.toUpperCase()
  return buildProjectReference(fallbackPrefix, raw, createdAt)
}

export function formatBookingReference(value?: string | null, createdAt?: string | Date | null): string {
  const raw = String(value ?? "").trim()
  if (/^(MB|BK|FS)-\d{8}-\d{4}$/i.test(raw)) return raw.toUpperCase()
  return buildProjectReference("MB", raw, createdAt)
}

export function formatFixedScheduleReference(value?: string | null, createdAt?: string | Date | null): string {
  const raw = String(value ?? "").trim()
  if (/^FS-\d{8}-\d{4}$/i.test(raw)) return raw.toUpperCase()
  return buildProjectReference("FS", raw, createdAt)
}

export function formatShipmentReference(value?: string | null, createdAt?: string | Date | null): string {
  return buildProjectReference("VD", value, createdAt)
}

export function formatTransferReference(value?: string | null, createdAt?: string | Date | null): string {
  const raw = String(value ?? "").trim()
  if (/^DC-\d{8}-\d{4}$/i.test(raw)) return raw.toUpperCase()
  // DC = Điều Chuyển
  const date = createdAt ? new Date(createdAt) : new Date()
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  const yyyy = String(safeDate.getFullYear())
  const mm = String(safeDate.getMonth() + 1).padStart(2, "0")
  const dd = String(safeDate.getDate()).padStart(2, "0")
  const normalized = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  let seq = 0
  for (const ch of normalized || `DC${yyyy}${mm}${dd}`) {
    seq = (seq * 31 + ch.charCodeAt(0)) % 10000
  }
  return `DC-${yyyy}${mm}${dd}-${String(Math.abs(seq) % 10000).padStart(4, "0")}`
}

export function formatSalesOrderReference(value?: string | null, createdAt?: string | Date | null): string {
  const raw = String(value ?? "").trim()
  if (/^SO-\d{8}-\d{4}$/i.test(raw)) return raw.toUpperCase()
  return buildProjectReference("SO", raw, createdAt)
}

export function formatPNKReference(value?: string | null, createdAt?: string | Date | null): string {
  const raw = String(value ?? "").trim()
  if (/^PNK-\d{8}-\d{4}$/i.test(raw)) return raw.toUpperCase()
  return buildProjectReference("PNK", raw, createdAt)
}

export function formatPXKReference(value?: string | null, createdAt?: string | Date | null): string {
  const raw = String(value ?? "").trim()
  if (/^PXK-\d{8}-\d{4}$/i.test(raw)) return raw.toUpperCase()
  return buildProjectReference("PXK", raw, createdAt)
}
