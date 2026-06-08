'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CalendarClock, Heart, Loader2, MessageCircle, UserPlus, Users } from 'lucide-react'
import {
  communityApi,
  type CommunityNotification,
  type CommunityNotificationKind,
} from '@/lib/community-api'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { CommunityLeftNav } from '@/components/community/navigation'

const iconMap: Record<
  CommunityNotificationKind,
  { icon: typeof Heart; cls: string }
> = {
  like: { icon: Heart, cls: 'bg-primary/10 text-primary' },
  comment: { icon: MessageCircle, cls: 'bg-secondary text-foreground' },
  follow: { icon: UserPlus, cls: 'bg-accent/30 text-accent-foreground' },
  match: { icon: Users, cls: 'bg-foreground text-background' },
  reminder: { icon: CalendarClock, cls: 'bg-secondary text-foreground' },
}

export default function NotificationsPage() {
  const router = useRouter()
  const { user, isLoading: isAuthLoading } = useAuth()
  const [items, setItems] = useState<CommunityNotification[]>([])
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAuthLoading) return

    if (!user || user.role === 'guest') {
      setIsLoading(false)
      return
    }

    let active = true
    setIsLoading(true)
    setError('')

    communityApi
      .getNotifications()
      .then((response) => {
        if (!active) return
        setItems(response.notifications || [])
      })
      .catch(() => {
        if (!active) return
        setError('Không tải được thông báo cộng đồng.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [isAuthLoading, user])

  const unreadCount = useMemo(() => items.filter((item) => item.unread).length, [items])
  const visible = filter === 'unread' ? items.filter((item) => item.unread) : items

  async function handleMarkAllRead() {
    setIsMutating(true)
    const result = await communityApi.markAllNotificationsRead()
    if (result.success) {
      setItems((current) => current.map((item) => ({ ...item, unread: false })))
    }
    setIsMutating(false)
  }

  async function handleOpenNotification(notification: CommunityNotification) {
    if (notification.unread && !notification.id.startsWith('booking-')) {
      const result = await communityApi.markNotificationRead(notification.id)
      if (result.success) {
        setItems((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, unread: false } : item,
          ),
        )
      }
    } else if (notification.unread) {
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, unread: false } : item,
        ),
      )
    }

    router.push(notification.link || '/community/feed')
  }

  if (!isAuthLoading && (!user || user.role === 'guest')) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <CommunityLeftNav />
          <main className="min-w-0 max-w-2xl">
            <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
              <Bell className="mx-auto size-10 text-muted-foreground" />
              <h1 className="mt-4 font-heading text-2xl font-semibold">Thông báo cộng đồng</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Đăng nhập để xem lượt theo dõi, bình luận và lời mời tham gia kèo.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Đi tới đăng nhập
              </Link>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <CommunityLeftNav />

        <main className="min-w-0 max-w-2xl">
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">Thông báo</h1>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isMutating}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline disabled:no-underline disabled:opacity-70"
              >
                {isMutating ? <Loader2 className="size-4 animate-spin" /> : null}
                Đánh dấu đã đọc
              </button>
            ) : null}
          </div>

          <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {(['all', 'unread'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  filter === item
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item === 'all' ? 'Tất cả' : `Chưa đọc${unreadCount ? ` (${unreadCount})` : ''}`}
              </button>
            ))}
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="mt-6 flex items-center gap-3 rounded-3xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Đang tải thông báo...
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-2">
              {visible.map((notification) => {
                const actor = notification.actor
                const { icon: Icon, cls } = iconMap[notification.kind]

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleOpenNotification(notification)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
                      notification.unread
                        ? 'border-primary/30 bg-primary/[0.04]'
                        : 'border-border bg-card hover:bg-secondary/50',
                    )}
                  >
                    <div className="relative">
                      {actor?.avatar ? (
                        <Image
                          src={actor.avatar}
                          alt={actor.name}
                          width={44}
                          height={44}
                          className="size-11 rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid size-11 place-items-center rounded-full bg-secondary text-sm font-bold text-foreground">
                          {(actor?.name || 'B').charAt(0).toUpperCase()}
                        </div>
                      )}

                      <span
                        className={cn(
                          'absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full ring-2 ring-card',
                          cls,
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed">
                        {actor ? (
                          <span className="font-semibold">{actor.name}</span>
                        ) : (
                          <span className="font-semibold">BadmintonHub</span>
                        )}{' '}
                        {notification.text}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{notification.time}</p>
                    </div>

                    {notification.unread ? (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    ) : null}
                  </button>
                )
              })}

              {visible.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
                  <p className="font-heading text-lg font-semibold">Bạn đã đọc hết rồi</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Không còn thông báo nào theo bộ lọc hiện tại.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
