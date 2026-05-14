// ═══════════════════════════════════════════════════════════════
// ENUMS - Khớp với BE booking.dto.ts
// ═══════════════════════════════════════════════════════════════

export type FixedScheduleCycle = 'weekly' | 'monthly';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'momo' | 'vnpay';

/**
 * Action cho từng occurrence khi confirm gói.
 * Khớp với OccurrenceAction enum ở BE.
 */
export type OccurrenceAction = 'keep' | 'replace' | 'custom' | 'skip';

// ═══════════════════════════════════════════════════════════════
// CHECK SLOT (dùng trong modal đổi giờ)
// ═══════════════════════════════════════════════════════════════

export interface CheckSlotRequest {
  courtId: number;
  date: string;
  timeStart: string;
  timeEnd: string;
}

export interface CourtAvailability {
  id: number;
  name: string;
  type: string;
  price: number;
  available: boolean;
  isSelected: boolean;
}

export interface CheckSlotResponse {
  courtId: number;
  date: string;
  timeStart: string;
  timeEnd: string;
  available: boolean;
  conflicts: { time: string; status: string; bookedBy: string | null }[];
  courts: CourtAvailability[];
}

// ═══════════════════════════════════════════════════════════════
// COURT
// ═══════════════════════════════════════════════════════════════

export interface Court {
  id: number;
  name: string;
  type: string;
  price: number;
  branchId: number;
}

// ═══════════════════════════════════════════════════════════════
// PREVIEW - Request & Response
// ═══════════════════════════════════════════════════════════════

/** Payload gửi lên POST /bookings/fixed/preview */
export interface FixedSchedulePreviewRequest {
  courtId: number;
  cycle: FixedScheduleCycle;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  timeStart: string; // HH:mm
  timeEnd: string;
}

/** Sân thay thế BE gợi ý khi có conflict */
export interface SuggestedReplacement {
  courtId: number;
  courtName: string;
  courtType: string;
  timeStart: string;
  timeEnd: string;
}

/** Thông tin 1 conflict slot */
export interface ConflictSlot {
  time: string;
  status: string;
  bookedBy: string | null;
}

/**
 * Thông tin 1 buổi trong response /preview.
 * hasConflict = true → có suggestedReplacement (hoặc null nếu không tìm được sân bù)
 */
export interface PreviewOccurrence {
  date: string;         // YYYY-MM-DD
  dayLabel: string;     // T2, T3...
  timeStart: string;    // HH:mm - giờ bắt đầu của buổi
  timeEnd: string;      // HH:mm - giờ kết thúc của buổi
  hasConflict: boolean;
  conflicts: ConflictSlot[];
  suggestedReplacement: SuggestedReplacement | null;
}

/** Response đầy đủ từ /preview */
export interface FixedSchedulePreviewResponse {
  court: Court;
  cycle: FixedScheduleCycle;
  startDate: string;
  endDate: string;
  timeStart: string;
  timeEnd: string;
  hoursPerSession: number;
  occurrences: PreviewOccurrence[];
  summary: {
    totalOccurrences: number;
    availableCount: number;
    replaceableCount: number;
    unresolvableCount: number;
  };
  pricing: {
    pricePerHour: number;
    pricePerSession: number;
    estimatedTotal: number;
    currency: string;
  };
}

// ═══════════════════════════════════════════════════════════════
// CONFIRM - Request & Response
// ═══════════════════════════════════════════════════════════════

/**
 * Quyết định của user cho 1 buổi khi confirm.
 * Chỉ gửi "ý định" - BE tự tính giá từ DB.
 */
export interface OccurrenceDecision {
  date: string;
  action: OccurrenceAction;
  replaceWithCourtId?: number;  // required khi action = 'replace' hoặc 'custom'
  customTimeStart?: string;     // required khi action = 'custom'
  customTimeEnd?: string;       // required khi action = 'custom'
  reason?: string;
}

/** Payload gửi lên POST /bookings/fixed/confirm */
export interface FixedScheduleConfirmRequest {
  // Thông tin gói
  courtId: number;
  cycle: FixedScheduleCycle;
  startDate: string;
  endDate: string;
  timeStart: string;
  timeEnd: string;
  // Thông tin khách
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  paymentMethod: PaymentMethod;
  userId?: string;
  // Decisions
  decisions: OccurrenceDecision[];
  adjustmentLimit?: number;
}

/** Response từ /confirm */
export interface FixedScheduleConfirmResponse {
  scheduleId: string;
  invoiceId: string;
  invoiceCode: string;
  totalAmount: number;
  bookingsCreated: number;
  skipped: number;
  status: string;
}

// ═══════════════════════════════════════════════════════════════
// UI STATE - dùng nội bộ trong components
// ═══════════════════════════════════════════════════════════════

/**
 * State của 1 occurrence trên UI (sau khi user đã chọn action).
 * Extend từ PreviewOccurrence, thêm field UI state.
 */
export interface OccurrenceUIState extends PreviewOccurrence {
  action: OccurrenceAction;
  // action='replace': sân BE gợi ý
  selectedReplacement: SuggestedReplacement | null;
  // action='custom': user tự chọn
  customCourtId?: number;
  customCourtName?: string;
  customTimeStart?: string;
  customTimeEnd?: string;
}