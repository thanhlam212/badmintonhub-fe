"use client";

/**
 * page.tsx — Fixed Schedule booking page
 *
 * CHANGES:
 * 1. AdjustSlotModal: UI chọn giờ chia rõ Sáng / Chiều / Tối thay vì input giờ thô
 * 2. OccurrenceRow: hiển thị đầy đủ trạng thái conflict + action buttons
 * 3. CheckSlotResponse type mới có price, isOriginal, hasAvailable
 */

import { useState, useEffect, useCallback } from "react";
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
  Loader2,
  BadgeCheck,
  XCircle,
  Sparkles,
  Shield,
  Search,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { courtApi } from "@/lib/api";
import { useFixedSchedule } from "./hooks/useFixedSchedule";
import type {
  FixedScheduleCycle,
  FixedScheduleBookingMode,
  FixedScheduleRule,
  PaymentMethod,
  OccurrenceUIState,
  OccurrenceAction,
  Court,
  CheckSlotRequest,
  CheckSlotResponse,
  CheckSlotCourtResult,
  FixedSchedulePreviewResponse,
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

// ─── TIME SLOTS chia theo buổi ────────────────────────────────
// Mỗi slot = { label hiển thị, value giờ bắt đầu HH:mm }
// Hệ thống lưu theo slot 1h, nên timeEnd = timeStart + duration

const TIME_SESSIONS = [
  {
    label: "🌅 Buổi sáng",
    range: "06:00 – 11:00",
    color: "amber",
    slots: [
      { start: "06:00", end: "07:00", label: "06:00 – 07:00" },
      { start: "06:00", end: "08:00", label: "06:00 – 08:00" },
      { start: "07:00", end: "09:00", label: "07:00 – 09:00" },
      { start: "08:00", end: "10:00", label: "08:00 – 10:00" },
      { start: "09:00", end: "11:00", label: "09:00 – 11:00" },
      { start: "10:00", end: "12:00", label: "10:00 – 12:00" },
    ],
  },
  {
    label: "☀️ Buổi chiều",
    range: "11:00 – 17:00",
    color: "blue",
    slots: [
      { start: "11:00", end: "13:00", label: "11:00 – 13:00" },
      { start: "13:00", end: "15:00", label: "13:00 – 15:00" },
      { start: "14:00", end: "16:00", label: "14:00 – 16:00" },
      { start: "15:00", end: "17:00", label: "15:00 – 17:00" },
      { start: "16:00", end: "18:00", label: "16:00 – 18:00" },
    ],
  },
  {
    label: "🌙 Buổi tối",
    range: "17:00 – 22:00",
    color: "purple",
    slots: [
      { start: "17:00", end: "19:00", label: "17:00 – 19:00" },
      { start: "18:00", end: "20:00", label: "18:00 – 20:00" },
      { start: "19:00", end: "21:00", label: "19:00 – 21:00" },
      { start: "20:00", end: "22:00", label: "20:00 – 22:00" },
    ],
  },
] as const;

type SessionColor = "amber" | "blue" | "purple";

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

const HOUR_OPTIONS = Array.from({ length: 17 }, (_, index) => {
  const hour = index + 6;
  return `${String(hour).padStart(2, "0")}:00`;
});

const DURATION_OPTIONS = [1, 2, 3] as const;
const OCCURRENCE_COUNT_PRESETS = [4, 8, 12, 16] as const;

type ScheduleRuleForm = {
  id: string;
  dayOfWeek: number;
  dayOfMonth: number;
  timeStart: string;
  durationHours: number;
};

function addHoursToTime(time: string, hours: number) {
  const [startHour] = time.split(":").map(Number);
  return `${String(startHour + hours).padStart(2, "0")}:00`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function FixedSchedulePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);

  // ── Step 1 state ──
  const [courts, setCourts] = useState<Court[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(true);
  const [courtId, setCourtId] = useState("");
  const [customerType, setCustomerType] = useState<
    "personal" | "group" | "tournament"
  >("personal");
  const [cycle, setCycle] = useState<FixedScheduleCycle>("weekly");
  const [bookingMode, setBookingMode] =
    useState<FixedScheduleBookingMode>("occurrence_count");
  const [occurrenceCount, setOccurrenceCount] = useState(8);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scheduleRules, setScheduleRules] = useState<ScheduleRuleForm[]>([
    {
      id: "rule-1",
      dayOfWeek: 1,
      dayOfMonth: 1,
      timeStart: "18:00",
      durationHours: 2,
    },
  ]);

  const primaryRule = scheduleRules[0];
  const timeStart = primaryRule?.timeStart ?? "";
  const timeEnd = primaryRule
    ? addHoursToTime(primaryRule.timeStart, primaryRule.durationHours)
    : "";
  const normalizedRules: FixedScheduleRule[] = scheduleRules.map((rule) => ({
    ...(cycle === "weekly"
      ? { dayOfWeek: rule.dayOfWeek }
      : { dayOfMonth: rule.dayOfMonth }),
    timeStart: rule.timeStart,
    timeEnd: addHoursToTime(rule.timeStart, rule.durationHours),
  }));

  // ── Step 2 state ──
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
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
        const data = await courtApi.getAll();
        setCourts(
          data.map((court) => ({
            id: court.id,
            name: court.name,
            type: court.type,
            price: court.price,
            branchId: court.branchId,
            available: court.available,
          })),
        );
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
  }, [user]);

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
  const minimumOccurrences = cycle === "weekly" ? 4 : 2;
  const repeatValues = scheduleRules.map((rule) =>
    cycle === "weekly" ? rule.dayOfWeek : rule.dayOfMonth,
  );
  const hasDuplicateRepeatDay =
    new Set(repeatValues).size !== repeatValues.length;
  const rulesAreValid =
    scheduleRules.length > 0 &&
    scheduleRules.every((rule) => {
      const startHour = Number(rule.timeStart.split(":")[0]);
      const repeatValue = cycle === "weekly" ? rule.dayOfWeek : rule.dayOfMonth;
      return (
        Number.isInteger(startHour) &&
        startHour + rule.durationHours <= 23 &&
        (cycle === "weekly"
          ? repeatValue >= 0 && repeatValue <= 6
          : repeatValue >= 1 && repeatValue <= 31)
      );
    }) &&
    !hasDuplicateRepeatDay;
  const isStep1Valid = !!(
    courtId &&
    startDate &&
    rulesAreValid &&
    (bookingMode === "occurrence_count"
      ? occurrenceCount >= minimumOccurrences && occurrenceCount <= 52
      : endDate && endDate >= startDate)
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
  const unresolvedOccurrences = occurrences.filter(
    (occurrence) => occurrence.action === "pending",
  );

  // ── Handlers ──
  const updateScheduleRule = (id: string, patch: Partial<ScheduleRuleForm>) => {
    setScheduleRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    );
  };

  const addScheduleRule = () => {
    if (scheduleRules.length >= 4) return;
    const lastRule = scheduleRules[scheduleRules.length - 1];
    setScheduleRules((current) => [
      ...current,
      {
        id: `rule-${Date.now()}`,
        dayOfWeek: ((lastRule?.dayOfWeek ?? 0) + 1) % 7,
        dayOfMonth: Math.min((lastRule?.dayOfMonth ?? 0) + 1, 31),
        timeStart: lastRule?.timeStart ?? "18:00",
        durationHours: lastRule?.durationHours ?? 2,
      },
    ]);
  };

  const removeScheduleRule = (id: string) => {
    setScheduleRules((current) => current.filter((rule) => rule.id !== id));
  };

  const buildSchedulePayload = () => ({
    courtId: parseInt(courtId),
    cycle,
    bookingMode,
    startDate,
    ...(bookingMode === "occurrence_count" ? { occurrenceCount } : { endDate }),
    rules: normalizedRules,
    timeStart,
    timeEnd,
  });

  const handlePreview = async () => {
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
    if (unresolvedOccurrences.length > 0) {
      toast.error(
        `Còn ${unresolvedOccurrences.length} buổi trùng lịch cần đổi lịch hoặc chọn bỏ qua.`,
      );
      return;
    }

    const decisions = occurrences.map((occ) => ({
      date: occ.date,
      action: occ.action as OccurrenceAction,
      ...(occ.action === "replace" && occ.selectedReplacement
        ? { replaceWithCourtId: occ.selectedReplacement.courtId }
        : {}),
      ...(occ.action === "custom"
        ? {
            replaceWithCourtId: occ.customCourtId,
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
      userId: user?.role !== "guest" ? user?.id : undefined,
      decisions,
    });

    if (result) {
      localStorage.setItem(
        "completedFixedBooking",
        JSON.stringify({
          fixedSchedule: {
            id: result.scheduleId,
            courtName:
              courts.find((c) => c.id === parseInt(courtId))?.name || "Sân",
            cycle,
            bookingMode,
            startDate,
            endDate: preview.endDate ?? endDate,
            occurrenceCount: result.bookingsCreated,
            invoiceCode: result.invoiceCode,
            totalAmount: result.totalAmount,
          },
          invoiceCode: result.invoiceCode,
          totalAmount: result.totalAmount,
          bookingsCreated: result.bookingsCreated,
        }),
      );
      router.push(`/booking/success?id=${result.scheduleId}`);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/20 to-emerald-50/30">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
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
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-4">
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
            Đặt sân định kỳ theo tuần hoặc tháng — không lo hết chỗ
          </p>
        </motion.div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-4 pb-24">
        <AnimatePresence mode="wait">
          {/* ════════ STEP 1 ════════ */}
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25 }}
              className="max-w-2xl mx-auto space-y-4"
            >
              {/* Chọn sân */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-600" /> Chọn sân
                </h2>
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

              {/* Thời gian */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-green-600" /> Thời gian đặt
                  sân
                </h2>

                {/* Đối tượng */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Đối tượng
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { value: "personal", label: "Cá nhân" },
                        { value: "group", label: "Nhóm" },
                        { value: "tournament", label: "Giải đấu" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCustomerType(opt.value)}
                        className={cn(
                          "h-10 rounded-xl border text-sm font-semibold transition-all",
                          customerType === opt.value
                            ? "border-green-600 bg-green-50 text-green-700"
                            : "border-gray-200 text-gray-500 hover:border-green-300",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chu kỳ */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Chu kỳ lặp <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          value: "weekly",
                          label: "Hàng tuần",
                          desc: "Lặp mỗi 7 ngày",
                        },
                        {
                          value: "monthly",
                          label: "Hàng tháng",
                          desc: "Lặp theo ngày trong tháng",
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCycle(opt.value)}
                        className={cn(
                          "min-h-14 rounded-xl border px-3 py-2 text-left transition-all",
                          cycle === opt.value
                            ? "border-green-600 bg-green-50 text-green-700"
                            : "border-gray-200 text-gray-600 hover:border-green-300",
                        )}
                      >
                        <span className="block text-sm font-semibold">
                          {opt.label}
                        </span>
                        <span className="block text-xs text-gray-400 mt-0.5">
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Cách tạo gói
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          value: "occurrence_count",
                          label: "Theo số buổi",
                          desc: "Chủ động chọn quy mô gói",
                        },
                        {
                          value: "date_range",
                          label: "Theo khoảng ngày",
                          desc: "Hệ thống xếp đến ngày kết thúc",
                        },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setBookingMode(option.value)}
                        className={cn(
                          "min-h-14 rounded-xl border px-3 py-2 text-left transition-all",
                          bookingMode === option.value
                            ? "border-green-600 bg-green-50 text-green-700"
                            : "border-gray-200 text-gray-600 hover:border-green-300",
                        )}
                      >
                        <span className="block text-sm font-semibold">
                          {option.label}
                        </span>
                        <span className="block text-xs text-gray-400 mt-0.5">
                          {option.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={cn(
                    "grid gap-3",
                    bookingMode === "date_range"
                      ? "grid-cols-2"
                      : "grid-cols-1",
                  )}
                >
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
                  {bookingMode === "date_range" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Ngày kết thúc <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate || today}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full h-11 px-3.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all"
                      />
                    </div>
                  )}
                </div>

                {bookingMode === "occurrence_count" && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Số buổi của gói <span className="text-red-400">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {OCCURRENCE_COUNT_PRESETS.map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setOccurrenceCount(count)}
                          className={cn(
                            "h-9 min-w-14 rounded-xl border text-sm font-semibold transition-all",
                            occurrenceCount === count
                              ? "border-green-600 bg-green-600 text-white"
                              : "border-gray-200 text-gray-600 hover:border-green-300",
                          )}
                        >
                          {count}
                        </button>
                      ))}
                      <input
                        type="number"
                        min={minimumOccurrences}
                        max={52}
                        value={occurrenceCount}
                        onChange={(event) =>
                          setOccurrenceCount(Number(event.target.value))
                        }
                        className="h-9 w-24 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
                        aria-label="Số buổi tùy chỉnh"
                      />
                    </div>
                    <p className="text-xs text-gray-400">
                      Tối thiểu {minimumOccurrences}, tối đa 52 buổi.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Lịch lặp{" "}
                      <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={addScheduleRule}
                      disabled={scheduleRules.length >= 4}
                      className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700 disabled:text-gray-300"
                    >
                      <Plus className="h-3.5 w-3.5" /> Thêm lịch
                    </button>
                  </div>

                  {scheduleRules.map((rule, index) => {
                    const endTime = addHoursToTime(
                      rule.timeStart,
                      rule.durationHours,
                    );
                    const exceedsClosingTime =
                      Number(endTime.split(":")[0]) > 23;
                    return (
                      <div
                        key={rule.id}
                        className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-700">
                            Lịch {index + 1}
                          </span>
                          {scheduleRules.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeScheduleRule(rule.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                              aria-label={`Xóa lịch ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {cycle === "weekly" ? (
                          <div className="grid grid-cols-7 gap-1">
                            {DAY_LABELS.map((day) => (
                              <button
                                key={day.value}
                                type="button"
                                onClick={() =>
                                  updateScheduleRule(rule.id, {
                                    dayOfWeek: day.value,
                                  })
                                }
                                title={day.label}
                                className={cn(
                                  "h-9 rounded-lg border text-xs font-semibold transition-all",
                                  rule.dayOfWeek === day.value
                                    ? "border-green-600 bg-green-600 text-white"
                                    : "border-gray-200 bg-white text-gray-500 hover:border-green-300",
                                )}
                              >
                                {day.short}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Ngày</span>
                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={rule.dayOfMonth}
                              onChange={(event) =>
                                updateScheduleRule(rule.id, {
                                  dayOfMonth: Math.min(
                                    31,
                                    Math.max(1, Number(event.target.value)),
                                  ),
                                })
                              }
                              className="h-9 w-20 px-3 border border-gray-200 bg-white rounded-lg text-sm"
                            />
                            <span className="text-xs text-gray-400">
                              hàng tháng
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-gray-500">
                              Giờ bắt đầu
                            </label>
                            <select
                              value={rule.timeStart}
                              onChange={(event) =>
                                updateScheduleRule(rule.id, {
                                  timeStart: event.target.value,
                                })
                              }
                              className="w-full h-10 px-3 border border-gray-200 bg-white rounded-lg text-sm"
                            >
                              {HOUR_OPTIONS.map((hour) => (
                                <option key={hour} value={hour}>
                                  {hour}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-500">
                              Thời lượng
                            </label>
                            <div className="grid grid-cols-3 gap-1">
                              {DURATION_OPTIONS.map((duration) => (
                                <button
                                  key={duration}
                                  type="button"
                                  onClick={() =>
                                    updateScheduleRule(rule.id, {
                                      durationHours: duration,
                                    })
                                  }
                                  className={cn(
                                    "h-10 rounded-lg border text-xs font-semibold",
                                    rule.durationHours === duration
                                      ? "border-green-600 bg-green-50 text-green-700"
                                      : "border-gray-200 bg-white text-gray-500",
                                  )}
                                >
                                  {duration} giờ
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <p
                          className={cn(
                            "text-xs",
                            exceedsClosingTime
                              ? "text-red-500"
                              : "text-green-700",
                          )}
                        >
                          Khung giờ: {rule.timeStart} – {endTime}
                          {exceedsClosingTime && " (vượt quá giờ hoạt động)"}
                        </p>
                      </div>
                    );
                  })}

                  <p className="text-xs text-gray-400 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-blue-400" />
                    Có thể tạo tối đa 4 lịch khác nhau trong cùng một gói.
                  </p>
                  {hasDuplicateRepeatDay && (
                    <p className="text-xs text-red-500">
                      Mỗi lịch cần chọn một ngày lặp khác nhau.
                    </p>
                  )}
                </div>
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
                        key={occ.date}
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
                    Gói hàng tháng được điều chỉnh tối đa 2 buổi; gói hàng tuần
                    tối đa 1 buổi.
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
                          {startDate} → {preview.endDate ?? endDate}
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
                    !isStep2Valid ||
                    !hasBillableOccurrences ||
                    unresolvedOccurrences.length > 0 ||
                    loadingConfirm
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
    timeStart: string,
    timeEnd: string,
  ) => void;
  onClose: () => void;
  checkSlot: (req: CheckSlotRequest) => Promise<CheckSlotResponse | null>;
}) {
  const [selectedSlot, setSelectedSlot] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckSlotResponse | null>(
    null,
  );
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);

  // Reset kết quả khi đổi khung giờ
  const handleSelectSlot = (start: string, end: string) => {
    setSelectedSlot({ start, end });
    setCheckResult(null);
    setSelectedCourtId(null);
  };

  const handleCheck = async () => {
    if (!selectedSlot) {
      toast.error("Vui lòng chọn khung giờ mới");
      return;
    }
    setChecking(true);
    const result = await checkSlot({
      courtId: originalCourtId,
      date: occ.date,
      timeStart: selectedSlot.start,
      timeEnd: selectedSlot.end,
    });
    setCheckResult(result);
    if (result) {
      // Auto-select sân đầu tiên available
      const first = result.courts.find((c) => c.available);
      setSelectedCourtId(first?.id ?? null);
      if (!result.hasAvailable) {
        toast.warning(
          "Không có sân nào trống trong khung giờ này. Hãy chọn giờ khác!",
        );
      }
    }
    setChecking(false);
  };

  const handleConfirm = () => {
    if (!selectedCourtId || !checkResult || !selectedSlot) return;
    const court = checkResult.courts.find((c) => c.id === selectedCourtId);
    if (!court || !court.available) {
      toast.error("Vui lòng chọn sân còn trống");
      return;
    }
    onConfirm(court.id, court.name, selectedSlot.start, selectedSlot.end);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">Đổi giờ cho buổi này</h3>
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
          {/* Chọn khung giờ theo buổi */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Chọn khung giờ mới
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
                    setCheckResult(null);
                    setSelectedCourtId(null);
                  }}
                  className="ml-auto text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Đổi
                </button>
              </div>
            )}

            {TIME_SESSIONS.map((session) => {
              const colors = SESSION_COLORS[session.color as SessionColor];
              const isActiveSession =
                selectedSlot &&
                session.slots.some(
                  (sl) =>
                    sl.start === selectedSlot.start &&
                    sl.end === selectedSlot.end,
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
                      const isSelected =
                        selectedSlot?.start === slot.start &&
                        selectedSlot?.end === slot.end;
                      // Nếu đã check, hiển thị availability ngay trên slot
                      const slotResult = checkResult?.courts;
                      return (
                        <button
                          key={slot.label}
                          type="button"
                          onClick={() => handleSelectSlot(slot.start, slot.end)}
                          className={cn(
                            "h-9 px-2 rounded-lg text-xs font-semibold border-2 transition-all text-left pl-3",
                            isSelected
                              ? colors.active
                              : `border-gray-200 text-gray-600 bg-white ${colors.slot}`,
                          )}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nút kiểm tra */}
          <button
            onClick={handleCheck}
            disabled={!selectedSlot || checking}
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {checking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Đang kiểm tra...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" /> Kiểm tra sân trống
              </>
            )}
          </button>

          {/* Danh sách sân */}
          {checkResult && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Sân available · {checkResult.timeStart}–{checkResult.timeEnd}
                {!checkResult.hasAvailable && (
                  <span className="ml-2 text-red-500 normal-case font-normal">
                    — Không có sân trống
                  </span>
                )}
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {checkResult.courts.map((court) => (
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
              !checkResult?.courts.find((c) => c.id === selectedCourtId)
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
  onSetAction: (date: string, action: OccurrenceAction) => void;
  onSetCustomAction: (
    date: string,
    courtId: number,
    courtName: string,
    timeStart: string,
    timeEnd: string,
  ) => void;
  checkSlot: (req: CheckSlotRequest) => Promise<CheckSlotResponse | null>;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleCustomConfirm = (
    courtId: number,
    courtName: string,
    timeStart: string,
    timeEnd: string,
  ) => {
    onSetCustomAction(occ.date, courtId, courtName, timeStart, timeEnd);
    setModalOpen(false);
    toast.success(`Đã đổi sang ${courtName} · ${timeStart}–${timeEnd}`);
  };

  const displayTime =
    occ.action === "custom" && occ.customTimeStart
      ? `${occ.customCourtName} · ${occ.customTimeStart}–${occ.customTimeEnd}`
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
                onClick={() => onSetAction(occ.date, "keep")}
              >
                Giữ
              </ActionBtn>
              <ActionBtn
                active={occ.action === "custom"}
                color="purple"
                onClick={() => setModalOpen(true)}
              >
                Đổi giờ
              </ActionBtn>
              <ActionBtn
                active={occ.action === "skip"}
                color="gray"
                onClick={() => onSetAction(occ.date, "skip")}
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
                onClick={() => onSetAction(occ.date, "replace")}
              >
                Sân bù
              </ActionBtn>
              <ActionBtn
                active={occ.action === "custom"}
                color="purple"
                onClick={() => setModalOpen(true)}
              >
                Đổi giờ
              </ActionBtn>
              <ActionBtn
                active={occ.action === "skip"}
                color="gray"
                onClick={() => onSetAction(occ.date, "skip")}
              >
                Bỏ
              </ActionBtn>
            </>
          ) : (
            // Không có sân bù: BẮT BUỘC đổi ngày/giờ hoặc chủ động bỏ
            <>
              <ActionBtn
                active={occ.action === "custom"}
                color="purple"
                onClick={() => setModalOpen(true)}
              >
                Đổi lịch
              </ActionBtn>
              <ActionBtn
                active={occ.action === "skip"}
                color="gray"
                onClick={() => onSetAction(occ.date, "skip")}
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
