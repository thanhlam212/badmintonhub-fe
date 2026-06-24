"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Eye, EyeOff, ArrowRight, Zap } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

// ─── Floating particle / orb ─────────────────────────────────────────────────
function Orb({ className }: { className: string }) {
  return <div className={cn("absolute rounded-full blur-3xl pointer-events-none", className)} />
}

// ─── Animated court lines decoration ─────────────────────────────────────────
function CourtDecoration() {
  return (
    <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none select-none">
      <div className="relative w-[340px] h-[240px] border-2 border-white">
        {/* Net line */}
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-white" />
        {/* Service boxes */}
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white" style={{ top: 0, bottom: "50%" }} />
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white" style={{ top: "50%", bottom: 0 }} />
        {/* Short service lines */}
        <div className="absolute left-0 right-0 h-0.5 bg-white" style={{ top: "25%" }} />
        <div className="absolute left-0 right-0 h-0.5 bg-white" style={{ top: "75%" }} />
        {/* Center circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-white" />
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A2416] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get("redirect")
  const redirectMsg = searchParams.get("msg")
  const { login, loginAsGuest, user } = useAuth()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  useEffect(() => { setTimeout(() => setMounted(true), 80) }, [])

  useEffect(() => {
    if (user) {
      if (user.role === "admin") router.push("/admin")
      else if (user.role === "employee" && user.warehouse === "Kho Hub") router.push("/hub")
      else if (user.role === "employee") router.push("/employee")
      else router.push(redirectUrl || "/")
    }
  }, [user, router, redirectUrl])

  if (user) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!username.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ thông tin")
      return
    }
    setLoading(true)
    const result = await login(username.trim(), password)
    if (!result.success) {
      setError(result.error || "Tài khoản hoặc mật khẩu không đúng")
      setLoading(false)
    }
  }

  const handlePasswordInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value.replace(/[^\u0020-\u007E]/g, ""))
  }

  return (
    <div className="min-h-screen flex overflow-hidden bg-[#F7F8FA]">

      {/* ── LEFT PANEL ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden bg-[#071a0f] flex-col">
        {/* Layered gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A2416] via-[#0d3020] to-[#051008]" />
        <Orb className="w-[500px] h-[500px] bg-[#1F6B3A]/25 -top-32 -left-32" />
        <Orb className="w-[400px] h-[400px] bg-[#FF6B35]/10 bottom-0 right-0" />
        <Orb className="w-[300px] h-[300px] bg-[#1F6B3A]/15 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

        {/* Court lines art */}
        <CourtDecoration />

        {/* Content */}
        <div className="relative z-10 flex flex-col flex-1 p-12 xl:p-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-[#FF6B35]/30 blur-lg scale-110" />
              <Image src="/logo.jpg" alt="BadmintonHub" width={44} height={44} className="relative rounded-xl shadow-xl" />
            </div>
            <span className="font-serif text-xl font-extrabold text-white">
              Badminton<span className="text-[#FF6B35]">Hub</span>
            </span>
          </div>

          {/* Main heading */}
          <div
            className="mt-auto transition-all duration-700"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(28px)" }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-4 py-1.5 mb-6">
              <Zap className="h-3.5 w-3.5 text-[#FF6B35]" />
              <span className="text-xs font-bold text-[#FF6B35] uppercase tracking-widest">Hệ thống sân #1 Hà Nội</span>
            </div>

            <h1 className="font-serif text-4xl xl:text-5xl font-extrabold text-white leading-tight">
              Đặt sân<br />
              <span className="text-[#FF6B35]">cầu lông</span><br />
              trong 60 giây
            </h1>

            <p className="mt-5 text-white/50 text-base leading-relaxed max-w-sm">
              Hơn 20 sân thi đấu chất lượng cao. Đặt nhanh, nhận QR, vào sân ngay — không cần xếp hàng.
            </p>

            {/* Stats */}
            <div className="mt-10 grid grid-cols-3 gap-4">
              {[
                { val: "20+", sub: "Sân thi đấu" },
                { val: "4.9★", sub: "Đánh giá" },
                { val: "3", sub: "Cơ sở" },
              ].map((s, i) => (
                <div
                  key={s.sub}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm transition-all duration-500"
                  style={{ opacity: mounted ? 1 : 0, transitionDelay: `${200 + i * 80}ms`, transform: mounted ? "translateY(0)" : "translateY(16px)" }}
                >
                  <p className="font-serif text-2xl font-extrabold text-white">{s.val}</p>
                  <p className="text-xs text-white/40 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <p className="mt-12 text-white/25 text-xs">
            © 2026 BadmintonHub · Cầu Giấy · Thanh Xuân · Long Biên
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative bg-white lg:bg-[#F7F8FA]">
        {/* Subtle bg pattern for right panel */}
        <div className="absolute inset-0 lg:hidden bg-gradient-to-br from-[#0A2416] via-[#0d3020] to-[#051008]" />
        <Orb className="w-72 h-72 bg-[#FF6B35]/10 -top-20 -right-20 lg:hidden" />

        <div
          className="relative z-10 w-full max-w-[400px]"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)", transition: "all 0.6s ease", transitionDelay: "100ms" }}
        >
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <Image src="/logo.jpg" alt="BadmintonHub" width={56} height={56} className="rounded-xl shadow-2xl mb-3" />
            <h1 className="font-serif text-2xl font-extrabold text-white">
              Badminton<span className="text-[#FF6B35]">Hub</span>
            </h1>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-2xl shadow-black/10 p-8 lg:p-10 border border-gray-100">
            <div className="mb-8">
              <h2 className="font-serif text-2xl font-extrabold text-[#0A2416]">Đăng nhập</h2>
              <p className="text-gray-500 text-sm mt-1.5">Chào mừng trở lại! 👋</p>
            </div>

            {/* Redirect notice (e.g. from booking page) */}
            {redirectMsg && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span className="text-base leading-none mt-px">🔒</span>
                <span>{redirectMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className={cn(
                    "block text-sm font-semibold transition-colors duration-200",
                    focusedField === "username" ? "text-[#FF6B35]" : "text-gray-700"
                  )}
                >
                  Tên tài khoản
                </label>
                <div className={cn(
                  "flex items-center rounded-2xl border-2 transition-all duration-200 bg-gray-50/50",
                  focusedField === "username"
                    ? "border-[#FF6B35] bg-orange-50/30 shadow-sm shadow-[#FF6B35]/10"
                    : "border-gray-200 hover:border-gray-300"
                )}>
                  <input
                    id="username"
                    type="text"
                    placeholder="Nhập tên tài khoản"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError("") }}
                    onFocus={() => setFocusedField("username")}
                    onBlur={() => setFocusedField(null)}
                    autoFocus
                    autoComplete="username"
                    className="flex-1 bg-transparent px-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none font-medium"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className={cn(
                      "block text-sm font-semibold transition-colors duration-200",
                      focusedField === "password" ? "text-[#FF6B35]" : "text-gray-700"
                    )}
                  >
                    Mật khẩu
                  </label>
                  <Link href="/forgot-password" className="text-xs text-[#FF6B35] font-medium hover:underline">
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className={cn(
                  "flex items-center rounded-2xl border-2 transition-all duration-200 bg-gray-50/50",
                  focusedField === "password"
                    ? "border-[#FF6B35] bg-orange-50/30 shadow-sm shadow-[#FF6B35]/10"
                    : "border-gray-200 hover:border-gray-300"
                )}>
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={handlePasswordInput}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    autoComplete="current-password"
                    className="flex-1 bg-transparent px-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none font-medium"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPw(v => !v)}
                    className="pr-4 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              <div
                className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: error ? "60px" : "0", opacity: error ? 1 : 0 }}
              >
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  {error}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full flex items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-bold text-white transition-all duration-200",
                  "bg-gradient-to-r from-[#FF6B35] to-[#e85a28]",
                  "shadow-lg shadow-[#FF6B35]/30 hover:shadow-xl hover:shadow-[#FF6B35]/40",
                  "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
                  "disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                )}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Đang đăng nhập...
                  </>
                ) : (
                  <>
                    Đăng nhập
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-gray-400 uppercase tracking-widest">Hoặc</span>
              </div>
            </div>

            {/* Guest */}
            <button
              type="button"
              onClick={() => { loginAsGuest(); router.push(redirectUrl || "/") }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-3.5 text-sm font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 transition-all duration-200 active:scale-[0.98]"
            >
              Tiếp tục với vai trò khách
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">Xem sân &amp; sản phẩm — cần đăng ký để đặt sân</p>

            {/* Register link */}
            <p className="mt-6 text-center text-sm text-gray-500">
              Chưa có tài khoản?{" "}
              <Link href="/register" className="font-bold text-[#0A2416] hover:text-[#FF6B35] transition-colors">
                Đăng ký ngay →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
