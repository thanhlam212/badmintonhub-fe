"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Eye, EyeOff, ArrowRight, Check, Zap, ShieldCheck, CalendarDays, PackageCheck } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { AddressInput } from "@/components/address-input"

// ─── Floating orb ─────────────────────────────────────────────────────────────
function Orb({ className }: { className: string }) {
  return <div className={cn("absolute rounded-full blur-3xl pointer-events-none", className)} />
}

// ─── Court decoration ─────────────────────────────────────────────────────────
function CourtDecoration() {
  return (
    <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none select-none">
      <div className="relative w-[300px] h-[210px] border-2 border-white">
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-white" />
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white" style={{ top: 0, bottom: "50%" }} />
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white" style={{ top: "50%", bottom: 0 }} />
        <div className="absolute left-0 right-0 h-0.5 bg-white" style={{ top: "25%" }} />
        <div className="absolute left-0 right-0 h-0.5 bg-white" style={{ top: "75%" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-white" />
      </div>
    </div>
  )
}

// ─── DateSelectInput ──────────────────────────────────────────────────────────
function DateSelectInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(() => {
    const parts = value ? value.split("-") : ["", "", ""]
    return {
      year: parts[0] || "",
      month: parts[1] || "",
      day: parts[2] || "",
    }
  })

  useEffect(() => {
    const parts = value ? value.split("-") : ["", "", ""]
    setDraft({
      year: parts[0] || "",
      month: parts[1] || "",
      day: parts[2] || "",
    })
  }, [value])

  const upd = (next: Partial<typeof draft>) => {
    const nextDraft = { ...draft, ...next }
    if (nextDraft.year && nextDraft.month && nextDraft.day) {
      const maxDay = new Date(parseInt(nextDraft.year), parseInt(nextDraft.month), 0).getDate()
      if (parseInt(nextDraft.day) > maxDay) {
        nextDraft.day = String(maxDay).padStart(2, "0")
      }
    }
    setDraft(nextDraft)

    const { year: y, month: m, day: d } = nextDraft
    if (y && m && d) onChange(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`)
  }

  const currentYear  = new Date().getFullYear()
  const years  = Array.from({ length: currentYear - 1939 }, (_, i) => currentYear - 9 - i)
  const months = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
                  "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"]
  const daysInMonth  = draft.year && draft.month ? new Date(parseInt(draft.year), parseInt(draft.month), 0).getDate() : 31
  const days   = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const cls = "h-11 min-w-0 w-full rounded-xl border-2 border-gray-200 bg-gray-50/50 px-3 text-sm text-gray-900 outline-none transition-all duration-200 cursor-pointer hover:border-gray-300 focus:border-[#FF6B35] focus:bg-orange-50/20"

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <select value={draft.day}   onChange={e => upd({ day: e.target.value })} className={cls}>
        <option value="">Ngày</option>
        {days.map(d => <option key={d} value={String(d).padStart(2,"0")}>{d}</option>)}
      </select>
      <select value={draft.month} onChange={e => upd({ month: e.target.value })}   className={cls}>
        <option value="">Tháng</option>
        {months.map((m, i) => <option key={i+1} value={String(i+1).padStart(2,"0")}>{m}</option>)}
      </select>
      <select value={draft.year}  onChange={e => upd({ year: e.target.value })}  className={cls}>
        <option value="">Năm</option>
        {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
      </select>
    </div>
  )
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────
function FieldWrap({
  label, required, children, className,
}: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <label className="block text-sm font-semibold text-gray-700">
        {label}{required && <span className="ml-0.5 text-[#FF6B35]">*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Custom input ──────────────────────────────────────────────────────────────
function CustomInput({
  type = "text", placeholder, value, onChange, onFocus, onBlur,
  focused, autoFocus, autoComplete, suffix, className,
}: {
  type?: string; placeholder?: string; value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onFocus?: () => void; onBlur?: () => void; focused?: boolean;
  autoFocus?: boolean; autoComplete?: string;
  suffix?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn(
      "flex items-center rounded-xl border-2 transition-all duration-200 bg-gray-50/50",
      focused
        ? "border-[#FF6B35] bg-orange-50/30 shadow-sm shadow-[#FF6B35]/10"
        : "border-gray-200 hover:border-gray-300",
      className,
    )}>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none font-medium"
      />
      {suffix}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter()
  const { register, user } = useAuth()

  const [form, setForm] = useState({
    fullName: "", username: "", email: "", phone: "",
    address: "", gender: "" as "nam" | "nữ" | "",
    dateOfBirth: "", password: "", confirmPassword: "",
  })
  const [showPw, setShowPw]       = useState(false)
  const [error, setError]         = useState("")
  const [loading, setLoading]     = useState(false)
  const [mounted, setMounted]     = useState(false)
  const [focused, setFocused]     = useState<string | null>(null)

  useEffect(() => { setTimeout(() => setMounted(true), 60) }, [])
  useEffect(() => { if (user) router.push("/") }, [user, router])
  if (user) return null

  const upd = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError("")
  }
  const handlePw = (field: "password" | "confirmPassword") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      upd(field, e.target.value.replace(/[^\u0020-\u007E]/g, ""))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    if (!form.fullName.trim() || !form.username.trim() || !form.email.trim() || !form.phone.trim() || !form.address.trim() || !form.password) {
      setError("Vui lòng nhập đầy đủ thông tin bắt buộc"); setLoading(false); return
    }
    if (form.phone.trim().length < 10)      { setError("Số điện thoại không hợp lệ"); setLoading(false); return }
    if (form.username.trim().length < 3)    { setError("Tên tài khoản phải có ít nhất 3 ký tự"); setLoading(false); return }
    if (form.password.length < 6)           { setError("Mật khẩu phải có ít nhất 6 ký tự"); setLoading(false); return }
    if (form.password !== form.confirmPassword) { setError("Mật khẩu xác nhận không khớp"); setLoading(false); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError("Email không hợp lệ"); setLoading(false); return }

    const result = await register({
      username: form.username.trim(), password: form.password,
      fullName: form.fullName.trim(), email: form.email.trim(),
      phone: form.phone.trim(), address: form.address.trim(),
      gender: form.gender || undefined, dateOfBirth: form.dateOfBirth || undefined,
    })

    if (!result.success) { setError(result.error || "Đăng ký thất bại"); setLoading(false); return }
    router.push("/")
  }

  // Password strength
  const pwStrength = (() => {
    const p = form.password; if (!p) return 0
    let s = 0
    if (p.length >= 6)             s++
    if (p.length >= 10)            s++
    if (/[A-Z]/.test(p))           s++
    if (/[0-9]/.test(p))           s++
    if (/[^A-Za-z0-9]/.test(p))   s++
    return s
  })()
  const pwLabel = ["", "Rất yếu", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"][pwStrength] || ""
  const pwBg    = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"][pwStrength] || ""
  const pwText  = ["", "text-red-500", "text-orange-500", "text-yellow-500", "text-green-500", "text-emerald-500"][pwStrength] || ""

  const BENEFITS = [
    { icon: Zap,          text: "Đặt sân online 24/7 — nhanh chóng, tiện lợi" },
    { icon: ShieldCheck,  text: "Nhận QR check-in ngay sau khi thanh toán" },
    { icon: CalendarDays, text: "Theo dõi toàn bộ lịch sử đặt sân của bạn" },
    { icon: PackageCheck, text: "Mua phụ kiện chính hãng với giá ưu đãi" },
  ]

  return (
    <div className="min-h-screen flex overflow-hidden bg-[#F7F8FA]">

      {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[46%] relative overflow-hidden bg-[#071a0f] flex-col">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A2416] via-[#0d3020] to-[#051008]" />
        <Orb className="w-[460px] h-[460px] bg-[#1F6B3A]/25 -top-40 -left-40" />
        <Orb className="w-[360px] h-[360px] bg-[#FF6B35]/10 bottom-0 right-0" />
        <Orb className="w-[260px] h-[260px] bg-[#1F6B3A]/15 top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2" />
        <CourtDecoration />

        <div className="relative z-10 flex flex-col flex-1 p-12 xl:p-14">
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

          {/* Heading */}
          <div
            className="mt-auto transition-all duration-700"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(28px)" }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-4 py-1.5 mb-5">
              <Zap className="h-3.5 w-3.5 text-[#FF6B35]" />
              <span className="text-xs font-bold text-[#FF6B35] uppercase tracking-widest">Miễn phí — Đăng ký ngay</span>
            </div>

            <h1 className="font-serif text-4xl xl:text-5xl font-extrabold text-white leading-tight">
              Tham gia<br />
              <span className="text-[#FF6B35]">cộng đồng</span><br />
              cầu lông
            </h1>

            <p className="mt-4 text-white/50 text-sm leading-relaxed max-w-xs">
              Hơn 5.000 thành viên đang đặt sân mỗi tuần. Tạo tài khoản chỉ mất 1 phút.
            </p>

            {/* Benefits */}
            <div className="mt-8 space-y-3">
              {BENEFITS.map(({ icon: Icon, text }, i) => (
                <div
                  key={text}
                  className="flex items-start gap-3 transition-all duration-500"
                  style={{ opacity: mounted ? 1 : 0, transitionDelay: `${200 + i * 70}ms`, transform: mounted ? "translateX(0)" : "translateX(-12px)" }}
                >
                  <span className="mt-0.5 h-6 w-6 rounded-full bg-[#FF6B35]/20 border border-[#FF6B35]/40 flex items-center justify-center shrink-0">
                    <Icon className="h-3 w-3 text-[#FF6B35]" />
                  </span>
                  <span className="text-sm text-white/60 leading-snug">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-10 text-white/25 text-xs">
            © 2026 BadmintonHub · Cầu Giấy · Thanh Xuân · Long Biên
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────── */}
      <div className="flex-1 flex items-start justify-center px-4 py-6 sm:p-6 bg-white lg:bg-[#F7F8FA] overflow-y-auto relative">
        {/* Mobile bg */}
        <div className="absolute inset-0 lg:hidden bg-gradient-to-br from-[#0A2416] via-[#0d3020] to-[#051008]" />
        <Orb className="w-72 h-72 bg-[#FF6B35]/10 -top-20 -right-20 lg:hidden" />

        <div
          className="relative z-10 w-full max-w-[640px] py-8"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.6s ease",
            transitionDelay: "100ms",
          }}
        >
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <Image src="/logo.jpg" alt="BadmintonHub" width={56} height={56} className="rounded-xl shadow-2xl mb-3" />
            <h1 className="font-serif text-2xl font-extrabold text-white">
              Badminton<span className="text-[#FF6B35]">Hub</span>
            </h1>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-2xl shadow-black/10 px-5 py-8 sm:px-8 sm:py-9 lg:px-10 border border-gray-100">
            <div className="mb-7">
              <h2 className="font-serif text-2xl font-extrabold text-[#0A2416]">Tạo tài khoản</h2>
              <p className="text-gray-500 text-sm mt-1.5">Điền thông tin để bắt đầu đặt sân 🏸</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Row 1: Họ tên + Username */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldWrap label="Họ và tên" required>
                  <CustomInput
                    placeholder="Nguyễn Văn A"
                    value={form.fullName}
                    onChange={e => upd("fullName", e.target.value)}
                    focused={focused === "fullName"}
                    onFocus={() => setFocused("fullName")}
                    onBlur={() => setFocused(null)}
                    autoFocus
                    autoComplete="name"
                  />
                </FieldWrap>
                <FieldWrap label="Tên tài khoản" required>
                  <CustomInput
                    placeholder="nguyenvana"
                    value={form.username}
                    onChange={e => upd("username", e.target.value)}
                    focused={focused === "username"}
                    onFocus={() => setFocused("username")}
                    onBlur={() => setFocused(null)}
                    autoComplete="username"
                  />
                </FieldWrap>
              </div>

              {/* Row 2: Email + Phone */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldWrap label="Email" required>
                  <CustomInput
                    type="email"
                    placeholder="email@gmail.com"
                    value={form.email}
                    onChange={e => upd("email", e.target.value)}
                    focused={focused === "email"}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    autoComplete="email"
                  />
                </FieldWrap>
                <FieldWrap label="Số điện thoại" required>
                  <CustomInput
                    type="tel"
                    placeholder="0901234567"
                    value={form.phone}
                    onChange={e => upd("phone", e.target.value)}
                    focused={focused === "phone"}
                    onFocus={() => setFocused("phone")}
                    onBlur={() => setFocused(null)}
                    autoComplete="tel"
                  />
                </FieldWrap>
              </div>

              {/* Address */}
              <FieldWrap label="Địa chỉ" required>
                <div className={cn(
                  "rounded-xl border-2 transition-all duration-200",
                  focused === "address"
                    ? "border-[#FF6B35] shadow-sm shadow-[#FF6B35]/10"
                    : "border-gray-200 hover:border-gray-300",
                )}>
                  <AddressInput
                    value={form.address}
                    onChange={(val) => upd("address", val)}
                    placeholder="Tìm kiếm địa chỉ..."
                    showMapByDefault
                    enableMapPicker
                  />
                </div>
              </FieldWrap>

              {/* Row 3: Giới tính + Ngày sinh */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
                <FieldWrap label="Giới tính">
                  <div className="flex gap-2 h-10">
                    {(["nam", "nữ"] as const).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => upd("gender", g)}
                        className={cn(
                          "flex-1 rounded-xl border-2 text-sm font-semibold transition-all duration-150",
                          form.gender === g
                            ? g === "nam"
                              ? "border-[#FF6B35] bg-[#FF6B35]/10 text-[#FF6B35]"
                              : "border-pink-500 bg-pink-50 text-pink-600"
                            : "border-gray-200 text-gray-600 hover:border-gray-300 bg-gray-50/50"
                        )}
                      >
                        {g === "nam" ? "♂ Nam" : "♀ Nữ"}
                      </button>
                    ))}
                  </div>
                </FieldWrap>
                <FieldWrap label="Ngày sinh">
                  <DateSelectInput value={form.dateOfBirth} onChange={val => upd("dateOfBirth", val)} />
                </FieldWrap>
              </div>

              {/* Password */}
              <FieldWrap label="Mật khẩu" required>
                <CustomInput
                  type={showPw ? "text" : "password"}
                  placeholder="Ít nhất 6 ký tự (không dấu)"
                  value={form.password}
                  onChange={handlePw("password")}
                  focused={focused === "password"}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  autoComplete="new-password"
                  suffix={
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                      className="pr-3.5 text-gray-400 hover:text-gray-600 transition-colors">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                {/* Strength bar */}
                {form.password && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex gap-1 h-1">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className={cn(
                          "flex-1 rounded-full transition-all duration-300",
                          i <= pwStrength ? pwBg : "bg-gray-200"
                        )} />
                      ))}
                    </div>
                    <p className={cn("text-xs font-semibold", pwText)}>{pwLabel}</p>
                  </div>
                )}
              </FieldWrap>

              {/* Confirm password */}
              <FieldWrap label="Xác nhận mật khẩu" required>
                <div className={cn(
                  "flex items-center rounded-xl border-2 transition-all duration-200 bg-gray-50/50",
                  form.confirmPassword && form.password === form.confirmPassword
                    ? "border-green-500 bg-green-50/20"
                    : form.confirmPassword
                      ? "border-red-400 bg-red-50/20"
                      : focused === "confirmPassword"
                        ? "border-[#FF6B35] bg-orange-50/30 shadow-sm shadow-[#FF6B35]/10"
                        : "border-gray-200 hover:border-gray-300"
                )}>
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu"
                    value={form.confirmPassword}
                    onChange={handlePw("confirmPassword")}
                    onFocus={() => setFocused("confirmPassword")}
                    onBlur={() => setFocused(null)}
                    autoComplete="new-password"
                    className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none font-medium"
                  />
                  {form.confirmPassword && (
                    <span className="pr-3.5">
                      {form.password === form.confirmPassword
                        ? <Check className="h-4 w-4 text-green-500" />
                        : <span className="text-red-400 text-sm font-bold">✗</span>
                      }
                    </span>
                  )}
                </div>
              </FieldWrap>

              {/* Error */}
              <div
                className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: error ? "64px" : "0", opacity: error ? 1 : 0 }}
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
                  "w-full flex items-center justify-center gap-2.5 rounded-2xl py-3.5 text-sm font-bold text-white transition-all duration-200",
                  "bg-gradient-to-r from-[#FF6B35] to-[#e85a28]",
                  "shadow-lg shadow-[#FF6B35]/30 hover:shadow-xl hover:shadow-[#FF6B35]/40",
                  "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
                  "disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0",
                )}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Đang tạo tài khoản...
                  </>
                ) : (
                  <>
                    Tạo tài khoản
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Đã có tài khoản?{" "}
              <Link href="/login" className="font-bold text-[#0A2416] hover:text-[#FF6B35] transition-colors">
                Đăng nhập →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
