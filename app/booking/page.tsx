"use client"

import { Navbar } from "@/components/navbar"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Check, Minus, Plus, Clock, CreditCard, Wallet, Building2,
  Smartphone, Lock, Loader2, AlertCircle, ChevronRight, Tag,
  Users, FileText, Bell, BadgePercent, QrCode, Copy,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { formatVND, isSlotPast } from "@/lib/utils"
import { bookingApi, paymentApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { AddressInput } from "@/components/address-input"

// ─── Types ────────────────────────────────────────────────────────────────────
interface PendingBooking {
  courtId: number; courtName: string; courtType: string; branch: string
  courtAddress?: string; courtLat?: number; courtLng?: number
  price: number; date: string; timeRange: string; slots: string[]
  slotCount: number; totalPrice: number
}

interface SepayPaymentState {
  paymentId: string
  qrImageUrl: string
  bankCode: string
  accountNumber: string
  transferContent: string
  amount: number
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ step }: { step: number }) {
  const steps = [
    { label: "Xác nhận", desc: "Xem lại thông tin sân" },
    { label: "Thông tin", desc: "Thông tin liên hệ" },
    { label: "Thanh toán", desc: "Chọn phương thức" },
  ]
  return (
    <div className="flex items-center justify-center">


      {steps.map((s, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold ring-4 transition-all duration-300",
              i < step
                ? "bg-[#1F6B3A] text-white ring-[#1F6B3A]/20"
                : i === step
                  ? "bg-[#FF6B35] text-white ring-[#FF6B35]/20"
                  : "bg-gray-100 text-gray-400 ring-transparent",
            )}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <div className="text-center hidden sm:block">
              <p className={cn("text-xs font-semibold leading-none", i === step ? "text-[#FF6B35]" : i < step ? "text-[#1F6B3A]" : "text-gray-400")}>{s.label}</p>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={cn(
              "w-16 sm:w-24 h-0.5 mx-3 mb-5 sm:mb-5 rounded-full transition-all duration-300",
              i < step ? "bg-[#1F6B3A]" : "bg-gray-200",
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Countdown (5 phút) ──────────────────────────────────────────────────────
function Countdown({ onExpire }: { onExpire?: () => void }) {
  const [seconds, setSeconds] = useState(300) // 5 phút
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => {
      if (s <= 1) { clearInterval(t); onExpire?.(); return 0 }
      return s - 1
    }), 1000)
    return () => clearInterval(t)
  }, [onExpire])
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  const urgent = seconds <= 60
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold font-mono border",
      urgent
        ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
        : "bg-amber-50 text-amber-600 border-amber-200",
    )}>
      <Clock className="h-3.5 w-3.5" />
      {m}:{s}
    </div>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({
  title, icon: Icon, children, className,
}: { title: string; icon?: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden", className)}>
      <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
        {Icon && <Icon className="h-4 w-4 text-[#FF6B35]" />}
        <h3 className="font-serif font-bold text-[#0A2416] text-base">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

// ─── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-sm font-bold text-gray-800 mt-0.5">{value}</p>
    </div>
  )
}

// ─── Payment method option ────────────────────────────────────────────────────────────────────────────────────────────
function Field({
  label, required, error, children, className,
}: { label: string; required?: boolean; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-sm font-semibold text-gray-700">
        {label}{required && <span className="ml-0.5 text-[#FF6B35]">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />{error}
        </p>
      )}
    </div>
  )
}

function TextInput({
  value, onChange, placeholder, type = "text", error, autoComplete,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string
  type?: string; error?: string; autoComplete?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className={cn(
        "w-full rounded-xl border-2 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-200 font-medium",
        "focus:border-[#FF6B35] focus:bg-orange-50/20 hover:border-gray-300",
        error ? "border-red-400" : "border-gray-200",
      )}
    />
  )
}

