'use client';

import { User } from 'lucide-react';
import type { PaymentMethod } from '../types';

interface Props {
  formData: {
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    paymentMethod: PaymentMethod;
    adjustmentLimit: number;
  };
  onChange: (field: string, value: any) => void;
}

export function CustomerInfo({ formData, onChange }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <User className="h-5 w-5" />
          Thông tin khách hàng
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Điền thông tin liên hệ và phương thức thanh toán
        </p>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-2">Họ và tên *</label>
          <input
            type="text"
            placeholder="Nguyễn Văn A"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.customerName}
            onChange={(e) => onChange('customerName', e.target.value)}
            required
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium mb-2">Số điện thoại *</label>
          <input
            type="tel"
            placeholder="0901234567"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.customerPhone}
            onChange={(e) => onChange('customerPhone', e.target.value)}
            required
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium mb-2">Email (tùy chọn)</label>
          <input
            type="email"
            placeholder="example@email.com"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.customerEmail}
            onChange={(e) => onChange('customerEmail', e.target.value)}
          />
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium mb-2">Phương thức thanh toán *</label>
          <select
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.paymentMethod}
            onChange={(e) => onChange('paymentMethod', e.target.value)}
          >
            <option value="cash">Tiền mặt</option>
            <option value="bank_transfer">Chuyển khoản ngân hàng</option>
            <option value="momo">Ví MoMo</option>
            <option value="vnpay">VNPay</option>
          </select>
        </div>

        {/* Adjustment Limit */}
        <div>
          <label className="block text-sm font-medium mb-2">Số lần điều chỉnh cho phép</label>
          <select
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.adjustmentLimit.toString()}
            onChange={(e) => onChange('adjustmentLimit', parseInt(e.target.value))}
          >
            <option value="0">Không cho phép</option>
            <option value="1">1 lần/gói</option>
            <option value="2">2 lần/gói (Khuyến nghị)</option>
            <option value="3">3 lần/gói</option>
            <option value="5">5 lần/gói</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Số lần khách hàng được phép báo nghỉ, dời ngày hoặc đổi giờ trong suốt gói đặt lịch
          </p>
        </div>
      </div>
    </div>
  );
}