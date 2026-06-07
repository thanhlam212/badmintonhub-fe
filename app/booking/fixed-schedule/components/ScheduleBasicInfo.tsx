'use client';

import { useState, useEffect } from 'react';
import { MapPin, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FixedSchedulePreviewRequest, WeeklySlot, Court } from '../types';

const DAY_LABELS = [
  { value: 1, short: 'T2' },
  { value: 2, short: 'T3' },
  { value: 3, short: 'T4' },
  { value: 4, short: 'T5' },
  { value: 5, short: 'T6' },
  { value: 6, short: 'T7' },
  { value: 0, short: 'CN' },
];

interface Props {
  onPreview: (data: FixedSchedulePreviewRequest) => void;
  loading?: boolean;
}

export function ScheduleBasicInfo({ onPreview, loading }: Props) {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(true);
  const [courtId, setCourtId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [numberOfWeeks, setNumberOfWeeks] = useState(8);
  const [weeklySlots, setWeeklySlots] = useState<WeeklySlot[]>([
    { dayOfWeek: 1, timeStart: '08:00', timeEnd: '10:00' },
  ]);

  useEffect(() => {
    const fetchCourts = async () => {
      try {
        setLoadingCourts(true);
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const res = await fetch(`${API_URL}/courts`);
        const data = await res.json();
        setCourts(Array.isArray(data) ? data : data.data || []);
      } catch {
        setCourts([]);
      } finally {
        setLoadingCourts(false);
      }
    };
    fetchCourts();
  }, []);

  const toggleDay = (dayOfWeek: number) => {
    setWeeklySlots((prev) => {
      const exists = prev.find((s) => s.dayOfWeek === dayOfWeek);
      if (exists) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s.dayOfWeek !== dayOfWeek);
      }
      return [...prev, { dayOfWeek, timeStart: '08:00', timeEnd: '10:00' }]
        .sort((a, b) => {
          const order = [1, 2, 3, 4, 5, 6, 0];
          return order.indexOf(a.dayOfWeek) - order.indexOf(b.dayOfWeek);
        });
    });
  };

  const updateSlotTime = (dayOfWeek: number, field: 'timeStart' | 'timeEnd', value: string) => {
    setWeeklySlots((prev) =>
      prev.map((s) => s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s),
    );
  };

  const today = new Date().toISOString().split('T')[0];
  const isValid = !!(
    courtId && startDate && numberOfWeeks >= 4 &&
    weeklySlots.length > 0 &&
    weeklySlots.every((s) => s.timeStart && s.timeEnd && s.timeEnd > s.timeStart)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onPreview({ courtId: parseInt(courtId), startDate, numberOfWeeks, weeklySlots });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MapPin className="h-5 w-5" /> Thông tin cơ bản
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Chọn sân *</label>
          {loadingCourts ? (
            <div className="h-10 bg-gray-100 animate-pulse rounded-lg" />
          ) : (
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm"
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              required
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Ngày bắt đầu *</label>
            <input
              type="date" value={startDate} min={today}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm" required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Số tuần *</label>
            <select
              value={numberOfWeeks}
              onChange={(e) => setNumberOfWeeks(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              {[4, 8, 12, 16, 20, 24].map((n) => (
                <option key={n} value={n}>{n} tuần</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Buổi trong tuần *
          </label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {DAY_LABELS.map((day) => {
              const selected = weeklySlots.some((s) => s.dayOfWeek === day.value);
              return (
                <button
                  key={day.value} type="button"
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    'px-3 h-8 rounded-lg text-xs font-bold border-2 transition-all',
                    selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-500',
                  )}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            {weeklySlots.map((slot) => {
              const dayInfo = DAY_LABELS.find((d) => d.value === slot.dayOfWeek);
              const hasError = slot.timeEnd <= slot.timeStart;
              return (
                <div key={slot.dayOfWeek} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="text-xs font-bold text-blue-700 w-6 text-center">{dayInfo?.short}</span>
                  <input
                    type="time" value={slot.timeStart}
                    onChange={(e) => updateSlotTime(slot.dayOfWeek, 'timeStart', e.target.value)}
                    className={cn('flex-1 h-8 px-2 border rounded text-sm', hasError ? 'border-red-300' : 'border-gray-200')}
                  />
                  <span className="text-xs text-gray-400">→</span>
                  <input
                    type="time" value={slot.timeEnd}
                    onChange={(e) => updateSlotTime(slot.dayOfWeek, 'timeEnd', e.target.value)}
                    className={cn('flex-1 h-8 px-2 border rounded text-sm', hasError ? 'border-red-300' : 'border-gray-200')}
                  />
                </div>
              );
            })}
          </div>
          {weeklySlots.some((s) => s.timeEnd <= s.timeStart) && (
            <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
              <AlertCircle className="h-3.5 w-3.5" /> Giờ kết thúc phải sau giờ bắt đầu
            </p>
          )}
        </div>

        <button
          type="submit" disabled={!isValid || loading || loadingCourts}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
        >
          {loading ? 'Đang xử lý...' : 'Xem trước lịch đặt →'}
        </button>
      </form>
    </div>
  );
}
