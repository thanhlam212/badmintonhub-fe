'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Users,
  PenSquare,
  Newspaper,
  Sparkles,
  MessageCircle,
  Trophy,
} from 'lucide-react'
import { communityApi, type CommunityLandingResponse } from '@/lib/community-api'
import { PostCard, MatchCard, PlayerCard } from '@/components/community/cards'
import { CommunityAvatar, SectionLabel } from '@/components/community/primitives'

const emptyLanding: CommunityLandingResponse = {
  featuredPlayers: [],
  featuredPosts: [],
  activeMatches: [],
}

export default function CommunityLandingPage() {
  const [data, setData] = useState<CommunityLandingResponse>(emptyLanding)

  useEffect(() => {
    communityApi.getLanding().then(setData)
  }, [])

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <Hero playersCount={data.featuredPlayers.length} avatars={data.featuredPlayers.map((player) => player.avatar)} />
      <WhyJoin />
      <FeaturedPosts posts={data.featuredPosts} />
      <ActiveMatches matches={data.activeMatches} />
      <FeaturedPlayers players={data.featuredPlayers} />
      <FinalCta />
    </div>
  )
}

function Hero({
  playersCount,
  avatars,
}: {
  playersCount: number
  avatars: string[]
}) {
  return (
    <section className="grid items-center gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
      <div>
        <SectionLabel>Văn hoá cầu lông Hà Nội</SectionLabel>
        <h1 className="mt-5 font-heading text-5xl font-semibold leading-[0.95] tracking-tight text-balance sm:text-6xl lg:text-7xl">
          Nơi người mê cầu lông <span className="text-primary italic">gặp nhau</span>.
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
          Không phải nơi đặt sân. Đây là sân chơi — tìm đội, check-in sau trận,
          review sân và kể câu chuyện cầu lông của bạn cùng cộng đồng tại Cầu
          Giấy, Thanh Xuân và Long Biên.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/community/feed"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            Vào bảng tin
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/community/matches"
            className="inline-flex items-center gap-2 rounded-full border border-foreground px-6 py-3 font-semibold transition-colors hover:bg-foreground hover:text-background"
          >
            <Users className="size-4" />
            Tìm đội
          </Link>
          <Link
            href="/community/create"
            className="inline-flex items-center gap-2 rounded-full px-4 py-3 font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <PenSquare className="size-4" />
            Đăng bài đầu tiên
          </Link>
        </div>

        <div className="mt-9 flex items-center gap-6">
          <div className="flex -space-x-3">
            {avatars.slice(0, 4).map((avatar, index) => (
              <CommunityAvatar
                key={`${avatar || 'player'}-${index}`}
                src={avatar}
                name={`Người chơi ${index + 1}`}
                size={40}
                className="size-10 ring-2 ring-background"
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{Math.max(playersCount, 5)}+</strong> người chơi
            đang hoạt động trong community demo
          </p>
        </div>
      </div>

      <div className="relative">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-border sm:aspect-[5/4] lg:aspect-[4/5]">
          <Image
            src="/community/hero.png"
            alt="Người chơi cầu lông ăn mừng sau trận đấu"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 560px"
          />
          <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl border border-white/15 bg-black/45 p-3 backdrop-blur">
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Trophy className="size-5" />
            </span>
            <div className="text-white">
              <p className="text-sm font-semibold">Kết nối người chơi</p>
              <p className="text-xs text-white/70">Feed, kèo đấu và review sân trong cùng một nơi</p>
            </div>
          </div>
        </div>
        <span className="absolute -left-3 -top-3 hidden rotate-[-8deg] rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background sm:block">
          #SanChoi
        </span>
      </div>
    </section>
  )
}

function WhyJoin() {
  const items = [
    {
      icon: Users,
      title: 'Tìm đội trong vài phút',
      desc: 'Đăng kèo hoặc xin tham gia theo khu vực, trình độ và khung giờ phù hợp.',
    },
    {
      icon: Newspaper,
      title: 'Review sân thật',
      desc: 'Đọc trải nghiệm thật từ người chơi trước khi chọn sân và khung giờ.',
    },
    {
      icon: MessageCircle,
      title: 'Chia sẻ & học hỏi',
      desc: 'Mẹo kỹ thuật, review vợt giày, và những pha cầu đáng nhớ mỗi ngày.',
    },
    {
      icon: Sparkles,
      title: 'Check-in sau trận',
      desc: 'Lưu lại khoảnh khắc, gắn thẻ đồng đội và xây dựng hồ sơ người chơi.',
    },
  ]
  return (
    <section className="border-t border-border py-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionLabel>Vì sao tham gia</SectionLabel>
          <h2 className="mt-3 max-w-md font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Một cộng đồng, bốn lý do để ở lại
          </h2>
        </div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.title}
            className="group rounded-3xl border border-border bg-card p-6 transition-colors hover:border-foreground"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <item.icon className="size-6" />
            </span>
            <h3 className="mt-4 font-heading text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function FeaturedPosts({ posts }: { posts: CommunityLandingResponse['featuredPosts'] }) {
  return (
    <section className="border-t border-border py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <SectionLabel>Bài viết nổi bật</SectionLabel>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Đang được nói đến
          </h2>
        </div>
        <Link
          href="/community/feed"
          className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex"
        >
          Xem bảng tin <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {posts.length
          ? posts.map((post) => <PostCard key={post.id} post={post} />)
          : Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-80 animate-pulse rounded-3xl bg-muted" />
            ))}
      </div>
    </section>
  )
}

function ActiveMatches({ matches }: { matches: CommunityLandingResponse['activeMatches'] }) {
  return (
    <section className="border-t border-border py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <SectionLabel>Kèo đang tìm người</SectionLabel>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Tham gia ngay tối nay
          </h2>
        </div>
        <Link
          href="/community/matches"
          className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex"
        >
          Tất cả kèo <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matches.length
          ? matches.map((match) => <MatchCard key={match.id} match={match} />)
          : Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-3xl bg-muted" />
            ))}
      </div>
    </section>
  )
}

function FeaturedPlayers({ players }: { players: CommunityLandingResponse['featuredPlayers'] }) {
  return (
    <section className="border-t border-border py-12">
      <div>
        <SectionLabel>Người chơi nổi bật</SectionLabel>
        <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Những gương mặt của cộng đồng
        </h2>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {players.length
          ? players.map((player) => <PlayerCard key={player.username} player={player} />)
          : Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-80 animate-pulse rounded-3xl bg-muted" />
            ))}
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="py-12">
      <div className="cm-dark relative overflow-hidden rounded-[2rem] px-6 py-14 text-center sm:px-12 sm:py-20">
        <span className="pointer-events-none absolute -right-10 -top-10 font-heading text-[10rem] leading-none text-white/5 select-none">
          #
        </span>
        <SectionLabel className="justify-center">Sẵn sàng vào sân?</SectionLabel>
        <h2 className="mx-auto mt-4 max-w-2xl font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Đăng bài đầu tiên của bạn hôm nay
        </h2>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          Một pha smash, một lời tìm đội, hay review sân yêu thích — cộng đồng
          đang chờ nghe câu chuyện của bạn.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/community/create"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            <PenSquare className="size-4" />
            Tạo bài viết
          </Link>
          <Link
            href="/community/feed"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 font-semibold transition-colors hover:bg-white/10"
          >
            Khám phá bảng tin
          </Link>
        </div>
      </div>
    </section>
  )
}
