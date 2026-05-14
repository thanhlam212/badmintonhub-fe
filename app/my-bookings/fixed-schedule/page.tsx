'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Calendar, Clock, MapPin, CheckCircle2,
  XCircle, SkipForward, RefreshCw, Receipt, BadgeCheck,
  AlertCircle, Loader2, Home, Settings2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface OccurrenceDetail {
  id: string;
  date: string;
  dayLabel: string;
  timeStart: string;
  timeEnd: string;
  status: string;
  courtId: number;
  courtName: string;
  amountSnapshot: number;
  bookingId: string | null;
  bookingStatus: string | null;
}

interface ScheduleDetail {
  id: string;
  status: string;
  cycle: string;
  startDate: string;
  endDate: string;
  timeStart: string;
  timeEnd: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  paymentMethod: string;
  occurrenceCount: number;
  adjustmentLimit: number;
  adjustmentUsed: number;
  pricePerHourSnapshot: number;
  totalAmountSnapshot: number;
  createdAt: string;
  court: {
    id: number;
    name: string;
    type: string;
    price: number;
    branch: { name: string; address: string };
  };
  occurrences: OccurrenceDetail[];
  invoice: {
    id: string;
    code: string;
    totalSnapshot: number;
    status: string;
    paymentMethod: string;
  } | null;
}

// ═══════════════════════════════════════════════════════════════
// OCCURRENCE STATUS CONFIG
// ═══════════════════════════════════════════════════════════════

