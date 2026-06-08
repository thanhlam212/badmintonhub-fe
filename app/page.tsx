"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Star, MapPin, ChevronRight, Users, Calendar, Award,
  Building, ArrowRight, Zap, Clock, QrCode, ShieldCheck,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { formatVND } from "@/lib/utils"
import { courtApi, productApi, type ApiCourt, type ApiProduct } from "@/lib/api"
import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"

// ─── Scroll reveal hook ───────────────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref  = useRef<HTMLDivElement>(null)
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

// ─── Orb decoration ──────────────────────────────────────────────────────────
function Orb({ className }: { className: string }) {
  return <div className={cn("absolute rounded-full blur-3xl pointer-events-none", className)} />
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
const heroImages = ["/ANH1.webp", "/ANH2.webp", "/ANH3.webp", "/ANH4.webp", "/ANH5.webp"]

function HeroSection() {
  const [current, setCurrent] = useState(0)
  const [loaded,  setLoaded]  = useState(false)

  const next = useCallback(() => setCurrent(i => (i + 1) % heroImages.length), [])
  useEffect(() => { const t = setInterval(next, 4500); return () => clearInterval(t) }, [next])
  useEffect(() => { const t = setTimeout(() => setLoaded(true), 100); return () => clearTimeout(t) }, [])

  return (
    <section className="relative w-full h-[500px] md:h-[600px] lg:h-[700px] bg-[#0A2416] overflow-hidden">
      {/* Slideshow */}
      {heroImages.map((src, idx) => (
        <div
          key={src}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: idx === current ? 1 : 0 }}
        >
          <Image
            src={src} alt={`Sân ${idx + 1}`} fill sizes="100vw"
            className="object-cover"
            style={{ transform: idx === current ? "scale(1)" : "scale(1.05)", transition: "transform 8000ms" }}
            priority={idx === 0}
          />
        </div>
      ))}

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />

      {/* Indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {heroImages.map((_, idx) => (
          <button key={idx} onClick={() => setCurrent(idx)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-500",
              idx === current ? "w-10 bg-[#FF6B35]" : "w-1.5 bg-white/40 hover:bg-white/70"
            )}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center h-full px-6 lg:px-16">
        <div className="max-w-2xl">
          <div
            className="inline-flex items-center gap-2 rounded-full bg-[#FF6B35]/20 border border-[#FF6B35]/40 px-4 py-1.5 mb-5 backdrop-blur-sm transition-all duration-700"
            style={{ opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(16px)", transitionDelay: "100ms" }}
          >
            <Zap className="h-3.5 w-3.5 text-[#FF6B35]" />
            <span className="text-xs font-bold text-[#FF6B35] uppercase tracking-widest">Đặt sân ngay hôm nay</span>
          </div>

          <h1
            className="font-serif text-3xl sm:text-4xl lg:text-6xl font-extrabold text-white leading-tight transition-all duration-700"
            style={{ opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(24px)", transitionDelay: "250ms" }}
          >
            Sân Cầu Lông<br />
            <span className="text-[#FF6B35]">Đẳng Cấp</span> Hà Nội
          </h1>

          <p
            className="mt-4 text-base text-white/70 max-w-md leading-relaxed transition-all duration-700"
            style={{ opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(24px)", transitionDelay: "400ms" }}
          >
            Hệ thống 3 cơ sở tại Cầu Giấy, Thanh Xuân &amp; Long Biên. Đặt sân online, thanh toán nhanh, nhận QR check-in.
          </p>

          <div
            className="mt-8 flex flex-wrap gap-3 transition-all duration-700"
            style={{ opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(24px)", transitionDelay: "550ms" }}
          >
            <Link href="/courts">
              <button className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#e85a28] px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-[#FF6B35]/40 hover:shadow-[#FF6B35]/60 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
                Đặt sân ngay <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/shop">
              <button className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/30 bg-white/10 px-7 py-3.5 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20 hover:border-white/50 transition-all duration-200">
                Cửa hàng
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Stats Row (dark green) ───────────────────────────────────────────────────
function StatsRow() {
  const { ref, visible } = useReveal(0.3)
  const stats = [
    { icon: Building, value: 20,  suffix: "+", label: "Sân thi đấu" },
    { icon: Users,    value: 500, suffix: "+", label: "Khách mỗi ngày" },
    { icon: Star,     value: 49,  suffix: "",  label: "Đánh giá TB", display: "4.9★" },
    { icon: MapPin,   value: 3,   suffix: "",  label: "Cơ sở" },
  ]

  return (
    <section className="relative overflow-hidden bg-[#0A2416]" ref={ref}>
      <Orb className="w-[500px] h-[500px] bg-[#1F6B3A]/25 -top-40 -left-40" />
      <Orb className="w-[400px] h-[400px] bg-[#FF6B35]/10 -bottom-20 -right-20" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 lg:py-10">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {stats.map((s, i) => {
            const Icon = s.icon
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-6 text-center transition-all duration-500 hover:bg-white/10"
                style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transitionDelay: `${i * 80}ms` }}
              >
                <div className="h-10 w-10 rounded-xl bg-[#FF6B35]/20 border border-[#FF6B35]/30 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-[#FF6B35]" />
                </div>
                <p className="font-serif text-xl lg:text-2xl font-extrabold text-white">
                  {s.display ? s.display : <AnimatedNumber target={s.value} suffix={s.suffix} />}
                </p>
                <p className="text-xs text-white/50 font-medium">{s.label}</p>
              </div>
            )
          })}
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
        <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px]" />
      </div>
      <div className="relative z-10 mx-auto max-w-7xl px-4">
        <div
          className="flex items-end justify-between mb-10 transition-all duration-600"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)" }}
        >
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#FF6B35]/10 border border-[#FF6B35]/20 px-3 py-1 mb-2">
              <Star className="h-3 w-3 text-[#FF6B35] fill-[#FF6B35]" />
              <span className="text-xs font-bold text-[#FF6B35] uppercase tracking-widest">Được yêu thích nhất</span>
            </div>
            <h2 className="font-serif text-2xl lg:text-3xl font-extrabold text-[#0A2416]">Sân nổi bật</h2>
          </div>
          <Link href="/courts">
            <button className="inline-flex items-center gap-1.5 text-sm font-bold text-[#FF6B35] hover:gap-2.5 transition-all duration-200">
              Xem tất cả <ChevronRight className="h-4 w-4" />
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courts.length === 0
            ? [0,1,2].map(i => (
                <div key={i} className="h-64 rounded-2xl bg-gray-200 animate-pulse" />
              ))
            : courts.map((court, i) => (
              <Link key={court.id} href={`/courts/${court.id}`}>
                <div
                  className="transition-all duration-500"
                  style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(30px)", transitionDelay: `${i * 120}ms` }}
                >
                  <div className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:-translate-y-2 hover:shadow-xl transition-all duration-300 cursor-pointer">
                    {/* Court art */}
                    <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[#0A2416] via-[#0F3D2A] to-[#1A5C35]">
                      <div className="absolute inset-0 flex items-center justify-center opacity-20">
                        <div className="w-4/5 h-4/5 border-2 border-white/60 relative">
                          <div className="absolute inset-x-0 top-1/2 h-px bg-white/60" />
                          <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
                          <div className="absolute top-1/4 left-0 right-0 h-px bg-white/30" />
                          <div className="absolute bottom-1/4 left-0 right-0 h-px bg-white/30" />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-white/40" />
                        </div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-white/80 font-serif font-bold text-xl text-center px-4 drop-shadow-lg group-hover:scale-110 transition-transform duration-500">
                          {court.name.split(' - ')[0]}
                        </p>
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                        <span className="inline-flex items-center gap-1.5 text-white text-sm font-bold opacity-0 group-hover:opacity-100 transition-all duration-300 bg-[#FF6B35]/90 px-4 py-2 rounded-full">
                          Xem lịch &amp; đặt <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center rounded-lg bg-white/90 px-2.5 py-1 text-xs font-semibold text-gray-700 backdrop-blur-sm capitalize shadow-sm">
                          {court.type}
                        </span>
                      </div>
                      {court.available && (
                        <div className="absolute top-3 right-3">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F6B3A]/90 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            Còn trống
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-serif font-bold text-[#0A2416] truncate">{court.name}</h3>
                          <p className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />{court.branch}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-bold text-gray-700">{court.rating}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-serif font-extrabold text-[#FF6B35]">
                          {formatVND(court.price)}<span className="text-xs text-gray-400 font-normal">/h</span>
                        </span>
                        <span className="inline-flex items-center rounded-lg bg-[#FF6B35]/5 border border-[#FF6B35]/20 px-3 py-1 text-xs font-bold text-[#FF6B35] group-hover:bg-[#FF6B35] group-hover:text-white transition-colors duration-200">
                          Đặt ngay
                        </span>
                      </div>
                    </div>
                  </div>
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
    {
      num: "01", icon: Calendar,
      title: "Chọn sân & giờ",
      desc: "Duyệt danh sách sân theo cơ sở, loại sân và khung giờ bạn muốn. Xem lịch trống theo ngày.",
      color: "from-[#FF6B35] to-[#e85a28]",
    },
    {
      num: "02", icon: Zap,
      title: "Đặt & thanh toán",
      desc: "Xác nhận booking và thanh toán nhanh qua MoMo, VNPay, chuyển khoản hoặc ví nội bộ.",
      color: "from-[#1F6B3A] to-[#0A2416]",
    },
    {
      num: "03", icon: QrCode,
      title: "Nhận QR & check-in",
      desc: "Quét mã QR tại sân, vào chơi ngay — không cần xếp hàng, không cần giấy tờ.",
      color: "from-[#FF6B35] to-[#e85a28]",
    },
  ]

  return (
    <section className="py-20 bg-[#F7F8FA]" ref={ref}>
      <div className="mx-auto max-w-7xl px-4">
        <div
          className="text-center mb-14 transition-all duration-600"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)" }}
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-[#0A2416]/5 border border-[#0A2416]/10 px-4 py-1.5 mb-3">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0A2416]" />
            <span className="text-xs font-bold text-[#0A2416] uppercase tracking-widest">Đơn giản &amp; nhanh chóng</span>
          </div>
          <h2 className="font-serif text-2xl lg:text-3xl font-extrabold text-[#0A2416]">
            Chỉ 3 bước để ra sân
          </h2>
          <p className="mt-3 text-gray-500 text-sm max-w-lg mx-auto">
            Từ khi chọn sân đến khi bước vào thi đấu, toàn bộ quy trình mất chưa đến 3 phút.
          </p>
        </div>

        <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* Connecting arrows (desktop) */}
          <div className="hidden sm:flex absolute top-10 left-[calc(33.33%+0px)] right-[calc(33.33%+0px)] items-center justify-around pointer-events-none z-10">
            {[0, 1].map(i => (
              <ChevronRight key={i} className="h-7 w-7 text-[#FF6B35]/40" />
            ))}
          </div>

          {steps.map((s, i) => {
            const Icon = s.icon
            return (
              <div
                key={i}
                className="group relative transition-all duration-500"
                style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(30px)", transitionDelay: `${i * 150}ms` }}
              >
                <div className="h-full bg-white rounded-3xl border border-gray-100 shadow-sm p-7 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  {/* Step number badge */}
                  <div className="flex items-center justify-between mb-5">
                    <div className={cn("h-12 w-12 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg", s.color)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="font-serif text-5xl font-extrabold text-gray-100 group-hover:text-gray-150 transition-colors select-none">
                      {s.num}
                    </span>
                  </div>
                  <h3 className="font-serif font-bold text-[#0A2416] text-lg mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div
          className="mt-12 text-center transition-all duration-500"
          style={{ opacity: visible ? 1 : 0, transitionDelay: "500ms" }}
        >
          <Link href="/courts">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#e85a28] px-8 py-4 text-sm font-bold text-white shadow-lg shadow-[#FF6B35]/30 hover:shadow-xl hover:shadow-[#FF6B35]/40 hover:-translate-y-0.5 transition-all duration-200">
              Bắt đầu đặt sân <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────
function CTABanner() {
  const { ref, visible } = useReveal(0.3)
  return (
    <section className="relative overflow-hidden bg-[#0A2416] py-16" ref={ref}>
      <Orb className="w-[500px] h-[500px] bg-[#FF6B35]/15 -top-32 left-1/4" />
      <Orb className="w-[400px] h-[400px] bg-[#1F6B3A]/30 -bottom-32 right-1/4" />
      {/* Court line art */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none">
        <div className="w-[600px] h-[400px] border-2 border-white relative">
          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-white" />
          <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white" style={{ top: 0, bottom: "50%" }} />
          <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white" style={{ top: "50%", bottom: 0 }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2 border-white" />
        </div>
      </div>

      <div
        className="relative z-10 mx-auto max-w-4xl px-6 text-center transition-all duration-700"
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)" }}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-4 py-1.5 mb-5">
          <Clock className="h-3.5 w-3.5 text-[#FF6B35]" />
          <span className="text-xs font-bold text-[#FF6B35] uppercase tracking-widest">Đặt sân trong 60 giây</span>
        </div>

        <h2 className="font-serif text-3xl lg:text-4xl font-extrabold text-white leading-tight">
          Sân trống đang chờ bạn.<br />
          <span className="text-[#FF6B35]">Đặt ngay</span> hôm nay.
        </h2>

        <p className="mt-4 text-white/50 text-sm max-w-lg mx-auto leading-relaxed">
          Hơn 20 sân tiêu chuẩn thi đấu luôn sẵn sàng. Đặt nhanh, nhận QR, vào sân — không cần xếp hàng, không cần đặt cọc phức tạp.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/courts">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#e85a28] px-8 py-4 text-sm font-bold text-white shadow-xl shadow-[#FF6B35]/30 hover:shadow-[#FF6B35]/50 hover:-translate-y-0.5 transition-all duration-200">
              Xem danh sách sân <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <Link href="/register">
            <button className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/20 bg-white/5 px-8 py-4 text-sm font-bold text-white hover:bg-white/10 hover:border-white/30 transition-all duration-200">
              Đăng ký miễn phí
            </button>
          </Link>
        </div>

        {/* Trust signals */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-white/40 text-xs font-medium">
          {["Miễn phí đăng ký", "Thanh toán an toàn", "Hủy linh hoạt", "Hỗ trợ 24/7"].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[#FF6B35]" />
              {t}
            </span>
          ))}
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
    <section className="relative py-20 overflow-hidden bg-white" ref={ref}>
      <div className="mx-auto max-w-7xl px-4">
        <div
          className="flex items-end justify-between mb-10 transition-all duration-500"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)" }}
        >
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#1F6B3A]/10 border border-[#1F6B3A]/20 px-3 py-1 mb-2">
              <Award className="h-3 w-3 text-[#1F6B3A]" />
              <span className="text-xs font-bold text-[#1F6B3A] uppercase tracking-widest">Thương hiệu uy tín</span>
            </div>
            <h2 className="font-serif text-2xl lg:text-3xl font-extrabold text-[#0A2416]">Phụ kiện thể thao</h2>
          </div>
          <Link href="/shop">
            <button className="inline-flex items-center gap-1.5 text-sm font-bold text-[#FF6B35] hover:gap-2.5 transition-all duration-200">
              Vào cửa hàng <ChevronRight className="h-4 w-4" />
            </button>
          </Link>
        </div>

        <div className="flex gap-5 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
          {(products.length === 0 ? Array(4).fill(null) : products).map((p, i) => (
            <div
              key={p?.id ?? i}
              className="snap-start shrink-0 transition-all duration-500"
              style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(30px)", transitionDelay: `${i * 100}ms` }}
            >
              {p === null ? (
                <div className="w-52 h-72 rounded-2xl bg-gray-100 animate-pulse" />
              ) : (
                <Link href="/shop">
                  <div className="group w-52 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:-translate-y-2 hover:shadow-xl transition-all duration-300 cursor-pointer">
                    <div className="aspect-square bg-gradient-to-br from-[#F7F8FA] to-gray-100 flex items-center justify-center relative overflow-hidden">
                      <span className="text-5xl text-gray-200 font-serif font-bold group-hover:scale-125 transition-transform duration-500 select-none">
                        {p.brand[0]}
                      </span>
                      {p.badges[0] && (
                        <span className={cn(
                          "absolute top-2.5 left-2.5 text-xs font-bold px-2.5 py-1 rounded-full",
                          p.badges[0] === 'Bán chạy' ? 'bg-[#FF6B35] text-white' :
                          p.badges[0] === 'Mới'       ? 'bg-[#1F6B3A] text-white' :
                                                        'bg-red-500 text-white'
                        )}>
                          {p.badges[0]}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-gray-400 font-semibold">{p.brand}</p>
                      <h3 className="text-sm font-bold text-[#0A2416] line-clamp-2 mt-0.5 leading-snug">{p.name}</h3>
                      <div className="flex items-center gap-1 mt-1.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="text-xs text-gray-400">{p.rating}</span>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="font-serif font-extrabold text-[#FF6B35] text-sm">{formatVND(p.price)}</span>
                        {p.originalPrice && (
                          <span className="text-xs text-gray-300 line-through">{formatVND(p.originalPrice)}</span>
                        )}
                      </div>
                    </div>
                  </div>
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
        <CTABanner />
        <ShopPreview />
      </main>
      <Footer />
    </div>
  )
}
