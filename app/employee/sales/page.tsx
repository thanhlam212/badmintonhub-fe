"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { formatVND, formatSalesOrderReference, formatHDReference } from "@/lib/utils"
import { productApi, salesOrderApi, orderApi } from "@/lib/api"
import { useInventory } from "@/lib/inventory-context"
import { printWarehouseSlip, printWarrantyCard } from "@/lib/print-utils"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  Search, ShoppingCart, Plus, Trash2, CheckCircle2, AlertTriangle,
  DollarSign, Receipt, Printer, User, CreditCard, Banknote, Smartphone,
  FileText, ArrowDownToLine, ArrowUpFromLine, Package, Clock, XCircle,
  Eye, Truck, MapPin, Phone, ClipboardList, Filter, ChevronsUpDown, Check, Warehouse, Award
} from "lucide-react"

interface CartItem {
  productId: number
  name: string
  price: number
  qty: number
}

interface SaleRecord {
  id: string
  date: string
  time: string
  customer: string
  items: CartItem[]
  total: number
  discount: number
  finalTotal: number
  paymentMethod: string
  note: string
}

interface SalesOrder {
  id: string
  rawId?: string
  date: string
  time: string
  customer: string
  phone: string
  items: CartItem[]
  total: number
  discount: number
  finalTotal: number
  paymentMethod: string
  note: string
  status: "pending" | "approved" | "rejected" | "exported"
  createdBy: string
  approvedAt?: string
  approvedBy?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectReason?: string
  exportSlipId?: string
}

interface ExportSlip {
  id: string
  orderId: string
  date: string
  items: { name: string; qty: number; price: number }[]
  total: number
  customer: string
  note: string
  status: "pending" | "completed"
  createdBy: string
  completedAt?: string
  completedBy?: string
}

interface OnlineOrder {
  id: string
  rawId?: string
  items: { productId: number; name: string; price: number; qty: number }[]
  customer: { name: string; phone: string; email: string; address: string }
  note: string
  subtotal: number
  shippingFee: number
  total: number
  paymentMethod: string
  status: "pending" | "processing" | "shipping" | "delivered" | "cancelled"
  createdAt: string
  userId: string
  type: "online"
  fulfillingWarehouseId?: number | null
}

const orderStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Chờ duyệt", color: "bg-amber-100 text-amber-800", icon: <Clock className="h-3.5 w-3.5" /> },
  approved: { label: "Đã duyệt", color: "bg-blue-100 text-blue-800", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: "Từ chối", color: "bg-red-100 text-red-800", icon: <XCircle className="h-3.5 w-3.5" /> },
  exported: { label: "Đã xuất kho", color: "bg-green-100 text-green-800", icon: <Package className="h-3.5 w-3.5" /> },
  processing: { label: "Đang xử lý", color: "bg-blue-100 text-blue-800", icon: <Package className="h-3.5 w-3.5" /> },
  shipping: { label: "Đang giao", color: "bg-purple-100 text-purple-800", icon: <Truck className="h-3.5 w-3.5" /> },
  delivered: { label: "Đã giao", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  cancelled: { label: "Đã hủy", color: "bg-red-100 text-red-800", icon: <XCircle className="h-3.5 w-3.5" /> },
}

const slipStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ xuất", color: "bg-amber-100 text-amber-800" },
  completed: { label: "Đã xuất", color: "bg-green-100 text-green-800" },
}

const paymentLabels: Record<string, string> = {
  cash: "Tiền mặt", cod: "COD", momo: "MoMo", vnpay: "VNPay", bank: "Chuyển khoản",
  "Tiền mặt": "Tiền mặt", "MoMo": "MoMo", "VNPay": "VNPay", "Chuyển khoản": "Chuyển khoản",
}

