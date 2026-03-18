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

export function isSlotPast(dateLabel: string, time: string): boolean {
  // Guard: nếu thiếu data thì không disable
  if (!dateLabel || !time) return false
  
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