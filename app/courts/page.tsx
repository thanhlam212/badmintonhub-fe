"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Star, MapPin, Grid3X3, List, Filter, X, Sun, Home, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useState, useMemo, useEffect, useRef } from "react"
import { formatVND, getWeekDays } from "@/lib/utils"
import { courtApi, branchApi, type ApiCourt, type ApiBranch } from "@/lib/api"
import { cn } from "@/lib/utils"

interface FilterState {
  selectedBranches: number[]
  courtType: string
  indoorFilter: string
  priceRange: [number, number]
  amenities: string[]
  minRating: number
}

function FilterSidebar({
  open,
  onClose,
  filters,
  onFiltersChange,
  branches,
  courts,
}: {
  open: boolean
  onClose: () => void
  filters: FilterState
  onFiltersChange: (f: FilterState) => void
  branches: ApiBranch[]
  courts: ApiCourt[]
}) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters)

  // Sync khi filters bên ngoài thay đổi
  useEffect(() => { setLocalFilters(filters) }, [filters])

const toggleBranch = (id: number) => {
  const next = localFilters.selectedBranches.includes(id)
    ? localFilters.selectedBranches.filter(b => b !== id)
    : [...localFilters.selectedBranches, id]
  setLocalFilters(prev => ({ ...prev, selectedBranches: next }))
}

