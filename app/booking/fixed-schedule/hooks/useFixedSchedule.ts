'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { fixedScheduleApi } from '@/lib//api'; // ✅ Import API
import type { ApiFixedSchedulePreview, ApiFixedScheduleOccurrence } from '@/lib/api';
import type { FixedScheduleFormData } from '../types';

export function useFixedSchedule() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ApiFixedSchedulePreview | null>(null);
  const [occurrences, setOccurrences] = useState<ApiFixedScheduleOccurrence[]>([]);
  const [step, setStep] = useState<'form' | 'preview'>('form');

  /**
   * Fetch Preview Fixed Schedule
   */
  const fetchPreview = useCallback(async (formData: Partial<FixedScheduleFormData>) => {
    if (!formData.courtId || !formData.cycle || !formData.startDate || !formData.endDate || !formData.timeStart || !formData.timeEnd) {
      toast.error('Vui lòng điền đầy đủ thông tin cơ bản');
      return;
    }

    if (loading) return; // Tránh double call

    setLoading(true);
    try {
      // ✅ Sử dụng API từ api.ts
      const result = await fixedScheduleApi.preview({
        courtId: formData.courtId,
        cycle: formData.cycle,
        startDate: formData.startDate,
        endDate: formData.endDate,
        timeStart: formData.timeStart,
        timeEnd: formData.timeEnd,
      });

      if (result.success && result.data) {
        setPreview(result.data);
        setOccurrences(result.data.occurrences);
        setStep('preview');
        
        if (result.data.suggestions.hasConflicts) {
          toast.warning(result.data.suggestions.message);
        } else {
          toast.success('Tất cả các buổi đều khả dụng!');
        }
      } else {
        throw new Error(result.error || 'Không thể tải preview');
      }
    } catch (error: any) {
      toast.error(error.message || 'Đã có lỗi xảy ra');
      console.error('Preview error:', error);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  /**
   * Toggle skip occurrence
   */
  const toggleSkip = useCallback((date: string) => {
    setOccurrences(prev =>
      prev.map(occ =>
        occ.date === date ? { ...occ, skip: !occ.skip } : occ
      )
    );
  }, []);

  /**
   * Adjust occurrence (change court/time)
   */
  const adjustOccurrence = useCallback((
    date: string,
    adjustments: {
      courtId?: number;
      timeStart?: string;
      timeEnd?: string;
    }
  ) => {
    setOccurrences(prev =>
      prev.map(occ =>
        occ.date === date
          ? {
              ...occ,
              adjustedCourtId: adjustments.courtId,
              adjustedTimeStart: adjustments.timeStart,
              adjustedTimeEnd: adjustments.timeEnd,
              available: true,
            }
          : occ
      )
    );
  }, []);

  /**
   * Confirm và tạo Fixed Schedule
   */
  const confirmSchedule = useCallback(async (formData: FixedScheduleFormData) => {
    const selectedOccurrences = occurrences.filter(occ => !occ.skip);
    
    if (selectedOccurrences.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 buổi');
      return;
    }

    setLoading(true);
    try {
      // ✅ Sử dụng API từ api.ts
      const result = await fixedScheduleApi.confirm({
        ...formData,
        occurrences: occurrences,
      });

      if (result.success && result.data) {
        toast.success('Đặt lịch cố định thành công!');
        return result.data;
      } else {
        throw new Error(result.error || 'Không thể tạo lịch cố định');
      }
    } catch (error: any) {
      toast.error(error.message || 'Đã có lỗi xảy ra');
      console.error('Confirm error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [occurrences]);

  /**
   * Reset form
   */
  const reset = useCallback(() => {
    setPreview(null);
    setOccurrences([]);
    setStep('form');
  }, []);

  return {
    loading,
    preview,
    occurrences,
    step,
    setStep,
    fetchPreview,
    toggleSkip,
    adjustOccurrence,
    confirmSchedule,
    reset,
  };
}