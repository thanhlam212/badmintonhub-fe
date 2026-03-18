"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Star, MapPin, ChevronRight, Users, Calendar, Award, Building, ArrowRight, Zap } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { formatVND } from "@/lib/utils"
import { courtApi, productApi, type ApiCourt, type ApiProduct } from "@/lib/api"
import { useState, useEffect, useCallback, useRef } from "react"

// ─── Scroll reveal hook ───────────────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

// ─── Animated counter ────────────────────────────────────────────────────────
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const { ref, visible } = useReveal(0.5)
  useEffect(() => {
    if (!visible) return
    let start = 0
    const step = target / 40
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(timer) }
      else setVal(Math.floor(start))
    }, 30)
    return () => clearInterval(timer)
  }, [visible, target])
  return <span ref={ref}>{val}{suffix}</span>
}

// ─── Hero Section ─────────────────────────────────────────────────────────────
const heroImages = ["/ANH1.webp", "/ANH2.webp", "/ANH3.webp", "/ANH4.webp", "/ANH5.webp"]

function HeroSection() {
  const [current, setCurrent] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const next = useCallback(() => setCurrent(i => (i + 1) % heroImages.length), [])
  const prev = useCallback(() => setCurrent(i => (i - 1 + heroImages.length) % heroImages.length), [])

  useEffect(() => {
    const timer = setInterval(next, 4500)
    return () => clearInterval(timer)
  }, [next])

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <section className="relative w-full h-[580px] lg:h-[680px] bg-[#0A2416] overflow-hidden">
      {/* Slideshow Background */}
      {heroImages.map((src, idx) => (
        <div
          key={src}
          className="absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out"
          style={{ opacity: idx === current ? 1 : 0 }}
        >
          <Image
            src={src}
            alt={`Sân cầu lông ${idx + 1}`}
            fill
            sizes="100vw"
            className="object-cover w-full h-full scale-105 transition-transform duration-[8000ms]"
            style={{ transform: idx === current ? "scale(1)" : "scale(1.05)" }}
            priority={idx === 0}
          />
        </div>
      ))}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

      {/* Slide indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {heroImages.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              idx === current ? "w-10 bg-primary" : "w-1.5 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex items-center h-full px-6 lg:px-16">
        <div className="max-w-2xl">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full bg-primary/20 border border-primary/40 px-4 py-1.5 mb-5 backdrop-blur-sm transition-all duration-700"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? "translateY(0)" : "translateY(16px)",
              transitionDelay: "100ms"
            }}
          >
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">Đặt sân ngay hôm nay</span>
          </div>

          {/* Heading */}
          <h1
            className="font-serif text-4xl font-extrabold text-white lg:text-6xl leading-tight transition-all duration-700"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? "translateY(0)" : "translateY(24px)",
              transitionDelay: "250ms"
            }}
          >
            Sân Cầu Lông<br />
            <span className="text-primary">Đẳng Cấp</span> Hà Nội
          </h1>

          {/* Sub */}
          <p
            className="mt-4 text-base text-white/75 max-w-md leading-relaxed transition-all duration-700"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? "translateY(0)" : "translateY(24px)",
              transitionDelay: "400ms"
            }}
          >
            Hệ thống 3 cơ sở tại Cầu Giấy, Thanh Xuân & Long Biên. Đặt sân online, thanh toán nhanh, nhận QR check-in.
          </p>

          {/* CTAs */}
          <div
            className="mt-8 flex flex-wrap gap-3 transition-all duration-700"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? "translateY(0)" : "translateY(24px)",
              transitionDelay: "550ms"
            }}
          >
            <Link href="/courts">
              <Button size="lg" className="gap-2 font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.03] transition-all duration-200">
                Đặt sân ngay <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/shop">
              <Button size="lg" variant="outline" className="gap-2 border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:border-white/50 transition-all duration-200">
                Cửa hàng
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Stats Row ────────────────────────────────────────────────────────────────
function StatsRow() {
  const { ref, visible } = useReveal(0.3)
  const stats = [
    { icon: <Building className="h-5 w-5" />, value: 20, suffix: "+", label: "Sân thi đấu" },
    { icon: <Users className="h-5 w-5" />, value: 500, suffix: "+", label: "Khách mỗi ngày" },
    { icon: <Star className="h-5 w-5" />, value: 49, suffix: "", label: "Đánh giá TB", display: "4.9" },
    { icon: <MapPin className="h-5 w-5" />, value: 3, suffix: "", label: "Cơ sở" },
  ]

  return (
    <section className="border-b bg-card" ref={ref}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 justify-center transition-all duration-500"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(20px)",
                transitionDelay: `${i * 100}ms`
              }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                {s.icon}
              </div>
              <div>
                <p className="font-serif text-xl font-extrabold text-foreground">
                  {s.display || <AnimatedNumber target={s.value} suffix={s.suffix} />}
                </p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Featured Courts ──────────────────────────────────────────────────────────
function FeaturedCourts() {
  const [courts, setCourts] = useState<ApiCourt[]>([])
  const { ref, visible } = useReveal(0.1)

  useEffect(() => { courtApi.getAll().then(data => setCourts(data.slice(0, 3))) }, [])

  return (
    <section className="relative py-20 overflow-hidden" ref={ref}>
      <div className="absolute inset-0 z-0">
        <Image src="/ANHBIA1.webp" alt="bg" fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-background/88 backdrop-blur-sm" />
      </div>
      <div className="relative z-10 mx-auto max-w-7xl px-4">
        {/* Header */}
        <div
          className="flex items-end justify-between mb-10 transition-all duration-600"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)" }}
        >
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Được yêu thích nhất</p>
            <h2 className="font-serif text-2xl font-extrabold text-foreground lg:text-3xl">Sân nổi bật</h2>
          </div>
          <Link href="/courts">
            <Button variant="ghost" className="text-primary font-semibold gap-1 hover:gap-2 transition-all">
              Xem tất cả <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courts.length === 0
            ? [0, 1, 2].map(i => (
                <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
              ))
            : courts.map((court, i) => (
              <Link key={court.id} href={`/courts/${court.id}`}>
                <div
                  className="transition-all duration-500"
                  style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateY(0)" : "translateY(30px)",
                    transitionDelay: `${i * 120}ms`
                  }}
                >
                  <Card className="group overflow-hidden border hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 cursor-pointer">
                    <div className="relative aspect-video bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center overflow-hidden">
                      <div className="text-center text-secondary/30 font-serif font-bold text-3xl group-hover:scale-110 transition-transform duration-500">
                        {court.name.split(' - ')[0]}
                      </div>
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/35 transition-colors duration-300 flex items-center justify-center">
                        <span className="text-white font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2">
                          Xem lịch <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center rounded-md bg-card/90 px-2 py-1 text-xs font-medium capitalize backdrop-blur-sm">
                          {court.type}
                        </span>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-serif font-bold text-foreground">{court.name}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" /> {court.branch}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span className="font-semibold">{court.rating}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-serif font-bold text-primary">
                          {formatVND(court.price)}<span className="text-xs text-muted-foreground font-normal">/h</span>
                        </span>
                        {court.available && (
                          <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                            Còn trống
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const { ref, visible } = useReveal(0.2)
  const steps = [
    { num: "01", title: "Chọn sân & giờ", desc: "Tìm sân phù hợp theo cơ sở, loại sân và khung giờ mong muốn.", icon: <Calendar className="h-6 w-6" /> },
    { num: "02", title: "Đặt & thanh toán", desc: "Xác nhận booking và thanh toán nhanh qua tiền mặt, MoMo hoặc chuyển khoản.", icon: <Zap className="h-6 w-6" /> },
    { num: "03", title: "Check-in & tận hưởng", desc: "Quét QR code tại sân, vào chơi ngay — không cần xếp hàng.", icon: <Award className="h-6 w-6" /> },
  ]

  return (
    <section className="py-20 bg-card" ref={ref}>
      <div className="mx-auto max-w-7xl px-4">
        <div
          className="text-center mb-12 transition-all duration-600"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)" }}
        >
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Đơn giản & nhanh chóng</p>
          <h2 className="font-serif text-2xl font-extrabold text-foreground lg:text-3xl">Chỉ 3 bước để chơi</h2>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden sm:block absolute top-10 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          {steps.map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center transition-all duration-500"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(30px)",
                transitionDelay: `${i * 150}ms`
              }}
            >
              <div className="relative mb-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 group-hover:scale-110 transition-transform duration-200">
                  {s.icon}
                </div>
                <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2 border-primary text-primary text-xs font-extrabold font-serif">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-serif font-bold text-foreground text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <div
          className="mt-12 text-center transition-all duration-500"
          style={{ opacity: visible ? 1 : 0, transitionDelay: "500ms" }}
        >
          <Link href="/courts">
            <Button size="lg" className="gap-2 font-semibold hover:scale-[1.03] transition-transform duration-200">
              Bắt đầu đặt sân <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Shop Preview ─────────────────────────────────────────────────────────────
function ShopPreview() {
  const [products, setProducts] = useState<ApiProduct[]>([])
  const { ref, visible } = useReveal(0.1)

  useEffect(() => { productApi.getAll({ limit: 4 }).then(res => setProducts(res.products)) }, [])

  return (
    <section className="relative py-20 overflow-hidden" ref={ref}>
      <div className="absolute inset-0 z-0">
        <Image src="/ANHBIA2.jpg" alt="bg" fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-background/88 backdrop-blur-sm" />
      </div>
      <div className="relative z-10 mx-auto max-w-7xl px-4">
        <div
          className="flex items-end justify-between mb-10 transition-all duration-500"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)" }}
        >
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Thương hiệu uy tín</p>
            <h2 className="font-serif text-2xl font-extrabold text-foreground lg:text-3xl">Phụ kiện thể thao</h2>
          </div>
          <Link href="/shop">
            <Button variant="ghost" className="text-primary font-semibold gap-1 hover:gap-2 transition-all">
              Vào cửa hàng <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="flex gap-5 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
          {(products.length === 0 ? Array(4).fill(null) : products).map((p, i) => (
            <div
              key={p?.id ?? i}
              className="snap-start shrink-0 transition-all duration-500"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(30px)",
                transitionDelay: `${i * 100}ms`
              }}
            >
              {p === null ? (
                <div className="w-52 h-72 rounded-xl bg-muted animate-pulse" />
              ) : (
                <Link href="/shop">
                  <Card className="group w-52 overflow-hidden hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 cursor-pointer">
                    <div className="aspect-square bg-gradient-to-br from-muted to-background flex items-center justify-center relative overflow-hidden">
                      <span className="text-5xl text-muted-foreground/15 font-serif font-bold group-hover:scale-125 transition-transform duration-500">
                        {p.brand[0]}
                      </span>
                      {p.badges[0] && (
                        <span className={`absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          p.badges[0] === 'Bán chạy' ? 'bg-primary text-primary-foreground' :
                          p.badges[0] === 'Mới' ? 'bg-secondary text-secondary-foreground' :
                          'bg-red-500 text-white'
                        }`}>{p.badges[0]}</span>
                      )}
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-300" />
                    </div>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground font-medium">{p.brand}</p>
                      <h3 className="text-sm font-semibold text-foreground line-clamp-2 mt-0.5 leading-snug">{p.name}</h3>
                      <div className="flex items-center gap-1 mt-1.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="text-xs text-muted-foreground">{p.rating}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="font-serif font-bold text-primary text-sm">{formatVND(p.price)}</span>
                        {p.originalPrice && (
                          <span className="text-xs text-muted-foreground line-through">{formatVND(p.originalPrice)}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <StatsRow />
        <FeaturedCourts />
        <HowItWorks />
        <ShopPreview />
      </main>
      <Footer />
    </div>
  )
}