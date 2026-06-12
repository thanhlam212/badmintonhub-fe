import Link from "next/link"
import Image from "next/image"
import { MapPin, Phone, Mail, Clock, ChevronRight } from "lucide-react"

const footerLinks = [
  { href: "/", label: "Trang chủ" },
  { href: "/courts", label: "Đặt sân" },
  { href: "/shop", label: "Cửa hàng" },
  { href: "/my-bookings", label: "Lịch đặt của tôi" },
]

const branches = [
  "45 Trần Phú, Long Biên, Hà Nội",
  "120 Nguyễn Trãi, Thanh Xuân, Hà Nội",
  "68 Trần Duy Hưng, Cầu Giấy, Hà Nội",
]

export function Footer() {
  return (
    <footer className="bg-[#0A2416] text-white/80">
      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-10">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-5">
              <Image
                src="/logo.jpg"
                alt="BadmintonHub"
                width={64}
                height={64}
                className="rounded-xl"
              />
              <div className="flex flex-col">
                <span className="font-serif text-xl font-extrabold tracking-tight leading-tight text-white">
                  Badminton<span className="text-primary">Hub</span>
                </span>
                <span className="text-[10px] font-medium tracking-widest uppercase text-white/50">
                  Hệ thống sân cầu lông
                </span>
              </div>
            </Link>
            <p className="text-sm leading-relaxed text-white/60 mb-6">
              Hệ thống đặt sân cầu lông và cung cấp phụ kiện thể thao chính hãng hàng đầu Việt Nam.
            </p>
            <div className="flex gap-3">
              {[
                { name: "Facebook", letter: "F", color: "hover:bg-blue-600" },
                { name: "Zalo", letter: "Z", color: "hover:bg-blue-500" },
                { name: "Instagram", letter: "I", color: "hover:bg-pink-600" },
                { name: "YouTube", letter: "Y", color: "hover:bg-red-600" },
              ].map(s => (
                <span
                  key={s.name}
                  title={s.name}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white/70 ${s.color} hover:text-white transition-all duration-200 cursor-pointer`}
                >
                  {s.letter}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-serif font-bold text-white text-base mb-5">Liên kết nhanh</h4>
            <ul className="flex flex-col gap-2.5">
              {footerLinks.map(l => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="flex items-center gap-2 text-sm text-white/60 hover:text-primary transition-colors group"
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-white/30 group-hover:text-primary transition-colors" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-serif font-bold text-white text-base mb-5">Liên hệ</h4>
            <ul className="flex flex-col gap-4">
              <li className="flex items-center gap-3 text-sm text-white/60">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 shrink-0">
                  <Phone className="h-4 w-4 text-primary" />
                </span>
                <div>
                  <p className="text-white/40 text-xs">Hotline</p>
                  <p className="text-white font-semibold">1900 1234</p>
                </div>
              </li>
              <li className="flex items-center gap-3 text-sm text-white/60">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 shrink-0">
                  <Mail className="h-4 w-4 text-primary" />
                </span>
                <div>
                  <p className="text-white/40 text-xs">Email</p>
                  <p className="text-white font-semibold">info@badmintonhub.vn</p>
                </div>
              </li>
              <li className="flex items-center gap-3 text-sm text-white/60">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 shrink-0">
                  <Clock className="h-4 w-4 text-primary" />
                </span>
                <div>
                  <p className="text-white/40 text-xs">Giờ mở cửa</p>
                  <p className="text-white font-semibold">06:00 – 22:00 hàng ngày</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Branches */}
          <div>
            <h4 className="font-serif font-bold text-white text-base mb-5">Cơ sở</h4>
            <ul className="flex flex-col gap-3">
              {branches.map((addr, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/60">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1F6B3A]/20 shrink-0 mt-0.5">
                    <MapPin className="h-4 w-4 text-[#4ADE80]" />
                  </span>
                  <span className="leading-relaxed">{addr}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-white/40">
            © 2026 <span className="font-semibold text-white/60">BadmintonHub</span>. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link href="#" className="hover:text-white/70 transition-colors">Chính sách</Link>
            <Link href="#" className="hover:text-white/70 transition-colors">Điều khoản</Link>
            <Link href="#" className="hover:text-white/70 transition-colors">Hỗ trợ</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
