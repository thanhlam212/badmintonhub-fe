'use client';

import { Receipt, Tag, TrendingDown } from 'lucide-react';
import type { PreviewResponse } from '../types';

interface Props {
  preview: PreviewResponse;
  selectedCount: number;
}

export function PricingSummary({ preview, selectedCount }: Props) {
  const { pricing } = preview;
  
  // Tính lại giá dựa trên số buổi đã chọn
  const actualSubtotal = pricing.pricePerSession * selectedCount;
  const actualDiscount = Math.floor(actualSubtotal * pricing.suggestedDiscount);
  const actualTotal = actualSubtotal - actualDiscount;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Tổng kết thanh toán
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Chi tiết giá cho {selectedCount} buổi
        </p>
      </div>

      <div className="space-y-4">
        {/* Breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Giá mỗi giờ:</span>
            <span className="font-medium">{pricing.pricePerHour.toLocaleString()}đ</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Số giờ mỗi buổi:</span>
            <span className="font-medium">{preview.hoursPerSession} giờ</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Giá mỗi buổi:</span>
            <span className="font-medium">{pricing.pricePerSession.toLocaleString()}đ</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Số buổi đã chọn:</span>
            <span className="font-medium">{selectedCount} buổi</span>
          </div>
        </div>

        <div className="border-t pt-3"></div>

        {/* Subtotal */}
        <div className="flex justify-between text-base">
          <span>Tạm tính:</span>
          <span className="font-semibold">{actualSubtotal.toLocaleString()}đ</span>
        </div>

        {/* Discount */}
        {pricing.suggestedDiscount > 0 && (
          <div className="flex justify-between text-green-600">
            <span className="flex items-center gap-1">
              <Tag className="h-4 w-4" />
              Giảm giá ({(pricing.suggestedDiscount * 100).toFixed(0)}%):
            </span>
            <span className="font-semibold">-{actualDiscount.toLocaleString()}đ</span>
          </div>
        )}

        <div className="border-t pt-3"></div>

        {/* Total */}
        <div className="flex justify-between text-lg">
          <span className="font-bold">Tổng cộng:</span>
          <span className="font-bold text-blue-600">{actualTotal.toLocaleString()}đ</span>
        </div>

        {/* Discount Info */}
        {pricing.suggestedDiscount > 0 && (
          <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg text-sm text-green-700">
            <TrendingDown className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              Bạn tiết kiệm được <strong>{actualDiscount.toLocaleString()}đ</strong> nhờ đặt gói dài hạn!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}