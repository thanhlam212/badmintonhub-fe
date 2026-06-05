"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  CheckCircle2, Package, Truck, Home, ShoppingCart, Copy, Receipt, ArrowRight, Printer, Download, FileText
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { formatHDReference, formatVND } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"

interface OrderData {
  id: string
  items: { productId: number; name: string; price: number; qty: number }[]
  customer: { name: string; phone: string; email: string; address: string }
  note: string
  subtotal: number
  shippingFee: number
  total: number
  paymentMethod: string
  status: string
  createdAt: string
}

const paymentLabels: Record<string, string> = {
  cod: "Thanh toán khi nhận hàng (COD)",
  sepay: "SePay",
  momo: "MoMo",
  vnpay: "VNPay",
  bank: "Chuyển khoản ngân hàng",
}

function AnimatedCheckmark() {
  return (
    <div className="flex justify-center">
      <svg width="80" height="80" viewBox="0 0 80 80" className="text-green-500">
        <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.2" />
        <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="3"
          strokeDasharray="226" strokeDashoffset="226"
          className="animate-checkmark" style={{ strokeLinecap: 'round' }} />
        <path d="M24 40 L35 51 L56 30" fill="none" stroke="currentColor" strokeWidth="3.5"
          strokeDasharray="50" strokeDashoffset="50"
          className="animate-checkmark" style={{ strokeLinecap: 'round', strokeLinejoin: 'round', animationDelay: '0.3s' }} />
      </svg>
    </div>
  )
}

function getOrderDisplayCode(order: OrderData): string {
  return formatHDReference((order as any).orderCode || (order as any).order_code || (order as any).invoiceCode || (order as any).invoice_code || order.id, order.createdAt)
}

