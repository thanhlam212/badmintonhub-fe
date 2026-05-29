"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { TOMTOM_API_KEY } from "@/lib/tomtom"
import { WEATHER_API_KEY } from "@/lib/utils"
import {
  Search, MapPin, Route, Navigation2, Loader2, CheckCircle2, XCircle,
  Clock, Cloud, CloudRain, Sun, Wind, Thermometer, Eye, Copy, Globe, Zap, Car, Bike
} from "lucide-react"
import { useState, useCallback, useRef, useEffect } from "react"
import dynamic from "next/dynamic"

const TomTomMap = dynamic<{ lat: number; lng: number; courtLat?: number; courtLng?: number; courtName?: string; routeCoords?: [number, number][] }>(
  () => import("@/components/tomtom-map"),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center bg-muted rounded-xl"><Loader2 className="h-5 w-5 animate-spin" /></div> }
)

interface ApiResult {
  status: "idle" | "loading" | "success" | "error"
  data: any
  time?: number
  statusCode?: number
}

function JsonViewer({ data }: { data: unknown }) {
  const jsonStr = JSON.stringify(data, null, 2)
  return (
    <div className="relative">
      <button
        onClick={() => navigator.clipboard.writeText(jsonStr)}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-muted hover:bg-muted/80 transition-colors"
        title="Copy JSON"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl text-xs overflow-auto max-h-[400px] font-mono leading-relaxed">
        {jsonStr}
      </pre>
    </div>
  )
}

function StatusIndicator({ result }: { result: ApiResult }) {
  if (result.status === "idle") return null
  if (result.status === "loading") return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Đang gọi...</Badge>
  if (result.status === "success") return (
    <div className="flex items-center gap-2">
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle2 className="h-3 w-3" /> HTTP {result.statusCode}</Badge>
      {result.time && <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {result.time}ms</Badge>}
    </div>
  )
  return (
    <div className="flex items-center gap-2">
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1"><XCircle className="h-3 w-3" /> Lỗi {result.statusCode}</Badge>
      {result.time && <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {result.time}ms</Badge>}
    </div>
  )
}

/* ─── Tab: Search ─── */
function SearchTab() {
  const [query, setQuery] = useState("Cầu Giấy, Hà Nội")
  const [result, setResult] = useState<ApiResult>({ status: "idle", data: null })

  const run = useCallback(async () => {
    setResult({ status: "loading", data: null })
    const start = Date.now()
    try {
      const res = await fetch(
        `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_API_KEY}&countrySet=VN&limit=5&language=vi-VN&typeahead=true`
      )
      const data = await res.json()
      setResult({ status: res.ok ? "success" : "error", data, time: Date.now() - start, statusCode: res.status })
    } catch (e) {
      setResult({ status: "error", data: { error: String(e) }, time: Date.now() - start })
    }
  }, [query])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4 text-primary" /> Fuzzy Search</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">GET /search/2/search/&#123;query&#125;.json</code>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nhập từ khóa tìm kiếm..." className="flex-1" />
            <Button onClick={run} disabled={result.status === "loading" || !query.trim()} className="gap-1 shrink-0">
              {result.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Gửi
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Params: <code className="bg-muted px-1 rounded">countrySet=VN</code> <code className="bg-muted px-1 rounded">limit=5</code> <code className="bg-muted px-1 rounded">language=vi-VN</code> <code className="bg-muted px-1 rounded">typeahead=true</code>
          </div>
        </CardContent>
      </Card>
      <StatusIndicator result={result} />
      {result.data && <JsonViewer data={result.data} />}
    </div>
  )
}

/* ─── Tab: Reverse Geocode ─── */
function ReverseGeocodeTab() {
  const [lat, setLat] = useState("21.0285")
  const [lon, setLon] = useState("105.7823")
  const [result, setResult] = useState<ApiResult>({ status: "idle", data: null })

  const run = useCallback(async () => {
    setResult({ status: "loading", data: null })
    const start = Date.now()
    try {
      const res = await fetch(
        `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json?key=${TOMTOM_API_KEY}&language=vi-VN`
      )
      const data = await res.json()
      setResult({ status: res.ok ? "success" : "error", data, time: Date.now() - start, statusCode: res.status })
    } catch (e) {
      setResult({ status: "error", data: { error: String(e) }, time: Date.now() - start })
    }
  }, [lat, lon])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Reverse Geocode</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">GET /search/2/reverseGeocode/&#123;lat&#125;,&#123;lon&#125;.json</code>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <AddressSearchInput
            label="Tìm vị trí"
            icon={<MapPin className="h-3 w-3" />}
            onSelect={(la, lo) => { setLat(la); setLon(lo) }}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input value={lat} onChange={e => setLat(e.target.value)} placeholder="21.0285" />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input value={lon} onChange={e => setLon(e.target.value)} placeholder="105.7823" />
            </div>
          </div>
          <Button onClick={run} disabled={result.status === "loading"} className="w-full gap-1">
            {result.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Gửi
          </Button>
        </CardContent>
      </Card>
      <StatusIndicator result={result} />
      {result.data && <JsonViewer data={result.data} />}
    </div>
  )
}

