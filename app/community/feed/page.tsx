'use client'

import { useEffect, useState } from 'react'
import { Check, UserPlus, X } from 'lucide-react'
import {
  communityApi,
  type CommunityFeedResponse,
  type CommunityFriendshipItem,
  type CommunityPostKind,
} from '@/lib/community-api'
import { useAuth } from '@/lib/auth-context'
import { PostCard } from '@/components/community/cards'
import { CommunityLeftNav } from '@/components/community/navigation'
import { CommunityRightSidebar, PostComposer } from '@/components/community/sidebar'
import { CommunityAvatar } from '@/components/community/primitives'

const tabs: ('Tất cả' | CommunityPostKind)[] = [
  'Tất cả',
  'Tìm đội',
  'Check-in',
  'Review sân',
  'Mẹo chơi',
]

const emptyFeed: CommunityFeedResponse = {
  posts: [],
  trendingTags: [],
  suggestedPlayers: [],
  upcomingSessions: [],
}

export default function FeedPage() {
  const { user } = useAuth()
  const [active, setActive] = useState<(typeof tabs)[number]>('Tất cả')
  const [data, setData] = useState<CommunityFeedResponse>(emptyFeed)
  const [incomingRequests, setIncomingRequests] = useState<CommunityFriendshipItem[]>([])
  const [loading, setLoading] = useState(true)
  const [friendBusy, setFriendBusy] = useState('')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    communityApi.getFeed(active === 'Tất cả' ? undefined : active).then((res) => {
      if (!mounted) return
      setData(res)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [active])

  useEffect(() => {
    if (!user || user.role === 'guest') {
      setIncomingRequests([])
      return
    }
    communityApi.getFriends().then((res) => {
      setIncomingRequests(res.incomingRequests)
    })
  }, [user])

  async function handleFriendAction(
    request: CommunityFriendshipItem,
    action: 'accept' | 'reject',
  ) {
    setFriendBusy(request.player.username)
    try {
      const res =
        action === 'accept'
          ? await communityApi.acceptFriendRequest(request.player.username)
          : await communityApi.rejectFriendRequest(request.player.username)
      if (!res.success) return
      setIncomingRequests((current) =>
        current.filter((item) => item.player.username !== request.player.username),
      )
    } finally {
      setFriendBusy('')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <CommunityLeftNav />

        <main className="min-w-0">
          <header className="mb-5">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              Bảng tin cộng đồng
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Những gì đang diễn ra trên sân cầu Hà Nội hôm nay.
            </p>
          </header>

          <PostComposer
            onPosted={(post) =>
              setData((current) => ({
                ...current,
                posts:
                  active === 'Tất cả' || active === post.kind
                    ? [post, ...current.posts]
                    : current.posts,
              }))
            }
          />

          {incomingRequests.length > 0 ? (
            <section className="mt-5 rounded-3xl border border-amber-200 bg-[linear-gradient(135deg,#fff7ed,#fffbeb)] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <span className="grid size-10 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                  <UserPlus className="size-5" />
                </span>
                <div>
                  <h2 className="font-heading text-lg font-semibold">Loi moi ket ban moi</h2>
                  <p className="text-sm text-muted-foreground">
                    Co {incomingRequests.length} loi moi dang cho ban phan hoi.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {incomingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-white/80 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <CommunityAvatar
                        src={request.player.avatar}
                        name={request.player.name}
                        size={40}
                        className="size-10"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{request.player.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{request.player.username}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={friendBusy === request.player.username}
                        onClick={() => handleFriendAction(request, 'reject')}
                        className="grid size-9 place-items-center rounded-full border border-border bg-background text-muted-foreground hover:bg-secondary disabled:opacity-60"
                      >
                        <X className="size-4" />
                      </button>
                      <button
                        type="button"
                        disabled={friendBusy === request.player.username}
                        onClick={() => handleFriendAction(request, 'accept')}
                        className="grid size-9 place-items-center rounded-full bg-emerald-600 text-white disabled:opacity-60"
                      >
                        <Check className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="sticky top-16 z-30 -mx-4 mt-5 border-y border-border bg-background/90 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-full sm:border sm:px-2">
            <div className="flex items-center gap-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActive(tab)}
                  className={[
                    'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    active === tab
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-secondary',
                  ].join(' ')}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-56 animate-pulse rounded-3xl bg-muted" />
              ))
            ) : data.posts.length > 0 ? (
              data.posts.map((post) => <PostCard key={post.id} post={post} />)
            ) : (
              <EmptyState label={active} />
            )}
          </div>
        </main>

        <CommunityRightSidebar
          trendingTags={data.trendingTags}
          suggestedPlayers={data.suggestedPlayers}
          upcomingSessions={data.upcomingSessions}
        />
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      <p className="font-heading text-lg font-semibold">
        Chưa có bài "{label}" nào
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Hãy là người đầu tiên đăng bài cho mục này.
      </p>
    </div>
  )
}
