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

  const billableOccs = occurrences.filter(
    (o) => o.action === 'keep' || o.action === 'replace' || o.action === 'custom',
  );
  const skippedCount  = occurrences.filter((o) => o.action === 'skip').length;
  const replacedCount = occurrences.filter((o) => o.action === 'replace').length;

  // FIX: tính tổng tiền từ occurrences thực tế (bỏ preview.weeklySlots / preview.numberOfWeeks
  // vì BE không trả về 2 field này — chúng là concept cũ của ScheduleBasicInfo)
  const totalAmount = billableOccs.reduce((sum, o) => {
    const ts = o.action === 'custom' ? (o.customTimeStart ?? o.timeStart) : o.timeStart;
    const te = o.action === 'custom' ? (o.customTimeEnd  ?? o.timeEnd)   : o.timeEnd;
    return sum + pricing.pricePerHour * calcHours(ts, te);
  }, 0);

  // FIX: tính số buổi / tuần từ summary thay vì weeklySlots[]
  const totalCount     = preview.summary.totalOccurrences;
  const availableCount = preview.summary.availableCount;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Tổng kết thanh toán
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Chi tiết giá cho {billableOccs.length} buổi
        </p>
      </div>

      <div className="space-y-3 text-sm">
        {/* Thông tin cơ bản */}
        <div className="space-y-2 text-gray-600">
          <div className="flex justify-between">
            <span>Giá mỗi giờ:</span>
            <span className="font-medium text-gray-900">
              {pricing.pricePerHour.toLocaleString('vi-VN')}đ
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tổng số buổi:</span>
            <span className="font-medium text-gray-900">{totalCount} buổi</span>
          </div>
          <div className="flex justify-between">
            <span>Buổi khả dụng:</span>
            <span className="font-medium text-gray-900">{availableCount} buổi</span>
          </div>
        </div>

        {/* Chi tiết action */}
        <div className="border-t pt-3 space-y-2 text-gray-600">
          <div className="flex justify-between">
            <span>Buổi tính tiền:</span>
            <span className="font-medium text-gray-900">{billableOccs.length} buổi</span>
          </div>
          {replacedCount > 0 && (
            <div className="flex justify-between text-blue-600">
              <span>Trong đó dùng sân bù:</span>
              <span>{replacedCount} buổi</span>
            </div>
          )}
          {skippedCount > 0 && (
            <div className="flex justify-between text-gray-400">
              <span>Buổi bỏ qua:</span>
              <span>{skippedCount} buổi</span>
            </div>
          )}
        </div>

        {/* Tổng tiền */}
        <div className="border-t pt-3">
          <div className="flex justify-between text-base font-bold">
            <span>Ước tính:</span>
            <span className="text-blue-600">
              {totalAmount.toLocaleString('vi-VN')}đ
            </span>
          </div>
        </div>

        {/* Note sân bù */}
        {replacedCount > 0 && (
          <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            🔄 Sân thay thế tính theo giá sân gốc (bù miễn phí).
          </div>
        )}
      </div>
    </div>
  );
}