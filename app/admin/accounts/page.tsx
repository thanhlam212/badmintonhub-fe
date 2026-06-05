"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Search, Plus, Edit2, Trash2, KeyRound, Users, UserCheck, UserCog, Shield,
  ChevronLeft, ChevronRight, Loader2, Eye, EyeOff, RefreshCw, Download,
  Mail, Phone, MapPin, Calendar, Building2
} from "lucide-react"
import { userApi, inventoryApi, type ApiUser } from "@/lib/api"

/* ─── Constants ─── */

const ROLES = [
  { value: "admin", label: "Admin", icon: <Shield className="h-3.5 w-3.5" />, color: "bg-red-100 text-red-800 border-red-200" },
  { value: "employee", label: "Nhân viên", icon: <UserCog className="h-3.5 w-3.5" />, color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "user", label: "Khách hàng", icon: <UserCheck className="h-3.5 w-3.5" />, color: "bg-green-100 text-green-800 border-green-200" },
  { value: "guest", label: "Khách vãng lai", icon: <Users className="h-3.5 w-3.5" />, color: "bg-gray-100 text-gray-700 border-gray-200" },
]

function RoleBadge({ role }: { role: string }) {
  const r = ROLES.find(x => x.value === role)
  if (!r) return <Badge variant="outline">{role}</Badge>
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", r.color)}>
      {r.icon} {r.label}
    </Badge>
  )
}

/* ─── Create/Edit Dialog ─── */

interface UserFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editUser: ApiUser | null
  warehouses: { id: number; name: string }[]
  onSaved: () => void
}

