"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, UserPlus, Check } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { AddressInput } from "@/components/address-input"

/* ─── Date Select Component ─── */
function DateSelectInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value ? value.split("-") : ["", "", ""]
  const year  = parts[0] || ""
  const month = parts[1] || ""
  const day   = parts[2] || ""

  const upd = (y: string, m: string, d: string) => {
    if (y && m && d) onChange(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`)
    else onChange("")
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 1939 }, (_, i) => currentYear - 9 - i)
  const months = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"]
  const daysInMonth = year && month ? new Date(parseInt(year), parseInt(month), 0).getDate() : 31
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const cls = "h-10 w-full rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"

  return (
    <div className="grid grid-cols-3 gap-2">
      <select value={day} onChange={e => upd(year, month, e.target.value)} className={cls}>
        <option value="">Ngày</option>
        {days.map(d => <option key={d} value={String(d).padStart(2,"0")}>{d}</option>)}
      </select>
      <select value={month} onChange={e => upd(year, e.target.value, day)} className={cls}>
        <option value="">Tháng</option>
        {months.map((m, i) => <option key={i+1} value={String(i+1).padStart(2,"0")}>{m}</option>)}
      </select>
      <select value={year} onChange={e => upd(e.target.value, month, day)} className={cls}>
        <option value="">Năm</option>
        {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
      </select>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const { register, user } = useAuth()
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    address: "",
    gender: "" as "nam" | "nữ" | "",
    dateOfBirth: "",
    password: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (user) router.push("/")
  }, [user, router])

  if (user) return null

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Chặn ký tự có dấu trong password
  const handlePasswordInput = (field: "password" | "confirmPassword") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      update(field, e.target.value.replace(/[^\x00-\x7F]/g, ""))
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (!form.fullName.trim() || !form.username.trim() || !form.email.trim() || !form.phone.trim() || !form.address.trim() || !form.password) {
      setError("Vui lòng nhập đầy đủ thông tin bắt buộc")
      setLoading(false)
      return
    }
    if (form.phone.trim().length < 10) { setError("Số điện thoại không hợp lệ"); setLoading(false); return }
    if (form.username.trim().length < 3) { setError("Tên tài khoản phải có ít nhất 3 ký tự"); setLoading(false); return }
    if (form.password.length < 6) { setError("Mật khẩu phải có ít nhất 6 ký tự"); setLoading(false); return }
    if (form.password !== form.confirmPassword) { setError("Mật khẩu xác nhận không khớp"); setLoading(false); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError("Email không hợp lệ"); setLoading(false); return }

    const result = await register({
      username: form.username.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      gender: form.gender || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
    })

    if (!result.success) {
      setError(result.error || "Đăng ký thất bại")
      setLoading(false)
      return
    }
    router.push("/")
  }

  // Password strength
  const pwStrength = (() => {
    const p = form.password
    if (!p) return 0
    let s = 0
    if (p.length >= 6) s++
    if (p.length >= 10) s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    return s
  })()

  const pwLabel = ["", "Rất yếu", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"][pwStrength] || ""
  const pwColor = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"][pwStrength] || ""

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-5/12 relative overflow-hidden bg-gradient-to-br from-[#0A2416] via-[#0F3D2A] to-[#1A5C35] flex-col items-center justify-center p-12">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-white/3 border border-white/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full bg-white/3 border border-white/10" />

        <div
          className="relative z-10 text-center transition-all duration-700"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(24px)" }}
        >
          <Image src="/logo.jpg" alt="BadmintonHub" width={96} height={96} className="rounded-2xl shadow-2xl mx-auto mb-6" />
          <h1 className="font-serif text-4xl font-extrabold text-white mb-2">
            Badminton<span className="text-primary">Hub</span>
          </h1>
          <p className="text-white/50 text-base">Tạo tài khoản để bắt đầu</p>

          <div className="mt-10 space-y-3 text-left">
            {[
              "Đặt sân online 24/7",
              "Thanh toán nhanh — Nhận QR check-in",
              "Theo dõi lịch sử đặt sân",
              "Mua phụ kiện chính hãng",
            ].map((item, i) => (
              <div
                key={item}
                className="flex items-center gap-3 text-white/70 text-sm transition-all duration-500"
                style={{ opacity: mounted ? 1 : 0, transitionDelay: `${200 + i * 80}ms` }}
              >
                <span className="h-5 w-5 rounded-full bg-primary/30 border border-primary/50 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-primary" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background overflow-y-auto">
        <div
          className="w-full max-w-md py-8 transition-all duration-600"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)", transitionDelay: "100ms" }}
        >
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <Image src="/logo.jpg" alt="BadmintonHub" width={64} height={64} className="rounded-xl shadow-lg mb-3" />
            <h1 className="font-serif text-2xl font-extrabold text-foreground">
              Badminton<span className="text-primary">Hub</span>
            </h1>
          </div>

          <div className="mb-7">
            <h2 className="font-serif text-2xl font-extrabold text-foreground">Đăng ký tài khoản</h2>
            <p className="text-muted-foreground text-sm mt-1">Điền thông tin để tạo tài khoản mới</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Họ tên + username */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Họ và tên <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Nguyễn Văn A"
                  value={form.fullName}
                  onChange={e => update("fullName", e.target.value)}
                  autoFocus
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tên tài khoản <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="nguyenvana"
                  value={form.username}
                  onChange={e => update("username", e.target.value)}
                  className="h-10"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Email + SĐT */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Email <span className="text-red-500">*</span></Label>
                <Input
                  type="email"
                  placeholder="email@gmail.com"
                  value={form.email}
                  onChange={e => update("email", e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Số điện thoại <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="0901234567"
                  value={form.phone}
                  onChange={e => update("phone", e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            {/* Địa chỉ */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Địa chỉ <span className="text-red-500">*</span></Label>
              <AddressInput
                value={form.address}
                onChange={(val) => update("address", val)}
                placeholder="Tìm kiếm địa chỉ..."
                compact
              />
            </div>

            {/* Giới tính + Ngày sinh */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Giới tính</Label>
                <div className="flex gap-2 h-10">
                  {(["nam", "nữ"] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => update("gender", g)}
                      className={cn(
                        "flex-1 rounded-lg border-2 text-sm font-medium transition-all duration-150 capitalize",
                        form.gender === g
                          ? g === "nam"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-pink-500 bg-pink-50 dark:bg-pink-900/20 text-pink-600"
                          : "border-border hover:border-muted-foreground/40"
                      )}
                    >
                      {g === "nam" ? "♂ Nam" : "♀ Nữ"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Ngày sinh</Label>
                <DateSelectInput
                  value={form.dateOfBirth}
                  onChange={val => update("dateOfBirth", val)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Mật khẩu <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Ít nhất 6 ký tự (không dấu)"
                  value={form.password}
                  onChange={handlePasswordInput("password")}
                  autoComplete="new-password"
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {form.password && (
                <div className="space-y-1">
                  <div className="flex gap-1 h-1.5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div
                        key={i}
                        className={cn(
                          "flex-1 rounded-full transition-all duration-300",
                          i <= pwStrength ? pwColor : "bg-muted"
                        )}
                      />
                    ))}
                  </div>
                  <p className={cn("text-xs font-medium transition-colors", pwColor.replace("bg-", "text-"))}>
                    {pwLabel}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Xác nhận mật khẩu <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu"
                  value={form.confirmPassword}
                  onChange={handlePasswordInput("confirmPassword")}
                  autoComplete="new-password"
                  className={cn(
                    "h-10 pr-10 transition-all duration-200",
                    form.confirmPassword && form.password === form.confirmPassword
                      ? "border-green-500 focus:ring-green-500/20"
                      : form.confirmPassword
                        ? "border-red-400 focus:ring-red-500/20"
                        : ""
                  )}
                />
                {form.confirmPassword && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {form.password === form.confirmPassword
                      ? <Check className="h-4 w-4 text-green-500" />
                      : <span className="h-4 w-4 text-red-400 text-xs font-bold flex items-center">✗</span>
                    }
                  </span>
                )}
              </div>
            </div>

            {/* Error */}
            <div
              className="overflow-hidden transition-all duration-300"
              style={{ maxHeight: error ? "60px" : "0", opacity: error ? 1 : 0 }}
            >
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg">
                {error}
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 font-semibold text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-primary/20"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Đang tạo tài khoản...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Đăng ký
                </span>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Đã có tài khoản?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline transition-colors">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}