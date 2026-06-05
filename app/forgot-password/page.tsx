"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowLeft, Phone, Mail, KeyRound, ShieldCheck, CheckCircle2,
  Eye, EyeOff, Loader2, AlertCircle, SendHorizonal
} from "lucide-react"
import { cn } from "@/lib/utils"
import { authApi } from "@/lib/api"

// ─── Steps ───────────────────────────────────────────────────────────────────
const STEPS = [
  { label: "Số điện thoại", icon: Phone },
  { label: "Xác minh OTP",  icon: ShieldCheck },
  { label: "Mật khẩu mới", icon: KeyRound },
]

export default function ForgotPasswordPage() {
  const router = useRouter()

  const [step, setStep]         = useState(0)
  const [phone, setPhone]       = useState("")
  const [otp, setOtp]           = useState(["", "", "", "", "", ""])
  const [newPassword, setNewPassword]         = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [countdown, setCountdown] = useState(0)

  // Data from BE
  const [username, setUsername]     = useState("")
  const [maskedEmail, setMaskedEmail] = useState("")
  const [maskedPhone, setMaskedPhone] = useState("")

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // ─── Step 0: Nhập SĐT → BE gửi OTP qua email ────────────────────────────
  const handlePhoneSubmit = async () => {
    setError("")
    if (!phone.trim()) { setError("Vui lòng nhập số điện thoại"); return }
    if (!/^0\d{9}$/.test(phone.trim())) { setError("Số điện thoại không hợp lệ (10 chữ số, bắt đầu bằng 0)"); return }

    setLoading(true)
    const res = await authApi.forgotPassword(phone.trim())
    setLoading(false)

    if (!res.success) { setError((res as any).error || "Không tìm thấy tài khoản"); return }

    setUsername((res as any).username)
    setMaskedEmail((res as any).maskedEmail)
    setMaskedPhone((res as any).maskedPhone)
    setCountdown(120) // 2 phút để nhập OTP
    setOtp(["","","","","",""])
    setStep(1)
  }

  // ─── Step 1: Verify OTP (FE verify against nothing — just collect code) ──
  // OTP được gửi qua email, user nhập vào đây rồi BE sẽ verify ở step tiếp
  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return
    const next = [...otp]; next[i] = v; setOtp(next); setError("")
    if (v && i < 5) otpRefs.current[i + 1]?.focus()
  }
  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
  }
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    const next = [...otp]
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || ""
    setOtp(next)
    if (pasted.length === 6) otpRefs.current[5]?.focus()
  }
  const handleVerifyOtp = () => {
    const entered = otp.join("")
    if (entered.length !== 6) { setError("Vui lòng nhập đủ 6 chữ số"); return }
    setError("")
    setStep(2)
  }

  const handleResendOtp = async () => {
    if (countdown > 0) return
    setLoading(true)
    const res = await authApi.forgotPassword(phone.trim())
    setLoading(false)
    if (res.success) {
      setOtp(["","","","","",""])
      setCountdown(120)
      setError("")
    } else { setError("Không thể gửi lại OTP, thử lại sau") }
  }

  // ─── Step 2: Đặt mật khẩu mới → BE verify OTP + reset ───────────────────
  const handleResetPassword = async () => {
    setError("")
    if (!newPassword.trim()) { setError("Vui lòng nhập mật khẩu mới"); return }
    if (newPassword.length < 6) { setError("Mật khẩu phải có ít nhất 6 ký tự"); return }
    if (newPassword !== confirmPassword) { setError("Mật khẩu xác nhận không khớp"); return }

    setLoading(true)
    const res = await authApi.resetPassword(phone.trim(), otp.join(""), newPassword)
    setLoading(false)

    if (!res.success) { setError((res as any).error || "Mã OTP không đúng hoặc đã hết hạn"); return }
    setSuccess(true)
  }

  // ─── Success ─────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A2416] via-[#0F3D2A] to-[#1F6B3A] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0">
            <CardContent className="p-8 text-center space-y-6">
              <div className="mx-auto h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-bold">Đổi mật khẩu thành công!</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Mật khẩu tài khoản <strong className="text-foreground">{username}</strong> đã được cập nhật.
                  Bạn có thể đăng nhập bằng mật khẩu mới.
                </p>
              </div>
              <Button onClick={() => router.push("/login")} className="w-full bg-[#1F6B3A] text-white hover:bg-[#185a30] font-semibold h-11 text-base">
                Đăng nhập ngay
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2416] via-[#0F3D2A] to-[#1F6B3A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center mb-3">
            <span className="text-3xl">🏸</span>
          </div>
          <h1 className="font-serif text-2xl font-extrabold text-white">
            Badminton<span className="text-[#FF6B35]">Hub</span>
          </h1>
        </div>

        <Card className="shadow-2xl border-0">
          <CardContent className="p-8">
            {/* Back + Title */}
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 shrink-0"
                onClick={() => { if (step === 0) router.push("/login"); else setStep(s => s - 1) }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="font-serif text-lg font-bold">Quên mật khẩu</h2>
                <p className="text-xs text-muted-foreground">Bước {step + 1}/{STEPS.length} — {STEPS[step].label}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1.5 mb-6">
              {STEPS.map((_, i) => (
                <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-[#1F6B3A]" : "bg-gray-200")} />
              ))}
            </div>

            {/* ── Step 0: Phone ── */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <div className="mx-auto h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                    <Phone className="h-7 w-7 text-blue-600" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nhập số điện thoại đã đăng ký.<br/>
                    Mã OTP sẽ được gửi đến <strong>email</strong> liên kết với số điện thoại.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Số điện thoại</Label>
                  <Input
                    id="phone" placeholder="0888322778" value={phone}
                    onChange={e => { setPhone(e.target.value); setError("") }}
                    autoFocus maxLength={10}
                    onKeyDown={e => e.key === "Enter" && handlePhoneSubmit()}
                  />
                </div>
                {error && <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
                <Button onClick={handlePhoneSubmit} disabled={loading} className="w-full bg-[#1F6B3A] text-white hover:bg-[#185a30] font-semibold h-11 text-base">
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang gửi OTP...</> : <><SendHorizonal className="h-4 w-4 mr-2" />Gửi mã OTP qua email</>}
                </Button>
              </div>
            )}

            {/* ── Step 1: OTP ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <div className="mx-auto h-14 w-14 rounded-full bg-green-50 flex items-center justify-center mb-3">
                    <Mail className="h-7 w-7 text-green-600" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Mã OTP 6 chữ số đã gửi đến email<br/>
                    <strong className="text-foreground">{maskedEmail}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">(SĐT: {maskedPhone})</p>
                </div>
                {/* OTP inputs */}
                <div className="flex justify-center gap-2">
                  {otp.map((digit, i) => (
                    <input key={i}
                      ref={el => { otpRefs.current[i] = el }}
                      type="text" inputMode="numeric" maxLength={1} value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      onPaste={i === 0 ? handleOtpPaste : undefined}
                      className={cn(
                        "w-12 h-14 text-center text-xl font-bold rounded-lg border-2 outline-none transition-colors",
                        "focus:border-[#1F6B3A] focus:ring-2 focus:ring-[#1F6B3A]/20",
                        error ? "border-red-400" : "border-gray-200"
                      )}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800">
                  📧 Kiểm tra hộp thư đến và thư mục <strong>Spam/Thư rác</strong> nếu không thấy email.
                </div>
                {error && <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
                <Button onClick={handleVerifyOtp} className="w-full bg-[#1F6B3A] text-white hover:bg-[#185a30] font-semibold h-11 text-base">
                  Xác minh & Tiếp tục
                </Button>
                <div className="text-center">
                  {countdown > 0 ? (
                    <p className="text-xs text-muted-foreground">Gửi lại sau <strong className="text-foreground">{countdown}s</strong></p>
                  ) : (
                    <button onClick={handleResendOtp} disabled={loading}
                      className="text-sm text-[#1F6B3A] font-semibold hover:underline disabled:opacity-50">
                      {loading ? "Đang gửi..." : "Gửi lại OTP"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 2: New password ── */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <div className="mx-auto h-14 w-14 rounded-full bg-amber-50 flex items-center justify-center mb-3">
                    <KeyRound className="h-7 w-7 text-amber-600" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nhập mật khẩu mới cho tài khoản <strong className="text-foreground">{username}</strong>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Mật khẩu mới</Label>
                  <div className="relative">
                    <Input
                      id="newPassword" type={showPassword ? "text" : "password"}
                      placeholder="Tối thiểu 6 ký tự" value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setError("") }}
                      className="pr-10" autoFocus
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
                  <Input
                    id="confirmPassword" type={showPassword ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu" value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError("") }}
                  />
                </div>
                {/* Strength bar */}
                {newPassword && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      {[1,2,3,4].map(level => (
                        <div key={level} className={cn("h-1 flex-1 rounded-full",
                          newPassword.length >= level * 3
                            ? level<=1?"bg-red-400":level<=2?"bg-amber-400":level<=3?"bg-blue-400":"bg-green-500"
                            : "bg-gray-200"
                        )} />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {newPassword.length<6?"Quá ngắn":newPassword.length<8?"Trung bình":newPassword.length<12?"Khá mạnh":"Rất mạnh"}
                    </p>
                  </div>
                )}
                {error && <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
                <Button onClick={handleResetPassword} disabled={loading} className="w-full bg-[#1F6B3A] text-white hover:bg-[#185a30] font-semibold h-11 text-base">
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang cập nhật...</> : <><KeyRound className="h-4 w-4 mr-2" />Đặt mật khẩu mới</>}
                </Button>
              </div>
            )}

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm text-[#1F6B3A] font-semibold hover:underline flex items-center justify-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Quay lại đăng nhập
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
