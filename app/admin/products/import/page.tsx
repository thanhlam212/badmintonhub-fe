"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { formatVND } from "@/lib/utils"
import { inventoryApi, productApi, purchaseOrderApi, type ApiProduct } from "@/lib/api"
import { AlertTriangle, CheckCircle2, ImagePlus, Package, Pencil, Plus, Search, Trash2, Upload } from "lucide-react"

interface SupplierOption {
  id: number
  name: string
}

interface WarehouseOption {
  id: number
  name: string
  isHub: boolean
}

interface DraftRow {
  key: string
  supplierId: string
  sku: string
  name: string
  brand: string
  category: string
  image: string
  price: string
  originalPrice: string
  gender: string
  inStock: boolean
  initialQty: string
  unitCost: string
  description: string
}

const createDraftRow = (): DraftRow => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  supplierId: "",
  sku: "",
  name: "",
  brand: "",
  category: "",
  image: "",
  price: "",
  originalPrice: "",
  gender: "unisex",
  inStock: true,
  initialQty: "0",
  unitCost: "0",
  description: "",
})

const buildProductDescription = (description: string, supplierName?: string | null) => {
  return [description.trim(), supplierName ? `NCC:${supplierName}` : ""].filter(Boolean).join(" | ")
}

const findSupplierId = (supplierName: string | null | undefined, suppliers: SupplierOption[]) => {
  if (!supplierName) return ""
  const matched = suppliers.find((s) => s.name === supplierName)
  return matched ? String(matched.id) : ""
}

