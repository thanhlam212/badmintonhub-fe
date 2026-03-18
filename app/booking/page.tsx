"use client"

import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Check, Minus, Plus, Clock, CreditCard, Wallet, Building2, Smartphone, Lock, Loader2, AlertCircle, UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { formatVND } from "@/lib/utils"
import { bookingApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { RouteGuard } from "@/components/route-guard"
import { useAuth } from "@/lib/auth-context"
import { AddressInput } from "@/components/address-input"

interface PendingBooking {
  courtId: number
  courtName: string
  courtType: string
  branch: string
  courtAddress?: string
  courtLat?: number
  courtLng?: number
  price: number
  date: string
  timeRange: string
  slots: string[]
  slotCount: number
  totalPrice: number
}

function Stepper({ step }: { step: number }) {
  const steps = ["Xác nhận", "Thông tin", "Thanh toán"]
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors",
              i < step ? "bg-secondary text-secondary-foreground" :
              i === step ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground"
            )}>
              {i < step ? <Check className="h-5 w-5" /> : i + 1}
            </div>
            <span className={cn("text-xs mt-1.5 font-medium", i === step ? "text-primary" : "text-muted-foreground")}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn("w-16 h-0.5 mx-2 mb-5", i < step ? "bg-secondary" : "bg-muted")} />
          )}
        </div>
      ))}
    </div>
  )
}

function CountdownBadge() {
  const [seconds, setSeconds] = useState(600) // 10 minutes
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return (
    <Badge variant="outline" className={cn(
      "gap-1 font-mono",
      seconds <= 60
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200"
    )}>
      <Clock className="h-3 w-3" /> {m}:{s}
    </Badge>
  )
}

