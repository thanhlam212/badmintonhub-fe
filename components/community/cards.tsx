'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  MapPin,
  Clock,
  Users,
  Calendar,
  MoreHorizontal,
} from 'lucide-react'
import {
  communityApi,
  type CommunityMatch,
  type CommunityMatchParticipant,
  type CommunityPlayer,
  type CommunityPost,
  type CommunityPostKind,
} from '@/lib/community-api'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { CommunityAvatar, HashtagChip, LevelBadge } from './primitives'

const kindStyles: Record<CommunityPostKind, string> = {
  'Chia sẻ': 'bg-secondary text-secondary-foreground',
  'Tìm đội': 'bg-primary text-primary-foreground',
  'Check-in': 'bg-accent text-accent-foreground',
  'Review sân': 'bg-foreground text-background',
  'Mẹo chơi': 'bg-secondary text-secondary-foreground',
}

function requireLogin(userRole?: string, router?: ReturnType<typeof useRouter>) {
  if (!userRole || userRole === 'guest') {
    router?.push('/login')
    return false
  }
  return true
}

function AuthorRow({
  author,
  time,
  kind,
}: {
  author: CommunityPlayer
  time: string
  kind?: CommunityPostKind
}) {
  return (
    <div className="flex items-center gap-3">
      <Link href={`/community/profile/${author.username}`}>
        <CommunityAvatar
          src={author.avatar}
          name={author.name}
          size={44}
          className="size-11 ring-2 ring-background"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/community/profile/${author.username}`}
            className="truncate font-semibold hover:underline"
          >
            {author.name}
          </Link>
          {kind ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                kindStyles[kind] ?? 'bg-secondary text-secondary-foreground',
              )}
            >
              {kind}
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          @{author.username} · {time}
        </p>
      </div>
      <button
        type="button"
        className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
        aria-label="Tùy chọn"
      >
        <MoreHorizontal className="size-5" />
      </button>
    </div>
  )
}

export function PostCard({
  post,
  onUpdated,
}: {
  post: CommunityPost
  onUpdated?: (post: CommunityPost) => void
}) {
  const router = useRouter()
  const { user } = useAuth()
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [likes, setLikes] = useState(post.likes)
  const [saves, setSaves] = useState(post.saves)

  async function handleLike() {
    if (!requireLogin(user?.role, router)) return
    const res = await communityApi.togglePostLike(post.id)
    if (!res.success) return
    setLiked(!!res.liked)
    setLikes(Number(res.likes || 0))
    onUpdated?.({ ...post, likes: Number(res.likes || 0) })
  }

  async function handleSave() {
    if (!requireLogin(user?.role, router)) return
    const res = await communityApi.togglePostSave(post.id)
    if (!res.success) return
    setSaved(!!res.saved)
    setSaves(Number(res.saves || 0))
    onUpdated?.({ ...post, saves: Number(res.saves || 0) })
  }

  return (
    <article className="group rounded-3xl border border-border bg-card p-4 transition-shadow hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] sm:p-5">
      <AuthorRow author={post.author} time={post.time} kind={post.kind} />

      <Link href={`/community/post/${post.id}`} className="mt-3 block">
        <p className="text-pretty leading-relaxed">{post.body}</p>
      </Link>

      {post.court ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <MapPin className="size-3.5 text-primary" />
          {post.court}
        </div>
      ) : null}

      {post.images.length > 0 ? (
        <Link
          href={`/community/post/${post.id}`}
          className={cn(
            'mt-3 grid gap-1.5 overflow-hidden rounded-2xl',
            post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
          )}
        >
          {post.images.map((src, index) => (
            <div
              key={`${post.id}-${index}`}
              className="relative aspect-[4/3] overflow-hidden bg-muted"
            >
              <Image
                src={src || '/community/hero.png'}
                alt={`Ảnh ${index + 1} của bài viết`}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                sizes="(max-width: 640px) 100vw, 540px"
              />
            </div>
          ))}
        </Link>
      ) : null}

      {post.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <HashtagChip key={tag} tag={tag} />
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-1 border-t border-border pt-3 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={handleLike}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-secondary',
            liked && 'text-primary',
          )}
        >
          <Heart className={cn('size-4', liked && 'fill-current')} />
          {likes}
        </button>
        <Link
          href={`/community/post/${post.id}`}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-secondary"
        >
          <MessageCircle className="size-4" />
          {post.commentsCount}
        </Link>
        <button
          type="button"
          onClick={handleSave}
          className={cn(
            'ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-secondary',
            saved && 'text-primary',
          )}
        >
          <Bookmark className={cn('size-4', saved && 'fill-current')} />
          {saves}
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-secondary"
        >
          <Share2 className="size-4" />
        </button>
      </div>
    </article>
  )
}

export function MatchCard({
  match,
  onJoined,
}: {
  match: CommunityMatch
  onJoined?: (match: CommunityMatch) => void
}) {
  const router = useRouter()
  const { user } = useAuth()
  const [joined, setJoined] = useState(!!match.joined)
  const [requested, setRequested] = useState(!!match.requested)
  const [filled, setFilled] = useState(match.filled)
  const [requestsOpen, setRequestsOpen] = useState(false)
  const [participants, setParticipants] = useState<CommunityMatchParticipant[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const slots = Array.from({ length: match.needed })
  const isHostByUsername = !!user?.username && match.host.username === user.username
  const blocked = match.expired || match.status === 'expired' || match.status === 'full' || isHostByUsername
  const joinDisabled = joined || requested || blocked
  const statusLabel = match.expired || match.status === 'expired' ? 'Quá hạn' : match.statusLabel || 'Đang tìm người'

  async function handleJoin() {
    if (!requireLogin(user?.role, router)) return
    if (joinDisabled) return
    const res = await communityApi.joinMatch(match.id)
    if (!res.success || !res.match) return
    setJoined(!!res.match.joined)
    setRequested(!!res.match.requested || !!res.requested)
    setFilled(res.match.filled)
    onJoined?.(res.match)
  }

  async function loadRequests() {
    if (!match.isHost) return
    setRequestsOpen((current) => !current)
    if (participants.length) return
    setLoadingRequests(true)
    try {
      const res = await communityApi.getMatchParticipants(match.id)
      if (res.success) setParticipants(res.participants)
    } finally {
      setLoadingRequests(false)
    }
  }

  async function handleApprove(userId: string) {
    const res = await communityApi.approveMatchParticipant(match.id, userId)
    if (!res.success || !res.match) return
    setParticipants((current) =>
      current.map((participant) =>
        participant.userId === userId ? { ...participant, status: 'joined' } : participant,
      ),
    )
    setFilled(res.match.filled)
    onJoined?.(res.match)
  }

  async function handleReject(userId: string) {
    const res = await communityApi.rejectMatchParticipant(match.id, userId)
    if (!res.success) return
    setParticipants((current) =>
      current.map((participant) =>
        participant.userId === userId ? { ...participant, status: 'rejected' } : participant,
      ),
    )
  }

  return (
    <article className="flex flex-col rounded-3xl border border-border bg-card p-5 transition-shadow hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0px] font-bold uppercase tracking-wide',
              match.expired || match.status === 'expired'
                ? 'bg-red-100 text-red-700'
                : match.status === 'full'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-accent text-accent-foreground',
            )}
          >
            <span className="text-[11px]">{statusLabel}</span>
            Đang tìm người
          </span>
          <h3 className="mt-2 font-heading text-xl font-semibold leading-tight text-balance">
            {match.title}
          </h3>
        </div>
        <LevelBadge level={match.level} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Meta icon={Calendar} label={match.date} />
        <Meta icon={Clock} label={match.slot} />
        <Meta icon={MapPin} label={match.court} />
        <Meta icon={Users} label={`${filled}/${match.needed} người`} />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {match.note}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Đã tham gia</span>
        <div className="flex -space-x-2">
          {slots.map((_, index) => (
            <span
              key={`${match.id}-${index}`}
              className={cn(
                'grid size-7 place-items-center rounded-full border-2 border-card text-[10px] font-bold',
                index < filled
                  ? 'bg-foreground text-background'
                  : 'border-dashed bg-secondary text-muted-foreground',
              )}
            >
              {index < filled ? '✓' : '+'}
            </span>
          ))}
        </div>
      </div>

      {match.isHost ? (
        <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-3">
          <button
            type="button"
            onClick={loadRequests}
            className="flex w-full items-center justify-between text-left text-sm font-semibold"
          >
            <span>Yêu cầu tham gia</span>
            <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
              {match.pendingParticipants || 0} chờ duyệt
            </span>
          </button>
          {requestsOpen ? (
            <div className="mt-3 space-y-2">
              {loadingRequests ? (
                <p className="text-xs text-muted-foreground">Đang tải yêu cầu...</p>
              ) : participants.filter((item) => item.status === 'requested').length === 0 ? (
                <p className="text-xs text-muted-foreground">Chưa có yêu cầu mới.</p>
              ) : (
                participants
                  .filter((item) => item.status === 'requested')
                  .map((participant) => (
                    <div key={participant.userId} className="flex items-center justify-between gap-3 rounded-xl bg-background p-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <CommunityAvatar src={participant.player.avatar} name={participant.player.name} size={28} className="size-7" />
                        <span className="truncate text-sm font-medium">{participant.player.name}</span>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleReject(participant.userId)}
                          className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold hover:bg-secondary"
                        >
                          Từ chối
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(participant.userId)}
                          className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                        >
                          Duyệt
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <CommunityAvatar src={match.host.avatar} name={match.host.name} size={32} className="size-8" />
          <div className="leading-tight">
            <p className="text-xs font-semibold">{match.host.name}</p>
            <p className="text-[11px] text-muted-foreground">{match.price}</p>
            {match.isHost && match.pendingParticipants ? (
              <p className="text-[11px] font-semibold text-primary">{match.pendingParticipants} yêu cầu chờ duyệt</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {match.roomId ? (
            <Link
              href={`/community/chat?room=${match.roomId}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              <MessageCircle className="size-3.5" />
              Vào chat
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleJoin}
            disabled={joinDisabled}
            className="rounded-full bg-primary px-4 py-2 text-[0px] font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="text-sm">
              {joined
                ? 'Đã tham gia'
                : requested
                  ? 'Đã gửi yêu cầu'
                  : match.expired || match.status === 'expired'
                    ? 'Quá hạn'
                    : match.status === 'full'
                      ? 'Đã đủ'
                      : 'Xin tham gia'}
            </span>
          {joined ? 'Đã tham gia' : 'Xin tham gia'}
          </button>
        </div>
      </div>
    </article>
  )
}

