"use client";

export type TutorialAction = "point" | "click" | "drag" | "shake" | "scroll";
export type TutorialPosition = "top" | "right" | "bottom" | "left" | "center";

export type TutorialStep = {
  targetSelector: string;
  title: string;
  description: string;
  action?: TutorialAction;
  position?: TutorialPosition;
};

export const courtDetailTutorialSteps: TutorialStep[] = [
  {
    targetSelector: '[data-tutorial="court-week-calendar"]',
    title: "Bảng lịch theo tuần",
    description:
      "Đây là bảng lịch trống theo tuần. Mỗi ô là một khung giờ của sân trong ngày.",
    action: "point",
    position: "right",
  },
  {
    targetSelector: '[data-tutorial="court-week-nav"]',
    title: "Chuyển tuần",
    description:
      "Dùng hai nút mũi tên để xem tuần trước hoặc tuần sau trước khi chọn slot.",
    action: "click",
    position: "bottom",
  },
  {
    targetSelector: '[data-tutorial="court-available-slot"]',
    title: "Chọn slot trống",
    description:
      "Ô màu xanh là slot còn trống. Nhấn vào ô để chọn khung giờ muốn đặt.",
    action: "click",
    position: "top",
  },
  {
    targetSelector: '[data-tutorial="court-unavailable-slot"]',
    title: "Slot đã có người đặt",
    description:
      "Ô đỏ, xám hoặc giữ chỗ là slot không thể chọn. Hãy chọn một ô xanh khác.",
    action: "shake",
    position: "top",
  },
  {
    targetSelector: '[data-tutorial="court-total"]',
    title: "Tổng tiền",
    description:
      "Khu vực này hiển thị số slot đã chọn và tổng tiền tạm tính trước khi đặt.",
    action: "point",
    position: "left",
  },
  {
    targetSelector: '[data-tutorial="court-booking-button"]',
    title: "Tiếp tục đặt sân",
    description:
      "Sau khi chọn đủ slot, nhấn nút này để chuyển sang bước xác nhận và thanh toán.",
    action: "click",
    position: "left",
  },
];

export const fixedScheduleTutorialSteps: TutorialStep[] = [
  {
    targetSelector: '[data-tutorial="fixed-court-select"]',
    title: "Chọn sân cố định",
    description:
      "Chọn sân bạn muốn đặt lịch cố định. Giá theo giờ sẽ được dùng để tính tổng tiền.",
    action: "click",
    position: "bottom",
  },
  {
    targetSelector: '[data-tutorial="fixed-day-rules"]',
    title: "Thiết lập ngày chơi",
    description:
      "Chọn ngày bắt đầu cho thẻ lịch, hệ thống sẽ tự suy ra thứ trong tuần tương ứng.",
    action: "click",
    position: "right",
  },
  {
    targetSelector: '[data-tutorial="fixed-time-slots"]',
    title: "Chọn khung giờ",
    description:
      "Chọn các khung giờ liền nhau theo buổi sáng, chiều hoặc tối để tạo một lịch hợp lệ.",
    action: "click",
    position: "left",
  },
  {
    targetSelector: '[data-tutorial="fixed-repeat-weeks"]',
    title: "Số tuần lặp lại",
    description:
      "Lịch cố định cần tối thiểu 4 tuần. Bạn có thể tăng giảm số tuần trong phần này.",
    action: "click",
    position: "top",
  },
  {
    targetSelector: '[data-tutorial="fixed-start-date"]',
    title: "Ngày bắt đầu",
    description:
      "Chọn ngày bắt đầu cho toàn bộ gói lịch. Ngày kết thúc sẽ được tự tính theo số tuần.",
    action: "click",
    position: "top",
  },
  {
    targetSelector: '[data-tutorial="fixed-preview-button"]',
    title: "Xem trước lịch",
    description:
      "Nhấn để kiểm tra toàn bộ buổi đặt, phát hiện trùng lịch và xem gợi ý xử lý.",
    action: "click",
    position: "top",
  },
  {
    targetSelector: '[data-tutorial="fixed-occurrences"]',
    title: "Danh sách buổi",
    description:
      "Ở bước xác nhận, bạn có thể xem từng buổi đặt và xử lý các buổi bị trùng lịch.",
    action: "scroll",
    position: "right",
  },
  {
    targetSelector: '[data-tutorial="fixed-payment-info"]',
    title: "Thông tin và thanh toán",
    description:
      "Điền thông tin khách hàng, chọn phương thức thanh toán và xác nhận đặt lịch.",
    action: "point",
    position: "left",
  },
];
