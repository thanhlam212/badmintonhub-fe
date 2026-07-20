// ═══════════════════════════════════════════════════════════════
// Print Utility – opens a styled print window for slips/invoices
// ═══════════════════════════════════════════════════════════════

const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #1a1a2e; font-size: 13px; }
  .header { text-align: center; margin-bottom: 16px; }
  .header .company { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .header .title { font-size: 20px; font-weight: 700; margin: 6px 0 2px; }
  .header .code { font-family: monospace; font-size: 14px; color: #6b21a8; }
  .header .date { font-size: 12px; color: #666; margin-top: 2px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin: 14px 0; padding: 10px; background: #f9fafb; border-radius: 6px; }
  .info-label { font-size: 11px; color: #6b7280; }
  .info-value { font-size: 13px; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; }
  th { background: #f1f5f9; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; border: 1px solid #e2e8f0; text-align: left; }
  td { padding: 7px 10px; border: 1px solid #e2e8f0; font-size: 13px; }
  td.mono { font-family: monospace; font-size: 12px; }
  td.center, th.center { text-align: center; }
  td.right, th.right { text-align: right; }
  .note { background: #f9fafb; padding: 8px 12px; border-radius: 4px; font-size: 12px; color: #4b5563; margin-top: 10px; }
  .note strong { color: #1a1a2e; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding: 0 20px; }
  .sign-block { text-align: center; }
  .sign-label { font-size: 12px; font-weight: 600; margin-bottom: 50px; }
  .sign-name { font-size: 11px; color: #666; }
  .total-row { font-weight: 600; background: #f1f5f9; }
  @media print { body { padding: 10px; } }
`

function openPrint(html: string) {
  const w = window.open("", "_blank", "width=800,height=700")
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PRINT_STYLES}</style></head><body>${html}<script>window.onload=function(){window.print();window.close()}</script></body></html>`)
  w.document.close()
}

function esc(s: string | undefined | null): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function fmtVND(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ"
}

// ─── Transfer Slip (Phiếu điều chuyển) ─────────────────────

export interface PrintTransferData {
  code: string
  date: string
  fromWarehouse: string
  toWarehouse: string
  reason: string
  note: string
  status: string
  createdBy: string
  pickupMethod: string
  items: { sku: string; name: string; qty: number }[]
}

export function printTransferSlip(data: PrintTransferData) {
  const pickupLabel = data.pickupMethod === "employee" ? "Nhân viên qua lấy" : data.pickupMethod === "delivery" ? "Giao vận" : "Khách qua lấy"
  const statusLabel = data.status === "pending" ? "Chờ xác nhận" : data.status === "approved" ? "Đã xác nhận" : data.status === "in-transit" ? "Đang vận chuyển" : data.status === "completed" ? "Hoàn thành" : "Từ chối"
  const totalQty = data.items.reduce((s, i) => s + i.qty, 0)

  openPrint(`
    <div class="header">
      <div class="company">BadmintonHub</div>
      <div class="title">PHIẾU ĐIỀU CHUYỂN KHO</div>
      <div class="code">${esc(data.code)}</div>
      <div class="date">Ngày: ${esc(data.date)}</div>
    </div>
    <div class="info-grid">
      <div><div class="info-label">Từ kho</div><div class="info-value">${esc(data.fromWarehouse)}</div></div>
      <div><div class="info-label">Đến kho</div><div class="info-value">${esc(data.toWarehouse)}</div></div>
      <div><div class="info-label">Trạng thái</div><div class="info-value">${esc(statusLabel)}</div></div>
      <div><div class="info-label">Hình thức</div><div class="info-value">${esc(pickupLabel)}</div></div>
      <div><div class="info-label">Người tạo</div><div class="info-value">${esc(data.createdBy)}</div></div>
      <div><div class="info-label">Lý do</div><div class="info-value">${esc(data.reason)}</div></div>
    </div>
    <table>
      <thead><tr><th>STT</th><th>SKU</th><th>Sản phẩm</th><th class="center">Số lượng</th></tr></thead>
      <tbody>
        ${data.items.map((it, i) => `<tr><td class="center">${i + 1}</td><td class="mono">${esc(it.sku)}</td><td>${esc(it.name)}</td><td class="center">${it.qty}</td></tr>`).join("")}
        <tr class="total-row"><td colspan="3" class="right">Tổng cộng</td><td class="center">${totalQty}</td></tr>
      </tbody>
    </table>
    ${data.note ? `<div class="note"><strong>Ghi chú:</strong> ${esc(data.note)}</div>` : ""}
    <div class="signatures">
      <div class="sign-block"><div class="sign-label">Người giao</div><div class="sign-name">(Ký, ghi rõ họ tên)</div></div>
      <div class="sign-block"><div class="sign-label">Người nhận</div><div class="sign-name">(Ký, ghi rõ họ tên)</div></div>
    </div>
  `)
}

// ─── Warehouse Slip (Phiếu nhập/xuất kho) ──────────────────

export interface PrintWarehouseSlipData {
  id: string
  type: "import" | "export"
  date: string
  warehouse: string
  supplier?: string
  poId?: string
  note: string
  createdBy: string
  assignedTo: string
  processedBy?: string
  items: { sku: string; name: string; qty: number; unitCost: number }[]
}

export function printWarehouseSlip(data: PrintWarehouseSlipData) {
  const isImport = data.type === "import"
  const title = isImport ? "PHIẾU NHẬP KHO" : "PHIẾU XUẤT KHO"
  const totalValue = data.items.reduce((s, i) => s + i.qty * i.unitCost, 0)
  const totalQty = data.items.reduce((s, i) => s + i.qty, 0)

  openPrint(`
    <div class="header">
      <div class="company">BadmintonHub</div>
      <div class="title">${title}</div>
      <div class="code">${esc(data.id)}</div>
      <div class="date">Ngày: ${esc(data.date)}</div>
    </div>
    <div class="info-grid">
      <div><div class="info-label">Kho</div><div class="info-value">${esc(data.warehouse)}</div></div>
      ${data.supplier ? `<div><div class="info-label">Nhà cung cấp</div><div class="info-value">${esc(data.supplier)}</div></div>` : ""}
      ${data.poId ? `<div><div class="info-label">Mã PO</div><div class="info-value">${esc(data.poId)}</div></div>` : ""}
      <div><div class="info-label">Người tạo</div><div class="info-value">${esc(data.createdBy)}</div></div>
      <div><div class="info-label">Người xử lý</div><div class="info-value">${esc(data.processedBy || data.assignedTo)}</div></div>
    </div>
    <table>
      <thead><tr><th>STT</th><th>SKU</th><th>Sản phẩm</th><th class="center">SL</th><th class="right">Đơn giá</th><th class="right">Thành tiền</th></tr></thead>
      <tbody>
        ${data.items.map((it, i) => `<tr><td class="center">${i + 1}</td><td class="mono">${esc(it.sku)}</td><td>${esc(it.name)}</td><td class="center">${it.qty}</td><td class="right">${fmtVND(it.unitCost)}</td><td class="right">${fmtVND(it.qty * it.unitCost)}</td></tr>`).join("")}
        <tr class="total-row"><td colspan="3" class="right">Tổng cộng</td><td class="center">${totalQty}</td><td></td><td class="right">${fmtVND(totalValue)}</td></tr>
      </tbody>
    </table>
    ${data.note ? `<div class="note"><strong>Ghi chú:</strong> ${esc(data.note)}</div>` : ""}
    <div class="signatures">
      <div class="sign-block"><div class="sign-label">${isImport ? "Người giao hàng" : "Người xuất kho"}</div><div class="sign-name">(Ký, ghi rõ họ tên)</div></div>
      <div class="sign-block"><div class="sign-label">${isImport ? "Người nhận (Thủ kho)" : "Người nhận hàng"}</div><div class="sign-name">(Ký, ghi rõ họ tên)</div></div>
    </div>
  `)
}

// ─── Order / Invoice (Hóa đơn) ──────────────────────────────

export interface PrintOrderData {
  code: string
  date: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  address?: string
  paymentMethod?: string
  note?: string
  items: { name: string; sku?: string; qty: number; price: number }[]
  subtotal: number
  discount?: number
  total: number
}

export function printOrderInvoice(data: PrintOrderData) {
  openPrint(`
    <div class="header">
      <div class="company">BadmintonHub</div>
      <div class="title">HÓA ĐƠN BÁN HÀNG</div>
      <div class="code">${esc(data.code)}</div>
      <div class="date">Ngày: ${esc(data.date)}</div>
    </div>
    <div class="info-grid">
      <div><div class="info-label">Khách hàng</div><div class="info-value">${esc(data.customerName)}</div></div>
      ${data.customerPhone ? `<div><div class="info-label">SĐT</div><div class="info-value">${esc(data.customerPhone)}</div></div>` : ""}
      ${data.address ? `<div><div class="info-label">Địa chỉ</div><div class="info-value">${esc(data.address)}</div></div>` : ""}
      ${data.paymentMethod ? `<div><div class="info-label">Thanh toán</div><div class="info-value">${esc(data.paymentMethod)}</div></div>` : ""}
    </div>
    <table>
      <thead><tr><th>STT</th>${data.items.some(i => i.sku) ? "<th>SKU</th>" : ""}<th>Sản phẩm</th><th class="center">SL</th><th class="right">Đơn giá</th><th class="right">Thành tiền</th></tr></thead>
      <tbody>
        ${data.items.map((it, i) => `<tr><td class="center">${i + 1}</td>${it.sku ? `<td class="mono">${esc(it.sku)}</td>` : ""}<td>${esc(it.name)}</td><td class="center">${it.qty}</td><td class="right">${fmtVND(it.price)}</td><td class="right">${fmtVND(it.qty * it.price)}</td></tr>`).join("")}
        <tr class="total-row"><td colspan="${data.items.some(i => i.sku) ? 5 : 4}" class="right">Tạm tính</td><td class="right">${fmtVND(data.subtotal)}</td></tr>
        ${data.discount ? `<tr><td colspan="${data.items.some(i => i.sku) ? 5 : 4}" class="right">Giảm giá</td><td class="right">-${fmtVND(data.discount)}</td></tr>` : ""}
        <tr class="total-row"><td colspan="${data.items.some(i => i.sku) ? 5 : 4}" class="right" style="font-size:14px">TỔNG CỘNG</td><td class="right" style="font-size:14px">${fmtVND(data.total)}</td></tr>
      </tbody>
    </table>
    ${data.note ? `<div class="note"><strong>Ghi chú:</strong> ${esc(data.note)}</div>` : ""}
    <div class="signatures">
      <div class="sign-block"><div class="sign-label">Người bán</div><div class="sign-name">(Ký, ghi rõ họ tên)</div></div>
      <div class="sign-block"><div class="sign-label">Người mua</div><div class="sign-name">(Ký, ghi rõ họ tên)</div></div>
    </div>
  `)
}

// ─── Booking Receipt (Phiếu đặt sân) ────────────────────────

export interface PrintBookingData {
  code: string
  date: string
  customerName: string
  customerPhone?: string
  courtName: string
  timeSlot: string
  duration?: string
  amount: number
  paymentStatus: string
  note?: string
}

export function printBookingReceipt(data: PrintBookingData) {
  openPrint(`
    <div class="header">
      <div class="company">BadmintonHub</div>
      <div class="title">PHIẾU ĐẶT SÂN</div>
      <div class="code">${esc(data.code)}</div>
      <div class="date">Ngày: ${esc(data.date)}</div>
    </div>
    <div class="info-grid">
      <div><div class="info-label">Khách hàng</div><div class="info-value">${esc(data.customerName)}</div></div>
      ${data.customerPhone ? `<div><div class="info-label">SĐT</div><div class="info-value">${esc(data.customerPhone)}</div></div>` : ""}
      <div><div class="info-label">Sân</div><div class="info-value">${esc(data.courtName)}</div></div>
      <div><div class="info-label">Thời gian</div><div class="info-value">${esc(data.timeSlot)}</div></div>
      ${data.duration ? `<div><div class="info-label">Thời lượng</div><div class="info-value">${esc(data.duration)}</div></div>` : ""}
      <div><div class="info-label">Thanh toán</div><div class="info-value">${esc(data.paymentStatus)}</div></div>
    </div>
    <table>
      <thead><tr><th>Nội dung</th><th class="right">Thành tiền</th></tr></thead>
      <tbody>
        <tr><td>Đặt sân ${esc(data.courtName)} — ${esc(data.timeSlot)}</td><td class="right">${fmtVND(data.amount)}</td></tr>
        <tr class="total-row"><td class="right" style="font-size:14px">TỔNG CỘNG</td><td class="right" style="font-size:14px">${fmtVND(data.amount)}</td></tr>
      </tbody>
    </table>
    ${data.note ? `<div class="note"><strong>Ghi chú:</strong> ${esc(data.note)}</div>` : ""}
    <div class="signatures">
      <div class="sign-block"><div class="sign-label">Nhân viên</div><div class="sign-name">(Ký, ghi rõ họ tên)</div></div>
      <div class="sign-block"><div class="sign-label">Khách hàng</div><div class="sign-name">(Ký, ghi rõ họ tên)</div></div>
    </div>
  `)
}

// ─── Court Service Invoice (Hóa đơn dịch vụ cuối buổi) ─────

export interface PrintCourtServiceInvoiceData {
  code: string
  date: string
  invoiceKind?: "court" | "service" | "combined"
  customerName: string
  customerPhone?: string
  courtName: string
  timeSlot: string
  courtFee: number
  services: { name: string; qty: number; price: number; note?: string }[]
  serviceTotal: number
  total: number
  printedBy?: string
}

export function printCourtServiceInvoice(data: PrintCourtServiceInvoiceData) {
  const invoiceKind = data.invoiceKind || "combined"
  const showCourtFee = invoiceKind !== "service"
  const showServices = invoiceKind !== "court"
  const title =
    invoiceKind === "court"
      ? "HOA DON TIEN SAN"
      : invoiceKind === "service"
        ? "HOA DON DICH VU SAN"
        : "HOA DON DICH VU CUOI BUOI"
  const invoiceTotal =
    invoiceKind === "court"
      ? data.courtFee
      : invoiceKind === "service"
        ? data.serviceTotal
        : data.total
  openPrint(`
    <div class="header">
      <div class="company">BadmintonHub</div>
      <div class="title">${esc(title)}</div>
      <div class="code">${esc(data.code)}</div>
      <div class="date">Ngày: ${esc(data.date)}</div>
    </div>
    <div class="info-grid">
      <div><div class="info-label">Khách hàng</div><div class="info-value">${esc(data.customerName)}</div></div>
      ${data.customerPhone ? `<div><div class="info-label">SĐT</div><div class="info-value">${esc(data.customerPhone)}</div></div>` : ""}
      <div><div class="info-label">Sân</div><div class="info-value">${esc(data.courtName)}</div></div>
      <div><div class="info-label">Khung giờ</div><div class="info-value">${esc(data.timeSlot)}</div></div>
      ${data.printedBy ? `<div><div class="info-label">Nhân viên</div><div class="info-value">${esc(data.printedBy)}</div></div>` : ""}
    </div>
    <table>
      <thead><tr><th>Hạng mục</th><th class="center">SL</th><th class="right">Đơn giá</th><th class="right">Thành tiền</th></tr></thead>
      <tbody>
        ${showCourtFee ? `<tr><td>Tien san (${esc(data.timeSlot)})</td><td class="center">1</td><td class="right">${fmtVND(data.courtFee)}</td><td class="right">${fmtVND(data.courtFee)}</td></tr>` : ""}
        ${showServices
          ? data.services.length === 0
            ? `<tr><td>Dich vu tai san</td><td class="center">0</td><td class="right">${fmtVND(0)}</td><td class="right">${fmtVND(0)}</td></tr>`
            : data.services.map((service) => `<tr><td>${esc(service.name)}${service.note ? ` <span style="color:#6b7280">(${esc(service.note)})</span>` : ""}</td><td class="center">${service.qty}</td><td class="right">${fmtVND(service.price)}</td><td class="right">${fmtVND(service.qty * service.price)}</td></tr>`).join("")
          : ""}
        ${invoiceKind === "combined" ? `<tr class="total-row"><td colspan="3" class="right">Tong tien san</td><td class="right">${fmtVND(data.courtFee)}</td></tr>` : ""}
        ${invoiceKind === "combined" ? `<tr class="total-row"><td colspan="3" class="right">Tong tien dich vu</td><td class="right">${fmtVND(data.serviceTotal)}</td></tr>` : ""}
        <tr class="total-row"><td colspan="3" class="right" style="font-size:14px">TONG THANH TOAN</td><td class="right" style="font-size:14px">${fmtVND(invoiceTotal)}</td></tr>
      </tbody>
    </table>
    <div class="signatures">
      <div class="sign-block"><div class="sign-label">Nhân viên</div><div class="sign-name">(Ký, ghi rõ họ tên)</div></div>
      <div class="sign-block"><div class="sign-label">Khách hàng</div><div class="sign-name">(Ký, ghi rõ họ tên)</div></div>
    </div>
  `)
}

// ─── Warranty Card (Giấy bảo hành) ──────────────────────────

export interface PrintWarrantyData {
  orderCode: string
  date: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  warrantyMonths?: number
  items: { sku?: string; name: string; qty: number; price: number }[]
}

export function printWarrantyCard(data: PrintWarrantyData) {
  const months = data.warrantyMonths ?? 12
  const purchaseDate = new Date(data.date)
  const expiryDate = new Date(purchaseDate)
  expiryDate.setMonth(expiryDate.getMonth() + months)
  const fmtDate = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })

  openPrint(`
    <div class="header">
      <div class="company">BadmintonHub</div>
      <div class="title">GIẤY BẢO HÀNH SẢN PHẨM</div>
      <div class="code">${esc(data.orderCode)}</div>
      <div class="date">Ngày mua: ${esc(fmtDate(purchaseDate))}</div>
    </div>
    <div class="info-grid">
      <div><div class="info-label">Khách hàng</div><div class="info-value">${esc(data.customerName)}</div></div>
      ${data.customerPhone ? `<div><div class="info-label">SĐT</div><div class="info-value">${esc(data.customerPhone)}</div></div>` : ""}
      ${data.customerEmail ? `<div><div class="info-label">Email</div><div class="info-value">${esc(data.customerEmail)}</div></div>` : ""}
      <div><div class="info-label">Thời hạn BH</div><div class="info-value">${months} tháng</div></div>
      <div><div class="info-label">Ngày hết hạn</div><div class="info-value" style="color:#dc2626;font-weight:700">${esc(fmtDate(expiryDate))}</div></div>
    </div>
    <table>
      <thead><tr><th>STT</th>${data.items.some(i => i.sku) ? "<th>SKU</th>" : ""}<th>Sản phẩm</th><th class="center">SL</th><th class="right">Đơn giá</th></tr></thead>
      <tbody>
        ${data.items.map((it, i) => `<tr><td class="center">${i + 1}</td>${it.sku ? `<td class="mono">${esc(it.sku)}</td>` : ""}<td>${esc(it.name)}</td><td class="center">${it.qty}</td><td class="right">${fmtVND(it.price)}</td></tr>`).join("")}
      </tbody>
    </table>
    <div class="note">
      <strong>Điều kiện bảo hành:</strong><br/>
      1. Sản phẩm được bảo hành miễn phí trong thời hạn ${months} tháng kể từ ngày mua.<br/>
      2. Bảo hành áp dụng cho lỗi do nhà sản xuất.<br/>
      3. Không bảo hành các trường hợp: hư hỏng do người dùng, sử dụng sai mục đích, tác động ngoại lực, hoặc sửa chữa tại nơi không được ủy quyền.<br/>
      4. Vui lòng xuất trình giấy bảo hành này khi yêu cầu bảo hành.
    </div>
    <div class="signatures">
      <div class="sign-block"><div class="sign-label">Đại diện cửa hàng</div><div class="sign-name">(Ký, đóng dấu)</div></div>
      <div class="sign-block"><div class="sign-label">Khách hàng</div><div class="sign-name">(Ký, ghi rõ họ tên)</div></div>
    </div>
  `)
}
