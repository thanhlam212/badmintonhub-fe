'use client';

import { Receipt } from 'lucide-react';
import type { FixedSchedulePreviewResponse, OccurrenceUIState } from '../types';

interface Props {
  preview: FixedSchedulePreviewResponse;
  occurrences: OccurrenceUIState[];
}

function calcHours(timeStart: string, timeEnd: string): number {
  const s = parseInt(timeStart.split(':')[0], 10);
  const e = parseInt(timeEnd.split(':')[0], 10);
  return Number.isNaN(s) || Number.isNaN(e) ? 0 : Math.max(0, e - s);
}

export function PricingSummary({ preview, occurrences }: Props) {
  const { pricing } = preview;

  const billableCount = occurrences.filter(
    (o) => o.action === 'keep' || o.action === 'replace' || o.action === 'custom',
  ).length;
  const skippedCount = occurrences.filter((o) => o.action === 'skip').length;

  const totalAmount = occurrences
    .filter((o) => o.action !== 'skip')
    .reduce((sum, o) => {
      const ts = o.action === 'custom' ? (o.customTimeStart ?? o.timeStart) : o.timeStart;
      const te = o.action === 'custom' ? (o.customTimeEnd ?? o.timeEnd) : o.timeEnd;
      return sum + pricing.pricePerHour * calcHours(ts, te);
    }, 0);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Tổng kết thanh toán
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Chi tiết giá cho {billableCount} buổi
        </p>
      </div>

      <div className="space-y-3 text-sm">
        <div className="space-y-2 text-gray-600">
          <div className="flex justify-between">
            <span>Giá mỗi giờ:</span>
            <span className="font-medium text-gray-900">
              {pricing.pricePerHour.toLocaleString('vi-VN')}đ
            </span>
          </div>
          <div className="flex justify-between">
            <span>Số buổi/tuần:</span>
            <span className="font-medium text-gray-900">
              {preview.weeklySlots.length} buổi
            </span>
          </div>
          <div className="flex justify-between">
            <span>Số tuần:</span>
            <span className="font-medium text-gray-900">
              {preview.numberOfWeeks} tuần
            </span>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2 text-gray-600">
          <div className="flex justify-between">
            <span>Buổi tính tiền:</span>
            <span className="font-medium text-gray-900">{billableCount} buổi</span>
          </div>
          {skippedCount > 0 && (
            <div className="flex justify-between text-gray-400">
              <span>Buổi bỏ qua:</span>
              <span>{skippedCount} buổi</span>
            </div>
          )}
        </div>

        <div className="border-t pt-3">
          <div className="flex justify-between text-base font-bold">
            <span>Ước tính:</span>
            <span className="text-blue-600">
              {totalAmount.toLocaleString('vi-VN')}đ
            </span>
          </div>
        </div>

        {occurrences.some((o) => o.action === 'replace') && (
          <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            🔄 Sân thay thế tính theo giá sân gốc (bù miễn phí).
          </div>
        )}
      </div>
    </div>
  );
}