export default function OrderSuccessPage() {
  const [order, setOrder] = useState<OrderData | null>(null)
  const [copied, setCopied] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const stored = localStorage.getItem("badmintonhub_completed_order")
    if (stored) {
      try {
        setOrder(JSON.parse(stored))
      } catch {}
    }
  }, [])

  const handleCopy = () => {
    if (order) {
      navigator.clipboard.writeText(getOrderDisplayCode(order))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    if (!order) return
    const invoiceText = [
      "====================================",
      "       HÓA ĐƠN - BADMINTONHUB",
      "====================================",
      `Mã đơn hàng: ${getOrderDisplayCode(order)}`,
      `Ngày đặt: ${new Date(order.createdAt).toLocaleString("vi-VN")}`,
      "",
      "Thông tin khách hàng:",
      `  Họ tên: ${order.customer.name}`,
      `  SĐT: ${order.customer.phone}`,
      `  Email: ${order.customer.email}`,
      `  Địa chỉ: ${order.customer.address}`,
      "",
      "------------------------------------",
      "SẢN PHẨM:",
      "------------------------------------",
      ...order.items.map(item =>
        `  ${item.name} x${item.qty} = ${formatVND(item.price * item.qty)}`
      ),
      "------------------------------------",
      `Tạm tính: ${formatVND(order.subtotal)}`,
      `Vận chuyển: ${order.shippingFee === 0 ? "Miễn phí" : formatVND(order.shippingFee)}`,
      `Thanh toán: ${paymentLabels[order.paymentMethod] || order.paymentMethod}`,
      "====================================",
      `TỔNG CỘNG: ${formatVND(order.total)}`,
      "====================================",
      "",
      order.note ? `Ghi chú: ${order.note}` : "",
      "",
      "Cảm ơn bạn đã mua hàng tại BadmintonHub!",
    ].filter(Boolean).join("\n")

    const blob = new Blob([invoiceText], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `hoa-don-${getOrderDisplayCode(order)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const data = order
  const displayOrderCode = data ? getOrderDisplayCode(data) : ""

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="mx-auto max-w-2xl px-4">
          {/* Checkmark */}
          <div className="animate-fade-in-up opacity-0" style={{ animationFillMode: 'forwards' }}>
            <AnimatedCheckmark />
          </div>

          {/* Confetti */}
          <div className="flex justify-center gap-3 mt-4 animate-fade-in-up opacity-0 stagger-1" style={{ animationFillMode: 'forwards' }}>
            {["🛍️", "✨", "🎉", "✨", "🏸"].map((c, i) => (
              <span key={i} className="text-2xl">{c}</span>
            ))}
          </div>

          {/* Title */}
          <div className="text-center mt-4 animate-fade-in-up opacity-0 stagger-2" style={{ animationFillMode: 'forwards' }}>
            <h1 className="font-serif text-2xl font-extrabold text-foreground lg:text-3xl">Đặt hàng thành công!</h1>
            {data && (
              <div className="mt-2 flex items-center justify-center gap-2">
                <p className="text-muted-foreground">
                  Mã đơn hàng: <span className="font-mono font-bold text-primary">{displayOrderCode}</span>
                </p>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  title="Sao chép mã đơn"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
            )}
          </div>

          {data && (
            <>
              {/* Order Status Timeline */}
              <div className="mt-8 animate-fade-in-up opacity-0 stagger-3" style={{ animationFillMode: 'forwards' }}>
                <div className="flex items-center justify-between max-w-sm mx-auto">
                  {[
                    { icon: <CheckCircle2 className="h-5 w-5" />, label: "Đặt hàng", active: true },
                    { icon: <Package className="h-5 w-5" />, label: "Xử lý", active: false },
                    { icon: <Truck className="h-5 w-5" />, label: "Giao hàng", active: false },
                  ].map((step, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        step.active ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
                      }`}>
                        {step.icon}
                      </div>
                      <span className={`text-xs font-medium ${step.active ? "text-green-700" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invoice Card */}
              <Card className="mt-8 border-2 border-dashed border-primary/30 animate-fade-in-up opacity-0 stagger-4" style={{ animationFillMode: 'forwards' }}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-serif text-lg flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-primary" /> Hóa đơn đơn hàng
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1 text-xs print:hidden" onClick={handlePrint}>
                        <Printer className="h-3.5 w-3.5" /> In
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1 text-xs print:hidden" onClick={handleDownload}>
                        <Download className="h-3.5 w-3.5" /> Tải về
                      </Button>
                      <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                        Chờ xử lý
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Header */}
                  <div className="flex justify-between items-start text-sm">
                    <div>
                      <p className="font-bold text-primary text-base">BADMINTONHUB</p>
                      <p className="text-muted-foreground text-xs mt-0.5">Cửa hàng phụ kiện cầu lông</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Mã đơn hàng</p>
                      <p className="font-mono font-bold text-primary">{displayOrderCode}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(data.createdAt).toLocaleString("vi-VN")}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Customer */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Thông tin nhận hàng</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Họ tên</p>
                        <p className="font-semibold">{data.customer.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">SĐT</p>
                        <p className="font-semibold">{data.customer.phone}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">Địa chỉ</p>
                        <p className="font-semibold">{data.customer.address}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Items */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sản phẩm</p>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left py-2 px-3 font-semibold text-xs">Sản phẩm</th>
                            <th className="text-center py-2 px-3 font-semibold text-xs">SL</th>
                            <th className="text-right py-2 px-3 font-semibold text-xs">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.items.map(item => (
                            <tr key={item.productId} className="border-t">
                              <td className="py-2 px-3">{item.name}</td>
                              <td className="py-2 px-3 text-center">{item.qty}</td>
                              <td className="py-2 px-3 text-right font-semibold">{formatVND(item.price * item.qty)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <Separator />

                  {/* Totals */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tạm tính</span>
                      <span>{formatVND(data.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phí vận chuyển</span>
                      <span>{data.shippingFee === 0 ? "Miễn phí" : formatVND(data.shippingFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Thanh toán</span>
                      <span>{paymentLabels[data.paymentMethod] || data.paymentMethod}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-bold text-base">Tổng cộng</span>
                      <span className="font-bold text-lg text-primary">{formatVND(data.total)}</span>
                    </div>
                  </div>

                  {data.note && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground">Ghi chú: {data.note}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Info note */}
              <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200 animate-fade-in-up opacity-0 stagger-5" style={{ animationFillMode: 'forwards' }}>
                <div className="flex items-start gap-3">
                  <Truck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-blue-800">Đơn hàng sẽ được xử lý trong 1-2 giờ</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Nhân viên sẽ nhận mã đơn <strong>{displayOrderCode}</strong>, xuất kho và gửi giao vận tới địa chỉ của bạn.
                      Thời gian giao hàng dự kiến 2-5 ngày làm việc.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3 animate-fade-in-up opacity-0 stagger-6" style={{ animationFillMode: 'forwards' }}>
            <Link href="/shop" className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <ShoppingCart className="h-4 w-4" /> Tiếp tục mua sắm
              </Button>
            </Link>
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <Home className="h-4 w-4" /> Trang chủ
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
