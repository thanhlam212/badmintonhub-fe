"use client"

import { useEffect, useRef, useCallback } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { TOMTOM_API_KEY } from "@/lib/tomtom"

interface TomTomMapProps {
  lat: number
  lng: number
  courtLat?: number
  courtLng?: number
  courtName?: string
  routeCoords?: [number, number][]
  /** Hide the blue user marker (e.g. when showing court-only view) */
  hideUserMarker?: boolean
}

// Use TomTom raster tiles with proper attribution
const TOMTOM_RASTER_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "tomtom": {
      type: "raster",
      tiles: [
        `https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`,
      ],
      tileSize: 256,
      attribution: '© <a href="https://www.tomtom.com" target="_blank">TomTom</a>',
      maxzoom: 22,
    },
  },
  layers: [
    {
      id: "tomtom-tiles",
      type: "raster",
      source: "tomtom",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
}

export default function TomTomMap({ lat, lng, courtLat, courtLng, courtName, routeCoords, hideUserMarker }: TomTomMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const courtMarkerRef = useRef<maplibregl.Marker | null>(null)
  const mapLoadedRef = useRef(false)

  const createUserMarkerEl = useCallback(() => {
    const el = document.createElement("div")
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 11.2 15 25 15 25s15-13.8 15-25C30 6.7 23.3 0 15 0z" fill="#3b82f6" stroke="white" stroke-width="2"/>
      <circle cx="15" cy="14" r="6" fill="white"/>
    </svg>`
    el.style.cursor = "pointer"
    return el
  }, [])

  const createCourtMarkerEl = useCallback(() => {
    const el = document.createElement("div")
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 11.2 15 25 15 25s15-13.8 15-25C30 6.7 23.3 0 15 0z" fill="#16a34a" stroke="white" stroke-width="2"/>
      <circle cx="15" cy="14" r="6" fill="white"/>
    </svg>`
    el.style.cursor = "pointer"
    return el
  }, [])

  const syncMapContent = useCallback((map: maplibregl.Map) => {
    // ── User marker ──
    if (userMarkerRef.current) {
      if (hideUserMarker) {
        userMarkerRef.current.remove()
        userMarkerRef.current = null
      } else {
        userMarkerRef.current.setLngLat([lng, lat])
      }
    } else if (!hideUserMarker) {
      userMarkerRef.current = new maplibregl.Marker({ element: createUserMarkerEl(), anchor: "bottom" })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 30 }).setHTML("<strong>\ud83d\udccd V\u1ecb tr\u00ed c\u1ee7a b\u1ea1n</strong>"))
        .addTo(map)
    }

    // ── Court marker ──
    if (courtMarkerRef.current) {
      courtMarkerRef.current.remove()
      courtMarkerRef.current = null
    }
    if (courtLat != null && courtLng != null) {
      courtMarkerRef.current = new maplibregl.Marker({ element: createCourtMarkerEl(), anchor: "bottom" })
        .setLngLat([courtLng, courtLat])
        .setPopup(new maplibregl.Popup({ offset: 30 }).setHTML(`<strong>🏸 ${courtName || "Sân cầu lông"}</strong>`))
        .addTo(map)
    }

    // ── Route polyline ──
    try { if (map.getLayer("route-line")) map.removeLayer("route-line") } catch { /* */ }
    try { if (map.getSource("route-source")) map.removeSource("route-source") } catch { /* */ }

    if (routeCoords && routeCoords.length > 0) {
      const coordinates = routeCoords.map(([rlat, rlng]) => [rlng, rlat])

      map.addSource("route-source", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates },
        },
      })

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route-source",
        paint: {
          "line-color": "#2563eb",
          "line-width": 5,
          "line-opacity": 0.8,
        },
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
      })
    }

    // ── Fit view ──
    const hasRoute = routeCoords && routeCoords.length > 0
    const hasCourt = courtLat != null && courtLng != null
    const showingUser = !hideUserMarker
    const samePosition = hasCourt && Math.abs(lat - courtLat!) < 0.0001 && Math.abs(lng - courtLng!) < 0.0001

    if (hasRoute) {
      const allPoints: [number, number][] = [
        [lng, lat],
        ...routeCoords!.map(([rlat, rlng]) => [rlng, rlat] as [number, number]),
      ]
      if (hasCourt) allPoints.push([courtLng!, courtLat!])
      const bounds = allPoints.reduce(
        (b, p) => b.extend(p as maplibregl.LngLatLike),
        new maplibregl.LngLatBounds(allPoints[0], allPoints[0])
      )
      map.fitBounds(bounds, { padding: 50 })
    } else if (hasCourt && showingUser && !samePosition) {
      const bounds = new maplibregl.LngLatBounds([lng, lat], [courtLng!, courtLat!])
      map.fitBounds(bounds, { padding: 50 })
    } else if (hasCourt) {
      // Court-only view — center on court
      map.setCenter([courtLng!, courtLat!])
      map.setZoom(15)
    } else {
      // Single point — center on user
      map.setCenter([lng, lat])
      map.setZoom(15)
    }
  }, [lat, lng, courtLat, courtLng, courtName, routeCoords, hideUserMarker, createCourtMarkerEl, createUserMarkerEl])

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TOMTOM_RASTER_STYLE,
      center: [lng, lat],
      zoom: 15,
      attributionControl: false,
    })
    mapRef.current = map

    userMarkerRef.current = new maplibregl.Marker({ element: createUserMarkerEl(), anchor: "bottom" })
      .setLngLat([lng, lat])
      .setPopup(new maplibregl.Popup({ offset: 30 }).setHTML("<strong>📍 Vị trí của bạn</strong>"))
      .addTo(map)

    map.on("load", () => {
      mapLoadedRef.current = true
      syncMapContent(map)
    })

    return () => {
      mapLoadedRef.current = false
      map.remove()
      mapRef.current = null
      userMarkerRef.current = null
      courtMarkerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update on prop changes
  useEffect(() => {
    if (!mapRef.current || !mapLoadedRef.current) return
    syncMapContent(mapRef.current)
  }, [syncMapContent])

  return <div ref={containerRef} className="h-full w-full" />
}