function UserFormDialog({ open, onOpenChange, editUser, warehouses, onSaved }: UserFormProps) {
  const isEdit = !!editUser

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [gender, setGender] = useState<string>("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [role, setRole] = useState("user")
  const [warehouseId, setWarehouseId] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      if (editUser) {
        setUsername(editUser.username)
        setPassword("")
        setFullName(editUser.fullName)
        setEmail(editUser.email)
        setPhone(editUser.phone)
        setAddress(editUser.address || "")
        setGender(editUser.gender || "")
        setDateOfBirth(editUser.dateOfBirth ? editUser.dateOfBirth.split("T")[0] : "")
        setRole(editUser.role)
        setWarehouseId(editUser.warehouseId ? String(editUser.warehouseId) : "")
      } else {
        setUsername(""); setPassword(""); setFullName(""); setEmail("")
        setPhone(""); setAddress(""); setGender(""); setDateOfBirth("")
        setRole("user"); setWarehouseId("")
      }
      setErrors({})
      setShowPassword(false)
    }
  }, [open, editUser])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!username.trim()) e.username = "Bắt buộc"
    if (!isEdit && !password) e.password = "Bắt buộc"
    if (!isEdit && password && password.length < 6) e.password = "Ít nhất 6 ký tự"
    if (!fullName.trim()) e.fullName = "Bắt buộc"
    if (!email.trim()) e.email = "Bắt buộc"
    if (!phone.trim()) e.phone = "Bắt buộc"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      if (isEdit) {
        const result = await userApi.update(editUser.id, {
          full_name: fullName,
          email,
          phone,
          address: address || null,
          gender: gender || null,
          date_of_birth: dateOfBirth || null,
          role,
          warehouse_id: warehouseId ? parseInt(warehouseId) : null,
        })
        if (result.success) {
          toast.success("Cập nhật tài khoản thành công")
          onOpenChange(false)
          onSaved()
        } else {
          toast.error(result.error || "Lỗi cập nhật")
        }
      } else {
        const result = await userApi.create({
          username,
          password,
          full_name: fullName,
          email,
          phone,
          address: address || undefined,
          gender: gender || undefined,
          date_of_birth: dateOfBirth || undefined,
          role,
          warehouse_id: warehouseId ? parseInt(warehouseId) : undefined,
        })
        if (result.success) {
          toast.success(`Tạo tài khoản thành công — Mã: ${result.user?.userCode}`)
          onOpenChange(false)
          onSaved()
        } else {
          toast.error(result.error || "Lỗi tạo tài khoản")
        }
      }
    } catch {
      toast.error("Lỗi kết nối server")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">{isEdit ? "Chỉnh sửa tài khoản" : "Tạo tài khoản mới"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Username & Password */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tên đăng nhập <span className="text-red-500">*</span></Label>
              <Input value={username} onChange={e => setUsername(e.target.value)} disabled={isEdit} placeholder="vd: admin01" className="mt-1" />
              {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
            </div>
            {!isEdit && (
              <div>
                <Label>Mật khẩu <span className="text-red-500">*</span></Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value.replace(/[^\x00-\x7F]/g, ""))}
                    placeholder="Ít nhất 6 ký tự không dấu"
                  />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>
            )}
          </div>

          {/* Full Name */}
          <div>
            <Label>Họ và tên <span className="text-red-500">*</span></Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nguyễn Văn A" className="mt-1" />
            {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="mt-1" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label>Số điện thoại <span className="text-red-500">*</span></Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0901234567" className="mt-1" />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>
          </div>

          {/* Gender & DOB */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Giới tính</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nam">Nam</SelectItem>
                  <SelectItem value="nu">Nữ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ngày sinh</Label>
              <Input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className="mt-1" />
            </div>
          </div>

          {/* Address */}
          <div>
            <Label>Địa chỉ</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Số nhà, đường, quận/huyện..." className="mt-1" />
          </div>

          <Separator />

          {/* Role & Warehouse */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Vai trò <span className="text-red-500">*</span></Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className="flex items-center gap-2">{r.icon} {r.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(role === "employee" || role === "admin") && (
              <div>
                <Label>Kho quản lý</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn kho" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không có</SelectItem>
                    {warehouses.map(w => (
                      <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Lưu thay đổi" : "Tạo tài khoản"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Reset Password Dialog ─── */

function ResetPasswordDialog({ open, onOpenChange, user, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; user: ApiUser | null; onSaved?: () => void }) {
  const [newPassword, setNewPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setNewPassword(""); setShowPassword(false) } }, [open])

  const handleReset = async () => {
    if (!user) return
    const cleanPassword = newPassword.trim()
    if (cleanPassword.length < 6) { toast.error("Mật khẩu mới ít nhất 6 ký tự"); return }
    setSaving(true)
    try {
      const res = await userApi.resetPassword(user.id, cleanPassword)
      if (res.success) {
        toast.success(`Đã đặt lại mật khẩu cho ${user.fullName}`)
        onOpenChange(false)
      } else {
        toast.error(res.message || "Lỗi reset")
      }
    } catch { toast.error("Lỗi kết nối") }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-serif">Đặt lại mật khẩu</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Đặt lại mật khẩu cho <strong>{user?.fullName}</strong> ({user?.userCode})
          </p>
          <Label>Mật khẩu mới</Label>
          <div className="relative mt-1">
            <Input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value.replace(/[^\x00-\x7F]/g, ""))}
              placeholder="Ít nhất 6 ký tự không dấu"
            />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button onClick={handleReset} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Đặt lại mật khẩu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Page ─── */

export default function AdminAccountsPage() {
  const [users, setUsers] = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const limit = 15

  const [roleFilter, setRoleFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [searchDebounce, setSearchDebounce] = useState("")

  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editUser, setEditUser] = useState<ApiUser | null>(null)
  const [resetPwOpen, setResetPwOpen] = useState(false)
  const [resetPwUser, setResetPwUser] = useState<ApiUser | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounce(search.trim()); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  // Load warehouses once
  useEffect(() => {
    inventoryApi.getWarehouses().then((res: any) => {
      if (res.success && res.data) setWarehouses(res.data)
    }).catch(() => {})
  }, [])

  // Load users
  const loadUsers = useCallback(async (overrides?: { role?: string; search?: string; page?: number }) => {
    setLoading(true)
    try {
      const hasRoleOverride = overrides && Object.prototype.hasOwnProperty.call(overrides, "role")
      const hasSearchOverride = overrides && Object.prototype.hasOwnProperty.call(overrides, "search")
      const result = await userApi.getAll({
        role: hasRoleOverride ? overrides?.role : (roleFilter !== "all" ? roleFilter : undefined),
        search: hasSearchOverride ? overrides?.search : (searchDebounce || undefined),
        page: overrides?.page ?? page,
        limit,
      })
      if (result.users !== undefined) {
        setUsers(result.users)
        setTotal(result.pagination?.total || result.users.length)
      }
    } catch {
      toast.error("Lỗi tải danh sách tài khoản")
    } finally {
      setLoading(false)
    }
  }, [roleFilter, searchDebounce, page])

  useEffect(() => { loadUsers() }, [loadUsers])

  const totalPages = Math.ceil(total / limit)

  // Stats
  const stats = useMemo(() => {
    return {
      total,
      admin: 0,
      employee: 0,
      user: 0,
    }
  }, [total])

  // Handlers
  const handleCreate = () => {
    setEditUser(null)
    setFormOpen(true)
  }
  const handleEdit = (u: ApiUser) => {
    setEditUser(u)
    setFormOpen(true)
  }
  const handleResetPw = (u: ApiUser) => {
    setResetPwUser(u)
    setResetPwOpen(true)
  }
  const handleDelete = async (u: ApiUser) => {
    try {
      const res = await userApi.delete(u.id)
      if (res.success) {
        toast.success(`Đã xoá tài khoản ${u.userCode}`)
        loadUsers()
      } else {
        toast.error(res.message || "Lỗi xoá tài khoản")
      }
    } catch { toast.error("Lỗi kết nối") }
  }

  const formatDate = (d: string) => {
    if (!d) return "—"
    try {
      return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    } catch { return d }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-extrabold">Quản lý tài khoản</h1>
          <p className="text-muted-foreground text-sm mt-1">Quản lý tất cả tài khoản admin, nhân viên và khách hàng</p>
        </div>
        <Button className="gap-2" onClick={handleCreate}>
          <Plus className="h-4 w-4" /> Tạo tài khoản
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Tổng tài khoản", value: total, icon: <Users className="h-5 w-5" />, color: "text-primary" },
          { label: "Admin", value: users.filter(u => u.role === 'admin').length, icon: <Shield className="h-5 w-5" />, color: "text-red-600" },
          { label: "Nhân viên", value: users.filter(u => u.role === 'employee').length, icon: <UserCog className="h-5 w-5" />, color: "text-blue-600" },
          { label: "Khách hàng", value: users.filter(u => u.role === 'user').length, icon: <UserCheck className="h-5 w-5" />, color: "text-green-600" },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center bg-muted", stat.color)}>{stat.icon}</div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Role Tabs */}
            <Tabs value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(1) }} className="flex-1">
              <TabsList>
                <TabsTrigger value="all">Tất cả</TabsTrigger>
                <TabsTrigger value="admin" className="gap-1"><Shield className="h-3.5 w-3.5" /> Admin</TabsTrigger>
                <TabsTrigger value="employee" className="gap-1"><UserCog className="h-3.5 w-3.5" /> Nhân viên</TabsTrigger>
                <TabsTrigger value="user" className="gap-1"><UserCheck className="h-3.5 w-3.5" /> Khách hàng</TabsTrigger>
                <TabsTrigger value="guest" className="gap-1"><Users className="h-3.5 w-3.5" /> Khách vãng lai</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search */}
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm mã, tên, email, SĐT..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Refresh */}
            <Button variant="outline" size="icon" onClick={() => loadUsers()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[100px]">Mã</TableHead>
                  <TableHead>Tài khoản</TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Liên hệ</TableHead>
                  <TableHead className="text-center">Vai trò</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right w-[180px]">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Không có tài khoản nào
                    </TableCell>
                  </TableRow>
                ) : users.map(u => (
                  <TableRow key={u.id} className="hover:bg-muted/30">
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-primary bg-primary/5 px-2 py-1 rounded">
                        {u.userCode}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {u.fullName?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="text-sm font-medium">{u.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{u.fullName}</p>
                      {u.gender && <p className="text-xs text-muted-foreground capitalize">{u.gender === 'nam' ? 'Nam' : 'Nữ'}</p>}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-xs flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /> {u.email}</p>
                        <p className="text-xs flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" /> {u.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <RoleBadge role={u.role} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(u)} title="Sửa">
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleResetPw(u)} title="Đặt lại mật khẩu">
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" title="Xoá">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-serif">Xác nhận xoá tài khoản?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Bạn có chắc muốn xoá tài khoản <strong>{u.userCode} — {u.fullName}</strong>?
                                Hành động này không thể hoàn tác.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Huỷ</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(u)} className="bg-red-600 hover:bg-red-700">Xoá</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Hiển thị {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total} tài khoản
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pNum: number
                  if (totalPages <= 5) pNum = i + 1
                  else if (page <= 3) pNum = i + 1
                  else if (page >= totalPages - 2) pNum = totalPages - 4 + i
                  else pNum = page - 2 + i
                  return (
                    <Button key={pNum} variant={page === pNum ? "default" : "outline"} size="icon" className="h-8 w-8 text-xs" onClick={() => setPage(pNum)}>
                      {pNum}
                    </Button>
                  )
                })}
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editUser={editUser}
        warehouses={warehouses}
        onSaved={loadUsers}
      />
      <ResetPasswordDialog
        open={resetPwOpen}
        onOpenChange={setResetPwOpen}
        user={resetPwUser}
      />
    </div>
  )
}