export default function BookingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [people, setPeople] = useState(2)
  const [racketRental, setRacketRental] = useState(false)
  const [note, setNote] = useState("")
  const [bookForOther, setBookForOther] = useState(false)
  const [notifPref, setNotifPref] = useState("sms")
  const [paymentMethod, setPaymentMethod] = useState("momo")
  const [discountCode, setDiscountCode] = useState("")
  const [discountApplied, setDiscountApplied] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [booking, setBooking] = useState<PendingBooking | null>(null)
  const isGuest = user?.role === "guest"

  // Contact info - prefill from auth
  const [contactName, setContactName] = useState(user?.fullName === "Khách" ? "" : (user?.fullName || ""))
  const [contactPhone, setContactPhone] = useState(user?.phone || "")
  const [contactEmail, setContactEmail] = useState(user?.email || "")
  const [contactAddress, setContactAddress] = useState(user?.address || "")
  const [otherName, setOtherName] = useState("")
  const [otherPhone, setOtherPhone] = useState("")

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Check if guest has filled all required contact info
  const isGuestInfoComplete = !isGuest || (
    contactName.trim() !== "" && contactName.trim() !== "Khách" &&
    /^0\d{9}$/.test(contactPhone.trim()) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim()) &&
    contactAddress.trim() !== ""
  )

  useEffect(() => {
    const stored = localStorage.getItem('pendingBooking')
    if (stored) {
      try {
        setBooking(JSON.parse(stored))
      } catch {
        router.push('/courts')
      }
    } else {
      router.push('/courts')
    }
  }, [router])

  if (!booking) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground mt-2">Đang tải thông tin đặt sân...</p>
          </div>
        </main>
      </div>
    )
  }

  const racketPrice = racketRental ? 50000 : 0
  const discountAmount = discountApplied ? Math.floor(booking.totalPrice * 0.1) : 0
  const total = booking.totalPrice + racketPrice - discountAmount

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {}
    if (!contactName.trim()) newErrors.contactName = "Vui lòng nhập họ tên"
    if (!contactPhone.trim()) newErrors.contactPhone = "Vui lòng nhập số điện thoại"
    else if (!/^0\d{9}$/.test(contactPhone.trim())) newErrors.contactPhone = "Số điện thoại không hợp lệ"
    if (!contactEmail.trim()) newErrors.contactEmail = "Vui lòng nhập email"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) newErrors.contactEmail = "Email không hợp lệ"
    if (!contactAddress.trim()) newErrors.contactAddress = "Vui lòng nhập địa chỉ"
    if (bookForOther) {
      if (!otherName.trim()) newErrors.otherName = "Vui lòng nhập họ tên người chơi"
      if (!otherPhone.trim()) newErrors.otherPhone = "Vui lòng nhập SĐT người chơi"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleApplyDiscount = () => {
    if (discountCode.toUpperCase() === 'BADMINTON10' || discountCode.toUpperCase() === 'GIAM10') {
      setDiscountApplied(true)
    }
  }

  const handleSubmit = async () => {
  if (isGuest && !isGuestInfoComplete) {
    setStep(1)
    validateStep1()
    return
  }
  setSubmitting(true)

  try {
    // Parse ngày từ format "4/3" → "2026-03-04"
    const dates = booking.date.split(',').map((d: string) => d.trim())
    const firstDate = dates[0]
    const [dayStr, monthStr] = firstDate.split('/')
    const year = new Date().getFullYear()
    const bookingDate = `${year}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}`

    const [timeStart, timeEnd] = booking.timeRange.split(' - ').map((t: string) => t.trim())

    // ✅ Dùng camelCase cho NestJS (không phải snake_case)
    const result = await bookingApi.create({
      courtId:       booking.courtId,
      bookingDate,
      timeStart,
      timeEnd,
      people,
      paymentMethod,
      customerName:  contactName || 'Khách',
      customerPhone: contactPhone,
      userId:        user?.role !== 'guest' ? user?.id : undefined,
    })

    if (result.success && result.booking) {
      // Lưu vào localStorage để trang success đọc
      const completedBooking = {
        id:            result.booking.id,
        courtName:     booking.courtName,
        courtType:     booking.courtType,
        branch:        booking.branch,
        courtAddress:  booking.courtAddress,
        courtLat:      booking.courtLat,
        courtLng:      booking.courtLng,
        date:          booking.date,
        timeRange:     booking.timeRange,
        people,
        amount:        total,
        paymentMethod,
        contact: {
          name:    contactName,
          phone:   contactPhone,
          email:   contactEmail,
          address: contactAddress,
        },
        racketRental,
        note,
      }
      localStorage.setItem('completedBooking', JSON.stringify(completedBooking))
      localStorage.removeItem('pendingBooking')

      setTimeout(() => router.push('/booking/success'), 1500)
    } else {
      alert(result.error || 'Đặt sân thất bại. Vui lòng thử lại.')
      setSubmitting(false)
    }
  } catch (err) {
    console.error('Booking error:', err)
    alert('Lỗi kết nối server. Vui lòng thử lại.')
    setSubmitting(false)
  }
}

  return (
    <RouteGuard>
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <Stepper step={step} />

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
            {/* Left Content */}
            <div className="flex flex-col gap-6">
              {/* Step 0: Booking Summary */}
              {step === 0 && (
                <>
                  {isGuest && !isGuestInfoComplete && (
                    <Card className="border-red-200 bg-red-50">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-red-800">Bạn chưa nhập đủ thông tin</p>
                            <p className="text-xs text-red-700 mt-1">
                              Tài khoản khách cần nhập đầy đủ <strong>họ tên, số điện thoại, email và địa chỉ</strong> ở bước tiếp theo để có thể đặt sân.
                              Hoặc{" "}
                              <a href="/register" className="text-primary font-semibold underline">đăng ký tài khoản</a>{" "}
                              để được hưởng nhiều ưu đãi hơn.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-serif text-lg">Thông tin đặt sân</CardTitle>
                        <CountdownBadge />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Sân</p>
                          <p className="font-semibold">{booking.courtName}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cơ sở</p>
                          <p className="font-semibold">{booking.branch}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Ngày</p>
                          <p className="font-semibold">{booking.date}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Giờ</p>
                          <p className="font-semibold">{booking.timeRange}</p>
                        </div>
                      </div>

                      {/* Selected slots detail */}
                      {booking.slots.length > 0 && (
                        <div className="border-t pt-4">
                          <Label className="text-sm font-semibold">Chi tiết slot đã chọn</Label>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {booking.slots.map(s => (
                              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="border-t pt-4">
                        <Label className="text-sm font-semibold">Số người chơi</Label>
                        <div className="flex items-center gap-3 mt-2">
                          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setPeople(Math.max(1, people - 1))}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="text-lg font-bold w-8 text-center">{people}</span>
                          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setPeople(Math.min(6, people + 1))}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <Checkbox checked={racketRental} onCheckedChange={(v) => setRacketRental(!!v)} />
                          <div>
                            <p className="text-sm font-semibold">Thuê vợt cầu lông</p>
                            <p className="text-xs text-muted-foreground">+{formatVND(50000)}/bộ</p>
                          </div>
                        </label>
                      </div>

                      <div className="border-t pt-4">
                        <Label className="text-sm font-semibold">Ghi chú</Label>
                        <Textarea
                          placeholder="Ví dụ: Cần thêm nước uống, đến sớm 15 phút..."
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="mt-2"
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <Button onClick={() => setStep(1)} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                    Tiếp tục
                  </Button>
                </>
              )}

              {/* Step 1: Contact Info */}
              {step === 1 && (
                <>
                  <Card className={cn("border-amber-200 bg-amber-50", isGuest ? "" : "border-blue-200 bg-blue-50")}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className={cn("h-5 w-5 shrink-0 mt-0.5", isGuest ? "text-amber-600" : "text-blue-600")} />
                        <div>
                          {isGuest ? (
                            <>
                              <p className="text-sm font-semibold text-amber-800">Bạn đang truy cập với vai trò khách</p>
                              <p className="text-xs text-amber-700 mt-1">
                                Để đặt sân và thanh toán, vui lòng nhập đầy đủ thông tin bên dưới hoặc{" "}
                                <a href="/register" className="text-primary font-semibold underline">đăng ký tài khoản</a>{" "}
                                để được hưởng nhiều ưu đãi hơn.
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-blue-800">Vui lòng kiểm tra thông tin liên hệ</p>
                              <p className="text-xs text-blue-700 mt-1">
                                Tất cả các trường có dấu <span className="text-red-500 font-bold">*</span> đều bắt buộc. 
                                Hãy đảm bảo thông tin chính xác để chúng tôi có thể liên hệ khi cần.
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-serif text-lg">Thông tin liên hệ</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Label className="text-sm">Họ tên <span className="text-red-500">*</span></Label>
                          <Input
                            value={contactName}
                            onChange={(e) => { setContactName(e.target.value); setErrors(prev => ({ ...prev, contactName: '' })) }}
                            className={cn("mt-1.5", errors.contactName && "border-red-500")}
                          />
                          {errors.contactName && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.contactName}</p>}
                        </div>
                        <div>
                          <Label className="text-sm">Số điện thoại <span className="text-red-500">*</span></Label>
                          <Input
                            value={contactPhone}
                            onChange={(e) => { setContactPhone(e.target.value); setErrors(prev => ({ ...prev, contactPhone: '' })) }}
                            className={cn("mt-1.5", errors.contactPhone && "border-red-500")}
                          />
                          {errors.contactPhone && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.contactPhone}</p>}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Email <span className="text-red-500">*</span></Label>
                        <Input
                          value={contactEmail}
                          onChange={(e) => { setContactEmail(e.target.value); setErrors(prev => ({ ...prev, contactEmail: '' })) }}
                          className={cn("mt-1.5", errors.contactEmail && "border-red-500")}
                        />
                        {errors.contactEmail && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.contactEmail}</p>}
                      </div>
                      <div>
                        <Label className="text-sm">Địa chỉ <span className="text-red-500">*</span></Label>
                        <div className="mt-1.5">
                          <AddressInput
                            value={contactAddress}
                            onChange={(val) => { setContactAddress(val); setErrors(prev => ({ ...prev, contactAddress: '' })) }}
                            placeholder="Nhập địa chỉ của bạn"
                            error={errors.contactAddress}
                            compact
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 border-t pt-4">
                        <Switch checked={bookForOther} onCheckedChange={setBookForOther} />
                        <Label className="text-sm">Đặt hộ người khác</Label>
                      </div>

                      {bookForOther && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pl-4 border-l-2 border-primary/20">
                          <div>
                            <Label className="text-sm">Họ tên người chơi <span className="text-red-500">*</span></Label>
                            <Input
                              className={cn("mt-1.5", errors.otherName && "border-red-500")}
                              placeholder="Nhập họ tên"
                              value={otherName}
                              onChange={(e) => { setOtherName(e.target.value); setErrors(prev => ({ ...prev, otherName: '' })) }}
                            />
                            {errors.otherName && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.otherName}</p>}
                          </div>
                          <div>
                            <Label className="text-sm">Số điện thoại <span className="text-red-500">*</span></Label>
                            <Input
                              className={cn("mt-1.5", errors.otherPhone && "border-red-500")}
                              placeholder="Nhập SĐT"
                              value={otherPhone}
                              onChange={(e) => { setOtherPhone(e.target.value); setErrors(prev => ({ ...prev, otherPhone: '' })) }}
                            />
                            {errors.otherPhone && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.otherPhone}</p>}
                          </div>
                        </div>
                      )}

                      <div className="border-t pt-4">
                        <Label className="text-sm font-semibold mb-3 block">Nhận thông báo qua</Label>
                        <RadioGroup value={notifPref} onValueChange={setNotifPref} className="flex gap-4">
                          {[
                            { value: "sms", label: "SMS" },
                            { value: "email", label: "Email" },
                            { value: "zalo", label: "Zalo" },
                          ].map(o => (
                            <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                              <RadioGroupItem value={o.value} /> {o.label}
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                    </CardContent>
                  </Card>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(0)}>Quay lại</Button>
                    <Button
                      onClick={() => {
                        if (validateStep1()) setStep(2)
                      }}
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                    >
                      Tiếp tục
                    </Button>
                  </div>
                </>
              )}

              {/* Step 2: Payment */}
              {step === 2 && (
                <>
                  {isGuest && (
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <CreditCard className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-blue-800">Thanh toán trước khi đặt sân</p>
                            <p className="text-xs text-blue-700 mt-1">
                              Khách vãng lai cần thanh toán trước 100% để xác nhận đặt sân. Tạo tài khoản để được thanh toán sau.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-serif text-lg">Mã giảm giá</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nhập mã giảm giá (thử: GIAM10)"
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value)}
                          disabled={discountApplied}
                        />
                        <Button
                          variant="outline"
                          onClick={handleApplyDiscount}
                          disabled={discountApplied || !discountCode.trim()}
                        >
                          {discountApplied ? "Đã áp dụng ✓" : "Áp dụng"}
                        </Button>
                      </div>
                      {discountApplied && (
                        <p className="text-xs text-green-600 mt-2">Giảm 10% - Tiết kiệm {formatVND(discountAmount)}</p>
                      )}
                      {discountCode && !discountApplied && discountCode.toUpperCase() !== 'GIAM10' && discountCode.toUpperCase() !== 'BADMINTON10' && (
                        <p className="text-xs text-muted-foreground mt-2">Nhập GIAM10 hoặc BADMINTON10 để nhận ưu đãi</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="font-serif text-lg">Phương thức thanh toán</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex flex-col gap-3">
                        {[
                          { value: "vnpay", label: "VNPay", icon: <CreditCard className="h-5 w-5" />, desc: "Thanh toán qua VNPay" },
                          { value: "momo", label: "MoMo", icon: <Smartphone className="h-5 w-5" />, desc: "Ví điện tử MoMo" },
                          { value: "bank", label: "Chuyển khoản", icon: <Building2 className="h-5 w-5" />, desc: "Chuyển khoản ngân hàng" },
                          { value: "wallet", label: "Ví BadmintonHub", icon: <Wallet className="h-5 w-5" />, desc: "Số dư: 500.000đ" },
                        ].map(m => (
                          <label key={m.value} className={cn(
                            "flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors",
                            paymentMethod === m.value ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                          )}>
                            <RadioGroupItem value={m.value} />
                            <span className="text-primary">{m.icon}</span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{m.label}</p>
                              <p className="text-xs text-muted-foreground">{m.desc}</p>
                            </div>
                          </label>
                        ))}
                      </RadioGroup>

                      {paymentMethod === 'bank' && (
                        <div className="mt-4 p-4 rounded-lg bg-muted text-sm space-y-1">
                          <p className="font-semibold">Thông tin chuyển khoản:</p>
                          <p>Ngân hàng: Vietcombank</p>
                          <p>STK: 1234567890</p>
                          <p>Chủ TK: CÔNG TY TNHH BADMINTONHUB</p>
                          <p>Nội dung: <span className="font-mono font-bold text-primary">Đặt sân {booking.courtName}</span></p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
                    <span className="text-sm text-muted-foreground">
                      Tôi đồng ý với <span className="text-primary underline cursor-pointer">điều khoản sử dụng</span> và <span className="text-primary underline cursor-pointer">chính sách hoàn tiền</span>
                    </span>
                  </label>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(1)}>Quay lại</Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!agreed || submitting}
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                      {submitting ? "Đang xử lý..." : `Thanh toán ${formatVND(total)}`}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Right Sidebar: Order Summary */}
            <div className="hidden lg:block">
              <div className="sticky top-20">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">Chi tiết đơn</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <p className="text-muted-foreground">Sân</p>
                      <p className="font-semibold">{booking.courtName}</p>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground">Cơ sở</p>
                      <p className="font-semibold">{booking.branch}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Ngày</p>
                        <p className="font-semibold">{booking.date}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Giờ</p>
                        <p className="font-semibold">{booking.timeRange}</p>
                      </div>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground">Số người chơi</p>
                      <p className="font-semibold">{people} người</p>
                    </div>
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{booking.slotCount} slot x {formatVND(booking.price)}</span>
                        <span>{formatVND(booking.totalPrice)}</span>
                      </div>
                      {racketRental && (
                        <div className="flex justify-between text-sm">
                          <span>Thuê vợt</span>
                          <span>{formatVND(racketPrice)}</span>
                        </div>
                      )}
                      {discountApplied && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Giảm giá (10%)</span>
                          <span>-{formatVND(discountAmount)}</span>
                        </div>
                      )}
                    </div>
                    <div className="border-t pt-3 flex justify-between font-serif font-bold text-lg">
                      <span>Tổng</span>
                      <span className="text-primary">{formatVND(total)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Mobile price bar */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t p-3 shadow-lg z-40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{booking.slotCount} slot • {booking.courtName}</p>
                  <p className="font-serif font-bold text-primary">{formatVND(total)}</p>
                </div>
                {step < 2 && (
                  <Button
                    onClick={() => {
                      if (step === 0) setStep(1)
                      else if (step === 1 && validateStep1()) setStep(2)
                    }}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    Tiếp tục
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Loading overlay */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm">
          <Card className="p-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="font-semibold">Đang xử lý thanh toán...</p>
            <p className="text-sm text-muted-foreground">Vui lòng không đóng trang này</p>
          </Card>
        </div>
      )}
    </div>
    </RouteGuard>
  )
}
