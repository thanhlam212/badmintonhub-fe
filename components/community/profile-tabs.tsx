'use client'

import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import type { CommunityMatch, CommunityPlayer, CommunityPost } from '@/lib/community-api'
import { PostCard, MatchCard } from './cards'

const tabs = ['Bài viết', 'Kèo đã đăng', 'Check-in', 'Đã lưu'] as const

export function ProfileTabs({
  player,
  posts,
  checkins,
  hostedMatches,
  savedPosts,
}: {
  player: CommunityPlayer
  posts: CommunityPost[]
  checkins: CommunityPost[]
  hostedMatches: CommunityMatch[]
  savedPosts: CommunityPost[]
}) {
  const [active, setActive] = useState<(typeof tabs)[number]>('Bài viết')

  return (
    <div>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={[
              'relative shrink-0 px-4 py-3 text-sm font-medium transition-colors',
              active === tab
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tab}
            {active === tab ? (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {active === 'Bài viết' &&
          (posts.length ? posts.map((post) => <PostCard key={post.id} post={post} />) : <Empty text={`${player.name} chưa có bài viết nào.`} />)}

        {active === 'Kèo đã đăng' &&
          (hostedMatches.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {hostedMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          ) : (
            <Empty text="Chưa đăng kèo nào." />
          ))}

        {active === 'Check-in' &&
          (checkins.length ? checkins.map((post) => <PostCard key={post.id} post={post} />) : <Empty text="Chưa có check-in nào." />)}

        {active === 'Đã lưu' &&
          (savedPosts.length ? savedPosts.map((post) => <PostCard key={post.id} post={post} />) : (
            <Empty icon text="Mục đã lưu hiện chưa có dữ liệu công khai." />
          ))}
      </div>
    </div>
  )
}

function Empty({ text, icon }: { text: string; icon?: boolean }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
      {icon ? <Bookmark className="mx-auto mb-3 size-6 text-muted-foreground" /> : null}
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
