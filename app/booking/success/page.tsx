'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2, Calendar, Clock, MapPin,
  CreditCard, AlertCircle, Home, RotateCcw, ListOrdered,
  Receipt, Sparkles, QrCode, Phone,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatVND } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

// Regular single booking (stored by /booking/page.tsx)
interface RegularBookingData {
  id: string;
  courtName: string;
  courtType: string;
  branch: string;
  courtAddress?: string;
  date: string;
  timeRange: string;
  people: number;
  amount: number;
  paymentMethod: string;
  contact: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  racketRental: boolean;
  note?: string;
}

// Fixed schedule booking (stored by /booking/fixed-schedule)
interface FixedBookingData {
  fixedSchedule: {
    id: string;
    courtName: string;
    cycle: 'weekly' | 'monthly';
    occurrenceCount: number;
    invoiceCode: string;
    totalAmount: number;
  };
  invoiceCode: string;
  totalAmount: number;
  bookingsCreated: number;
}

const paymentLabels: Record<string, string> = {
  cash: 'Tiền mặt',
  momo: 'MoMo',
  vnpay: 'VNPay',
  bank: 'Chuyển khoản',
  wallet: 'Ví BadmintonHub',
};

// ─── Regular Booking Success ──────────────────────────────────────────────────
function RegularSuccess({ data }: { data: RegularBookingData }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/40 via-white to-emerald-50/30 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-4">

        {/* Success header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <CheckCircle2 className="h-11 w-11 text-green-600" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="h-1 w-8 rounded bg-green-200" />
            <span className="text-xs text-green-600 font-semibold uppercase tracking-widest">Thành công</span>
            <div className="h-1 w-8 rounded bg-green-200" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Đặt sân thành công!</h1>
          <p className="text-gray-500 text-sm mb-4">
            Cảm ơn bạn đã đặt sân tại BadmintonHub
          </p>

          {/* Booking ID */}
          <div className="inline-flex flex-col items-center gap-1.5 px-5 py-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-2 text-sm">
              <Receipt className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Mã đặt sân:</span>
              <span className="font-mono font-bold text-green-600">{data.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Court info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-green-600" />
            Thông tin đặt sân
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem icon={<MapPin className="h-4 w-4" />} label="Sân" value={data.courtName} />
            <InfoItem icon={<MapPin className="h-4 w-4" />} label="Chi nhánh" value={data.branch} />
            <InfoItem icon={<Calendar className="h-4 w-4" />} label="Ngày" value={data.date} />
            <InfoItem icon={<Clock className="h-4 w-4" />} label="Giờ" value={data.timeRange} highlight />
            <InfoItem icon={<CreditCard className="h-4 w-4" />} label="Thanh toán" value={paymentLabels[data.paymentMethod] || data.paymentMethod} />
            <InfoItem icon={<CreditCard className="h-4 w-4" />} label="Tổng tiền" value={formatVND(data.amount)} highlight />
          </div>
          {data.racketRental && (
            <p className="mt-3 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" /> Đã bao gồm thuê vợt
            </p>
          )}
        </div>

        {/* Contact info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Phone className="h-4 w-4 text-green-600" />
            Thông tin liên hệ
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem icon={<></>} label="Họ tên" value={data.contact.name} />
            <InfoItem icon={<></>} label="Số điện thoại" value={data.contact.phone} />
          </div>
        </div>

        {/* QR Check-in Card */}
        <div className="bg-[#0a2416] rounded-2xl p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <QrCode className="h-4 w-4 text-green-400" />
            <span className="text-green-400 text-xs font-semibold uppercase tracking-widest">Mã QR Check-in</span>
          </div>
          <p className="text-green-200 text-sm mb-5">Xuất trình mã này khi đến sân để check-in tức thì</p>
          {/* Actual QR code */}
          <div className="flex justify-center mb-4">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(data.id)}&color=0a2416&bgcolor=ffffff`}
              alt={`QR Check-in ${data.id}`}
              width={180}
              height={180}
              className="border-4 border-white rounded-xl bg-white"
            />
          </div>
          <p className="text-green-300/60 text-xs font-mono">{data.id}</p>
          <p className="text-green-200/70 text-xs mt-3">
            📧 QR code cũng được gửi kèm email xác nhận của bạn
          </p>
        </div>

        {/* Next steps */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Hướng dẫn check-in
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            {[
              'Lưu lại email xác nhận hoặc chụp ảnh mã QR ở trên',
              'Đến sân trước 15 phút — xuất trình mã QR cho nhân viên quét',
              'Hệ thống xác nhận check-in → bắt đầu tính giờ chơi',
              'Chơi xong → nhân viên ghi nhận hoàn thành tự động',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/my-bookings"
            className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-4 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm shadow-green-600/20"
          >
            <ListOrdered className="h-4 w-4" />
            Lịch đặt của tôi
          </Link>
          <Link
            href="/courts"
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Đặt thêm sân
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <Home className="h-4 w-4" />
            Trang chủ
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Cần hỗ trợ? Hotline:{' '}
          <a href="tel:1900123456" className="text-green-600 font-semibold">1900 123 456</a>
        </p>
      </div>
    </div>
  );
}

// ─── Fixed Schedule Success ───────────────────────────────────────────────────
function FixedSuccess({ data }: { data: FixedBookingData }) {
  const { fixedSchedule, invoiceCode, totalAmount, bookingsCreated } = data;
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/40 via-white to-emerald-50/30 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-4">

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-11 w-11 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Đặt lịch thành công!</h1>
          <p className="text-gray-500 text-sm mb-4">Cảm ơn bạn đã đặt lịch cố định tại BadmintonHub</p>
          <div className="inline-flex flex-col items-center gap-1.5 px-5 py-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-2 text-sm">
              <Receipt className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Mã hóa đơn:</span>
              <span className="font-mono font-bold text-green-600">{invoiceCode}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Mã lịch:</span>
              <span className="font-mono">{fixedSchedule.id.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-green-600" />
            Thông tin gói đặt lịch
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem icon={<MapPin className="h-4 w-4" />} label="Sân" value={fixedSchedule.courtName} />
            <InfoItem icon={<Calendar className="h-4 w-4" />} label="Chu kỳ" value={fixedSchedule.cycle === 'weekly' ? 'Hàng tuần' : 'Hàng tháng'} />
            <InfoItem icon={<Clock className="h-4 w-4" />} label="Số buổi đã đặt" value={`${bookingsCreated} buổi`} />
            <InfoItem icon={<CreditCard className="h-4 w-4" />} label="Tổng tiền" value={formatVND(totalAmount)} highlight />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Bước tiếp theo
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            {[
              'Chúng tôi sẽ gửi email xác nhận đến địa chỉ của bạn',
              'Vui lòng thanh toán trước ngày đầu tiên tối thiểu 50% tổng tiền',
              'Xem và quản lý lịch đặt tại mục "Lịch sử đặt sân"',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/my-bookings" className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-4 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm shadow-green-600/20">
            <ListOrdered className="h-4 w-4" /> Lịch sử đặt sân
          </Link>
          <Link href="/booking/fixed-schedule" className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
            <RotateCcw className="h-4 w-4" /> Đặt thêm lịch
          </Link>
          <Link href="/" className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
            <Home className="h-4 w-4" /> Trang chủ
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Cần hỗ trợ? Hotline:{' '}
          <a href="tel:1900123456" className="text-green-600 font-semibold">1900 123 456</a>
        </p>
      </div>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────
function ErrorState() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Không tìm thấy thông tin</h2>
        <p className="text-sm text-gray-500 mb-6">
          Vui lòng kiểm tra trong lịch sử đặt sân hoặc liên hệ hỗ trợ.
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/my-bookings" className="inline-flex items-center justify-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
            <ListOrdered className="h-4 w-4" /> Lịch đặt của tôi
          </Link>
          <Link href="/" className="inline-flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
            <Home className="h-4 w-4" /> Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function BookingSuccessContent() {
  const [loading, setLoading] = useState(true);
  const [regularData, setRegularData] = useState<RegularBookingData | null>(null);
  const [fixedData, setFixedData] = useState<FixedBookingData | null>(null);

  useEffect(() => {
    // Try regular booking first
    const savedRegular = localStorage.getItem('completedBooking');
    if (savedRegular) {
      try {
        setRegularData(JSON.parse(savedRegular));
        localStorage.removeItem('completedBooking');
        setLoading(false);
        return;
      } catch {
        localStorage.removeItem('completedBooking');
      }
    }

    // Try fixed schedule booking
    const savedFixed = localStorage.getItem('completedFixedBooking');
    if (savedFixed) {
      try {
        setFixedData(JSON.parse(savedFixed));
        localStorage.removeItem('completedFixedBooking');
      } catch {
        localStorage.removeItem('completedFixedBooking');
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (regularData) return <RegularSuccess data={regularData} />;
  if (fixedData) return <FixedSuccess data={fixedData} />;
  return <ErrorState />;
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
      </div>
    }>
      <BookingSuccessContent />
    </Suspense>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function InfoItem({
  icon, label, value, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className={cn('text-sm font-semibold', highlight ? 'text-green-600' : 'text-gray-800')}>
          {value}
        </p>
      </div>
    </div>
  );
}
