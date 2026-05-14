'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { fixedScheduleApi } from '@/lib/api';
import type {
  FixedSchedulePreviewRequest,
  FixedSchedulePreviewResponse,
  FixedScheduleConfirmRequest,
  FixedScheduleConfirmResponse,
  OccurrenceUIState,
  OccurrenceAction,
  CheckSlotRequest,
  CheckSlotResponse,
} from '../types';

// ═══════════════════════════════════════════════════════════════
// HOOK STATE TYPE
// ═══════════════════════════════════════════════════════════════

export interface UseFixedScheduleReturn {
  preview: FixedSchedulePreviewResponse | null;
  occurrences: OccurrenceUIState[];
  loadingPreview: boolean;
  loadingConfirm: boolean;
  confirmResult: FixedScheduleConfirmResponse | null;
  fetchPreview: (data: FixedSchedulePreviewRequest) => Promise<boolean>;
  setOccurrenceAction: (date: string, action: OccurrenceAction, replaceWithCourtId?: number) => void;
  setCustomAction: (date: string, courtId: number, courtName: string, timeStart: string, timeEnd: string) => void;
  checkSlot: (req: CheckSlotRequest) => Promise<CheckSlotResponse | null>;
  confirmBooking: (data: FixedScheduleConfirmRequest) => Promise<FixedScheduleConfirmResponse | null>;
  resetPreview: () => void;
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useFixedSchedule(): UseFixedScheduleReturn {
  const [preview, setPreview] = useState<FixedSchedulePreviewResponse | null>(null);
  const [occurrences, setOccurrences] = useState<OccurrenceUIState[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [confirmResult, setConfirmResult] = useState<FixedScheduleConfirmResponse | null>(null);

  // ─────────────────────────────────────────────────────────────
  // FETCH PREVIEW
  // ─────────────────────────────────────────────────────────────

  const fetchPreview = useCallback(async (
    data: FixedSchedulePreviewRequest,
  ): Promise<boolean> => {
    try {
      setLoadingPreview(true);
      setPreview(null);
      setOccurrences([]);

      console.log('📤 Preview Request:', data);
      const response: FixedSchedulePreviewResponse = await fixedScheduleApi.preview(data);
      console.log('📥 Preview Response:', response);

      if (!response.occurrences || response.occurrences.length === 0) {
        toast.error('Không có buổi nào trong khoảng thời gian này!');
        return false;
      }

      // Map PreviewOccurrence → OccurrenceUIState
      // - Không conflict → action: 'keep'
      // - Có conflict + tìm được sân bù → action: 'replace', selectedReplacement = suggestion
      // - Có conflict + không tìm được → action: 'skip'
      const uiOccurrences: OccurrenceUIState[] = response.occurrences.map((occ) => {
        if (!occ.hasConflict) {
          return {
            ...occ,
            action: 'keep',
            selectedReplacement: null,
          };
        }

        if (occ.suggestedReplacement) {
          return {
            ...occ,
            action: 'replace',
            selectedReplacement: occ.suggestedReplacement,
          };
        }

        // Có conflict nhưng không tìm được sân bù → mặc định skip
        return {
          ...occ,
          action: 'skip',
          selectedReplacement: null,
        };
      });

      setPreview(response);
      setOccurrences(uiOccurrences);

      // Toast summary
      const { summary } = response;
      if (summary.unresolvableCount > 0) {
        toast.warning(
          `Có ${summary.unresolvableCount} buổi không tìm được sân bù, đã tự động bỏ qua.`,
        );
      } else if (summary.replaceableCount > 0) {
        toast.warning(
          `Có ${summary.replaceableCount} buổi bị trùng, hệ thống đã gợi ý sân thay thế.`,
        );
      } else {
        toast.success('Tất cả các buổi đều khả dụng!');
      }

      return true;
    } catch (error: any) {
      console.error('❌ Preview error:', error);
      toast.error(error.message || 'Không thể xem trước lịch. Vui lòng kiểm tra lại!');
      return false;
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // SET OCCURRENCE ACTION (user thay đổi action trên UI)
  // ─────────────────────────────────────────────────────────────

  const setOccurrenceAction = useCallback((
    date: string,
    action: OccurrenceAction,
    replaceWithCourtId?: number,
  ) => {
    setOccurrences((prev) =>
      prev.map((occ) => {
        if (occ.date !== date) return occ;

        // Khi đổi sang replace: giữ selectedReplacement hiện tại (suggestion từ BE)
        // hoặc cập nhật nếu user chọn courtId khác
        if (action === 'replace') {
          const newReplacement =
            replaceWithCourtId && occ.suggestedReplacement
              ? { ...occ.suggestedReplacement, courtId: replaceWithCourtId }
              : occ.suggestedReplacement;

          return { ...occ, action, selectedReplacement: newReplacement };
        }

        return { ...occ, action, selectedReplacement: null };
      }),
    );
  }, []);

  // ─────────────────────────────────────────────────────────────
  // SET CUSTOM ACTION (user tự chọn sân + giờ)
  // ─────────────────────────────────────────────────────────────

  const setCustomAction = useCallback((
    date: string,
    courtId: number,
    courtName: string,
    timeStart: string,
    timeEnd: string,
  ) => {
    setOccurrences((prev) =>
      prev.map((occ) => {
        if (occ.date !== date) return occ;
        return {
          ...occ,
          action: 'custom' as OccurrenceAction,
          selectedReplacement: null,
          customCourtId: courtId,
          customCourtName: courtName,
          customTimeStart: timeStart,
          customTimeEnd: timeEnd,
        };
      }),
    );
  }, []);

  // ─────────────────────────────────────────────────────────────
  // CHECK SLOT (dùng trong modal đổi giờ)
  // ─────────────────────────────────────────────────────────────

  const checkSlot = useCallback(async (
    req: CheckSlotRequest,
  ): Promise<CheckSlotResponse | null> => {
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${API}/bookings/fixed/check-slot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error('Không thể kiểm tra slot');
      return await res.json();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kiểm tra slot');
      return null;
    }
  }, []);

  const confirmBooking = useCallback(async (
    data: FixedScheduleConfirmRequest,
  ): Promise<FixedScheduleConfirmResponse | null> => {
    try {
      setLoadingConfirm(true);

      console.log('📤 Confirm Request:', data);
      const response: FixedScheduleConfirmResponse = await fixedScheduleApi.confirm(data);
      console.log('📥 Confirm Response:', response);

      setConfirmResult(response);
      toast.success(
        `Đặt lịch thành công! Mã hóa đơn: ${response.invoiceCode}`,
      );
      return response;
    } catch (error: any) {
      console.error('❌ Confirm error:', error);
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Không thể đặt lịch. Vui lòng thử lại!';
      toast.error(msg);
      return null;
    } finally {
      setLoadingConfirm(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // RESET
  // ─────────────────────────────────────────────────────────────

  const resetPreview = useCallback(() => {
    setPreview(null);
    setOccurrences([]);
    setConfirmResult(null);
  }, []);

  return {
    preview,
    occurrences,
    loadingPreview,
    loadingConfirm,
    confirmResult,
    fetchPreview,
    setOccurrenceAction,
    setCustomAction,
    checkSlot,
    confirmBooking,
    resetPreview,
  };
}