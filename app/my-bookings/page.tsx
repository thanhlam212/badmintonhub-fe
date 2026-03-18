"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { BookingStatusBadge } from "@/components/shared"
import { RouteGuard } from "@/components/route-guard"
import { AddressInput } from "@/components/address-input"
import {
  Calendar, Clock, MapPin, QrCode, Star, ChevronDown, Settings, Heart,
  Gift, ShoppingBag, Award, User as UserIcon, Save, CheckCircle2,
  AlertCircle, Mail, Phone, Package, Truck, Receipt, Printer, Download,
  Copy, CalendarDays, CreditCard, Users, FileText
} from "lucide-react"
import { useState, useEffect } from "react"
import { formatVND } from "@/lib/utils"
import { bookingApi, orderApi, type ApiBooking, type ApiOrder } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"

type SidebarPage = "bookings" | "orders" | "favorites" | "rewards" | "settings"

const sidebarNavItems = [
  { icon: <Calendar className="h-4 w-4" />, label: "Lịch đặt", page: "bookings" as SidebarPage },
  { icon: <ShoppingBag className="h-4 w-4" />, label: "Đơn hàng", page: "orders" as SidebarPage },
  { icon: <Heart className="h-4 w-4" />, label: "Yêu thích", page: "favorites" as SidebarPage },
  { icon: <Gift className="h-4 w-4" />, label: "Điểm thưởng", page: "rewards" as SidebarPage },
  { icon: <Settings className="h-4 w-4" />, label: "Cài đặt", page: "settings" as SidebarPage },
]

