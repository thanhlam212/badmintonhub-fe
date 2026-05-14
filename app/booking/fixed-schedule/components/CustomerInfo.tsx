'use client';

import { useEffect } from 'react';
import { User } from 'lucide-react';
import { useAuth } from '@/lib/auth-context'
import type { PaymentMethod } from '../types';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CustomerFormData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  paymentMethod: PaymentMethod;
  adjustmentLimit: number;
}

interface Props {
  formData: CustomerFormData;
  onChange: (field: keyof CustomerFormData, value: string | number) => void;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export function CustomerInfo({ formData, onChange }: Props) {
  const { user } = useAuth();

  /**
   * Auto-fill thông tin từ user đang login.
   * Chỉ fill khi:
   * 1. User đã login (không phải guest)
   * 2. Field đang trống (không override nếu user đã tự điền)
   */
  useEffect(() => {
    if (!user || user.role === 'guest') return;

    if (!formData.customerName && user.fullName) {
      onChange('customerName', user.fullName);
    }
    if (!formData.customerPhone && user.phone) {
      onChange('customerPhone', user.phone);
    }
    if (!formData.customerEmail && user.email) {
      onChange('customerEmail', user.email);
    }
  }, [user]); // Chỉ chạy khi user thay đổi (mount hoặc login)

  const isLoggedIn = user && user.role !== 'guest';

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <User className="h-5 w-5" />
          Thông tin khách hàng
        </h2>

        {/* Badge trạng thái login */}
        {isLoggedIn ? (
          <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
            Đã điền từ tài khoản của bạn. Có thể chỉnh sửa nếu đặt giùm người khác.
          </p>
        ) : (
          <p className="text-gray-600 text-sm mt-1">
            Điền thông tin liên hệ và phương thức thanh toán
          </p>
        )}
      </div>

      <div className="space-y-4">
        {/* Họ tên */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Họ và tên <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Nguyễn Văn A"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.customerName}
            onChange={(e) => onChange('customerName', e.target.value)}
            required
          />
        </div>

        {/* Số điện thoại */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Số điện thoại <span className="text-red-500">*</span>
          </label>
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
          <label className="block text-sm font-medium mb-2">
            Email <span className="text-gray-400 text-xs">(tùy chọn)</span>
          </label>
          <input
            type="email"
            placeholder="example@email.com"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.customerEmail}
            onChange={(e) => onChange('customerEmail', e.target.value)}
          />
        </div>

        {/* Phương thức thanh toán */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Phương thức thanh toán <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.paymentMethod}
            onChange={(e) => onChange('paymentMethod', e.target.value as PaymentMethod)}
          >
            <option value="cash">Tiền mặt</option>
            <option value="bank_transfer">Chuyển khoản ngân hàng</option>
            <option value="momo">Ví MoMo</option>
            <option value="vnpay">VNPay</option>
          </select>
        </div>

        {/* Số lần điều chỉnh */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Số lần điều chỉnh cho phép
          </label>
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
            Số lần khách được phép báo nghỉ, dời ngày hoặc đổi sân trong suốt gói
          </p>
        </div>
      </div>
    </div>
  );
}