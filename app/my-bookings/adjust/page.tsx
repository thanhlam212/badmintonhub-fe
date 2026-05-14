'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Calendar, Clock, MapPin, CheckCircle2,
  XCircle, SkipForward, RefreshCw, AlertTriangle,
  Loader2, ChevronRight, Info, Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { fixedScheduleApi } from '@/lib/api';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type AdjustmentType = 'skip' | 'reschedule' | 'change_court';

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
}

interface ScheduleDetail {
  id: string;
  status: string;
  cycle: string;
  startDate: string;
  endDate: string;
  timeStart: string;
  timeEnd: string;
  occurrenceCount: number;
  adjustmentLimit: number;
  adjustmentUsed: number;
  pricePerHourSnapshot: number;
  court: {
    id: number;
    name: string;
    type: string;
    branchId: number;
    branch: { name: string };
  };
  occurrences: OccurrenceDetail[];
}

interface CourtOption {
  id: number;
  name: string;
  type: string;
  price: number;
  available: boolean;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const OCC_STATUS_MAP: Record<string, { label: string; canAdjust: boolean; class: string }> = {
  scheduled:   { label: 'Sắp tới',    canAdjust: true,  class: 'bg-green-50 text-green-700 border-green-100' },
  rescheduled: { label: 'Đổi lịch',   canAdjust: true,  class: 'bg-blue-50 text-blue-700 border-blue-100' },
  completed:   { label: 'Hoàn thành', canAdjust: false, class: 'bg-gray-100 text-gray-500 border-gray-200' },
  skipped:     { label: 'Bỏ qua',     canAdjust: false, class: 'bg-gray-100 text-gray-400 border-gray-200' },
  cancelled:   { label: 'Đã hủy',     canAdjust: false, class: 'bg-red-50 text-red-500 border-red-100' },
};

// ═══════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════

export default function AdjustSchedulePage() {
  const router = useRouter();
  const params = useParams();
  const scheduleId = params.id as string;
  const { user } = useAuth();

  const [schedule, setSchedule] = useState<ScheduleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Occurrence đang được chọn để adjust
  const [selectedOcc, setSelectedOcc] = useState<OccurrenceDetail | null>(null);
  const [adjustType, setAdjustType] = useState<AdjustmentType | null>(null);

  // Form state cho reschedule/change_court
  const [newDate, setNewDate] = useState('');
  const [newTimeStart, setNewTimeStart] = useState('');
  const [newTimeEnd, setNewTimeEnd] = useState('');
  const [newCourtId, setNewCourtId] = useState<number | null>(null);
  const [courtOptions, setCourtOptions] = useState<CourtOption[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(false);
  const [checkingSlot, setCheckingSlot] = useState(false);
  const [slotAvailable, setSlotAvailable] = useState<boolean | null>(null);

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (scheduleId) fetchSchedule();
  }, [scheduleId]);

