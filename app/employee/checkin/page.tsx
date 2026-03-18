"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  QrCode, Camera, CheckCircle2, XCircle, AlertCircle,
  User, MapPin, Clock, RefreshCw, Keyboard, ArrowLeft
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import { formatVND } from "@/lib/utils"
import Link from "next/link"

// ─── Types ───────────────────────────────────────────────
type ScanStatus = "idle" | "scanning" | "loading" | "success" | "error"

interface CheckinResult {
  customerName: string
  customerPhone: string
  courtName: string
  branchName: string
  bookingDate: string
  timeStart: string
  timeEnd: string
  amount: number
  status: string
}

// ─── QR Scanner Hook using jsQR ──────────────────────────
function useQRScanner(onResult: (data: string) => void, active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const [cameraError, setCameraError] = useState("")
  const [ready, setReady] = useState(false)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    cancelAnimationFrame(rafRef.current)
    setReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setReady(true)
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") setCameraError("Bạn cần cấp quyền camera để quét QR")
      else if (err.name === "NotFoundError") setCameraError("Không tìm thấy camera")
      else setCameraError("Không thể mở camera: " + err.message)
    }
  }, [])

  // Scan loop
  useEffect(() => {
    if (!ready || !active) return
    let jsQR: any = null

    const loadAndScan = async () => {
      try {
        const mod = await import("jsqr" as any)
        jsQR = mod.default
      } catch {
        // jsqr not available — use manual input
        return
      }

      const scan = () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState !== 4) {
          rafRef.current = requestAnimationFrame(scan)
          return
        }
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(video, 0, 0)
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(img.data, img.width, img.height)
        if (code?.data) {
          onResult(code.data)
          return
        }
        rafRef.current = requestAnimationFrame(scan)
      }
      rafRef.current = requestAnimationFrame(scan)
    }

    loadAndScan()
    return () => cancelAnimationFrame(rafRef.current)
  }, [ready, active, onResult])

  useEffect(() => {
    if (active) startCamera()
    else stopCamera()
    return stopCamera
  }, [active, startCamera, stopCamera])

  return { videoRef, canvasRef, cameraError, ready, restartCamera: startCamera }
}

