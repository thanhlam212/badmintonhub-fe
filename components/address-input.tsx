"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { MapPin, Search, Loader2, Navigation, X } from "lucide-react"
import { TOMTOM_API_KEY } from "@/lib/tomtom"
import dynamic from "next/dynamic"

/* ─── Types ─── */
interface TomTomResult {
  id: string
  type: string
  address: {
    freeformAddress: string
    streetName?: string
    municipality?: string
    countrySubdivision?: string
    country?: string
    postalCode?: string
  }
  position: {
    lat: number
    lon: number
  }
}

interface TomTomSearchResponse {
  results: TomTomResult[]
}

interface AddressInputProps {
  value: string
  onChange: (address: string, coords?: { lat: number; lng: number }) => void
  placeholder?: string
  error?: string
  className?: string
  /** Compact mode for registration form — smaller map */
  compact?: boolean
  showMapByDefault?: boolean
  enableMapPicker?: boolean
  defaultMapCenter?: { lat: number; lng: number }
}

/* ─── Mini Map (loaded dynamically to avoid SSR issues) ─── */
const TomTomMap = dynamic<{
  lat: number
  lng: number
  courtLat?: number
  courtLng?: number
  courtName?: string
  routeCoords?: [number, number][]
  onPickLocation?: (coords: { lat: number; lng: number }) => void
}>(
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

const DEFAULT_MAP_CENTER = { lat: 21.0278, lng: 105.8342 }

/* ─── Main Component ─── */

/** Remove duplicate consecutive parts in TomTom freeformAddress (e.g. "Hà Nội, Hà Nội, Hà Nội") */
function deduplicateAddress(raw: string): string {
  const parts = raw.split(",").map(s => s.trim()).filter(Boolean)
  const unique: string[] = []
  for (const part of parts) {
    if (unique.length === 0 || unique[unique.length - 1] !== part) {
      unique.push(part)
    }
  }
  return unique.join(", ")
}

export function AddressInput({
  value,
  onChange,
  placeholder,
  error,
  className,
  compact,
  showMapByDefault,
  enableMapPicker,
  defaultMapCenter = DEFAULT_MAP_CENTER,
}: AddressInputProps) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<TomTomResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(
    showMapByDefault ? defaultMapCenter : null,
  )
  const [showMap, setShowMap] = useState(Boolean(showMapByDefault))
  const [geoWarning, setGeoWarning] = useState("")
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync external value
  useEffect(() => {
    if (value !== query) setQuery(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const reverseGeocode = useCallback(async (coords: { lat: number; lng: number }) => {
    setLoading(true)
    setSelectedCoords(coords)
    setShowMap(true)
    setGeoWarning("")

    try {
      const res = await fetch(
        `https://api.tomtom.com/search/2/reverseGeocode/${coords.lat},${coords.lng}.json?key=${TOMTOM_API_KEY}&language=vi-VN`
      )
      const data = await res.json()
      const raw = data?.addresses?.[0]?.address?.freeformAddress
      if (raw) {
        const addr = deduplicateAddress(raw)
        setQuery(addr)
        onChange(addr, coords)
      } else {
        onChange(query, coords)
      }
    } catch {
      onChange(query, coords)
    } finally {
      setLoading(false)
    }
  }, [onChange, query])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Debounced search via TomTom Search API
  const searchAddress = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 3) {
      setResults([])
      setShowDropdown(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `https://api.tomtom.com/search/2/search/${encodeURIComponent(q)}.json?key=${TOMTOM_API_KEY}&countrySet=VN&limit=6&language=vi-VN&typeahead=true`
        )
        const data: TomTomSearchResponse = await res.json()
        setResults(data.results || [])
        setShowDropdown((data.results || []).length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }, [])

  const handleInputChange = (val: string) => {
    setQuery(val)
    onChange(val)
    searchAddress(val)
  }

  const selectResult = (r: TomTomResult) => {
    const addr = deduplicateAddress(r.address.freeformAddress)
    const coords = { lat: r.position.lat, lng: r.position.lon }
    setQuery(addr)
    onChange(addr, coords)
    setSelectedCoords(coords)
    setShowDropdown(false)
    setShowMap(true)
    setGeoWarning("")
  }

  // "Vị trí của tôi" – use watchPosition for best accuracy + TomTom reverse geocode
  const useMyLocation = () => {
    if (!navigator.geolocation) return
    setLoading(true)

    let bestPosition: GeolocationPosition | null = null
    let settled = false

    const finalize = async (position: GeolocationPosition) => {
      if (settled) return
      settled = true
      navigator.geolocation.clearWatch(watchId)
      clearTimeout(timer)

      const accuracy = Math.round(position.coords.accuracy)

      // If accuracy is too poor (IP-based), warn user
      if (accuracy > 1000) {
        setGeoWarning(`Định vị qua IP có sai số lớn (~${Math.round(accuracy / 1000)} km). Vui lòng nhập địa chỉ thủ công.`)
        setLoading(false)
        return
      }

      setGeoWarning(accuracy > 500 ? `Sai số ~${accuracy}m. Kiểm tra lại địa chỉ.` : "")

      const { latitude, longitude } = position.coords
      const coords = { lat: latitude, lng: longitude }
      await reverseGeocode(coords)
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position
        }
        // Good enough accuracy (< 100m) — settle immediately
        if (position.coords.accuracy < 100) {
          finalize(position)
        }
      },
      () => {
        if (bestPosition) {
          finalize(bestPosition)
        } else {
          setLoading(false)
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )

    // After 5 seconds, settle with best available position
    const timer = setTimeout(() => {
      if (!settled && bestPosition) {
        finalize(bestPosition)
      } else if (!settled) {
        settled = true
        navigator.geolocation.clearWatch(watchId)
        setLoading(false)
      }
    }, 5000)
  }

  const clearAddress = () => {
    setQuery("")
    onChange("")
    setSelectedCoords(showMapByDefault ? defaultMapCenter : null)
    setShowMap(Boolean(showMapByDefault))
    setResults([])
    setGeoWarning("")
  }

  return (
    <div ref={containerRef} className={cn("space-y-2", className)}>
      {/* Input row */}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
        <Input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setShowDropdown(true) }}
          placeholder={placeholder || "Tìm kiếm địa chỉ..."}
          className={cn("pl-10 pr-20", error && "border-red-500")}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {query && (
            <button onClick={clearAddress} className="p-1 rounded hover:bg-muted transition-colors" type="button">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <button
            onClick={useMyLocation}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Dùng vị trí hiện tại"
            type="button"
          >
            <Navigation className="h-4 w-4 text-primary" />
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showDropdown && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
            {results.map((r, idx) => (
              <button
                key={r.id || idx}
                type="button"
                onClick={() => selectResult(r)}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-start gap-2.5 border-b last:border-b-0"
              >
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-sm leading-snug line-clamp-2">{r.address.freeformAddress}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hint text */}
      {geoWarning ? (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {geoWarning}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Search className="h-3 w-3" />
          Nhập địa chỉ để tìm kiếm hoặc nhấn <Navigation className="h-3 w-3 inline text-primary" /> để dùng vị trí hiện tại
        </p>
      )}
      {enableMapPicker && (
        <p className="text-xs text-muted-foreground">
          Bấm lên bản đồ để chọn vị trí chính xác hơn.
        </p>
      )}

      {/* Map */}
      {showMap && selectedCoords && (
        <div className={cn(
          "rounded-xl overflow-hidden border shadow-sm",
          compact ? "h-40" : "h-64"
        )}>
          <TomTomMap
            lat={selectedCoords.lat}
            lng={selectedCoords.lng}
            onPickLocation={enableMapPicker ? reverseGeocode : undefined}
          />
        </div>
      )}
    </div>
  )
}
