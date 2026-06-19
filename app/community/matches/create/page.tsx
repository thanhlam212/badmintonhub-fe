'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, Calendar, Clock3, Loader2, MapPin, Users, Wallet } from 'lucide-react'
import { bookingApi, type ApiBooking } from '@/lib/api'
import { communityApi, type CommunityLevel } from '@/lib/community-api'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

const levels: CommunityLevel[] = ['Mới chơi', 'Trung bình', 'Khá', 'Nâng cao']
const eligibleStatuses = new Set(['pending', 'deposited', 'confirmed', 'playing'])
const MAX_MATCH_PLAYERS = 8

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

function formatBookingLabel(booking: ApiBooking) {
  return `${booking.courtName} - ${booking.branchName} - ${booking.bookingDate} - ${booking.timeStart} - ${booking.timeEnd}`
}

export default function CreateMatchPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [bookings, setBookings] = useState<ApiBooking[]>([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [selectedBookingId, setSelectedBookingId] = useState('')
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState<CommunityLevel>('Trung bình')
  const [currentPlayers, setCurrentPlayers] = useState(1)
  const [neededPlayers, setNeededPlayers] = useState(4)
  const [pricePerPerson] = useState(0)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  useEffect(() => {
    if (!user) return
    if (user.role === 'guest') {
      router.replace('/login')
      return
    }

    let mounted = true
    setLoadingBookings(true)
    bookingApi
      .getMyBookings()
      .then((rows) => {
        if (!mounted) return
        const eligible = rows.filter(isEligibleMatchBooking)
        setBookings(eligible)
        setSelectedBookingId((current) => current || eligible[0]?.id || '')
      })
      .finally(() => {
        if (!mounted) return
        setLoadingBookings(false)
      })

    return () => {
      mounted = false
    }
  }, [router, user])

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId) || null,
    [bookings, selectedBookingId],
  )
  const totalPlayers = Math.min(MAX_MATCH_PLAYERS, Math.max(2, neededPlayers))
  const activePlayers = Math.min(totalPlayers, Math.max(1, currentPlayers))
  const splitPrice = selectedBooking ? Math.round(selectedBooking.amount / totalPlayers) : pricePerPerson

  function handleCurrentPlayersChange(value: string) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    setCurrentPlayers(Math.min(totalPlayers, Math.max(1, Math.trunc(parsed))))
  }

  function handleNeededPlayersChange(value: string) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    const nextNeeded = Math.min(MAX_MATCH_PLAYERS, Math.max(2, Math.trunc(parsed)))
    setNeededPlayers(nextNeeded)
    setCurrentPlayers((current) => Math.min(current, nextNeeded))
  }

  async function handleSubmit() {
    if (!selectedBookingId) {
      setMessage({ type: 'error', text: 'Bạn chưa có booking sân' })
      return
    }
    if (!title.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập tiêu đề kèo' })
      return
    }
    if (activePlayers > totalPlayers) {
      setMessage({ type: 'error', text: 'Số người hiện tại không được lớn hơn số người cần đủ' })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const result = await communityApi.createMatch({
        booking_id: selectedBookingId,
        title: title.trim(),
        level,
        current_players: activePlayers,
        needed_players: totalPlayers,
        price_per_person: splitPrice,
        note: note.trim() || undefined,
      })

      if (!result.success || !result.match) {
        setMessage({ type: 'error', text: result.error || 'Tạo kèo thất bại' })
        return
      }

      setMessage({ type: 'success', text: 'Tạo kèo thành công' })
      router.push('/community/matches')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link
        href="/community/matches"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Danh sách kèo
      </Link>

      <h1 className="font-heading text-3xl font-semibold tracking-tight">Tạo kèo từ booking sân</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Chủ tài khoản chỉ được tạo kèo từ sân đã đặt ở form đặt sân chính.
      </p>

      <div className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-6">
        <label className="block text-sm font-semibold">Booking sân của bạn</label>
        {loadingBookings ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tải booking...
          </div>
        ) : bookings.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Bạn chưa có booking sân
          </div>
        ) : (
          <select
            value={selectedBookingId}
            onChange={(event) => setSelectedBookingId(event.target.value)}
            className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
          >
            {bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {formatBookingLabel(booking)}
              </option>
            ))}
          </select>
        )}

        {selectedBooking ? (
          <div className="mt-4 grid gap-3 rounded-2xl bg-secondary/60 p-4 text-sm sm:grid-cols-2">
            <InfoRow icon={MapPin} label={`${selectedBooking.courtName} - ${selectedBooking.branchName}`} />
            <InfoRow icon={Calendar} label={selectedBooking.bookingDate} />
            <InfoRow icon={Clock3} label={`${selectedBooking.timeStart} - ${selectedBooking.timeEnd}`} />
            <InfoRow icon={Wallet} label={`Mã đặt sân: ${selectedBooking.bookingCode || selectedBooking.id}`} />
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold">Tiêu đề kèo</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ví dụ: Kèo đánh đôi tối nay cần thêm 3 người"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold">Trình độ</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {levels.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLevel(item)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    level === item
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold">Số người hiện tại</label>
            <input
              type="number"
              min={1}
              max={totalPlayers}
              value={activePlayers}
              onChange={(event) => handleCurrentPlayersChange(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">Gồm bạn và những người đã có sẵn trong nhóm.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold">Số người cần đủ</label>
            <input
              type="number"
              min={Math.max(2, activePlayers)}
              max={MAX_MATCH_PLAYERS}
              value={totalPlayers}
              onChange={(event) => handleNeededPlayersChange(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Tối đa {MAX_MATCH_PLAYERS} người. Kèo tự khóa khi đủ số này.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold">Chi phí / người</label>
            <input
              type="number"
              min={0}
              value={splitPrice}
              readOnly
              className="mt-2 w-full rounded-2xl border border-border bg-secondary/70 px-4 py-3 text-sm outline-none"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Tổng tiền sân chia đều cho {totalPlayers} người khi kèo đủ.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold">Ghi chú</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="Mô tả thêm về kèo, trình độ mong muốn, yêu cầu ghép đôi..."
              className="mt-2 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
            />
          </div>
        </div>

        {message ? (
          <div
            className={cn(
              'mt-5 rounded-2xl border px-4 py-3 text-sm',
              message.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700',
            )}
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{message.text}</span>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <Link
            href="/community/matches"
            className="rounded-full border border-border px-5 py-3 text-sm font-semibold hover:bg-secondary"
          >
            Hủy
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || loadingBookings || bookings.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
            Tạo kèo
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
}: {
  icon: typeof MapPin
  label: string
}) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="size-4 shrink-0 text-primary" />
      <span className="truncate text-foreground">{label}</span>
    </div>
  )
}
