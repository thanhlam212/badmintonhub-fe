"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { fixedScheduleApi } from "@/lib/api";
import type {
  FixedSchedulePreviewRequest,
  FixedSchedulePreviewResponse,
  FixedScheduleConfirmRequest,
  FixedScheduleConfirmResponse,
  OccurrenceUIState,
  OccurrenceAction,
  CheckSlotRequest,
  CheckSlotResponse,
} from "../types";

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
  setOccurrenceAction: (
    date: string,
    action: OccurrenceAction,
    replaceWithCourtId?: number,
  ) => void;
  setCustomAction: (
    date: string,
    courtId: number,
    courtName: string,
    timeStart: string,
    timeEnd: string,
  ) => void;
  checkSlot: (req: CheckSlotRequest) => Promise<CheckSlotResponse | null>;
  confirmBooking: (
    data: FixedScheduleConfirmRequest,
  ) => Promise<FixedScheduleConfirmResponse | null>;
  resetPreview: () => void;
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useFixedSchedule(): UseFixedScheduleReturn {
  const [preview, setPreview] = useState<FixedSchedulePreviewResponse | null>(
    null,
  );
  const [occurrences, setOccurrences] = useState<OccurrenceUIState[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [confirmResult, setConfirmResult] =
    useState<FixedScheduleConfirmResponse | null>(null);

  // ─────────────────────────────────────────────────────────────
  // FETCH PREVIEW
  // ─────────────────────────────────────────────────────────────

  const fetchPreview = useCallback(
    async (data: FixedSchedulePreviewRequest): Promise<boolean> => {
      try {
        setLoadingPreview(true);
        setPreview(null);
        setOccurrences([]);

        const payload: FixedSchedulePreviewRequest = { ...data };

        console.log("📤 Preview Request payload:", payload);
        const response: FixedSchedulePreviewResponse =
          await fixedScheduleApi.preview(payload);
        console.log("📥 Preview Response:", response);

        // FIX: BE trả về response.occurrences (không phải weeklySlots/numberOfWeeks)
        // Guard an toàn nếu BE trả về cấu trúc không đúng
        if (!response || !Array.isArray(response.occurrences)) {
          toast.error("Phản hồi từ server không hợp lệ. Vui lòng thử lại!");
          return false;
        }

        if (response.occurrences.length === 0) {
          toast.error(
            "Không có buổi nào trong khoảng thời gian này. Hãy chọn khoảng rộng hơn!",
          );
          return false;
        }

        // Map PreviewOccurrence → OccurrenceUIState
        // - Không conflict → action: 'keep'
        // - Có conflict + tìm được sân bù → action: 'replace', selectedReplacement = suggestion
        // - Có conflict + không tìm được → action: 'skip'
        const uiOccurrences: OccurrenceUIState[] = response.occurrences.map(
          (occ) => {
            if (!occ.hasConflict) {
              return {
                ...occ,
                action: "keep" as OccurrenceAction,
                selectedReplacement: null,
              };
            }

            if (occ.suggestedReplacement) {
              return {
                ...occ,
                action: "replace" as OccurrenceAction,
                selectedReplacement: occ.suggestedReplacement,
              };
            }

            // Conflict nhưng không có sân bù → bỏ qua
            return {
              ...occ,
              action: "skip" as OccurrenceAction,
              selectedReplacement: null,
            };
          },
        );

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
          toast.success(
            `Tất cả ${summary.totalOccurrences} buổi đều khả dụng!`,
          );
        }

        return true;
      } catch (error: any) {
        console.error("❌ Preview error:", error);

        // FIX: parse lỗi từ BE rõ ràng hơn
        const beMessage =
          error?.response?.data?.message || // NestJS trả { message: '...' }
          error?.message ||
          "Không thể xem trước lịch. Vui lòng kiểm tra lại!";

        // Nếu là mảng (NestJS class-validator trả mảng lỗi validation)
        const displayMsg = Array.isArray(beMessage)
          ? beMessage.join(", ")
          : beMessage;

        toast.error(displayMsg);
        return false;
      } finally {
        setLoadingPreview(false);
      }
    },
    [],
  );

  // ─────────────────────────────────────────────────────────────
  // SET OCCURRENCE ACTION
  // ─────────────────────────────────────────────────────────────

  const setOccurrenceAction = useCallback(
    (date: string, action: OccurrenceAction, replaceWithCourtId?: number) => {
      setOccurrences((prev) =>
        prev.map((occ) => {
          if (occ.date !== date) return occ;

          if (action === "replace") {
            const newReplacement =
              replaceWithCourtId && occ.suggestedReplacement
                ? { ...occ.suggestedReplacement, courtId: replaceWithCourtId }
                : occ.suggestedReplacement;

            return { ...occ, action, selectedReplacement: newReplacement };
          }

          return { ...occ, action, selectedReplacement: null };
        }),
      );
    },
    [],
  );

  // ─────────────────────────────────────────────────────────────
  // SET CUSTOM ACTION
  // ─────────────────────────────────────────────────────────────

  const setCustomAction = useCallback(
    (
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
            action: "custom" as OccurrenceAction,
            selectedReplacement: null,
            customCourtId: courtId,
            customCourtName: courtName,
            customTimeStart: timeStart,
            customTimeEnd: timeEnd,
          };
        }),
      );
    },
    [],
  );

  // ─────────────────────────────────────────────────────────────
  // CHECK SLOT
  // ─────────────────────────────────────────────────────────────

  const checkSlot = useCallback(
    async (req: CheckSlotRequest): Promise<CheckSlotResponse | null> => {
      try {
        const API =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
        const res = await fetch(`${API}/bookings/fixed/check-slot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        });
        if (!res.ok) throw new Error("Không thể kiểm tra slot");
        return await res.json();
      } catch (err: any) {
        toast.error(err.message || "Lỗi kiểm tra slot");
        return null;
      }
    },
    [],
  );

  // ─────────────────────────────────────────────────────────────
  // CONFIRM BOOKING
  // ─────────────────────────────────────────────────────────────

  const confirmBooking = useCallback(
    async (
      data: FixedScheduleConfirmRequest,
    ): Promise<FixedScheduleConfirmResponse | null> => {
      try {
        setLoadingConfirm(true);

        console.log("📤 Confirm Request:", data);
        const response: FixedScheduleConfirmResponse =
          await fixedScheduleApi.confirm(data);
        console.log("📥 Confirm Response:", response);

        setConfirmResult(response);
        toast.success(
          `Đặt lịch thành công! Mã hóa đơn: ${response.invoiceCode}`,
        );
        return response;
      } catch (error: any) {
        console.error("❌ Confirm error:", error);

        const msg =
          error?.response?.data?.message ||
          error?.message ||
          "Không thể đặt lịch. Vui lòng thử lại!";

        const displayMsg = Array.isArray(msg) ? msg.join(", ") : msg;
        toast.error(displayMsg);
        return null;
      } finally {
        setLoadingConfirm(false);
      }
    },
    [],
  );

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
