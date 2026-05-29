"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { bookingApi, type ApiBooking } from "@/lib/api"
import { formatBookingReference, formatVND } from "@/lib/utils"
import { cn } from "@/lib/utils"
import {
  QrCode, Camera, CameraOff, CheckCircle2, XCircle, Clock,
  Search, Loader2, User, MapPin, CalendarDays,
  ScanLine, History
} from "lucide-react"

type CheckinResult = {
  success: boolean
  message: string
  booking?: ApiBooking
  timestamp: Date
}

export default function AdminCheckinPage() {
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckinResult | null>(null)
  const [history, setHistory] = useState<CheckinResult[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Start QR scanner
  const startScanner = useCallback(async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode")

      // Stop existing scanner
      if (scannerRef.current) {
        try { await scannerRef.current.stop() } catch {}
        scannerRef.current = null
      }

      const scanner = new Html5Qrcode("qr-reader")
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1,
        },
        async (decodedText: string) => {
          // Pause scanning during processing
          try { await scanner.pause() } catch {}
          await handleQRResult(decodedText)
          // Resume after delay
          setTimeout(async () => {
            try { await scanner.resume() } catch {}
          }, 3000)
        },
        () => {} // ignore errors
      )
      setScanning(true)
    } catch (err) {
      console.error("Scanner error:", err)
      setResult({ success: false, message: "Không thể truy cập camera. Hãy cấp quyền camera.", timestamp: new Date() })
    }
  }, [])

  // Stop QR scanner
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      scannerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    // Clear html5-qrcode injected DOM to avoid stale video elements
    const el = document.getElementById('qr-reader')
    if (el) el.innerHTML = ''
    setScanning(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopScanner() }
  }, [stopScanner])

  // Handle QR scan result
  const handleQRResult = async (data: string) => {
    setLoading(true)
    try {
      let parsed: any = {}
      try {
        parsed = JSON.parse(data)
      } catch {
        // If not JSON, treat as booking code
        parsed = { bookingCode: data }
      }

      const res = await bookingApi.checkin({
        bookingId: parsed.bookingId,
        bookingCode: parsed.bookingCode,
      })

      const entry: CheckinResult = {
        success: res.success,
        message: res.success ? (res.message || "Check-in thành công!") : (res.error || "Check-in thất bại"),
        booking: res.booking,
        timestamp: new Date(),
      }
      setResult(entry)
      setHistory(prev => [entry, ...prev].slice(0, 50))

    } catch {
      const entry: CheckinResult = { success: false, message: "Lỗi kết nối server", timestamp: new Date() }
      setResult(entry)
      setHistory(prev => [entry, ...prev].slice(0, 50))
    }
    setLoading(false)
  }

  // Manual check-in
  const handleManualCheckin = async () => {
    if (!manualCode.trim()) return
    setLoading(true)
    try {
      const res = await bookingApi.checkin({ bookingCode: manualCode.trim() })
      const entry: CheckinResult = {
        success: res.success,
        message: res.success ? (res.message || "Check-in thành công!") : (res.error || "Mã booking không hợp lệ"),
        booking: res.booking,
        timestamp: new Date(),
      }
      setResult(entry)
      setHistory(prev => [entry, ...prev].slice(0, 50))
      if (res.success) setManualCode("")
    } catch {
      setResult({ success: false, message: "Lỗi kết nối server", timestamp: new Date() })
    }
    setLoading(false)
  }

  // Stats
  const todayCheckins = history.filter(h => h.success).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">QR Check-in</h1>
          <p className="text-sm text-muted-foreground mt-1">Quét mã QR hoặc nhập mã booking để check-in</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            Hôm nay: {todayCheckins} check-in
          </Badge>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowHistory(!showHistory)}>
            <History className="h-4 w-4" /> Lịch sử
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* LEFT: Scanner */}
        <div className="space-y-4">
          {/* QR Scanner Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Camera className="h-5 w-5" /> Quét mã QR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Scanner div — html5-qrcode manages its children directly, never put React children here */}
                <div
                  id="qr-reader"
                  className={cn(
                    "w-full aspect-square max-w-[400px] mx-auto rounded-xl overflow-hidden bg-black/5 border-2 border-dashed",
                    scanning ? "border-primary" : "border-muted-foreground/20"
                  )}
                />

                {/* Placeholder overlay — shown only when scanner is off */}
                {!scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3 pointer-events-none">
                    <QrCode className="h-16 w-16 opacity-30" />
                    <p className="text-sm">Nhấn nút bên dưới để bật camera</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                {!scanning ? (
                  <Button className="flex-1 gap-2" onClick={startScanner}>
                    <Camera className="h-4 w-4" /> Bật Camera
                  </Button>
                ) : (
                  <Button variant="destructive" className="flex-1 gap-2" onClick={stopScanner}>
                    <CameraOff className="h-4 w-4" /> Tắt Camera
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Manual Input Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Search className="h-5 w-5" /> Check-in thủ công
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Nhập mã booking (VD: MB-040326-0600-KH00101)"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleManualCheckin()}
                  className="font-mono"
                />
                <Button onClick={handleManualCheckin} disabled={loading || !manualCode.trim()} className="gap-1.5 shrink-0">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Check-in
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Result */}
        <div className="space-y-4">
          {/* Result Card */}
          <Card className={cn(
            "transition-all duration-300",
            result?.success && "border-green-500/50 bg-green-50/50 dark:bg-green-950/10",
            result && !result.success && "border-red-500/50 bg-red-50/50 dark:bg-red-950/10",
          )}>
            <CardContent className="p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Đang xử lý check-in...</p>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  {/* Status Icon */}
                  <div className="flex flex-col items-center gap-2">
                    {result.success ? (
                      <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <XCircle className="h-10 w-10 text-red-600" />
                      </div>
                    )}
                    <h3 className={cn(
                      "font-serif text-xl font-bold",
                      result.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                    )}>
                      {result.message}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {result.timestamp.toLocaleTimeString("vi-VN")}
                    </p>
                  </div>

                  {/* Booking Details */}
                  {result.booking && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <QrCode className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Mã booking:</span>
                          <span className="font-mono font-semibold">{formatBookingReference(result.booking.bookingCode || result.booking.id, result.booking.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Khách hàng:</span>
                          <span className="font-semibold">{result.booking.customerName}</span>
                          <span className="text-muted-foreground">({result.booking.customerPhone})</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Sân:</span>
                          <span className="font-semibold">{result.booking.courtName}</span>
                          <span className="text-muted-foreground">- {result.booking.branchName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Ngày:</span>
                          <span className="font-semibold">
                            {new Date(result.booking.bookingDate).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Giờ:</span>
                          <span className="font-semibold">{result.booking.timeStart} - {result.booking.timeEnd}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground ml-6">Tiền:</span>
                          <span className="font-semibold text-primary">{formatVND(result.booking.amount)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <ScanLine className="h-16 w-16 opacity-20" />
                  <p className="text-sm">Quét mã QR hoặc nhập mã booking</p>
                  <p className="text-xs">Kết quả check-in sẽ hiển thị ở đây</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          {showHistory && history.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-lg flex items-center gap-2">
                  <History className="h-5 w-5" /> Lịch sử check-in
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg text-sm",
                      h.success ? "bg-green-50 dark:bg-green-950/10" : "bg-red-50 dark:bg-red-950/10"
                    )}>
                      {h.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {h.booking ? `${h.booking.customerName} — ${h.booking.courtName}` : h.message}
                        </p>
                        {h.booking && (
                          <p className="text-xs text-muted-foreground font-mono">{formatBookingReference(h.booking.bookingCode || h.booking.id, h.booking.createdAt)}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {h.timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