const OCC_STATUS: Record<string, {
  label: string;
  icon: React.ReactNode;
  rowClass: string;
  badgeClass: string;
}> = {
  scheduled: {
    label: 'Sắp diễn ra',
    icon: <Clock className="h-3.5 w-3.5" />,
    rowClass: 'bg-white',
    badgeClass: 'bg-green-50 text-green-700 border-green-100',
  },
  completed: {
    label: 'Hoàn thành',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    rowClass: 'bg-gray-50/50',
    badgeClass: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  skipped: {
    label: 'Đã bỏ qua',
    icon: <SkipForward className="h-3.5 w-3.5" />,
    rowClass: 'bg-gray-50/50 opacity-60',
    badgeClass: 'bg-gray-100 text-gray-500 border-gray-200',
  },
  rescheduled: {
    label: 'Đổi lịch',
    icon: <RefreshCw className="h-3.5 w-3.5" />,
    rowClass: 'bg-blue-50/30',
    badgeClass: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  cancelled: {
    label: 'Đã hủy',
    icon: <XCircle className="h-3.5 w-3.5" />,
    rowClass: 'bg-red-50/30 opacity-60',
    badgeClass: 'bg-red-50 text-red-500 border-red-100',
  },
};

// ═══════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════

export default function ScheduleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const scheduleId = params.scheduleId as string;
  const { user } = useAuth();

  const [schedule, setSchedule] = useState<ScheduleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'completed' | 'skipped'>('all');

  useEffect(() => {
    if (!scheduleId) return;
    fetchDetail();
  }, [scheduleId]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`${API}/bookings/fixed/${scheduleId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Không thể tải thông tin');
      setSchedule(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-7 w-7 text-green-600 animate-spin" />
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center max-w-sm w-full">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-4">{error || 'Không tìm thấy gói đặt lịch'}</p>
          <button
            onClick={() => router.push('/my-booking')}
            className="text-sm text-green-600 font-medium hover:underline"
          >
            ← Quay về danh sách
          </button>
        </div>
      </div>
    );
  }

  const filteredOccurrences = filter === 'all'
    ? schedule.occurrences
    : schedule.occurrences.filter((o) => o.status === filter);

  const adjustmentLeft = schedule.adjustmentLimit - schedule.adjustmentUsed;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push('/my-booking')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{schedule.court.name}</p>
            <p className="text-xs text-gray-400">Chi tiết gói đặt lịch</p>
          </div>
          <span className={cn(
            'text-xs px-2.5 py-1 rounded-full border font-medium',
            schedule.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' :
            schedule.status === 'pending'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
            'bg-gray-50 text-gray-600 border-gray-200',
          )}>
            {schedule.status === 'confirmed' ? 'Đã xác nhận' :
             schedule.status === 'pending'   ? 'Chờ thanh toán' :
             schedule.status}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* ── Thông tin gói ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{schedule.court.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{schedule.court.branch.name} · {schedule.court.type}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="Chu kỳ" value={schedule.cycle === 'weekly' ? 'Hàng tuần' : 'Hàng tháng'} />
            <InfoRow label="Khung giờ" value={`${schedule.timeStart} – ${schedule.timeEnd}`} />
            <InfoRow label="Từ ngày" value={schedule.startDate} />
            <InfoRow label="Đến ngày" value={schedule.endDate} />
            <InfoRow label="Tổng tiền" value={`${schedule.totalAmountSnapshot.toLocaleString('vi-VN')}đ`} highlight />
            <InfoRow
              label="Điều chỉnh còn lại"
              value={`${adjustmentLeft}/${schedule.adjustmentLimit} lần`}
              highlight={adjustmentLeft > 0}
            />
          </div>
        </div>

        {/* ── Invoice ── */}
        {schedule.invoice && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">Hóa đơn</span>
              </div>
              <span className={cn(
                'text-xs px-2.5 py-1 rounded-full border font-medium',
                schedule.invoice.status === 'paid'
                  ? 'bg-green-50 text-green-600 border-green-200'
                  : schedule.invoice.status === 'deposited'
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : 'bg-amber-50 text-amber-600 border-amber-200',
              )}>
                {schedule.invoice.status === 'paid' ? 'Đã thanh toán' :
                 schedule.invoice.status === 'deposited' ? 'Đã cọc' : 'Chưa thanh toán'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2 font-mono">{schedule.invoice.code}</p>
          </div>
        )}

        {/* ── Occurrences ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header + filter */}
          <div className="px-5 pt-4 pb-3 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-800 mb-3">
              Danh sách buổi ({schedule.occurrences.length} buổi)
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['all', 'scheduled', 'completed', 'skipped'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                    filter === f
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                  )}
                >
                  {f === 'all'       ? `Tất cả (${schedule.occurrences.length})` :
                   f === 'scheduled' ? `Sắp tới (${schedule.occurrences.filter(o => o.status === 'scheduled').length})` :
                   f === 'completed' ? `Hoàn thành (${schedule.occurrences.filter(o => o.status === 'completed').length})` :
                   `Bỏ qua (${schedule.occurrences.filter(o => o.status === 'skipped').length})`}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            {filteredOccurrences.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                Không có buổi nào
              </div>
            ) : (
              filteredOccurrences.map((occ, idx) => {
                const cfg = OCC_STATUS[occ.status] || OCC_STATUS.scheduled;
                const isOriginalCourt = occ.courtId === schedule.court.id;
                return (
                  <div key={occ.id} className={cn('flex items-center gap-4 px-5 py-3.5', cfg.rowClass)}>
                    {/* Index */}
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                      {idx + 1}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{occ.dayLabel}</span>
                        <span className="text-xs text-gray-400">{occ.date}</span>
                        {!isOriginalCourt && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded border border-blue-100">
                            {occ.courtName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {occ.timeStart} – {occ.timeEnd}
                        {occ.amountSnapshot > 0 && (
                          <span className="ml-2">{occ.amountSnapshot.toLocaleString('vi-VN')}đ</span>
                        )}
                      </p>
                    </div>

                    {/* Status badge */}
                    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border shrink-0', cfg.badgeClass)}>
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pb-6">
          <button
            onClick={() => router.push('/my-booking')}
            className="flex-1 h-11 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Danh sách
          </button>

          {/* ✨ Nút điều chỉnh - chỉ hiện khi gói còn active và còn quota */}
          {['pending', 'deposited', 'confirmed'].includes(schedule.status) &&
           schedule.adjustmentUsed < schedule.adjustmentLimit && (
            <button
              onClick={() => router.push(`/my-booking/${scheduleId}/adjust`)}
              className="flex-1 h-11 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-green-600/20"
            >
              <Settings2 className="h-4 w-4" />
              Điều chỉnh lịch
            </button>
          )}

          <button
            onClick={() => router.push('/')}
            className="flex-1 h-11 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <Home className="h-4 w-4" />
            Trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={cn('text-sm font-semibold', highlight ? 'text-green-600' : 'text-gray-800')}>
        {value}
      </p>
    </div>
  );
}