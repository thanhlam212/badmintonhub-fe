"use client";

/**
 * page.tsx — Fixed Schedule booking page
 *
 * CHANGES:
 * 1. AdjustSlotModal: UI chọn giờ chia rõ Sáng / Chiều / Tối thay vì input giờ thô
 * 2. OccurrenceRow: hiển thị đầy đủ trạng thái conflict + action buttons
 * 3. CheckSlotResponse type mới có price, isOriginal, hasAvailable
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  MapPin,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  SkipForward,
  Home,
  User,
  CreditCard,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  BadgeCheck,
  XCircle,
  Sparkles,
  Shield,
  Clock,
  Plus,
  Settings2,
  Sun,
  Sunset,
  Moon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { paymentApi } from "@/lib/api";
import { useFixedSchedule } from "./hooks/useFixedSchedule";
import { FIXED_CHECKOUT_STORAGE_KEY } from "./types";
import type {
  FixedScheduleRule,
  PaymentMethod,
  OccurrenceUIState,
  OccurrenceAction,
  Court,
  CheckSlotRequest,
  CheckSlotResponse,
  FixedSchedulePreviewResponse,
  FixedScheduleCycle,
} from "./types";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const DAY_LABELS = [
  { value: 1, label: "Thứ Hai", short: "T2" },
  { value: 2, label: "Thứ Ba", short: "T3" },
  { value: 3, label: "Thứ Tư", short: "T4" },
  { value: 4, label: "Thứ Năm", short: "T5" },
  { value: 5, label: "Thứ Sáu", short: "T6" },
  { value: 6, label: "Thứ Bảy", short: "T7" },
  { value: 0, label: "Chủ Nhật", short: "CN" },
];

const PAYMENT_OPTIONS: {
  value: PaymentMethod;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    value: "sepay",
    label: "SePay",
    icon: "🏦",
    desc: "Thanh toán QR / cổng SePay",
  },
  { value: "cash", label: "Tiền mặt", icon: "💵", desc: "Thanh toán tại quầy" },
  {
    value: "bank_transfer",
    label: "Chuyển khoản",
    icon: "🏦",
    desc: "Internet Banking",
  },
  { value: "momo", label: "MoMo", icon: "📱", desc: "Ví điện tử MoMo" },
  { value: "vnpay", label: "VNPay", icon: "💳", desc: "Cổng thanh toán VNPay" },
];

function submitPaymentForm(
  checkoutUrl: string,
  formFields: Record<string, unknown>,
) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = checkoutUrl;
  Object.entries(formFields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value ?? "");
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

// ─── TIME SLOTS chia theo buổi ────────────────────────────────
// Hệ thống lưu theo slot 1h, nên mỗi khung chỉ cần timeStart/timeEnd.

type SessionColor = "amber" | "blue" | "purple";
type TimeSlot = { start: string; end: string; label: string };
type TimeSession = {
  label: string;
  range: string;
  color: SessionColor;
  slots: TimeSlot[];
};

const formatHour = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

const buildTimeSlots = (startHour: number, endHour: number): TimeSlot[] => {
  const slots: TimeSlot[] = [];

  for (let start = startHour; start < endHour; start += 1) {
    const timeStart = formatHour(start);
    const timeEnd = formatHour(start + 1);
    slots.push({
      start: timeStart,
      end: timeEnd,
      label: `${timeStart} – ${timeEnd}`,
    });
  }

  return slots;
};

const TIME_SESSIONS: TimeSession[] = [
  {
    label: "🌅 Buổi sáng",
    range: "06:00 – 11:00",
    color: "amber",
    slots: buildTimeSlots(6, 11),
  },
  {
    label: "☀️ Buổi chiều",
    range: "11:00 – 17:00",
    color: "blue",
    slots: buildTimeSlots(11, 17),
  },
  {
    label: "🌙 Buổi tối",
    range: "17:00 – 22:00",
    color: "purple",
    slots: buildTimeSlots(17, 22),
  },
];

const ALL_TIME_SLOTS = TIME_SESSIONS.flatMap((session) => session.slots);

const getSlotKey = (slot: Pick<TimeSlot, "start" | "end">) =>
  `${slot.start}-${slot.end}`;

const SESSION_COLORS: Record<
  SessionColor,
  { slot: string; active: string; badge: string }
> = {
  amber: {
    slot: "hover:border-amber-400 hover:bg-amber-50",
    active: "border-amber-500 bg-amber-50 text-amber-700",
    badge: "bg-amber-100 text-amber-700",
  },
  blue: {
    slot: "hover:border-blue-400 hover:bg-blue-50",
    active: "border-blue-500 bg-blue-50 text-blue-700",
    badge: "bg-blue-100 text-blue-700",
  },
  purple: {
    slot: "hover:border-purple-400 hover:bg-purple-50",
    active: "border-purple-500 bg-purple-50 text-purple-700",
    badge: "bg-purple-100 text-purple-700",
  },
};

const FIXED_BOOKING_MODE = "occurrence_count" as const;
const DATE_RANGE_BOOKING_MODE = "date_range" as const;
const CONTIGUOUS_SLOT_NOTICE =
  "Vui lòng chọn các khung giờ liền nhau, ví dụ 18:00-19:00 rồi 19:00-20:00.";

type ScheduleRuleState = Required<Pick<FixedScheduleRule, "dayOfWeek">> &
  Pick<FixedScheduleRule, "timeStart" | "timeEnd"> & {
    id: string;
    repeat: boolean;
    specificDate?: string;
    repeatWeeks: number;
    repeatUntil: "weeks" | "month_end";
  };

type FixedRepeatMode = "shared" | "custom";

const DEFAULT_RULE_TIME = { timeStart: "18:00", timeEnd: "20:00" };
const DEFAULT_REPEAT_WEEKS = 4;

const dayOrder = (day: number) => (day === 0 ? 7 : day);
const sortScheduleRules = (rules: ScheduleRuleState[]) =>
  [...rules].sort(
    (a, b) =>
      dayOrder(a.dayOfWeek) - dayOrder(b.dayOfWeek) ||
      Number(b.repeat) - Number(a.repeat) ||
      (a.specificDate ?? "").localeCompare(b.specificDate ?? "") ||
      toMinutes(a.timeStart) - toMinutes(b.timeStart) ||
      a.id.localeCompare(b.id),
  );
const getDayMeta = (day: number) =>
  DAY_LABELS.find((item) => item.value === day) ?? DAY_LABELS[0];
const toMinutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + (minute || 0);
};

const slotIsInsideRange = (
  slot: Pick<TimeSlot, "start" | "end">,
  timeStart?: string,
  timeEnd?: string,
) => {
  if (!timeStart || !timeEnd) return false;
  return toMinutes(slot.start) >= toMinutes(timeStart) && toMinutes(slot.end) <= toMinutes(timeEnd);
};

function getRuleSlotKeys(rule: Pick<ScheduleRuleState, "timeStart" | "timeEnd">) {
  return ALL_TIME_SLOTS.filter((slot) =>
    slotIsInsideRange(slot, rule.timeStart, rule.timeEnd),
  ).map(getSlotKey);
}

function buildRangesFromSlotKeys(slotKeys: Set<string>) {
  const selectedSlots = ALL_TIME_SLOTS.filter((slot) =>
    slotKeys.has(getSlotKey(slot)),
  ).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

  return selectedSlots.reduce<Array<{ timeStart: string; timeEnd: string }>>(
    (ranges, slot) => {
      const lastRange = ranges[ranges.length - 1];
      if (!lastRange || lastRange.timeEnd !== slot.start) {
        ranges.push({ timeStart: slot.start, timeEnd: slot.end });
        return ranges;
      }

      lastRange.timeEnd = slot.end;
      return ranges;
    },
    [],
  );
}

const rangesIntersect = (
  timeStart: string | undefined,
  timeEnd: string | undefined,
  slots: TimeSlot[],
) => {
  if (!timeStart || !timeEnd) return false;
  const selectedStart = toMinutes(timeStart);
  const selectedEnd = toMinutes(timeEnd);
  return slots.some(
    (slot) =>
      toMinutes(slot.start) < selectedEnd && toMinutes(slot.end) > selectedStart,
  );
};

function resolveContiguousSlotSelection(
  current: { start: string; end: string } | null,
  slot: Pick<TimeSlot, "start" | "end">,
) {
  if (!current) return { start: slot.start, end: slot.end };

  const currentStart = toMinutes(current.start);
  const currentEnd = toMinutes(current.end);
  const slotStart = toMinutes(slot.start);
  const slotEnd = toMinutes(slot.end);

  if (slotStart === currentStart && slotEnd === currentEnd) return current;
  if (slotEnd === currentStart) return { start: slot.start, end: current.end };
  if (slotStart === currentEnd) return { start: current.start, end: slot.end };

  if (slotStart === currentStart && slotEnd < currentEnd) {
    return { start: slot.end, end: current.end };
  }
  if (slotStart > currentStart && slotEnd === currentEnd) {
    return { start: current.start, end: slot.start };
  }
  if (slotStart > currentStart && slotEnd < currentEnd) {
    return null;
  }

  return null;
}
const createRuleId = () =>
  `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function toUtcDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getNextDateForDay(dayOfWeek: number, fromDate: string) {
  const start = toUtcDate(fromDate);
  const offset = (dayOfWeek - start.getUTCDay() + 7) % 7;
  return formatUtcDate(addUtcDays(start, offset));
}

function getMonthEndDate(dateValue: string) {
  if (!dateValue) return "";
  const date = toUtcDate(dateValue);
  return formatUtcDate(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)),
  );
}

function formatDisplayDate(dateValue: string) {
  if (!dateValue) return "";
  const date = toUtcDate(dateValue);
  return `${getDayMeta(date.getUTCDay()).short} ${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function countWeeklyDatesUntil(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0;
  const start = toUtcDate(startDate);
  const end = toUtcDate(endDate);
  if (end < start) return 0;
  let count = 0;

  for (let cursor = new Date(start); cursor <= end; cursor = addUtcDays(cursor, 7)) {
    count += 1;
  }

  return count;
}

function getWeeklyDateSequence(startDate: string, weeks: number) {
  if (!startDate || weeks <= 0) return [];
  const start = toUtcDate(startDate);
  return Array.from({ length: weeks }, (_, index) =>
    formatUtcDate(addUtcDays(start, index * 7)),
  );
}

function getDateRangeDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0;
  const start = toUtcDate(startDate);
  const end = toUtcDate(endDate);
  if (end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function estimateWeeklyEndDate(startDate: string, rules: ScheduleRuleState[]) {
  if (!startDate || !rules.length) return "";
  const start = toUtcDate(startDate);
  const normalizedRules = sortScheduleRules(rules);
  const completedDates: string[] = [];

  for (const rule of normalizedRules) {
    if (!rule.repeat && !rule.specificDate) continue;
    const ruleStart = rule.repeat ? start : toUtcDate(rule.specificDate!);
    let seen = 0;
    for (let offset = 0; offset <= 7 * 104; offset += 1) {
      const date = addUtcDays(ruleStart, offset);
      if (date.getUTCDay() !== rule.dayOfWeek) continue;
      seen += 1;
      if (seen === rule.repeatWeeks) {
        completedDates.push(formatUtcDate(date));
        break;
      }
    }
  }

  return completedDates.sort().slice(-1)[0] ?? "";
}

function formatCycleLabel(cycle: FixedScheduleCycle) {
  if (cycle === "daily") return "Lặp theo ngày";
  if (cycle === "monthly") return "Hàng tháng";
  return "Hàng tuần";
}

// ═══════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

const occurrenceKey = (occ: Pick<OccurrenceUIState, "date" | "timeStart" | "timeEnd">) =>
  `${occ.date}-${occ.timeStart}-${occ.timeEnd}`;

const startOfUtcWeek = (date: Date) => {
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addUtcDays(date, mondayOffset);
};

function getOccurrenceTone(occ: OccurrenceUIState) {
  if (occ.action === "skip") return "bg-gray-100 text-gray-400 border-gray-200";
  if (occ.action === "custom") return "bg-purple-100 text-purple-700 border-purple-200";
  if (!occ.hasConflict) return "bg-green-100 text-green-700 border-green-200";
  if (occ.suggestedReplacement || occ.action === "replace") {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }
  return "bg-red-100 text-red-700 border-red-200";
}

function getOccurrenceSymbol(occ: OccurrenceUIState) {
  if (occ.action === "skip") return "-";
  if (occ.action === "custom") return "D";
  if (!occ.hasConflict) return "OK";
  if (occ.suggestedReplacement || occ.action === "replace") return "B";
  return "!";
}

function ensureUniqueScheduleRuleIds(rules: ScheduleRuleState[]) {
  const usedIds = new Set<string>();
  let changed = false;

  const nextRules = rules.map((rule) => {
    if (!usedIds.has(rule.id)) {
      usedIds.add(rule.id);
      return rule;
    }

    changed = true;
    let nextId = createRuleId();
    while (usedIds.has(nextId)) nextId = createRuleId();
    usedIds.add(nextId);
    return { ...rule, id: nextId };
  });

  return changed ? nextRules : rules;
}

export default function FixedSchedulePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);

  // ── Step 1 state ──
  const [courts, setCourts] = useState<Court[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(true);
  const [courtId, setCourtId] = useState("");
  const [cycle, setCycle] = useState<FixedScheduleCycle>("weekly");
  const [fixedRepeatMode, setFixedRepeatMode] = useState<FixedRepeatMode>("shared");
  const [sharedRepeatWeeks, setSharedRepeatWeeks] = useState(DEFAULT_REPEAT_WEEKS);
  const [scheduleRules, setScheduleRules] = useState<ScheduleRuleState[]>([
    { id: "rule-tue-evening", dayOfWeek: 2, repeat: true, repeatWeeks: DEFAULT_REPEAT_WEEKS, repeatUntil: "weeks", ...DEFAULT_RULE_TIME },
    { id: "rule-thu-evening", dayOfWeek: 4, repeat: true, repeatWeeks: DEFAULT_REPEAT_WEEKS, repeatUntil: "weeks", ...DEFAULT_RULE_TIME },
  ]);
  const [activeRuleId, setActiveRuleId] = useState("rule-tue-evening");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [slotSelectionNotice, setSlotSelectionNotice] = useState("");
  const [activeSession, setActiveSession] = useState<SessionColor>("purple"); // default buổi tối
  const [showSummaryDetail, setShowSummaryDetail] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);

  const selectedDays = Array.from(
    new Set(scheduleRules.filter((rule) => rule.repeat).map((rule) => rule.dayOfWeek)),
  );
  const activeRule = scheduleRules.find(
    (rule) => rule.id === activeRuleId,
  );

  useEffect(() => {
    const uniqueRules = ensureUniqueScheduleRuleIds(scheduleRules);
    if (uniqueRules === scheduleRules) return;

    setScheduleRules(uniqueRules);
    if (!uniqueRules.some((rule) => rule.id === activeRuleId)) {
      setActiveRuleId(uniqueRules[0]?.id ?? "");
    }
  }, [activeRuleId, scheduleRules]);

  const primaryRule = scheduleRules[0] ?? {
    id: "fallback-rule",
    dayOfWeek: 2,
    repeat: true,
    repeatWeeks: DEFAULT_REPEAT_WEEKS,
    repeatUntil: "weeks" as const,
    ...DEFAULT_RULE_TIME,
  };
  const timeStart = primaryRule.timeStart;
  const timeEnd = primaryRule.timeEnd;
  const getRuleOccurrenceCount = (rule: ScheduleRuleState) => {
    if (cycle === "weekly" && rule.repeat && fixedRepeatMode === "shared") {
      return sharedRepeatWeeks;
    }
    if (!rule.repeat && rule.repeatUntil === "month_end" && rule.specificDate) {
      return countWeeklyDatesUntil(rule.specificDate, getMonthEndDate(rule.specificDate));
    }
    return rule.repeatWeeks;
  };
  const repeatingRules = scheduleRules.filter((rule) => rule.repeat);
  const oddRules = scheduleRules.filter((rule) => !rule.repeat);
  const weeklyOccurrenceCount = scheduleRules.reduce(
    (sum, rule) => sum + getRuleOccurrenceCount(rule),
    0,
  );
  const dailyOccurrenceCount =
    getDateRangeDays(startDate, endDate) * repeatingRules.length +
    oddRules.reduce((sum, rule) => sum + getRuleOccurrenceCount(rule), 0);
  const occurrenceCount =
    cycle === "daily" ? dailyOccurrenceCount : weeklyOccurrenceCount;
  const longestRepeatWeeks = Math.max(
    ...scheduleRules.map((rule) => getRuleOccurrenceCount(rule)),
    0,
  );
  const repeatingEstimatedEndDate =
    cycle === "daily"
      ? endDate
      : estimateWeeklyEndDate(startDate, scheduleRules.map((rule) => ({
          ...rule,
          repeatWeeks: getRuleOccurrenceCount(rule),
          dayOfWeek: rule.repeat
            ? rule.dayOfWeek
            : rule.specificDate
              ? toUtcDate(rule.specificDate).getUTCDay()
              : rule.dayOfWeek,
        })));
  const estimatedEndDate = repeatingEstimatedEndDate;
  const normalizedRules: FixedScheduleRule[] = scheduleRules.map((rule) => ({
    ...(rule.repeat && cycle === "weekly" ? { dayOfWeek: rule.dayOfWeek } : {}),
    ...(!rule.repeat ? { specificDate: rule.specificDate, dayOfWeek: rule.dayOfWeek } : {}),
    repeat: rule.repeat,
    repeatWeeks: getRuleOccurrenceCount(rule),
    repeatUntil: rule.repeatUntil,
    timeStart: rule.timeStart,
    timeEnd: rule.timeEnd,
  }));

  // ── Step 2 state ──
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("sepay");
  const {
    preview,
    occurrences,
    loadingPreview,
    loadingConfirm,
    fetchPreview,
    setOccurrenceAction,
    setCustomAction,
    checkSlot,
    confirmBooking,
  } = useFixedSchedule();

  // ── Fetch courts ──
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingCourts(true);
        const API =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
        const res = await fetch(`${API}/courts`);
        const data = await res.json();
        setCourts(Array.isArray(data) ? data : data.data || []);
      } catch {
        setCourts([]);
      } finally {
        setLoadingCourts(false);
      }
    };
    load();
  }, []);

  // ── Auto-fill từ user đang login ──
  useEffect(() => {
    if (!user || user.role === "guest") return;
    if (!customerName && user.fullName) setCustomerName(user.fullName);
    if (!customerPhone && user.phone) setCustomerPhone(user.phone);
    if (!customerEmail && user.email) setCustomerEmail(user.email);
  }, [user, customerName, customerPhone, customerEmail]);

  // ── Live total ──
  const liveTotal = (() => {
    if (!preview) return 0;
    const ph = preview.pricing.pricePerHour;
    return occurrences
      .filter((o) => o.action !== "skip")
      .reduce((sum, o) => {
        const ts =
          o.action === "custom"
            ? (o.customTimeStart ?? o.timeStart)
            : o.timeStart;
        const te =
          o.action === "custom" ? (o.customTimeEnd ?? o.timeEnd) : o.timeEnd;
        const sh = parseInt(ts.split(":")[0], 10);
        const eh = parseInt(te.split(":")[0], 10);
        if (Number.isNaN(sh) || Number.isNaN(eh) || eh <= sh) return sum;
        return sum + ph * (eh - sh);
      }, 0);
  })();

  // ── Validation ──
  const minimumWeeks = 4;
  const duplicateCheckEntries = scheduleRules.flatMap((rule) => {
    if (!rule.timeStart || !rule.timeEnd) return [];
    const startMinutes = toMinutes(rule.timeStart);
    const endMinutes = toMinutes(rule.timeEnd);
    if (endMinutes <= startMinutes) return [];
    const baseEntry = {
      ruleId: rule.id,
      repeat: rule.repeat,
      startMinutes,
      endMinutes,
    };

    if (!rule.repeat && rule.specificDate) {
      const firstDate = toUtcDate(rule.specificDate);
      return Array.from({ length: getRuleOccurrenceCount(rule) }, (_, index) => {
        const date = formatUtcDate(addUtcDays(firstDate, index * 7));
        return {
          ...baseEntry,
          key: date,
          label: `${formatDisplayDate(date)} ${rule.timeStart}-${rule.timeEnd}`,
        };
      });
    }

    if (cycle === "daily") {
      return [
        {
          ...baseEntry,
          key: "daily",
          label: `Mỗi ngày ${rule.timeStart}-${rule.timeEnd}`,
        },
      ];
    }

    if (startDate) {
      const firstDate = toUtcDate(getNextDateForDay(rule.dayOfWeek, startDate));
      return Array.from({ length: getRuleOccurrenceCount(rule) }, (_, index) => {
        const date = formatUtcDate(addUtcDays(firstDate, index * 7));
        return {
          ...baseEntry,
          key: date,
          label: `${formatDisplayDate(date)} ${rule.timeStart}-${rule.timeEnd}`,
        };
      });
    }

    const day = getDayMeta(rule.dayOfWeek);
    return [
      {
        ...baseEntry,
        key: `weekly-${rule.dayOfWeek}`,
        label: `${day.short} ${rule.timeStart}-${rule.timeEnd}`,
      },
    ];
  });
  const duplicateRuleIds = new Set<string>();
  const duplicateRuleMessages: string[] = [];
  const mergeSuggestions: Array<{
    fixedRuleId: string;
    oddRuleId: string;
    message: string;
  }> = [];

  duplicateCheckEntries.forEach((entry, index) => {
    duplicateCheckEntries.slice(index + 1).forEach((other) => {
      const isSameSlot = entry.key === other.key;
      const isOverlapping =
        entry.startMinutes < other.endMinutes &&
        other.startMinutes < entry.endMinutes;
      if (!isSameSlot || !isOverlapping) return;

      duplicateRuleIds.add(entry.ruleId);
      duplicateRuleIds.add(other.ruleId);
      const message = `${entry.label} trùng với ${other.label}`;
      if (!duplicateRuleMessages.includes(message)) {
        duplicateRuleMessages.push(message);
      }

      const isSameTimeRange =
        entry.startMinutes === other.startMinutes &&
        entry.endMinutes === other.endMinutes;
      if (entry.repeat !== other.repeat && isSameTimeRange) {
        const fixedEntry = entry.repeat ? entry : other;
        const oddEntry = entry.repeat ? other : entry;
        const mergeMessage = `Lịch cố định ${fixedEntry.label} đang chèn vào lịch lẻ ${oddEntry.label}. Nên hợp 2 lịch thành 1 lịch cố định để tránh đặt trùng.`;
        if (!mergeSuggestions.some((item) => item.fixedRuleId === fixedEntry.ruleId && item.oddRuleId === oddEntry.ruleId)) {
          mergeSuggestions.push({
            fixedRuleId: fixedEntry.ruleId,
            oddRuleId: oddEntry.ruleId,
            message: mergeMessage,
          });
        }
      }
    });
  });
  const hasDuplicateRule = duplicateRuleIds.size > 0;
  const hasMergeSuggestion = mergeSuggestions.length > 0;
  const rulesAreValid =
    scheduleRules.length > 0 &&
    scheduleRules.every(
      (rule) =>
        rule.dayOfWeek >= 0 &&
        rule.dayOfWeek <= 6 &&
        (rule.repeat || !!rule.specificDate) &&
        getRuleOccurrenceCount(rule) >= (rule.repeat ? minimumWeeks : 1) &&
        getRuleOccurrenceCount(rule) <= 52 &&
        toMinutes(rule.timeEnd) > toMinutes(rule.timeStart),
    ) &&
    !hasDuplicateRule;
  const isStep1Valid = !!(
    courtId &&
    startDate &&
    rulesAreValid &&
    (cycle === "daily"
      ? repeatingRules.length === 0 ||
        (endDate && getDateRangeDays(startDate, endDate) >= 2)
      : repeatingRules.length === 0 ||
        scheduleRules.every((rule) => getRuleOccurrenceCount(rule) >= (rule.repeat ? minimumWeeks : 1)))
  );
  const isStep2Valid = !!(
    customerName.trim() &&
    /^(0[3|5|7|8|9])+([0-9]{8})$/.test(customerPhone) &&
    paymentMethod
  );
  const hasBillableOccurrences = occurrences.some(
    (o) =>
      o.action === "keep" || o.action === "replace" || o.action === "custom",
  );
  const usesDateRangeMode = cycle === "daily" && repeatingRules.length > 0;

  // ── Handlers ──
  const setSharedFixedRepeatWeeks = (repeatWeeks: number) => {
    const safeWeeks = Math.min(
      52,
      Math.max(
        minimumWeeks,
        Number.isFinite(repeatWeeks) ? repeatWeeks : minimumWeeks,
      ),
    );
    setSharedRepeatWeeks(safeWeeks);
    setScheduleRules((current) =>
      current.map((rule) =>
        rule.repeat
          ? { ...rule, repeatWeeks: safeWeeks, repeatUntil: "weeks" }
          : rule,
      ),
    );
  };

  const handleFixedRepeatModeChange = (mode: FixedRepeatMode) => {
    setFixedRepeatMode(mode);
    if (mode === "shared") {
      setScheduleRules((current) =>
        current.map((rule) =>
          rule.repeat
            ? { ...rule, repeatWeeks: sharedRepeatWeeks, repeatUntil: "weeks" }
            : rule,
        ),
      );
    }
  };

  const addRule = (day: number) => {
    const sourceRule =
      scheduleRules.find((rule) => rule.id === activeRuleId) ?? scheduleRules[0];
    const newRule: ScheduleRuleState = {
      id: createRuleId(),
      dayOfWeek: day,
      repeat: true,
      repeatWeeks:
        fixedRepeatMode === "shared"
          ? sharedRepeatWeeks
          : sourceRule?.repeatWeeks ?? DEFAULT_REPEAT_WEEKS,
      repeatUntil: "weeks",
      timeStart: sourceRule?.timeStart ?? DEFAULT_RULE_TIME.timeStart,
      timeEnd: sourceRule?.timeEnd ?? DEFAULT_RULE_TIME.timeEnd,
    };
    setScheduleRules((current) => sortScheduleRules([...current, newRule]));
    setActiveRuleId(newRule.id);
  };

  const addBlankRule = () => {
    const selectedFixedDays = new Set(
      scheduleRules.filter((rule) => rule.repeat).map((rule) => rule.dayOfWeek),
    );
    const nextDay =
      DAY_LABELS.find((day) => !selectedFixedDays.has(day.value))?.value ??
      activeRule?.dayOfWeek ??
      2;
    const newRule: ScheduleRuleState = {
      id: createRuleId(),
      dayOfWeek: nextDay,
      repeat: true,
      repeatWeeks:
        fixedRepeatMode === "shared" ? sharedRepeatWeeks : DEFAULT_REPEAT_WEEKS,
      repeatUntil: "weeks",
      timeStart: "",
      timeEnd: "",
    };

    setScheduleRules((current) => sortScheduleRules([...current, newRule]));
    setActiveRuleId(newRule.id);
    setSlotSelectionNotice("");
  };

  const removeRule = (ruleId: string) => {
    const targetRule = scheduleRules.find((rule) => rule.id === ruleId);
    if (!targetRule) return;
    const next = sortScheduleRules(
      scheduleRules.filter(
        (rule) => !ruleHasSameScheduleTarget(rule, targetRule),
      ),
    );
    if (!next.length) {
      toast.error("Cần giữ ít nhất một khung giờ.");
      return;
    }
    setScheduleRules(next);
    if (scheduleRules.some((rule) => rule.id === activeRuleId && ruleHasSameScheduleTarget(rule, targetRule))) {
      setActiveRuleId(next[0].id);
    }
  };

  const mergeOddRuleIntoFixedRule = (fixedRuleId: string, oddRuleId: string) => {
    const fixedRule = scheduleRules.find((rule) => rule.id === fixedRuleId);
    const oddRule = scheduleRules.find((rule) => rule.id === oddRuleId);
    if (!fixedRule || !oddRule || !oddRule.specificDate) return;

    let mergedRepeatWeeks = Math.max(
      getRuleOccurrenceCount(fixedRule),
      getRuleOccurrenceCount(oddRule),
    );
    if (startDate) {
      const fixedStart = toUtcDate(getNextDateForDay(fixedRule.dayOfWeek, startDate));
      const oddEnd = addUtcDays(toUtcDate(oddRule.specificDate), (getRuleOccurrenceCount(oddRule) - 1) * 7);
      const weeksToCoverOddEnd =
        Math.floor((oddEnd.getTime() - fixedStart.getTime()) / (7 * 86400000)) + 1;
      mergedRepeatWeeks = Math.max(mergedRepeatWeeks, weeksToCoverOddEnd);
    }

    mergedRepeatWeeks = Math.min(52, Math.max(minimumWeeks, mergedRepeatWeeks));
    if (fixedRepeatMode === "shared") {
      setSharedRepeatWeeks(mergedRepeatWeeks);
    }
    setScheduleRules((current) =>
      sortScheduleRules(
        current
          .filter((rule) => rule.id !== oddRuleId)
          .map((rule) =>
            fixedRepeatMode === "shared" && rule.repeat
              ? {
                  ...rule,
                  repeat: true,
                  repeatUntil: "weeks",
                  repeatWeeks: mergedRepeatWeeks,
                  timeStart:
                    rule.id === fixedRuleId
                      ? fixedRule.timeStart || oddRule.timeStart
                      : rule.timeStart,
                  timeEnd:
                    rule.id === fixedRuleId
                      ? fixedRule.timeEnd || oddRule.timeEnd
                      : rule.timeEnd,
                }
              : rule.id === fixedRuleId
                ? {
                    ...rule,
                    repeat: true,
                    repeatUntil: "weeks",
                    repeatWeeks: mergedRepeatWeeks,
                    timeStart: fixedRule.timeStart || oddRule.timeStart,
                    timeEnd: fixedRule.timeEnd || oddRule.timeEnd,
                  }
                : rule,
          ),
      ),
    );
    setActiveRuleId(fixedRuleId);
    toast.success("Đã hợp lịch lẻ vào lịch cố định.");
  };

  const toggleSelectedDay = (day: number) => {
    const rulesOfDay = scheduleRules.filter(
      (rule) => rule.repeat && rule.dayOfWeek === day,
    );
    if (rulesOfDay.length > 0) {
      const oddSpecificDate = getNextDateForDay(day, startDate || today);
      const existingOddRule = scheduleRules.find(
        (rule) => !rule.repeat && rule.specificDate === oddSpecificDate,
      );

      if (existingOddRule) {
        setActiveRuleId(existingOddRule.id);
        setSlotSelectionNotice("Đang chỉnh lịch lẻ cho thứ này. Khung giờ cố định đã được bôi đen.");
        return;
      }

      const newOddRule: ScheduleRuleState = {
        id: createRuleId(),
        dayOfWeek: day,
        repeat: false,
        specificDate: oddSpecificDate,
        repeatWeeks: 1,
        repeatUntil: "weeks",
        timeStart: "",
        timeEnd: "",
      };

      setScheduleRules((current) => sortScheduleRules([...current, newOddRule]));
      setActiveRuleId(newOddRule.id);
      setSlotSelectionNotice(
        `${getDayMeta(day).label} đã có lịch cố định. Hãy chọn lịch lẻ ở khung giờ khác; khung cố định đang được bôi đen.`,
      );
      return;
    }
    addRule(day);
  };

  const setRuleRepeatWeeks = (ruleId: string, repeatWeeks: number) => {
    const targetRule = scheduleRules.find((rule) => rule.id === ruleId);
    if (!targetRule) return;
    setScheduleRules((current) =>
      current.map((rule) => {
        if (!ruleHasSameScheduleTarget(rule, targetRule)) return rule;
        const minWeeks = rule.repeat ? minimumWeeks : 1;
        const safeWeeks = Math.min(
          52,
          Math.max(minWeeks, Number.isFinite(repeatWeeks) ? repeatWeeks : minWeeks),
        );
        return { ...rule, repeatWeeks: safeWeeks, repeatUntil: "weeks" };
      }),
    );
  };

  const setRuleRepeatMode = (ruleId: string, repeat: boolean) => {
    const targetRule = scheduleRules.find((rule) => rule.id === ruleId);
    if (!targetRule) return;
    setScheduleRules((current) =>
      sortScheduleRules(
        current.map((rule) => {
          if (!ruleHasSameScheduleTarget(rule, targetRule)) return rule;
          if (repeat) {
            return {
              ...rule,
              repeat: true,
              specificDate: undefined,
              repeatUntil: "weeks",
              repeatWeeks:
                fixedRepeatMode === "shared"
                  ? sharedRepeatWeeks
                  : Math.max(minimumWeeks, rule.repeatWeeks),
            };
          }

          const specificDate =
            rule.specificDate || getNextDateForDay(rule.dayOfWeek, startDate || today);
          return {
            ...rule,
            repeat: false,
            specificDate,
            dayOfWeek: toUtcDate(specificDate).getUTCDay(),
            repeatUntil: rule.repeatUntil ?? "weeks",
            repeatWeeks: Math.max(1, rule.repeatWeeks),
          };
        }),
      ),
    );
  };

  const setRuleSpecificDate = (ruleId: string, specificDate: string) => {
    if (!specificDate) return;
    const targetRule = scheduleRules.find((rule) => rule.id === ruleId);
    if (!targetRule) return;
    setScheduleRules((current) =>
      sortScheduleRules(
        current.map((rule) =>
          ruleHasSameScheduleTarget(rule, targetRule)
            ? {
                ...rule,
                specificDate,
                dayOfWeek: toUtcDate(specificDate).getUTCDay(),
              }
            : rule,
        ),
      ),
    );
  };

  const setRuleRepeatUntil = (
    ruleId: string,
    repeatUntil: ScheduleRuleState["repeatUntil"],
  ) => {
    const targetRule = scheduleRules.find((rule) => rule.id === ruleId);
    if (!targetRule) return;
    setScheduleRules((current) =>
      current.map((rule) =>
        ruleHasSameScheduleTarget(rule, targetRule)
          ? { ...rule, repeatUntil }
          : rule,
      ),
    );
  };

  const ruleHasSameScheduleTarget = (
    rule: ScheduleRuleState,
    target: ScheduleRuleState,
  ) => {
    if (rule.repeat !== target.repeat) return false;
    if (rule.repeat) {
      return cycle === "daily" || rule.dayOfWeek === target.dayOfWeek;
    }
    return rule.specificDate && target.specificDate
      ? rule.specificDate === target.specificDate
      : rule.dayOfWeek === target.dayOfWeek;
  };

  const scheduleRuleGroups = scheduleRules.reduce<
    Array<{ key: string; primaryRule: ScheduleRuleState; rules: ScheduleRuleState[] }>
  >((groups, rule) => {
    const existingGroup = groups.find((group) =>
      ruleHasSameScheduleTarget(rule, group.primaryRule),
    );
    if (existingGroup) {
      existingGroup.rules.push(rule);
      existingGroup.rules = sortScheduleRules(existingGroup.rules);
      return groups;
    }

    groups.push({
      key: `${rule.repeat ? "fixed" : "odd"}-${rule.specificDate ?? rule.dayOfWeek}`,
      primaryRule: rule,
      rules: [rule],
    });
    return groups;
  }, []);

  const getBlockingFixedRuleForSlot = (
    rule: ScheduleRuleState | undefined,
    slot: Pick<TimeSlot, "start" | "end">,
  ) => {
    return getBlockingFixedRuleForRange(rule, slot.start, slot.end);
  };

  const getBlockingFixedRuleForRange = (
    rule: ScheduleRuleState | undefined,
    timeStart: string,
    timeEnd: string,
  ) => {
    if (!rule || rule.repeat || !timeStart || !timeEnd) return undefined;
    const startMinutes = toMinutes(timeStart);
    const endMinutes = toMinutes(timeEnd);
    return scheduleRules.find(
      (candidate) => {
        if (!candidate.repeat || candidate.dayOfWeek !== rule.dayOfWeek) {
          return false;
        }
        return (
          startMinutes < toMinutes(candidate.timeEnd) &&
          toMinutes(candidate.timeStart) < endMinutes
        );
      },
    );
  };

  const handleSelectRuleSlot = (
    ruleId: string | undefined,
    timeStart: string,
    timeEnd: string,
  ) => {
    if (!ruleId) {
      toast.error("Vui lòng chọn ngày trước khi chọn giờ.");
      return;
    }

    const currentRule = scheduleRules.find((rule) => rule.id === ruleId);
    if (!currentRule) {
      toast.error("Vui lòng chọn ngày trước khi chọn giờ.");
      return;
    }

    setSlotSelectionNotice("");

    const blockingFixedRule = getBlockingFixedRuleForSlot(currentRule, {
      start: timeStart,
      end: timeEnd,
    });
    if (blockingFixedRule) {
      setSlotSelectionNotice(
        `Khung ${timeStart} - ${timeEnd} đã thuộc lịch cố định ${blockingFixedRule.timeStart} - ${blockingFixedRule.timeEnd}. Vui lòng chọn giờ khác cho lịch lẻ.`,
      );
      return;
    }

    const targetRules = scheduleRules.filter((rule) =>
      ruleHasSameScheduleTarget(rule, currentRule),
    );
    const selectedSlotKeys = new Set<string>();
    targetRules.forEach((rule) => {
      getRuleSlotKeys(rule).forEach((key) => selectedSlotKeys.add(key));
    });

    const clickedSlot = { start: timeStart, end: timeEnd };
    const clickedSlotKey = getSlotKey(clickedSlot);
    if (selectedSlotKeys.has(clickedSlotKey)) {
      selectedSlotKeys.delete(clickedSlotKey);
    } else {
      selectedSlotKeys.add(clickedSlotKey);
    }

    const nextRanges = buildRangesFromSlotKeys(selectedSlotKeys);
    const otherRules = scheduleRules.filter(
      (rule) => !ruleHasSameScheduleTarget(rule, currentRule),
    );

    if (nextRanges.length === 0) {
      if (otherRules.length === 0) {
        const blankRule = { ...currentRule, timeStart: "", timeEnd: "" };
        setScheduleRules([blankRule]);
        setActiveRuleId(blankRule.id);
        return;
      }

      const nextRules = sortScheduleRules(otherRules);
      setScheduleRules(nextRules);
      setActiveRuleId(nextRules[0].id);
      return;
    }

    const usedRuleIds = new Set(otherRules.map((rule) => rule.id));
    const createUniqueRuleId = () => {
      let id = createRuleId();
      while (usedRuleIds.has(id)) id = createRuleId();
      return id;
    };
    const nextTargetRules = nextRanges.map((range, index) => {
      const existingRule =
        targetRules.find(
          (rule) =>
            !usedRuleIds.has(rule.id) &&
            rule.timeStart === range.timeStart && rule.timeEnd === range.timeEnd,
        ) ??
        targetRules.find((rule) => !usedRuleIds.has(rule.id)) ??
        targetRules[index];
      const baseRule = existingRule ?? currentRule;
      const nextId =
        existingRule && !usedRuleIds.has(existingRule.id)
          ? existingRule.id
          : createUniqueRuleId();
      usedRuleIds.add(nextId);

      return {
        ...baseRule,
        id: nextId,
        timeStart: range.timeStart,
        timeEnd: range.timeEnd,
        repeatWeeks:
          baseRule.repeat && fixedRepeatMode === "shared"
            ? sharedRepeatWeeks
            : baseRule.repeatWeeks,
        repeatUntil: baseRule.repeat ? "weeks" : baseRule.repeatUntil,
      };
    });

    const nextRules = sortScheduleRules([...otherRules, ...nextTargetRules]);
    setScheduleRules(nextRules);

    const clickedStart = toMinutes(timeStart);
    const nextActiveRule =
      nextTargetRules.find((rule) =>
        slotIsInsideRange(clickedSlot, rule.timeStart, rule.timeEnd),
      ) ??
      nextTargetRules.find((rule) => toMinutes(rule.timeStart) >= clickedStart) ??
      nextTargetRules[0];
    setActiveRuleId(nextActiveRule.id);
  };

  const handleSelectCustomRuleTime = (
    ruleId: string | undefined,
    timeStart: string,
    timeEnd: string,
  ) => {
    if (!ruleId) {
      toast.error("Vui lòng chọn ngày trước khi chọn giờ.");
      return;
    }
    const currentRule = scheduleRules.find((rule) => rule.id === ruleId);
    const blockingFixedRule = getBlockingFixedRuleForRange(
      currentRule,
      timeStart,
      timeEnd,
    );
    if (blockingFixedRule) {
      setSlotSelectionNotice(
        `Khung ${timeStart} - ${timeEnd} đang trùng lịch cố định ${blockingFixedRule.timeStart} - ${blockingFixedRule.timeEnd}.`,
      );
      return;
    }

    setSlotSelectionNotice("");
    setScheduleRules((current) =>
      current.map((rule) =>
        rule.id === ruleId
          ? { ...rule, timeStart, timeEnd }
          : rule,
      ),
    );
  };

  const resetActiveRuleSlots = () => {
    if (!activeRule) return;
    setSlotSelectionNotice("");
    setScheduleRules((current) =>
      current.map((rule) =>
        rule.id === activeRule.id ? { ...rule, timeStart: "", timeEnd: "" } : rule,
      ),
    );
  };

  const buildSchedulePayload = () => ({
    courtId: parseInt(courtId),
    cycle,
    bookingMode: usesDateRangeMode ? DATE_RANGE_BOOKING_MODE : FIXED_BOOKING_MODE,
    startDate,
    ...(usesDateRangeMode ? { endDate } : { occurrenceCount }),
    rules: normalizedRules,
    timeStart,
    timeEnd,
  });

  const handlePreview = async () => {
    if (hasDuplicateRule) {
      toast.error("Có buổi bị trùng. Vui lòng đổi ngày/giờ hoặc xóa khung trùng.");
      return;
    }
    if (!isStep1Valid) {
      toast.error("Vui lòng điền đầy đủ thông tin!");
      return;
    }

    const ok = await fetchPreview(buildSchedulePayload());
    if (ok) setStep(2);
  };

  const handleConfirm = async () => {
    if (!isStep2Valid || !preview) {
      toast.error("Vui lòng điền đầy đủ thông tin!");
      return;
    }
    if (!hasBillableOccurrences) {
      toast.error("Phải có ít nhất 1 buổi được giữ!");
      return;
    }

    const decisions = occurrences.map((occ) => ({
      date: occ.date,
      timeStart: occ.timeStart,
      timeEnd: occ.timeEnd,
      action: occ.action,
      ...(occ.action === "replace" && occ.selectedReplacement
        ? { replaceWithCourtId: occ.selectedReplacement.courtId }
        : {}),
      ...(occ.action === "custom"
        ? {
            replaceWithCourtId: occ.customCourtId,
            customDate: occ.customDate,
            customTimeStart: occ.customTimeStart,
            customTimeEnd: occ.customTimeEnd,
          }
        : {}),
    }));

    const result = await confirmBooking({
      ...buildSchedulePayload(),
      customerName,
      customerPhone,
      customerEmail: customerEmail || undefined,
      paymentMethod,
      decisions,
    });

    if (result) {
      const checkout = {
        fixedSchedule: {
          id: result.scheduleId,
          courtName:
            courts.find((c) => c.id === parseInt(courtId))?.name || "Sân",
          cycle,
          bookingMode: usesDateRangeMode ? DATE_RANGE_BOOKING_MODE : FIXED_BOOKING_MODE,
          startDate,
          endDate: preview.endDate,
          occurrenceCount: result.bookingsCreated,
          invoiceCode: result.invoiceCode,
          totalAmount: result.totalAmount,
        },
        invoiceId: result.invoiceId,
        invoiceCode: result.invoiceCode,
        totalAmount: result.totalAmount,
        bookingsCreated: result.bookingsCreated,
        paymentMethod: result.paymentMethod || paymentMethod,
        paymentStatus: "pending",
        checkinQrValue: result.invoiceCode,
      };

      if (["sepay", "vnpay", "momo"].includes(paymentMethod)) {
        try {
          const payResult = await paymentApi.create(
            result.invoiceId,
            paymentMethod as "sepay" | "vnpay" | "momo",
          );

          if (payResult.success && payResult.paymentId) {
            Object.assign(checkout, {
              paymentId: payResult.paymentId,
              qrImageUrl: payResult.qrImageUrl,
              bankCode: payResult.bankCode,
              accountNumber: payResult.accountNumber,
              transferContent: payResult.transferContent,
            });

            localStorage.setItem(
              FIXED_CHECKOUT_STORAGE_KEY,
              JSON.stringify(checkout),
            );
            localStorage.setItem(
              `${FIXED_CHECKOUT_STORAGE_KEY}:${result.scheduleId}`,
              JSON.stringify(checkout),
            );

            if (payResult.payUrl) {
              window.location.href = payResult.payUrl;
              return;
            }

            if (payResult.checkoutUrl && payResult.formFields) {
              submitPaymentForm(payResult.checkoutUrl, payResult.formFields);
              return;
            }
          }

          Object.assign(checkout, {
            paymentError:
              payResult.error ||
              "Không thể tạo phiên thanh toán online. Lịch vẫn được giữ để nhân viên xử lý.",
          });
        } catch (error: any) {
          Object.assign(checkout, {
            paymentError:
              error?.message ||
              "Không thể tạo phiên thanh toán online. Lịch vẫn được giữ để nhân viên xử lý.",
          });
        }
      }

      localStorage.setItem(
        FIXED_CHECKOUT_STORAGE_KEY,
        JSON.stringify(checkout),
      );
      localStorage.setItem(
        `${FIXED_CHECKOUT_STORAGE_KEY}:${result.scheduleId}`,
        JSON.stringify(checkout),
      );
      router.push(`/booking/success?id=${result.scheduleId}`);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div
      data-cycle-label={formatCycleLabel(cycle)}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/20 to-emerald-50/30"
    >
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 xl:px-6">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-600 transition-colors group"
          >
            <Home className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Trang chủ</span>
          </button>

          {/* Stepper */}
          <div className="flex items-center gap-3">
            {(["Chọn lịch", "Xác nhận"] as const).map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="h-4 w-4 text-gray-300" />}
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                      i + 1 === step
                        ? "bg-green-600 text-white shadow-md shadow-green-600/30"
                        : i + 1 < step
                          ? "bg-green-100 text-green-600"
                          : "bg-gray-100 text-gray-400",
                    )}
                  >
                    {i + 1 < step ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium hidden sm:inline",
                      i + 1 === step ? "text-green-600" : "text-gray-400",
                    )}
                  >
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {step === 2 ? (
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Quay lại</span>
            </button>
          ) : (
            <button
              onClick={() => router.push("/courts")}
              className="text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              Hủy
            </button>
          )}
        </div>
      </div>

      {/* ── Page header ── */}
      <div className="mx-auto max-w-[1600px] px-4 pt-8 pb-4 xl:px-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-3">
            <Sparkles className="h-3.5 w-3.5" /> Đặt sân cố định
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Lịch đặt sân cố định
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Đặt sân định kỳ theo tuần — không lo hết chỗ
          </p>
        </motion.div>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-[1600px] px-4 pb-24 xl:px-6">
        <AnimatePresence mode="wait">
          {/* ════════ STEP 1 ════════ */}
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25 }}
              className="mx-auto w-full space-y-4"
            >
              {/* Chọn sân */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
                <div>
                  <div className="inline-flex h-7 items-center gap-2 rounded-full bg-green-50 px-3 text-xs font-bold uppercase tracking-wide text-green-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[11px] text-white">
                      1
                    </span>
                    Sân chơi
                  </div>
                  <h2 className="mt-2 flex items-center gap-2 font-semibold text-gray-900">
                    <MapPin className="h-4 w-4 text-green-600" /> Chọn sân
                  </h2>
                </div>
                {loadingCourts ? (
                  <div className="h-11 bg-gray-100 animate-pulse rounded-xl" />
                ) : (
                  <select
                    value={courtId}
                    onChange={(e) => setCourtId(e.target.value)}
                    className="w-full h-11 px-3.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                  >
                    <option value="">-- Chọn sân cầu lông --</option>
                    {courts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.type} · {c.price.toLocaleString("vi-VN")}
                        đ/giờ
                      </option>
                    ))}
                  </select>
                )}
                </div>
              </div>

              {/* Thời gian */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex h-7 items-center gap-2 rounded-full bg-green-50 px-3 text-xs font-bold uppercase tracking-wide text-green-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[11px] text-white">
                        2
                      </span>
                      Thời gian
                    </div>
                    <h2 className="mt-2 flex items-center gap-2 font-semibold text-gray-900">
                      <Calendar className="h-4 w-4 text-green-600" /> Thiết lập lịch
                    </h2>
                  </div>
                  <div className="rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500">
                    {occurrenceCount > 0 ? `${occurrenceCount} buổi dự kiến` : "Chưa có buổi"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-2">
                  {[
                    {
                      value: "weekly" as FixedScheduleCycle,
                      label: "Lặp theo tuần",
                      desc: "Chọn thứ và khung giờ cố định",
                    },
                    {
                      value: "daily" as FixedScheduleCycle,
                      label: "Lặp theo ngày",
                      desc: "Từ ngày đến ngày, ngày nào cũng có lịch",
                    },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCycle(option.value)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all",
                        cycle === option.value
                          ? "border-green-600 bg-white text-green-700 shadow-sm"
                          : "border-gray-200 bg-white text-gray-500 hover:border-green-300",
                      )}
                    >
                      <p className="text-sm font-bold">{option.label}</p>
                      <p className="mt-0.5 text-xs">{option.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(620px,0.9fr)] xl:items-start">
                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 repeat-day-rules">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        3. Ngày và buổi chơi
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        Chọn thứ, lịch cố định hoặc lịch lẻ
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-500">
                      {scheduleRuleGroups.length} thẻ lịch
                    </span>
                  </div>
                  <div className={cn("grid grid-cols-7 gap-1.5", cycle === "daily" && "hidden")}>
                    {DAY_LABELS.map((day) => {
                      const isSelected = selectedDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleSelectedDay(day.value)}
                          title={day.label}
                          className={cn(
                            "h-11 rounded-xl border text-sm font-semibold transition-all",
                            isSelected
                              ? "border-green-600 bg-green-600 text-white shadow-sm shadow-green-600/20"
                              : "border-gray-200 bg-white text-gray-500 hover:border-green-300 hover:text-green-700",
                          )}
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Chọn một hoặc nhiều ngày. Bấm lại vào thứ đã có lịch cố định để thêm lịch lẻ không trùng giờ.
                  </p>
                  {scheduleRuleGroups.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {scheduleRuleGroups.map((group) => {
                        const rule = group.primaryRule;
                        const groupRules = group.rules;
                        const day = getDayMeta(rule.dayOfWeek);
                        const active = groupRules.some(
                          (item) => item.id === activeRuleId,
                        );
                        const ruleWeeks = getRuleOccurrenceCount(rule);
                        const duplicated = groupRules.some((item) =>
                          duplicateRuleIds.has(item.id),
                        );
                        const displayDate = rule.specificDate
                          ? formatDisplayDate(rule.specificDate)
                          : "";
                        const timeLabel = groupRules
                          .filter((r) => r.timeStart && r.timeEnd)
                          .map((r) => `${r.timeStart}-${r.timeEnd}`)
                          .join(", ") || "Chưa chọn giờ";
                        return (
                          <button
                            key={group.key}
                            type="button"
                            onClick={() => setActiveRuleId(rule.id)}
                            className={cn(
                              "group flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-all",
                              duplicated
                                ? "border-red-400 bg-red-50 text-red-700 shadow-sm shadow-red-500/10"
                                : active
                                ? "border-green-600 bg-green-600 text-white shadow-md shadow-green-600/20"
                                : "border-gray-200 bg-white text-gray-600 hover:border-green-300 hover:text-green-700 hover:shadow-sm",
                            )}
                          >
                            <span className="font-bold">
                              {!rule.repeat && displayDate
                                ? displayDate
                                : cycle === "daily"
                                  ? "Mỗi ngày"
                                  : day.short}
                            </span>
                            <span className={cn("text-[11px]", active ? "text-green-100" : "text-gray-400")}>
                              {timeLabel}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                                active
                                  ? "bg-white/20 text-white"
                                  : rule.repeat
                                    ? "bg-green-50 text-green-600"
                                    : "bg-purple-50 text-purple-600",
                              )}
                            >
                              {rule.repeat ? `${ruleWeeks}w` : "Lẻ"}
                            </span>
                            {duplicated && <AlertCircle className="h-3 w-3 text-red-500" />}
                            <span
                              onClick={(e) => { e.stopPropagation(); removeRule(rule.id); }}
                              className={cn(
                                "ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] transition-colors",
                                active
                                  ? "text-green-200 hover:bg-white/20 hover:text-white"
                                  : "text-gray-300 hover:bg-red-50 hover:text-red-500",
                              )}
                              title="Xóa"
                            >
                              <X className="h-3 w-3" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Active rule detail panel — expands inline */}
                  {activeRule && (
                    <div className="mt-3 rounded-xl border border-green-200 bg-green-50/50 p-3 space-y-3 text-xs">
                      {(() => {
                        const rule = activeRule;
                        const groupRules = scheduleRules.filter((r) =>
                          ruleHasSameScheduleTarget(r, rule),
                        );
                        const ruleWeeks = getRuleOccurrenceCount(rule);
                        const minRuleWeeks = rule.repeat ? minimumWeeks : 1;
                        const totalGroupOccurrences = groupRules.reduce(
                          (sum, item) => sum + getRuleOccurrenceCount(item),
                          0,
                        );
                        const usesSharedFixedRepeat =
                          cycle === "weekly" &&
                          rule.repeat &&
                          fixedRepeatMode === "shared";
                        const weekControlLocked =
                          usesSharedFixedRepeat ||
                          (!rule.repeat && rule.repeatUntil === "month_end");
                        const mergeSuggestion = mergeSuggestions.find(
                          (item) =>
                            groupRules.some(
                              (groupRule) =>
                                item.fixedRuleId === groupRule.id ||
                                item.oddRuleId === groupRule.id,
                            ),
                        );
                        const displayDate = rule.specificDate
                          ? formatDisplayDate(rule.specificDate)
                          : "";
                        const oddRuleDates =
                          !rule.repeat && rule.specificDate
                            ? getWeeklyDateSequence(rule.specificDate, ruleWeeks)
                            : [];
                        const visibleOddRuleDates = oddRuleDates.slice(0, 8);
                        const hiddenOddRuleDateCount = Math.max(
                          0,
                          oddRuleDates.length - visibleOddRuleDates.length,
                        );

                        return (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">
                                  {!rule.repeat && displayDate
                                    ? displayDate.slice(0, 5)
                                    : cycle === "daily"
                                      ? "∞"
                                      : getDayMeta(rule.dayOfWeek).short}
                                </span>
                                <span className="font-bold text-gray-900">
                                  {!rule.repeat && displayDate
                                    ? `Lịch lẻ · ${displayDate}`
                                    : cycle === "daily"
                                      ? "Mỗi ngày"
                                      : getDayMeta(rule.dayOfWeek).label}
                                </span>
                              </div>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-green-700">
                                {groupRules.length} buổi · {ruleWeeks} tuần · {totalGroupOccurrences} lượt
                              </span>
                            </div>

                            {/* Time slots within this group */}
                            {groupRules.length > 1 && (
                              <div className="flex flex-wrap gap-1.5">
                                {groupRules.map((timeRule, index) => (
                                  <button
                                    key={`${timeRule.id}-${timeRule.timeStart}-${timeRule.timeEnd}`}
                                    type="button"
                                    onClick={() => setActiveRuleId(timeRule.id)}
                                    className={cn(
                                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                                      activeRuleId === timeRule.id
                                        ? "border-green-500 bg-white text-green-700 shadow-sm"
                                        : "border-green-200 bg-white/80 text-gray-600 hover:border-green-400",
                                    )}
                                  >
                                    Buổi {index + 1}:{" "}
                                    {timeRule.timeStart && timeRule.timeEnd
                                      ? `${timeRule.timeStart}-${timeRule.timeEnd}`
                                      : "Chưa chọn"}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Compact settings row */}
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {/* Type toggle */}
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Loại</p>
                                <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-gray-100 p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setRuleRepeatMode(rule.id, true)}
                                    className={cn(
                                      "h-7 rounded-md text-[11px] font-semibold transition-all",
                                      rule.repeat
                                        ? "bg-white text-green-700 shadow-sm"
                                        : "text-gray-400 hover:text-gray-600",
                                    )}
                                  >
                                    CĐ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRuleRepeatMode(rule.id, false)}
                                    className={cn(
                                      "h-7 rounded-md text-[11px] font-semibold transition-all",
                                      !rule.repeat
                                        ? "bg-white text-purple-700 shadow-sm"
                                        : "text-gray-400 hover:text-gray-600",
                                    )}
                                  >
                                    Lẻ
                                  </button>
                                </div>
                              </div>

                              {/* Week count */}
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Số tuần</p>
                                <div className={cn("flex items-center gap-1", weekControlLocked && "pointer-events-none opacity-50")}>
                                  <button
                                    type="button"
                                    onClick={() => setRuleRepeatWeeks(rule.id, rule.repeatWeeks - 1)}
                                    className="h-7 w-7 shrink-0 rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-400 hover:text-green-700 disabled:opacity-30"
                                    disabled={weekControlLocked || rule.repeatWeeks <= minRuleWeeks}
                                  >-</button>
                                  <input
                                    type="number"
                                    min={minRuleWeeks}
                                    max={52}
                                    value={weekControlLocked ? ruleWeeks : rule.repeatWeeks}
                                    onChange={(e) => setRuleRepeatWeeks(rule.id, Number(e.target.value))}
                                    disabled={weekControlLocked}
                                    className="h-7 min-w-0 flex-1 rounded-md border border-gray-200 px-1 text-center text-xs font-bold text-gray-700 focus:border-green-500 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setRuleRepeatWeeks(rule.id, rule.repeatWeeks + 1)}
                                    className="h-7 w-7 shrink-0 rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-400 hover:text-green-700 disabled:opacity-30"
                                    disabled={weekControlLocked || rule.repeatWeeks >= 52}
                                  >+</button>
                                </div>
                              </div>

                              {/* Specific date for odd rules */}
                              {!rule.repeat && (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ngày BĐ</p>
                                  <input
                                    type="date"
                                    value={rule.specificDate || ""}
                                    min={startDate || today}
                                    onChange={(e) => setRuleSpecificDate(rule.id, e.target.value)}
                                    className="h-7 w-full rounded-md border border-gray-200 bg-white px-2 text-[11px] font-semibold text-gray-700 focus:border-green-500 focus:outline-none"
                                  />
                                </div>
                              )}

                              {/* Repeat until for odd rules */}
                              {!rule.repeat && (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Phạm vi</p>
                                  <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-gray-100 p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => setRuleRepeatUntil(rule.id, "weeks")}
                                      className={cn(
                                        "h-7 rounded-md text-[10px] font-semibold transition-all",
                                        rule.repeatUntil === "weeks"
                                          ? "bg-white text-green-700 shadow-sm"
                                          : "text-gray-400 hover:text-gray-600",
                                      )}
                                    >
                                      Tuần
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRuleRepeatUntil(rule.id, "month_end")}
                                      className={cn(
                                        "h-7 rounded-md text-[10px] font-semibold transition-all",
                                        rule.repeatUntil === "month_end"
                                          ? "bg-white text-green-700 shadow-sm"
                                          : "text-gray-400 hover:text-gray-600",
                                      )}
                                    >
                                      Tháng
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Odd rule dates preview */}
                            {!rule.repeat && rule.specificDate && visibleOddRuleDates.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">Ngày đặt:</span>
                                {visibleOddRuleDates.map((date, index) => (
                                  <span
                                    key={`${rule.id}-${date}`}
                                    className={cn(
                                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                      index === 0
                                        ? "border-purple-300 bg-white text-purple-700"
                                        : "border-purple-100 bg-white/80 text-gray-500",
                                    )}
                                  >
                                    {formatDisplayDate(date)}
                                  </span>
                                ))}
                                {hiddenOddRuleDateCount > 0 && (
                                  <span className="text-[10px] text-gray-400">+{hiddenOddRuleDateCount}</span>
                                )}
                              </div>
                            )}

                            {/* Merge suggestion */}
                            {mergeSuggestion && (
                              <button
                                type="button"
                                onClick={() =>
                                  mergeOddRuleIntoFixedRule(
                                    mergeSuggestion.fixedRuleId,
                                    mergeSuggestion.oddRuleId,
                                  )
                                }
                                className="h-8 w-full rounded-lg border border-amber-200 bg-amber-50 text-xs font-bold text-amber-700 hover:bg-amber-100"
                              >
                                Hợp lịch lẻ vào lịch cố định
                              </button>
                            )}

                            <p className="text-[10px] text-gray-400">
                              {usesSharedFixedRepeat
                                ? "Dùng số tuần lặp chung."
                                : rule.repeat
                                  ? `Min ${minimumWeeks} · Max 52 tuần.`
                                  : rule.repeatUntil === "month_end" && rule.specificDate
                                    ? `Đến ${formatDisplayDate(getMonthEndDate(rule.specificDate))}.`
                                    : "1–52 tuần."}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {hasDuplicateRule && (
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-xl border px-3 py-3 text-sm",
                        hasMergeSuggestion
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-red-200 bg-red-50 text-red-700",
                      )}
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="space-y-2">
                        <p className="font-semibold">
                          {hasMergeSuggestion
                            ? "Lịch cố định đang chèn vào lịch lẻ."
                            : "Có buổi bị trùng trong danh sách khung giờ."}
                        </p>
                        <div className="space-y-0.5 text-xs">
                          {(hasMergeSuggestion ? mergeSuggestions.map((item) => item.message) : duplicateRuleMessages)
                            .slice(0, 3)
                            .map((message) => (
                            <p key={message}>{message}</p>
                          ))}
                          {duplicateRuleMessages.length > 3 && !hasMergeSuggestion && (
                            <p>
                              Và {duplicateRuleMessages.length - 3} buổi trùng khác.
                            </p>
                          )}
                        </div>
                        {hasMergeSuggestion && (
                          <button
                            type="button"
                            onClick={() =>
                              mergeOddRuleIntoFixedRule(
                                mergeSuggestions[0].fixedRuleId,
                                mergeSuggestions[0].oddRuleId,
                              )
                            }
                            className="h-9 rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100"
                          >
                            Hợp lịch lẻ vào lịch cố định
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={addBlankRule}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-green-300 bg-green-50 px-4 py-3 text-sm font-bold text-green-700 transition-all hover:border-green-500 hover:bg-green-100"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm lịch trống để tự thiết lập
                  </button>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                  {/* Context header — prominent banner */}
                  <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 text-white shadow-md shadow-green-600/20">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-green-100">Đang chỉnh khung giờ cho</p>
                      <p className="text-sm font-bold truncate">
                        {activeRule
                          ? !activeRule.repeat && activeRule.specificDate
                            ? `Lịch lẻ · ${formatDisplayDate(activeRule.specificDate)}`
                            : cycle === "daily"
                            ? "Mỗi ngày"
                            : getDayMeta(activeRule.dayOfWeek).label
                          : "Chưa chọn ngày"}
                      </p>
                    </div>
                    {activeRule?.timeStart && activeRule?.timeEnd && (
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
                          {activeRule.timeStart} – {activeRule.timeEnd}
                        </span>
                        <button
                          type="button"
                          onClick={resetActiveRuleSlots}
                          className="rounded-full bg-white/10 p-1 hover:bg-white/20 transition-colors"
                          title="Chọn lại giờ"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {slotSelectionNotice && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{slotSelectionNotice}</span>
                    </div>
                  )}

                  {/* Session tabs */}
                  <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                    {TIME_SESSIONS.map((session) => {
                      const isActive = session.color === activeSession;
                      const hasSelectedSlots = activeRule && rangesIntersect(
                        activeRule.timeStart,
                        activeRule.timeEnd,
                        session.slots,
                      );
                      const SessionIcon = session.color === "amber" ? Sun : session.color === "blue" ? Sunset : Moon;
                      return (
                        <button
                          key={session.label}
                          type="button"
                          onClick={() => setActiveSession(session.color)}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-all",
                            isActive
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-400 hover:text-gray-600",
                          )}
                        >
                          <SessionIcon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{session.label.replace(/^[^\s]+\s/, "")}</span>
                          <span className="sm:hidden">{session.range.split(" – ")[0]}</span>
                          {hasSelectedSlots && (
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              isActive ? "bg-green-500" : "bg-green-400",
                            )} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active session slots */}
                  {TIME_SESSIONS.filter((s) => s.color === activeSession).map((session) => {
                    const colors = SESSION_COLORS[session.color];
                    return (
                      <div key={session.label} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", colors.badge)}>
                            {session.range}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            Ô đen = đã có lịch cố định
                          </span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {session.slots.map((slot) => {
                            const blockingFixedRule =
                              getBlockingFixedRuleForSlot(activeRule, slot);
                            const selectedRule = activeRule
                              ? scheduleRules.find(
                                  (rule) =>
                                    ruleHasSameScheduleTarget(rule, activeRule) &&
                                    slotIsInsideRange(
                                      slot,
                                      rule.timeStart,
                                      rule.timeEnd,
                                    ),
                                )
                              : undefined;
                            const isSlotActive = !!selectedRule;
                            return (
                              <button
                                key={`${slot.start}-${slot.end}`}
                                type="button"
                                title={
                                  blockingFixedRule
                                    ? `${slot.label} đã thuộc lịch cố định ${blockingFixedRule.timeStart} - ${blockingFixedRule.timeEnd}`
                                    : `${slot.label}`
                                }
                                disabled={!!blockingFixedRule}
                                onClick={() =>
                                  handleSelectRuleSlot(
                                    activeRule?.id,
                                    slot.start,
                                    slot.end,
                                  )
                                }
                                className={cn(
                                  "relative h-12 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-1.5",
                                  blockingFixedRule
                                    ? "cursor-not-allowed border-gray-800 bg-gray-900 text-gray-400"
                                    : isSlotActive
                                    ? cn(colors.active, "shadow-sm scale-[1.02]")
                                    : cn(
                                        "border-gray-200 bg-white text-gray-600",
                                        colors.slot,
                                      ),
                                )}
                              >
                                {isSlotActive && !blockingFixedRule && (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                                {slot.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom time — collapsible */}
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowCustomTime(!showCustomTime)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Settings2 className="h-3.5 w-3.5" />
                        Tùy chỉnh giờ chơi (ngoài khung có sẵn)
                      </span>
                      {showCustomTime ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {showCustomTime && (
                      <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-gray-500 font-medium">Giờ bắt đầu</label>
                            <select
                              value={activeRule?.timeStart || ""}
                              onChange={(e) => {
                                const start = e.target.value;
                                if (!start) return;
                                const startHour = parseInt(start.split(":")[0]);
                                const currentEndHour = activeRule?.timeEnd ? parseInt(activeRule.timeEnd.split(":")[0]) : 0;
                                if (currentEndHour <= startHour) {
                                  const newEnd = `${String(Math.min(22, startHour + 2)).padStart(2, "0")}:00`;
                                  handleSelectCustomRuleTime(activeRule?.id, start, newEnd);
                                } else {
                                  handleSelectCustomRuleTime(activeRule?.id, start, activeRule?.timeEnd || "");
                                }
                              }}
                              className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
                            >
                              <option value="">-- Bắt đầu --</option>
                              {Array.from({ length: 16 }, (_, i) => {
                                const hour = 6 + i;
                                const val = `${String(hour).padStart(2, "0")}:00`;
                                return (
                                  <option key={val} value={val}>
                                    {val}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-500 font-medium">Giờ kết thúc</label>
                            <select
                              value={activeRule?.timeEnd || ""}
                              onChange={(e) => {
                                const end = e.target.value;
                                if (!end) return;
                                handleSelectCustomRuleTime(activeRule?.id, activeRule?.timeStart || "", end);
                              }}
                              className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
                            >
                              <option value="">-- Kết thúc --</option>
                              {Array.from({ length: 17 }, (_, i) => {
                                const hour = 6 + i;
                                const val = `${String(hour).padStart(2, "0")}:00`;
                                const startHour = activeRule?.timeStart ? parseInt(activeRule.timeStart.split(":")[0]) : 5;
                                if (hour <= startHour) return null;
                                return (
                                  <option key={val} value={val}>
                                    {val}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </div>


                <div
                  className={cn(
                    "rounded-2xl border border-green-200 bg-green-50/30 p-3 space-y-3",
                    cycle === "daily" && "hidden",
                  )}
                >
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 font-bold text-white">
                        {occurrenceCount}
                      </span>
                      <div>
                        <p className="font-bold text-gray-800">Tổng cộng {occurrenceCount} buổi</p>
                        <p className="text-[10px] text-gray-500">
                          {repeatingRules.length} CĐ · {oddRules.length} Lẻ · Max {longestRepeatWeeks} tuần
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSummaryDetail(!showSummaryDetail)}
                      className="flex items-center gap-1 rounded-lg border border-green-200 bg-white px-2 py-1 text-[11px] font-bold text-green-700 hover:bg-green-50 transition-colors"
                    >
                      <Settings2 className="h-3 w-3" />
                      {showSummaryDetail ? "Thu gọn" : "Cấu hình lặp"}
                    </button>
                  </div>

                  {showSummaryDetail && (
                    <div className="space-y-3 border-t border-green-200/50 pt-3 text-xs">
                      {repeatingRules.length > 0 && (
                        <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-gray-700">Cách lặp lịch cố định</p>
                              <p className="text-[10px] text-gray-400">Chọn lặp chung số tuần hoặc lặp riêng từng thứ.</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 font-bold text-green-700">
                              {fixedRepeatMode === "shared" ? `${sharedRepeatWeeks}w chung` : "Lặp riêng"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-gray-100 p-0.5">
                            <button
                              type="button"
                              onClick={() => handleFixedRepeatModeChange("shared")}
                              className={cn(
                                "h-8 rounded-md text-[11px] font-semibold transition-all",
                                fixedRepeatMode === "shared"
                                  ? "bg-white text-green-700 shadow-sm"
                                  : "text-gray-500 hover:text-gray-700",
                              )}
                            >
                              Lặp chung
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFixedRepeatModeChange("custom")}
                              className={cn(
                                "h-8 rounded-md text-[11px] font-semibold transition-all",
                                fixedRepeatMode === "custom"
                                  ? "bg-white text-green-700 shadow-sm"
                                  : "text-gray-500 hover:text-gray-700",
                              )}
                            >
                              Lặp riêng
                            </button>
                          </div>

                          {fixedRepeatMode === "shared" && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Số tuần lặp chung</p>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSharedFixedRepeatWeeks(sharedRepeatWeeks - 1)}
                                  disabled={sharedRepeatWeeks <= minimumWeeks}
                                  className="h-8 w-8 shrink-0 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-400 hover:text-green-700 disabled:opacity-30"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={minimumWeeks}
                                  max={52}
                                  value={sharedRepeatWeeks}
                                  onChange={(e) => setSharedFixedRepeatWeeks(Number(e.target.value))}
                                  className="h-8 min-w-0 flex-1 rounded-lg border border-gray-200 px-2 text-center text-xs font-bold text-gray-700 focus:border-green-500 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => setSharedFixedRepeatWeeks(sharedRepeatWeeks + 1)}
                                  disabled={sharedRepeatWeeks >= 52}
                                  className="h-8 w-8 shrink-0 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-400 hover:text-green-700 disabled:opacity-30"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl border border-gray-100 bg-white px-2 py-1.5">
                          <p className="text-[10px] font-medium text-gray-400">Cố định</p>
                          <p className="font-bold text-green-700">{repeatingRules.length} khung</p>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-white px-2 py-1.5">
                          <p className="text-[10px] font-medium text-gray-400">Lịch lẻ</p>
                          <p className="font-bold text-blue-700">{oddRules.length} khung</p>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-white px-2 py-1.5">
                          <p className="text-[10px] font-medium text-gray-400">Tuần lặp</p>
                          <p className="font-bold text-purple-700">{longestRepeatWeeks} tuần</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Ngày bắt đầu <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      min={today}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full h-11 px-3.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Ngày kết thúc {cycle === "daily" ? <span className="text-red-400">*</span> : null}
                    </label>
                    <input
                      type="date"
                      value={cycle === "daily" ? endDate : estimatedEndDate}
                      min={startDate || today}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={cycle !== "daily"}
                      className="w-full h-11 px-3.5 border border-gray-200 rounded-xl text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                    />
                    {cycle !== "daily" ? (
                      <p className="text-xs text-gray-400">Tự tính theo số tuần và khung giờ đã chọn.</p>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Khoảng lịch:{" "}
                  <strong className="text-green-700">
                    {startDate || "Chưa chọn"} → {estimatedEndDate || "Chưa tính"}
                  </strong>
                  {occurrenceCount > 0 ? ` · ${occurrenceCount} buổi` : ""}
                </p>
              </div>

              {/* Info note */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-sm text-blue-700">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                <div className="space-y-1">
                  <p className="font-semibold">Lưu ý về gói đặt sân cố định</p>
                  <ul className="text-xs space-y-0.5 text-blue-600 list-disc ml-3">
                    <li>
                      Tối thiểu <strong>4 tuần</strong> và tối đa 52 tuần
                    </li>
                    <li>
                      Sân bị trùng lịch sẽ được{" "}
                      <strong>tự động gợi ý sân bù</strong> miễn phí
                    </li>
                    <li>
                      Nếu không có sân bù, bạn có thể{" "}
                      <strong>đổi giờ hoặc bỏ qua</strong> buổi đó
                    </li>
                  </ul>
                </div>
              </div>

              <Button
                onClick={handlePreview}
                disabled={!isStep1Valid || loadingPreview}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg shadow-green-600/25 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
              >
                {loadingPreview ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang kiểm tra lịch...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Xem trước lịch đặt <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </motion.div>
          ) : (
            /* ════════ STEP 2 ════════ */
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start"
            >
              {/* ── LEFT ── */}
              <div className="lg:col-span-3 space-y-4">
                {preview && occurrences.some((occ) => occ.hasConflict) && (
                  <ConflictCalendarMap
                    occurrences={occurrences}
                    preview={preview}
                    onSetAction={setOccurrenceAction}
                    onSetCustomAction={setCustomAction}
                    checkSlot={checkSlot}
                  />
                )}

                {/* Occurrences list */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-50">
                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-green-600" /> Danh sách
                      buổi
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-100">
                        ✅ {occurrences.filter((o) => !o.hasConflict).length}{" "}
                        khả dụng
                      </span>
                      {occurrences.filter(
                        (o) => o.hasConflict && o.suggestedReplacement,
                      ).length > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-100">
                          ⚠️{" "}
                          {
                            occurrences.filter(
                              (o) => o.hasConflict && o.suggestedReplacement,
                            ).length
                          }{" "}
                          có sân bù
                        </span>
                      )}
                      {occurrences.filter(
                        (o) => o.hasConflict && !o.suggestedReplacement,
                      ).length > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full border border-red-100">
                          🔴{" "}
                          {
                            occurrences.filter(
                              (o) => o.hasConflict && !o.suggestedReplacement,
                            ).length
                          }{" "}
                          cần xử lý
                        </span>
                      )}
                      {occurrences.filter((o) => o.action === "replace")
                        .length > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                          🔄{" "}
                          {
                            occurrences.filter((o) => o.action === "replace")
                              .length
                          }{" "}
                          sân bù
                        </span>
                      )}
                      {occurrences.filter((o) => o.action === "custom").length >
                        0 && (
                        <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-100">
                          ✏️{" "}
                          {
                            occurrences.filter((o) => o.action === "custom")
                              .length
                          }{" "}
                          đổi giờ
                        </span>
                      )}
                      {occurrences.filter((o) => o.action === "skip").length >
                        0 && (
                        <span className="text-xs px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full border border-gray-100">
                          ⏭{" "}
                          {
                            occurrences.filter((o) => o.action === "skip")
                              .length
                          }{" "}
                          bỏ qua
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
                    {occurrences.map((occ, idx) => (
                      <OccurrenceRow
                        key={occurrenceKey(occ)}
                        occ={occ}
                        index={idx + 1}
                        preview={preview!}
                        onSetAction={setOccurrenceAction}
                        onSetCustomAction={setCustomAction}
                        checkSlot={checkSlot}
                      />
                    ))}
                  </div>
                </div>

                {/* Customer info */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                  <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                    <User className="h-4 w-4 text-green-600" />
                    Thông tin khách hàng
                    {user && user.role !== "guest" && (
                      <span className="ml-auto text-xs text-green-600 flex items-center gap-1">
                        <BadgeCheck className="h-3.5 w-3.5" /> Tự động điền từ
                        tài khoản
                      </span>
                    )}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">
                        Họ và tên <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Nguyễn Văn A"
                        className="w-full h-10 px-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">
                        Số điện thoại <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) =>
                          setCustomerPhone(
                            e.target.value.replace(/\D/g, "").slice(0, 10),
                          )
                        }
                        placeholder="0901234567"
                        className={cn(
                          "w-full h-10 px-3.5 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all",
                          customerPhone &&
                            !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(customerPhone)
                            ? "border-red-300 focus:ring-red-500/20"
                            : "border-gray-200 focus:ring-green-500/30 focus:border-green-500",
                        )}
                      />
                      {customerPhone &&
                        !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(customerPhone) && (
                          <p className="text-xs text-red-500">
                            Số điện thoại không hợp lệ
                          </p>
                        )}
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">
                        Email <span className="text-gray-300">(tùy chọn)</span>
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full h-10 px-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-xl bg-green-50 p-3 text-xs text-green-700">
                    <Shield className="h-4 w-4 mt-0.5 shrink-0" />
                    Gói cố định được điều chỉnh tối đa 1 buổi trước khi thanh
                    toán.
                  </div>
                </div>

                {/* Payment */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
                  <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-green-600" /> Phương
                    thức thanh toán
                  </h2>
                  <div className="grid grid-cols-2 gap-2.5">
                    {PAYMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPaymentMethod(opt.value)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all",
                          paymentMethod === opt.value
                            ? "border-green-600 bg-green-50"
                            : "border-gray-100 hover:border-gray-200 bg-white",
                        )}
                      >
                        <span className="text-xl">{opt.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {opt.label}
                          </p>
                          <p className="text-xs text-gray-400">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── RIGHT: Pricing ── */}
              <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-20">
                {preview && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                        <MapPin className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {preview.court.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Gói cố định · {preview.summary.totalOccurrences} buổi
                        </p>
                        <p className="text-xs text-gray-400">
                          {startDate} → {preview.endDate ?? "Đang tính"}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-gray-50 pt-3 space-y-2 text-sm">
                      <div className="flex justify-between text-gray-500">
                        <span>Giá/giờ</span>
                        <span className="text-gray-800 font-medium">
                          {preview.pricing.pricePerHour.toLocaleString("vi-VN")}
                          đ
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Tổng số buổi</span>
                        <span className="text-gray-800 font-medium">
                          {occurrences.length} buổi
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Buổi tính tiền</span>
                        <span className="text-gray-800 font-medium">
                          {
                            occurrences.filter((o) => o.action !== "skip")
                              .length
                          }{" "}
                          buổi
                        </span>
                      </div>
                      {occurrences.some((o) => o.action === "skip") && (
                        <div className="flex justify-between text-gray-400 text-xs">
                          <span>Buổi bỏ qua</span>
                          <span>
                            {
                              occurrences.filter((o) => o.action === "skip")
                                .length
                            }{" "}
                            buổi
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                      <span className="font-bold text-gray-900">Ước tính</span>
                      <span className="text-xl font-bold text-green-600">
                        {liveTotal.toLocaleString("vi-VN")}đ
                      </span>
                    </div>

                    {occurrences.some((o) => o.action === "replace") && (
                      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl text-xs text-blue-600">
                        <RefreshCw className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        Sân thay thế tính theo giá sân gốc (bù miễn phí)
                      </div>
                    )}
                    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
                      <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
                      Giá đã được chốt tại thời điểm đặt, không thay đổi về sau
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleConfirm}
                  disabled={
                    !isStep2Valid || !hasBillableOccurrences || loadingConfirm
                  }
                  className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg shadow-green-600/25 transition-all hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {loadingConfirm ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang xử lý...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Xác nhận đặt lịch
                    </span>
                  )}
                </Button>

                <button
                  onClick={() => router.push("/")}
                  className="w-full h-10 text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Home className="h-3.5 w-3.5" /> Về trang chủ
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Loading overlay */}
      {loadingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Loader2 className="h-7 w-7 text-green-600 animate-spin" />
            </div>
            <p className="font-semibold text-gray-900">
              Đang xử lý đặt lịch...
            </p>
            <p className="text-sm text-gray-400">
              Vui lòng không đóng trang này
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADJUST SLOT MODAL — chọn giờ mới theo buổi Sáng/Chiều/Tối
// ═══════════════════════════════════════════════════════════════

function ConflictCalendarMap({
  occurrences,
  preview,
  onSetAction,
  onSetCustomAction,
  checkSlot,
}: {
  occurrences: OccurrenceUIState[];
  preview: FixedSchedulePreviewResponse;
  onSetAction: (
    date: string,
    action: OccurrenceAction,
    replaceWithCourtId?: number,
    timeStart?: string,
    timeEnd?: string,
  ) => void;
  onSetCustomAction: (
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
}) {
  const [selectedKey, setSelectedKey] = useState(
    occurrences.find((occ) => occ.hasConflict)?.date
      ? occurrenceKey(occurrences.find((occ) => occ.hasConflict)!)
      : occurrenceKey(occurrences[0]),
  );
  const [modalOcc, setModalOcc] = useState<OccurrenceUIState | null>(null);
  const selectedOcc =
    occurrences.find((occ) => occurrenceKey(occ) === selectedKey) ??
    occurrences[0];
  const weeks = Array.from(
    occurrences.reduce((map, occ) => {
      const weekKey = formatUtcDate(startOfUtcWeek(toUtcDate(occ.date)));
      const items = map.get(weekKey) ?? [];
      items.push(occ);
      map.set(weekKey, items);
      return map;
    }, new Map<string, OccurrenceUIState[]>()),
  ).sort(([a], [b]) => a.localeCompare(b));

  const handleCustomConfirm = (
    occ: OccurrenceUIState,
    courtId: number,
    courtName: string,
    customDate: string,
    timeStart: string,
    timeEnd: string,
  ) => {
    onSetCustomAction(
      occ.date,
      customDate,
      courtId,
      courtName,
      timeStart,
      timeEnd,
      occ.timeStart,
      occ.timeEnd,
    );
    setModalOcc(null);
    setSelectedKey(occurrenceKey(occ));
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-green-600" />
          Sơ đồ lịch tổng quan
        </h3>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          <span className="rounded-full bg-green-50 px-2 py-1 text-green-700">OK</span>
          <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">B: sân bù</span>
          <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">!: trùng</span>
          <span className="rounded-full bg-purple-50 px-2 py-1 text-purple-700">D: đã đổi</span>
          <span className="rounded-full bg-gray-50 px-2 py-1 text-gray-500">-: bỏ</span>
        </div>
      </div>

      <div className="mt-4 hidden sm:block overflow-x-auto">
        <div className="min-w-[560px] space-y-2">
          <div className="grid grid-cols-[72px_repeat(7,minmax(52px,1fr))] gap-2 text-center text-xs font-semibold text-gray-400">
            <span />
            {DAY_LABELS.map((day) => (
              <span key={day.value}>{day.short}</span>
            ))}
          </div>
          {weeks.map(([weekKey, weekOccurrences], index) => (
            <div
              key={weekKey}
              className="grid grid-cols-[72px_repeat(7,minmax(52px,1fr))] gap-2"
            >
              <div className="rounded-lg bg-gray-50 px-2 py-2 text-xs font-semibold text-gray-500">
                W{index + 1}
                <div className="font-normal text-[11px]">{weekKey.slice(5)}</div>
              </div>
              {DAY_LABELS.map((day) => {
                const items = weekOccurrences.filter(
                  (occ) => toUtcDate(occ.date).getUTCDay() === day.value,
                );
                return (
                  <div key={`${weekKey}-${day.value}`} className="space-y-1">
                    {items.length === 0 ? (
                      <div className="h-9 rounded-lg border border-dashed border-gray-100 bg-gray-50/60" />
                    ) : (
                      items.map((occ) => {
                        const active = occurrenceKey(occ) === occurrenceKey(selectedOcc);
                        return (
                          <button
                            key={occurrenceKey(occ)}
                            type="button"
                            title={`${occ.date} ${occ.timeStart}-${occ.timeEnd}`}
                            onClick={() => setSelectedKey(occurrenceKey(occ))}
                            className={cn(
                              "h-9 w-full rounded-lg border text-[11px] font-bold transition-all hover:-translate-y-0.5",
                              getOccurrenceTone(occ),
                              active && "ring-2 ring-green-500/30",
                            )}
                          >
                            {getOccurrenceSymbol(occ)}
                          </button>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2 sm:hidden">
        {occurrences.map((occ) => (
          <button
            key={occurrenceKey(occ)}
            type="button"
            onClick={() => setSelectedKey(occurrenceKey(occ))}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold",
              getOccurrenceTone(occ),
            )}
          >
            <span>{occ.date} · {occ.timeStart}-{occ.timeEnd}</span>
            <span>{getOccurrenceSymbol(occ)}</span>
          </button>
        ))}
      </div>

      {selectedOcc && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {selectedOcc.dayLabel} · {selectedOcc.date}
              </p>
              <p className="text-xs text-gray-500">
                {selectedOcc.timeStart}-{selectedOcc.timeEnd}
                {selectedOcc.hasConflict && selectedOcc.conflicts.length > 0
                  ? ` · Trùng ${selectedOcc.conflicts.map((item) => item.time).join(", ")}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <ActionBtn
                active={selectedOcc.action === "keep"}
                color="green"
                onClick={() =>
                  onSetAction(
                    selectedOcc.date,
                    "keep",
                    undefined,
                    selectedOcc.timeStart,
                    selectedOcc.timeEnd,
                  )
                }
              >
                Giữ
              </ActionBtn>
              {selectedOcc.suggestedReplacement && (
                <ActionBtn
                  active={selectedOcc.action === "replace"}
                  color="blue"
                  onClick={() =>
                    onSetAction(
                      selectedOcc.date,
                      "replace",
                      undefined,
                      selectedOcc.timeStart,
                      selectedOcc.timeEnd,
                    )
                  }
                >
                  Sân bù
                </ActionBtn>
              )}
              <ActionBtn
                active={selectedOcc.action === "custom"}
                color="purple"
                onClick={() => setModalOcc(selectedOcc)}
              >
                Đổi
              </ActionBtn>
              <ActionBtn
                active={selectedOcc.action === "skip"}
                color="gray"
                onClick={() =>
                  onSetAction(
                    selectedOcc.date,
                    "skip",
                    undefined,
                    selectedOcc.timeStart,
                    selectedOcc.timeEnd,
                  )
                }
              >
                Bỏ
              </ActionBtn>
            </div>
          </div>
        </div>
      )}

      {modalOcc && (
        <AdjustSlotModal
          occ={modalOcc}
          originalCourtId={preview.court.id}
          onConfirm={(courtId, courtName, customDate, timeStart, timeEnd) =>
            handleCustomConfirm(
              modalOcc,
              courtId,
              courtName,
              customDate,
              timeStart,
              timeEnd,
            )
          }
          onClose={() => setModalOcc(null)}
          checkSlot={checkSlot}
        />
      )}
    </div>
  );
}

function AdjustSlotModal({
  occ,
  originalCourtId,
  onConfirm,
  onClose,
  checkSlot,
}: {
  occ: OccurrenceUIState;
  originalCourtId: number;
  onConfirm: (
    courtId: number,
    courtName: string,
    customDate: string,
    timeStart: string,
    timeEnd: string,
  ) => void;
  onClose: () => void;
  checkSlot: (req: CheckSlotRequest) => Promise<CheckSlotResponse | null>;
}) {
  const [customDate, setCustomDate] = useState(occ.customDate || occ.date);
  const [selectedSlot, setSelectedSlot] = useState<{
    start: string;
    end: string;
  } | null>(
    occ.customTimeStart && occ.customTimeEnd
      ? { start: occ.customTimeStart, end: occ.customTimeEnd }
      : null,
  );
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckSlotResponse | null>(
    null,
  );
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
  const [slotSelectionNotice, setSlotSelectionNotice] = useState("");
  const [localSession, setLocalSession] = useState<SessionColor>("purple"); // default buổi tối
  const minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];

  // Reset kết quả khi đổi khung giờ
  const handleSelectSlot = (start: string, end: string) => {
    const next = resolveContiguousSlotSelection(selectedSlot, { start, end });
    if (!next) {
      setSlotSelectionNotice(CONTIGUOUS_SLOT_NOTICE);
      toast.warning("Các khung giờ được chọn phải liền mạch nhau.");
      return;
    }

    setSlotSelectionNotice("");
    setSelectedSlot(next);
    setCheckResult(null);
    setSelectedCourtId(null);
  };

  const handleChangeDate = (date: string) => {
    setCustomDate(date);
    setSlotSelectionNotice("");
    setCheckResult(null);
    setSelectedCourtId(null);
  };

  useEffect(() => {
    if (!selectedSlot) {
      setCheckResult(null);
      setSelectedCourtId(null);
      return;
    }

    let cancelled = false;

    const loadSelectedSlot = async () => {
      setChecking(true);
      try {
        const result = await checkSlot({
          courtId: originalCourtId,
          date: customDate,
          timeStart: selectedSlot.start,
          timeEnd: selectedSlot.end,
        });

        if (cancelled) return;

        setCheckResult(result);
        const first = (result?.courts || []).find((c) => c.available);
        setSelectedCourtId(first?.id ?? null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    void loadSelectedSlot();

    return () => {
      cancelled = true;
    };
  }, [
    checkSlot,
    customDate,
    originalCourtId,
    selectedSlot,
  ]);

  const handleConfirm = () => {
    if (!selectedCourtId || !checkResult || !selectedSlot) return;
    const court = (checkResult.courts || []).find(
      (c) => c.id === selectedCourtId,
    );
    if (!court || !court.available) {
      toast.error("Vui lòng chọn sân còn trống");
      return;
    }
    onConfirm(
      court.id,
      court.name,
      customDate,
      selectedSlot.start,
      selectedSlot.end,
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">
                Đổi ngày/giờ cho buổi này
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {occ.dayLabel} · {occ.date} · Giờ gốc: {occ.timeStart}–
                {occ.timeEnd}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <XCircle className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Chọn ngày mới
            </p>
            <input
              type="date"
              value={customDate}
              min={minDate}
              onChange={(event) => handleChangeDate(event.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
            />
            {customDate !== occ.date && (
              <p className="text-xs text-purple-600">
                Buổi này sẽ được chuyển từ {occ.date} sang {customDate}.
              </p>
            )}
          </div>
          {/* Chọn khung giờ theo buổi */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Chọn khung giờ mới
            </p>
            <p className="text-xs text-gray-500">
              Chọn một hoặc nhiều ô 1 giờ liền nhau.
            </p>

            {selectedSlot && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Đã chọn:{" "}
                  <strong>
                    {selectedSlot.start} – {selectedSlot.end}
                  </strong>
                </span>
                <button
                  onClick={() => {
                    setSelectedSlot(null);
                    setSlotSelectionNotice("");
                    setCheckResult(null);
                    setSelectedCourtId(null);
                  }}
                  className="ml-auto text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Đổi
                </button>
              </div>
            )}

            {slotSelectionNotice && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{slotSelectionNotice}</span>
              </div>
            )}

            {/* Local Session Tabs */}
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
              {TIME_SESSIONS.map((session) => {
                const isActive = session.color === localSession;
                const hasSelectedSlots = selectedSlot && rangesIntersect(
                  selectedSlot.start,
                  selectedSlot.end,
                  session.slots,
                );
                const SessionIcon = session.color === "amber" ? Sun : session.color === "blue" ? Sunset : Moon;
                return (
                  <button
                    key={session.label}
                    type="button"
                    onClick={() => setLocalSession(session.color as SessionColor)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all",
                      isActive
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-400 hover:text-gray-600",
                    )}
                  >
                    <SessionIcon className="h-3.5 w-3.5" />
                    <span>{session.label.replace(/^[^\s]+\s/, "")}</span>
                    {hasSelectedSlots && (
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Local Session Slots */}
            {TIME_SESSIONS.filter((s) => s.color === localSession).map((session) => {
              const colors = SESSION_COLORS[session.color as SessionColor];
              const isActiveSession = selectedSlot && rangesIntersect(
                selectedSlot.start,
                selectedSlot.end,
                session.slots,
              );
              return (
                <div
                  key={session.label}
                  className={cn(
                    "rounded-xl border p-3 transition-all",
                    isActiveSession
                      ? "border-green-200 bg-green-50/40"
                      : "border-gray-100 bg-gray-50/50",
                  )}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-sm font-semibold text-gray-700">
                      {session.label}
                    </span>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        colors.badge,
                      )}
                    >
                      {session.range}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {session.slots.map((slot) => {
                      const isSelected = slotIsInsideRange(
                        slot,
                        selectedSlot?.start,
                        selectedSlot?.end,
                      );
                      return (
                        <button
                          key={slot.label}
                          type="button"
                          title={`${slot.label} thuộc ${session.label}`}
                          onClick={() => handleSelectSlot(slot.start, slot.end)}
                          className={cn(
                            "h-9 px-2 rounded-lg text-xs font-semibold border-2 transition-all text-left pl-3 flex items-center gap-1.5",
                            isSelected
                              ? colors.active
                              : `border-gray-200 text-gray-600 bg-white ${colors.slot}`,
                          )}
                        >
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                          <span>{slot.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedSlot && checking && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Đang tự kiểm tra sân trống...
            </div>
          )}

          {/* Danh sách sân */}
          {checkResult && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Sân available · {checkResult.date || customDate} ·{" "}
                {checkResult.timeStart}–{checkResult.timeEnd}
                {!checkResult.hasAvailable && (
                  <span className="ml-2 text-red-500 normal-case font-normal">
                    — Không có sân trống
                  </span>
                )}
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {(checkResult.courts || []).map((court) => (
                  <button
                    key={court.id}
                    type="button"
                    disabled={!court.available}
                    onClick={() =>
                      court.available && setSelectedCourtId(court.id)
                    }
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all",
                      !court.available
                        ? "opacity-40 cursor-not-allowed border-gray-100 bg-gray-50"
                        : selectedCourtId === court.id
                          ? "border-green-600 bg-green-50"
                          : "border-gray-200 hover:border-green-300 bg-white",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                          selectedCourtId === court.id
                            ? "border-green-600 bg-green-600"
                            : "border-gray-300",
                        )}
                      >
                        {selectedCourtId === court.id && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {court.name}
                          {court.isOriginal && (
                            <span className="ml-1.5 text-xs text-gray-400 font-normal">
                              (sân gốc)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          {court.type} · {court.price.toLocaleString("vi-VN")}
                          đ/giờ
                        </p>
                      </div>
                    </div>
                    {court.available ? (
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 border border-green-100 rounded-full">
                        Trống
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-red-50 text-red-500 border border-red-100 rounded-full">
                        Đã đặt
                      </span>
                    )}
                  </button>
                ))}
                {(checkResult.courts || []).length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
                    Chưa có dữ liệu sân cho ngày/giờ này. Hãy thử kiểm tra lại.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              !selectedCourtId ||
              !(checkResult?.courts || []).find((c) => c.id === selectedCourtId)
                ?.available
            }
            className="flex-1 h-10 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" /> Xác nhận đổi
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OCCURRENCE ROW
// ═══════════════════════════════════════════════════════════════

function OccurrenceRow({
  occ,
  index,
  preview,
  onSetAction,
  onSetCustomAction,
  checkSlot,
}: {
  occ: OccurrenceUIState;
  index: number;
  preview: FixedSchedulePreviewResponse;
  onSetAction: (
    date: string,
    action: OccurrenceAction,
    replaceWithCourtId?: number,
    timeStart?: string,
    timeEnd?: string,
  ) => void;
  onSetCustomAction: (
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
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleCustomConfirm = (
    courtId: number,
    courtName: string,
    customDate: string,
    timeStart: string,
    timeEnd: string,
  ) => {
    onSetCustomAction(
      occ.date,
      customDate,
      courtId,
      courtName,
      timeStart,
      timeEnd,
      occ.timeStart,
      occ.timeEnd,
    );
    setModalOpen(false);
    toast.success(
      `Đã đổi sang ${customDate} · ${courtName} · ${timeStart}–${timeEnd}`,
    );
  };

  const displayTime =
    occ.action === "custom" && occ.customTimeStart
      ? `${occ.customDate && occ.customDate !== occ.date ? `${occ.customDate} · ` : ""}${occ.customCourtName} · ${occ.customTimeStart}–${occ.customTimeEnd}`
      : occ.action === "replace" && occ.selectedReplacement
        ? `${occ.selectedReplacement.courtName} · ${occ.timeStart}–${occ.timeEnd}`
        : `${occ.timeStart}–${occ.timeEnd}`;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-4 px-5 py-3.5 transition-colors",
          occ.action === "skip"
            ? "opacity-50 bg-gray-50/50"
            : "hover:bg-gray-50/60",
        )}
      >
        {/* Index badge */}
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
            occ.action === "skip"
              ? "bg-gray-200 text-gray-400"
              : occ.action === "custom"
                ? "bg-purple-100 text-purple-600"
                : occ.action === "replace"
                  ? "bg-blue-100 text-blue-600"
                  : !occ.hasConflict
                    ? "bg-green-100 text-green-700"
                    : occ.suggestedReplacement
                      ? "bg-amber-100 text-amber-600"
                      : "bg-red-100 text-red-500",
          )}
        >
          {occ.action === "skip" ? (
            <SkipForward className="h-3.5 w-3.5" />
          ) : (
            index
          )}
        </div>

        {/* Date + time */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">
              {occ.dayLabel}
            </span>
            <span className="text-xs text-gray-400">{occ.date}</span>
            {/* Status icon */}
            {!occ.hasConflict ? (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            ) : occ.suggestedReplacement ? (
              <span title="Có sân bù">
                <RefreshCw className="h-3 w-3 text-amber-500" />
              </span>
            ) : (
              <span title="Không có sân bù">
                <XCircle className="h-3 w-3 text-red-400" />
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{displayTime}</p>
          {/* Conflict info */}
          {occ.hasConflict && occ.conflicts.length > 0 && (
            <p className="text-xs text-red-400 mt-0.5">
              Trùng: {occ.conflicts.map((c) => c.time).join(", ")}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {!occ.hasConflict ? (
            // Buổi OK: Giữ / Đổi giờ / Bỏ
            <>
              <ActionBtn
                active={occ.action === "keep"}
                color="green"
                onClick={() => onSetAction(occ.date, "keep", undefined, occ.timeStart, occ.timeEnd)}
              >
                Giữ
              </ActionBtn>
              <ActionBtn
                active={occ.action === "custom"}
                color="purple"
                onClick={() => setModalOpen(true)}
              >
                Đổi ngày/giờ
              </ActionBtn>
              <ActionBtn
                active={occ.action === "skip"}
                color="gray"
                onClick={() => onSetAction(occ.date, "skip", undefined, occ.timeStart, occ.timeEnd)}
              >
                Bỏ
              </ActionBtn>
            </>
          ) : occ.suggestedReplacement ? (
            // Có sân bù: Dùng sân bù / Đổi giờ / Bỏ
            <>
              <ActionBtn
                active={occ.action === "replace"}
                color="blue"
                onClick={() => onSetAction(occ.date, "replace", undefined, occ.timeStart, occ.timeEnd)}
              >
                Sân bù
              </ActionBtn>
              <ActionBtn
                active={occ.action === "custom"}
                color="purple"
                onClick={() => setModalOpen(true)}
              >
                Đổi ngày/giờ
              </ActionBtn>
              <ActionBtn
                active={occ.action === "skip"}
                color="gray"
                onClick={() => onSetAction(occ.date, "skip", undefined, occ.timeStart, occ.timeEnd)}
              >
                Bỏ
              </ActionBtn>
            </>
          ) : (
            // Không có sân bù: BẮT BUỘC đổi giờ hoặc bỏ
            <>
              <ActionBtn
                active={occ.action === "custom"}
                color="purple"
                onClick={() => setModalOpen(true)}
              >
                Đổi ngày/giờ
              </ActionBtn>
              <ActionBtn
                active={occ.action === "skip"}
                color="gray"
                onClick={() => onSetAction(occ.date, "skip", undefined, occ.timeStart, occ.timeEnd)}
              >
                Bỏ
              </ActionBtn>
            </>
          )}
        </div>
      </div>

      {modalOpen && (
        <AdjustSlotModal
          occ={occ}
          originalCourtId={preview.court.id}
          onConfirm={handleCustomConfirm}
          onClose={() => setModalOpen(false)}
          checkSlot={checkSlot}
        />
      )}
    </>
  );
}

// ─── ActionBtn helper ─────────────────────────────────────────
function ActionBtn({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color: "green" | "blue" | "purple" | "gray";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeClass = {
    green: "bg-green-600 text-white border-green-600",
    blue: "bg-blue-600 text-white border-blue-600",
    purple: "bg-purple-600 text-white border-purple-600",
    gray: "bg-gray-400 text-white border-gray-400",
  }[color];
  const inactiveClass = {
    green:
      "border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600",
    blue: "border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-500",
    purple:
      "border-gray-200 text-gray-500 hover:border-purple-400 hover:text-purple-600",
    gray: "border-gray-200 text-gray-400 hover:border-gray-400",
  }[color];
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 rounded-lg text-xs font-semibold border transition-all",
        active ? activeClass : inactiveClass,
      )}
    >
      {children}
    </button>
  );
}
