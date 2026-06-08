'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { MapPin, MessageCircle, Share2 } from 'lucide-react'
import { communityApi, type CommunityProfileResponse } from '@/lib/community-api'
import { CommunityAvatar, LevelBadge } from '@/components/community/primitives'
import { ProfileTabs } from '@/components/community/profile-tabs'
import { FollowButton } from '@/components/community/follow-button'

export default function ProfilePage() {
  const params = useParams<{ username: string }>()
  const [data, setData] = useState<CommunityProfileResponse | null>(null)

  useEffect(() => {
    if (!params?.username) return
    communityApi.getProfile(params.username).then(setData)
  }, [params?.username])

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6">
        <div className="h-44 animate-pulse rounded-3xl bg-muted sm:h-60" />
        <div className="mt-6 h-40 animate-pulse rounded-3xl bg-muted" />
      </div>
    )
  }

  const { player } = data
  const stats = [
    ['Bài viết', data.posts.length],
    ['Người theo dõi', player.followers],
    ['Đang theo dõi', player.following],
    ['Check-in', player.checkins],
  ] as const

  return (
    <div className="mx-auto max-w-4xl px-4 pb-10 sm:px-6">
      <div className="relative mt-4 h-44 overflow-hidden rounded-3xl bg-muted sm:h-60">
        <Image
          src={player.cover || '/community/hero.png'}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 896px"
          priority
        />
      </div>

      <div className="px-1 sm:px-4">
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <CommunityAvatar
              src={player.avatar}
              name={player.name}
              size={112}
              className="size-24 ring-4 ring-background sm:size-28"
            />
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                  {player.name}
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">@{player.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-border transition-colors hover:bg-secondary"
              aria-label="Nhắn tin"
            >
              <MessageCircle className="size-5" />
            </button>
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-border transition-colors hover:bg-secondary"
              aria-label="Chia sẻ hồ sơ"
            >
              <Share2 className="size-5" />
            </button>
            <FollowButton username={player.username} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <LevelBadge level={player.level} />
          {player.district ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm">
              <MapPin className="size-4 text-primary" />
              {player.district}
            </span>
          ) : null}
        </div>

        <p className="mt-4 max-w-xl text-pretty leading-relaxed">{player.bio}</p>

        <div className="mt-5 flex flex-wrap gap-6 border-y border-border py-4">
          {stats.map(([label, value]) => (
            <div key={label}>
              <p className="font-heading text-xl font-semibold">
                {value.toLocaleString('vi-VN')}
              </p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 px-1 sm:px-4">
        <ProfileTabs
          player={player}
          posts={data.posts}
          checkins={data.checkins}
          hostedMatches={data.hostedMatches}
          savedPosts={data.savedPosts}
        />
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/community/feed"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Quay lại bảng tin
        </Link>
      </div>
    </div>
  )
}
