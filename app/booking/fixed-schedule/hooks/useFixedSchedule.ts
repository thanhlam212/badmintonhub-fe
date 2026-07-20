"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch, fixedScheduleApi } from "@/lib/api";
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
    timeStart?: string,
    timeEnd?: string,
  ) => void;
  setCustomAction: (
    date: string,
    customDate: string,
    courtId: number,
    courtName: string,
    timeStart: string,
    timeEnd: string,
    originalTimeStart?: string,
    originalTimeEnd?: string,
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

        const response: FixedSchedulePreviewResponse =
          await fixedScheduleApi.preview(payload);

        // Xử lý lỗi validation từ BE (ví dụ: khoảng ngày không đủ buổi)
        if ((response as any)?._error) {
          toast.error((response as any).message);
          return false;
        }

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
        // - Có conflict + không tìm được → chờ khách đổi lịch hoặc chủ động bỏ
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

            // Không tự bỏ qua: khách phải chọn đổi giờ/ngày hoặc bỏ.
            return {
              ...occ,
              action: "pending" as const,
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
            `Có ${summary.unresolvableCount} buổi chưa có sân thay thế. Vui lòng đổi lịch hoặc chọn bỏ qua.`,
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
    (
      date: string,
      action: OccurrenceAction,
      replaceWithCourtId?: number,
      timeStart?: string,
      timeEnd?: string,
    ) => {
      setOccurrences((prev) =>
        prev.map((occ) => {
          if (
            occ.date !== date ||
            (timeStart && timeEnd && (occ.timeStart !== timeStart || occ.timeEnd !== timeEnd))
          ) {
            return occ;
          }

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
      customDate: string,
      courtId: number,
      courtName: string,
      timeStart: string,
      timeEnd: string,
      originalTimeStart?: string,
      originalTimeEnd?: string,
    ) => {
      setOccurrences((prev) =>
        prev.map((occ) => {
          if (
            occ.date !== date ||
            (originalTimeStart &&
              originalTimeEnd &&
              (occ.timeStart !== originalTimeStart || occ.timeEnd !== originalTimeEnd))
          ) {
            return occ;
          }
          return {
            ...occ,
            action: "custom" as OccurrenceAction,
            selectedReplacement: null,
            customDate,
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
        const res = await apiFetch<CheckSlotResponse>(
          "/bookings/fixed/check-slot",
          {
            method: "POST",
            body: JSON.stringify(req),
          },
        );
        if (!res.success || !res.data) {
          throw new Error(res.message || "Không thể kiểm tra lịch trống");
        }
        return res.data;
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

        const response: FixedScheduleConfirmResponse =
          await fixedScheduleApi.confirm(data);

        setConfirmResult(response);
        toast.success(
          `Đặt lịch thành công! Mã hóa đơn: ${response.invoiceCode}`,
        );
        return response;
      } catch (error: any) {
        console.warn("Fixed schedule confirm error:", error);

        const msg =
          error?.response?.data?.message ||
          error?.message ||
          "Không thể đặt lịch. Vui lòng thử lại!";

        const displayMsg = Array.isArray(msg) ? msg.join(", ") : msg;
        const friendlyMsg =
          typeof displayMsg === "string" &&
          displayMsg.includes("customDate should not exist")
            ? "Backend đang chạy bản cũ chưa nhận field đổi ngày. Hãy restart server backend rồi thử lại."
            : displayMsg;
        toast.error(friendlyMsg);
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
