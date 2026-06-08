'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, MessageCircle, Bookmark, Share2, MapPin, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { communityApi, type CommunityComment, type CommunityPost, type CommunityPostDetailResponse } from '@/lib/community-api'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { CommunityAvatar, HashtagChip } from '@/components/community/primitives'
import { PostCard } from '@/components/community/cards'

export function PostDetail({ id }: { id: string }) {
  const router = useRouter()
  const { user } = useAuth()
  const [data, setData] = useState<CommunityPostDetailResponse | null>(null)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [likes, setLikes] = useState(0)
  const [saves, setSaves] = useState(0)
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [draft, setDraft] = useState('')

  useEffect(() => {
    communityApi.getPostDetail(id).then((res) => {
      if (!res) return
      setData(res)
      setLikes(res.post.likes)
      setSaves(res.post.saves)
      setComments(res.post.comments)
    })
  }, [id])

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
      </div>
    )
  }

  const { post, relatedPosts } = data

  async function handleLike() {
    if (!user || user.role === 'guest') {
      router.push('/login')
      return
    }
    const res = await communityApi.togglePostLike(post.id)
    if (!res.success) return
    setLiked(!!res.liked)
    setLikes(Number(res.likes || 0))
  }

  async function handleSave() {
    if (!user || user.role === 'guest') {
      router.push('/login')
      return
    }
    const res = await communityApi.togglePostSave(post.id)
    if (!res.success) return
    setSaved(!!res.saved)
    setSaves(Number(res.saves || 0))
  }

  async function submitComment() {
    if (!draft.trim()) return
    if (!user || user.role === 'guest') {
      router.push('/login')
      return
    }

    const res = await communityApi.addComment(post.id, draft.trim())
    if (!res.success || !res.comment) return
    setComments((current) => [res.comment as CommunityComment, ...current])
    setDraft('')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/community/feed"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Bảng tin
      </Link>

      <article className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <Link href={`/community/profile/${post.author.username}`}>
            <CommunityAvatar src={post.author.avatar} name={post.author.name} size={48} className="size-12" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link
                href={`/community/profile/${post.author.username}`}
                className="font-semibold hover:underline"
              >
                {post.author.name}
              </Link>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">
                {post.kind}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              @{post.author.username} · {post.time}
            </p>
          </div>
        </div>

        <p className="mt-4 text-lg leading-relaxed text-pretty">{post.body}</p>

        {post.court ? (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            <MapPin className="size-3.5 text-primary" />
            {post.court}
          </div>
        ) : null}

        {post.images.length > 0 ? (
          <div
            className={cn(
              'mt-4 grid gap-2 overflow-hidden rounded-2xl',
              post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
            )}
          >
            {post.images.map((src, index) => (
              <div key={index} className="relative aspect-[4/3] overflow-hidden bg-muted">
                <Image
                  src={src || '/community/hero.png'}
                  alt={`Ảnh ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 600px"
                />
              </div>
            ))}
          </div>
        ) : null}

        {post.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <HashtagChip key={tag} tag={tag} />
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-1 border-t border-border pt-4 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={handleLike}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-secondary',
              liked && 'text-primary',
            )}
          >
            <Heart className={cn('size-4', liked && 'fill-current')} />
            {likes}
          </button>
          <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5">
            <MessageCircle className="size-4" />
            {comments.length}
          </span>
          <button
            type="button"
            onClick={handleSave}
            className={cn(
              'ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-secondary',
              saved && 'text-primary',
            )}
          >
            <Bookmark className={cn('size-4', saved && 'fill-current')} />
            {saves}
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-secondary"
          >
            <Share2 className="size-4" />
          </button>
        </div>
      </article>

      <div className="mt-5 flex gap-3 rounded-3xl border border-border bg-card p-4">
        <div className="grid size-10 place-items-center rounded-full bg-secondary font-semibold text-foreground">
          {user?.fullName?.charAt(0).toUpperCase() || 'B'}
        </div>
        <div className="flex-1">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            placeholder="Viết bình luận…"
            className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submitComment}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                draft.trim()
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              Bình luận
            </button>
          </div>
        </div>
      </div>

      <section className="mt-5">
        <h2 className="mb-3 font-heading text-lg font-semibold">
          {comments.length} bình luận
        </h2>
        <div className="flex flex-col gap-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
              <CommunityAvatar src={comment.author.avatar} name={comment.author.name} size={36} className="size-9" />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">@{comment.author.username}</span>
                  <span className="text-xs text-muted-foreground">{comment.time}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed">{comment.body}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="size-3.5" />
                    {comment.likes}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-heading text-lg font-semibold">
          Bài viết liên quan
        </h2>
        <div className="flex flex-col gap-4">
          {relatedPosts.map((item) => (
            <PostCard key={item.id} post={item as CommunityPost} />
          ))}
        </div>
      </section>
    </div>
  )
}
