'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, MapPin, ArrowRight, ArrowLeft,
  CheckCircle2, AlertCircle, RefreshCw, SkipForward,
  Home, User, CreditCard, ChevronRight, Loader2,
  BadgeCheck, XCircle, Sparkles, Shield, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useFixedSchedule } from './hooks/useFixedSchedule';
import type {
  FixedScheduleCycle,
  PaymentMethod,
  OccurrenceUIState,
  OccurrenceAction,
  Court,
} from './types';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string; desc: string }[] = [
  { value: 'cash',          label: 'Tiền mặt',   icon: '💵', desc: 'Thanh toán tại quầy' },
  { value: 'bank_transfer', label: 'Chuyển khoản', icon: '🏦', desc: 'Internet Banking' },
  { value: 'momo',          label: 'MoMo',        icon: '📱', desc: 'Ví điện tử MoMo' },
  { value: 'vnpay',         label: 'VNPay',       icon: '💳', desc: 'Cổng thanh toán VNPay' },
];

// ═══════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function FixedSchedulePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);

  // ── Step 1 state ──
  const [courts, setCourts] = useState<Court[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(true);
  const [courtId, setCourtId] = useState('');
  const [cycle, setCycle] = useState<FixedScheduleCycle>('weekly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeStart, setTimeStart] = useState('08:00');
  const [timeEnd, setTimeEnd] = useState('10:00');

  // ── Step 2 state (customer) ──
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [adjustmentLimit, setAdjustmentLimit] = useState(2);

  const {
    preview,
    occurrences,
    loadingPreview,
    loadingConfirm,
    fetchPreview,
    setOccurrenceAction,
    setCustomAction,
    checkSlot,
    confirmBooking,
  } = useFixedSchedule();

  // ── Fetch courts ──
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingCourts(true);
        const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const res = await fetch(`${API}/courts`);
        const data = await res.json();
        setCourts(Array.isArray(data) ? data : data.data || []);
      } catch {
        setCourts([]);
      } finally {
        setLoadingCourts(false);
      }
    };
    load();
  }, []);

  // ── Auto-fill từ user đang login ──
  useEffect(() => {
    if (!user || user.role === 'guest') return;
    if (!customerName && user.fullName) setCustomerName(user.fullName);
    if (!customerPhone && user.phone)   setCustomerPhone(user.phone);
    if (!customerEmail && user.email)   setCustomerEmail(user.email);
  }, [user]);

  // ── Validation ──
  const isStep1Valid = !!(courtId && startDate && endDate && timeStart && timeEnd);
  const isStep2Valid = !!(
    customerName.trim() &&
    /^(0[3|5|7|8|9])+([0-9]{8})$/.test(customerPhone) &&
    paymentMethod
  );
  const hasBillableOccurrences = occurrences.some(
    (o) => o.action === 'keep' || o.action === 'replace' || o.action === 'custom',
  );

  // ── Handlers ──
  const handlePreview = async () => {
    if (!isStep1Valid) { toast.error('Vui lòng điền đầy đủ thông tin!'); return; }
    const ok = await fetchPreview({
      courtId: parseInt(courtId),
      cycle, startDate, endDate, timeStart, timeEnd,
    });
    if (ok) setStep(2);
  };

  const handleConfirm = async () => {
    if (!isStep2Valid || !preview) {
      toast.error('Vui lòng điền đầy đủ thông tin khách hàng!');
      return;
    }
    if (!hasBillableOccurrences) {
      toast.error('Phải có ít nhất 1 buổi được giữ hoặc thay thế!');
      return;
    }

    const decisions = occurrences.map((occ) => ({
      date: occ.date,
      action: occ.action,
      ...(occ.action === 'replace' && occ.selectedReplacement
        ? { replaceWithCourtId: occ.selectedReplacement.courtId }
        : {}),
      ...(occ.action === 'custom'
        ? {
            replaceWithCourtId: occ.customCourtId,
            customTimeStart: occ.customTimeStart,
            customTimeEnd: occ.customTimeEnd,
          }
        : {}),
    }));

    const result = await confirmBooking({
      courtId: parseInt(courtId),
      cycle, startDate, endDate, timeStart, timeEnd,
      customerName,
      customerPhone,
      customerEmail: customerEmail || undefined,
      paymentMethod,
      userId: user?.role !== 'guest' ? user?.id : undefined,
      adjustmentLimit,
      decisions,
    });

    if (result) {
      localStorage.setItem('completedFixedBooking', JSON.stringify({
        fixedSchedule: {
          id: result.scheduleId,          // ← success page đọc fixedSchedule.id
          courtName: courts.find((c) => c.id === parseInt(courtId))?.name || 'Sân',
          cycle,
          occurrenceCount: result.bookingsCreated,
          invoiceCode: result.invoiceCode,
          totalAmount: result.totalAmount,
        },
        invoiceCode: result.invoiceCode,
        totalAmount: result.totalAmount,
        bookingsCreated: result.bookingsCreated,
      }));
      router.push(`/booking/success?id=${result.scheduleId}`);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/20 to-emerald-50/30">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-600 transition-colors group"
          >
            <Home className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Trang chủ</span>
          </button>

          {/* Stepper */}
          <div className="flex items-center gap-3">
            {(['Chọn lịch', 'Xác nhận'] as const).map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                )}
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                    i + 1 === step
                      ? 'bg-green-600 text-white shadow-md shadow-green-600/30'
                      : i + 1 < step
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-400',
                  )}>
                    {i + 1 < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={cn(
                    'text-xs font-medium hidden sm:inline',
                    i + 1 === step ? 'text-green-600' : 'text-gray-400',
                  )}>
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Nút quay lại step 1 hoặc thoát */}
          {step === 2 ? (
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Quay lại</span>
            </button>
          ) : (
            <button
              onClick={() => router.push('/courts')}
              className="text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              Hủy
            </button>
          )}
        </div>
      </div>

      {/* ── Page header ── */}
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Đặt sân cố định
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Lịch đặt sân cố định
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Đặt sân định kỳ theo tuần hoặc tháng — không lo hết chỗ
          </p>
        </motion.div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-4 pb-24">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25 }}
              className="max-w-2xl mx-auto space-y-4"
            >
              {/* Court + Cycle */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  Thông tin sân & chu kỳ
                </h2>

                {/* Court select */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-600">
                    Chọn sân <span className="text-red-400">*</span>
                  </label>
                  {loadingCourts ? (
                    <div className="h-11 bg-gray-100 animate-pulse rounded-xl" />
                  ) : (
                    <select
                      value={courtId}
                      onChange={(e) => setCourtId(e.target.value)}
                      className="w-full h-11 px-3.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                    >
                      <option value="">-- Chọn sân cầu lông --</option>
                      {courts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.type} · {c.price.toLocaleString('vi-VN')}đ/giờ
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Cycle toggle */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-600">
                    Chu kỳ <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['weekly', 'monthly'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCycle(c)}
                        className={cn(
                          'h-11 rounded-xl border-2 text-sm font-semibold transition-all duration-150',
                          cycle === c
                            ? 'border-green-600 bg-green-600 text-white shadow-md shadow-green-600/20'
                            : 'border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50',
                        )}
                      >
                        {c === 'weekly' ? '📅 Hàng tuần' : '📆 Hàng tháng'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Date + Time */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-green-600" />
                  Thời gian
                </h2>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Từ ngày
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      min={today}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full h-11 px-3.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Đến ngày
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || today}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full h-11 px-3.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                    />
                  </div>
                </div>

                {/* Time range - đẹp hơn với visual */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Khung giờ
                  </label>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex-1 space-y-1">
                      <p className="text-xs text-gray-400">Bắt đầu</p>
                      <input
                        type="time"
                        value={timeStart}
                        onChange={(e) => setTimeStart(e.target.value)}
                        className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1 pt-4">
                      <div className="w-8 h-px bg-gray-300" />
                      <span className="text-xs text-gray-400">đến</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs text-gray-400">Kết thúc</p>
                      <input
                        type="time"
                        value={timeEnd}
                        onChange={(e) => setTimeEnd(e.target.value)}
                        className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                      />
                    </div>
                  </div>
                  {timeStart && timeEnd && timeEnd <= timeStart && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Giờ kết thúc phải sau giờ bắt đầu
                    </p>
                  )}
                </div>
              </div>

              {/* Info note */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-sm text-blue-700">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                <div className="space-y-1">
                  <p className="font-semibold">Lưu ý về gói đặt sân</p>
                  <ul className="text-xs space-y-0.5 text-blue-600 list-disc ml-3">
                    <li>Gói <strong>hàng tuần</strong>: tối thiểu 4 tuần (28 ngày)</li>
                    <li>Gói <strong>hàng tháng</strong>: tối thiểu 2 chu kỳ (56 ngày)</li>
                    <li>Sân bị trùng lịch sẽ được <strong>tự động gợi ý sân bù</strong> miễn phí</li>
                  </ul>
                </div>
              </div>

              {/* CTA */}
              <Button
                onClick={handlePreview}
                disabled={!isStep1Valid || loadingPreview}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg shadow-green-600/25 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
              >
                {loadingPreview ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang kiểm tra lịch...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Xem trước lịch đặt
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start"
            >
              {/* ── LEFT: Occurrences + Customer ── */}
              <div className="lg:col-span-3 space-y-4">
                {/* Occurrences list */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-50">
                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-green-600" />
                      Danh sách buổi
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-100">
                        ✅ {occurrences.filter((o) => !o.hasConflict).length} khả dụng
                      </span>
                      {occurrences.filter((o) => o.action === 'replace').length > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                          🔄 {occurrences.filter((o) => o.action === 'replace').length} sân bù
                        </span>
                      )}
                      {occurrences.filter((o) => o.action === 'skip').length > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full border border-gray-100">
                          ⏭ {occurrences.filter((o) => o.action === 'skip').length} bỏ qua
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
                    {occurrences.map((occ, idx) => (
                      <OccurrenceRow
                        key={occ.date}
                        occ={occ}
                        index={idx + 1}
                        preview={preview!}
                        onSetAction={setOccurrenceAction}
                        onSetCustomAction={setCustomAction}
                        checkSlot={checkSlot}
                      />
                    ))}
                  </div>
                </div>

                {/* Customer info */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                  <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                    <User className="h-4 w-4 text-green-600" />
                    Thông tin khách hàng
                    {user && user.role !== 'guest' && (
                      <span className="ml-auto text-xs text-green-600 flex items-center gap-1">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Tự động điền từ tài khoản
                      </span>
                    )}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">
                        Họ và tên <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Nguyễn Văn A"
                        className="w-full h-10 px-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">
                        Số điện thoại <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="0901234567"
                        className={cn(
                          'w-full h-10 px-3.5 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all',
                          customerPhone && !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(customerPhone)
                            ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400'
                            : 'border-gray-200 focus:ring-green-500/30 focus:border-green-500',
                        )}
                      />
                      {customerPhone && !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(customerPhone) && (
                        <p className="text-xs text-red-500">Số điện thoại không hợp lệ</p>
                      )}
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">
                        Email <span className="text-gray-300">(tùy chọn)</span>
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full h-10 px-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Số lần điều chỉnh */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">
                      Số lần điều chỉnh cho phép
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAdjustmentLimit(n)}
                          className={cn(
                            'flex-1 h-9 rounded-xl text-sm font-semibold border-2 transition-all',
                            adjustmentLimit === n
                              ? 'border-green-600 bg-green-600 text-white'
                              : 'border-gray-200 text-gray-600 hover:border-green-300',
                          )}
                        >
                          {n} lần
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">
                      Số buổi khách được phép báo nghỉ/dời/đổi sân trong suốt gói
                    </p>
                  </div>
                </div>

                {/* Payment method */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
                  <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-green-600" />
                    Phương thức thanh toán
                  </h2>
                  <div className="grid grid-cols-2 gap-2.5">
                    {PAYMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPaymentMethod(opt.value)}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                          paymentMethod === opt.value
                            ? 'border-green-600 bg-green-50'
                            : 'border-gray-100 hover:border-gray-200 bg-white',
                        )}
                      >
                        <span className="text-xl">{opt.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                          <p className="text-xs text-gray-400">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── RIGHT: Pricing summary + CTA ── */}
              <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-20">
                {preview && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                    {/* Court info */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                        <MapPin className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{preview.court.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {cycle === 'weekly' ? 'Gói hàng tuần' : 'Gói hàng tháng'}
                          {' · '}{preview.timeStart} – {preview.timeEnd}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-gray-50 pt-3 space-y-2 text-sm">
                      <div className="flex justify-between text-gray-500">
                        <span>Giá/giờ</span>
                        <span className="text-gray-800 font-medium">
                          {preview.pricing.pricePerHour.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Giờ/buổi</span>
                        <span className="text-gray-800 font-medium">
                          {preview.hoursPerSession} giờ
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Giá/buổi</span>
                        <span className="text-gray-800 font-medium">
                          {preview.pricing.pricePerSession.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Số buổi tính tiền</span>
                        <span className="text-gray-800 font-medium">
                          {occurrences.filter((o) => o.action !== 'skip').length} buổi
                        </span>
                      </div>
                      {occurrences.some((o) => o.action === 'skip') && (
                        <div className="flex justify-between text-gray-400 text-xs">
                          <span>Buổi bỏ qua</span>
                          <span>{occurrences.filter((o) => o.action === 'skip').length} buổi (miễn phí)</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                      <span className="font-bold text-gray-900">Tổng cộng</span>
                      <span className="text-xl font-bold text-green-600">
                        {(
                          preview.pricing.pricePerSession *
                          occurrences.filter((o) => o.action !== 'skip').length
                        ).toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    {occurrences.some((o) => o.action === 'replace') && (
                      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl text-xs text-blue-600">
                        <RefreshCw className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        Sân thay thế tính theo giá sân gốc (bù miễn phí)
                      </div>
                    )}

                    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
                      <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
                      Giá đã được chốt tại thời điểm đặt, không thay đổi về sau
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <Button
                  onClick={handleConfirm}
                  disabled={!isStep2Valid || !hasBillableOccurrences || loadingConfirm}
                  className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg shadow-green-600/25 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
                >
                  {loadingConfirm ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang xử lý...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Xác nhận đặt lịch
                    </span>
                  )}
                </Button>

                <button
                  onClick={() => router.push('/')}
                  className="w-full h-10 text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Home className="h-3.5 w-3.5" />
                  Về trang chủ
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Loading overlay */}
      {loadingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Loader2 className="h-7 w-7 text-green-600 animate-spin" />
            </div>
            <p className="font-semibold text-gray-900">Đang xử lý đặt lịch...</p>
            <p className="text-sm text-gray-400">Vui lòng không đóng trang này</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADJUST SLOT MODAL
// ═══════════════════════════════════════════════════════════════

function AdjustSlotModal({
  occ,
  branchId,
  originalCourtType,
  onConfirm,
  onClose,
  checkSlot,
}: {
  occ: import('./types').OccurrenceUIState;
  branchId: number;
  originalCourtType: string;
  onConfirm: (courtId: number, courtName: string, timeStart: string, timeEnd: string) => void;
  onClose: () => void;
  checkSlot: (req: import('./types').CheckSlotRequest) => Promise<import('./types').CheckSlotResponse | null>;
}) {
  const [timeStart, setTimeStart] = useState(occ.timeStart);
  const [timeEnd, setTimeEnd] = useState(occ.timeEnd);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<import('./types').CheckSlotResponse | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);

  const handleCheck = async () => {
    if (!timeStart || !timeEnd || timeEnd <= timeStart) {
      toast.error('Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }
    setChecking(true);
    // Check với sân gốc trước, BE sẽ trả về danh sách tất cả sân cùng type
    const result = await checkSlot({
      courtId: occ.suggestedReplacement?.courtId || parseInt(String(occ.conflicts[0]?.bookedBy || '1')),
      date: occ.date,
      timeStart,
      timeEnd,
    });
    setCheckResult(result);
    // Auto-select sân đầu tiên available
    if (result) {
      const firstAvailable = result.courts.find(c => c.available);
      setSelectedCourtId(firstAvailable?.id || null);
    }
    setChecking(false);
  };

  const handleConfirm = () => {
    if (!selectedCourtId || !checkResult) return;
    const court = checkResult.courts.find(c => c.id === selectedCourtId);
    if (!court || !court.available) {
      toast.error('Vui lòng chọn sân còn trống');
      return;
    }
    onConfirm(court.id, court.name, timeStart, timeEnd);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">Điều chỉnh buổi</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {occ.dayLabel} · {occ.date}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <XCircle className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Giờ mới */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Giờ mới
            </label>
            <div className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex-1 space-y-1">
                <p className="text-xs text-gray-400">Bắt đầu</p>
                <input
                  type="time"
                  value={timeStart}
                  onChange={e => { setTimeStart(e.target.value); setCheckResult(null); }}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
                />
              </div>
              <div className="flex flex-col items-center gap-1 pt-4">
                <div className="w-6 h-px bg-gray-300" />
                <span className="text-xs text-gray-400">đến</span>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs text-gray-400">Kết thúc</p>
                <input
                  type="time"
                  value={timeEnd}
                  onChange={e => { setTimeEnd(e.target.value); setCheckResult(null); }}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
                />
              </div>
            </div>
          </div>

          {/* Nút kiểm tra */}
          <button
            onClick={handleCheck}
            disabled={checking || !timeStart || !timeEnd}
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {checking ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Đang kiểm tra...</>
            ) : (
              <><Search className="h-4 w-4" /> Kiểm tra khả dụng</>
            )}
          </button>

          {/* Danh sách sân */}
          {checkResult && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Chọn sân ({originalCourtType}) · {checkResult.timeStart}-{checkResult.timeEnd}
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {checkResult.courts.map(court => (
                  <button
                    key={court.id}
                    onClick={() => court.available && setSelectedCourtId(court.id)}
                    disabled={!court.available}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all',
                      !court.available
                        ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50'
                        : selectedCourtId === court.id
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-200 hover:border-green-300 bg-white',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                        selectedCourtId === court.id
                          ? 'border-green-600 bg-green-600'
                          : 'border-gray-300',
                      )}>
                        {selectedCourtId === court.id && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{court.name}</p>
                        <p className="text-xs text-gray-400">{court.price.toLocaleString('vi-VN')}đ/giờ</p>
                      </div>
                    </div>
                    {court.available ? (
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 border border-green-100 rounded-full">
                        Trống
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-red-50 text-red-500 border border-red-100 rounded-full">
                        Đã đặt
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedCourtId || !checkResult?.courts.find(c => c.id === selectedCourtId)?.available}
            className="flex-1 h-10 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Xác nhận đổi
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OCCURRENCE ROW (đã có modal)
// ═══════════════════════════════════════════════════════════════

function OccurrenceRow({
  occ,
  index,
  preview,
  onSetAction,
  onSetCustomAction,
  checkSlot,
}: {
  occ: import('./types').OccurrenceUIState;
  index: number;
  preview: import('./types').FixedSchedulePreviewResponse;
  onSetAction: (date: string, action: import('./types').OccurrenceAction) => void;
  onSetCustomAction: (date: string, courtId: number, courtName: string, timeStart: string, timeEnd: string) => void;
  checkSlot: (req: import('./types').CheckSlotRequest) => Promise<import('./types').CheckSlotResponse | null>;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleCustomConfirm = (
    courtId: number,
    courtName: string,
    timeStart: string,
    timeEnd: string,
  ) => {
    onSetCustomAction(occ.date, courtId, courtName, timeStart, timeEnd);
    setModalOpen(false);
    toast.success(`Đã đổi sang ${courtName} · ${timeStart}-${timeEnd}`);
  };

  // Display info
  const displayTime = occ.action === 'custom' && occ.customTimeStart
    ? `${occ.customCourtName} · ${occ.customTimeStart}-${occ.customTimeEnd}`
    : occ.action === 'replace' && occ.selectedReplacement
    ? `${occ.selectedReplacement.courtName} · ${occ.timeStart}-${occ.timeEnd}`
    : `${occ.timeStart}-${occ.timeEnd}`;

  return (
    <>
      <div className={cn(
        'flex items-center gap-4 px-5 py-3.5 transition-colors',
        occ.action === 'skip' ? 'opacity-50 bg-gray-50/50' : 'hover:bg-gray-50/60',
      )}>
        {/* Index */}
        <div className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
          occ.action === 'skip'    ? 'bg-gray-200 text-gray-400' :
          occ.action === 'custom'  ? 'bg-purple-100 text-purple-600' :
          occ.action === 'replace' ? 'bg-blue-100 text-blue-600' :
          !occ.hasConflict         ? 'bg-green-100 text-green-700' :
                                     'bg-red-100 text-red-500',
        )}>
          {occ.action === 'skip' ? <SkipForward className="h-3.5 w-3.5" /> : index}
        </div>

        {/* Date + time */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{occ.dayLabel}</span>
            <span className="text-xs text-gray-400">{occ.date}</span>
            {!occ.hasConflict ? (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            ) : occ.suggestedReplacement ? (
              <RefreshCw className="h-3 w-3 text-blue-400" />
            ) : (
              <XCircle className="h-3 w-3 text-red-400" />
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{displayTime}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!occ.hasConflict ? (
            <>
              <ActionBtn active={occ.action === 'keep'} color="green" onClick={() => onSetAction(occ.date, 'keep')}>Giữ</ActionBtn>
              <ActionBtn active={occ.action === 'custom'} color="purple" onClick={() => setModalOpen(true)}>Đổi giờ</ActionBtn>
              <ActionBtn active={occ.action === 'skip'} color="gray" onClick={() => onSetAction(occ.date, 'skip')}>Bỏ</ActionBtn>
            </>
          ) : occ.suggestedReplacement ? (
            <>
              <ActionBtn active={occ.action === 'replace'} color="blue" onClick={() => onSetAction(occ.date, 'replace')}>Bù sân</ActionBtn>
              <ActionBtn active={occ.action === 'custom'} color="purple" onClick={() => setModalOpen(true)}>Đổi giờ</ActionBtn>
              <ActionBtn active={occ.action === 'skip'} color="gray" onClick={() => onSetAction(occ.date, 'skip')}>Bỏ</ActionBtn>
            </>
          ) : (
            <>
              <ActionBtn active={occ.action === 'custom'} color="purple" onClick={() => setModalOpen(true)}>Đổi giờ</ActionBtn>
              <ActionBtn active={occ.action === 'skip'} color="gray" onClick={() => onSetAction(occ.date, 'skip')}>Bỏ</ActionBtn>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <AdjustSlotModal
          occ={occ}
          branchId={preview.court.branchId}
          originalCourtType={preview.court.type}
          onConfirm={handleCustomConfirm}
          onClose={() => setModalOpen(false)}
          checkSlot={checkSlot}
        />
      )}
    </>
  );
}

// Helper: ActionBtn nhỏ tái sử dụng
function ActionBtn({
  active, color, onClick, children,
}: {
  active: boolean;
  color: 'green' | 'blue' | 'purple' | 'gray';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeClass = {
    green:  'bg-green-600 text-white border-green-600',
    blue:   'bg-blue-600 text-white border-blue-600',
    purple: 'bg-purple-600 text-white border-purple-600',
    gray:   'bg-gray-400 text-white border-gray-400',
  }[color];

  const inactiveClass = {
    green:  'border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600',
    blue:   'border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-500',
    purple: 'border-gray-200 text-gray-500 hover:border-purple-400 hover:text-purple-600',
    gray:   'border-gray-200 text-gray-400 hover:border-gray-400',
  }[color];

  return (
    <button
      onClick={onClick}
      className={cn(
        'h-7 px-2.5 rounded-lg text-xs font-semibold border transition-all',
        active ? activeClass : inactiveClass,
      )}
    >
      {children}
    </button>
  );
}