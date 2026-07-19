"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

function VNPayReturnContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "failed">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [orderInfo, setOrderInfo] = useState("");
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    const responseCode = searchParams.get("vnp_ResponseCode");
    const amountRaw = searchParams.get("vnp_Amount");
    const info = searchParams.get("vnp_OrderInfo");

    if (amountRaw) setAmount(Number.parseInt(amountRaw, 10) / 100);
    if (info) setOrderInfo(decodeURIComponent(info));

    if (responseCode === "00") {
      setStatus("success");
      setMessage("Thanh toán thành công!");
      return;
    }

    if (!responseCode) {
      setStatus("failed");
      setMessage("Không thể xác nhận kết quả thanh toán.");
      return;
    }

    const errorMessages: Record<string, string> = {
      "07": "Trừ tiền thành công. Giao dịch bị nghi ngờ.",
      "09": "Thẻ/Tài khoản chưa đăng ký dịch vụ Internet Banking.",
      "10": "Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần.",
      "11": "Đã hết hạn chờ thanh toán.",
      "12": "Thẻ/Tài khoản bị khóa.",
      "13": "Sai OTP. Vui lòng thử lại.",
      "24": "Khách hàng hủy giao dịch.",
      "51": "Tài khoản không đủ số dư.",
      "65": "Tài khoản vượt quá hạn mức giao dịch trong ngày.",
      "75": "Ngân hàng thanh toán đang bảo trì.",
      "79": "Nhập sai mật khẩu thanh toán quá số lần quy định.",
      "99": "Giao dịch thất bại hoặc lỗi không xác định.",
    };
    setStatus("failed");
    setMessage(
      errorMessages[responseCode] ||
        `Thanh toán thất bại (mã lỗi: ${responseCode})`,
    );
  }, [searchParams]);

  const formatVND = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">
            Đang xử lý kết quả thanh toán...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-6 px-6 space-y-6">
          <div className="text-center">
            {status === "success" ? (
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
            )}
          </div>

          <div className="text-center space-y-1">
            <h1 className="font-serif text-xl font-bold">
              {status === "success"
                ? "Thanh toán thành công"
                : "Thanh toán thất bại"}
            </h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>

          {(amount !== null || orderInfo) && (
            <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
              {orderInfo && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nội dung</span>
                  <span className="font-medium text-right max-w-[60%]">
                    {orderInfo}
                  </span>
                </div>
              )}
              {amount !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Số tiền</span>
                  <span className="font-bold text-primary">
                    {formatVND(amount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phương thức</span>
                <span className="font-medium">VNPay</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {status === "success" ? (
              <>
                <Button asChild className="w-full">
                  <Link href="/my-bookings">
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Xem lịch đặt sân
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/">
                    <Home className="h-4 w-4 mr-2" /> Về trang chủ
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild className="w-full">
                  <Link href="/my-bookings">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Xem đơn đặt sân và
                    thử lại
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/">
                    <Home className="h-4 w-4 mr-2" /> Về trang chủ
                  </Link>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VNPayReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">
              Đang xử lý kết quả thanh toán...
            </p>
          </div>
        </div>
      }
    >
      <VNPayReturnContent />
    </Suspense>
  );
}
