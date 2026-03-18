"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Star, Heart, ShoppingCart, Search, Minus, Plus, ChevronDown, ChevronRight, Package, X, SlidersHorizontal, Grid3X3, LayoutList, Filter, Eye, Truck, Shield, RotateCcw, Check } from "lucide-react"
import { useState, useMemo, useEffect, useRef } from "react"
import { useCart } from "@/lib/cart-context"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { formatVND } from "@/lib/utils"
import { productApi, type ApiProduct } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis
} from "@/components/ui/pagination"

const SHOP_PAGE_SIZE = 12

// CartItem type from shared context
import type { CartItem } from "@/lib/cart-context"

interface ShopFilterState {
  category: string
  selectedBrands: string[]
  priceRange: [number, number]
  minRating: number
}

function FilterSidebar({
  open,
  onClose,
  filters,
  onFiltersChange,
  categoryNames,
  allBrands,
}: {
  open: boolean
  onClose: () => void
  filters: ShopFilterState
  onFiltersChange: (f: ShopFilterState) => void
  categoryNames: string[]
  allBrands: string[]
}) {
  const [localFilters, setLocalFilters] = useState<ShopFilterState>(filters)

  const toggleBrand = (brand: string) => {
    const next = localFilters.selectedBrands.includes(brand)
      ? localFilters.selectedBrands.filter(b => b !== brand)
      : [...localFilters.selectedBrands, brand]
    const updated = { ...localFilters, selectedBrands: next }
    setLocalFilters(updated)
    onFiltersChange(updated)   // ← apply ngay
  }

  const handleApply = () => {
    onFiltersChange(localFilters)
    onClose()
  }

  const handleReset = () => {
    const reset: ShopFilterState = {
      category: "Tất cả",
      selectedBrands: [],
      priceRange: [0, 10000000],
      minRating: 0,
    }
    setLocalFilters(reset)
    onFiltersChange(reset)
  }

  return (
    <aside className={cn(
      "w-72 shrink-0 space-y-6",
      "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:bg-card max-lg:p-6 max-lg:shadow-xl max-lg:overflow-y-auto max-lg:transition-transform max-lg:duration-300",
      open ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
    )}>
      <div className="flex items-center justify-between lg:hidden">
        <h3 className="font-serif font-bold text-lg">Bộ lọc</h3>
        <button onClick={onClose}><X className="h-5 w-5" /></button>
      </div>

      {/* Category */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Danh mục</h4>
        <RadioGroup
          value={localFilters.category}
          onValueChange={(v) => setLocalFilters(prev => ({ ...prev, category: v }))}
          className="flex flex-col gap-2"
        >
          {categoryNames.map(cat => (
            <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value={cat} /> {cat}
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Brand */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Thương hiệu</h4>
        <div className="flex flex-col gap-2">
          {allBrands.map(b => (
            <label key={b} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={localFilters.selectedBrands.includes(b)}
                onCheckedChange={() => toggleBrand(b)}
              />
              {b}
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Giá (VND)</h4>
        <Slider
          value={localFilters.priceRange}
          onValueChange={(v) => {
            const updated = { ...localFilters, priceRange: v as [number, number] }
            setLocalFilters(updated)
            onFiltersChange(updated)   // ← apply ngay
          }}
          min={0}
          max={10000000}
          step={100000}
          className="mb-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatVND(localFilters.priceRange[0])}</span>
          <span>{formatVND(localFilters.priceRange[1])}</span>
        </div>
      </div>

      {/* Rating */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Đánh giá</h4>
        <RadioGroup
          value={localFilters.minRating.toString()}
          onValueChange={(v) => { const u = { ...localFilters, minRating: parseInt(v) }; setLocalFilters(u); onFiltersChange(u) }}
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
  )
}

function ProductCard({ product, onAddToCart, onViewDetail, wishlist, onToggleWishlist, index = 0 }: {
  product: ApiProduct
  onAddToCart: () => void
  onViewDetail: () => void
  wishlist: boolean
  onToggleWishlist: () => void
  index?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [added, setAdded] = useState(false)

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

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    onAddToCart()
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  return (
    <div
      ref={ref}
      className="transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transitionDelay: `${(index % 3) * 80}ms`,
      }}
    >
      <Card className="group overflow-hidden hover:-translate-y-1.5 transition-all duration-300 hover:shadow-xl cursor-pointer" onClick={onViewDetail}>
        <div className="relative aspect-square bg-gradient-to-br from-muted to-background flex items-center justify-center overflow-hidden">
          <span className="text-5xl text-muted-foreground/15 font-serif font-bold group-hover:scale-110 transition-transform duration-500">{product.brand[0]}</span>
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.badges.map(b => (
              <span key={b} className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                b === 'Bán chạy' ? 'bg-primary text-primary-foreground' :
                  b === 'Mới' ? 'bg-secondary text-secondary-foreground' :
                    'bg-red-500 text-white'
              )}>{b}</span>
            ))}
          </div>
          {/* Wishlist */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleWishlist() }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-card/80 hover:bg-card transition-all duration-200 hover:scale-110"
          >
            <Heart className={cn("h-4 w-4 transition-all duration-200", wishlist ? "fill-red-500 text-red-500 scale-110" : "text-muted-foreground")} />
          </button>
          {/* Hover overlay */}
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-250 flex">
            <Button onClick={(e) => { e.stopPropagation(); onViewDetail() }} variant="secondary" className="flex-1 rounded-none font-semibold gap-1 h-10">
              <Eye className="h-4 w-4" /> Xem chi tiết
            </Button>
            <Button
              onClick={handleAddToCart}
              className={cn(
                "flex-1 rounded-none font-semibold gap-1 h-10 transition-all duration-200",
                added ? "bg-green-600 hover:bg-green-600" : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {added ? (
                <><Check className="h-4 w-4" /> Đã thêm!</>
              ) : (
                <><ShoppingCart className="h-4 w-4" /> Thêm vào giỏ</>
              )}
            </Button>
          </div>
        </div>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground font-medium">{product.brand}</p>
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 mt-0.5 leading-snug">{product.name}</h3>
          <div className="flex items-center gap-1 mt-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={cn("h-3 w-3", i < Math.floor(product.rating) ? "fill-amber-400 text-amber-400" : "text-muted")} />
            ))}
            <span className="text-xs text-muted-foreground ml-1">({product.reviews})</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-serif font-bold text-primary">{formatVND(product.price)}</span>
            {product.originalPrice && (
              <span className="text-xs text-muted-foreground line-through">{formatVND(product.originalPrice)}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ProductDetailDialog({ product, open, onOpenChange, onAddToCart, wishlist, onToggleWishlist }: {
  product: ApiProduct | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToCart: (p: ApiProduct) => void
  wishlist: boolean
  onToggleWishlist: () => void
}) {
  const [qty, setQty] = useState(1)

  if (!product) return null

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{product.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
          {/* Product Image */}
          <div className="relative aspect-square rounded-xl bg-gradient-to-br from-muted to-background flex items-center justify-center overflow-hidden">
            <span className="text-7xl text-muted-foreground/10 font-serif font-bold">{product.brand[0]}</span>
            <div className="absolute top-3 left-3 flex flex-col gap-1">
              {product.badges.map(b => (
                <Badge key={b} className={cn(
                  b === 'Bán chạy' ? 'bg-primary text-primary-foreground' :
                    b === 'Mới' ? 'bg-secondary text-secondary-foreground' :
                      'bg-red-500 text-white'
                )}>{b}</Badge>
              ))}
            </div>
            <button
              onClick={onToggleWishlist}
              className="absolute top-3 right-3 p-2 rounded-full bg-card/80 hover:bg-card transition-colors"
            >
              <Heart className={cn("h-5 w-5", wishlist ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
            </button>
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <p className="text-sm text-muted-foreground">{product.brand} • {product.category}</p>

            {/* Rating */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={cn("h-4 w-4", i < Math.floor(product.rating) ? "fill-amber-400 text-amber-400" : "text-muted")} />
                ))}
              </div>
              <span className="text-sm font-medium">{product.rating}</span>
              <span className="text-sm text-muted-foreground">({product.reviews} đánh giá)</span>
            </div>

            {/* Price */}
            <div className="mt-4">
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-2xl font-extrabold text-primary">{formatVND(product.price)}</span>
                {product.originalPrice && (
                  <span className="text-sm text-muted-foreground line-through">{formatVND(product.originalPrice)}</span>
                )}
              </div>
              {discount > 0 && (
                <Badge variant="outline" className="mt-1 text-red-600 border-red-200 bg-red-50">Giảm {discount}%</Badge>
              )}
            </div>

            <Separator className="my-4" />

            {/* Stock */}
            <div className="flex items-center gap-2 text-sm">
              {product.inStock ? (
                <><span className="h-2 w-2 rounded-full bg-green-500" /><span className="text-green-700 font-medium">Còn hàng</span></>
              ) : (
                <><span className="h-2 w-2 rounded-full bg-red-500" /><span className="text-red-700 font-medium">Hết hàng</span></>
              )}
            </div>

            {/* Quantity */}
            <div className="mt-4">
              <p className="text-sm font-semibold mb-2">Số lượng</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="h-9 w-9 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-bold text-lg w-8 text-center">{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  className="h-9 w-9 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Add to cart */}
            <Button
              onClick={() => {
                for (let i = 0; i < qty; i++) onAddToCart(product)
                setQty(1)
                onOpenChange(false)
              }}
              disabled={!product.inStock}
              className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2 h-12"
            >
              <ShoppingCart className="h-5 w-5" />
              Thêm vào giỏ — {formatVND(product.price * qty)}
            </Button>

            <Separator className="my-4" />

            {/* Policies */}
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Truck className="h-3.5 w-3.5 text-primary" />
                <span>Miễn phí vận chuyển đơn từ {formatVND(500000)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span>Chính hãng 100% — Bảo hành 12 tháng</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5 text-primary" />
                <span>Đổi trả miễn phí trong 30 ngày</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CartSheet({ cart, onUpdateQty, onRemove, onCheckout }: {
  cart: CartItem[]
  onUpdateQty: (id: number, delta: number) => void
  onRemove: (id: number) => void
  onCheckout: () => void
}) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0)

  return (
    <SheetContent className="w-full sm:w-96 flex flex-col">
      <SheetHeader>
        <SheetTitle className="font-serif">Giỏ hàng ({cart.length})</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto mt-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="font-semibold text-muted-foreground">Giỏ hàng trống</p>
            <p className="text-sm text-muted-foreground mt-1">Thêm sản phẩm để bắt đầu mua sắm</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {cart.map(item => (
              <div key={item.productId} className="flex gap-3 pb-4 border-b">
                <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <span className="text-muted-foreground/30 text-xl font-bold">P</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold line-clamp-1">{item.name}</p>
                  <p className="text-sm text-primary font-bold mt-0.5">{formatVND(item.price)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => onUpdateQty(item.productId, -1)} className="h-7 w-7 rounded border flex items-center justify-center hover:bg-muted transition-colors">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
                    <button onClick={() => onUpdateQty(item.productId, 1)} className="h-7 w-7 rounded border flex items-center justify-center hover:bg-muted transition-colors">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <button onClick={() => onRemove(item.productId)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {cart.length > 0 && (
        <div className="border-t pt-4 space-y-3">
          <div className="flex justify-between font-serif font-bold text-lg">
            <span>Tạm tính</span>
            <span className="text-primary">{formatVND(subtotal)}</span>
          </div>
          <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" onClick={onCheckout}>
            Thanh toán
          </Button>
        </div>
      )}
    </SheetContent>
  )
}

export default function ShopPage() {
  const router = useRouter()
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<ShopFilterState>({
    category: "Tất cả",
    selectedBrands: [],
    priceRange: [0, 10000000],
    minRating: 0,
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("default")
  const [wishlistIds, setWishlistIds] = useState<number[]>([1, 3])
  const { cart, addToCart: cartAdd, updateQty: cartUpdateQty, removeFromCart: cartRemove } = useCart()
  const [detailProduct, setDetailProduct] = useState<ApiProduct | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Load products, categories, brands from API
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [categoryNames, setCategoryNames] = useState<string[]>(["Tất cả"])
  const [allBrands, setAllBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await productApi.getAll({ limit: 200 })
        setProducts(res.products || [])
      } catch (err) {
        console.error('[SHOP] Product load error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadProducts()
    productApi.getCategories().then(cats => setCategoryNames(["Tất cả", ...cats]))
    productApi.getBrands().then(brands => setAllBrands(brands))
  }, [])

  // Filter products
  const filteredProducts = useMemo(() => {
    let result = [...products]

    // Category filter
    if (filters.category !== "Tất cả") {
      result = result.filter(p => p.category === filters.category)
    }

    // Brand filter
    if (filters.selectedBrands.length > 0) {
      result = result.filter(p => filters.selectedBrands.includes(p.brand?.trim()))
    }

    // Price filter — Number() để chắc chắn là số
    result = result.filter(p => Number(p.price) >= filters.priceRange[0] && Number(p.price) <= filters.priceRange[1])

    // Rating filter
    if (filters.minRating > 0) {
      result = result.filter(p => p.rating >= filters.minRating)
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      )
    }

    // Sort
    switch (sortBy) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price)
        break
      case "price-desc":
        result.sort((a, b) => b.price - a.price)
        break
      case "rating":
        result.sort((a, b) => b.rating - a.rating)
        break
      case "popular":
        result.sort((a, b) => b.reviews - a.reviews)
        break
    }

    return result
  }, [products, filters, searchQuery, sortBy])

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / SHOP_PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedProducts = useMemo(() => {
    const start = (safePage - 1) * SHOP_PAGE_SIZE
    return filteredProducts.slice(start, start + SHOP_PAGE_SIZE)
  }, [filteredProducts, safePage])

  // Reset to page 1 when filters change
  const handleFiltersChange = (f: ShopFilterState) => { setFilters(f); setCurrentPage(1) }

  const getPageNumbers = () => {
    const pages: (number | "...")[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (safePage > 3) pages.push("...")
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i)
      if (safePage < totalPages - 2) pages.push("...")
      pages.push(totalPages)
    }
    return pages
  }

  const addToCart = (product: ApiProduct) => {
    cartAdd({ productId: product.id, name: product.name, price: product.price })
    toast.success(`Đã thêm "${product.name}" vào giỏ hàng`, {
      description: formatVND(product.price),
      action: { label: "Xem giỏ", onClick: () => {} },
    })
  }

  const updateCartQty = (id: number, delta: number) => {
    cartUpdateQty(id, delta)
  }

  const removeFromCart = (id: number) => {
    cartRemove(id)
  }

  const toggleWishlist = (id: number) => {
    setWishlistIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="font-serif text-3xl font-extrabold text-foreground lg:text-4xl">Cửa hàng</h1>
              <p className="text-muted-foreground mt-1">Phụ kiện cầu lông chính hãng — Đầy đủ thương hiệu hàng đầu</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="lg:hidden gap-2" onClick={() => setFilterOpen(true)}>
                <Filter className="h-4 w-4" /> Bộ lọc
              </Button>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="gap-2 relative">
                    <ShoppingCart className="h-4 w-4" />
                    Giỏ hàng
                    {cart.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {cart.reduce((s, i) => s + i.qty, 0)}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <CartSheet cart={cart} onUpdateQty={updateCartQty} onRemove={removeFromCart} onCheckout={() => {
                  router.push("/shop/checkout")
                }} />
              </Sheet>
            </div>
          </div>

          {/* Search + Sort Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm sản phẩm..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-52 bg-white">
                <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Sắp xếp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Mặc định</SelectItem>
                <SelectItem value="price-asc">Giá: Thấp → Cao</SelectItem>
                <SelectItem value="price-desc">Giá: Cao → Thấp</SelectItem>
                <SelectItem value="rating">Đánh giá cao nhất</SelectItem>
                <SelectItem value="popular">Phổ biến nhất</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category quick-filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
            {categoryNames.map(cat => (
              <button
                key={cat}
                onClick={() => { handleFiltersChange({ ...filters, category: cat }); setCurrentPage(1) }}
                className={cn(
                  "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                  filters.category === cat
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25 scale-[1.04]"
                    : "bg-muted text-muted-foreground hover:bg-muted/70 hover:scale-[1.02]"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex gap-8">
            {/* Filter overlay for mobile */}
            {filterOpen && (
              <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setFilterOpen(false)} />
            )}

            <FilterSidebar
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              categoryNames={categoryNames}
              allBrands={allBrands}
            />

            <div className="flex-1 min-w-0">
              {/* Results count */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {loading ? "Đang tải sản phẩm..." : (
                    <>Hiển thị <strong className="text-foreground">{(safePage - 1) * SHOP_PAGE_SIZE + 1}–{Math.min(safePage * SHOP_PAGE_SIZE, filteredProducts.length)}</strong> / <strong className="text-foreground">{filteredProducts.length}</strong> sản phẩm
                    {filters.category !== "Tất cả" && <> trong <strong className="text-foreground">{filters.category}</strong></>}</>
                  )}
                </p>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl border bg-card overflow-hidden animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="aspect-square bg-muted" />
                      <div className="p-3 space-y-2">
                        <div className="h-3 bg-muted rounded w-1/3" />
                        <div className="h-4 bg-muted rounded w-4/5" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                        <div className="h-4 bg-muted rounded w-2/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="font-serif font-bold text-lg">Không tìm thấy sản phẩm</h3>
                  <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                    Thử thay đổi bộ lọc hoặc tìm kiếm với từ khóa khác
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setFilters({ category: "Tất cả", selectedBrands: [], priceRange: [0, 10000000], minRating: 0 })}
                  >
                    Xóa bộ lọc
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {paginatedProducts.map((p, i) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        index={i}
                        onAddToCart={() => addToCart(p)}
                        onViewDetail={() => router.push(`/shop/${p.id}`)}
                        wishlist={wishlistIds.includes(p.id)}
                        onToggleWishlist={() => toggleWishlist(p.id)}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }) }}
                              className={cn("cursor-pointer", safePage === 1 && "pointer-events-none opacity-50")}
                            />
                          </PaginationItem>
                          {getPageNumbers().map((page, i) => (
                            <PaginationItem key={i}>
                              {page === "..." ? (
                                <PaginationEllipsis />
                              ) : (
                                <PaginationLink
                                  isActive={page === safePage}
                                  onClick={() => { setCurrentPage(page as number); window.scrollTo({ top: 0, behavior: "smooth" }) }}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              )}
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }) }}
                              className={cn("cursor-pointer", safePage === totalPages && "pointer-events-none opacity-50")}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Product Detail Dialog */}
      <ProductDetailDialog
        product={detailProduct}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAddToCart={addToCart}
        wishlist={detailProduct ? wishlistIds.includes(detailProduct.id) : false}
        onToggleWishlist={() => { if (detailProduct) toggleWishlist(detailProduct.id) }}
      />

      <Footer />
    </div>
  )
}