"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { AddressInput } from "@/components/address-input"
import {
  ShoppingCart, CreditCard, Smartphone, Building2, Wallet,
  MapPin, AlertCircle, ArrowLeft, Truck, Package, Loader2, Store
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { formatVND } from "@/lib/utils"
import { branchApi, orderApi, type ApiBranch } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useCart, type CartItem } from "@/lib/cart-context"
import { findNearestWarehouse, loadBranches } from "@/lib/nearest-warehouse"

export default function CheckoutPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { cart, clearCart } = useCart()
  const [loading, setLoading] = useState(true)

  // Form state
  const [fullName, setFullName] = useState(user?.fullName || "")
  const [phone, setPhone] = useState(user?.phone || "")
  const [email, setEmail] = useState(user?.email || "")
  const [address, setAddress] = useState(user?.address || "")
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [note, setNote] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("sepay")
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("delivery")
  const [pickupBranch, setPickupBranch] = useState<number>(1) // default first branch
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submitLockRef = useRef(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [branches, setBranches] = useState<ApiBranch[]>([])

  useEffect(() => {
    branchApi.getAll().then(setBranches)
    loadBranches() // pre-load for nearest-warehouse distance calculation
  }, [])

  useEffect(() => {
    if (cart.length > 0) {
      setLoading(false)
    } else {
      // Give a moment for context to hydrate from localStorage
      const timer = setTimeout(() => {
        if (cart.length === 0) router.push("/shop")
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [cart, router])

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const shippingFee = deliveryMethod === "pickup" ? 0 : (subtotal >= 500000 ? 0 : 30000)
  const total = subtotal + shippingFee

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!fullName.trim()) newErrors.fullName = "Vui lòng nhập họ tên"
    if (!phone.trim()) newErrors.phone = "Vui lòng nhập số điện thoại"
    else if (!/^0\d{9}$/.test(phone.trim())) newErrors.phone = "Số điện thoại không hợp lệ"
    if (!email.trim()) newErrors.email = "Vui lòng nhập email"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) newErrors.email = "Email không hợp lệ"
    if (deliveryMethod === "delivery") {
      if (!address.trim()) {
        newErrors.address = "Vui lòng nhập địa chỉ giao hàng"
      } else if (!customerCoords) {
        newErrors.address = "Vui lòng chọn địa chỉ từ danh sách gợi ý hoặc dùng vị trí hiện tại để xác định kho gần nhất"
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (submitLockRef.current) return
    if (!validate()) return
    submitLockRef.current = true
    setSubmitting(true)

    try {
      const selectedBranch = deliveryMethod === "pickup"
        ? branches.find(b => b.id === pickupBranch)
        : null

      const shippingAddr = deliveryMethod === "pickup"
        ? (selectedBranch ? selectedBranch.address : "")
        : address.trim()

      const result = await orderApi.create({
        customer_name: fullName.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim(),
        shipping_address: shippingAddr,
        payment_method: paymentMethod,
        note: note.trim() || undefined,
        delivery_method: deliveryMethod,
        pickup_branch_id: deliveryMethod === "pickup" ? pickupBranch : undefined,
        customer_coords: deliveryMethod === "delivery" ? customerCoords : undefined,
        items: cart.map(item => ({
          product_id: item.productId,
          qty: item.qty,
          price: item.price,
        })),
      })

      if (result.success && result.order) {
        // Save for success page display
        localStorage.setItem("badmintonhub_completed_order", JSON.stringify({
          id: result.order.id,
          items: cart,
          customer: { name: fullName.trim(), phone: phone.trim(), email: email.trim(), address: shippingAddr },
          note: note.trim(),
          subtotal,
          shippingFee,
          total,
          paymentMethod,
          status: result.order.status,
          createdAt: result.order.createdAt,
        }))

        clearCart()
        setTimeout(() => {
          router.push("/shop/order-success")
        }, 1500)
      } else {
        alert(result.error || "Đặt hàng thất bại. Vui lòng thử lại.")
        submitLockRef.current = false
        setSubmitting(false)
      }
    } catch {
      alert("Lỗi kết nối server. Vui lòng thử lại.")
      submitLockRef.current = false
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/shop">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-serif text-2xl font-extrabold text-foreground lg:text-3xl">Thanh toán</h1>
              <p className="text-muted-foreground mt-0.5">Hoàn tất đơn hàng của bạn</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
            {/* Left: Form */}
            <div className="flex flex-col gap-6">
              {/* Delivery Method */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" /> Phương thức nhận hàng
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={deliveryMethod}
                    onValueChange={(v) => setDeliveryMethod(v as "delivery" | "pickup")}
                    className="flex flex-col gap-3"
                  >
                    <label className={cn(
                      "flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors",
                      deliveryMethod === "delivery" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                    )}>
                      <RadioGroupItem value="delivery" />
                      <Truck className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Giao hàng tận nơi</p>
                        <p className="text-xs text-muted-foreground">Đơn hàng sẽ được giao đến địa chỉ của bạn trong 2-5 ngày</p>
                      </div>
                    </label>
                    <label className={cn(
                      "flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors",
                      deliveryMethod === "pickup" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                    )}>
                      <RadioGroupItem value="pickup" />
                      <Store className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">Nhận tại cửa hàng</p>
                        <p className="text-xs text-muted-foreground">Đến nhận trực tiếp tại chi nhánh — Miễn phí vận chuyển</p>
                      </div>
                    </label>
                  </RadioGroup>

                  {/* Pickup branch selector */}
                  {deliveryMethod === "pickup" && (
                    <div className="mt-4 space-y-3">
                      <Label className="text-sm font-semibold">Chọn chi nhánh nhận hàng</Label>
                      <RadioGroup
                        value={String(pickupBranch)}
                        onValueChange={(v) => setPickupBranch(Number(v))}
                        className="flex flex-col gap-2"
                      >
                        {branches.map(b => (
                          <label key={b.id} className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                            pickupBranch === b.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                          )}>
                            <RadioGroupItem value={String(b.id)} className="mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold">{b.name}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3" /> {b.address}
                              </p>
                            </div>
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Shipping Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" /> Thông tin {deliveryMethod === "delivery" ? "giao hàng" : "liên hệ"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Họ tên <span className="text-red-500">*</span></Label>
                      <Input
                        value={fullName}
                        onChange={(e) => { setFullName(e.target.value); setErrors(p => ({ ...p, fullName: "" })) }}
                        placeholder="Nguyễn Văn A"
                        className={cn("mt-1.5", errors.fullName && "border-red-500")}
                      />
                      {errors.fullName && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.fullName}</p>}
                    </div>
                    <div>
                      <Label className="text-sm">Số điện thoại <span className="text-red-500">*</span></Label>
                      <Input
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: "" })) }}
                        placeholder="0901234567"
                        className={cn("mt-1.5", errors.phone && "border-red-500")}
                      />
                      {errors.phone && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.phone}</p>}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Email <span className="text-red-500">*</span></Label>
                    <Input
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: "" })) }}
                      placeholder="email@example.com"
                      className={cn("mt-1.5", errors.email && "border-red-500")}
                    />
                    {errors.email && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.email}</p>}
                  </div>
                  {deliveryMethod === "delivery" && (
                    <div>
                      <Label className="text-sm">Địa chỉ giao hàng <span className="text-red-500">*</span></Label>
                      <div className="mt-1.5">
                        <AddressInput
                          value={address}
                          onChange={(val, coords) => { 
                            setAddress(val)
                            if (coords) setCustomerCoords(coords)
                            setErrors(p => ({ ...p, address: "" }))
                          }}
                          placeholder="Tìm kiếm địa chỉ giao hàng..."
                          error={errors.address}
                          compact
                        />
                      </div>
                      {errors.address && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.address}</p>}
                      {customerCoords && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Đơn sẽ được xử lý bởi kho gần bạn nhất: <strong>{findNearestWarehouse(customerCoords.lat, customerCoords.lng).warehouseName}</strong>
                          {" "}({findNearestWarehouse(customerCoords.lat, customerCoords.lng).distance.toFixed(1)} km)
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <Label className="text-sm">Ghi chú đơn hàng</Label>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao..."
                      rows={2}
                      className="mt-1.5"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Payment */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" /> Phương thức thanh toán
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="flex flex-col gap-3">
                    {[
                      { value: "sepay", label: "SePay", icon: <Building2 className="h-5 w-5" />, desc: "Thanh toan qua SePay / VietQR" },
                      { value: "cod", label: "Thanh toán khi nhận hàng (COD)", icon: <Truck className="h-5 w-5" />, desc: "Trả tiền mặt khi nhận hàng" },
                      { value: "momo", label: "MoMo", icon: <Smartphone className="h-5 w-5" />, desc: "Ví điện tử MoMo" },
                      { value: "vnpay", label: "VNPay", icon: <CreditCard className="h-5 w-5" />, desc: "Thanh toán qua VNPay" },
                      { value: "bank", label: "Chuyển khoản ngân hàng", icon: <Building2 className="h-5 w-5" />, desc: "Chuyển khoản trực tiếp" },
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

                  {paymentMethod === "bank" && (
                    <div className="mt-4 p-4 rounded-lg bg-muted text-sm space-y-1">
                      <p className="font-semibold">Thông tin chuyển khoản:</p>
                      <p>Ngân hàng: Vietcombank</p>
                      <p>STK: 1234567890</p>
                      <p>Chủ TK: CÔNG TY TNHH BADMINTONHUB</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Agreement */}
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  Tôi đồng ý với{" "}
                  <span className="text-primary underline cursor-pointer">điều khoản mua hàng</span> và{" "}
                  <span className="text-primary underline cursor-pointer">chính sách đổi trả</span> của BadmintonHub
                </span>
              </label>
            </div>

            {/* Right: Order Summary */}
            <div className="flex flex-col gap-6">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" /> Tóm tắt đơn hàng
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Cart items */}
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.productId} className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                          <p className="text-xs text-muted-foreground">SL: {item.qty}</p>
                        </div>
                        <p className="text-sm font-semibold">{formatVND(item.price * item.qty)}</p>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Pricing */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tạm tính ({cart.reduce((s, i) => s + i.qty, 0)} sản phẩm)</span>
                      <span>{formatVND(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phí vận chuyển</span>
                      {shippingFee === 0 ? (
                        <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-xs">
                          {deliveryMethod === "pickup" ? "Nhận tại cửa hàng" : "Miễn phí"}
                        </Badge>
                      ) : (
                        <span>{formatVND(shippingFee)}</span>
                      )}
                    </div>
                    {deliveryMethod === "delivery" && shippingFee > 0 && (
                      <p className="text-xs text-muted-foreground">Miễn phí vận chuyển cho đơn từ {formatVND(500000)}</p>
                    )}
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <span className="font-serif font-bold text-lg">Tổng cộng</span>
                    <span className="font-serif font-bold text-xl text-primary">{formatVND(total)}</span>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={!agreed || submitting}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2 h-12 text-base"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5" />
                        Đặt hàng — {formatVND(total)}
                      </>
                    )}
                  </Button>

                  <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                    {deliveryMethod === "delivery" ? (
                      <>
                        <Truck className="h-3.5 w-3.5" />
                        <span>Giao hàng trong 2-5 ngày làm việc</span>
                      </>
                    ) : (
                      <>
                        <Store className="h-3.5 w-3.5" />
                        <span>Sẵn sàng nhận hàng trong 1-2 ngày</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
