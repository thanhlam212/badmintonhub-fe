'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock, ImagePlus, Loader2, MapPin, Smile, TrendingUp } from 'lucide-react'
import {
  communityApi,
  type CommunityPlayer,
  type CommunityPost,
  type CommunityPostKind,
  type CommunityTagTrend,
  type CommunityUpcomingSession,
} from '@/lib/community-api'
import { useAuth } from '@/lib/auth-context'
import { CommunityAvatar, HashtagChip } from './primitives'
import { PlayerCard } from './cards'

const quickKinds: CommunityPostKind[] = ['Chia sẻ', 'Tìm đội', 'Check-in', 'Review sân']

export function PostComposer({
  onPosted,
}: {
  onPosted?: (post: CommunityPost) => void
}) {
  const { user } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [activeKind, setActiveKind] = useState<CommunityPostKind>('Chia sẻ')
  const [body, setBody] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  async function handleUpload(files: FileList | null) {
    const selected = Array.from(files || []).slice(0, Math.max(0, 3 - imageUrls.length))
    if (!selected.length) return

    if (!user || user.role === 'guest') {
      router.push('/login')
      return
    }

    setIsUploading(true)
    setMessage('')
    try {
      const uploaded = await Promise.all(selected.map((file) => communityApi.uploadImage(file)))
      const failed = uploaded.find((item) => !item.success || !item.url)
      if (failed) {
        setMessage(failed.error || 'Không thể tải ảnh lên.')
        return
      }
      setImageUrls((current) => [...current, ...uploaded.map((item) => item.url)])
    } finally {
      setIsUploading(false)
    }
  }

  async function handleSubmit() {
    if (!body.trim()) return

    if (!user || user.role === 'guest') {
      router.push('/login')
      return
    }

    setIsSubmitting(true)
    setMessage('')
    try {
      const result = await communityApi.createPost({
        kind: activeKind,
        body: body.trim(),
        image_urls: imageUrls,
      })

      if (!result.success || !result.post) {
        setMessage(result.error || 'Đăng bài thất bại.')
        return
      }

      setBody('')
      setActiveKind('Chia sẻ')
      setImageUrls([])
      onPosted?.(result.post)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-4 sm:p-5">
      <div className="flex gap-3">
        <CommunityAvatar src={null} name={user?.fullName || 'Bạn'} size={44} className="size-11" />
        <div className="flex-1">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={2}
            placeholder="Hôm nay đánh thế nào? Tìm đội hay khoe pha smash ăn điểm..."
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
          />

          <div className="mt-2 flex flex-wrap gap-1.5">
            {quickKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setActiveKind(kind)}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  activeKind === kind
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-secondary',
                ].join(' ')}
              >
                {kind}
              </button>
            ))}
          </div>

          {imageUrls.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {imageUrls.map((url, index) => (
                <span
                  key={`${url}-${index}`}
                  className="rounded-full bg-secondary px-2.5 py-1 text-xs text-foreground"
                >
                  Ảnh {index + 1}
                </span>
              ))}
            </div>
          ) : null}

          {message ? <p className="mt-2 text-xs text-red-600">{message}</p> : null}

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-1 text-muted-foreground">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm transition-colors hover:bg-secondary"
              >
                {isUploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                <span className="hidden sm:inline">Ảnh</span>
              </button>
              <Link
                href="/community/create"
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm transition-colors hover:bg-secondary"
              >
                <MapPin className="size-4" />
                <span className="hidden sm:inline">Sân</span>
              </Link>
              <Link
                href="/community/create"
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm transition-colors hover:bg-secondary"
              >
                <Smile className="size-4" />
                <span className="hidden sm:inline">Cảm xúc</span>
              </Link>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!body.trim() || isSubmitting || isUploading}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Đang đăng...' : 'Đăng bài'}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              handleUpload(event.target.files)
              event.target.value = ''
            }}
          />
        </div>
      </div>
    </div>
  )
}

export function CommunityRightSidebar({
  trendingTags,
  suggestedPlayers,
  upcomingSessions,
}: {
  trendingTags: CommunityTagTrend[]
  suggestedPlayers: CommunityPlayer[]
  upcomingSessions: CommunityUpcomingSession[]
}) {
  return (
    <aside className="sticky top-24 hidden h-fit w-full flex-col gap-5 xl:flex">
      <Panel
        title="Hashtag đang hot"
        icon={TrendingUp}
        action={['Xem tất cả', '/community/feed']}
      >
        <div className="flex flex-wrap gap-2">
          {trendingTags.map((tag) => (
            <HashtagChip key={tag.tag} tag={tag.tag} count={tag.count} />
          ))}
        </div>
      </Panel>

      <Panel
        title="Gợi ý người chơi"
        action={['Xem thêm', '/community']}
      >
        <div className="flex flex-col gap-4">
          {suggestedPlayers.map((player) => (
            <PlayerCard key={player.username} player={player} compact />
          ))}
        </div>
      </Panel>

      <Panel title="Lịch sân sắp tới" icon={CalendarClock}>
        <ul className="flex flex-col gap-3">
          {upcomingSessions.map((session) => (
            <li
              key={session.court + session.time}
              className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-background text-xs font-bold text-primary">
                {session.court.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{session.court}</p>
                <p className="text-xs text-muted-foreground">{session.time}</p>
              </div>
              <span className="shrink-0 text-xs font-medium text-primary">
                {session.label}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/courts"
          className="mt-3 block rounded-full border border-border py-2 text-center text-sm font-semibold transition-colors hover:bg-foreground hover:text-background"
        >
          Đặt sân ngay →
        </Link>
      </Panel>
    </aside>
  )
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string
  icon?: typeof TrendingUp
  action?: [string, string]
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
          {Icon ? <Icon className="size-4 text-primary" /> : null}
          {title}
        </h3>
        {action ? (
          <Link
            href={action[1]}
            className="text-xs font-medium text-primary hover:underline"
          >
            {action[0]}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  )
}
