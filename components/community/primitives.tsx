'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CommunityLevel } from '@/lib/community-api'

const levelDots: Record<CommunityLevel, number> = {
  'Mới chơi': 1,
  'Trung bình': 2,
  'Khá': 3,
  'Nâng cao': 4,
}

export function CommunityMark({ className }: { className?: string }) {
  return (
    <Link
      href="/community"
      className={cn('group inline-flex items-center gap-2.5', className)}
    >
      <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:-rotate-12">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
          <path
            d="M12 2 9 13l3 9 3-9-3-11Z"
            fill="currentColor"
            opacity="0.9"
          />
          <circle cx="12" cy="20" r="2" fill="currentColor" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-heading text-lg font-semibold tracking-tight">
          Sân Chơi
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          BadmintonHub Community
        </span>
      </span>
    </Link>
  )
}

export function CommunityAvatar({
  src,
  name,
  size,
  className,
}: {
  src?: string | null
  name: string
  size: number
  className?: string
}) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [src])

  if (src && !hasError) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn('rounded-full object-cover', className)}
        onError={() => setHasError(true)}
      />
    )
  }

  return (
    <div
      className={cn(
        'grid place-items-center rounded-full bg-secondary font-semibold text-foreground',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(12, Math.round(size * 0.36)),
      }}
    >
      <User
        className="text-muted-foreground"
        style={{
          width: Math.max(16, Math.round(size * 0.46)),
          height: Math.max(16, Math.round(size * 0.46)),
        }}
      />
    </div>
  )
}

export function LevelBadge({
  level,
  className,
}: {
  level: CommunityLevel
  className?: string
}) {
  const dots = levelDots[level]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium',
        className,
      )}
    >
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4].map((d) => (
          <span
            key={d}
            className={cn(
              'size-1.5 rounded-full',
              d <= dots ? 'bg-primary' : 'bg-border',
            )}
          />
        ))}
      </span>
      {level}
    </span>
  )
}

export function HashtagChip({
  tag,
  count,
  className,
}: {
  tag: string
  count?: string
  className?: string
}) {
  return (
    <Link
      href="/community/feed"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm font-medium transition-colors hover:border-foreground hover:bg-foreground hover:text-background',
        className,
      )}
    >
      <span className="text-primary">#</span>
      {tag}
      {count ? (
        <span className="text-xs text-muted-foreground">· {count}</span>
      ) : null}
    </Link>
  )
}

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground',
        className,
      )}
    >
      <span className="h-px w-6 bg-primary" />
      {children}
    </span>
  )
}
