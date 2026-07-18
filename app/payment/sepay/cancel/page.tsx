"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FIXED_CHECKOUT_STORAGE_KEY,
  type FixedScheduleCheckout,
} from "@/app/booking/fixed-schedule/types";

const PENDING_PAYMENT_SESSION_KEY = "pendingPaymentSession";

export default function SepayCancelPage() {
  const router = useRouter();

  useEffect(() => {
    const savedFixed = localStorage.getItem(FIXED_CHECKOUT_STORAGE_KEY);
    if (savedFixed) {
      try {
        const checkout = JSON.parse(savedFixed) as FixedScheduleCheckout;
        const next = {
          ...checkout,
          paymentStatus: "pending" as const,
          paymentError:
            "Bạn đã hủy thanh toán SePay. Hãy chọn lại phương thức thanh toán để tiếp tục giữ lịch.",
        };
        localStorage.setItem(FIXED_CHECKOUT_STORAGE_KEY, JSON.stringify(next));
        localStorage.setItem(
          `${FIXED_CHECKOUT_STORAGE_KEY}:${checkout.fixedSchedule.id}`,
          JSON.stringify(next),
        );
        router.replace(
          `/booking/success?id=${checkout.fixedSchedule.id}&retryPayment=1&cancelled=1`,
        );
        return;
      } catch {
        localStorage.removeItem(FIXED_CHECKOUT_STORAGE_KEY);
      }
    }

    if (localStorage.getItem(PENDING_PAYMENT_SESSION_KEY)) {
      router.replace("/booking?paymentCancelled=1");
      return;
    }

    router.replace("/booking");
  }, [router]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-500">Đang quay lại chọn thanh toán...</p>
    </main>
  );
}
