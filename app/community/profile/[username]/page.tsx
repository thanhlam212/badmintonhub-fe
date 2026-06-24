'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Camera, ImagePlus, MapPin, MessageCircle, Share2, Trash2 } from 'lucide-react'
import { communityApi, type CommunityProfileResponse } from '@/lib/community-api'
import { useAuth } from '@/lib/auth-context'
import { CommunityAvatar, LevelBadge } from '@/components/community/primitives'
import { ProfileTabs } from '@/components/community/profile-tabs'
import { FollowButton } from '@/components/community/follow-button'

export default function ProfilePage() {
  const params = useParams<{ username: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const [data, setData] = useState<CommunityProfileResponse | null>(null)
  const [busy, setBusy] = useState<'avatar' | 'cover' | ''>('')

  useEffect(() => {
    if (!params?.username) return
    communityApi.getProfile(params.username).then(setData)
  }, [params?.username])

  async function uploadAndSave(kind: 'avatar' | 'cover', file?: File | null) {
    if (!file || !data) return
    setBusy(kind)
    try {
      const uploaded = await communityApi.uploadImage(file)
      if (!uploaded.success || !uploaded.url) return

      const result = await communityApi.updateProfile(
        kind === 'avatar'
          ? { avatar_url: uploaded.url }
          : { cover_image_url: uploaded.url },
      )

      if (!result.success || !result.player) return
      setData((current) =>
        current
          ? {
              ...current,
              player: result.player!,
            }
          : current,
      )
    } finally {
      setBusy('')
    }
  }

  async function clearCover() {
    if (!data) return
    setBusy('cover')
    try {
      const result = await communityApi.updateProfile({ cover_image_url: '' })
      if (!result.success || !result.player) return
      setData((current) => (current ? { ...current, player: result.player! } : current))
    } finally {
      setBusy('')
    }
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-8 sm:px-6">
        <div className="h-56 animate-pulse rounded-[2rem] bg-muted sm:h-72" />
        <div className="mt-6 h-48 animate-pulse rounded-[2rem] bg-muted" />
      </div>
    )
  }

  const { player } = data
  const isOwner = user?.username === player.username
  const stats = [
    ['Bai viet', data.posts.length],
    ['Nguoi theo doi', player.followers],
    ['Dang theo doi', player.following],
    ['Check-in', player.checkins],
  ] as const

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6">
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => uploadAndSave('cover', event.target.files?.[0])}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => uploadAndSave('avatar', event.target.files?.[0])}
      />

      <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
        <div className="relative">
          <div className="relative h-56 overflow-hidden border-b border-border bg-[linear-gradient(135deg,#fbf7ed,#f1ead9)] sm:h-72">
            {player.cover ? (
              <Image
                src={player.cover}
                alt={`${player.name} cover`}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 960px"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(208,92,55,0.18),transparent_26%),radial-gradient(circle_at_80%_30%,rgba(15,47,36,0.16),transparent_24%),linear-gradient(135deg,#fbf7ed,#f4efe2)]" />
            )}

            {isOwner ? (
              <div className="absolute inset-x-4 top-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={busy === 'cover'}
                  className="inline-flex items-center gap-2 rounded-full bg-background/92 px-4 py-2 text-sm font-semibold text-foreground shadow-sm backdrop-blur disabled:opacity-60"
                >
                  <ImagePlus className="size-4" />
                  {player.cover ? 'Doi anh bia' : 'Them anh bia'}
                </button>
                {player.cover ? (
                  <button
                    type="button"
                    onClick={clearCover}
                    disabled={busy === 'cover'}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background/92 px-4 py-2 text-sm font-semibold text-muted-foreground backdrop-blur disabled:opacity-60"
                  >
                    <Trash2 className="size-4" />
                    Xoa
                  </button>
                ) : null}
              </div>
            ) : null}

            {!player.cover && isOwner ? (
              <div className="absolute inset-0 grid place-items-center px-6 text-center">
                <div>
                  <p className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                    Ho so cua ban dang chua co anh bia
                  </p>
                  <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                    Them mot anh cover de profile trong community trong noi bat hon.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative px-5 pb-6 sm:px-8">
            <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="relative w-fit">
                  <div className="rounded-[2rem] bg-background p-2 shadow-lg">
                    <CommunityAvatar
                      src={player.avatar}
                      name={player.name}
                      size={128}
                      className="size-28 rounded-[1.5rem] object-cover sm:size-32"
                    />
                  </div>
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={busy === 'avatar'}
                      className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg disabled:opacity-60"
                    >
                      <Camera className="size-3.5" />
                      {player.avatar ? 'Doi' : 'Them'}
                    </button>
                  ) : null}
                </div>

                <div className="pb-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                      {player.name}
                    </h1>
                    <LevelBadge level={player.level} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">@{player.username}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {player.district ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm">
                        <MapPin className="size-4 text-primary" />
                        {player.district}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/community/players?q=${encodeURIComponent(player.username)}`)}
                  className="grid size-11 place-items-center rounded-full border border-border transition-colors hover:bg-secondary"
                  aria-label="Tim nguoi choi"
                >
                  <MessageCircle className="size-5" />
                </button>
                <button
                  type="button"
                  className="grid size-11 place-items-center rounded-full border border-border transition-colors hover:bg-secondary"
                  aria-label="Chia se ho so"
                >
                  <Share2 className="size-5" />
                </button>
                {!isOwner ? <FollowButton username={player.username} /> : null}
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <p className="max-w-2xl text-pretty text-base leading-7 text-foreground/90">
                  {player.bio || `${player.name} dang tham gia cong dong cau long BadmintonHub.`}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 rounded-[1.5rem] border border-border bg-background/70 p-4 sm:grid-cols-4">
                  {stats.map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-card px-4 py-3">
                      <p className="font-heading text-2xl font-semibold">
                        {value.toLocaleString('vi-VN')}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-border bg-background/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Ho so
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {isOwner
                    ? 'Ban co the doi avatar, them anh bia hoac de trong neu muon profile toi gian.'
                    : 'Theo doi, nhan rieng va ket noi voi nguoi choi nay trong cong dong.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 rounded-[2rem] border border-border bg-card p-4 sm:p-6">
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
          ← Quay lai bang tin
        </Link>
      </div>
    </div>
  )
}
