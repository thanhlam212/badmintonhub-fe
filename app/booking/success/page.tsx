'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Calendar, Clock, MapPin, Phone, User, CreditCard, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function BookingSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Lấy thông tin từ localStorage (được set khi confirm thành công)
    const savedData = localStorage.getItem('completedFixedBooking');
    
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setSchedule(data);
        // Clear sau khi đã hiển thị
        localStorage.removeItem('completedFixedBooking');
      } catch (err) {
        console.error('Parse error:', err);
      }
    }
    
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Không tìm thấy thông tin đặt lịch</h2>
          <p className="text-gray-600 mb-6">
            {error || 'Vui lòng kiểm tra lại hoặc liên hệ hỗ trợ.'}
          </p>
          <Link 
            href="/booking"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Quay về trang đặt sân
          </Link>
        </div>
      </div>
    );
  }

  const { fixedSchedule, occurrences } = schedule;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Success Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Đặt lịch cố định thành công!
          </h1>
          <p className="text-gray-600">
            Mã đặt lịch: <span className="font-mono font-semibold">{fixedSchedule.id}</span>
          </p>
        </div>

        {/* Thông tin gói */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Thông tin gói đặt lịch
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">Sân</p>
                <p className="font-semibold">{fixedSchedule.courtName}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">Chu kỳ</p>
                <p className="font-semibold">
                  {fixedSchedule.cycle === 'weekly' ? 'Hàng tuần' : 'Hàng tháng'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">Số buổi</p>
                <p className="font-semibold">{fixedSchedule.occurrenceCount} buổi</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">Tổng tiền</p>
                <p className="font-semibold text-blue-600">
                  {fixedSchedule.pricing?.finalAmount?.toLocaleString() || '0'}đ
                </p>
              </div>
            </div>
          </div>

          {/* Discount info nếu có */}
          {fixedSchedule.pricing?.discountAmount > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                🎉 Bạn đã tiết kiệm được{' '}
                <strong>{fixedSchedule.pricing.discountAmount.toLocaleString()}đ</strong>{' '}
                nhờ đặt gói dài hạn!
              </p>
            </div>
          )}
        </div>

        {/* Danh sách buổi */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">
            Danh sách buổi ({occurrences?.length || 0} buổi)
          </h2>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {occurrences?.map((occ: any, index: number) => (
              <div 
                key={occ.id || index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium">{occ.date}</p>
                    <p className="text-sm text-gray-500">
                      {occ.timeStart} - {occ.timeEnd}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                    ✓ Đã đặt
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hướng dẫn tiếp theo */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-bold text-blue-900 mb-2">📌 Bước tiếp theo</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-semibold">1.</span>
              <span>Chúng tôi sẽ gửi email xác nhận đến địa chỉ của bạn</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">2.</span>
              <span>Vui lòng thanh toán trước ngày đầu tiên tối thiểu 50% tổng tiền</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">3.</span>
              <span>Bạn có thể điều chỉnh tối đa {fixedSchedule.adjustmentLimit} buổi trong gói</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">4.</span>
              <span>Xem chi tiết lịch đặt tại "Lịch sử đặt sân"</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link 
            href="/my-booking"
            className="flex-1 bg-blue-600 text-white text-center py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Xem lịch sử đặt sân
          </Link>
          <Link 
            href="/booking/fixed-schedule"
            className="flex-1 bg-white border-2 border-gray-300 text-gray-700 text-center py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Đặt thêm lịch mới
          </Link>
          <Link 
            href="/"
            className="flex-1 bg-white border-2 border-gray-300 text-gray-700 text-center py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Về trang chủ
          </Link>
        </div>

        {/* Liên hệ support */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Có thắc mắc? Liên hệ hotline: <a href="tel:1900123456" className="text-blue-600 font-semibold">1900 123 456</a></p>
        </div>
      </div>
    </div>
  );
}