export default function AdminProductImportPage() {
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [draftRows, setDraftRows] = useState<DraftRow[]>([createDraftRow()])
  const [uploadingRows, setUploadingRows] = useState<string[]>([])
  const [uploadingEditImage, setUploadingEditImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState("")
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)
  const [editingProduct, setEditingProduct] = useState<ApiProduct | null>(null)
  const [editForm, setEditForm] = useState({
    supplierId: "",
    name: "",
    brand: "",
    category: "",
    image: "",
    price: "",
    originalPrice: "",
    gender: "unisex",
    description: "",
    inStock: true,
  })

  const loadData = async () => {
    const [productRes, supplierRes, warehouseRes] = await Promise.all([
      productApi.getAll({ limit: 500 }),
      purchaseOrderApi.getSuppliers(),
      inventoryApi.getWarehouses(),
    ])

    setProducts(productRes.products || [])
    setSuppliers((supplierRes?.data || []).map((s: any) => ({ id: s.id, name: s.name })))
    setWarehouses((warehouseRes?.data || []).map((w: any) => ({ id: w.id, name: w.name, isHub: !!w.is_hub })))
  }

  useEffect(() => {
    loadData().catch(() => {})
  }, [])

  const hubWarehouseId = useMemo(() => {
    const hub = warehouses.find((w) => w.isHub || /hub/i.test(w.name))
    if (hub) return String(hub.id)
    return warehouses[0] ? String(warehouses[0].id) : ""
  }, [warehouses])

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return products
    return products.filter((p) =>
      [p.sku, p.name, p.brand, p.category].some((v) => String(v || "").toLowerCase().includes(keyword))
    )
  }, [products, search])

  const skuOptions = useMemo(() => {
    return Array.from(new Set(
      products.map((p) => String(p.sku || "").trim().toUpperCase()).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b))
  }, [products])

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(
      products.map((p) => String(p.category || "").trim()).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, "vi"))
  }, [products])

  const updateDraft = (key: string, field: keyof DraftRow, value: string | boolean) => {
    setDraftRows((prev) => prev.map((row) => row.key === key ? { ...row, [field]: value } : row))
  }

  const addDraftRow = () => setDraftRows((prev) => [...prev, createDraftRow()])

  const removeDraftRow = (key: string) => {
    setDraftRows((prev) => prev.length === 1 ? prev : prev.filter((row) => row.key !== key))
  }

  const handleRowImageUpload = async (key: string, file?: File | null) => {
    if (!file) return
    setUploadingRows((prev) => prev.includes(key) ? prev : [...prev, key])
    const uploaded = await productApi.uploadImage(file)
    if (uploaded.success && uploaded.url) {
      updateDraft(key, "image", uploaded.url)
    } else {
      alert(uploaded.error || "Không thể tải ảnh")
    }
    setUploadingRows((prev) => prev.filter((k) => k !== key))
  }

  const handleEditImageUpload = async (file?: File | null) => {
    if (!file) return
    setUploadingEditImage(true)
    const uploaded = await productApi.uploadImage(file)
    if (uploaded.success && uploaded.url) {
      setEditForm((prev) => ({ ...prev, image: uploaded.url || "" }))
    } else {
      alert(uploaded.error || "Không thể tải ảnh")
    }
    setUploadingEditImage(false)
  }

  const handleImport = async () => {
    if (submitting) return
    setSubmitting(true)
    setImportResult(null)

    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (const row of draftRows) {
      const price = Number(row.price)
      const originalPrice = row.originalPrice ? Number(row.originalPrice) : null
      const qty = Number(row.initialQty || 0)
      const unitCost = Number(row.unitCost || 0)

      if (!row.name || !row.brand || !row.category || Number.isNaN(price) || price <= 0) {
        failedCount += 1
        errors.push(`${row.name || "(chưa có tên)"}: Thiếu thông tin bắt buộc`)
        continue
      }

      const supplierName = suppliers.find((s) => String(s.id) === row.supplierId)?.name || null

      const created = await productApi.create({
        sku: row.sku || undefined,
        name: row.name,
        brand: row.brand,
        category: row.category,
        image: row.image || null,
        price,
        original_price: originalPrice,
        gender: row.gender === "unisex" ? null : row.gender,
        in_stock: row.inStock,
        description: buildProductDescription(row.description, supplierName),
      })

      if (!created.success || !created.product) {
        failedCount += 1
        errors.push(`${row.name}: ${created.error || "Không thể tạo sản phẩm"}`)
        continue
      }

      if (!hubWarehouseId) {
        failedCount += 1
        errors.push(`${row.name}: Không tìm thấy kho Hub để khởi tạo mẫu mã`)
        continue
      }

      const imported = await inventoryApi.importStock({
        warehouse_id: Number(hubWarehouseId),
        sku: created.product.sku,
        quantity: qty >= 0 ? qty : 0,
        cost: unitCost > 0 ? unitCost : price,
        note: `KTMH-HUB-ADM`,
      })

      if (!imported.success) {
        failedCount += 1
        errors.push(`${created.product.sku}: Tạo sản phẩm xong nhưng nhập kho Hub lỗi`)
        continue
      }

      successCount += 1
    }

    await loadData().catch(() => {})
    setImportResult({ success: successCount, failed: failedCount, errors })
    setSubmitting(false)
    setDraftRows([createDraftRow()])
  }

  const openEdit = (product: ApiProduct) => {
    setEditingProduct(product)
    setEditForm({
      supplierId: findSupplierId(product.supplierName, suppliers),
      name: product.name,
      brand: product.brand,
      category: product.category,
      image: product.image || "",
      price: String(product.price),
      originalPrice: product.originalPrice ? String(product.originalPrice) : "",
      gender: product.gender || "unisex",
      description: product.description || "",
      inStock: product.inStock,
    })
  }

  const handleUpdate = async () => {
    if (!editingProduct) return
    const supplierName = suppliers.find((s) => String(s.id) === editForm.supplierId)?.name || null
    const updated = await productApi.update(editingProduct.id, {
      name: editForm.name,
      brand: editForm.brand,
      category: editForm.category,
      image: editForm.image || null,
      price: Number(editForm.price),
      original_price: editForm.originalPrice ? Number(editForm.originalPrice) : null,
      gender: editForm.gender === "unisex" ? null : editForm.gender,
      description: buildProductDescription(editForm.description, supplierName),
      in_stock: editForm.inStock,
    })
    if (!updated.success) return
    await loadData().catch(() => {})
    setEditingProduct(null)
  }

  const handleDelete = async (product: ApiProduct) => {
    const ok = window.confirm(`Xóa sản phẩm ${product.sku} - ${product.name}?`)
    if (!ok) return
    const deleted = await productApi.delete(product.id)
    if (!deleted.success) return
    await loadData().catch(() => {})
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-extrabold">Import mẫu mã sản phẩm</h1>
        <p className="text-sm text-muted-foreground">Nhập theo dạng bảng có NCC, tải ảnh từ máy và tự động khởi tạo mẫu mã ở tổng kho Hub</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Bảng import mẫu mã
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">NCC</TableHead>
                  <TableHead className="text-xs">SKU</TableHead>
                  <TableHead className="text-xs">Tên</TableHead>
                  <TableHead className="text-xs">Hãng</TableHead>
                  <TableHead className="text-xs">Danh mục</TableHead>
                  <TableHead className="text-xs">Ảnh</TableHead>
                  <TableHead className="text-xs text-right">Giá bán</TableHead>
                  <TableHead className="text-xs text-right">Giá gốc</TableHead>
                  <TableHead className="text-xs text-center">SL đầu</TableHead>
                  <TableHead className="text-xs text-right">Giá vốn</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="min-w-[180px]">
                      <Select value={row.supplierId} onValueChange={(v) => updateDraft(row.key, "supplierId", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Chọn NCC" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        list="sku-combo-list"
                        className="h-8 text-xs min-w-[120px]"
                        placeholder="(trống = tự tạo)"
                        value={row.sku}
                        onChange={(e) => updateDraft(row.key, "sku", e.target.value.toUpperCase())}
                      />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8 text-xs min-w-[220px]" value={row.name} onChange={(e) => updateDraft(row.key, "name", e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8 text-xs min-w-[120px]" value={row.brand} onChange={(e) => updateDraft(row.key, "brand", e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input list="category-combo-list" className="h-8 text-xs min-w-[140px]" placeholder="(chọn/gõ)" value={row.category} onChange={(e) => updateDraft(row.key, "category", e.target.value)} />
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      <div className="space-y-1">
                        <Input className="h-8 text-xs" value={row.image} onChange={(e) => updateDraft(row.key, "image", e.target.value)} placeholder="URL ảnh" />
                        <div className="flex items-center gap-2">
                          <input
                            id={`row-img-${row.key}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleRowImageUpload(row.key, e.target.files?.[0] || null)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => document.getElementById(`row-img-${row.key}`)?.click()}
                            disabled={uploadingRows.includes(row.key)}
                          >
                            {uploadingRows.includes(row.key) ? "Đang tải..." : "Tải từ máy"}
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input className="h-8 text-xs text-right min-w-[110px]" type="number" value={row.price} onChange={(e) => updateDraft(row.key, "price", e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8 text-xs text-right min-w-[110px]" type="number" value={row.originalPrice} onChange={(e) => updateDraft(row.key, "originalPrice", e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8 text-xs text-center w-20" type="number" min={0} value={row.initialQty} onChange={(e) => updateDraft(row.key, "initialQty", e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8 text-xs text-right min-w-[110px]" type="number" min={0} value={row.unitCost} onChange={(e) => updateDraft(row.key, "unitCost", e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => removeDraftRow(row.key)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <datalist id="sku-combo-list">
            {skuOptions.map((sku) => <option key={sku} value={sku} />)}
          </datalist>
          <datalist id="category-combo-list">
            {categoryOptions.map((cat) => <option key={cat} value={cat} />)}
          </datalist>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <Label className="text-xs">Mô tả / ghi chú cho dòng cuối</Label>
              <Textarea
                rows={2}
                value={draftRows[draftRows.length - 1]?.description || ""}
                onChange={(e) => updateDraft(draftRows[draftRows.length - 1]?.key || "", "description", e.target.value)}
                placeholder="Mô tả ngắn hiển thị trên web"
              />
            </div>
            <Button variant="outline" onClick={addDraftRow}>
              <Plus className="h-4 w-4 mr-1" /> Thêm dòng
            </Button>
            <Button onClick={handleImport} disabled={submitting || draftRows.length === 0}>
              <Upload className="h-4 w-4 mr-1" /> {submitting ? "Đang lưu..." : "Lưu mẫu mã + nhập kho"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Dòng nhập: {draftRows.length}</Badge>
            <Badge variant="outline">Tự động khởi tạo mẫu mã tại kho Hub</Badge>
            {hubWarehouseId && <Badge variant="outline">Kho Hub ID: {hubWarehouseId}</Badge>}
          </div>
        </CardContent>
      </Card>

      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kết quả xử lý</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1 text-green-700">
                <CheckCircle2 className="h-4 w-4" /> Thành công: {importResult.success}
              </span>
              <span className="inline-flex items-center gap-1 text-red-700">
                <AlertTriangle className="h-4 w-4" /> Thất bại: {importResult.failed}
              </span>
            </div>
            {importResult.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1 max-h-40 overflow-y-auto">
                {importResult.errors.map((err, idx) => (
                  <p key={idx} className="text-xs text-red-700">• {err}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" /> Danh mục sản phẩm hiển thị trên web
            </CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm SKU, tên, hãng..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-20">Ảnh</TableHead>
                <TableHead className="text-xs">SKU</TableHead>
                <TableHead className="text-xs">Tên</TableHead>
                <TableHead className="text-xs">NCC</TableHead>
                <TableHead className="text-xs">Danh mục</TableHead>
                <TableHead className="text-xs text-right">Giá bán</TableHead>
                <TableHead className="text-xs">Hiển thị</TableHead>
                <TableHead className="text-xs w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="h-12 w-12 rounded-md object-cover border" />
                    ) : (
                      <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center text-muted-foreground">
                        <ImagePlus className="h-4 w-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.brand}</p>
                  </TableCell>
                  <TableCell className="text-sm">{p.supplierName || "Chưa gán"}</TableCell>
                  <TableCell className="text-sm">{p.category}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatVND(p.price)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={p.inStock ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}
                    >
                      {p.inStock ? "Đang bán" : "Ẩn"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(p)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {search ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingProduct} onOpenChange={(open) => { if (!open) setEditingProduct(null) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa sản phẩm</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Nhà cung cấp</Label>
              <Select value={editForm.supplierId} onValueChange={(v) => setEditForm((prev) => ({ ...prev, supplierId: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn NCC" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tên sản phẩm</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Hãng</Label>
              <Input value={editForm.brand} onChange={(e) => setEditForm((prev) => ({ ...prev, brand: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Danh mục</Label>
              <Input value={editForm.category} onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Ảnh</Label>
              <div className="space-y-2">
                <Input value={editForm.image} onChange={(e) => setEditForm((prev) => ({ ...prev, image: e.target.value }))} placeholder="URL ảnh" />
                <div className="flex items-center gap-2">
                  <input
                    id="edit-product-image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleEditImageUpload(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => document.getElementById("edit-product-image")?.click()}
                    disabled={uploadingEditImage}
                  >
                    {uploadingEditImage ? "Đang tải..." : "Tải ảnh từ máy"}
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">Giá bán</Label>
              <Input type="number" value={editForm.price} onChange={(e) => setEditForm((prev) => ({ ...prev, price: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Giá gốc</Label>
              <Input type="number" value={editForm.originalPrice} onChange={(e) => setEditForm((prev) => ({ ...prev, originalPrice: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Giới tính</Label>
              <Select value={editForm.gender} onValueChange={(v) => setEditForm((prev) => ({ ...prev, gender: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unisex">Unisex</SelectItem>
                  <SelectItem value="nam">Nam</SelectItem>
                  <SelectItem value="nu">Nữ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Trạng thái web</Label>
              <Select value={editForm.inStock ? "show" : "hide"} onValueChange={(v) => setEditForm((prev) => ({ ...prev, inStock: v === "show" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="show">Hiển thị</SelectItem>
                  <SelectItem value="hide">Ẩn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Mô tả</Label>
            <Textarea rows={4} value={editForm.description} onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>Hủy</Button>
            <Button onClick={handleUpdate}>Lưu thay đổi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
