"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Star, MapPin, Clock, ChevronLeft, ChevronRight, Check, Wifi, Wind, Lamp, TreePine, Camera, Dumbbell, Lock, Users, Route, Loader2, Navigation2, Sun, CloudRain, Thermometer, Droplets, Eye, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useMemo, use, useCallback, useEffect, useRef } from "react"
import { formatVND, generateTimeSlots, getWeekDays, WEATHER_API_KEY } from "@/lib/utils"
import { courtApi, type ApiCourt } from "@/lib/api"
import { cn } from "@/lib/utils"
import { AddressInput } from "@/components/address-input"
import { useAuth } from "@/lib/auth-context"
import { TOMTOM_API_KEY } from "@/lib/tomtom"
import dynamic from "next/dynamic"

const TomTomMap = dynamic<{ lat: number; lng: number; courtLat?: number; courtLng?: number; courtName?: string; routeCoords?: [number, number][]; hideUserMarker?: boolean }>(
  () => import("@/components/tomtom-map"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-muted rounded-xl">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

const amenityIcons: Record<string, React.ReactNode> = {
  "Điều hòa": <Wind className="h-5 w-5" />,
  "Đèn LED": <Lamp className="h-5 w-5" />,
  "Sàn gỗ": <TreePine className="h-5 w-5" />,
  "Wi-Fi": <Wifi className="h-5 w-5" />,
  "Nước uống": <Dumbbell className="h-5 w-5" />,
  "Ghế nghỉ": <Users className="h-5 w-5" />,
  "Phòng thay đồ": <Lock className="h-5 w-5" />,
  "Camera": <Camera className="h-5 w-5" />,
  "Máy phát bóng": <Dumbbell className="h-5 w-5" />,
  "Sàn nhựa": <TreePine className="h-5 w-5" />,
  "Sàn bê tông": <TreePine className="h-5 w-5" />,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WeatherWidget({ weatherData }: { weatherData: any }) {
  if (!weatherData) return null
  const current = weatherData.current
  const forecast = weatherData.forecast?.forecastday || []

  return (
    <Card className="border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <Sun className="h-5 w-5 text-orange-500" />
          Thời tiết tại sân ngoài trời
        </CardTitle>
        <p className="text-sm text-muted-foreground">Xem dự báo để lên kế hoạch chơi cầu lông</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current weather */}
        <div className="flex items-center gap-4 rounded-xl bg-white/60 dark:bg-white/5 p-4">
          <img
            src={`https:${current.condition.icon}`}
            alt={current.condition.text}
            className="h-16 w-16"
          />
          <div className="flex-1">
            <p className="text-3xl font-bold text-foreground">{current.temp_c}°C</p>
            <p className="text-sm font-medium text-muted-foreground">{current.condition.text}</p>
            <p className="text-xs text-muted-foreground">Cảm giác: {current.feelslike_c}°C</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Droplets className="h-3 w-3" /> Độ ẩm: {current.humidity}%</span>
            <span className="flex items-center gap-1"><Wind className="h-3 w-3" /> Gió: {current.wind_kph} km/h</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> UV: {current.uv}</span>
            <span className="flex items-center gap-1"><CloudRain className="h-3 w-3" /> Mây: {current.cloud}%</span>
          </div>
        </div>

        {/* Rain warning */}
        {(current.precip_mm > 0 || forecast[0]?.day?.daily_chance_of_rain > 50) && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 border border-red-200 dark:border-red-800">
            <CloudRain className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">
              Có khả năng mưa ({forecast[0]?.day?.daily_chance_of_rain || 0}%). Nên cân nhắc đặt sân trong nhà.
            </p>
          </div>
        )}

        {/* 3-day forecast */}
        <div className="grid grid-cols-3 gap-2">
          {forecast.map((day: { date: string; day: { maxtemp_c: number; mintemp_c: number; daily_chance_of_rain: number; condition: { text: string; icon: string } } }) => {
            const d = new Date(day.date)
            const dayName = d.toLocaleDateString("vi-VN", { weekday: "short" })
            const dateStr = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })

            return (
              <div key={day.date} className="flex flex-col items-center gap-1 rounded-lg bg-white/60 dark:bg-white/5 p-3 text-center">
                <p className="text-xs font-semibold text-muted-foreground">{dayName}</p>
                <p className="text-xs text-muted-foreground">{dateStr}</p>
                <img
                  src={`https:${day.day.condition.icon}`}
                  alt={day.day.condition.text}
                  className="h-10 w-10"
                />
                <div className="flex items-center gap-1 text-sm">
                  <span className="font-bold">{Math.round(day.day.maxtemp_c)}°</span>
                  <span className="text-muted-foreground">{Math.round(day.day.mintemp_c)}°</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">{day.day.condition.text}</p>
                <span className="flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                  <Droplets className="h-2.5 w-2.5" /> {day.day.daily_chance_of_rain}%
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function CourtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  // Load court from API
  const [court, setCourt] = useState<ApiCourt | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    courtApi.getById(parseInt(id)).then(c => {
      setCourt(c)
      setLoading(false)
    })
  }, [id])

  // If court is closed by admin, show blocked message
  const isClosed = court ? court.available === false : false

  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const timeSlots = generateTimeSlots()

  // Directions state — auto-fill from user's registered address
  const { user } = useAuth()
  const [userAddress, setUserAddress] = useState(user?.address || "")
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([])
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; timeMin: number } | null>(null)
  const [directionsLoading, setDirectionsLoading] = useState(false)
  const [directionsError, setDirectionsError] = useState("")
  const [autoLocating, setAutoLocating] = useState(false)
  const autoRouteTriggered = useRef(false)

  // Reset directions state when user changes (e.g. logout → guest)
  useEffect(() => {
    setUserAddress(user?.address || "")
    setUserCoords(null)
    setRouteCoords([])
    setRouteInfo(null)
    setDirectionsError("")
    autoRouteTriggered.current = false
  }, [user?.id])

  // Reviews from API
  const [reviewsList, setReviewsList] = useState<{ id: number; user_name: string; rating: number; content: string; created_at: string }[]>([])
  useEffect(() => {
    if (court) {
      courtApi.getReviews(court.id).then((data: any[]) => {
        setReviewsList(data.map((r: any) => ({
          id: r.id,
          user_name: r.user?.fullName || r.user?.username || 'Ẩn danh',
          created_at: r.createdAt || '',
          rating: r.rating,
          content: r.content,
        })))
      })
    }
  }, [court?.id])

  // Weather state for outdoor courts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [weatherData, setWeatherData] = useState<any>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)

  useEffect(() => {
    if (!court || court.indoor || !court.lat || !court.lng) return
    setWeatherLoading(true)
    fetch(`https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${court.lat},${court.lng}&days=3&lang=vi&aqi=no`)
      .then(res => res.json())
      .then(data => {
        if (data.current) setWeatherData(data)
      })
      .catch(() => {})
      .finally(() => setWeatherLoading(false))
  }, [court?.indoor, court?.lat, court?.lng])

  const startDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [weekOffset])

  const weekDays = useMemo(() => getWeekDays(startDate), [startDate])
  const weekKey = weekDays.map(d => d.label).join(',')

  // Build availability from API slots data
  const [availability, setAvailability] = useState<Record<string, Record<string, 'available' | 'booked' | 'hold'>>>({})
  useEffect(() => {
    if (!court) return
    const fetchSlots = async () => {
      const timeSlotsList = generateTimeSlots()
      const map: Record<string, Record<string, 'available' | 'booked' | 'hold'>> = {}
      weekDays.forEach(d => {
        const dayMap: Record<string, 'available' | 'booked' | 'hold'> = {}
        timeSlotsList.forEach(t => { dayMap[t] = 'available' })
        map[d.label] = dayMap
      })
      const results = await Promise.all(
        weekDays.map(d => {
          const dateStr = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}-${String(d.date.getDate()).padStart(2, '0')}`
          return courtApi.getSlots(court.id, dateStr)
        })
      )
      results.forEach((slots, idx) => {
        const dayLabel = weekDays[idx].label
        slots.forEach((s: { time: string; status: 'booked' | 'hold' }) => {
          if (map[dayLabel] && map[dayLabel][s.time]) {
            map[dayLabel][s.time] = s.status
          }
        })
      })
      setAvailability(map)
    }
    fetchSlots()
  }, [court?.id, weekKey])

  const toggleSlot = (dayLabel: string, time: string) => {
    if (isClosed) return // Block slot selection on closed courts
    const key = `${dayLabel}-${time}`
    setSelectedSlots(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    )
  }

  const totalPrice = selectedSlots.length * (court?.price || 0)

  const getBookingTimeRange = useCallback(() => {
    if (selectedSlots.length === 0) return { date: '', timeRange: '', slots: [] }

    const parsed = selectedSlots.map(s => {
      const lastDash = s.lastIndexOf('-')
      const date = s.substring(0, lastDash)
      const time = s.substring(lastDash + 1)
      return { date, time }
    }).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.time.localeCompare(b.time)
    })

    const dates = [...new Set(parsed.map(p => p.date))]
    const times = parsed.map(p => p.time).sort()
    const firstTime = times[0]
    const lastTime = times[times.length - 1]
    const lastHour = parseInt(lastTime.split(':')[0]) + 1
    const endTime = `${lastHour.toString().padStart(2, '0')}:00`

    return {
      date: dates.join(', '),
      timeRange: `${firstTime} - ${endTime}`,
      slots: selectedSlots,
    }
  }, [selectedSlots])

  const handleBooking = () => {
    const { date, timeRange, slots } = getBookingTimeRange()
    const bookingData = {
      courtId: court!.id,
      courtName: court!.name,
      courtType: court!.type,
      branch: court!.branch,
      courtAddress: court!.address,
      courtLat: court!.lat,
      courtLng: court!.lng,
      price: court!.price,
      date,
      timeRange,
      slots,
      slotCount: slots.length,
      totalPrice,
    }
    localStorage.setItem('pendingBooking', JSON.stringify(bookingData))
    router.push('/booking')
  }

  // ─── Directions: calculate route via TomTom Routing API ───
  const calculateRoute = useCallback(async () => {
    if (!userCoords || !court?.lat || !court?.lng) return
    setDirectionsLoading(true)
    setDirectionsError("")
    setRouteCoords([])
    setRouteInfo(null)
    try {
      const res = await fetch(
        `https://api.tomtom.com/routing/1/calculateRoute/${userCoords.lat},${userCoords.lng}:${court.lat},${court.lng}/json?key=${TOMTOM_API_KEY}&travelMode=car&traffic=true&language=vi-VN`
      )
      const data = await res.json()
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0]
        const summary = route.summary
        const points: [number, number][] = route.legs[0].points.map((p: { latitude: number; longitude: number }) => [p.latitude, p.longitude] as [number, number])
        setRouteCoords(points)
        setRouteInfo({
          distanceKm: Math.round((summary.lengthInMeters / 1000) * 10) / 10,
          timeMin: Math.round(summary.travelTimeInSeconds / 60),
        })
      } else {
        setDirectionsError("Không tìm được tuyến đường.")
      }
    } catch {
      setDirectionsError("Lỗi khi tính tuyến đường. Vui lòng thử lại.")
    } finally {
      setDirectionsLoading(false)
    }
  }, [userCoords, court?.lat, court?.lng])

  // Auto-detect user location on mount — only if user has no registered address
  useEffect(() => {
    if (autoRouteTriggered.current) return
    autoRouteTriggered.current = true

    if (!court?.lat || !court?.lng) return
    if (!navigator.geolocation) return

    // If user already has a registered address, don't auto-locate
    // (they can still click the location button in AddressInput to override)
    if (user?.address) return

    setAutoLocating(true)

    let bestPosition: GeolocationPosition | null = null
    let settled = false

    const finalize = async (position: GeolocationPosition) => {
      if (settled) return
      settled = true
      navigator.geolocation.clearWatch(watchId)

      const accuracy = Math.round(position.coords.accuracy)
      setLocationAccuracy(accuracy)

      // If accuracy is too poor (> 1000m = IP-based), don't use it
      // Instead, let user enter address manually
      if (accuracy > 1000) {
        setAutoLocating(false)
        setDirectionsError("Không thể xác định vị trí chính xác. Vui lòng nhập địa chỉ thủ công.")
        return
      }

      const { latitude, longitude } = position.coords
      setUserCoords({ lat: latitude, lng: longitude })

      // Reverse geocode to fill address
      try {
        const res = await fetch(
          `https://api.tomtom.com/search/2/reverseGeocode/${latitude},${longitude}.json?key=${TOMTOM_API_KEY}&language=vi-VN`
        )
        const data = await res.json()
        if (data.addresses && data.addresses.length > 0) {
          const raw = data.addresses[0].address.freeformAddress || "Vị trí hiện tại"
          const parts = raw.split(",").map((s: string) => s.trim()).filter(Boolean)
          const unique: string[] = []
          for (const part of parts) {
            if (unique.length === 0 || unique[unique.length - 1] !== part) unique.push(part)
          }
          setUserAddress(unique.join(", "))
        } else {
          setUserAddress("Vị trí hiện tại")
        }
      } catch {
        setUserAddress("Vị trí hiện tại")
      }

      // Auto-calculate route only if accuracy is reasonable (< 500m)
      if (accuracy <= 500) {
        try {
          setDirectionsLoading(true)
          const routeRes = await fetch(
            `https://api.tomtom.com/routing/1/calculateRoute/${latitude},${longitude}:${court!.lat},${court!.lng}/json?key=${TOMTOM_API_KEY}&travelMode=car&traffic=true&language=vi-VN`
          )
          const routeData = await routeRes.json()
          if (routeData.routes && routeData.routes.length > 0) {
            const route = routeData.routes[0]
            const summary = route.summary
            const points: [number, number][] = route.legs[0].points.map(
              (p: { latitude: number; longitude: number }) => [p.latitude, p.longitude] as [number, number]
            )
            setRouteCoords(points)
            setRouteInfo({
              distanceKm: Math.round((summary.lengthInMeters / 1000) * 10) / 10,
              timeMin: Math.round(summary.travelTimeInSeconds / 60),
            })
          }
        } catch {
          // Silently fail — user can manually click "Xem chỉ đường"
        } finally {
          setDirectionsLoading(false)
        }
      }

      setAutoLocating(false)
    }

    // Watch position — pick the most accurate fix within a time window
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position
        }
        // If accuracy is good enough (< 100m), settle immediately
        if (position.coords.accuracy < 100) {
          finalize(position)
        }
      },
      () => {
        // Error callback — if we have a best position, use it anyway
        if (bestPosition) {
          finalize(bestPosition)
        } else {
          setAutoLocating(false)
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )

    // After 6 seconds, settle with whatever best position we have
    const timer = setTimeout(() => {
      if (!settled && bestPosition) {
        finalize(bestPosition)
      } else if (!settled) {
        settled = true
        navigator.geolocation.clearWatch(watchId)
        setAutoLocating(false)
      }
    }, 6000)

    return () => {
      clearTimeout(timer)
      navigator.geolocation.clearWatch(watchId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddressChange = (addr: string, coords?: { lat: number; lng: number }) => {
    setUserAddress(addr)
    if (coords) {
      setUserCoords(coords)
      // Reset route when address changes
      setRouteCoords([])
      setRouteInfo(null)
    }
  }

  // Compute rating distribution from reviews
  const ratingDist = useMemo(() => {
    const total = reviewsList.length || 1
    const counts = [0, 0, 0, 0, 0]
    reviewsList.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++
    })
    return [5, 4, 3, 2, 1].map(s => ({
      stars: s,
      count: counts[s - 1],
      pct: Math.round((counts[s - 1] / total) * 100),
    }))
  }, [reviewsList])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
            {/* Breadcrumb skeleton */}
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
            {/* Gallery skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 rounded-xl overflow-hidden">
              <div className="lg:col-span-3 aspect-video bg-muted animate-pulse rounded-xl" />
              <div className="hidden lg:grid grid-rows-4 gap-2">
                {[1,2,3,4].map(i => <div key={i} className="bg-muted animate-pulse rounded-md" />)}
              </div>
            </div>
            {/* Content skeleton */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
              <div className="space-y-4">
                <div className="h-40 bg-muted rounded-xl animate-pulse" />
                <div className="h-64 bg-muted rounded-xl animate-pulse" style={{ animationDelay: "100ms" }} />
                <div className="h-48 bg-muted rounded-xl animate-pulse" style={{ animationDelay: "200ms" }} />
              </div>
              <div className="hidden lg:block h-64 bg-muted rounded-xl animate-pulse" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!court) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-lg text-muted-foreground">Không tìm thấy sân</p>
          <Link href="/courts">
            <Button variant="outline">Quay lại danh sách sân</Button>
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/courts" className="hover:text-foreground transition-colors flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Danh sách sân
            </Link>
            <span>/</span>
            <span className="text-foreground">{court.name}</span>
          </div>

          {/* Closed court banner */}
          {isClosed && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                <Lock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-red-700 dark:text-red-400">Sân hiện đang tạm đóng</p>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">Sân này đã được quản trị viên tạm đóng và không nhận đặt chỗ. Vui lòng chọn sân khác.</p>
              </div>
            </div>
          )}

          {/* Image Gallery */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 rounded-xl overflow-hidden">
            <div className="lg:col-span-3 aspect-video bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center">
              <div className="text-4xl text-secondary/30 font-serif font-bold">{court.name}</div>
            </div>
            <div className="hidden lg:grid grid-rows-4 gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-gradient-to-br from-muted to-background flex items-center justify-center rounded-md">
                  <span className="text-muted-foreground/30 text-sm font-medium">Ảnh {i}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2-col content */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
            {/* Left Column */}
            <div className="flex flex-col gap-6">
              {/* Overview */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge className="bg-primary/10 text-primary border-primary/20 capitalize">{court.type}</Badge>
                    <Badge variant="outline" className="text-muted-foreground">{court.branch}</Badge>
                    {court.indoor ? (
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border-blue-200">Trong nhà</Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300 border-orange-200">Ngoài trời</Badge>
                    )}
                  </div>
                  <h1 className="font-serif text-2xl font-extrabold text-foreground lg:text-3xl">{court.name}</h1>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {court.address || court.branch}</span>
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {court.hours}</span>
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {court.rating} ({court.reviews} đánh giá)
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className={cn("text-sm text-muted-foreground leading-relaxed", !expanded && "line-clamp-2")}>
                      {court.description}
                    </p>
                    <button onClick={() => setExpanded(!expanded)} className="text-sm text-primary font-medium mt-1">
                      {expanded ? "Thu gọn" : "Xem thêm"}
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Weather for outdoor courts */}
              {!court.indoor && (
                weatherLoading ? (
                  <Card className="border-orange-200 dark:border-orange-800">
                    <CardContent className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /> Đang tải thời tiết...
                    </CardContent>
                  </Card>
                ) : weatherData ? (
                  <WeatherWidget weatherData={weatherData} />
                ) : null
              )}

              {/* Directions / Chỉ đường */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <Route className="h-5 w-5 text-primary" />
                    Chỉ đường đến sân
                  </CardTitle>
                  {court.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-4 w-4" /> {court.address}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* User address input */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Điểm xuất phát của bạn</label>
                    <AddressInput
                      value={userAddress}
                      onChange={handleAddressChange}
                      placeholder="Nhập địa chỉ xuất phát..."
                      compact
                    />
                    {locationAccuracy != null && locationAccuracy > 500 && (
                      <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Định vị qua IP có sai số lớn (~{locationAccuracy >= 1000 ? `${Math.round(locationAccuracy / 1000)} km` : `${locationAccuracy} m`}). Vui lòng nhập địa chỉ chính xác vào ô trên.
                      </p>
                    )}
                  </div>

                  {/* Calculate route button */}
                  <Button
                    onClick={calculateRoute}
                    disabled={!userCoords || directionsLoading || autoLocating}
                    className="w-full font-semibold"
                  >
                    {autoLocating ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Đang lấy vị trí của bạn...</>
                    ) : directionsLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Đang tính tuyến đường...</>
                    ) : (
                      <><Navigation2 className="h-4 w-4 mr-2" /> Xem chỉ đường</>
                    )}
                  </Button>

                  {directionsError && (
                    <p className="text-sm text-red-500 text-center">{directionsError}</p>
                  )}

                  {/* Route info summary */}
                  {routeInfo && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-xs text-muted-foreground">Khoảng cách</p>
                          <p className="text-lg font-bold text-primary">{routeInfo.distanceKm} km</p>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-xs text-muted-foreground">Thời gian dự kiến</p>
                          <p className="text-lg font-bold text-primary">
                            {routeInfo.timeMin >= 60
                              ? `${Math.floor(routeInfo.timeMin / 60)}h ${routeInfo.timeMin % 60}p`
                              : `${routeInfo.timeMin} phút`}
                          </p>
                        </div>
                      </div>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${userCoords?.lat},${userCoords?.lng}&destination=${court.lat},${court.lng}&travelmode=driving`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 transition-colors"
                      >
                        <Navigation2 className="h-4 w-4" />
                        Bắt đầu dẫn đường
                        <ExternalLink className="h-3.5 w-3.5 ml-1 opacity-70" />
                      </a>
                    </div>
                  )}

                  {/* Map with route */}
                  {court.lat && court.lng && (
                    <div className="rounded-xl overflow-hidden border shadow-sm h-72">
                      <TomTomMap
                        lat={userCoords?.lat ?? court.lat}
                        lng={userCoords?.lng ?? court.lng}
                        courtLat={court.lat}
                        courtLng={court.lng}
                        courtName={court.name}
                        routeCoords={routeCoords.length > 0 ? routeCoords : undefined}
                        hideUserMarker={!userCoords}
                      />
                    </div>
                  )}

                  {/* Legend */}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-full bg-blue-500 inline-block" /> Vị trí của bạn
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-full bg-green-500 inline-block" /> Sân cầu lông
                    </span>
                    {routeCoords.length > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-6 rounded bg-blue-500 inline-block" style={{ height: 3 }} /> Tuyến đường
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Amenities */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-lg">Tiện ích</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {court.amenities
                    .filter((a, i, arr) => arr.indexOf(a) === i)
                    .map((a, i) => (
                      <div key={`${a}-${i}`} className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:border-primary/40 hover:bg-primary/5 transition-colors duration-150">
                        <span className="text-primary">{amenityIcons[a] || <Check className="h-5 w-5" />}</span>
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Availability Calendar */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-serif text-lg">Lịch trống</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium">{weekDays[0].label} - {weekDays[6].label}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(weekOffset + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs"><span className="h-3 w-3 rounded bg-court-available" /> Trống</span>
                    <span className="flex items-center gap-1 text-xs"><span className="h-3 w-3 rounded bg-court-booked" /> Đã đặt</span>
                    <span className="flex items-center gap-1 text-xs"><span className="h-3 w-3 rounded bg-court-hold" /> Giữ chỗ</span>
                    <span className="flex items-center gap-1 text-xs"><span className="h-3 w-3 rounded bg-primary" /> Đã chọn</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      {/* Day headers */}
                      <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 mb-1">
                        <div />
                        {weekDays.map(d => (
                          <div key={d.label} className="text-center text-xs font-medium text-muted-foreground py-1">
                            <div>{d.dayName}</div>
                            <div className="font-semibold text-foreground">{d.label}</div>
                          </div>
                        ))}
                      </div>
                      {/* Time grid */}
                      {timeSlots.map(time => (
                        <div key={time} className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 mb-1">
                          <div className="text-xs text-muted-foreground flex items-center justify-end pr-2">{time}</div>
                          {weekDays.map(d => {
                            const status = availability[d.label]?.[time] || 'available'
                            const slotKey = `${d.label}-${time}`
                            const isSelected = selectedSlots.includes(slotKey)
                            const isDisabled = status !== 'available'

                            return (
                              <button
                                key={slotKey}
                                disabled={isDisabled}
                                onClick={() => toggleSlot(d.label, time)}
                                className={cn(
                                  "h-8 rounded text-xs font-medium transition-all duration-150",
                                  isSelected
                                    ? "bg-primary text-primary-foreground scale-[0.95] shadow-sm shadow-primary/40 ring-2 ring-primary/30"
                                    : status === 'available'
                                      ? "bg-court-available hover:bg-green-200 hover:scale-[0.97] text-green-700 cursor-pointer active:scale-95"
                                      : status === 'booked'
                                        ? "bg-court-booked text-red-400 cursor-not-allowed opacity-60"
                                        : "bg-court-hold text-amber-400 cursor-not-allowed opacity-70"
                                )}
                              >
                                {isSelected && <Check className="h-3 w-3 mx-auto" />}
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Reviews */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-lg">Đánh giá ({court.reviews})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-6 mb-6">
                    <div className="text-center">
                      <p className="font-serif text-4xl font-extrabold text-foreground">{court.rating}</p>
                      <div className="flex gap-0.5 justify-center mt-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("h-4 w-4", i < Math.floor(court.rating) ? "fill-amber-400 text-amber-400" : "text-muted")} />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{court.reviews} đánh giá</p>
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      {ratingDist.map(r => (
                        <div key={r.stars} className="flex items-center gap-2 text-sm">
                          <span className="w-4 text-right">{r.stars}</span>
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <Progress value={r.pct} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-8">{r.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    {reviewsList.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Chưa có đánh giá nào</p>
                    )}
                    {reviewsList.map(r => (
                      <div key={r.id} className="border-t pt-4 hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors duration-150">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                              {r.user_name[0]}
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{r.user_name}</p>
                              <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('vi-VN')}</p>
                            </div>
                          </div>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={cn("h-3 w-3", i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted")} />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{r.content}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Sticky Widget */}
            <div className="hidden lg:block">
              <div className="sticky top-20 space-y-4">
                <Card className="overflow-hidden">
                  <CardContent className="p-6">
                    <p className="font-serif text-2xl font-extrabold text-primary">
                      {formatVND(court.price)}<span className="text-sm text-muted-foreground font-normal">/h</span>
                    </p>
                    <div
                      className="transition-all duration-300 overflow-hidden"
                      style={{ maxHeight: selectedSlots.length > 0 ? "400px" : "0", opacity: selectedSlots.length > 0 ? 1 : 0 }}
                    >
                      {selectedSlots.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold mb-2">Đã chọn {selectedSlots.length} slot:</p>
                          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                            {selectedSlots.map(s => (
                              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                          <div className="border-t mt-4 pt-4">
                            <div className="flex justify-between text-sm">
                              <span>{selectedSlots.length} x {formatVND(court.price)}</span>
                              <span className="font-bold text-primary">{formatVND(totalPrice)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div
                      className="transition-all duration-300"
                      style={{ opacity: selectedSlots.length === 0 ? 1 : 0, maxHeight: selectedSlots.length === 0 ? "40px" : "0", overflow: "hidden" }}
                    >
                      <p className="text-sm text-muted-foreground mt-2">Chọn slot trên lịch để đặt sân</p>
                    </div>
                    <Button
                      className="w-full mt-4 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                      disabled={selectedSlots.length === 0 || isClosed}
                      onClick={handleBooking}
                    >
                      {isClosed ? "Sân đang tạm đóng" : "Tiếp tục đặt sân"}
                    </Button>
                    <div className="mt-3 p-3 rounded-lg bg-muted">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Giữ chỗ 10 phút sau khi chọn slot
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile sticky bottom bar — slide up */}
        <div className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t p-4 shadow-lg z-40 transition-all duration-300",
          selectedSlots.length > 0 && !isClosed
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0 pointer-events-none"
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{selectedSlots.length} slot đã chọn</p>
              <p className="font-serif font-bold text-primary text-lg">{formatVND(totalPrice)}</p>
            </div>
            <Button
              className="font-semibold hover:scale-[1.02] transition-transform"
              onClick={handleBooking}
            >
              Tiếp tục đặt sân
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}