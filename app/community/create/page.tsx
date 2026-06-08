'use client'

import { ChangeEvent, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ImagePlus, Loader2, MapPin, X } from 'lucide-react'
import {
  communityApi,
  type CommunityDistrict,
  type CommunityLevel,
  type CommunityPostKind,
} from '@/lib/community-api'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { HashtagChip } from '@/components/community/primitives'

const kinds: CommunityPostKind[] = [
  'Chia sẻ',
  'Tìm đội',
  'Check-in',
  'Review sân',
  'Mẹo chơi',
]

const districts: CommunityDistrict[] = ['Cầu Giấy', 'Thanh Xuân', 'Long Biên']
const levels: CommunityLevel[] = ['Mới chơi', 'Trung bình', 'Khá', 'Nâng cao']

const kindStyles: Record<CommunityPostKind, string> = {
  'Chia sẻ': 'bg-secondary text-secondary-foreground',
  'Tìm đội': 'bg-primary text-primary-foreground',
  'Check-in': 'bg-accent text-accent-foreground',
  'Review sân': 'bg-foreground text-background',
  'Mẹo chơi': 'bg-secondary text-secondary-foreground',
}

function extractTags(body: string) {
  const matches = body.match(/#[\p{L}\p{N}_-]+/gu) || []
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))].slice(0, 8)
}

export default function CreatePage() {
  const router = useRouter()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [kind, setKind] = useState<CommunityPostKind>('Chia sẻ')
  const [body, setBody] = useState('')
  const [district, setDistrict] = useState<CommunityDistrict | ''>('')
  const [level, setLevel] = useState<CommunityLevel | ''>('')
  const [images, setImages] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null,
  )

  const previewName = user?.fullName?.trim() || 'Bạn'
  const previewUsername = user?.username || 'community-player'
  const previewInitial = previewName.charAt(0).toUpperCase() || 'B'
  const tags = useMemo(() => extractTags(body), [body])

  async function handleSelectImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    if (!user || user.role === 'guest') {
      router.push('/login')
      return
    }

    const remaining = Math.max(0, 3 - images.length)
    const picked = files.slice(0, remaining)
    if (!picked.length) return

    setIsUploading(true)
    setMessage(null)

    try {
      const uploaded = await Promise.all(picked.map((file) => communityApi.uploadImage(file)))
      const failed = uploaded.find((item) => !item.success || !item.url)
      if (failed) {
        setMessage({ type: 'error', text: failed.error || 'Không thể tải ảnh lên.' })
        return
      }

      setImages((current) => [...current, ...uploaded.map((item) => item.url)])
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  async function handleSubmit() {
    if (!body.trim()) return

    if (!user || user.role === 'guest') {
      router.push('/login')
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const result = await communityApi.createPost({
        kind,
        body: body.trim(),
        district: district || undefined,
        level: level || undefined,
        image_urls: images,
        tags,
      })

      if (!result.success || !result.post) {
        setMessage({ type: 'error', text: result.error || 'Đăng bài thất bại.' })
        return
      }

      setMessage({ type: 'success', text: 'Bài viết đã được đăng.' })
      router.push(`/community/post/${result.post.id}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link
        href="/community/feed"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Bảng tin
      </Link>

      <h1 className="font-heading text-3xl font-semibold tracking-tight">Tạo bài viết</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Chia sẻ khoảnh khắc, tìm đội hoặc review sân trong không gian cộng đồng riêng.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-3xl border border-border bg-card p-5">
          <label className="text-sm font-semibold">Loại bài viết</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {kinds.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setKind(item)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  kind === item
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-secondary',
                )}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="mt-5 block text-sm font-semibold">Nội dung</label>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            placeholder="Hôm nay trên sân thế nào? Bạn đang muốn tìm thêm người đánh hay chia sẻ kinh nghiệm?"
            className="mt-2 w-full resize-none rounded-2xl border border-border bg-background p-4 text-[15px] leading-relaxed outline-none focus:border-foreground"
          />

          <label className="mt-5 block text-sm font-semibold">Hình ảnh</label>
          <div className="mt-2 flex flex-wrap gap-3">
            {images.map((src, index) => (
              <div
                key={`${src}-${index}`}
                className="relative size-24 overflow-hidden rounded-2xl border border-border"
              >
                <Image src={src} alt="" fill className="object-cover" sizes="96px" />
                <button
                  type="button"
                  onClick={() => setImages((current) => current.filter((_, idx) => idx !== index))}
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
                  aria-label="Xóa ảnh"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}

            {images.length < 3 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="grid size-24 place-items-center rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
              </button>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleSelectImages}
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold">Khu vực</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {districts.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setDistrict((current) => (current === item ? '' : item))}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors',
                      district === item
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border hover:bg-secondary',
                    )}
                  >
                    <MapPin className="size-3.5" />
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold">Trình độ</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {levels.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setLevel((current) => (current === item ? '' : item))}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-colors',
                      level === item
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border hover:bg-secondary',
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {message ? (
            <div
              className={cn(
                'mt-5 rounded-2xl border px-4 py-3 text-sm',
                message.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700',
              )}
            >
              {message.text}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
            <Link
              href="/community/feed"
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              Hủy
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!body.trim() || isSubmitting || isUploading}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-colors',
                body.trim() && !isSubmitting && !isUploading
                  ? 'bg-primary text-primary-foreground hover:-translate-y-0.5'
                  : 'cursor-not-allowed bg-secondary text-muted-foreground',
              )}
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Đăng bài
            </button>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:h-fit">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Xem trước
          </p>
          <article className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full bg-foreground text-sm font-bold text-background">
                {previewInitial}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{previewName}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      kindStyles[kind],
                    )}
                  >
                    {kind}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">@{previewUsername} · Vừa xong</p>
              </div>
            </div>

            <p className="mt-3 text-pretty leading-relaxed text-foreground/90">
              {body || (
                <span className="text-muted-foreground">
                  Nội dung bài viết sẽ hiển thị ở đây...
                </span>
              )}
            </p>

            {district ? (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                <MapPin className="size-3.5 text-primary" />
                {district}
              </div>
            ) : null}

            {images.length > 0 ? (
              <div
                className={cn(
                  'mt-3 grid gap-1.5 overflow-hidden rounded-2xl',
                  images.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
                )}
              >
                {images.map((src, index) => (
                  <div key={`${src}-${index}`} className="relative aspect-[4/3] bg-muted">
                    <Image src={src} alt="" fill className="object-cover" sizes="320px" />
                  </div>
                ))}
              </div>
            ) : null}

            {level || tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {level ? <HashtagChip tag={level.replace(/\s/g, '').toLowerCase()} /> : null}
                {tags.map((tag) => (
                  <HashtagChip key={tag} tag={tag} />
                ))}
              </div>
            ) : null}
          </article>
        </div>
      </div>
    </div>
  )
}