export default function EmployeeSales() {
  const router = useRouter()
  const { user } = useAuth()
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [note, setNote] = useState("")
  const [saleSuccess, setSaleSuccess] = useState(false)
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([])
  const [lastSale, setLastSale] = useState<SaleRecord | null>(null)

  // Orders & Slips state
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])
  const [exportSlips, setExportSlips] = useState<ExportSlip[]>([])
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([])
  const [orderSearch, setOrderSearch] = useState("")
  const [orderStatusFilter, setOrderStatusFilter] = useState("all")
  const [slipSearch, setSlipSearch] = useState("")
  const [slipStatusFilter, setSlipStatusFilter] = useState("all")
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<SalesOrder | null>(null)
  const [selectedOnlineOrder, setSelectedOnlineOrder] = useState<OnlineOrder | null>(null)
  const [selectedSlipDetail, setSelectedSlipDetail] = useState<ExportSlip | null>(null)

  // Load data from API + localStorage fallback
  const [products, setProducts] = useState<{id: number; name: string; price: number; brand: string; inStock: boolean}[]>([])
  useEffect(() => {
    productApi.getAll().then(res => {
      if (Array.isArray(res)) setProducts(res.map((p: any) => ({ id: p.id, name: p.name, price: p.price, brand: p.brand || "", inStock: p.inStock ?? true })))
    }).catch(() => {})
  }, [])
  useEffect(() => {
    const loadData = async () => {
      try {
        const soRes = await salesOrderApi.getAll()
        if (soRes.success && soRes.data) {
          setSalesOrders(soRes.data.map((o: any) => ({
            id: formatSalesOrderReference(o.sales_code || o.orderCode || o.order_code || o.code || o.id, o.created_at),
            rawId: String(o.id),
            date: o.created_at ? new Date(o.created_at).toISOString().split("T")[0] : "",
            time: o.created_at ? new Date(o.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "",
            customer: o.customer_name || "Khách lẻ", phone: o.customer_phone || "",
            items: (o.items || []).map((i: any) => ({ productId: i.product_id, name: i.product_name || i.name || "", price: i.price || 0, qty: i.qty || i.quantity || 0 })),
            total: o.total || o.amount || 0,
            discount: o.discount || 0,
            finalTotal: o.final_total || o.amount || o.total || 0,
            paymentMethod: o.payment_method || "", note: o.note || "",
            status: o.status || "pending",
            createdBy: o.creator_name || o.created_by || "",
          })))
        }
      } catch {}
      try {
        const orRes = await orderApi.getAll()
        if (orRes.orders) {
          setOnlineOrders(orRes.orders.map((o: any) => ({
            id: formatHDReference(o.orderCode || o.order_code || o.invoiceCode || o.invoice_code || o.sales_code || o.id, o.createdAt),
            rawId: String(o.id),
            items: (o.items || []).map((i: any) => ({ productId: i.productId || i.product_id, name: i.productName || i.name || "", price: i.price || 0, qty: i.quantity || i.qty || 0 })),
            customer: { name: o.customerName || "", phone: o.customerPhone || "", email: o.customerEmail || "", address: o.shippingAddress || "" },
            note: o.note || "",
            subtotal: o.subtotal || o.amount || o.totalAmount || o.total || 0,
            shippingFee: o.shippingFee || 0,
            total: o.amount || o.totalAmount || o.total || 0,
            paymentMethod: o.paymentMethod || "", status: o.status || "", createdAt: o.createdAt || "",
            userId: o.userId || "", type: "online" as const, deliveryMethod: "delivery" as const,
            fulfillingWarehouseId: o.fulfillingWarehouseId || null,
          })))
        }
      } catch {}
      // Export slips from localStorage for now (no backend endpoint)
      try {
        const storedSlips = localStorage.getItem("exportSlips")
        if (storedSlips) setExportSlips(JSON.parse(storedSlips))
      } catch {}
    }
    loadData()
    const handleFocus = () => loadData()
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [])

  // Also reload after a sale is made
  useEffect(() => {
    if (saleSuccess) {
      salesOrderApi.getAll().then((res: any) => {
        if (res.success && res.data) {
          setSalesOrders(res.data.map((o: any) => ({
            id: formatSalesOrderReference(o.sales_code || o.orderCode || o.order_code || o.code || o.id, o.created_at),
            rawId: String(o.id),
            date: o.created_at ? new Date(o.created_at).toISOString().split("T")[0] : "",
            time: o.created_at ? new Date(o.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "",
            customer: o.customer_name || "Khách lẻ", phone: o.customer_phone || "",
            items: (o.items || []).map((i: any) => ({ productId: i.product_id, name: i.product_name || i.name || "", price: i.price || 0, qty: i.qty || i.quantity || 0 })),
            total: o.total || o.amount || 0,
            discount: o.discount || 0,
            finalTotal: o.final_total || o.amount || o.total || 0,
            paymentMethod: o.payment_method || "", note: o.note || "",
            status: o.status || "pending",
            createdBy: o.creator_name || o.created_by || "",
          })))
        }
      }).catch(() => {})
    }
  }, [saleSuccess])

  const filteredSalesOrders = useMemo(() => {
    return salesOrders.filter(o => {
      if (orderStatusFilter !== "all" && o.status !== orderStatusFilter) return false
      if (orderSearch && !o.id.toLowerCase().includes(orderSearch.toLowerCase()) && !o.customer.toLowerCase().includes(orderSearch.toLowerCase())) return false
      return true
    })
  }, [salesOrders, orderStatusFilter, orderSearch])

  const filteredExportSlips = useMemo(() => {
    return exportSlips.filter(s => {
      if (slipStatusFilter !== "all" && s.status !== slipStatusFilter) return false
      if (slipSearch && !s.id.toLowerCase().includes(slipSearch.toLowerCase()) && !s.orderId.toLowerCase().includes(slipSearch.toLowerCase())) return false
      return true
    })
  }, [exportSlips, slipStatusFilter, slipSearch])

  const pendingOrdersCount = salesOrders.filter(o => o.status === "pending").length
  const pendingSlipsCount = exportSlips.filter(s => s.status === "pending").length

  const availableProducts = products.filter(p => p.inStock)

  const filteredProducts = availableProducts.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase())
  )

  // ─── Kho: filter by selected warehouse (default = employee's warehouse) ────
  const { inventory: inventoryItems } = useInventory()
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("")
  const [comboOpen, setComboOpen] = useState(false)
  const [comboSku, setComboSku] = useState("")

  /** All unique warehouses from inventory */
  const allWarehouses = useMemo(() => {
    const whs = new Set(inventoryItems.map(i => i.warehouse))
    return Array.from(whs).sort()
  }, [inventoryItems])

  // Auto-select employee's warehouse on first load
  useEffect(() => {
    if (!selectedWarehouse && user?.warehouse) {
      // Match employee's warehouse (e.g., "Kho Cầu Giấy")
      const match = allWarehouses.find(w => w === user.warehouse)
      if (match) setSelectedWarehouse(match)
      else if (allWarehouses.length > 0) setSelectedWarehouse(allWarehouses[0])
    } else if (!selectedWarehouse && allWarehouses.length > 0) {
      setSelectedWarehouse(allWarehouses[0])
    }
  }, [allWarehouses, user?.warehouse, selectedWarehouse])

  /** All unique categories from inventory (filtered by warehouse) */
  const warehouseItems = useMemo(() => {
    if (selectedWarehouse === "__all__") return inventoryItems
    return inventoryItems.filter(i => i.warehouse === selectedWarehouse)
  }, [inventoryItems, selectedWarehouse])

  const inventoryCategories = useMemo(() => {
    const cats = new Set(warehouseItems.map(i => i.category))
    return Array.from(cats).sort()
  }, [warehouseItems])

  /** Per-warehouse view: each item shows stock of selected warehouse */
  interface WarehouseItem {
    sku: string
    name: string
    category: string
    onHand: number
    available: number
    unitCost: number
    retailPrice: number
    warehouse: string
    otherWarehouses: { name: string; available: number }[]
  }

  const warehouseInventory: WarehouseItem[] = useMemo(() => {
    return warehouseItems.map(item => {
      // Match to retail product if available
      const retail = products.find(p =>
        p.name.toLowerCase().includes(item.name.toLowerCase().split(" ").slice(0, 3).join(" ")) ||
        item.name.toLowerCase().includes(p.name.toLowerCase().split(" ").slice(0, 3).join(" "))
      )
      // Find same SKU in other warehouses for reference
      const otherWarehouses = inventoryItems
        .filter(i => i.sku === item.sku && i.warehouse !== item.warehouse)
        .map(i => ({ name: i.warehouse, available: i.available }))
      return {
        sku: item.sku,
        name: item.name,
        category: item.category,
        onHand: item.onHand,
        available: item.available,
        unitCost: item.unitCost,
        retailPrice: retail?.price ?? Math.round(item.unitCost * 1.4),
        warehouse: item.warehouse,
        otherWarehouses,
      }
    })
  }, [warehouseItems, inventoryItems, products])

  const filteredInventory = useMemo(() => {
    return warehouseInventory.filter(item => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false
      if (search) {
        const s = search.toLowerCase()
        return item.name.toLowerCase().includes(s) || item.sku.toLowerCase().includes(s) || item.category.toLowerCase().includes(s)
      }
      return true
    })
  }, [warehouseInventory, categoryFilter, search])

  const addInventoryItemToCart = (item: WarehouseItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.name === item.name)
      if (existing) {
        return prev.map(c => c.name === item.name ? { ...c, qty: c.qty + 1 } : c)
      }
      // Use negative hash of sku as productId to avoid collision with retail product ids
      const fakeId = -(item.sku.split("").reduce((a, c) => a + c.charCodeAt(0), 0))
      return [...prev, { productId: fakeId, name: item.name, price: item.retailPrice, qty: 1 }]
    })
  }

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart])
  const discountAmount = useMemo(() => {
    if (discountType === "percent") return Math.round(cartTotal * discount / 100)
    return discount
  }, [cartTotal, discount, discountType])
  const finalTotal = cartTotal - discountAmount

  const addToCart = (product: typeof products[0]) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id)
      if (existing) {
        return prev.map(item =>
          item.productId === product.id ? { ...item, qty: item.qty + 1 } : item
        )
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, qty: 1 }]
    })
  }

  const updateQty = (productId: number, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.productId !== productId))
    } else {
      setCart(prev => prev.map(item => item.productId === productId ? { ...item, qty } : item))
    }
  }

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId))
  }

  const handleConfirmSale = async () => {
    if (cart.length === 0) return

    const now = new Date()
    const sale: SaleRecord = {
      id: "",
      date: now.toISOString().split("T")[0],
      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      customer: customerName || "Khách lẻ",
      items: [...cart],
      total: cartTotal,
      discount: discountAmount,
      finalTotal,
      paymentMethod: paymentMethod === "cash" ? "Tiền mặt" : paymentMethod === "momo" ? "MoMo" : paymentMethod === "vnpay" ? "VNPay" : "Chuyển khoản",
      note,
    }

    const saleWarehouseId = selectedWarehouse && selectedWarehouse !== "__all__"
      ? inventoryItems.find(i => i.warehouse === selectedWarehouse)?.warehouseId
      : user?.warehouseId

    // Save as pending sales order via API
    const res = await salesOrderApi.create({
      fulfill_warehouse_id: saleWarehouseId ?? user?.warehouseId ?? undefined,
      customer_name: customerName || "Khách lẻ",
      customer_phone: customerPhone || undefined,
      note: note || undefined,
      payment_method: paymentMethod,
      items: cart.map(c => ({
        product_id: c.productId > 0 ? c.productId : undefined,
        product_name: c.name,
        price: c.price,
        quantity: c.qty,
      })),
    }).catch(() => null)
    sale.id = res?.success && res?.data?.id ? formatSalesOrderReference(res.data.id, res.data.created_at) : ""
    if (!res?.success || !sale.id) return

    setSalesHistory(prev => [sale, ...prev])
    setLastSale(sale)
    setSaleSuccess(true)

    // Reset form
    setCart([])
    setCustomerName("")
    setCustomerPhone("")
    setDiscount(0)
    setNote("")

    setTimeout(() => setSaleSuccess(false), 4000)
  }

  const paymentMethods = [
    { value: "cash", label: "Tiền mặt", icon: <Banknote className="h-4 w-4" /> },
    { value: "momo", label: "MoMo", icon: <Smartphone className="h-4 w-4" /> },
    { value: "vnpay", label: "VNPay", icon: <CreditCard className="h-4 w-4" /> },
    { value: "bank", label: "Chuyển khoản", icon: <DollarSign className="h-4 w-4" /> },
  ]

  const productIdToSku = useMemo(() => {
    const map: Record<number, string> = {}
    for (const inv of inventoryItems) {
      if (inv.productId && inv.sku) {
        map[inv.productId] = inv.sku
      }
    }
    return map
  }, [inventoryItems])

  const selectedOnlineOrderWarehouse = useMemo(() => {
    if (!selectedOnlineOrder?.fulfillingWarehouseId) return "—"
    const wh = inventoryItems.find(inv => inv.warehouseId === selectedOnlineOrder.fulfillingWarehouseId)
    return wh ? wh.warehouse : "—"
  }, [selectedOnlineOrder, inventoryItems])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Bán hàng</h1>
          <p className="text-sm text-muted-foreground">Tạo đơn bán hàng và thanh toán</p>
        </div>
      </div>

      {saleSuccess && lastSale && (
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200 mb-6">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              Tạo đơn thành công! Mã hóa đơn: <strong>{lastSale.id}</strong> — đang chờ duyệt
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              Tổng tiền: {formatVND(lastSale.finalTotal)} • Khách hàng: {lastSale.customer} • {lastSale.paymentMethod}
            </p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => router.push("/employee/approval")}>
            Xem duyệt đơn
          </Button>
        </div>
      )}

      <Tabs defaultValue="pos">
        <TabsList className="mb-4">
          <TabsTrigger value="pos" className="gap-1.5"><ShoppingCart className="h-3.5 w-3.5" /> Bán hàng</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Danh sách đơn
            {pendingOrdersCount > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] rounded-full bg-amber-500 text-white text-[10px] px-1.5">{pendingOrdersCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="slips" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Phiếu xuất kho
            {pendingSlipsCount > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] rounded-full bg-orange-500 text-white text-[10px] px-1.5">{pendingSlipsCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><Receipt className="h-3.5 w-3.5" /> Lịch sử bán</TabsTrigger>
        </TabsList>

        <TabsContent value="pos">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Product List — Per-warehouse */}
            <div className="lg:col-span-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <Warehouse className="h-5 w-5 text-blue-600" />
                    {selectedWarehouse === "__all__" ? "Tất cả kho" : selectedWarehouse?.replace("Kho ", "") || "Kho"} — Chọn sản phẩm
                    <Badge variant="secondary" className="ml-auto text-xs font-normal">
                      {filteredInventory.length} SKU
                    </Badge>
                  </CardTitle>

                  {/* Filters row: Warehouse + Search + Category */}
                  <div className="flex items-center gap-2 mt-2">
                    {/* Warehouse selector */}
                    <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                      <SelectTrigger className="w-[180px] h-9 text-xs">
                        <Warehouse className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                        <SelectValue placeholder="Chọn kho..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allWarehouses.map(wh => (
                          <SelectItem key={wh} value={wh} className="text-xs">
                            {wh}
                            {wh === user?.warehouse && <span className="ml-1 text-blue-600">(Kho bạn)</span>}
                          </SelectItem>
                        ))}
                        {allWarehouses.length > 1 && (
                          <SelectItem value="__all__" className="text-xs font-medium border-t mt-1 pt-1">
                            📦 Xem tất cả kho
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Tìm theo tên, mã SKU, danh mục..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    {/* Category Combobox */}
                    <Popover open={comboOpen} onOpenChange={setComboOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={comboOpen} className="w-[200px] justify-between text-xs h-9">
                          <Filter className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                          {categoryFilter === "all" ? "Tất cả danh mục" : categoryFilter}
                          <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="end">
                        <Command>
                          <CommandInput placeholder="Tìm danh mục..." className="h-8 text-xs" />
                          <CommandList>
                            <CommandEmpty>Không tìm thấy.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="all"
                                onSelect={() => { setCategoryFilter("all"); setComboOpen(false) }}
                                className="text-xs"
                              >
                                <Check className={cn("mr-2 h-3.5 w-3.5", categoryFilter === "all" ? "opacity-100" : "opacity-0")} />
                                Tất cả danh mục
                              </CommandItem>
                              {inventoryCategories.map(cat => (
                                <CommandItem
                                  key={cat}
                                  value={cat}
                                  onSelect={() => { setCategoryFilter(cat); setComboOpen(false) }}
                                  className="text-xs"
                                >
                                  <Check className={cn("mr-2 h-3.5 w-3.5", categoryFilter === cat ? "opacity-100" : "opacity-0")} />
                                  {cat}
                                  <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1">
                                    {warehouseInventory.filter(i => i.category === cat).length}
                                  </Badge>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-24">Mã SKU</TableHead>
                          <TableHead className="text-xs">Sản phẩm</TableHead>
                          <TableHead className="text-xs">Danh mục</TableHead>
                          <TableHead className="text-xs text-center">Tồn kho</TableHead>
                          <TableHead className="text-xs text-right">Giá bán</TableHead>
                          <TableHead className="text-xs w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInventory.map(item => {
                          const inCart = cart.find(c => c.name === item.name)
                          const isLow = item.available <= 5
                          const isOut = item.available === 0
                          return (
                            <TableRow key={`${item.sku}-${item.warehouse}`} className={cn(
                              "hover:bg-muted/50",
                              inCart && "bg-blue-50/50",
                              isOut && "opacity-50"
                            )}>
                              <TableCell>
                                <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{item.sku}</code>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm font-medium">{item.name}</p>
                                {selectedWarehouse !== "__all__" && item.otherWarehouses.length > 0 && (
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-muted-foreground">Kho khác:</span>
                                    {item.otherWarehouses.map(w => (
                                      <span key={w.name} className="text-[10px] text-muted-foreground">
                                        {w.name.replace("Kho ", "")}: <strong className={w.available === 0 ? "text-red-500" : ""}>{w.available}</strong>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {selectedWarehouse === "__all__" && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {item.warehouse.replace("Kho ", "")}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{item.category}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className={cn(
                                  "text-sm font-semibold",
                                  isOut ? "text-red-500" : isLow ? "text-amber-600" : "text-green-600"
                                )}>
                                  {item.available}
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-sm font-semibold text-primary">
                                {formatVND(item.retailPrice)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant={inCart ? "secondary" : "default"}
                                  className="h-7 text-xs"
                                  onClick={() => addInventoryItemToCart(item)}
                                  disabled={isOut}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  {inCart ? `(${inCart.qty})` : "Thêm"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {filteredInventory.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              Không tìm thấy sản phẩm trong kho
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cart / Invoice */}
            <div className="lg:col-span-2">
              <Card className="sticky top-20">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-green-600" /> Hóa đơn
                    {cart.length > 0 && (
                      <Badge className="ml-auto bg-blue-600">{cart.length} SP</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Customer Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Khách hàng</Label>
                      <div className="relative mt-1">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Khách lẻ"
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                          className="h-8 text-xs pl-8"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Số điện thoại</Label>
                      <Input
                        placeholder="SĐT"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                  </div>

                  {/* Cart Items */}
                  {cart.length === 0 ? (
                    <div className="py-8 text-center">
                      <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                      <p className="text-sm text-muted-foreground">Chưa có sản phẩm nào</p>
                      <p className="text-xs text-muted-foreground mt-1">Chọn sản phẩm từ danh sách bên trái</p>
                    </div>
                  ) : (
                    <div className="max-h-[260px] overflow-y-auto space-y-2">
                      {cart.map(item => (
                        <div key={item.productId} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{formatVND(item.price)}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline" size="icon" className="h-6 w-6"
                              onClick={() => updateQty(item.productId, item.qty - 1)}
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              value={item.qty}
                              onChange={e => updateQty(item.productId, parseInt(e.target.value) || 0)}
                              className="h-6 w-10 text-xs text-center p-0"
                              min={1}
                            />
                            <Button
                              variant="outline" size="icon" className="h-6 w-6"
                              onClick={() => updateQty(item.productId, item.qty + 1)}
                            >
                              +
                            </Button>
                          </div>
                          <p className="text-xs font-semibold w-20 text-right">{formatVND(item.price * item.qty)}</p>
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700"
                            onClick={() => removeFromCart(item.productId)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Discount */}
                  {cart.length > 0 && (
                    <>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-xs">Giảm giá</Label>
                          <Input
                            type="number"
                            min={0}
                            value={discount}
                            onChange={e => setDiscount(parseInt(e.target.value) || 0)}
                            className="h-8 text-xs mt-1"
                          />
                        </div>
                        <Select value={discountType} onValueChange={(v: "percent" | "fixed") => setDiscountType(v)}>
                          <SelectTrigger className="w-20 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">%</SelectItem>
                            <SelectItem value="fixed">VNĐ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Payment Method */}
                      <div>
                        <Label className="text-xs">Phương thức thanh toán</Label>
                        <div className="grid grid-cols-2 gap-2 mt-1.5">
                          {paymentMethods.map(pm => (
                            <Button
                              key={pm.value}
                              variant={paymentMethod === pm.value ? "default" : "outline"}
                              size="sm"
                              className={cn("h-8 text-xs gap-1.5", paymentMethod === pm.value && "bg-blue-600 hover:bg-blue-700")}
                              onClick={() => setPaymentMethod(pm.value)}
                            >
                              {pm.icon}
                              {pm.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Note */}
                      <div>
                        <Label className="text-xs">Ghi chú</Label>
                        <Textarea
                          placeholder="Ghi chú đơn hàng..."
                          value={note}
                          onChange={e => setNote(e.target.value)}
                          className="mt-1 text-xs"
                          rows={2}
                        />
                      </div>

                      {/* Totals */}
                      <div className="space-y-1.5 pt-3 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tạm tính ({cart.reduce((s, i) => s + i.qty, 0)} SP)</span>
                          <span>{formatVND(cartTotal)}</span>
                        </div>
                        {discountAmount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Giảm giá</span>
                            <span className="text-red-600">-{formatVND(discountAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-base font-bold pt-1.5 border-t">
                          <span>Tổng thanh toán</span>
                          <span className="text-primary text-lg">{formatVND(finalTotal)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setCart([])
                            setDiscount(0)
                            setNote("")
                            setCustomerName("")
                            setCustomerPhone("")
                          }}
                        >
                          Huỷ đơn
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={cart.length === 0}>
                              <DollarSign className="h-4 w-4 mr-1" /> Thanh toán
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="font-serif">Xác nhận thanh toán</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <Receipt className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                <div className="text-sm space-y-1">
                                  <p>Khách hàng: <strong>{customerName || "Khách lẻ"}</strong></p>
                                  <p>Số sản phẩm: <strong>{cart.reduce((s, i) => s + i.qty, 0)}</strong></p>
                                  {discountAmount > 0 && (
                                    <p>Giảm giá: <strong className="text-red-600">-{formatVND(discountAmount)}</strong></p>
                                  )}
                                  <p>Thanh toán: <strong>{paymentMethods.find(p => p.value === paymentMethod)?.label}</strong></p>
                                  <p className="text-lg font-bold text-primary pt-1">
                                    Tổng: {formatVND(finalTotal)}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Huỷ</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleConfirmSale}>
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Xác nhận
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm mã đơn, khách hàng..."
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="pending">Chờ duyệt</SelectItem>
                  <SelectItem value="approved">Đã duyệt</SelectItem>
                  <SelectItem value="exported">Đã xuất kho</SelectItem>
                  <SelectItem value="rejected">Từ chối</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
                <ClipboardList className="h-4 w-4" />
                <span>{filteredSalesOrders.length} đơn</span>
                {pendingOrdersCount > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 text-xs">{pendingOrdersCount} chờ duyệt</Badge>
                )}
              </div>
            </div>

            {/* Sales Orders Table */}
            <Card>
              <CardContent className="p-0">
                {filteredSalesOrders.length === 0 ? (
                  <div className="py-12 text-center">
                    <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">Chưa có đơn hàng nào</p>
                    <p className="text-xs text-muted-foreground mt-1">Đơn hàng sẽ xuất hiện sau khi bạn tạo đơn bán hàng</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Mã đơn</TableHead>
                        <TableHead className="text-xs">Thời gian</TableHead>
                        <TableHead className="text-xs">Khách hàng</TableHead>
                        <TableHead className="text-xs text-center">Số SP</TableHead>
                        <TableHead className="text-xs text-right">Tổng tiền</TableHead>
                        <TableHead className="text-xs">PTTT</TableHead>
                        <TableHead className="text-xs">Trạng thái</TableHead>
                        <TableHead className="text-xs">Người tạo</TableHead>
                        <TableHead className="text-xs w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSalesOrders.map(order => {
                        const statusCfg = orderStatusConfig[order.status] || orderStatusConfig.pending
                        return (
                          <TableRow key={order.id} className={cn(
                            "hover:bg-muted/50",
                            order.status === "pending" && "bg-amber-50/30"
                          )}>
                            <TableCell className="font-mono text-xs text-blue-600 font-bold">{order.id}</TableCell>
                            <TableCell className="text-sm">{order.date} {order.time}</TableCell>
                            <TableCell>
                              <p className="text-sm font-medium">{order.customer}</p>
                              {order.phone && <p className="text-xs text-muted-foreground">{order.phone}</p>}
                            </TableCell>
                            <TableCell className="text-center text-sm">{order.items.reduce((s, i) => s + i.qty, 0)}</TableCell>
                            <TableCell className="text-right text-sm font-semibold">{formatVND(order.finalTotal)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{paymentLabels[order.paymentMethod] || order.paymentMethod}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("gap-1 text-xs", statusCfg.color)}>
                                {statusCfg.icon} {statusCfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{order.createdBy}</TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelectedOrderDetail(order)}>
                                <Eye className="h-3 w-3 mr-1" /> Xem
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Online Orders */}
            {onlineOrders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5 text-purple-600" /> Đơn hàng online
                    <Badge className="ml-auto bg-purple-100 text-purple-700 text-xs">{onlineOrders.length} đơn</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Mã đơn</TableHead>
                        <TableHead className="text-xs">Ngày tạo</TableHead>
                        <TableHead className="text-xs">Khách hàng</TableHead>
                        <TableHead className="text-xs text-center">Số SP</TableHead>
                        <TableHead className="text-xs text-right">Tổng tiền</TableHead>
                        <TableHead className="text-xs">PTTT</TableHead>
                        <TableHead className="text-xs">Trạng thái</TableHead>
                        <TableHead className="text-xs w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {onlineOrders.map(order => {
                        const statusCfg = orderStatusConfig[order.status] || orderStatusConfig.pending
                        return (
                          <TableRow key={order.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono text-xs text-purple-600 font-bold">{order.id}</TableCell>
                            <TableCell className="text-sm">{new Date(order.createdAt).toLocaleDateString("vi-VN")}</TableCell>
                            <TableCell>
                              <p className="text-sm font-medium">{order.customer.name}</p>
                              <p className="text-xs text-muted-foreground">{order.customer.phone}</p>
                            </TableCell>
                            <TableCell className="text-center text-sm">{order.items.reduce((s, i) => s + i.qty, 0)}</TableCell>
                            <TableCell className="text-right text-sm font-semibold">{formatVND(order.total)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{paymentLabels[order.paymentMethod] || order.paymentMethod}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("gap-1 text-xs", statusCfg.color)}>
                                {statusCfg.icon} {statusCfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelectedOnlineOrder(order)}>
                                <Eye className="h-3 w-3 mr-1" /> Xem
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Detail Dialog */}
          <Dialog open={!!selectedOrderDetail} onOpenChange={open => !open && setSelectedOrderDetail(null)}>
            <DialogContent className="max-w-lg">
              {selectedOrderDetail && (
                <>
                  <DialogHeader>
                    <DialogTitle className="font-serif flex items-center gap-2">
                      <Receipt className="h-5 w-5" /> Chi tiết đơn {selectedOrderDetail.id}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Khách hàng:</span> <strong>{selectedOrderDetail.customer}</strong></div>
                      <div><span className="text-muted-foreground">SĐT:</span> {selectedOrderDetail.phone || "-"}</div>
                      <div><span className="text-muted-foreground">Ngày tạo:</span> {selectedOrderDetail.date} {selectedOrderDetail.time}</div>
                      <div><span className="text-muted-foreground">PTTT:</span> {paymentLabels[selectedOrderDetail.paymentMethod] || selectedOrderDetail.paymentMethod}</div>
                      <div><span className="text-muted-foreground">Người tạo:</span> {selectedOrderDetail.createdBy}</div>
                      <div>
                        <span className="text-muted-foreground">Trạng thái: </span>
                        <Badge variant="outline" className={cn("gap-1 text-xs", (orderStatusConfig[selectedOrderDetail.status] || orderStatusConfig.pending).color)}>
                          {(orderStatusConfig[selectedOrderDetail.status] || orderStatusConfig.pending).icon}
                          {(orderStatusConfig[selectedOrderDetail.status] || orderStatusConfig.pending).label}
                        </Badge>
                      </div>
                    </div>
                    {selectedOrderDetail.note && (
                      <div>
                        <p className="text-xs text-muted-foreground">Ghi chú:</p>
                        <p className="text-sm bg-muted/50 p-2 rounded mt-1">{selectedOrderDetail.note}</p>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Sản phẩm</TableHead>
                          <TableHead className="text-xs text-center">SL</TableHead>
                          <TableHead className="text-xs text-right">Đơn giá</TableHead>
                          <TableHead className="text-xs text-right">Thành tiền</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrderDetail.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">{item.name}</TableCell>
                            <TableCell className="text-center text-sm">{item.qty}</TableCell>
                            <TableCell className="text-right text-sm">{formatVND(item.price)}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{formatVND(item.price * item.qty)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="space-y-1.5 bg-muted/50 rounded-lg p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tạm tính</span>
                        <span>{formatVND(selectedOrderDetail.total)}</span>
                      </div>
                      {selectedOrderDetail.discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Giảm giá</span>
                          <span className="text-red-600">-{formatVND(selectedOrderDetail.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold border-t pt-1.5">
                        <span>Tổng thanh toán</span>
                        <span className="text-primary">{formatVND(selectedOrderDetail.finalTotal)}</span>
                      </div>
                    </div>
                    {selectedOrderDetail.exportSlipId && (
                      <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200 text-sm">
                        <FileText className="h-4 w-4 text-green-600" />
                        <span>Phiếu xuất kho: <strong className="text-green-700 font-mono">{selectedOrderDetail.exportSlipId}</strong></span>
                      </div>
                    )}
                    {selectedOrderDetail.rejectReason && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-200 text-sm">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span>Lý do từ chối: <strong className="text-red-700">{selectedOrderDetail.rejectReason}</strong></span>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSelectedOrderDetail(null)}>Đóng</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Online Order Detail Dialog */}
          <Dialog open={!!selectedOnlineOrder} onOpenChange={open => !open && setSelectedOnlineOrder(null)}>
            <DialogContent className="max-w-lg">
              {selectedOnlineOrder && (
                <>
                  <DialogHeader>
                    <DialogTitle className="font-serif flex items-center gap-2">
                      <Truck className="h-5 w-5 text-purple-600" /> Đơn online {selectedOnlineOrder.id}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Khách hàng:</span> <strong>{selectedOnlineOrder.customer.name}</strong></div>
                      <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" /> {selectedOnlineOrder.customer.phone}</div>
                      <div className="col-span-2 flex items-start gap-1"><MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" /> <span className="text-xs">{selectedOnlineOrder.customer.address}</span></div>
                      <div><span className="text-muted-foreground">Ngày tạo:</span> {new Date(selectedOnlineOrder.createdAt).toLocaleDateString("vi-VN")}</div>
                      <div><span className="text-muted-foreground">PTTT:</span> {paymentLabels[selectedOnlineOrder.paymentMethod] || selectedOnlineOrder.paymentMethod}</div>
                      <div>
                        <span className="text-muted-foreground">Trạng thái: </span>
                        <Badge variant="outline" className={cn("gap-1 text-xs", (orderStatusConfig[selectedOnlineOrder.status] || orderStatusConfig.pending).color)}>
                          {(orderStatusConfig[selectedOnlineOrder.status] || orderStatusConfig.pending).icon}
                          {(orderStatusConfig[selectedOnlineOrder.status] || orderStatusConfig.pending).label}
                        </Badge>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Sản phẩm</TableHead>
                          <TableHead className="text-xs text-center">SL</TableHead>
                          <TableHead className="text-xs text-right">Đơn giá</TableHead>
                          <TableHead className="text-xs text-right">Thành tiền</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOnlineOrder.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">{item.name}</TableCell>
                            <TableCell className="text-center text-sm">{item.qty}</TableCell>
                            <TableCell className="text-right text-sm">{formatVND(item.price)}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{formatVND(item.price * item.qty)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="space-y-1.5 bg-muted/50 rounded-lg p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tạm tính</span>
                        <span>{formatVND(selectedOnlineOrder.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Phí ship</span>
                        <span>{formatVND(selectedOnlineOrder.shippingFee)}</span>
                      </div>
                      <div className="flex justify-between text-base font-bold border-t pt-1.5">
                        <span>Tổng thanh toán</span>
                        <span className="text-primary">{formatVND(selectedOnlineOrder.total)}</span>
                      </div>
                    </div>

                    {/* Print actions bar - only when order is past pending */}
                    {selectedOnlineOrder.status !== "pending" && selectedOnlineOrder.status !== "cancelled" && (
                      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                        <Printer className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground mr-auto">In chứng từ:</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-7"
                          onClick={() => printWarehouseSlip({
                            id: selectedOnlineOrder.id,
                            type: "export",
                            date: new Date(selectedOnlineOrder.createdAt).toLocaleDateString("vi-VN"),
                            warehouse: selectedOnlineOrderWarehouse || "—",
                            note: selectedOnlineOrder.note || "",
                            createdBy: "Hệ thống",
                            assignedTo: selectedOnlineOrder.customer.name,
                            items: selectedOnlineOrder.items.map(i => ({
                              sku: productIdToSku[i.productId] || String(i.productId),
                              name: i.name,
                              qty: i.qty,
                              unitCost: i.price,
                            })),
                          })}
                        >
                          <ArrowUpFromLine className="h-3.5 w-3.5" /> Phiếu xuất kho
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-7"
                          onClick={() => printWarrantyCard({
                            orderCode: selectedOnlineOrder.id,
                            date: selectedOnlineOrder.createdAt,
                            customerName: selectedOnlineOrder.customer.name,
                            customerPhone: selectedOnlineOrder.customer.phone,
                            customerEmail: selectedOnlineOrder.customer.email,
                            items: selectedOnlineOrder.items.map(i => ({
                              sku: productIdToSku[i.productId] || undefined,
                              name: i.name,
                              qty: i.qty,
                              price: i.price,
                            })),
                          })}
                        >
                          <Award className="h-3.5 w-3.5" /> Phiếu bảo hành
                        </Button>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSelectedOnlineOrder(null)}>Đóng</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Export Slips Tab */}
        <TabsContent value="slips">
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm mã phiếu, mã đơn..."
                  value={slipSearch}
                  onChange={e => setSlipSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={slipStatusFilter} onValueChange={setSlipStatusFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="pending">Chờ xuất</SelectItem>
                  <SelectItem value="completed">Đã xuất</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{filteredExportSlips.length} phiếu</span>
                {pendingSlipsCount > 0 && (
                  <Badge className="bg-orange-100 text-orange-700 text-xs">{pendingSlipsCount} chờ xuất</Badge>
                )}
              </div>
            </div>

            {/* Export Slips */}
            <Card>
              <CardContent className="p-0">
                {filteredExportSlips.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                    <p className="text-muted-foreground">Chưa có phiếu xuất kho nào</p>
                    <p className="text-xs text-muted-foreground mt-1">Phiếu xuất kho được tạo tự động khi đơn hàng được duyệt</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Mã phiếu</TableHead>
                        <TableHead className="text-xs">Đơn hàng</TableHead>
                        <TableHead className="text-xs">Ngày tạo</TableHead>
                        <TableHead className="text-xs">Khách hàng</TableHead>
                        <TableHead className="text-xs text-center">Số SP</TableHead>
                        <TableHead className="text-xs text-right">Giá trị</TableHead>
                        <TableHead className="text-xs">Trạng thái</TableHead>
                        <TableHead className="text-xs">Người tạo</TableHead>
                        <TableHead className="text-xs w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExportSlips.map(slip => {
                        const ssCfg = slipStatusConfig[slip.status] || slipStatusConfig.pending
                        return (
                          <TableRow key={slip.id} className={cn(
                            "hover:bg-muted/50",
                            slip.status === "pending" && "bg-orange-50/30"
                          )}>
                            <TableCell className="font-mono text-xs text-orange-600 font-bold">{slip.id}</TableCell>
                            <TableCell className="font-mono text-xs text-blue-600">{slip.orderId}</TableCell>
                            <TableCell className="text-sm">{slip.date}</TableCell>
                            <TableCell className="text-sm">{slip.customer}</TableCell>
                            <TableCell className="text-center text-sm">{slip.items.length}</TableCell>
                            <TableCell className="text-right text-sm font-semibold">{formatVND(slip.total)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-xs", ssCfg.color)}>{ssCfg.label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{slip.createdBy}</TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelectedSlipDetail(slip)}>
                                <Eye className="h-3 w-3 mr-1" /> Xem
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Slip Detail Dialog */}
          <Dialog open={!!selectedSlipDetail} onOpenChange={open => !open && setSelectedSlipDetail(null)}>
            <DialogContent className="max-w-lg">
              {selectedSlipDetail && (
                <>
                  <DialogHeader>
                    <DialogTitle className="font-serif flex items-center gap-2">
                      <FileText className="h-5 w-5 text-orange-600" /> Phiếu xuất kho {selectedSlipDetail.id}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Đơn hàng:</span> <strong className="font-mono text-blue-600">{selectedSlipDetail.orderId}</strong></div>
                      <div><span className="text-muted-foreground">Ngày tạo:</span> {selectedSlipDetail.date}</div>
                      <div><span className="text-muted-foreground">Khách hàng:</span> <strong>{selectedSlipDetail.customer}</strong></div>
                      <div><span className="text-muted-foreground">Người tạo:</span> {selectedSlipDetail.createdBy}</div>
                      <div>
                        <span className="text-muted-foreground">Trạng thái: </span>
                        <Badge variant="outline" className={cn("text-xs", (slipStatusConfig[selectedSlipDetail.status] || slipStatusConfig.pending).color)}>
                          {(slipStatusConfig[selectedSlipDetail.status] || slipStatusConfig.pending).label}
                        </Badge>
                      </div>
                      {selectedSlipDetail.completedAt && (
                        <div><span className="text-muted-foreground">Xuất lúc:</span> {new Date(selectedSlipDetail.completedAt).toLocaleString("vi-VN")}</div>
                      )}
                    </div>
                    {selectedSlipDetail.note && (
                      <div>
                        <p className="text-xs text-muted-foreground">Ghi chú:</p>
                        <p className="text-sm bg-muted/50 p-2 rounded mt-1">{selectedSlipDetail.note}</p>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Sản phẩm</TableHead>
                          <TableHead className="text-xs text-center">SL</TableHead>
                          <TableHead className="text-xs text-right">Đơn giá</TableHead>
                          <TableHead className="text-xs text-right">Thành tiền</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSlipDetail.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">{item.name}</TableCell>
                            <TableCell className="text-center text-sm">{item.qty}</TableCell>
                            <TableCell className="text-right text-sm">{formatVND(item.price)}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{formatVND(item.price * item.qty)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg p-3">
                      <span className="text-sm font-medium">Tổng giá trị</span>
                      <span className="font-serif text-lg font-bold text-primary">{formatVND(selectedSlipDetail.total)}</span>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSelectedSlipDetail(null)}>Đóng</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Sales History */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" /> Lịch sử bán hàng
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesHistory.length === 0 ? (
                <div className="py-12 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground">Chưa có đơn bán nào trong phiên này</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Mã HĐ</TableHead>
                      <TableHead className="text-xs">Thời gian</TableHead>
                      <TableHead className="text-xs">Khách hàng</TableHead>
                      <TableHead className="text-xs text-center">Số SP</TableHead>
                      <TableHead className="text-xs text-right">Tổng tiền</TableHead>
                      <TableHead className="text-xs text-right">Giảm giá</TableHead>
                      <TableHead className="text-xs text-right">Thành tiền</TableHead>
                      <TableHead className="text-xs">PTTT</TableHead>
                      <TableHead className="text-xs">Ghi chú</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesHistory.map(sale => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-xs text-blue-600">{sale.id}</TableCell>
                        <TableCell className="text-sm">{sale.date} {sale.time}</TableCell>
                        <TableCell className="text-sm font-medium">{sale.customer}</TableCell>
                        <TableCell className="text-center text-sm">{sale.items.reduce((s, i) => s + i.qty, 0)}</TableCell>
                        <TableCell className="text-right text-sm">{formatVND(sale.total)}</TableCell>
                        <TableCell className="text-right text-sm text-red-600">
                          {sale.discount > 0 ? `-${formatVND(sale.discount)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-primary">{formatVND(sale.finalTotal)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{sale.paymentMethod}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{sale.note || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
