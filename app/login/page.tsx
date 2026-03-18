"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, LogIn, UserX } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#0A2416] via-[#0F3D2A] to-[#1F6B3A] flex items-center justify-center">
        <div className="text-white/60 text-sm">Đang tải...</div>
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
  const { login, loginAsGuest, user } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

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
    setLoading(true)
    if (!username.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ thông tin")
      setLoading(false)
      return
    }
    const result = await login(username.trim(), password)
    if (!result.success) {
      setError(result.error || "Tài khoản hoặc mật khẩu không đúng")
      setLoading(false)
    }
  }

  // Chặn ký tự có dấu trong password
  const handlePasswordInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^\x00-\x7F]/g, "")
    setPassword(val)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0A2416] via-[#0F3D2A] to-[#1A5C35] flex-col items-center justify-center p-12">
        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-white/3 border border-white/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-white/3 border border-white/10" />

        <div
          className="relative z-10 text-center transition-all duration-700"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(24px)" }}
        >
          <Image src="/logo.jpg" alt="BadmintonHub" width={96} height={96} className="rounded-2xl shadow-2xl mx-auto mb-6" />
          <h1 className="font-serif text-4xl font-extrabold text-white mb-2">
            Badminton<span className="text-primary">Hub</span>
          </h1>
          <p className="text-white/50 text-base">Hệ thống sân cầu lông Hà Nội</p>

          <div className="mt-12 grid grid-cols-3 gap-6 text-center">
            {[
              { value: "20+", label: "Sân thi đấu" },
              { value: "3", label: "Cơ sở" },
              { value: "4.9★", label: "Đánh giá" },
            ].map((s, i) => (
              <div
                key={s.label}
                className="transition-all duration-500"
                style={{ opacity: mounted ? 1 : 0, transitionDelay: `${200 + i * 100}ms` }}
              >
                <p className="font-serif text-2xl font-extrabold text-white">{s.value}</p>
                <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div
          className="w-full max-w-sm transition-all duration-600"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)", transitionDelay: "100ms" }}
        >
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <Image src="/logo.jpg" alt="BadmintonHub" width={64} height={64} className="rounded-xl shadow-lg mb-3" />
            <h1 className="font-serif text-2xl font-extrabold text-foreground">
              Badminton<span className="text-primary">Hub</span>
            </h1>
          </div>

          <div className="mb-8">
            <h2 className="font-serif text-2xl font-extrabold text-foreground">Đăng nhập</h2>
            <p className="text-muted-foreground text-sm mt-1">Chào mừng trở lại!</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium">Tên tài khoản</Label>
              <Input
                id="username"
                placeholder="Nhập tên tài khoản"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Mật khẩu</Label>
                <Link href="/forgot-password" className="text-xs text-primary font-medium hover:underline">
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={handlePasswordInput}
                  autoComplete="current-password"
                  className="h-11 pr-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  tabIndex={-1}          // ← không nhận focus từ Tab
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
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
                  Đang đăng nhập...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" /> Đăng nhập
                </span>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground">Hoặc</span>
            </div>
          </div>

          {/* Guest */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 font-semibold border-dashed border-2 gap-2 hover:scale-[1.01] transition-transform duration-200"
            onClick={() => {
              loginAsGuest()
              router.push(redirectUrl || "/")
            }}
          >
            <UserX className="h-4 w-4" />
            Tiếp tục với vai trò khách
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Xem sân và sản phẩm, cần đăng ký để đặt sân
          </p>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline transition-colors">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}