const toggleAmenity = (a: string) => {
  const next = localFilters.amenities.includes(a)
    ? localFilters.amenities.filter(x => x !== a)
    : [...localFilters.amenities, a]
  setLocalFilters(prev => ({ ...prev, amenities: next }))
}

  const handleApply = () => {
    onFiltersChange(localFilters)
    onClose()
  }

  const handleReset = () => {
    const reset: FilterState = {
      selectedBranches: [],
      courtType: "all",
      indoorFilter: "all",
      priceRange: [50000, 500000],
      amenities: [],
      minRating: 0,
    }
    setLocalFilters(reset)
    onFiltersChange(reset)
  }

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "w-72 shrink-0 space-y-6",
        "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:bg-card max-lg:p-6 max-lg:shadow-xl max-lg:overflow-y-auto max-lg:transition-transform max-lg:duration-300",
        open ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
      )}>
        <div className="flex items-center justify-between lg:hidden">
          <h3 className="font-serif font-bold text-lg">Bộ lọc</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        {/* Chi nhánh */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Chi nhánh</h4>
          <div className="flex flex-col gap-2">
            {branches.map(b => {
              const courtCount = courts.filter(c => Number(c.branchId) === b.id).length
              return (
                <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={localFilters.selectedBranches.includes(b.id)}
                    onCheckedChange={() => toggleBranch(b.id)}
                  />
                  {b.name.replace("BadmintonHub ", "")}
                  <span className="text-xs text-muted-foreground">({courtCount} sân)</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Loại sân */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Loại sân</h4>
          <RadioGroup
            value={localFilters.courtType}
            onValueChange={(v) => setLocalFilters(prev => ({ ...prev, courtType: v }))}
            className="flex flex-col gap-2"
          >
            {[
              { value: "all", label: "Tất cả" },
              { value: "standard", label: "Standard" },
              { value: "premium", label: "Premium" },
              { value: "vip", label: "VIP" },
            ].map(t => (
              <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value={t.value} /> {t.label}
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Trong nhà / Ngoài trời */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Trong nhà / Ngoài trời</h4>
          <RadioGroup
            value={localFilters.indoorFilter}
            onValueChange={(v) => setLocalFilters(prev => ({ ...prev, indoorFilter: v }))}
            className="flex flex-col gap-2"
          >
            {[
              { value: "all", label: "Tất cả" },
              { value: "indoor", label: "Trong nhà" },
              { value: "outdoor", label: "Ngoài trời" },
            ].map(t => (
              <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value={t.value} /> {t.label}
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Giá */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Giá (VND/h)</h4>
          <Slider
            value={localFilters.priceRange}
            onValueChange={(v) => setLocalFilters(prev => ({ ...prev, priceRange: v as [number, number] }))}
            min={50000}
            max={500000}
            step={10000}
            className="mb-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatVND(localFilters.priceRange[0])}</span>
            <span>{formatVND(localFilters.priceRange[1])}</span>
          </div>
        </div>

        {/* Tiện ích */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Tiện ích</h4>
          <div className="flex flex-col gap-2">
            {["Điều hòa", "Sàn gỗ", "Wi-Fi", "Phòng thay đồ", "Camera"].map(a => (
              <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={localFilters.amenities.includes(a)}
                  onCheckedChange={() => toggleAmenity(a)}
                />
                {a}
              </label>
            ))}
          </div>
        </div>

        {/* Đánh giá */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Đánh giá</h4>
          <RadioGroup
            value={localFilters.minRating.toString()}
            onValueChange={(v) => setLocalFilters(prev => ({ ...prev, minRating: parseInt(v) }))}
            className="flex flex-col gap-2"
          >
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="0" /> Tất cả
            </label>
            {[4, 3, 2].map(r => (
              <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value={r.toString()} />
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: r }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="ml-1">trở lên</span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleApply} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            Áp dụng
          </Button>
          <Button onClick={handleReset} variant="outline" className="w-full">
            Xóa bộ lọc
          </Button>
        </div>
      </aside>
    </>
  )
}

function CourtCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden animate-pulse">
      <div className="aspect-video bg-muted" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="flex gap-1">
          {[1,2,3,4].map(i => <div key={i} className="h-5 w-12 bg-muted rounded" />)}
        </div>
        <div className="h-4 bg-muted rounded w-1/3" />
      </div>
    </div>
  )
}

function CourtCard({ court, index = 0 }: { court: ApiCourt; index?: number }) {
  const slotStatuses = ['available', 'available', 'booked', 'available', 'hold', 'booked'] as const
  const slotTimes = ['06:00', '07:00', '08:00', '14:00', '17:00', '19:00']
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transitionDelay: `${(index % 4) * 80}ms`,
      }}
    >
      <Link href={`/courts/${court.id}`}>
        <Card className="group overflow-hidden hover:-translate-y-1.5 transition-all duration-300 hover:shadow-xl cursor-pointer">
          <div className="relative aspect-video bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center overflow-hidden">
            <div className="text-center text-secondary/25 font-serif font-bold text-2xl group-hover:scale-110 transition-transform duration-500">
              {court.name.split(' - ')[0]}
            </div>
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors duration-300 flex items-center justify-center">
              <span className="flex items-center gap-2 text-white font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                Xem lịch <ChevronRight className="h-4 w-4" />
              </span>
            </div>
            {/* Badges */}
            <div className="absolute top-3 left-3 flex gap-1.5">
              <span className="inline-flex items-center rounded-md bg-card/90 backdrop-blur-sm px-2 py-1 text-xs font-medium capitalize">
                {court.type}
              </span>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium backdrop-blur-sm",
                court.indoor
                  ? "bg-blue-100/90 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
                  : "bg-orange-100/90 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300"
              )}>
                {court.indoor ? <Home className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
                {court.indoor ? "Trong nhà" : "Ngoài trời"}
              </span>
            </div>
          </div>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <h3 className="font-serif font-bold text-foreground truncate">{court.name}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{court.address || court.branch}</span>
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm shrink-0">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="font-semibold">{court.rating}</span>
              </div>
            </div>

            {/* Slot pills */}
            <div className="mt-3 flex flex-wrap gap-1">
              {slotTimes.map((t, i) => (
                <span key={t} className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-medium border",
                  slotStatuses[i] === 'available'
                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                    : slotStatuses[i] === 'booked'
                    ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
                )}>
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="font-serif font-bold text-primary">
                {formatVND(court.price)}<span className="text-xs text-muted-foreground font-normal">/h</span>
              </span>
              {court.available && (
                <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  Còn trống
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}

export default function CourtsPage() {
  const [filterOpen, setFilterOpen] = useState(false)
  const [activeDay, setActiveDay] = useState(0)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState('rating')
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const weekDays = getWeekDays()

  const [courts, setCourts] = useState<ApiCourt[]>([])
  const [branches, setBranches] = useState<ApiBranch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      courtApi.getAll(),
      branchApi.getAll(),
    ]).then(([c, b]) => {
      setCourts(c)
      setBranches(b)
      setLoading(false)
    })
  }, [])

  const openCourts = useMemo(() => courts.filter(c => c.available !== false), [courts])

  const branchCourtCount = useMemo(() => {
    const counts: Record<number, number> = {}
    openCourts.forEach(c => {
      const bid = Number(c.branchId)
      counts[bid] = (counts[bid] || 0) + 1
    })
    return counts
  }, [openCourts])

  const [filters, setFilters] = useState<FilterState>({
    selectedBranches: [],
    courtType: "all",
    indoorFilter: "all",
    priceRange: [50000, 500000],
    amenities: [],
    minRating: 0,
  })

  const filteredCourts = useMemo(() => {
    let result = [...openCourts]

    if (selectedBranch !== 'all') {
      result = result.filter(c => Number(c.branchId) === parseInt(selectedBranch))
    }

    if (filters.selectedBranches.length > 0) {
      result = result.filter(c => filters.selectedBranches.includes(Number(c.branchId)))
    }

    if (filters.courtType !== "all") {
      result = result.filter(c => c.type?.toLowerCase() === filters.courtType.toLowerCase())
    }

    if (filters.indoorFilter === "indoor") {
      result = result.filter(c => c.indoor === true)
    } else if (filters.indoorFilter === "outdoor") {
      result = result.filter(c => c.indoor === false)
    }

    result = result.filter(c => Number(c.price) >= filters.priceRange[0] && Number(c.price) <= filters.priceRange[1])

    if (filters.amenities.length > 0) {
      result = result.filter(c =>
        filters.amenities.every(a => c.amenities.includes(a))
      )
    }

    if (filters.minRating > 0) {
      result = result.filter(c => c.rating >= filters.minRating)
    }

    switch (sortBy) {
      case 'rating':     result.sort((a, b) => b.rating - a.rating); break
      case 'price-asc':  result.sort((a, b) => a.price - b.price);   break
      case 'price-desc': result.sort((a, b) => b.price - a.price);   break
    }

    return result
  }, [filters, sortBy, selectedBranch, openCourts])

  // Group theo chi nhánh để hiển thị
  const groupedCourts = useMemo(() => {
    const groups: { branch: ApiBranch; courts: ApiCourt[] }[] = []
    const branchMap = new Map<number, ApiCourt[]>()
    filteredCourts.forEach(c => {
      const bid = Number(c.branchId)
      if (!branchMap.has(bid)) branchMap.set(bid, [])
      branchMap.get(bid)!.push(c)
    })
    branches.forEach(b => {
      const bCourts = branchMap.get(b.id)
      if (bCourts && bCourts.length > 0) {
        groups.push({ branch: b, courts: bCourts })
      }
    })
    return groups
  }, [filteredCourts, branches])

  const activeFilterCount = [
    filters.selectedBranches.length > 0,
    filters.courtType !== "all",
    filters.indoorFilter !== "all",
    filters.priceRange[0] > 50000 || filters.priceRange[1] < 500000,
    filters.amenities.length > 0,
    filters.minRating > 0,
  ].filter(Boolean).length

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Page header */}
        <div className="border-b bg-card">
          <div className="mx-auto max-w-7xl px-4 py-6">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Hệ thống 3 cơ sở</p>
            <h1 className="font-serif text-2xl font-extrabold text-foreground lg:text-3xl">Tìm sân cầu lông</h1>
            <p className="text-muted-foreground mt-1 text-sm">Chọn ngày, cơ sở và đặt sân phù hợp với bạn</p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6">
          {/* Branch selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Cơ sở:</span>
            </div>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-64 h-9">
                <SelectValue placeholder="Chọn cơ sở" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    Tất cả cơ sở
                    <Badge variant="secondary" className="text-xs ml-1">{openCourts.length} sân</Badge>
                  </span>
                </SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id.toString()}>
                    <span className="flex items-center gap-2">
                      {b.name.replace("BadmintonHub ", "")}
                      <Badge variant="secondary" className="text-xs ml-1">{branchCourtCount[b.id] || 0} sân</Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 7-day tab bar */}
          <div className="mt-5 flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
            {weekDays.map((d, i) => (
              <button
                key={i}
                onClick={() => setActiveDay(i)}
                className={cn(
                  "relative flex flex-col items-center px-4 py-2.5 rounded-xl text-sm transition-all duration-200 shrink-0 font-medium",
                  activeDay === i
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-[1.05]"
                    : "bg-muted text-muted-foreground hover:bg-muted/70 hover:scale-[1.02]"
                )}
              >
                <span className="text-[11px] opacity-80">{d.dayName}</span>
                <span className="font-bold text-base leading-tight">{d.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex gap-6">
            {/* Filter Sidebar */}
            <FilterSidebar
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              filters={filters}
              onFiltersChange={setFilters}
              branches={branches}
              courts={courts}
            />

            {/* Results */}
            <div className="flex-1 min-w-0">
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 lg:hidden"
                    onClick={() => setFilterOpen(true)}
                  >
                    <Filter className="h-4 w-4" /> Bộ lọc
                    {activeFilterCount > 0 && (
                      <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {loading ? "Đang tải..." : `${filteredCourts.length} sân`}
                    {!loading && activeFilterCount > 0 && ` (đã lọc từ ${openCourts.length})`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-36 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rating">Đánh giá cao</SelectItem>
                      <SelectItem value="price-asc">Giá tăng</SelectItem>
                      <SelectItem value="price-desc">Giá giảm</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={cn("p-1.5 transition-colors", viewMode === 'grid' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={cn("p-1.5 transition-colors", viewMode === 'list' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Active filter chips */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {filters.selectedBranches.map(bid => {
                    const branch = branches.find(b => b.id === bid)
                    return branch ? (
                      <span key={bid} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                        {branch.name.replace("BadmintonHub ", "")}
                        <button onClick={() => setFilters(prev => ({ ...prev, selectedBranches: prev.selectedBranches.filter(b => b !== bid) }))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : null
                  })}
                  {filters.courtType !== "all" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium capitalize">
                      {filters.courtType}
                      <button onClick={() => setFilters(prev => ({ ...prev, courtType: "all" }))}><X className="h-3 w-3" /></button>
                    </span>
                  )}
                  {filters.indoorFilter !== "all" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                      {filters.indoorFilter === "indoor" ? "Trong nhà" : "Ngoài trời"}
                      <button onClick={() => setFilters(prev => ({ ...prev, indoorFilter: "all" }))}><X className="h-3 w-3" /></button>
                    </span>
                  )}
                  {filters.amenities.map(a => (
                    <span key={a} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                      {a}
                      <button onClick={() => setFilters(prev => ({ ...prev, amenities: prev.amenities.filter(x => x !== a) }))}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                  {filters.minRating > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                      {filters.minRating}★ trở lên
                      <button onClick={() => setFilters(prev => ({ ...prev, minRating: 0 }))}><X className="h-3 w-3" /></button>
                    </span>
                  )}
                  <button
                    onClick={() => setFilters({ selectedBranches: [], courtType: "all", indoorFilter: "all", priceRange: [50000, 500000], amenities: [], minRating: 0 })}
                    className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    Xóa tất cả
                  </button>
                </div>
              )}

              {/* Court list */}
              {loading ? (
                <div className="space-y-8">
                  {[1].map(g => (
                    <div key={g}>
                      <div className="h-5 w-40 bg-muted rounded animate-pulse mb-4" />
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {[1, 2, 3, 4].map(i => <CourtCardSkeleton key={i} />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredCourts.length > 0 ? (
                <div className="space-y-8">
                  {groupedCourts.map(({ branch, courts: branchCourts }) => (
                    <div key={branch.id}>
                      <div className="flex items-center gap-2 mb-4">
                        <MapPin className="h-4 w-4 text-primary" />
                        <h2 className="font-serif font-bold text-lg">{branch.name}</h2>
                        <Badge variant="outline" className="text-xs">{branchCourts.length} sân</Badge>
                      </div>
                      <div className={cn(
                        viewMode === 'grid'
                          ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
                          : "flex flex-col gap-4"
                      )}>
                        {branchCourts.map((court, i) => (
                          <CourtCard key={court.id} court={court} index={i} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Filter className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-serif font-bold text-lg">Không tìm thấy sân phù hợp</h3>
                  <p className="text-muted-foreground mt-1 text-sm">Thử thay đổi bộ lọc để xem thêm kết quả</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setFilters({ selectedBranches: [], courtType: "all", indoorFilter: "all", priceRange: [50000, 500000], amenities: [], minRating: 0 })}
                  >
                    Xóa bộ lọc
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}