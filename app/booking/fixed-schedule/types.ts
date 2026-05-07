// ═══════════════════════════════════════════════════════════
// TYPES FOR FIXED SCHEDULE BOOKING
// ═══════════════════════════════════════════════════════════

export type FixedScheduleCycle = 'weekly' | 'monthly';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'momo' | 'vnpay';

export interface Court {
  id: number;
  name: string;
  type: string;
  price: number;
}

export interface Occurrence {
  date: string;
  dayLabel: string;
  courtId: number;
  courtName: string;
  timeStart: string;
  timeEnd: string;
  slots: string[];
  available: boolean;
  conflicts: Array<{
    time: string;
    status: string;
    bookedBy?: string;
  }>;
  pricePerHour: number;
  amount: number;
  skip: boolean;
  
  // For adjustments (Yêu cầu 2 sẽ dùng)
  adjustedCourtId?: number;
  adjustedTimeStart?: string;
  adjustedTimeEnd?: string;
}

export interface PreviewResponse {
  court: Court;
  cycle: FixedScheduleCycle;
  startDate: string;
  endDate: string;
  hoursPerSession: number;
  occurrences: Occurrence[];
  totalOccurrences: number;
  availableOccurrences: number;
  conflictOccurrences: number;
  pricing: {
    pricePerHour: number;
    pricePerSession: number;
    totalSessions: number;
    subtotal: number;
    suggestedDiscount: number;
    discountAmount: number;
    finalAmount: number;
  };
  suggestions: {
    hasConflicts: boolean;
    message: string;
  };
}

export interface FixedScheduleFormData {
  courtId: number;
  cycle: FixedScheduleCycle;
  startDate: string;
  endDate: string;
  timeStart: string;
  timeEnd: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  paymentMethod: PaymentMethod;
  adjustmentLimit?: number;
  discountRate?: number;
}