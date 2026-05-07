'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useFixedSchedule } from './hooks/useFixedSchedule';
import { ScheduleBasicInfo } from './components/ScheduleBasicInfo';
import { OccurrencesList } from './components/OccurrencesList';
import { PricingSummary } from './components/PricingSummary';
import { CustomerInfo } from './components/CustomerInfo';
import type { FixedScheduleFormData, PaymentMethod } from './types';

export default function FixedSchedulePage() {
  const router = useRouter();
  const {
    loading,
    preview,
    occurrences,
    step,
    setStep,
    fetchPreview,
    toggleSkip,
    confirmSchedule,
    reset,
  } = useFixedSchedule();

  const [customerData, setCustomerData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    paymentMethod: 'cash' as PaymentMethod,
    adjustmentLimit: 2,
  });

  const selectedCount = occurrences.filter(occ => !occ.skip).length;
  const hasConflicts = occurrences.some(occ => !occ.available && !occ.skip);

  const handleCustomerChange = (field: string, value: any) => {
    setCustomerData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfirm = async () => {
    if (!preview) return;

    const formData: FixedScheduleFormData = {
      courtId: preview.court.id,
      cycle: preview.cycle,
      startDate: preview.startDate,
      endDate: preview.endDate,
      timeStart: occurrences[0]?.timeStart || '08:00',
      timeEnd: occurrences[0]?.timeEnd || '10:00',
      ...customerData,
      discountRate: preview.pricing.suggestedDiscount,
    };

    try {
      const result = await confirmSchedule(formData);
      if (result) {
        // Redirect to success page hoặc booking detail
        router.push(`/bookings/success?id=${result.fixedSchedule.id}`);
      }
    } catch (error) {
      console.error('Confirm error:', error);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => step === 'form' ? router.back() : setStep('form')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 'form' ? 'Quay lại' : 'Chỉnh sửa thông tin'}
        </button>
        
        <h1 className="text-3xl font-bold">Đặt lịch cố định</h1>
        <p className="text-gray-600 mt-1">
          Đặt sân theo chu kỳ hàng tuần hoặc hàng tháng với giá ưu đãi
        </p>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center gap-2 mb-8">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${step === 'form' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
          <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-medium">
            1
          </div>
          <span className="font-medium">Thông tin cơ bản</span>
        </div>
        <div className="h-px w-8 bg-gray-300" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${step === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
          <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-medium">
            2
          </div>
          <span className="font-medium">Xem trước & Xác nhận</span>
        </div>
      </div>

      {/* Content */}
      {step === 'form' && (
        <div className="max-w-2xl">
          <ScheduleBasicInfo onPreview={fetchPreview} loading={loading} />
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Occurrences & Customer Info */}
          <div className="lg:col-span-2 space-y-6">
            <OccurrencesList
              occurrences={occurrences}
              onToggleSkip={toggleSkip}
            />
            
            <CustomerInfo
              formData={customerData}
              onChange={handleCustomerChange}
            />
          </div>

          {/* Right: Summary & Confirm */}
          <div className="space-y-6">
            <PricingSummary preview={preview} selectedCount={selectedCount} />
            
            <button
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={handleConfirm}
              disabled={
                loading || 
                selectedCount === 0 || 
                hasConflicts || 
                !customerData.customerName || 
                !customerData.customerPhone
              }
            >
              {loading ? (
                'Đang xử lý...'
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Xác nhận đặt lịch
                </>
              )}
            </button>

            {hasConflicts && (
              <p className="text-xs text-red-600 text-center">
                Vui lòng xử lý các buổi trùng lịch trước khi xác nhận
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}