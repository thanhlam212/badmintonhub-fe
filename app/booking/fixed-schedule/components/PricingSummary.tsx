'use client';

import { Receipt } from 'lucide-react';
import type { FixedSchedulePreviewResponse, OccurrenceUIState } from '../types';

interface Props {
  preview: FixedSchedulePreviewResponse;
  occurrences: OccurrenceUIState[];
}

export function PricingSummary({ preview, occurrences }: Props) {
  const { pricing } = preview;

  // Đếm số buổi thực sự tính tiền (keep + replace, không tính skip)
  const billableCount = occurrences.filter(
    (o) => o.action === 'keep' || o.action === 'replace',
  ).length;
  const skippedCount = occurrences.filter((o) => o.action === 'skip').length;

  // Giá luôn dùng giá sân gốc (bù miễn phí theo policy)
  const totalAmount = pricing.pricePerSession * billableCount;

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
        {/* Breakdown */}
        <div className="space-y-2 text-gray-600">
          <div className="flex justify-between">
            <span>Giá mỗi giờ:</span>
            <span className="font-medium text-gray-900">
              {pricing.pricePerHour.toLocaleString('vi-VN')}đ
            </span>
          </div>
          <div className="flex justify-between">
            <span>Số giờ mỗi buổi:</span>
            <span className="font-medium text-gray-900">
              {preview.hoursPerSession} giờ
            </span>
          </div>
          <div className="flex justify-between">
            <span>Giá mỗi buổi:</span>
            <span className="font-medium text-gray-900">
              {pricing.pricePerSession.toLocaleString('vi-VN')}đ
            </span>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2 text-gray-600">
          <div className="flex justify-between">
            <span>Buổi giữ nguyên / sân bù:</span>
            <span className="font-medium text-gray-900">{billableCount} buổi</span>
          </div>
          {skippedCount > 0 && (
            <div className="flex justify-between text-gray-400">
              <span>Buổi bỏ qua (miễn phí):</span>
              <span>{skippedCount} buổi</span>
            </div>
          )}
        </div>

        <div className="border-t pt-3">
          <div className="flex justify-between text-base font-bold">
            <span>Tổng cộng:</span>
            <span className="text-blue-600">
              {totalAmount.toLocaleString('vi-VN')}đ
            </span>
          </div>
        </div>

        {/* Note về bù sân miễn phí */}
        {occurrences.some((o) => o.action === 'replace') && (
          <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            🔄 Các buổi dùng sân thay thế được tính theo giá sân gốc (bù miễn phí).
          </div>
        )}
      </div>
    </div>
  );
}