// ─── Main Page ────────────────────────────────────────────
export default function CheckinPage() {
  const [mode, setMode] = useState<"camera" | "manual">("camera")
  const [status, setStatus] = useState<ScanStatus>("idle")
  const [result, setResult] = useState<CheckinResult | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [manualId, setManualId] = useState("")
  const [lastScanned, setLastScanned] = useState("")
  const [scanActive, setScanActive] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  const doCheckin = useCallback(async (bookingId: string) => {
    const id = bookingId.trim()
    if (!id || id === lastScanned) return
    setLastScanned(id)
    setScanActive(false)
    setStatus("loading")
    setResult(null)
    setErrorMsg("")

    try {
      const data = await apiFetch("/bookings/checkin", {
        method: "POST",
        body: JSON.stringify({ bookingId: id }),
      })
      setResult((data as any).booking)
      setStatus("success")
    } catch (err: any) {
      setErrorMsg(err?.message || "Check-in thất bại")
      setStatus("error")
    }
  }, [lastScanned])

  const reset = () => {
    setStatus("idle")
    setResult(null)
    setErrorMsg("")
    setManualId("")
    setLastScanned("")
    setScanActive(true)
  }

  const { videoRef, canvasRef, cameraError, ready, restartCamera } = useQRScanner(
    useCallback((data: string) => {
      // QR chứa booking UUID (hoặc URL có chứa UUID)
      const uuidMatch = data.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      if (uuidMatch) doCheckin(uuidMatch[0])
    }, [doCheckin]),
    mode === "camera" && scanActive && status === "idle"
  )

  return (
    <div
      className="min-h-screen bg-background transition-all duration-500"
      style={{ opacity: mounted ? 1 : 0 }}
    >
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-lg px-4 py-4 flex items-center gap-3">
          <Link href="/employee">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif font-bold text-lg">Check-in sân</h1>
            <p className="text-xs text-muted-foreground">Quét mã QR của khách để xác nhận vào sân</p>
          </div>
          <Badge variant="outline" className="ml-auto text-xs">
            {mode === "camera" ? "📷 Camera" : "⌨️ Thủ công"}
          </Badge>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">

        {/* Mode toggle */}
        <div className="flex rounded-xl border overflow-hidden">
          <button
            onClick={() => { setMode("camera"); reset() }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all duration-200",
              mode === "camera" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Camera className="h-4 w-4" /> Quét QR
          </button>
          <button
            onClick={() => { setMode("manual"); reset() }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all duration-200",
              mode === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Keyboard className="h-4 w-4" /> Nhập mã
          </button>
        </div>

        {/* Camera scanner */}
        {mode === "camera" && (
          <Card className="overflow-hidden">
            <div className="relative aspect-square bg-black">
              {/* Video */}
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Scanning overlay */}
              {status === "idle" && ready && (
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Corner markers */}
                  <div className="relative w-56 h-56">
                    {[
                      "top-0 left-0 border-t-4 border-l-4 rounded-tl-lg",
                      "top-0 right-0 border-t-4 border-r-4 rounded-tr-lg",
                      "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg",
                      "bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg",
                    ].map((cls, i) => (
                      <div key={i} className={`absolute w-8 h-8 border-primary ${cls}`} />
                    ))}
                    {/* Scan line */}
                    <div className="absolute inset-x-0 h-0.5 bg-primary/70 shadow-[0_0_8px_2px_rgba(var(--primary),0.5)] animate-[scan_2s_ease-in-out_infinite]"
                      style={{ animation: "scanline 2s ease-in-out infinite" }}
                    />
                  </div>
                  <p className="absolute bottom-4 text-white/60 text-xs text-center px-4">
                    Đưa mã QR vào khung để quét tự động
                  </p>
                </div>
              )}

              {/* Camera error */}
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
                  <Camera className="h-12 w-12 text-white/30 mb-3" />
                  <p className="text-white text-sm mb-4">{cameraError}</p>
                  <Button onClick={restartCamera} variant="outline" size="sm" className="text-white border-white/30">
                    <RefreshCw className="h-4 w-4 mr-2" /> Thử lại
                  </Button>
                </div>
              )}

              {/* Loading */}
              {status === "loading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                  <div className="h-10 w-10 rounded-full border-4 border-white/20 border-t-white animate-spin mb-3" />
                  <p className="text-white text-sm">Đang xác nhận...</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Manual input */}
        {mode === "manual" && (status === "idle" || status === "loading") && (
         <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <QrCode className="h-10 w-10 shrink-0 text-primary/40" />
                <p className="text-sm">Nhập mã booking (UUID) từ email xác nhận của khách</p>
              </div>
              <Input
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={manualId}
                onChange={e => setManualId(e.target.value)}
                className="font-mono text-sm h-11"
                autoFocus
                onKeyDown={e => e.key === "Enter" && doCheckin(manualId)}
              />
              <Button
                onClick={() => doCheckin(manualId)}
                disabled={!manualId.trim() || status === "loading"}
                className="w-full h-11 font-semibold gap-2"
              >
                {status === "loading" ? (
                  <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Đang xác nhận...</>
                ) : (
                  <><CheckCircle2 className="h-5 w-5" /> Check-in</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Success result */}
        {status === "success" && result && (
          <div className="space-y-3 transition-all duration-400">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300 text-lg">Check-in thành công!</p>
                <p className="text-sm text-green-700/70 dark:text-green-400/70">Khách đã được xác nhận vào sân</p>
              </div>
            </div>

            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-serif font-bold text-lg">{result.customerName}</p>
                    <p className="text-sm text-muted-foreground">{result.customerPhone}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30">
                    Đang chơi
                  </Badge>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <QrCode className="h-4 w-4 shrink-0 text-primary" />
                    <span className="font-medium text-foreground">{result.courtName}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                    <span>{result.branchName}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0 text-primary" />
                    <span>
                      {new Date(result.bookingDate).toLocaleDateString("vi-VN")}
                      {" • "}
                      <strong className="text-foreground">{result.timeStart} – {result.timeEnd}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <User className="h-4 w-4 shrink-0 text-primary" />
                    <span>Đã thanh toán <strong className="text-foreground">{formatVND(Number(result.amount))}</strong></span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={reset} className="w-full h-11 gap-2 font-semibold">
              <QrCode className="h-5 w-5" /> Quét tiếp
            </Button>
          </div>
        )}

        {/* Error result */}
        {status === "error" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <XCircle className="h-8 w-8 text-red-500 shrink-0" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-400">Check-in thất bại</p>
                <p className="text-sm text-red-600/80 dark:text-red-400/70 mt-0.5">{errorMsg}</p>
              </div>
            </div>
            <Button onClick={reset} variant="outline" className="w-full h-11 gap-2 font-semibold">
              <RefreshCw className="h-4 w-4" /> Thử lại
            </Button>
          </div>
        )}

        {/* Info box */}
        {status === "idle" && (
          <div className="flex gap-2.5 p-3 rounded-xl bg-muted/50 border text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-primary/60" />
            <div className="space-y-1">
              <p>QR code được gửi qua email khi khách đặt sân thành công.</p>
              <p>Check-in chỉ hợp lệ trong ngày và từ 30 phút trước giờ chơi.</p>
            </div>
          </div>
        )}
      </div>

      {/* Scan line CSS animation */}
      <style>{`
        @keyframes scanline {
          0%   { top: 8px;   opacity: 1; }
          50%  { top: calc(100% - 8px); opacity: 0.8; }
          100% { top: 8px;   opacity: 1; }
        }
      `}</style>
    </div>
  )
}