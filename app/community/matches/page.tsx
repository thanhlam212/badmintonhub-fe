'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  communityApi,
  type CommunityDistrict,
  type CommunityLevel,
  type CommunityMatch,
} from '@/lib/community-api'
import { bookingApi, type ApiBooking } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { MatchCard } from '@/components/community/cards'
import { CommunityLeftNav } from '@/components/community/navigation'

const districts: (CommunityDistrict | 'Tất cả')[] = [
  'Tất cả',
  'Cầu Giấy',
  'Thanh Xuân',
  'Long Biên',
]
const levels: (CommunityLevel | 'Mọi trình')[] = [
  'Mọi trình',
  'Mới chơi',
  'Trung bình',
  'Khá',
  'Nâng cao',
]
const slots = ['Mọi giờ', 'Sáng', 'Chiều', 'Tối'] as const
const eligibleStatuses = new Set(['pending', 'deposited', 'confirmed', 'playing'])

function isEligibleMatchBooking(booking: ApiBooking) {
  if (!eligibleStatuses.has(booking.status)) return false
  const bookingDate = new Date(booking.bookingDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  bookingDate.setHours(0, 0, 0, 0)
  if (bookingDate > today) return true
  if (bookingDate < today) return false

  const [hourRaw, minuteRaw] = (booking.timeEnd || booking.timeStart).split(':')
  const endMinutes = Number(hourRaw || 0) * 60 + Number(minuteRaw || 0)
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return endMinutes > nowMinutes
}

export default function MatchesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [district, setDistrict] = useState<(typeof districts)[number]>('Tất cả')
  const [level, setLevel] = useState<(typeof levels)[number]>('Mọi trình')
  const [slot, setSlot] = useState<(typeof slots)[number]>('Mọi giờ')
  const [matches, setMatches] = useState<CommunityMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingCreate, setCheckingCreate] = useState(false)
  const [createMessage, setCreateMessage] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    communityApi
      .getMatches({ district, level, slot })
      .then((res) => {
        if (!mounted) return
        setMatches(res.matches)
        setLoading(false)
      })
      .catch(() => {
        if (!mounted) return
        setMatches([])
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [district, level, slot])

  async function handleCreateMatch() {
    if (!user || user.role === 'guest') {
      router.push('/login')
      return
    }

    setCheckingCreate(true)
    setCreateMessage(null)

    try {
      const bookings = await bookingApi.getMyBookings()
      const eligibleBookings = bookings.filter(isEligibleMatchBooking)
      if (!eligibleBookings.length) {
        setCreateMessage('Bạn chưa có booking sân')
        return
      }
      router.push('/community/matches/create')
    } finally {
      setCheckingCreate(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <CommunityLeftNav />

        <main className="min-w-0">
          <div className="cm-dark rounded-3xl px-6 py-8 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight">
                  Tìm đội & tìm kèo
                </h1>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Chỉ tạo kèo từ sân bạn đã đặt ở form đặt sân chính để tránh trùng lịch và trùng sân.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateMatch}
                disabled={checkingCreate}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {checkingCreate ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Tạo kèo mới
              </button>
            </div>
            {createMessage ? (
              <p className="mt-3 text-sm font-medium text-red-100">{createMessage}</p>
            ) : null}
          </div>

          <div className="mt-5 rounded-3xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="size-4 text-primary" />
              Bộ lọc
            </div>
            <div className="flex flex-col gap-3">
              <FilterRow label="Khu vực" options={districts} value={district} onChange={setDistrict} />
              <FilterRow label="Trình độ" options={levels} value={level} onChange={setLevel} />
              <FilterRow label="Khung giờ" options={slots} value={slot} onChange={setSlot} />
            </div>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            {loading ? 'Đang tải kèo...' : `${matches.length} kèo đang tìm người`}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-72 animate-pulse rounded-3xl bg-muted" />
                ))
              : matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onJoined={(updated) =>
                      setMatches((current) =>
                        current.map((item) => (item.id === updated.id ? updated : item)),
                      )
                    }
                  />
                ))}
          </div>
          {!loading && matches.length === 0 ? (
            <div className="mt-3 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
              <p className="font-heading text-lg font-semibold">Không có kèo phù hợp</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Hãy đổi bộ lọc hoặc tạo kèo từ chính booking sân của bạn.
              </p>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              value === option
                ? 'border-foreground bg-foreground text-background'
                : 'border-border hover:bg-secondary',
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
