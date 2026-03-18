"use client"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { formatVND } from "@/lib/utils"
import { productApi, type ApiProduct } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useCart } from "@/lib/cart-context"
import {
  Star, Heart, ShoppingCart, Minus, Plus, Truck, Shield, RotateCcw,
  ArrowLeft, Share2, Package, ChevronRight, CheckCircle2, Info,
  Ruler, Weight, Zap, Target, Globe, Award, ChevronLeft
} from "lucide-react"

/* ─── Related products ─── */
function RelatedProductCard({ product, index = 0 }: { product: ApiProduct; index?: number }) {
  const router = useRouter()
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
        transitionDelay: `${index * 80}ms`,
      }}
    >
      <Card
        className="group overflow-hidden hover:-translate-y-1.5 transition-all duration-300 hover:shadow-xl cursor-pointer"
        onClick={() => router.push(`/shop/${product.id}`)}
      >
        <div className="relative aspect-square bg-gradient-to-br from-muted to-background flex items-center justify-center overflow-hidden">
          {product.image && (
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-contain p-4 group-hover:scale-110 transition-transform duration-500"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
          )}
          <span className="text-5xl text-muted-foreground/10 font-serif font-bold absolute group-hover:scale-125 transition-transform duration-500">{product.brand[0]}</span>
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.badges.map(b => (
              <Badge key={b} className={cn(
                "text-[10px] rounded-full",
                b === "Bán chạy" ? "bg-primary text-primary-foreground" :
                  b === "Mới" ? "bg-secondary text-secondary-foreground" :
                    "bg-red-500 text-white"
              )}>{b}</Badge>
            ))}
          </div>
        </div>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground font-medium">{product.brand}</p>
          <h3 className="text-sm font-semibold line-clamp-2 mt-0.5 leading-snug">{product.name}</h3>
          <div className="flex items-center gap-1 mt-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={cn("h-3 w-3", i < Math.floor(product.rating) ? "fill-amber-400 text-amber-400" : "text-muted")} />
            ))}
            <span className="text-xs text-muted-foreground ml-1">({product.reviews})</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-serif font-bold text-primary text-sm">{formatVND(product.price)}</span>
            {product.originalPrice && (
              <span className="text-xs text-muted-foreground line-through">{formatVND(product.originalPrice)}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Image Gallery ─── */
function ImageGallery({ images, name, brand, badges }: {
  images: string[]
  name: string
  brand: string
  badges: string[]
}) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [imgError, setImgError] = useState<Set<number>>(new Set())

  const goPrev = () => setActiveIdx(i => (i === 0 ? images.length - 1 : i - 1))
  const goNext = () => setActiveIdx(i => (i === images.length - 1 ? 0 : i + 1))

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative aspect-square rounded-2xl bg-gradient-to-br from-muted/50 to-background border overflow-hidden group">
        {images.length > 0 && !imgError.has(activeIdx) ? (
          <Image
            src={images[activeIdx]}
            alt={`${name} - ${activeIdx + 1}`}
            fill
            className="object-contain p-6 transition-transform duration-300 group-hover:scale-105"
            priority
            onError={() => setImgError(prev => new Set(prev).add(activeIdx))}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-8xl text-muted-foreground/10 font-serif font-bold">{brand[0]}</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
          {badges.map(b => (
            <Badge key={b} className={cn(
              "text-xs px-2.5 py-1",
              b === "Bán chạy" ? "bg-primary text-primary-foreground" :
                b === "Mới" ? "bg-secondary text-secondary-foreground" :
                  "bg-red-500 text-white"
            )}>{b}</Badge>
          ))}
        </div>

        {/* Nav arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-card/80 backdrop-blur-sm border shadow-sm flex items-center justify-center hover:bg-card transition-colors opacity-0 group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-card/80 backdrop-blur-sm border shadow-sm flex items-center justify-center hover:bg-card transition-colors opacity-0 group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
            {activeIdx + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={cn(
                "relative h-20 w-20 rounded-xl border-2 overflow-hidden shrink-0 transition-all",
                activeIdx === i ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/50"
              )}
            >
              {!imgError.has(i) ? (
                <Image
                  src={img}
                  alt={`${name} thumb ${i + 1}`}
                  fill
                  className="object-contain p-2"
                  onError={() => setImgError(prev => new Set(prev).add(i))}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-muted">
                  <span className="text-lg text-muted-foreground/30 font-serif font-bold">{brand[0]}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Spec icons ─── */
const specIcons: Record<string, React.ReactNode> = {
  weight: <Weight className="h-4 w-4" />,
  balance: <Target className="h-4 w-4" />,
  shaft: <Zap className="h-4 w-4" />,
  length: <Ruler className="h-4 w-4" />,
  maxTension: <Zap className="h-4 w-4" />,
  material: <Package className="h-4 w-4" />,
  madeIn: <Globe className="h-4 w-4" />,
  level: <Award className="h-4 w-4" />,
  sole: <Package className="h-4 w-4" />,
  cushion: <Shield className="h-4 w-4" />,
  upper: <Package className="h-4 w-4" />,
  color: <Package className="h-4 w-4" />,
  gauge: <Ruler className="h-4 w-4" />,
  tension: <Zap className="h-4 w-4" />,
  capacity: <Package className="h-4 w-4" />,
  compartments: <Package className="h-4 w-4" />,
  dimensions: <Ruler className="h-4 w-4" />,
  shoulder: <Package className="h-4 w-4" />,
  type: <Info className="h-4 w-4" />,
  thickness: <Ruler className="h-4 w-4" />,
  width: <Ruler className="h-4 w-4" />,
  sizes: <Ruler className="h-4 w-4" />,
  fit: <Package className="h-4 w-4" />,
  technology: <Zap className="h-4 w-4" />,
  qty: <Package className="h-4 w-4" />,
  speed: <Zap className="h-4 w-4" />,
  grade: <Award className="h-4 w-4" />,
  style: <Package className="h-4 w-4" />,
  size: <Ruler className="h-4 w-4" />,
  insulation: <Shield className="h-4 w-4" />,
}

const specLabels: Record<string, string> = {
  weight: "Trọng lượng", balance: "Điểm cân bằng", shaft: "Thân vợt", length: "Chiều dài",
  maxTension: "Sức căng tối đa", material: "Chất liệu", madeIn: "Xuất xứ", level: "Trình độ",
  sole: "Đế giày", cushion: "Đệm", upper: "Thân giày", color: "Màu sắc",
  gauge: "Đường kính", tension: "Sức căng", capacity: "Sức chứa", compartments: "Ngăn",
  dimensions: "Kích thước", shoulder: "Quai đeo", type: "Loại", thickness: "Độ dày",
  width: "Độ rộng", sizes: "Size", fit: "Kiểu dáng", technology: "Công nghệ",
  qty: "Số lượng", speed: "Tốc độ", grade: "Cấp độ", style: "Kiểu", size: "Kích cỡ", insulation: "Giữ nhiệt",
}

/* ─── Main Page ─── */
export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { addToCart: cartAdd, setCart: cartSetCart } = useCart()
  const [qty, setQty] = useState(1)
  const [wishlist, setWishlist] = useState(false)

  const productId = typeof params.id === "string" ? parseInt(params.id) : 0

  // Fetch product and related products from API
  const [product, setProduct] = useState<ApiProduct | null>(null)
  const [moreProducts, setMoreProducts] = useState<ApiProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      productApi.getById(productId),
      productApi.getAll({ limit: 200 }),
    ]).then(([prod, allRes]) => {
      setProduct(prod)
      if (prod && allRes.products) {
        const same = allRes.products.filter(p => p.id !== prod.id && p.category === prod.category).slice(0, 4)
        const fill = same.length < 4
          ? [...same, ...allRes.products.filter(p => p.id !== prod.id && !same.find(r => r.id === p.id)).slice(0, 4 - same.length)]
          : same
        setMoreProducts(fill)
      }
      setLoading(false)
    })
  }, [productId])

  const [added, setAdded] = useState(false)
  const [pageVisible, setPageVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setPageVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  const addToCart = () => {
    if (!product) return
    cartAdd({ productId: product.id, name: product.name, price: product.price, qty })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
    toast.success(`Đã thêm "${product.name}" vào giỏ hàng`, {
      description: `${qty} x ${formatVND(product.price)} = ${formatVND(product.price * qty)}`,
      action: { label: "Thanh toán", onClick: () => router.push("/shop/checkout") },
    })
  }

  const buyNow = () => {
    if (!product) return
    cartSetCart([{ productId: product.id, name: product.name, price: product.price, qty }])
    router.push("/shop/checkout")
  }

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: product?.name, url: window.location.href })
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success("Đã sao chép link sản phẩm")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
            <div className="h-4 w-56 bg-muted rounded animate-pulse" />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="aspect-square rounded-2xl bg-muted animate-pulse" />
                <div className="flex gap-2">
                  {[1,2,3].map(i => <div key={i} className="h-20 w-20 rounded-xl bg-muted animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />)}
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="h-8 w-3/4 bg-muted rounded animate-pulse" style={{ animationDelay: "80ms" }} />
                <div className="h-4 w-1/2 bg-muted rounded animate-pulse" style={{ animationDelay: "160ms" }} />
                <div className="h-20 bg-muted rounded-xl animate-pulse" style={{ animationDelay: "240ms" }} />
                <div className="h-4 bg-muted rounded animate-pulse" style={{ animationDelay: "320ms" }} />
                <div className="h-12 bg-muted rounded-xl animate-pulse" style={{ animationDelay: "400ms" }} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-12 bg-muted rounded-xl animate-pulse" style={{ animationDelay: "480ms" }} />
                  <div className="h-12 bg-muted rounded-xl animate-pulse" style={{ animationDelay: "560ms" }} />
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Package className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="font-serif text-xl font-bold">Không tìm thấy sản phẩm</h2>
            <p className="text-muted-foreground text-sm mt-1">Sản phẩm này không tồn tại hoặc đã bị xóa</p>
            <Link href="/shop">
              <Button className="mt-4 gap-2">
                <ArrowLeft className="h-4 w-4" /> Về cửa hàng
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0

  const specs = product.specs as Record<string, string> | undefined
  const features = product.features as string[] | undefined
  const description = product.description as string | undefined
  const images = product.image ? [product.image] : []

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">
          {/* Breadcrumb */}
          <nav
            className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 flex-wrap transition-all duration-500"
            style={{ opacity: pageVisible ? 1 : 0, transform: pageVisible ? "translateY(0)" : "translateY(-8px)" }}
          >
            <Link href="/" className="hover:text-foreground transition-colors">Trang chủ</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/shop" className="hover:text-foreground transition-colors">Cửa hàng</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-foreground transition-colors">
              {product.category}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium line-clamp-1">{product.name}</span>
          </nav>

          {/* ────── Product Section ────── */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Left: Image Gallery */}
            <div
              className="transition-all duration-600"
              style={{ opacity: pageVisible ? 1 : 0, transform: pageVisible ? "translateX(0)" : "translateX(-20px)", transitionDelay: "100ms" }}
            >
              <ImageGallery
                images={images}
                name={product.name}
                brand={product.brand}
                badges={product.badges}
              />
            </div>

            {/* Right: Product Info */}
            <div
              className="flex flex-col transition-all duration-600"
              style={{ opacity: pageVisible ? 1 : 0, transform: pageVisible ? "translateX(0)" : "translateX(20px)", transitionDelay: "200ms" }}
            >
              {/* Brand */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{product.brand}</Badge>
                <Badge variant="outline" className="text-xs text-muted-foreground">{product.category}</Badge>
              </div>

              {/* Name */}
              <h1 className="font-serif text-2xl font-extrabold text-foreground mt-3 lg:text-3xl">
                {product.name}
              </h1>

              {/* Rating row */}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn("h-4 w-4", i < Math.floor(product.rating) ? "fill-amber-400 text-amber-400" : "text-muted")} />
                  ))}
                </div>
                <span className="text-sm font-semibold">{product.rating}</span>
                <span className="text-sm text-muted-foreground">({product.reviews} đánh giá)</span>
                <span className="text-sm text-muted-foreground">|</span>
                <span className="text-sm text-muted-foreground">Đã bán {Math.floor(product.reviews * 2.3)}</span>
              </div>

              {/* Price */}
              <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-orange-50 border border-primary/10">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-serif text-3xl font-extrabold text-primary">{formatVND(product.price)}</span>
                  {product.originalPrice && (
                    <span className="text-base text-muted-foreground line-through">{formatVND(product.originalPrice)}</span>
                  )}
                  {discount > 0 && (
                    <Badge className="bg-red-500 text-white text-sm px-2.5">-{discount}%</Badge>
                  )}
                </div>
                {discount > 0 && product.originalPrice && (
                  <p className="text-sm text-green-700 font-medium mt-1">
                    Tiết kiệm {formatVND(product.originalPrice - product.price)}
                  </p>
                )}
              </div>

              {/* Short description */}
              {description && (
                <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
                  {description}
                </p>
              )}

              <Separator className="my-5" />

              {/* Stock */}
              <div className="flex items-center gap-2 text-sm">
                {product.inStock ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                    </span>
                    <span className="text-green-700 font-semibold">Còn hàng</span>
                    <span className="text-muted-foreground">— Giao hàng trong 2-5 ngày</span>
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span className="text-red-700 font-semibold">Tạm hết hàng</span>
                    <span className="text-muted-foreground">— Liên hệ để đặt trước</span>
                  </>
                )}
              </div>

              {/* Quantity */}
              <div className="mt-5">
                <p className="text-sm font-semibold mb-2">Số lượng</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="h-10 w-10 rounded-xl border-2 flex items-center justify-center hover:bg-muted hover:scale-110 active:scale-95 transition-all duration-150"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-bold text-xl w-10 text-center">{qty}</span>
                  <button
                    onClick={() => setQty(q => q + 1)}
                    className="h-10 w-10 rounded-xl border-2 flex items-center justify-center hover:bg-muted hover:scale-110 active:scale-95 transition-all duration-150"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-muted-foreground ml-2">
                    Thành tiền: <strong className="text-primary">{formatVND(product.price * qty)}</strong>
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={addToCart}
                  disabled={!product.inStock}
                  variant="outline"
                  className={cn(
                    "flex-1 h-12 font-semibold gap-2 border-2 text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                    added
                      ? "border-green-500 text-green-600 bg-green-50 hover:bg-green-50"
                      : "border-primary text-primary hover:bg-primary/5"
                  )}
                >
                  {added ? (
                    <><CheckCircle2 className="h-5 w-5" /> Đã thêm vào giỏ!</>
                  ) : (
                    <><ShoppingCart className="h-5 w-5" /> Thêm vào giỏ</>
                  )}
                </Button>
                <Button
                  onClick={buyNow}
                  disabled={!product.inStock}
                  className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2 text-base hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-md shadow-primary/25 hover:shadow-primary/40"
                >
                  <Zap className="h-5 w-5" />
                  Mua ngay
                </Button>
              </div>

              {/* Mini actions */}
              <div className="flex items-center gap-4 mt-4">
                <button
                  onClick={() => setWishlist(!wishlist)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Heart className={cn("h-4 w-4", wishlist ? "fill-red-500 text-red-500" : "")} />
                  {wishlist ? "Đã thích" : "Yêu thích"}
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Share2 className="h-4 w-4" /> Chia sẻ
                </button>
              </div>

              <Separator className="my-5" />

              {/* Policies */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: <Truck className="h-5 w-5" />, title: "Miễn phí giao hàng", desc: "Đơn từ 500.000đ" },
                  { icon: <Shield className="h-5 w-5" />, title: "Chính hãng 100%", desc: "Bảo hành 12 tháng" },
                  { icon: <RotateCcw className="h-5 w-5" />, title: "Đổi trả dễ dàng", desc: "Trong 30 ngày" },
                ].map(p => (
                  <div key={p.title} className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/50 border">
                    <span className="text-primary shrink-0 mt-0.5">{p.icon}</span>
                    <div>
                      <p className="text-xs font-semibold">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ────── Tabs: Chi tiết / Thông số / Đánh giá ────── */}
          <div className="mt-12">
            <Tabs defaultValue="details">
              <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 gap-0">
                <TabsTrigger
                  value="details"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-6 py-3 font-semibold"
                >
                  Mô tả sản phẩm
                </TabsTrigger>
                <TabsTrigger
                  value="specs"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-6 py-3 font-semibold"
                >
                  Thông số kỹ thuật
                </TabsTrigger>
                <TabsTrigger
                  value="reviews"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-6 py-3 font-semibold"
                >
                  Đánh giá ({product.reviews})
                </TabsTrigger>
              </TabsList>

              {/* Mô tả */}
              <TabsContent value="details" className="mt-6">
                <Card>
                  <CardContent className="p-6 space-y-6">
                    {description && (
                      <div>
                        <h3 className="font-serif text-lg font-bold mb-3">Giới thiệu {product.name}</h3>
                        <p className="text-muted-foreground leading-relaxed">{description}</p>
                      </div>
                    )}

                    {features && features.length > 0 && (
                      <div>
                        <h3 className="font-serif text-lg font-bold mb-3">Đặc điểm nổi bật</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {features.map((f, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 hover:border-green-300 transition-colors duration-150">
                              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                              <span className="text-sm">{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Product images in description */}
                    <div>
                      <h3 className="font-serif text-lg font-bold mb-3">Hình ảnh sản phẩm</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {images.map((img, i) => (
                          <div key={i} className="relative aspect-[4/3] rounded-xl bg-gradient-to-br from-muted to-background border overflow-hidden">
                            <Image
                              src={img}
                              alt={`${product.name} - Hình ${i + 1}`}
                              fill
                              className="object-contain p-4"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center -z-0">
                              <span className="text-6xl text-muted-foreground/5 font-serif font-bold">{product.brand[0]}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Thông số */}
              <TabsContent value="specs" className="mt-6">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-serif text-lg font-bold mb-4">Thông số kỹ thuật — {product.name}</h3>
                    {specs ? (
                      <div className="rounded-xl border overflow-hidden">
                        <table className="w-full text-sm">
                          <tbody>
                            {Object.entries(specs).map(([key, value], i) => (
                              <tr key={key} className={cn(i % 2 === 0 ? "bg-muted/30" : "bg-background")}>
                                <td className="py-3 px-4 font-semibold text-muted-foreground w-1/3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-primary">{specIcons[key] || <Info className="h-4 w-4" />}</span>
                                    {specLabels[key] || key}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-medium">{value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Chưa có thông số kỹ thuật cho sản phẩm này.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Đánh giá */}
              <TabsContent value="reviews" className="mt-6">
                <Card>
                  <CardContent className="p-6">
                    {/* Summary */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
                      <div className="text-center">
                        <p className="font-serif text-5xl font-extrabold text-primary">{product.rating}</p>
                        <div className="flex items-center gap-0.5 mt-1 justify-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("h-4 w-4", i < Math.floor(product.rating) ? "fill-amber-400 text-amber-400" : "text-muted")} />
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{product.reviews} đánh giá</p>
                      </div>
                      <div className="flex-1 w-full space-y-1.5">
                        {[5, 4, 3, 2, 1].map(star => {
                          const pct = star === 5 ? 72 : star === 4 ? 18 : star === 3 ? 7 : star === 2 ? 2 : 1
                          return (
                            <div key={star} className="flex items-center gap-2">
                              <span className="text-xs font-medium w-6 text-right">{star}★</span>
                              <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-amber-400 rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%`, transitionDelay: `${(5 - star) * 80}ms` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <Separator className="mb-6" />

                    {/* Sample reviews */}
                    <div className="space-y-4">
                      {[
                        { author: "Nguyễn Minh T.", rating: 5, date: "15/02/2026", title: "Sản phẩm tuyệt vời", content: `${product.name} chất lượng rất tốt, đúng chính hãng. Đóng gói cẩn thận, giao hàng nhanh. Rất hài lòng!` },
                        { author: "Trần Thu H.", rating: 4, date: "10/02/2026", title: "Chất lượng tốt", content: "Sản phẩm đúng mô tả, chất lượng ổn. Giá hơi cao so với thị trường nhưng được cái chính hãng, bảo hành đầy đủ." },
                        { author: "Lê Quang V.", rating: 5, date: "05/02/2026", title: "Đáng giá tiền", content: "Mua để dùng cho tập luyện hàng ngày, dùng rất ổn. Shop tư vấn nhiệt tình, sẽ ủng hộ tiếp!" },
                      ].map((review, i) => (
                        <div key={i} className="p-4 rounded-xl border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                {review.author[0]}
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{review.author}</p>
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, j) => (
                                    <Star key={j} className={cn("h-3 w-3", j < review.rating ? "fill-amber-400 text-amber-400" : "text-muted")} />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">{review.date}</span>
                          </div>
                          <p className="text-sm font-semibold mt-2">{review.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{review.content}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* ────── Related Products ────── */}
          {moreProducts.length > 0 && (
            <div className="mt-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-serif text-2xl font-extrabold">Sản phẩm tương tự</h2>
                <Link href="/shop">
                  <Button variant="ghost" className="gap-1 text-sm">
                    Xem tất cả <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {moreProducts.map((p, i) => (
                  <RelatedProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}