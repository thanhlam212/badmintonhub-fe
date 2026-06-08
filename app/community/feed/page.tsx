'use client'

import { useEffect, useState } from 'react'
import { communityApi, type CommunityFeedResponse, type CommunityPostKind } from '@/lib/community-api'
import { PostCard } from '@/components/community/cards'
import { CommunityLeftNav } from '@/components/community/navigation'
import { CommunityRightSidebar, PostComposer } from '@/components/community/sidebar'

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
  const [active, setActive] = useState<(typeof tabs)[number]>('Tất cả')
  const [data, setData] = useState<CommunityFeedResponse>(emptyFeed)
  const [loading, setLoading] = useState(true)

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