function AccountSidebar({ activePage, onPageChange }: { activePage: SidebarPage; onPageChange: (p: SidebarPage) => void }) {
  const { user } = useAuth()
  return (
    <aside className="w-64 shrink-0 hidden lg:block">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold font-serif">
              {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <h3 className="font-serif font-bold mt-3">{user?.fullName || "Người dùng"}</h3>
            <Badge className="mt-1 bg-amber-100 text-amber-800 border-amber-200">
              <Award className="h-3 w-3 mr-1" /> Thành viên Vàng
            </Badge>
          </div>
          <nav className="mt-6 flex flex-col gap-1">
            {sidebarNavItems.map(item => (
              <button
                key={item.label}
                onClick={() => onPageChange(item.page)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-left",
                  item.page === activePage
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </CardContent>
      </Card>
    </aside>
  )
}

// ─── Booking Detail Dialog ────────────────────────────────────
function BookingDetailDialog({ booking }: { booking: ApiBooking }) {
  const dateObj = new Date(booking.bookingDate)
  const dateStr = dateObj.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })

  const paymentLabels: Record<string, string> = {
    cash: "Tiền mặt", momo: "MoMo", vnpay: "VNPay",
    bank: "Chuyển khoản", wallet: "Ví BadmintonHub",
  }

  const statusSteps = [
    { key: "pending",   label: "Chờ xác nhận" },
    { key: "confirmed", label: "Đã xác nhận" },
    { key: "playing",   label: "Đang chơi" },
    { key: "completed", label: "Hoàn thành" },
  ]
  const currentStep = statusSteps.findIndex(s => s.key === booking.status)

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-serif text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Chi tiết đặt sân
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 mt-2">
        {/* Booking ID + Status */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm text-primary font-semibold bg-primary/5 px-2 py-1 rounded">
            {booking.id}
          </span>
          <BookingStatusBadge status={booking.status} />
        </div>

        {/* Timeline — chỉ hiện khi chưa bị huỷ */}
        {booking.status !== "cancelled" && (
          <div className="flex items-center gap-1 mt-2">
            {statusSteps.map((step, i) => (
              <div key={step.key} className="flex items-center flex-1">
                <div className={cn(
                  "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0",
                  i <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {i < currentStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                {i < statusSteps.length - 1 && (
                  <div className={cn("h-0.5 flex-1 mx-1", i < currentStep ? "bg-primary" : "bg-muted")} />
                )}
              </div>
            ))}
          </div>
        )}
        {booking.status !== "cancelled" && (
          <div className="flex justify-between">
            {statusSteps.map((step, i) => (
              <span key={step.key} className={cn(
                "text-[10px] text-center flex-1",
                i <= currentStep ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            ))}
          </div>
        )}

        <Separator />

        {/* Thông tin sân */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Thông tin sân</p>
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Sân
              </span>
              <span className="font-semibold">{booking.courtName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Chi nhánh
              </span>
              <span className="font-medium">{booking.branchName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Ngày
              </span>
              <span className="font-medium">{dateStr}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Giờ chơi
              </span>
              <span className="font-semibold text-primary">{booking.timeStart} – {booking.timeEnd}</span>
            </div>
            {booking.slots && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Số người
                </span>
                <span className="font-medium">{booking.slots ?? '—'} người</span>
              </div>
            )}
          </div>
        </div>

        {/* Thanh toán */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Thanh toán</p>
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Phương thức
              </span>
              <span className="font-medium">
                {paymentLabels[booking.paymentMethod || ""] || booking.paymentMethod || "—"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="font-semibold">Tổng tiền</span>
              <span className="font-serif font-bold text-lg text-primary">{formatVND(booking.amount)}</span>
            </div>
          </div>
        </div>

        {/* Ghi chú */}
        {booking.note && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ghi chú</p>
            <p className="text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2">{booking.note}</p>
          </div>
        )}

        {/* QR Code */}
        {(booking.status === "confirmed" || booking.status === "playing") && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">QR Check-in</p>
            <div className="flex items-center gap-4 rounded-lg bg-muted p-3">
              <div className="h-20 w-20 bg-card rounded border-2 border-dashed border-border flex items-center justify-center shrink-0">
                <QrCode className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="text-sm">
                <p className="font-semibold">Xuất trình khi đến sân</p>
                <p className="text-muted-foreground text-xs mt-1">Nhân viên sẽ quét mã này để xác nhận lịch chơi của bạn</p>
              </div>
            </div>
          </div>
        )}

        {/* Ngày tạo */}
        <p className="text-xs text-muted-foreground">
          Đặt lúc: {booking.createdAt ? new Date(booking.createdAt).toLocaleString("vi-VN") : "—"}
        </p>
      </div>
    </DialogContent>
  )
}

// ─── Booking Card ─────────────────────────────────────────────
function BookingCard({ booking, onCancel }: { booking: ApiBooking; onCancel?: (id: string) => void }) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewContent, setReviewContent] = useState("")

  const dateObj = new Date(booking.bookingDate)
  const dayNum = dateObj.getDate()
  const month = `Th${dateObj.getMonth() + 1}`
  const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
  const dayName = dayNames[dateObj.getDay()]

  return (
    <Card className="hover:-translate-y-0.5 transition-all duration-200 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Date Block */}
          <div className="flex flex-col items-center justify-center rounded-lg bg-primary px-3 py-2 text-primary-foreground shrink-0 min-w-[60px]">
            <span className="text-xs font-medium">{dayName}</span>
            <span className="font-serif text-2xl font-extrabold leading-none">{dayNum}</span>
            <span className="text-xs">{month}</span>
          </div>

          {/* Center Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">{booking.courtName}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {booking.timeStart} - {booking.timeEnd}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {booking.branchName}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{booking.id}</span>
              <span className="text-sm font-semibold text-primary">{formatVND(booking.amount)}</span>
            </div>
          </div>

          {/* Right: Status & Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <BookingStatusBadge status={booking.status} />

            <div className="flex gap-1.5 flex-wrap justify-end">
              {/* ✅ Chi tiết — tất cả status đều có */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-7">Chi tiết</Button>
                </DialogTrigger>
                <BookingDetailDialog booking={booking} />
              </Dialog>

              {/* Huỷ — chỉ khi pending hoặc confirmed */}
              {(booking.status === "pending" || booking.status === "confirmed") && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs h-7 text-red-600 hover:text-red-700 border-red-200">Huỷ</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-serif">Xác nhận huỷ đặt sân?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Chính sách hoàn tiền: Huỷ trước 24h được hoàn 100%. Huỷ trước 2h được hoàn 50%. Huỷ trong vòng 2h không được hoàn tiền.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Quay lại</AlertDialogCancel>
                      <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => onCancel?.(booking.id)}>
                        Xác nhận huỷ
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Đánh giá — khi completed */}
              {booking.status === "completed" && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" className="text-xs h-7 bg-primary text-primary-foreground hover:bg-primary/90">Đánh giá</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-serif">Đánh giá trải nghiệm</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <p className="text-sm text-muted-foreground text-center">{booking.courtName}</p>
                      <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map(s => (
                          <button
                            key={s}
                            onMouseEnter={() => setHoverRating(s)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setRating(s)}
                          >
                            <Star className={cn(
                              "h-8 w-8 transition-colors",
                              (hoverRating || rating) >= s ? "fill-amber-400 text-amber-400" : "text-muted"
                            )} />
                          </button>
                        ))}
                      </div>
                      <p className="text-center text-sm text-muted-foreground">
                        {rating === 0 ? "Chọn số sao" : `Bạn đánh giá ${rating} sao`}
                      </p>
                      <Textarea
                        placeholder="Chia sẻ trải nghiệm của bạn về sân..."
                        value={reviewContent}
                        onChange={e => setReviewContent(e.target.value)}
                        rows={3}
                      />
                      <Button
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                        disabled={rating === 0}
                      >
                        Gửi đánh giá
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ───────────────────── Profile Settings ───────────────────── */
function ProfileSettingsForm() {
  const { user, updateProfile } = useAuth()
  const [fullName, setFullName] = useState(user?.fullName || "")
  const [email, setEmail] = useState(user?.email || "")
  const [phone, setPhone] = useState(user?.phone || "")
  const [address, setAddress] = useState(user?.address || "")
  const [gender, setGender] = useState<"nam" | "nữ" | "">(user?.gender || "")
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!fullName.trim()) newErrors.fullName = "Vui lòng nhập họ tên"
    if (!email.trim()) newErrors.email = "Vui lòng nhập email"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Email không hợp lệ"
    if (!phone.trim()) newErrors.phone = "Vui lòng nhập số điện thoại"
    else if (!/^0\d{9}$/.test(phone)) newErrors.phone = "Số điện thoại không hợp lệ"
    if (!address.trim()) newErrors.address = "Vui lòng nhập địa chỉ"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const result = await updateProfile({ fullName, email, phone, address, gender: gender || undefined, dateOfBirth: dateOfBirth || undefined })
    setSaving(false)
    if (result.success) {
      setSuccessMsg("Cập nhật thành công!")
      setTimeout(() => setSuccessMsg(""), 3000)
    } else {
      setErrors({ general: result.error || "Có lỗi xảy ra" })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-extrabold">Thông tin tài khoản</h1>
        <p className="text-muted-foreground mt-1">Quản lý thông tin cá nhân</p>
      </div>

      {successMsg && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm font-semibold text-green-800">{successMsg}</p>
          </CardContent>
        </Card>
      )}
      {errors.general && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm font-semibold text-red-800">{errors.general}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="font-serif text-lg flex items-center gap-2"><UserIcon className="h-5 w-5 text-primary" /> Tài khoản</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Tên đăng nhập</Label>
              <Input value={user?.username || ""} disabled className="mt-1.5 bg-muted" />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Vai trò</Label>
              <Input value={user?.role === "admin" ? "Quản trị viên" : user?.role === "employee" ? "Nhân viên" : "Người dùng"} disabled className="mt-1.5 bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-serif text-lg flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Thông tin cá nhân</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Họ tên <span className="text-red-500">*</span></Label>
              <Input value={fullName} onChange={e => { setFullName(e.target.value); setErrors(p => ({ ...p, fullName: "" })) }} className={cn("mt-1.5", errors.fullName && "border-red-500")} />
              {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
            </div>
            <div>
              <Label className="text-sm">Số điện thoại <span className="text-red-500">*</span></Label>
              <Input value={phone} onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: "" })) }} className={cn("mt-1.5", errors.phone && "border-red-500")} placeholder="0901234567" />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>
          </div>
          <div>
            <Label className="text-sm">Email <span className="text-red-500">*</span></Label>
            <Input value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: "" })) }} className={cn("mt-1.5", errors.email && "border-red-500")} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label className="text-sm">Địa chỉ <span className="text-red-500">*</span></Label>
            <AddressInput value={address} onChange={val => { setAddress(val); setErrors(p => ({ ...p, address: "" })) }} placeholder="Tìm kiếm địa chỉ..." error={errors.address} className="mt-1.5" />
            {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Giới tính</Label>
              <div className="flex gap-3 mt-1.5">
                {(["nam", "nữ"] as const).map(g => (
                  <button key={g} type="button" onClick={() => setGender(g)} className={cn(
                    "flex-1 h-10 rounded-lg border-2 text-sm font-medium transition-all",
                    gender === g ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-muted-foreground/50"
                  )}>
                    {g === "nam" ? "♂ Nam" : "♀ Nữ"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm">Ngày sinh</Label>
              <div className="relative mt-1.5">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className="pl-10" />
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2 min-w-[160px]">
              {saving ? <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang lưu...</> : <><Save className="h-4 w-4" /> Lưu thông tin</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Order History ─────────────────────────────────────────── */
const paymentLabels: Record<string, string> = { cod: "COD", momo: "MoMo", vnpay: "VNPay", bank: "Chuyển khoản" }
const orderStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: "Chờ xử lý",  color: "bg-amber-100 text-amber-800 border-amber-200",    icon: <Clock className="h-3.5 w-3.5" /> },
  processing: { label: "Đang xử lý", color: "bg-blue-100 text-blue-800 border-blue-200",       icon: <Package className="h-3.5 w-3.5" /> },
  shipping:   { label: "Đang giao",  color: "bg-purple-100 text-purple-800 border-purple-200", icon: <Truck className="h-3.5 w-3.5" /> },
  delivered:  { label: "Đã giao",    color: "bg-green-100 text-green-800 border-green-200",    icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  cancelled:  { label: "Đã hủy",     color: "bg-red-100 text-red-800 border-red-200",          icon: <AlertCircle className="h-3.5 w-3.5" /> },
}

function OrderStatusBadge({ status }: { status: string }) {
  const cfg = orderStatusConfig[status] || orderStatusConfig.pending
  return <Badge variant="outline" className={cn("gap-1", cfg.color)}>{cfg.icon} {cfg.label}</Badge>
}

function OrderHistoryView() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null)

  useEffect(() => { orderApi.getMyOrders().then(setOrders) }, [user])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-extrabold">Đơn hàng của tôi</h1>
        <p className="text-muted-foreground mt-1">Xem lại lịch sử mua hàng và hóa đơn</p>
      </div>
      {orders.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <ShoppingBag className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-serif font-bold text-lg text-muted-foreground">Chưa có đơn hàng nào</h3>
          <a href="/shop"><Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"><ShoppingBag className="h-4 w-4" /> Đi mua sắm</Button></a>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-primary">{order.id}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{new Date(order.createdAt).toLocaleString("vi-VN")}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {order.items.map(i => `${i.productName} x${i.quantity}`).join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-serif font-bold text-primary text-lg">{formatVND(order.amount)}</p>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => setSelectedOrder(order)}>
                          <Receipt className="h-4 w-4" /> Xem hóa đơn
                        </Button>
                      </DialogTrigger>
                      {selectedOrder?.id === order.id && (
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle className="font-serif">Hóa đơn #{order.id}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Trạng thái</span>
                              <OrderStatusBadge status={order.status} />
                            </div>
                            <Separator />
                            {order.items.map(item => (
                              <div key={item.productId} className="flex justify-between">
                                <span>{item.productName} x{item.quantity}</span>
                                <span className="font-medium">{formatVND(item.price * item.quantity)}</span>
                              </div>
                            ))}
                            <Separator />
                            <div className="flex justify-between font-bold text-base">
                              <span>Tổng cộng</span>
                              <span className="text-primary">{formatVND(order.amount)}</span>
                            </div>
                          </div>
                        </DialogContent>
                      )}
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function MyBookingsPage() {
  const { user } = useAuth()
  const [activePage, setActivePage] = useState<SidebarPage>("bookings")
  const [allBookings, setAllBookings] = useState<ApiBooking[]>([])

  useEffect(() => {
    if (user && user.role !== "guest") {
      bookingApi.getMyBookings().then(setAllBookings)
    }
  }, [user])

  const handleCancel = async (bookingId: string) => {
    const result = await bookingApi.cancel(bookingId)
    if (result.success) {
      setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: "cancelled" } : b))
    }
  }

  const upcoming  = allBookings.filter(b => ["confirmed", "pending", "playing"].includes(b.status))
  const completed = allBookings.filter(b => b.status === "completed")
  const cancelled = allBookings.filter(b => b.status === "cancelled")

  if (user?.role === "guest") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h2 className="font-serif text-xl font-bold">Vui lòng đăng nhập</h2>
              <p className="text-sm text-muted-foreground mt-2">Đăng nhập để xem lịch sử đặt sân của bạn</p>
              <div className="flex gap-3 mt-6">
                <a href="/login" className="flex-1"><Button variant="outline" className="w-full">Đăng nhập</Button></a>
                <a href="/register" className="flex-1"><Button className="w-full bg-primary text-primary-foreground">Đăng ký</Button></a>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <RouteGuard>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6">
            <div className="flex gap-6">
              <AccountSidebar activePage={activePage} onPageChange={setActivePage} />
              <div className="flex-1 min-w-0">
                {activePage === "bookings" ? (
                  <>
                    <h1 className="font-serif text-2xl font-extrabold">Lịch đặt của tôi</h1>
                    <Tabs defaultValue="upcoming" className="mt-6">
                      <TabsList>
                        <TabsTrigger value="upcoming">Sắp tới ({upcoming.length})</TabsTrigger>
                        <TabsTrigger value="completed">Hoàn thành ({completed.length})</TabsTrigger>
                        <TabsTrigger value="cancelled">Đã huỷ ({cancelled.length})</TabsTrigger>
                      </TabsList>

                      <TabsContent value="upcoming" className="mt-4 flex flex-col gap-4">
                        {upcoming.length === 0
                          ? <Card><CardContent className="p-8 text-center text-muted-foreground">
                              <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                              <p className="font-semibold text-foreground">Chưa có lịch sắp tới</p>
                              <p className="text-sm mt-1">Hãy <a href="/courts" className="text-primary underline">đặt sân</a> để bắt đầu!</p>
                            </CardContent></Card>
                          : upcoming.map(b => <BookingCard key={b.id} booking={b} onCancel={handleCancel} />)
                        }
                      </TabsContent>

                      <TabsContent value="completed" className="mt-4 flex flex-col gap-4">
                        {completed.length === 0
                          ? <Card><CardContent className="p-8 text-center text-muted-foreground">
                              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                              <p className="font-semibold text-foreground">Chưa có lịch hoàn thành</p>
                            </CardContent></Card>
                          : completed.map(b => <BookingCard key={b.id} booking={b} />)
                        }
                      </TabsContent>

                      <TabsContent value="cancelled" className="mt-4 flex flex-col gap-4">
                        {cancelled.length === 0
                          ? <Card><CardContent className="p-8 text-center text-muted-foreground">
                              <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                              <p className="font-semibold text-foreground">Chưa có lịch đã huỷ</p>
                            </CardContent></Card>
                          : cancelled.map(b => <BookingCard key={b.id} booking={b} />)
                        }
                      </TabsContent>
                    </Tabs>
                  </>
                ) : activePage === "orders" ? <OrderHistoryView />
                  : activePage === "favorites" ? (
                    <div>
                      <h1 className="font-serif text-2xl font-extrabold">Yêu thích</h1>
                      <Card className="mt-6"><CardContent className="p-8 text-center text-muted-foreground">
                        <Heart className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                        <p className="font-semibold text-foreground">Chưa có mục yêu thích</p>
                      </CardContent></Card>
                    </div>
                  ) : activePage === "rewards" ? (
                    <div>
                      <h1 className="font-serif text-2xl font-extrabold">Điểm thưởng</h1>
                      <Card className="mt-6"><CardContent className="p-8 text-center text-muted-foreground">
                        <Gift className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                        <p className="font-semibold text-foreground">0 điểm</p>
                        <p className="text-sm mt-1">Đặt sân và mua hàng để tích luỹ điểm thưởng.</p>
                      </CardContent></Card>
                    </div>
                  ) : <ProfileSettingsForm />
                }
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  )
}