import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ═══════════════════════════════════════════════════════════════
// FORMATTING & HELPER FUNCTIONS (migrated from mock-data.ts)
// ═══════════════════════════════════════════════════════════════

export const WEATHER_API_KEY = "8a4755cdd81b4bdcb9973512251210"

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ'
}

export function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = 6; h < 22; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`)
  }
  return slots
}

export function getWeekDays(startDate: Date = new Date()): { date: Date; label: string; dayName: string }[] {
  const days = []
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    days.push({
      date: d,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      dayName: dayNames[d.getDay()],
    })
  }
  return days
}

export function isSlotPast(dateLabel: string | Date, time: string): boolean {
  // Guard: nếu thiếu data thì không disable
  if (!dateLabel || !time) return false

  // Handle Date object
  if (dateLabel instanceof Date) {
    const slotDate = new Date(dateLabel)
    const [hour] = time.split(':').map(Number)
    slotDate.setHours(hour, 0, 0, 0)
    return slotDate < new Date()
  }

  const parts = dateLabel.split('/')
  if (parts.length < 2) return false

  const day = Number(parts[0])
  const month = Number(parts[1])
  if (isNaN(day) || isNaN(month)) return false

  const year = new Date().getFullYear()
  const slotDate = new Date(year, month - 1, day)
  const [hour] = time.split(':').map(Number)
  slotDate.setHours(hour, 0, 0, 0)
  return slotDate < new Date()
}

// ─── Document reference formatters ──────────────────────────────────────────

export function formatPOReference(value?: string | null): string {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  if (/^PO[-A-Z0-9]+$/i.test(raw)) return raw.toUpperCase()
  const normalized = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  if (!normalized) return raw
  return `PO${normalized.slice(0, 8)}`
}

export function formatHDReference(value?: string | null, createdAt?: string | Date | null): string {
  const raw = String(value ?? "").trim()
  if (/^HD-\d{6}-\d{4}$/i.test(raw)) return raw.toUpperCase()

  const date = createdAt ? new Date(createdAt) : new Date()
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  const yy = String(safeDate.getFullYear()).slice(2)
  const mm = String(safeDate.getMonth() + 1).padStart(2, "0")
  const dd = String(safeDate.getDate()).padStart(2, "0")

  const normalized = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  const tailHex = normalized.slice(-8)
  let seq = Number.parseInt(tailHex, 16)
  if (!Number.isFinite(seq)) {
    seq = 0
    for (const ch of normalized) seq = (seq * 31 + ch.charCodeAt(0)) % 10000
  }
  return `HD-${yy}${mm}${dd}-${String(Math.abs(seq) % 10000).padStart(4, "0")}`
}

export function formatBookingReference(value?: string | null, createdAt?: string | Date | null): string {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  if (/^(BH-\d{6}-\d{3}|MB-[A-Z0-9-]+|BK-[A-Z0-9-]+)$/i.test(raw)) return raw.toUpperCase()

  const date = createdAt ? new Date(createdAt) : new Date()
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  const yy = String(safeDate.getFullYear()).slice(2)
  const mm = String(safeDate.getMonth() + 1).padStart(2, "0")
  const dd = String(safeDate.getDate()).padStart(2, "0")

  const normalized = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  let seq = 0
  for (const ch of normalized) {
    seq = (seq * 31 + ch.charCodeAt(0)) % 1000
  }
  return `BH-${yy}${mm}${dd}-${String(Math.abs(seq) % 1000).padStart(3, "0")}`
}