'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { communityApi } from '@/lib/community-api'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

export function FollowButton({
  username,
  initialFollowing = false,
  onChange,
  className,
}: {
  username: string
  initialFollowing?: boolean
  onChange?: (next: { following: boolean; followers: number }) => void
  className?: string
}) {
  const router = useRouter()
  const { user } = useAuth()
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, setPending] = useState(false)

  async function handleToggle() {
    if (!user || user.role === 'guest') {
      router.push('/login')
      return
    }

    setPending(true)
    const res = await communityApi.toggleFollow(username)
    setPending(false)
    if (!res.success) return

    const next = {
      following: !!res.following,
      followers: Number(res.followers || 0),
    }
    setFollowing(next.following)
    onChange?.(next)
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className={cn(
        'rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70',
        following
          ? 'border border-border text-muted-foreground hover:border-destructive hover:text-destructive'
          : 'bg-primary text-primary-foreground hover:-translate-y-0.5',
        className,
      )}
    >
      {pending ? 'Đang xử lý...' : following ? 'Đang theo dõi' : '+ Theo dõi'}
    </button>
  )
}
