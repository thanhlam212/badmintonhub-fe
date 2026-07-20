"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  FIXED_CHECKOUT_STORAGE_KEY,
  type FixedScheduleCheckout,
} from "@/app/booking/fixed-schedule/types";
import { paymentApi } from "@/lib/api";

type ReturnStatus = "loading" | "success" | "failed";

const PENDING_PAYMENT_SESSION_KEY = "pendingPaymentSession";
const BOOKING_FORM_DRAFT_KEY = "bookingFormDraft";

interface PendingPaymentSession {
  bookingId: string;
  invoiceId: string;
  paymentId?: string;
  completedData: Record<string, any>;
}

function MomoReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<ReturnStatus>("loading");
  const [message, setMessage] = useState("Đang xử lý kết quả MoMo...");

  useEffect(() => {
    let active = true;

    const handleReturn = async () => {
      const gatewaySuccess = searchParams.get("resultCode") === "0";
      const gatewayMessage =
        searchParams.get("message") ||
        (gatewaySuccess
          ? "MoMo đã tiếp nhận giao dịch."
          : "Giao dịch MoMo không thành công.");

      const savedRegularSession = localStorage.getItem(
        PENDING_PAYMENT_SESSION_KEY,
      );
      if (savedRegularSession) {
        try {
          const session = JSON.parse(
            savedRegularSession,
          ) as PendingPaymentSession;

          if (!gatewaySuccess) {
            router.replace("/booking");
            return;
          }

          if (session.paymentId) {
            const paymentStatus = await paymentApi.getStatus(session.paymentId);
            if (!active) return;

            const statusValue = paymentStatus.data?.status;
            const invoiceStatus = paymentStatus.data?.invoiceStatus;

            if (
              paymentStatus.success &&
              (statusValue === "success" || invoiceStatus === "paid")
            ) {
              localStorage.setItem(
                "completedBooking",
                JSON.stringify({
                  ...session.completedData,
                  status: "confirmed",
                }),
              );
              localStorage.removeItem("pendingBooking");
              localStorage.removeItem(BOOKING_FORM_DRAFT_KEY);
              localStorage.removeItem(PENDING_PAYMENT_SESSION_KEY);
              router.replace("/booking/success");
              return;
            }

            if (paymentStatus.success && statusValue === "failed") {
              router.replace("/booking");
              return;
            }
          }

          setStatus("success");
          setMessage(
            "MoMo đã tiếp nhận giao dịch. Vui lòng kiểm tra lịch đặt trong giây lát.",
          );
          return;
        } catch {
          localStorage.removeItem(PENDING_PAYMENT_SESSION_KEY);
        }
      }

      const savedCheckout = localStorage.getItem(FIXED_CHECKOUT_STORAGE_KEY);
      if (savedCheckout) {
        try {
          const checkout = JSON.parse(savedCheckout) as FixedScheduleCheckout;
          localStorage.setItem(
            FIXED_CHECKOUT_STORAGE_KEY,
            JSON.stringify({
              ...checkout,
              paymentStatus: gatewaySuccess ? "pending" : "failed",
              paymentError: gatewaySuccess ? undefined : gatewayMessage,
            }),
          );
          router.replace(`/booking/success?id=${checkout.fixedSchedule.id}`);
          return;
        } catch {
          localStorage.removeItem(FIXED_CHECKOUT_STORAGE_KEY);
        }
      }

      setStatus(gatewaySuccess ? "success" : "failed");
      setMessage(gatewayMessage);
    };

    void handleReturn();
    return () => {
      active = false;
    };
  }, [router, searchParams]);

  if (status === "loading") {
    return <ReturnLoading />;
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        {status === "success" ? (
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
        ) : (
          <XCircle className="mx-auto h-16 w-16 text-red-600" />
        )}
        <h1 className="mt-4 text-2xl font-bold">
          {status === "success"
            ? "MoMo đã tiếp nhận giao dịch"
            : "Thanh toán thất bại"}
        </h1>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        <Link
          href="/my-bookings"
          className="mt-6 inline-flex rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white"
        >
          Xem lịch đặt
        </Link>
      </div>
    </main>
  );
}

function ReturnLoading() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-green-600" />
        <p className="mt-3 text-sm text-gray-500">
          Đang xử lý kết quả MoMo...
        </p>
      </div>
    </main>
  );
}

export default function MomoReturnPage() {
  return (
    <Suspense fallback={<ReturnLoading />}>
      <MomoReturnContent />
    </Suspense>
  );
}