/* ─── Inline Address Search Helper ─── */
function AddressSearchInput({ label, icon, onSelect }: {
  label: string
  icon: React.ReactNode
  onSelect: (lat: string, lon: string, address: string) => void
}) {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<{ id: string; address: string; lat: number; lon: number }[]>([])
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShow(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setSuggestions([]); setShow(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `https://api.tomtom.com/search/2/search/${encodeURIComponent(q)}.json?key=${TOMTOM_API_KEY}&countrySet=VN&limit=5&language=vi-VN&typeahead=true`
        )
        const data = await res.json()
        const items = (data.results || []).map((r: { id: string; address: { freeformAddress: string }; position: { lat: number; lon: number } }) => ({
          id: r.id,
          address: r.address.freeformAddress,
          lat: r.position.lat,
          lon: r.position.lon,
        }))
        setSuggestions(items)
        setShow(items.length > 0)
      } catch { setSuggestions([]) }
      setLoading(false)
    }, 350)
  }

  return (
    <div ref={containerRef} className="relative">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1.5">{icon} {label}</p>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value) }}
          onFocus={() => { if (suggestions.length > 0) setShow(true) }}
          placeholder="Tìm địa chỉ để tự điền tọa độ..."
          className="pl-8 text-xs h-8"
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {show && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.id || i}
              type="button"
              onClick={() => {
                onSelect(s.lat.toString(), s.lon.toString(), s.address)
                setQuery(s.address)
                setShow(false)
              }}
              className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors flex items-start gap-2 border-b last:border-b-0 text-xs"
            >
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="leading-snug line-clamp-1">{s.address}</span>
                <span className="text-[10px] text-muted-foreground block">{s.lat.toFixed(4)}, {s.lon.toFixed(4)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Tab: Routing ─── */
function RoutingTab() {
  const [fromLat, setFromLat] = useState("21.0280")
  const [fromLon, setFromLon] = useState("105.8542")
  const [toLat, setToLat] = useState("21.0285")
  const [toLon, setToLon] = useState("105.7823")
  const [travelMode, setTravelMode] = useState("car")
  const [result, setResult] = useState<ApiResult>({ status: "idle", data: null })
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([])

  const run = useCallback(async () => {
    setResult({ status: "loading", data: null })
    setRouteCoords([])
    const start = Date.now()
    try {
      const res = await fetch(
        `https://api.tomtom.com/routing/1/calculateRoute/${fromLat},${fromLon}:${toLat},${toLon}/json?key=${TOMTOM_API_KEY}&travelMode=${travelMode}&traffic=true&language=vi-VN`
      )
      const data = await res.json()
      setResult({ status: res.ok ? "success" : "error", data, time: Date.now() - start, statusCode: res.status })
      if (data.routes?.[0]?.legs?.[0]?.points) {
        setRouteCoords(data.routes[0].legs[0].points.map((p: { latitude: number; longitude: number }) => [p.latitude, p.longitude] as [number, number]))
      }
    } catch (e) {
      setResult({ status: "error", data: { error: String(e) }, time: Date.now() - start })
    }
  }, [fromLat, fromLon, toLat, toLon, travelMode])

  const summary = (result.data as { routes?: { summary: { lengthInMeters: number; travelTimeInSeconds: number } }[] })?.routes?.[0]?.summary

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Route className="h-4 w-4 text-primary" /> Calculate Route</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">GET /routing/1/calculateRoute/&#123;from&#125;:&#123;to&#125;/json</code>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <AddressSearchInput
                label="Điểm đi"
                icon={<Navigation2 className="h-3 w-3" />}
                onSelect={(lat, lon) => { setFromLat(lat); setFromLon(lon) }}
              />
              <Input value={fromLat} onChange={e => setFromLat(e.target.value)} placeholder="Lat" />
              <Input value={fromLon} onChange={e => setFromLon(e.target.value)} placeholder="Lon" />
            </div>
            <div className="space-y-2">
              <AddressSearchInput
                label="Điểm đến"
                icon={<MapPin className="h-3 w-3" />}
                onSelect={(lat, lon) => { setToLat(lat); setToLon(lon) }}
              />
              <Input value={toLat} onChange={e => setToLat(e.target.value)} placeholder="Lat" />
              <Input value={toLon} onChange={e => setToLon(e.target.value)} placeholder="Lon" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Travel Mode</Label>
            <div className="flex gap-2">
              {[
                { value: "car", icon: <Car className="h-4 w-4" />, label: "Ô tô" },
                { value: "bicycle", icon: <Bike className="h-4 w-4" />, label: "Xe đạp" },
                { value: "pedestrian", icon: <Navigation2 className="h-4 w-4" />, label: "Đi bộ" },
              ].map(m => (
                <Button
                  key={m.value}
                  variant={travelMode === m.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTravelMode(m.value)}
                  className="gap-1 flex-1"
                >
                  {m.icon} {m.label}
                </Button>
              ))}
            </div>
          </div>
          <Button onClick={run} disabled={result.status === "loading"} className="w-full gap-1">
            {result.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Gửi
          </Button>
        </CardContent>
      </Card>

      <StatusIndicator result={result} />

      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Khoảng cách</p>
              <p className="text-xl font-bold text-primary">{(summary.lengthInMeters / 1000).toFixed(1)} km</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Thời gian</p>
              <p className="text-xl font-bold text-primary">
                {Math.round(summary.travelTimeInSeconds / 60)} phút
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {routeCoords.length > 0 && (
        <div className="rounded-xl overflow-hidden border shadow-sm h-64">
          <TomTomMap
            lat={parseFloat(fromLat)}
            lng={parseFloat(fromLon)}
            courtLat={parseFloat(toLat)}
            courtLng={parseFloat(toLon)}
            courtName="Điểm đến"
            routeCoords={routeCoords}
          />
        </div>
      )}

      {result.data && <JsonViewer data={result.data} />}
    </div>
  )
}

/* ─── Tab: Traffic Flow ─── */
function TrafficFlowTab() {
  const [lat, setLat] = useState("21.0278")
  const [lon, setLon] = useState("105.8342")
  const [result, setResult] = useState<ApiResult>({ status: "idle", data: null })

  const run = useCallback(async () => {
    setResult({ status: "loading", data: null })
    const start = Date.now()
    try {
      const res = await fetch(
        `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${TOMTOM_API_KEY}&point=${lat},${lon}&unit=KMPH`
      )
      const data = await res.json()
      setResult({ status: res.ok ? "success" : "error", data, time: Date.now() - start, statusCode: res.status })
    } catch (e) {
      setResult({ status: "error", data: { error: String(e) }, time: Date.now() - start })
    }
  }, [lat, lon])

  const flow = (result.data as { flowSegmentData?: { currentSpeed: number; freeFlowSpeed: number; currentTravelTime: number; freeFlowTravelTime: number; confidence: number; roadClosure: boolean } })?.flowSegmentData

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Car className="h-4 w-4 text-primary" /> Traffic Flow Segment</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">GET /traffic/services/4/flowSegmentData/absolute/10/json</code>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <AddressSearchInput
            label="Tìm vị trí"
            icon={<MapPin className="h-3 w-3" />}
            onSelect={(la, lo) => { setLat(la); setLon(lo) }}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input value={lat} onChange={e => setLat(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input value={lon} onChange={e => setLon(e.target.value)} />
            </div>
          </div>
          <Button onClick={run} disabled={result.status === "loading"} className="w-full gap-1">
            {result.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Gửi
          </Button>
        </CardContent>
      </Card>

      <StatusIndicator result={result} />

      {flow && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Tốc độ hiện tại</p>
              <p className="text-xl font-bold text-primary">{flow.currentSpeed} km/h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Tốc độ thông thường</p>
              <p className="text-xl font-bold text-green-600">{flow.freeFlowSpeed} km/h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Thời gian di chuyển</p>
              <p className="text-xl font-bold">{flow.currentTravelTime}s</p>
              <p className="text-xs text-muted-foreground">vs {flow.freeFlowTravelTime}s bình thường</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Độ tin cậy</p>
              <p className="text-xl font-bold">{(flow.confidence * 100).toFixed(0)}%</p>
              <Badge variant={flow.roadClosure ? "destructive" : "outline"} className="mt-1 text-[10px]">
                {flow.roadClosure ? "Đang chặn đường" : "Đường thông"}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {result.data && <JsonViewer data={result.data} />}
    </div>
  )
}

/* ─── Tab: Weather API ─── */
function WeatherTab() {
  const [lat, setLat] = useState("21.0285")
  const [lon, setLon] = useState("105.7823")
  const [result, setResult] = useState<ApiResult>({ status: "idle", data: null })

  const run = useCallback(async () => {
    setResult({ status: "loading", data: null })
    const start = Date.now()
    try {
      const res = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&days=3&lang=vi&aqi=no`
      )
      const data = await res.json()
      setResult({ status: res.ok ? "success" : "error", data, time: Date.now() - start, statusCode: res.status })
    } catch (e) {
      setResult({ status: "error", data: { error: String(e) }, time: Date.now() - start })
    }
  }, [lat, lon])

  const current = (result.data as { current?: { temp_c: number; condition: { text: string; icon: string }; humidity: number; wind_kph: number; feelslike_c: number; uv: number } })?.current
  const forecast = (result.data as { forecast?: { forecastday: { date: string; day: { maxtemp_c: number; mintemp_c: number; condition: { text: string; icon: string }; daily_chance_of_rain: number } }[] } })?.forecast

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Cloud className="h-4 w-4 text-primary" /> Weather API</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">GET /v1/forecast.json?days=3</code>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <AddressSearchInput
            label="Tìm vị trí"
            icon={<Cloud className="h-3 w-3" />}
            onSelect={(la, lo) => { setLat(la); setLon(lo) }}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input value={lat} onChange={e => setLat(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input value={lon} onChange={e => setLon(e.target.value)} />
            </div>
          </div>
          <Button onClick={run} disabled={result.status === "loading"} className="w-full gap-1">
            {result.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Gửi
          </Button>
        </CardContent>
      </Card>

      <StatusIndicator result={result} />

      {current && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https:${current.condition.icon}`} alt={current.condition.text} className="h-16 w-16" />
              <div>
                <p className="text-3xl font-bold">{current.temp_c}°C</p>
                <p className="text-sm text-muted-foreground">{current.condition.text}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="text-center">
                <Thermometer className="h-4 w-4 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">Cảm giác</p>
                <p className="text-sm font-semibold">{current.feelslike_c}°C</p>
              </div>
              <div className="text-center">
                <Wind className="h-4 w-4 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">Gió</p>
                <p className="text-sm font-semibold">{current.wind_kph} km/h</p>
              </div>
              <div className="text-center">
                <CloudRain className="h-4 w-4 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">Độ ẩm</p>
                <p className="text-sm font-semibold">{current.humidity}%</p>
              </div>
              <div className="text-center">
                <Sun className="h-4 w-4 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">UV</p>
                <p className="text-sm font-semibold">{current.uv}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {forecast && (
        <div className="grid grid-cols-3 gap-3">
          {forecast.forecastday.map(day => (
            <Card key={day.date}>
              <CardContent className="p-3 text-center">
                <p className="text-xs font-semibold">{day.date}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https:${day.day.condition.icon}`} alt={day.day.condition.text} className="h-10 w-10 mx-auto my-1" />
                <p className="text-xs text-muted-foreground">{day.day.condition.text}</p>
                <p className="text-sm font-semibold mt-1">{day.day.mintemp_c}° - {day.day.maxtemp_c}°</p>
                <p className="text-xs text-blue-600 mt-0.5">🌧 {day.day.daily_chance_of_rain}%</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {result.data && <JsonViewer data={result.data} />}
    </div>
  )
}

/* ─── Main Page ─── */
export default function ApiTestPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold text-foreground">API Testing Console</h1>
          <p className="text-sm text-muted-foreground">Test TomTom Traffic &amp; Weather API endpoints</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs"><Globe className="h-3 w-3" /> TomTom</Badge>
          <Badge variant="outline" className="gap-1 text-xs"><Cloud className="h-3 w-3" /> WeatherAPI</Badge>
        </div>
      </div>

      {/* API Keys Info */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">TomTom API Key</p>
              <code className="text-xs bg-muted px-2 py-1 rounded-md block truncate">{TOMTOM_API_KEY}</code>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Weather API Key</p>
              <code className="text-xs bg-muted px-2 py-1 rounded-md block truncate">{WEATHER_API_KEY}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="search" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="search" className="gap-1 text-xs"><Search className="h-3.5 w-3.5" /> Search</TabsTrigger>
          <TabsTrigger value="reverse" className="gap-1 text-xs"><MapPin className="h-3.5 w-3.5" /> Reverse</TabsTrigger>
          <TabsTrigger value="routing" className="gap-1 text-xs"><Route className="h-3.5 w-3.5" /> Routing</TabsTrigger>
          <TabsTrigger value="traffic" className="gap-1 text-xs"><Car className="h-3.5 w-3.5" /> Traffic</TabsTrigger>
          <TabsTrigger value="weather" className="gap-1 text-xs"><Cloud className="h-3.5 w-3.5" /> Weather</TabsTrigger>
        </TabsList>

        <TabsContent value="search"><SearchTab /></TabsContent>
        <TabsContent value="reverse"><ReverseGeocodeTab /></TabsContent>
        <TabsContent value="routing"><RoutingTab /></TabsContent>
        <TabsContent value="traffic"><TrafficFlowTab /></TabsContent>
        <TabsContent value="weather"><WeatherTab /></TabsContent>
      </Tabs>
    </div>
  )
}