function Meta({
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

export function PlayerCard({
  player,
  compact = false,
}: {
  player: CommunityPlayer
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <Link href={`/community/profile/${player.username}`}>
          <CommunityAvatar src={player.avatar} name={player.name} size={40} className="size-10" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/community/profile/${player.username}`}
            className="block truncate text-sm font-semibold hover:underline"
          >
            {player.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {player.level}{player.district ? ` · ${player.district}` : ''}
          </p>
        </div>
        <Link
          href={`/community/profile/${player.username}`}
          className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background"
        >
          Xem
        </Link>
      </div>
    )
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="relative h-20 bg-muted">
        <Image
          src={player.cover || '/community/hero.png'}
          alt=""
          fill
          className="object-cover"
          sizes="320px"
        />
      </div>
      <div className="px-5 pb-5">
        <Link href={`/community/profile/${player.username}`}>
          <CommunityAvatar
            src={player.avatar}
            name={player.name}
            size={64}
            className="-mt-8 size-16 ring-4 ring-card"
          />
        </Link>
        <div className="mt-2 flex items-start justify-between gap-2">
          <div>
            <Link
              href={`/community/profile/${player.username}`}
              className="font-heading text-lg font-semibold hover:underline"
            >
              {player.name}
            </Link>
            <p className="text-xs text-muted-foreground">@{player.username}</p>
          </div>
          <LevelBadge level={player.level} />
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {player.bio}
        </p>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">{player.followers}</strong> theo dõi
          </span>
          <span>
            <strong className="text-foreground">{player.matches}</strong> trận
          </span>
        </div>
        <Link
          href={`/community/profile/${player.username}`}
          className="mt-4 block w-full rounded-full bg-primary py-2 text-center text-sm font-semibold text-primary-foreground"
        >
          Xem hồ sơ
        </Link>
      </div>
    </article>
  )
}
