'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2, Calendar, Clock, MapPin,
  CreditCard, AlertCircle, Home, RotateCcw, ListOrdered,
  Receipt, Sparkles, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════
// TYPE - khớp với data mình lưu vào localStorage ở page.tsx
// ═══════════════════════════════════════════════════════════════

interface CompletedBookingData {
  fixedSchedule: {
    id: string;           // scheduleId từ BE
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

// ═══════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════

export default function BookingSuccessPage() {
  const searchParams = useSearchParams();
  const scheduleId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CompletedBookingData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('completedFixedBooking');
    if (saved) {
      try {
        setData(JSON.parse(saved));
        localStorage.removeItem('completedFixedBooking');
      } catch {
        // ignore parse error
      }
    }
    setLoading(false);
  }, []);

  // ── Loading ──
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

  // ── Error / No data ──
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Không tìm thấy thông tin
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Vui lòng kiểm tra trong lịch sử đặt sân hoặc liên hệ hỗ trợ.
            {scheduleId && (
              <span className="block mt-1 font-mono text-xs text-gray-400">
                ID: {scheduleId}
              </span>
            )}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            <Home className="h-4 w-4" />
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  const { fixedSchedule, invoiceCode, totalAmount, bookingsCreated } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/40 via-white to-emerald-50/30 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-4">

        {/* ── Success header ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-11 w-11 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Đặt lịch thành công!
          </h1>
          <p className="text-gray-500 text-sm mb-4">
            Cảm ơn bạn đã đặt lịch tại BadmintonHub
          </p>

          {/* Invoice + Schedule ID */}
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

        {/* ── Thông tin gói ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-green-600" />
            Thông tin gói đặt lịch
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <InfoItem
              icon={<MapPin className="h-4 w-4" />}
              label="Sân"
              value={fixedSchedule.courtName}
            />
            <InfoItem
              icon={<Calendar className="h-4 w-4" />}
              label="Chu kỳ"
              value={fixedSchedule.cycle === 'weekly' ? 'Hàng tuần' : 'Hàng tháng'}
            />
            <InfoItem
              icon={<Clock className="h-4 w-4" />}
              label="Số buổi đã đặt"
              value={`${bookingsCreated} buổi`}
            />
            <InfoItem
              icon={<CreditCard className="h-4 w-4" />}
              label="Tổng tiền"
              value={`${totalAmount.toLocaleString('vi-VN')}đ`}
              highlight
            />
          </div>
        </div>

        {/* ── Hướng dẫn tiếp theo ── */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Bước tiếp theo
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            {[
              'Chúng tôi sẽ gửi email xác nhận đến địa chỉ của bạn',
              'Vui lòng thanh toán trước ngày đầu tiên tối thiểu 50% tổng tiền',
              'Xem và quản lý lịch đặt tại mục "Lịch sử đặt sân"',
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

        {/* ── Action buttons ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/my-booking"
            className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-4 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm shadow-green-600/20"
          >
            <ListOrdered className="h-4 w-4" />
            Lịch sử đặt sân
          </Link>
          <Link
            href="/booking/fixed-schedule"
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Đặt thêm lịch
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <Home className="h-4 w-4" />
            Trang chủ
          </Link>
        </div>

        {/* ── Support ── */}
        <p className="text-center text-xs text-gray-400 pb-4">
          Cần hỗ trợ? Hotline:{' '}
          <a href="tel:1900123456" className="text-green-600 font-semibold">
            1900 123 456
          </a>
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HELPER COMPONENT
// ═══════════════════════════════════════════════════════════════

function InfoItem({
  icon,
  label,
  value,
  highlight,
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
        <p className={cn(
          'text-sm font-semibold',
          highlight ? 'text-green-600' : 'text-gray-800',
        )}>
          {value}
        </p>
      </div>
    </div>
  );
}