// ─── Payment method option ────────────────────────────────────────────────────
const PAY_METHODS = [
  { value: "sepay",  label: "SePay",            icon: Building2,   desc: "Cong thanh toan SePay / VietQR" },
  { value: "vnpay",  label: "VNPay",            icon: CreditCard,  desc: "Thanh toán qua cổng VNPay" },
  { value: "momo",   label: "MoMo",             icon: Smartphone,  desc: "Ví điện tử MoMo" },
  { value: "bank",   label: "Chuyển khoản",     icon: Building2,   desc: "Chuyển khoản ngân hàng" },
  { value: "wallet", label: "Ví BadmintonHub",  icon: Wallet,      desc: "Số dư: 500.000đ" },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BookingPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const isGuest = user?.role === "guest"

  const [step, setStep]                     = useState(0)
  const [people, setPeople]                 = useState(2)
  const [racketRental, setRacketRental]     = useState(false)
  const [note, setNote]                     = useState("")
  const [bookForOther, setBookForOther]     = useState(false)
  const [notifPref, setNotifPref]           = useState("sms")
  const [paymentMethod, setPaymentMethod]   = useState("momo")
  const [discountCode, setDiscountCode]     = useState("")
  const [discountApplied, setDiscountApplied] = useState(false)
  const [agreed, setAgreed]                 = useState(false)
  const [submitting, setSubmitting]         = useState(false)
  const [submitError, setSubmitError]       = useState("")
  const [booking, setBooking]               = useState<PendingBooking | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [sepayPayment, setSepayPayment]     = useState<SepayPaymentState | null>(null)
  const [sepayStatus, setSepayStatus]       = useState<'waiting' | 'failed' | 'expired'>('waiting')
  const [sepayCountdown, setSepayCountdown] = useState(600) // 10 minutes
  const [copied, setCopied]                 = useState(false)

  // Contact info
  const [contactName, setContactName]       = useState(user?.fullName === "Khách" ? "" : (user?.fullName || ""))
  const [contactPhone, setContactPhone]     = useState(user?.phone || "")
  const [contactEmail, setContactEmail]     = useState(user?.email || "")
  const [contactAddress, setContactAddress] = useState(user?.address || "")
  const [otherName, setOtherName]           = useState("")
  const [otherPhone, setOtherPhone]         = useState("")
  const [errors, setErrors]                 = useState<Record<string, string>>({})

  // Redirect unauthenticated users to login with message
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/booking&msg=Vui+lòng+đăng+nhập+để+đặt+sân')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    const stored = localStorage.getItem('pendingBooking')
    if (stored) {
      try { setBooking(JSON.parse(stored)) }
      catch { router.push('/courts') }
    } else { router.push('/courts') }
  }, [router])

  // ─── SePay polling: check payment status every 3s ──────────────
  useEffect(() => {
    if (!sepayPayment?.paymentId || sepayStatus !== 'waiting') return

    const checkStatus = async () => {
      try {
        const status = await paymentApi.getStatus(sepayPayment.paymentId)
        const paymentStatus = status.data?.status
        const invoiceStatus = status.data?.invoiceStatus
        if (status.success && (paymentStatus === 'success' || invoiceStatus === 'paid')) {
          router.push('/booking/success')
        } else if (status.success && paymentStatus === 'failed') {
          setSepayStatus('failed')
        }
      } catch {
        // Network error — keep polling silently
      }
    }

    checkStatus()
    const timer = window.setInterval(checkStatus, 3000)
    return () => window.clearInterval(timer)
  }, [router, sepayPayment?.paymentId, sepayStatus])

  // ─── SePay countdown: 10 minute timeout ────────────────────────
  useEffect(() => {
    if (!sepayPayment || sepayStatus !== 'waiting') return

    const timer = window.setInterval(() => {
      setSepayCountdown(prev => {
        if (prev <= 1) {
          setSepayStatus('expired')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [sepayPayment, sepayStatus])

  // Show loading while auth initialises or redirecting unauthenticated user
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F8FA]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#FF6B35] mx-auto" />
            <p className="text-gray-500 mt-3 text-sm">Đang kiểm tra đăng nhập...</p>
          </div>
        </main>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F8FA]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#FF6B35] mx-auto" />
            <p className="text-gray-500 mt-3 text-sm">Đang tải thông tin đặt sân...</p>
          </div>
        </main>
      </div>
    )
  }

  // ── Màn hình hết hạn phiên ────────────────────────────────────────────────
  if (sessionExpired) {
    // Gọi API để giải phóng chỗ đã hold (fire-and-forget)
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/bookings/release-expired`, { method: 'POST' }).catch(() => {})
    // Xóa pending booking khỏi localStorage
    localStorage.removeItem('pendingBooking')

    return (
      <div className="min-h-screen flex flex-col bg-[#F7F8FA]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm mx-auto">
            <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <Clock className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-gray-800 mb-2">Phiên đặt sân đã hết hạn</h2>
            <p className="text-gray-500 text-sm mb-6">
              Chỗ giữ của bạn đã được giải phóng sau 5 phút chưa thanh toán.
              Vui lòng chọn lại sân và thực hiện đặt sân mới.
            </p>
            <button
              onClick={() => router.push('/courts')}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#e85a28] px-8 py-3 text-sm font-bold text-white shadow-lg"
            >
              Chọn sân mới
            </button>
          </div>
        </main>
      </div>
    )
  }

  const racketPrice    = racketRental ? 50000 : 0
  const discountAmount = discountApplied ? Math.floor(booking.totalPrice * 0.1) : 0
  const total          = booking.totalPrice + racketPrice - discountAmount

  // ─── SePay QR Payment Screen ───────────────────────────────────
  if (sepayPayment) {
    const copyTransferContent = () => {
      if (typeof navigator !== 'undefined') {
        navigator.clipboard?.writeText(sepayPayment.transferContent)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }

    const handleRetryPayment = () => {
      setSepayPayment(null)
      setSepayStatus('waiting')
      setSepayCountdown(600)
      setSubmitting(false)
    }

    const countdownMin = Math.floor(sepayCountdown / 60).toString().padStart(2, '0')
    const countdownSec = (sepayCountdown % 60).toString().padStart(2, '0')
    const isUrgent = sepayCountdown <= 60 && sepayStatus === 'waiting'

    return (
      <div className="min-h-screen flex flex-col bg-[#F7F8FA]">
        <Navbar />
        <main className="flex-1 px-4 py-10">
          <div className="mx-auto max-w-2xl space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF6B35]/10 text-[#FF6B35]">
                <QrCode className="h-7 w-7" />
              </div>
              <h1 className="font-serif text-2xl font-bold text-[#0A2416]">Thanh toán SePay</h1>
              <p className="mt-2 text-sm text-gray-500">
                Quét mã QR hoặc chuyển khoản đúng nội dung bên dưới. Hệ thống sẽ tự xác nhận khi SePay báo tiền về.
              </p>
              {sepayStatus === 'waiting' && (
                <div className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold font-mono border mt-3",
                  isUrgent
                    ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                    : "bg-amber-50 text-amber-600 border-amber-200",
                )}>
                  <Clock className="h-3.5 w-3.5" />
                  Còn lại: {countdownMin}:{countdownSec}
                </div>
              )}
            </div>

            {sepayStatus === 'failed' && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-800">Thanh toán không thành công</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    Số tiền chuyển không đủ hoặc nội dung chuyển khoản không đúng. Vui lòng thử lại.
                  </p>
                </div>
              </div>
            )}

            {sepayStatus === 'expired' && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-800">Hết thời gian thanh toán</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Mã QR đã hết hạn sau 10 phút. Vui lòng tạo lại giao dịch thanh toán.
                  </p>
                </div>
              </div>
            )}

            {sepayStatus === 'waiting' && (
              <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <img
                    src={sepayPayment.qrImageUrl}
                    alt="SePay VietQR"
                    className="mx-auto aspect-square w-full rounded-xl border border-gray-100 bg-white object-contain"
                  />
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <InfoRow label="Số tiền" value={formatVND(sepayPayment.amount)} />
                  <InfoRow label="Ngân hàng" value={sepayPayment.bankCode || "SePay"} />
                  <InfoRow label="Tài khoản" value={sepayPayment.accountNumber || "Theo cấu hình SePay"} />
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Nội dung chuyển khoản</p>
                    <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2">
                      <span className="flex-1 break-all font-mono text-sm font-bold text-[#FF6B35]">
                        {sepayPayment.transferContent}
                      </span>
                      <button
                        type="button"
                        onClick={copyTransferContent}
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded-lg shadow-sm transition-colors",
                          copied
                            ? "bg-green-100 text-green-600"
                            : "bg-white text-gray-600 hover:text-[#FF6B35]"
                        )}
                        aria-label="Copy transfer content"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    Đang chờ SePay xác thực thanh toán...
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {(sepayStatus === 'failed' || sepayStatus === 'expired') && (
                <button
                  type="button"
                  onClick={handleRetryPayment}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#e85a28] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FF6B35]/30 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                >
                  Thử lại thanh toán
                </button>
              )}
              <button
                type="button"
                onClick={() => router.push('/my-bookings')}
                className={cn(
                  "rounded-2xl border-2 border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50",
                  (sepayStatus === 'failed' || sepayStatus === 'expired') ? "flex-1" : "w-full"
                )}
              >
                Xem lịch đặt của tôi
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const validateStep1 = () => {
    const e: Record<string, string> = {}
    if (!contactName.trim())    e.contactName    = "Vui lòng nhập họ tên"
    if (!contactPhone.trim())   e.contactPhone   = "Vui lòng nhập số điện thoại"
    else if (!/^0\d{9}$/.test(contactPhone.trim())) e.contactPhone = "Số điện thoại không hợp lệ"
    if (!contactEmail.trim())   e.contactEmail   = "Vui lòng nhập email"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) e.contactEmail = "Email không hợp lệ"
    if (!contactAddress.trim()) e.contactAddress = "Vui lòng nhập địa chỉ"
    if (bookForOther) {
      if (!otherName.trim())  e.otherName  = "Vui lòng nhập họ tên người chơi"
      if (!otherPhone.trim()) e.otherPhone = "Vui lòng nhập SĐT người chơi"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleApplyDiscount = () => {
    const code = discountCode.toUpperCase()
    if (code === 'BADMINTON10' || code === 'GIAM10') setDiscountApplied(true)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError("")
    try {
      const dates     = booking.date.split(',').map((d: string) => d.trim())
      const [dayStr, monthStr] = dates[0].split('/')
      const year       = new Date().getFullYear()
      const bookingDate = `${year}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}`
      const [timeStart, timeEnd] = booking.timeRange.split(' - ').map((t: string) => t.trim())
      const slotDate = new Date(year, Number(monthStr) - 1, Number(dayStr))
      if (isSlotPast(slotDate, timeStart)) {
        localStorage.removeItem('pendingBooking')
        setSubmitError('Khung giờ đã qua, vui lòng chọn lại lịch trống')
        setSubmitting(false)
        return
      }

      // Map FE payment method to BE payment_method
      const bePaymentMethod = paymentMethod === 'bank' ? 'bank_transfer'
        : paymentMethod === 'wallet' ? 'cash'
        : paymentMethod

      const result = await bookingApi.create({
        court_id: booking.courtId, booking_date: bookingDate,
        time_start: timeStart, time_end: timeEnd,
        people, payment_method: bePaymentMethod,
        customer_name:  contactName || 'Khách',
        customer_phone: contactPhone,
        customer_email: contactEmail || undefined,
        user_id:        user?.role !== 'guest' ? user?.id : undefined,
        note: note || undefined,
      })

      if (result.success && result.booking) {
        const completedData = {
          id: result.booking.id, courtName: booking.courtName,
          courtType: booking.courtType, branch: booking.branch,
          courtAddress: booking.courtAddress, courtLat: booking.courtLat, courtLng: booking.courtLng,
          date: booking.date, timeRange: booking.timeRange,
          people, amount: total, paymentMethod,
          status: result.booking.status,
          contact: { name: contactName, phone: contactPhone, email: contactEmail, address: contactAddress },
          racketRental, note,
        }
        localStorage.setItem('completedBooking', JSON.stringify(completedData))
        localStorage.removeItem('pendingBooking')

        // For payment gateways: redirect or submit checkout form
        if ((paymentMethod === 'vnpay' || paymentMethod === 'momo' || paymentMethod === 'sepay') && result.booking.invoice_id) {
          if (result.booking.status === 'confirmed' || result.booking.invoice_status === 'paid') {
            setTimeout(() => router.push('/booking/success'), 800)
            return
          }
          const payResult = await paymentApi.create(result.booking.invoice_id, paymentMethod as 'vnpay' | 'momo' | 'sepay')
          if (paymentMethod === 'sepay' && payResult.success && payResult.paymentId) {
            // Prefer QR mode (VietQR) — works with just bank info
            if (payResult.qrImageUrl) {
              setSepayPayment({
                paymentId: payResult.paymentId,
                qrImageUrl: payResult.qrImageUrl,
                bankCode: payResult.bankCode || '',
                accountNumber: payResult.accountNumber || '',
                transferContent: payResult.transferContent || result.booking.invoice_id,
                amount: payResult.amount || total,
              })
              setSubmitting(false)
              return
            }
            // Fallback: checkout form POST (requires merchant config)
            if (payResult.checkoutUrl && payResult.formFields) {
              const form = document.createElement("form")
              form.method = "POST"
              form.action = payResult.checkoutUrl
              Object.entries(payResult.formFields).forEach(([name, value]) => {
                const input = document.createElement("input")
                input.type = "hidden"
                input.name = name
                input.value = String(value)
                form.appendChild(input)
              })
              document.body.appendChild(form)
              form.submit()
              return
            }
            // Neither QR nor checkout available
            setSubmitError('SePay chưa được cấu hình đầy đủ. Vui lòng chọn phương thức thanh toán khác.')
            setSubmitting(false)
            return
          } else if (payResult.success && payResult.payUrl) {
            window.location.href = payResult.payUrl
            return
          } else {
            setSubmitError(payResult.error || 'Không thể tạo liên kết thanh toán. Vui lòng thanh toán tại quầy.')
            setSubmitting(false)
            return
          }
        }

        // For cash / bank / wallet: go to success page
        setTimeout(() => router.push('/booking/success'), 1500)
      } else {
        setSubmitError(result.error || 'Đặt sân thất bại. Vui lòng thử lại.')
        setSubmitting(false)
      }
    } catch {
      setSubmitError('Lỗi kết nối server. Vui lòng thử lại.')
      setSubmitting(false)
    }
  }

  // ── Order summary sidebar (shared between desktop right & mobile bottom) ──
  const OrderSummary = ({ compact = false }: { compact?: boolean }) => (
    <div className={cn("space-y-4", compact && "space-y-2")}>
      {!compact && (
        <div className="space-y-3">
          <InfoRow label="Sân" value={booking.courtName} />
          <InfoRow label="Cơ sở" value={booking.branch} />
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Ngày" value={booking.date} />
            <InfoRow label="Giờ" value={booking.timeRange} />
          </div>
          <InfoRow label="Số người" value={`${people} người`} />
          {booking.slots.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Slot đã chọn</p>
              <div className="flex flex-wrap gap-1">
                {booking.slots.map(s => (
                  <span key={s} className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{booking.slotCount} slot × {formatVND(booking.price)}</span>
          <span className="font-semibold text-gray-800">{formatVND(booking.totalPrice)}</span>
        </div>
        {racketRental && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Thuê vợt</span>
            <span className="font-semibold text-gray-800">{formatVND(racketPrice)}</span>
          </div>
        )}
        {discountApplied && (
          <div className="flex justify-between text-sm text-[#1F6B3A]">
            <span>Giảm giá (10%)</span>
            <span className="font-semibold">−{formatVND(discountAmount)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-3 flex justify-between items-baseline">
        <span className="text-sm font-semibold text-gray-600">Tổng cộng</span>
        <span className="font-serif font-extrabold text-xl text-[#FF6B35]">{formatVND(total)}</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA]">
        <Navbar />

        <main className="flex-1 pb-24 lg:pb-10">
          {/* Header strip */}
          <div className="bg-white border-b border-gray-100">
            <div className="mx-auto max-w-5xl px-4 py-6">
              <h1 className="font-serif text-2xl font-extrabold text-[#0A2416] mb-1">Đặt sân cầu lông</h1>
              <p className="text-sm text-gray-500">{booking.courtName} · {booking.branch}</p>
              <div className="mt-5">
                <Stepper step={step} />
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-5xl px-4 py-7 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">

            {/* ── Main content ── */}
            <div className="space-y-5">

              {/* ── STEP 0: Confirm ── */}
              {step === 0 && (
                <>
                  {/* Guest warning */}
                  {isGuest && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-800">Bạn đang đặt sân với tư cách khách</p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Nhập đầy đủ thông tin ở bước sau, hoặc{" "}
                          <a href="/register" className="font-bold underline text-[#FF6B35]">đăng ký tài khoản</a>{" "}
                          để đặt sân nhanh hơn.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Booking info */}
                  <Section title="Thông tin đặt sân" icon={FileText}>
                    <div className="flex items-center justify-between mb-5">
                      <p className="text-xs text-gray-400">Thời gian giữ chỗ (5 phút)</p>
                      <Countdown onExpire={() => setSessionExpired(true)} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <InfoRow label="Sân" value={booking.courtName} />
                      <InfoRow label="Loại sân" value={booking.courtType} />
                      <InfoRow label="Cơ sở" value={booking.branch} />
                      <InfoRow label="Thời gian" value={booking.timeRange} />
                      <InfoRow label="Ngày" value={booking.date} />
                      <InfoRow label="Số slot" value={`${booking.slotCount} slot`} />
                    </div>

                    {booking.slots.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Slot đã chọn</p>
                        <div className="flex flex-wrap gap-1.5">
                          {booking.slots.map(s => (
                            <span key={s} className="inline-flex items-center rounded-lg bg-[#0A2416]/5 border border-[#0A2416]/10 px-2.5 py-1 text-xs font-semibold text-[#0A2416]">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </Section>

                  {/* Options */}
                  <Section title="Tuỳ chọn thêm" icon={Users}>
                    {/* People */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Số người chơi</p>
                        <p className="text-xs text-gray-400 mt-0.5">Tối đa 6 người/sân</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setPeople(Math.max(1, people - 1))}
                          className="h-8 w-8 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-lg font-bold text-gray-900 w-6 text-center">{people}</span>
                        <button
                          type="button"
                          onClick={() => setPeople(Math.min(6, people + 1))}
                          className="h-8 w-8 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Racket rental */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Thuê vợt cầu lông</p>
                          <p className="text-xs text-gray-400 mt-0.5">+{formatVND(50000)}/bộ · Vợt chính hãng Yonex</p>
                        </div>
                        <Checkbox
                          checked={racketRental}
                          onCheckedChange={(v) => setRacketRental(!!v)}
                          className="data-[state=checked]:bg-[#FF6B35] data-[state=checked]:border-[#FF6B35]"
                        />
                      </label>
                    </div>

                    {/* Note */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        <FileText className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
                        Ghi chú
                      </label>
                      <textarea
                        placeholder="Ví dụ: Cần thêm nước uống, đến sớm 15 phút..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border-2 border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-200 resize-none focus:border-[#FF6B35] focus:bg-orange-50/20"
                      />
                    </div>
                  </Section>

                  <button
                    onClick={() => setStep(1)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#e85a28] py-4 text-sm font-bold text-white shadow-lg shadow-[#FF6B35]/30 hover:shadow-xl hover:shadow-[#FF6B35]/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                  >
                    Tiếp tục <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {/* ── STEP 1: Contact ── */}
              {step === 1 && (
                <>
                  {/* Info banner */}
                  <div className={cn(
                    "flex items-start gap-3 rounded-2xl border px-5 py-4",
                    isGuest
                      ? "border-amber-200 bg-amber-50"
                      : "border-blue-100 bg-blue-50/60",
                  )}>
                    <AlertCircle className={cn("h-5 w-5 shrink-0 mt-0.5", isGuest ? "text-amber-500" : "text-blue-500")} />
                    <div>
                      <p className={cn("text-sm font-bold", isGuest ? "text-amber-800" : "text-blue-800")}>
                        {isGuest ? "Nhập thông tin để xác nhận đặt sân" : "Kiểm tra thông tin liên hệ"}
                      </p>
                      <p className={cn("text-xs mt-0.5", isGuest ? "text-amber-700" : "text-blue-700")}>
                        {isGuest
                          ? <>Hoặc <a href="/register" className="font-bold underline text-[#FF6B35]">đăng ký tài khoản</a> để lưu thông tin và đặt sân nhanh hơn</>
                          : "Đảm bảo thông tin chính xác để nhận thông báo đặt sân"
                        }
                      </p>
                    </div>
                  </div>

                  <Section title="Thông tin liên hệ" icon={Users}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Họ và tên" required error={errors.contactName}>
                        <TextInput
                          value={contactName}
                          onChange={v => { setContactName(v); setErrors(p => ({ ...p, contactName: '' })) }}
                          placeholder="Nguyễn Văn A"
                          error={errors.contactName}
                          autoComplete="name"
                        />
                      </Field>
                      <Field label="Số điện thoại" required error={errors.contactPhone}>
                        <TextInput
                          type="tel"
                          value={contactPhone}
                          onChange={v => { setContactPhone(v); setErrors(p => ({ ...p, contactPhone: '' })) }}
                          placeholder="0901234567"
                          error={errors.contactPhone}
                          autoComplete="tel"
                        />
                      </Field>
                      <Field label="Email" required error={errors.contactEmail} className="sm:col-span-2">
                        <TextInput
                          type="email"
                          value={contactEmail}
                          onChange={v => { setContactEmail(v); setErrors(p => ({ ...p, contactEmail: '' })) }}
                          placeholder="email@gmail.com"
                          error={errors.contactEmail}
                          autoComplete="email"
                        />
                      </Field>
                      <Field label="Địa chỉ" required error={errors.contactAddress} className="sm:col-span-2">
                        <div className={cn(
                          "rounded-xl border-2 transition-all duration-200",
                          errors.contactAddress ? "border-red-400" : "border-gray-200 hover:border-gray-300 focus-within:border-[#FF6B35]",
                        )}>
                          <AddressInput
                            value={contactAddress}
                            onChange={(val) => { setContactAddress(val); setErrors(p => ({ ...p, contactAddress: '' })) }}
                            placeholder="Nhập địa chỉ của bạn"
                            compact
                          />
                        </div>
                        {errors.contactAddress && (
                          <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                            <AlertCircle className="h-3 w-3" />{errors.contactAddress}
                          </p>
                        )}
                      </Field>
                    </div>

                    {/* Book for other */}
                    <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-3">
                      <Switch checked={bookForOther} onCheckedChange={setBookForOther} />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Đặt hộ người khác</p>
                        <p className="text-xs text-gray-400">Người chơi khác với người đặt sân</p>
                      </div>
                    </div>

                    {bookForOther && (
                      <div className="mt-4 pl-4 border-l-2 border-[#FF6B35]/30 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Họ tên người chơi" required error={errors.otherName}>
                          <TextInput
                            value={otherName}
                            onChange={v => { setOtherName(v); setErrors(p => ({ ...p, otherName: '' })) }}
                            placeholder="Tên người chơi"
                            error={errors.otherName}
                          />
                        </Field>
                        <Field label="SĐT người chơi" required error={errors.otherPhone}>
                          <TextInput
                            type="tel"
                            value={otherPhone}
                            onChange={v => { setOtherPhone(v); setErrors(p => ({ ...p, otherPhone: '' })) }}
                            placeholder="Số điện thoại"
                            error={errors.otherPhone}
                          />
                        </Field>
                      </div>
                    )}
                  </Section>

                  {/* Notification preference */}
                  <Section title="Nhận thông báo qua" icon={Bell}>
                    <RadioGroup value={notifPref} onValueChange={setNotifPref} className="flex gap-3">
                      {[
                        { value: "sms",   label: "SMS" },
                        { value: "email", label: "Email" },
                        { value: "zalo",  label: "Zalo" },
                      ].map(o => (
                        <label key={o.value} className={cn(
                          "flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold cursor-pointer transition-all",
                          notifPref === o.value
                            ? "border-[#FF6B35] bg-[#FF6B35]/5 text-[#FF6B35]"
                            : "border-gray-200 text-gray-600 hover:border-gray-300",
                        )}>
                          <RadioGroupItem value={o.value} className="sr-only" />
                          {o.label}
                        </label>
                      ))}
                    </RadioGroup>
                  </Section>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(0)}
                      className="flex items-center gap-2 rounded-2xl border-2 border-gray-200 bg-white px-6 py-3.5 text-sm font-bold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
                    >
                      Quay lại
                    </button>
                    <button
                      onClick={() => { if (validateStep1()) setStep(2) }}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#e85a28] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FF6B35]/30 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                    >
                      Tiếp tục <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}

              {/* ── STEP 2: Payment ── */}
              {step === 2 && (
                <>
                  {isGuest && (
                    <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-4">
                      <CreditCard className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-blue-800">Thanh toán 100% trước khi sử dụng sân</p>
                        <p className="text-xs text-blue-700 mt-0.5">Tạo tài khoản để được thanh toán sau và nhận ưu đãi thành viên.</p>
                      </div>
                    </div>
                  )}

                  {/* Discount */}
                  <Section title="Mã giảm giá" icon={BadgePercent}>
                    <div className="flex gap-2">
                      <div className={cn(
                        "flex-1 flex items-center rounded-xl border-2 transition-all duration-200 bg-gray-50/50",
                        discountApplied
                          ? "border-[#1F6B3A] bg-green-50/30"
                          : "border-gray-200 focus-within:border-[#FF6B35]",
                      )}>
                        <Tag className="h-4 w-4 ml-3 text-gray-400 shrink-0" />
                        <input
                          placeholder="Nhập mã giảm giá (thử: GIAM10)"
                          value={discountCode}
                          onChange={e => setDiscountCode(e.target.value)}
                          disabled={discountApplied}
                          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none font-medium"
                        />
                        {discountApplied && <Check className="h-4 w-4 mr-3 text-[#1F6B3A] shrink-0" />}
                      </div>
                      <button
                        onClick={handleApplyDiscount}
                        disabled={discountApplied || !discountCode.trim()}
                        className={cn(
                          "rounded-xl px-4 text-sm font-bold transition-all",
                          discountApplied
                            ? "bg-[#1F6B3A]/10 text-[#1F6B3A] cursor-default"
                            : "bg-[#0A2416] text-white hover:bg-[#0A2416]/80 disabled:opacity-40",
                        )}
                      >
                        {discountApplied ? "Đã áp dụng" : "Áp dụng"}
                      </button>
                    </div>
                    {discountApplied && (
                      <p className="mt-2 text-xs font-semibold text-[#1F6B3A]">
                        🎉 Giảm 10% · Tiết kiệm {formatVND(discountAmount)}
                      </p>
                    )}
                  </Section>

                  {/* Payment methods */}
                  <Section title="Phương thức thanh toán" icon={CreditCard}>
                    <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2.5">
                      {PAY_METHODS.map(m => {
                        const Icon = m.icon
                        const selected = paymentMethod === m.value
                        return (
                          <label key={m.value} className={cn(
                            "flex items-center gap-4 rounded-2xl border-2 px-4 py-3.5 cursor-pointer transition-all duration-150",
                            selected
                              ? "border-[#FF6B35] bg-[#FF6B35]/5"
                              : "border-gray-100 bg-gray-50/50 hover:border-gray-200",
                          )}>
                            <RadioGroupItem value={m.value} className="sr-only" />
                            <div className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                              selected ? "bg-[#FF6B35] text-white" : "bg-white border border-gray-200 text-gray-500",
                            )}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <p className={cn("text-sm font-bold", selected ? "text-[#FF6B35]" : "text-gray-800")}>{m.label}</p>
                              <p className="text-xs text-gray-400">{m.desc}</p>
                            </div>
                            <div className={cn(
                              "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                              selected ? "border-[#FF6B35] bg-[#FF6B35]" : "border-gray-300",
                            )}>
                              {selected && <Check className="h-3 w-3 text-white" />}
                            </div>
                          </label>
                        )
                      })}
                    </RadioGroup>

                    {paymentMethod === 'bank' && (
                      <div className="mt-4 rounded-xl bg-[#0A2416]/5 border border-[#0A2416]/10 p-4 text-sm space-y-1.5">
                        <p className="font-bold text-[#0A2416]">Thông tin chuyển khoản</p>
                        <div className="text-gray-600 space-y-1 text-xs">
                          <p>Ngân hàng: <span className="font-semibold text-gray-800">Vietcombank</span></p>
                          <p>Số TK: <span className="font-mono font-semibold text-gray-800">1234567890</span></p>
                          <p>Chủ TK: <span className="font-semibold text-gray-800">CÔNG TY TNHH BADMINTONHUB</span></p>
                          <p>Nội dung: <span className="font-mono font-bold text-[#FF6B35]">Đặt sân {booking.courtName}</span></p>
                        </div>
                      </div>
                    )}
                  </Section>

                  {/* Agreement */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={agreed}
                      onCheckedChange={(v) => setAgreed(!!v)}
                      className="mt-0.5 data-[state=checked]:bg-[#FF6B35] data-[state=checked]:border-[#FF6B35]"
                    />
                    <span className="text-sm text-gray-500 leading-relaxed">
                      Tôi đồng ý với{" "}
                      <span className="text-[#FF6B35] font-semibold underline cursor-pointer">điều khoản sử dụng</span>
                      {" "}và{" "}
                      <span className="text-[#FF6B35] font-semibold underline cursor-pointer">chính sách hoàn tiền</span>
                    </span>
                  </label>

                  {/* Error */}
                  {submitError && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {submitError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(1)}
                      className="flex items-center gap-2 rounded-2xl border-2 border-gray-200 bg-white px-6 py-3.5 text-sm font-bold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
                    >
                      Quay lại
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!agreed || submitting}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2.5 rounded-2xl py-3.5 text-sm font-bold text-white transition-all duration-200",
                        "bg-gradient-to-r from-[#FF6B35] to-[#e85a28] shadow-lg shadow-[#FF6B35]/30",
                        "hover:shadow-xl hover:shadow-[#FF6B35]/40 hover:-translate-y-0.5 active:translate-y-0",
                        "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0",
                      )}
                    >
                      {submitting
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý...</>
                        : <><Lock className="h-4 w-4" /> Thanh toán {formatVND(total)}</>
                      }
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ── Desktop sidebar ── */}
            <div className="hidden lg:block">
              <div className="sticky top-24">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-[#0A2416] px-6 py-4">
                    <h3 className="font-serif font-bold text-white text-base">Tóm tắt đơn đặt</h3>
                  </div>
                  <div className="px-6 py-5">
                    <OrderSummary />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ── Mobile price bar ── */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-4 py-3 shadow-xl z-40">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400">{booking.slotCount} slot · {booking.courtName}</p>
              <p className="font-serif font-extrabold text-lg text-[#FF6B35]">{formatVND(total)}</p>
            </div>
            {step < 2 ? (
              <button
                onClick={() => {
                  if (step === 0) setStep(1)
                  else if (step === 1 && validateStep1()) setStep(2)
                }}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#e85a28] px-5 py-2.5 text-sm font-bold text-white shadow-md"
              >
                Tiếp <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!agreed || submitting}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#e85a28] px-5 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Thanh toán
              </button>
            )}
          </div>
        </div>

        {/* Processing overlay */}
        {submitting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-10 flex flex-col items-center gap-5 shadow-2xl mx-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-gray-100 border-t-[#FF6B35] animate-spin" />
                <Lock className="absolute inset-0 m-auto h-6 w-6 text-[#FF6B35]" />
              </div>
              <div className="text-center">
                <p className="font-serif font-bold text-[#0A2416] text-lg">Đang xử lý thanh toán</p>
                <p className="text-sm text-gray-400 mt-1">Vui lòng không đóng trang này</p>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
