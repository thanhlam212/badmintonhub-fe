'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Newspaper,
  Users,
  Bell,
  PenSquare,
  User,
  ArrowLeft,
  Search,
  MessageCircle,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { CommunityMark } from './primitives'

type CommunityNavItem = {
  href: string
  label: string
  icon: typeof Home
  exact?: boolean
  badge?: string | number
}

const baseNav: CommunityNavItem[] = [
  { href: '/community', label: 'Khám phá', icon: Home, exact: true },
  { href: '/community/feed', label: 'Bảng tin', icon: Newspaper },
  { href: '/community/matches', label: 'Tìm đội', icon: Users },
  { href: '/community/notifications', label: 'Thông báo', icon: Bell },
]

const communityNav: CommunityNavItem[] = [
  ...baseNav.slice(0, 3),
  { href: '/community/chat', label: 'Chat', icon: MessageCircle },
  ...baseNav.slice(3),
]

function useIsActive() {
  const pathname = usePathname()
  return (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)
}

/* ---------------- Top header (all breakpoints) ---------------- */
export function CommunityHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <CommunityMark />

        <div className="hidden flex-1 items-center md:flex md:max-w-sm lg:max-w-md">
          <label className="flex w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground focus-within:border-foreground">
            <Search className="size-4 shrink-0" />
            <input
              type="search"
              placeholder="Tìm người chơi, hashtag, kèo đấu…"
              className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/courts"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-2 text-sm font-medium transition-colors hover:bg-secondary sm:px-3"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden min-[420px]:inline">Về đặt sân</span>
            <span className="min-[420px]:hidden">Sân</span>
          </Link>
          <Link
            href="/community/create"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            <PenSquare className="size-4" />
            <span className="hidden sm:inline">Đăng bài</span>
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ---------------- Left rail (desktop) ---------------- */
export function CommunityLeftNav() {
  const { user } = useAuth()
  const isActive = useIsActive()
  const nav = [
    ...communityNav,
    {
      href: user && user.role !== 'guest' ? `/community/profile/${user.username}` : '/login',
      label: 'Hồ sơ',
      icon: User,
    },
  ]
  return (
    <>
      <nav className="-mx-1 flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {nav.map((item) => {
          const active = isActive(item.href, item.exact)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors',
                active
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card text-foreground hover:bg-secondary',
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
        <Link
          href="/community/create"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          <PenSquare className="size-4" />
          Tạo bài
        </Link>
      </nav>

      <nav className="sticky top-24 hidden h-fit flex-col gap-1 lg:flex">
        {nav.map((item) => {
          const active = isActive(item.href, item.exact)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition-colors',
                active
                  ? 'bg-foreground text-background'
                  : 'text-foreground hover:bg-secondary',
              )}
            >
              <Icon className="size-5" />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span
                  className={cn(
                    'grid size-5 place-items-center rounded-full text-[11px] font-bold',
                    active
                      ? 'bg-background text-foreground'
                      : 'bg-primary text-primary-foreground',
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          )
        })}

        <Link
          href="/community/create"
          className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <PenSquare className="size-4" />
          Tạo bài viết
        </Link>
      </nav>
    </>
  )
}

/* ---------------- Bottom nav (mobile) ---------------- */
export function CommunityMobileNav() {
  const { user } = useAuth()
  const isActive = useIsActive()
  const nav = [
    ...communityNav,
    {
      href: user && user.role !== 'guest' ? `/community/profile/${user.username}` : '/login',
      label: 'Hồ sơ',
      icon: User,
    },
  ]
  const items = nav.filter((n) => n.label !== 'Hồ sơ')
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
        {items.map((item) => {
          const active = isActive(item.href, item.exact)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <span className="relative">
                <Icon className="size-5" />
                {item.badge ? (
                  <span className="absolute -right-2 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
