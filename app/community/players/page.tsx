'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  Loader2,
  MessageCircle,
  Search,
  SlidersHorizontal,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import {
  communityApi,
  type CommunityDistrict,
  type CommunityFriendshipItem,
  type CommunityFriendshipStatus,
  type CommunityLevel,
  type CommunityPlayer,
} from '@/lib/community-api'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { CommunityAvatar, LevelBadge } from '@/components/community/primitives'

const districts: (CommunityDistrict | 'Tat ca')[] = [
  'Tat ca',
  'Cầu Giấy',
  'Thanh Xuân',
  'Long Biên',
]
const levels: (CommunityLevel | 'Moi trinh')[] = [
  'Moi trinh',
  'Mới chơi',
  'Trung bình',
  'Khá',
  'Nâng cao',
]

export default function CommunityPlayersPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [keyword, setKeyword] = useState('')
  const [district, setDistrict] = useState<(typeof districts)[number]>('Tat ca')
  const [level, setLevel] = useState<(typeof levels)[number]>('Moi trinh')
  const [players, setPlayers] = useState<CommunityPlayer[]>([])
  const [incomingRequests, setIncomingRequests] = useState<CommunityFriendshipItem[]>([])
  const [loading, setLoading] = useState(true)
  const [startingChat, setStartingChat] = useState('')
  const [friendBusy, setFriendBusy] = useState('')

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) setKeyword(q)
  }, [])

  useEffect(() => {
    if (!user || user.role === 'guest') return
    communityApi.getFriends().then((res) => {
      setIncomingRequests(res.incomingRequests)
    })
  }, [user])

  useEffect(() => {
    let mounted = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      communityApi
        .getPlayers({
          q: keyword.trim() || undefined,
          district: district === 'Tat ca' ? undefined : district,
          level: level === 'Moi trinh' ? undefined : level,
        })
        .then((res) => {
          if (!mounted) return
          setPlayers(res.players)
          setLoading(false)
        })
        .catch(() => {
          if (!mounted) return
          setPlayers([])
          setLoading(false)
        })
    }, 250)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [keyword, district, level])

  async function handlePrivateChat(player: CommunityPlayer) {
    if (!user || user.role === 'guest') {
      router.push('/login')
      return
    }
    if (player.username === user.username) return

    setStartingChat(player.username)
    try {
      const res = await communityApi.startPrivateChat(player.username)
      if (res.success && res.room) {
        router.push(`/community/chat?room=${res.room.id}`)
      }
    } finally {
      setStartingChat('')
    }
  }

  function updateFriendship(username: string, status: CommunityFriendshipStatus) {
    setPlayers((current) =>
      current.map((player) =>
        player.username === username ? { ...player, friendshipStatus: status } : player,
      ),
    )
    setIncomingRequests((current) =>
      current.filter((item) => item.player.username !== username),
    )
  }

  async function handleFriendAction(
    player: CommunityPlayer,
    action: 'request' | 'accept' | 'reject',
  ) {
    if (!user || user.role === 'guest') {
      router.push('/login')
      return
    }
    setFriendBusy(player.username)
    try {
      const res =
        action === 'accept'
          ? await communityApi.acceptFriendRequest(player.username)
          : action === 'reject'
            ? await communityApi.rejectFriendRequest(player.username)
            : await communityApi.sendFriendRequest(player.username)
      if (res.success) updateFriendship(player.username, res.friendshipStatus)
    } finally {
      setFriendBusy('')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <section className="overflow-hidden rounded-[2rem] border border-border bg-card">
        <div className="bg-[radial-gradient(circle_at_top_left,#fed7aa,transparent_34%),linear-gradient(135deg,#0f2f24,#153a2c)] p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-100">
            Find players
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Tim nguoi choi de bat keo, ket ban hoac chat rieng
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-orange-50/85">
            Tim theo ten, username, khu vuc va trinh do. Ban co the gui loi moi ket
            ban hoac mo chat 1-1 ngay tai day.
          </p>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-3xl border border-border bg-background p-4">
            <label className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm focus-within:border-foreground">
              <Search className="size-4 shrink-0 text-primary" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tim ten hoac username..."
                className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </label>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="size-4 text-primary" />
                Bo loc
              </div>
              <FilterPills label="Khu vuc" options={districts} value={district} onChange={setDistrict} />
              <FilterPills label="Trinh do" options={levels} value={level} onChange={setLevel} />
            </div>
          </aside>

          <main className="min-h-[420px]">
            {incomingRequests.length > 0 ? (
              <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <p className="font-heading text-lg font-semibold">Loi moi ket ban</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {incomingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <CommunityAvatar
                          src={request.player.avatar}
                          name={request.player.name}
                          size={34}
                          className="size-9"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {request.player.name}
                          </p>
                          <p className="truncate text-xs opacity-75">
                            @{request.player.username}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleFriendAction(request.player, 'reject')}
                          className="grid size-8 place-items-center rounded-full border border-amber-200 bg-white hover:bg-amber-100"
                        >
                          <X className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFriendAction(request.player, 'accept')}
                          className="grid size-8 place-items-center rounded-full bg-emerald-600 text-white"
                        >
                          <Check className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {loading ? 'Dang tim nguoi choi...' : `${players.length} nguoi choi phu hop`}
              </p>
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-52 animate-pulse rounded-3xl bg-muted" />
                ))}
              </div>
            ) : players.length === 0 ? (
              <div className="grid min-h-[360px] place-items-center rounded-3xl border border-dashed border-border bg-background p-8 text-center">
                <div>
                  <Users className="mx-auto size-9 text-muted-foreground" />
                  <p className="mt-3 font-heading text-lg font-semibold">
                    Chua tim thay nguoi choi
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Thu doi tu khoa hoac bo loc khac.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {players.map((player) => {
                  const isMe = player.username === user?.username
                  return (
                    <article
                      key={player.username}
                      className="rounded-3xl border border-border bg-background p-4"
                    >
                      <div className="flex items-start gap-3">
                        <CommunityAvatar
                          src={player.avatar}
                          name={player.name}
                          size={52}
                          className="size-13"
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/community/profile/${player.username}`}
                            className="block truncate font-heading text-lg font-semibold hover:text-primary"
                          >
                            {player.name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            @{player.username}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <LevelBadge level={player.level} />
                            {player.district ? (
                              <span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-semibold text-secondary-foreground">
                                {player.district}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted-foreground">
                        {player.bio || 'Nguoi choi BadmintonHub dang san sang ket noi.'}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          <strong className="text-foreground">{player.matches}</strong> keo ·{' '}
                          <strong className="text-foreground">{player.followers}</strong> theo doi
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5">
                          <FriendButton
                            player={player}
                            isMe={isMe}
                            busy={friendBusy === player.username}
                            onAction={handleFriendAction}
                          />
                          <button
                            type="button"
                            onClick={() => handlePrivateChat(player)}
                            disabled={isMe || startingChat === player.username}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {startingChat === player.username ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <MessageCircle className="size-3.5" />
                            )}
                            {isMe ? 'Ban' : 'Nhan rieng'}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  )
}

function FilterPills<T extends string>({
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
    <div className="mt-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
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

function FriendButton({
  player,
  isMe,
  busy,
  onAction,
}: {
  player: CommunityPlayer
  isMe: boolean
  busy: boolean
  onAction: (player: CommunityPlayer, action: 'request' | 'accept' | 'reject') => void
}) {
  if (isMe) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-60"
      >
        Ban
      </button>
    )
  }

  if (player.friendshipStatus === 'friends') {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-80"
      >
        <Check className="size-3.5" />
        Ban be
      </button>
    )
  }

  if (player.friendshipStatus === 'incoming') {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction(player, 'reject')}
          className="grid size-8 place-items-center rounded-full border border-border bg-background disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction(player, 'accept')}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          <Check className="size-3.5" />
          Chap nhan
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={busy || player.friendshipStatus === 'outgoing'}
      onClick={() => onAction(player, 'request')}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60',
        player.friendshipStatus === 'outgoing'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-border bg-background hover:bg-secondary',
      )}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : player.friendshipStatus === 'outgoing' ? (
        <Check className="size-3.5" />
      ) : (
        <UserPlus className="size-3.5" />
      )}
      {player.friendshipStatus === 'outgoing' ? 'Da gui' : 'Them ban'}
    </button>
  )
}
