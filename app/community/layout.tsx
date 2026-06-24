import type { Metadata } from 'next'
import Link from 'next/link'
import { CommunityHeader, CommunityMobileNav } from '@/components/community/navigation'
import { CommunityMark } from '@/components/community/primitives'

export const metadata: Metadata = {
  title: 'Sân Chơi — Cộng đồng cầu lông BadmintonHub',
  description:
    'Không gian cộng đồng để tìm đội, check-in sau trận, review sân và chia sẻ trải nghiệm cầu lông tại Hà Nội.',
}

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="community-zone min-h-screen font-sans">
      <div className="community-zone-enter flex min-h-screen flex-col">
        <CommunityHeader />
        <div className="flex-1 pb-20 lg:pb-0">{children}</div>
        <CommunityFooter />
        <CommunityMobileNav />
      </div>
    </div>
  )
}

function CommunityFooter() {
  return (
    <footer className="cm-dark mt-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-12 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-sm space-y-4">
          <CommunityMark />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Một không gian riêng của BadmintonHub để tìm đội, check-in và chia
            sẻ kèo đánh tại Cầu Giấy, Thanh Xuân và Long Biên.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
          <FooterCol
            title="Cộng đồng"
            links={[
              ['Bảng tin', '/community/feed'],
              ['Tìm đội', '/community/matches'],
              ['Đăng bài', '/community/create'],
            ]}
          />
          <FooterCol
            title="Khám phá"
            links={[
              ['Người chơi nổi bật', '/community'],
              ['Hashtag hot', '/community/feed'],
              ['Thông báo', '/community/notifications'],
            ]}
          />
          <FooterCol
            title="BadmintonHub"
            links={[
              ['Đặt sân', '/courts'],
              ['Cửa hàng', '/'],
              ['Hotline 1900 1234', '/'],
            ]}
          />
        </div>
      </div>
      <div className="border-t border-border/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span>© 2026 BadmintonHub Community · Văn hoá cầu lông Hà Nội</span>
          <Link href="/courts" className="hover:text-foreground">
            Quay lại hệ thống đặt sân →
          </Link>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({
  title,
  links,
}: {
  title: string
  links: [string, string][]
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="transition-colors hover:text-foreground">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