  // Khi chọn change_court → load danh sách sân cùng type
  useEffect(() => {
    if (adjustType === 'change_court' && schedule) {
      fetchSameCourts();
    }
  }, [adjustType]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const detail = await fixedScheduleApi.getScheduleDetail(scheduleId);
      if (!detail) throw new Error('Không tìm thấy gói đặt lịch');
      setSchedule(detail);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSameCourts = async () => {
    if (!schedule) return;
    try {
      setLoadingCourts(true);
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(
        `${API}/courts?branchId=${schedule.court.branchId}&type=${schedule.court.type}`,
      );
      const data = await res.json();
      const courts = (Array.isArray(data) ? data : data.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        price: Number(c.price),
        available: c.available,
      }));
      setCourtOptions(courts.filter((c: CourtOption) => c.id !== schedule.court.id));
    } catch {
      toast.error('Không thể tải danh sách sân');
    } finally {
      setLoadingCourts(false);
    }
  };

  const handleSelectOccurrence = (occ: OccurrenceDetail) => {
    setSelectedOcc(occ);
    setAdjustType(null);
    setNewDate(occ.date);
    setNewTimeStart(occ.timeStart);
    setNewTimeEnd(occ.timeEnd);
    setNewCourtId(null);
    setSlotAvailable(null);
    setReason('');
  };

  const handleCheckSlot = async () => {
    if (!selectedOcc || !newTimeStart || !newTimeEnd) return;
    const targetCourtId = newCourtId ?? selectedOcc.courtId;

    try {
      setCheckingSlot(true);
      setSlotAvailable(null);
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${API}/bookings/fixed/check-slot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courtId: targetCourtId,
          date: newDate || selectedOcc.date,
          timeStart: newTimeStart,
          timeEnd: newTimeEnd,
        }),
      });
      const data = await res.json();
      setSlotAvailable(data.available);
      if (data.available) {
        toast.success('Khung giờ này còn trống!');
      } else {
        toast.error(`Đã có người đặt: ${data.conflicts.map((c: any) => c.time).join(', ')}`);
      }
    } catch {
      toast.error('Không thể kiểm tra slot');
    } finally {
      setCheckingSlot(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedOcc || !adjustType || !schedule) return;

    // Validate
    if (adjustType !== 'skip') {
      if (!newTimeStart || !newTimeEnd) {
        toast.error('Vui lòng nhập giờ mới');
        return;
      }
      if (adjustType === 'change_court' && !newCourtId) {
        toast.error('Vui lòng chọn sân mới');
        return;
      }
      if (slotAvailable === false) {
        toast.error('Khung giờ này đã bị đặt, vui lòng kiểm tra lại');
        return;
      }
      if (slotAvailable === null) {
        toast.error('Vui lòng kiểm tra khả dụng trước khi xác nhận');
        return;
      }
    }

    try {
      setSubmitting(true);
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('bh_token');
      const res = await fetch(
        `${API}/bookings/fixed/${scheduleId}/occurrences/${selectedOcc.id}/adjust`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: adjustType,
            ...(adjustType !== 'skip' && {
              newCourtId: adjustType === 'change_court' ? newCourtId : undefined,
              newDate: adjustType === 'reschedule' ? newDate : undefined,
              newTimeStart,
              newTimeEnd,
            }),
            reason: reason || undefined,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Có lỗi xảy ra');
      }

      const typeLabel = {
        skip: 'Báo nghỉ',
        reschedule: 'Đổi ngày/giờ',
        change_court: 'Đổi sân',
      }[adjustType];

      toast.success(
        `${typeLabel} thành công! Còn ${data.adjustmentLeft}/${schedule.adjustmentLimit} lần điều chỉnh.`,
      );

      // Reload + reset
      await fetchSchedule();
      setSelectedOcc(null);
      setAdjustType(null);
    } catch (err: any) {
      toast.error(err.message || 'Không thể điều chỉnh. Vui lòng thử lại!');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center max-w-sm w-full">
          <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-4">{error || 'Không tìm thấy gói'}</p>
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

  const adjustmentLeft = schedule.adjustmentLimit - schedule.adjustmentUsed;
  const adjustableOccs = schedule.occurrences.filter(
    (o) => OCC_STATUS_MAP[o.status]?.canAdjust,
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push(`/my-booking/${scheduleId}`)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Điều chỉnh lịch</p>
            <p className="text-xs text-gray-400">{schedule.court.name} · {schedule.court.branch.name}</p>
          </div>
          {/* Quota badge */}
          <div className={cn(
            'px-3 py-1.5 rounded-xl text-xs font-semibold border',
            adjustmentLeft > 0
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-600 border-red-200',
          )}>
            {adjustmentLeft > 0
              ? `Còn ${adjustmentLeft}/${schedule.adjustmentLimit} lần`
              : 'Hết lượt điều chỉnh'}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* ── Quota info ── */}
        <div className={cn(
          'flex items-start gap-3 p-4 rounded-2xl border text-sm',
          adjustmentLeft > 0
            ? 'bg-blue-50 border-blue-100 text-blue-700'
            : 'bg-red-50 border-red-100 text-red-600',
        )}>
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            {adjustmentLeft > 0 ? (
              <>
                <p className="font-semibold">Bạn còn {adjustmentLeft} lần điều chỉnh</p>
                <p className="text-xs mt-0.5 opacity-80">
                  Mỗi lần điều chỉnh (báo nghỉ, đổi ngày, đổi sân) tính 1 lượt.
                  Phải thực hiện trước buổi chơi ít nhất 24 giờ.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">Đã hết lượt điều chỉnh</p>
                <p className="text-xs mt-0.5 opacity-80">
                  Bạn đã dùng hết {schedule.adjustmentLimit} lần điều chỉnh của gói này.
                  Liên hệ nhân viên để được hỗ trợ.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* ── LEFT: Danh sách buổi ── */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-green-600" />
                  Chọn buổi muốn điều chỉnh
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {adjustableOccs.length} buổi có thể điều chỉnh
                </p>
              </div>

              <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                {schedule.occurrences.map((occ) => {
                  const cfg = OCC_STATUS_MAP[occ.status] || OCC_STATUS_MAP.scheduled;
                  const isSelected = selectedOcc?.id === occ.id;
                  return (
                    <button
                      key={occ.id}
                      disabled={!cfg.canAdjust || adjustmentLeft === 0}
                      onClick={() => cfg.canAdjust && handleSelectOccurrence(occ)}
                      className={cn(
                        'w-full flex items-center gap-4 px-5 py-3.5 text-left transition-all',
                        isSelected
                          ? 'bg-green-50 border-l-2 border-green-500'
                          : cfg.canAdjust && adjustmentLeft > 0
                          ? 'hover:bg-gray-50 cursor-pointer'
                          : 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      {/* Date badge */}
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex flex-col items-center justify-center text-center shrink-0',
                        isSelected ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600',
                      )}>
                        <span className="text-[10px] font-medium">{occ.dayLabel}</span>
                        <span className="text-sm font-bold leading-none">
                          {occ.date.split('-')[2]}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">{occ.date}</span>
                          <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded border',
                            cfg.class,
                          )}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {occ.courtName} · {occ.timeStart}–{occ.timeEnd}
                        </p>
                      </div>

                      {cfg.canAdjust && adjustmentLeft > 0 && (
                        <ChevronRight className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isSelected ? 'text-green-500' : 'text-gray-300',
                        )} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Form điều chỉnh ── */}
          <div className="lg:col-span-2">
            {!selectedOcc ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">
                  Chọn buổi bên trái để điều chỉnh
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Selected occ header */}
                <div className="px-5 py-4 bg-green-50 border-b border-green-100">
                  <p className="text-xs text-green-600 font-medium">Buổi đã chọn</p>
                  <p className="font-bold text-gray-900 mt-0.5">
                    {selectedOcc.dayLabel} · {selectedOcc.date}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedOcc.courtName} · {selectedOcc.timeStart}–{selectedOcc.timeEnd}
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  {/* Chọn loại điều chỉnh */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Loại điều chỉnh
                    </p>
                    <div className="space-y-2">
                      {[
                        {
                          type: 'skip' as AdjustmentType,
                          icon: <SkipForward className="h-4 w-4" />,
                          label: 'Báo nghỉ',
                          desc: 'Bỏ buổi này, không cần bù',
                          color: 'border-gray-300 text-gray-700',
                          activeColor: 'border-gray-500 bg-gray-50',
                        },
                        {
                          type: 'reschedule' as AdjustmentType,
                          icon: <RefreshCw className="h-4 w-4" />,
                          label: 'Đổi ngày/giờ',
                          desc: 'Chuyển sang ngày hoặc giờ khác',
                          color: 'border-blue-200 text-blue-700',
                          activeColor: 'border-blue-500 bg-blue-50',
                        },
                        {
                          type: 'change_court' as AdjustmentType,
                          icon: <MapPin className="h-4 w-4" />,
                          label: 'Đổi sân',
                          desc: `Đổi sang sân khác (cùng hạng ${schedule.court.type})`,
                          color: 'border-purple-200 text-purple-700',
                          activeColor: 'border-purple-500 bg-purple-50',
                        },
                      ].map((opt) => (
                        <button
                          key={opt.type}
                          onClick={() => {
                            setAdjustType(opt.type);
                            setSlotAvailable(null);
                          }}
                          className={cn(
                            'w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all',
                            adjustType === opt.type ? opt.activeColor : 'border-gray-100 hover:border-gray-200',
                          )}
                        >
                          <span className={cn(
                            'mt-0.5 shrink-0',
                            adjustType === opt.type ? opt.color : 'text-gray-400',
                          )}>
                            {opt.icon}
                          </span>
                          <div>
                            <p className={cn(
                              'text-sm font-semibold',
                              adjustType === opt.type ? '' : 'text-gray-700',
                            )}>
                              {opt.label}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Form theo loại */}
                  {adjustType === 'reschedule' && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Ngày & giờ mới
                      </p>
                      <div className="space-y-2">
                        <input
                          type="date"
                          value={newDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => { setNewDate(e.target.value); setSlotAvailable(null); }}
                          className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
                        />
                        <div className="flex gap-2">
                          <input
                            type="time"
                            value={newTimeStart}
                            onChange={(e) => { setNewTimeStart(e.target.value); setSlotAvailable(null); }}
                            className="flex-1 h-10 px-3 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
                          />
                          <span className="flex items-center text-gray-400 text-xs">đến</span>
                          <input
                            type="time"
                            value={newTimeEnd}
                            onChange={(e) => { setNewTimeEnd(e.target.value); setSlotAvailable(null); }}
                            className="flex-1 h-10 px-3 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleCheckSlot}
                        disabled={checkingSlot}
                        className="w-full h-9 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        {checkingSlot
                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang kiểm tra...</>
                          : 'Kiểm tra khả dụng'
                        }
                      </button>
                      {slotAvailable !== null && (
                        <div className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium',
                          slotAvailable
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-600',
                        )}>
                          {slotAvailable
                            ? <><CheckCircle2 className="h-3.5 w-3.5" /> Khung giờ này còn trống!</>
                            : <><XCircle className="h-3.5 w-3.5" /> Khung giờ này đã bị đặt</>
                          }
                        </div>
                      )}
                    </div>
                  )}

                  {adjustType === 'change_court' && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Chọn sân mới (cùng hạng {schedule.court.type})
                      </p>

                      {/* Giờ mới (optional khi change_court) */}
                      <div className="flex gap-2">
                        <input
                          type="time"
                          value={newTimeStart}
                          onChange={(e) => { setNewTimeStart(e.target.value); setSlotAvailable(null); }}
                          className="flex-1 h-9 px-3 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500/30"
                          placeholder="Giờ bắt đầu"
                        />
                        <span className="flex items-center text-gray-400 text-xs">-</span>
                        <input
                          type="time"
                          value={newTimeEnd}
                          onChange={(e) => { setNewTimeEnd(e.target.value); setSlotAvailable(null); }}
                          className="flex-1 h-9 px-3 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500/30"
                          placeholder="Giờ kết thúc"
                        />
                      </div>

                      {/* Danh sách sân */}
                      {loadingCourts ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                        </div>
                      ) : courtOptions.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-3">
                          Không có sân nào khác cùng hạng trong chi nhánh
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {courtOptions.map((court) => (
                            <button
                              key={court.id}
                              onClick={() => {
                                setNewCourtId(court.id);
                                setSlotAvailable(null);
                              }}
                              disabled={!court.available}
                              className={cn(
                                'w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all',
                                !court.available
                                  ? 'opacity-40 cursor-not-allowed border-gray-100'
                                  : newCourtId === court.id
                                  ? 'border-purple-500 bg-purple-50'
                                  : 'border-gray-200 hover:border-purple-300',
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={cn(
                                  'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                                  newCourtId === court.id
                                    ? 'border-purple-600 bg-purple-600'
                                    : 'border-gray-300',
                                )}>
                                  {newCourtId === court.id && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                  )}
                                </div>
                                <span className="text-sm font-medium text-gray-800">
                                  {court.name}
                                </span>
                              </div>
                              <span className={cn(
                                'text-xs px-2 py-0.5 rounded-full border',
                                court.available
                                  ? 'bg-green-50 text-green-600 border-green-100'
                                  : 'bg-red-50 text-red-400 border-red-100',
                              )}>
                                {court.available ? 'Trống' : 'Đã đặt'}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {newCourtId && (
                        <button
                          onClick={handleCheckSlot}
                          disabled={checkingSlot}
                          className="w-full h-9 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          {checkingSlot
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang kiểm tra...</>
                            : 'Kiểm tra khả dụng'
                          }
                        </button>
                      )}

                      {slotAvailable !== null && (
                        <div className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium',
                          slotAvailable ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600',
                        )}>
                          {slotAvailable
                            ? <><CheckCircle2 className="h-3.5 w-3.5" /> Sân và giờ này còn trống!</>
                            : <><XCircle className="h-3.5 w-3.5" /> Sân này đã có người đặt giờ đó</>
                          }
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lý do (tùy chọn) */}
                  {adjustType && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Lý do <span className="text-gray-300 font-normal">(tùy chọn)</span>
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="VD: Bận việc đột xuất, gia đình có việc..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
                      />
                    </div>
                  )}

                  {/* Note giá */}
                  {adjustType && adjustType !== 'skip' && (
                    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
                      <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
                      Giá vẫn tính theo hợp đồng gốc
                      ({(schedule.pricePerHourSnapshot).toLocaleString('vi-VN')}đ/giờ)
                    </div>
                  )}

                  {/* Submit */}
                  {adjustType && (
                    <button
                      onClick={handleSubmit}
                      disabled={
                        submitting ||
                        (adjustType !== 'skip' && slotAvailable !== true)
                      }
                      className={cn(
                        'w-full h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                        submitting || (adjustType !== 'skip' && slotAvailable !== true)
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : adjustType === 'skip'
                          ? 'bg-gray-600 hover:bg-gray-700 text-white shadow-sm'
                          : adjustType === 'change_court'
                          ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-600/20'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20',
                      )}
                    >
                      {submitting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý...</>
                      ) : adjustType === 'skip' ? (
                        <><SkipForward className="h-4 w-4" /> Xác nhận báo nghỉ</>
                      ) : adjustType === 'reschedule' ? (
                        <><RefreshCw className="h-4 w-4" /> Xác nhận đổi lịch</>
                      ) : (
                        <><MapPin className="h-4 w-4" /> Xác nhận đổi sân</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}