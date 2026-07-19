// ═══════════════════════════════════════════════════════════════
// types.ts — Fixed Schedule FE types
// CHANGES: CheckSlotResponse thêm price, isOriginal, hasAvailable
// ═══════════════════════════════════════════════════════════════

export type FixedScheduleCycle = "weekly" | "monthly";
export type FixedScheduleBookingMode = "occurrence_count" | "date_range";
export type PaymentMethod = "cash" | "bank_transfer" | "momo" | "vnpay";
export type OccurrenceAction = "keep" | "replace" | "custom" | "skip";
export type OccurrenceUIAction = OccurrenceAction | "pending";

export interface Court {
  id: number;
  name: string;
  type: string;
  price: number;
  branchId: number;
  available?: boolean;
}

export interface FixedScheduleRule {
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeStart: string;
  timeEnd: string;
}

// ─── Preview Request ──────────────────────────────────────────

export interface FixedSchedulePreviewRequest {
  courtId: number;
  cycle: FixedScheduleCycle;
  bookingMode?: FixedScheduleBookingMode;
  startDate: string;
  endDate?: string;
  occurrenceCount?: number;
  rules?: FixedScheduleRule[];
  timeStart?: string;
  timeEnd?: string;
}

// ─── Preview Response ─────────────────────────────────────────

export interface ConflictSlot {
  time: string;
  status: string;
  bookedBy: string | null;
}

export interface SuggestedReplacement {
  courtId: number;
  courtName: string;
  courtType: string;
  timeStart: string;
  timeEnd: string;
}

export interface PreviewOccurrence {
  courtId: number;
  date: string;
  dayLabel: string;
  timeStart: string;
  timeEnd: string;
  hasConflict: boolean;
  conflicts: ConflictSlot[];
  suggestedReplacement: SuggestedReplacement | null;
}

export interface PreviewSummary {
  totalOccurrences: number;
  availableCount: number;
  conflictCount: number;
  replaceableCount: number;
  unresolvableCount: number;
}

export interface FixedSchedulePreviewResponse {
  court: Court;
  cycle?: FixedScheduleCycle;
  bookingMode?: FixedScheduleBookingMode;
  occurrenceCount?: number;
  rules?: FixedScheduleRule[];
  startDate?: string;
  endDate?: string;
  timeStart?: string;
  timeEnd?: string;
  occurrences: PreviewOccurrence[];
  summary: PreviewSummary;
  pricing: {
    pricePerHour: number;
    pricePerSession: number;
    estimatedTotal: number;
    currency: string;
  };
}

// ─── OccurrenceUIState ────────────────────────────────────────

export interface OccurrenceUIState extends PreviewOccurrence {
  action: OccurrenceUIAction;
  selectedReplacement: SuggestedReplacement | null;
  customCourtId?: number;
  customCourtName?: string;
  customTimeStart?: string;
  customTimeEnd?: string;
}

// ─── Confirm ─────────────────────────────────────────────────

export interface OccurrenceDecision {
  date: string;
  action: OccurrenceAction;
  replaceWithCourtId?: number;
  customTimeStart?: string;
  customTimeEnd?: string;
  reason?: string;
}

export interface FixedScheduleConfirmRequest {
  courtId: number;
  cycle: FixedScheduleCycle;
  bookingMode?: FixedScheduleBookingMode;
  startDate: string;
  endDate?: string;
  occurrenceCount?: number;
  rules?: FixedScheduleRule[];
  timeStart?: string;
  timeEnd?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  paymentMethod: PaymentMethod;
  userId?: string;
  decisions: OccurrenceDecision[];
  adjustmentLimit?: number;
}

export interface FixedScheduleConfirmResponse {
  scheduleId: string;
  invoiceCode: string;
  bookingsCreated: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
}

// ─── Check Slot ───────────────────────────────────────────────
// UPDATED: thêm price, isOriginal, hasAvailable

export interface CheckSlotRequest {
  courtId: number; // sân GỐC của gói (để lấy branchId + type)
  date: string; // ngày của buổi cần đổi
  timeStart: string; // khung giờ MỚI
  timeEnd: string;
}

export interface CheckSlotCourtResult {
  id: number;
  name: string;
  type: string;
  price: number; // NEW: để hiển thị giá trong modal
  available: boolean;
  isOriginal: boolean; // NEW: true nếu là sân gốc của gói
}

export interface CheckSlotResponse {
  date: string;
  timeStart: string;
  timeEnd: string;
  courts: CheckSlotCourtResult[];
  hasAvailable: boolean; // NEW: shortcut để FE biết nhanh
}
