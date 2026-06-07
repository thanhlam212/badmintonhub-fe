"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

function MoMoReturnContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading")
  const [message, setMessage] = useState("")
  const [amount, setAmount] = useState<number | null>(null)

  useEffect(() => {
    const resultCode = searchParams.get("resultCode")
    const amountRaw  = searchParams.get("amount")
    const msg        = searchParams.get("message")

    if (amountRaw) setAmount(parseInt(amountRaw))

    if (resultCode === "0") {
      setStatus("success")
      setMessage("Thanh toán MoMo thành công!")
    } else {
      setStatus("failed")
      setMessage(msg ? decodeURIComponent(msg) : "Thanh toán thất bại. Vui lòng thử lại.")
    }
  }, [searchParams])

  const formatVND = (n: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n)

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Đang xử lý kết quả thanh toán...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-6 px-6 space-y-6">
          <div className="text-center">
            {status === "success" ? (
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
            )}
          </div>

          <div className="text-center space-y-1">
            <h1 className="font-serif text-xl font-bold">
              {status === "success" ? "Thanh toán thành công" : "Thanh toán thất bại"}
            </h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>

          {amount && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Số tiền</span>
                <span className="font-bold text-primary">{formatVND(amount)}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">Phương thức</span>
                <span className="font-medium">MoMo</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {status === "success" ? (
              <Button asChild className="w-full">
                <Link href="/my-bookings"><CheckCircle2 className="h-4 w-4 mr-2" /> Xem lịch đặt sân</Link>
              </Button>
            ) : (
              <Button asChild className="w-full">
                <Link href="/booking"><ArrowLeft className="h-4 w-4 mr-2" /> Thử đặt sân lại</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link href="/"><Home className="h-4 w-4 mr-2" /> Về trang chủ</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function MoMoReturnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Đang xử lý kết quả thanh toán...</p>
        </div>
      </div>
    }>
      <MoMoReturnContent />
    </Suspense>
  )
}
