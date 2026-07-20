"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  MousePointer2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTutorial } from "./TutorialProvider";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const PADDING = 10;
const TOOLTIP_WIDTH = 360;
const TOOLTIP_GAP = 18;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getElementRect(selector: string): Rect | null {
  const element = Array.from(
    document.querySelectorAll<HTMLElement>(selector),
  ).find((item) => {
    const rect = item.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  if (!element) return null;

  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });

  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export function TutorialOverlay() {
  const {
    steps,
    currentStep,
    isActive,
    nextStep,
    prevStep,
    skipTutorial,
  } = useTutorial();
  const step = steps[currentStep];
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!isActive || !step) return;

    let frame = 0;
    const update = () => {
      frame = window.requestAnimationFrame(() => {
        setRect(getElementRect(step.targetSelector));
      });
    };

    update();
    const afterScrollTimer = window.setTimeout(update, 420);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(afterScrollTimer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [currentStep, isActive, step]);

  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") nextStep();
      if (event.key === "ArrowLeft") prevStep();
      if (event.key === "Escape") skipTutorial();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isActive, nextStep, prevStep, skipTutorial]);

  const paddedRect = useMemo(() => {
    if (!rect) return null;
    return {
      top: Math.max(8, rect.top - PADDING),
      left: Math.max(8, rect.left - PADDING),
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
    };
  }, [rect]);

  const tooltipStyle = useMemo(() => {
    if (typeof window === "undefined") return {};

    if (!paddedRect || step?.position === "center") {
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const maxLeft = window.innerWidth - TOOLTIP_WIDTH - 16;
    const midX = paddedRect.left + paddedRect.width / 2 - TOOLTIP_WIDTH / 2;
    const midY = paddedRect.top + paddedRect.height / 2;
    const preferred = step?.position ?? "bottom";

    if (preferred === "right") {
      return {
        left: clamp(paddedRect.left + paddedRect.width + TOOLTIP_GAP, 16, maxLeft),
        top: clamp(midY - 120, 16, window.innerHeight - 260),
      };
    }

    if (preferred === "left") {
      return {
        left: clamp(paddedRect.left - TOOLTIP_WIDTH - TOOLTIP_GAP, 16, maxLeft),
        top: clamp(midY - 120, 16, window.innerHeight - 260),
      };
    }

    if (preferred === "top") {
      return {
        left: clamp(midX, 16, maxLeft),
        top: clamp(paddedRect.top - 230, 16, window.innerHeight - 260),
      };
    }

    return {
      left: clamp(midX, 16, maxLeft),
      top: clamp(paddedRect.top + paddedRect.height + TOOLTIP_GAP, 16, window.innerHeight - 260),
    };
  }, [paddedRect, step?.position]);

  if (!isActive || !step) return null;

  const total = steps.length;
  const progress = ((currentStep + 1) / total) * 100;
  const cursorX = paddedRect ? paddedRect.left + paddedRect.width * 0.6 : 0;
  const cursorY = paddedRect ? paddedRect.top + paddedRect.height * 0.55 : 0;
  const isClickAction = step.action === "click";
  const isShakeAction = step.action === "shake";

  return (
    <div className="fixed inset-0 z-[85] pointer-events-auto">
      {paddedRect ? (
        <>
          <div
            className="fixed left-0 right-0 top-0 bg-black/65 backdrop-blur-[1px]"
            style={{ height: paddedRect.top }}
          />
          <div
            className="fixed left-0 bg-black/65 backdrop-blur-[1px]"
            style={{
              top: paddedRect.top,
              width: paddedRect.left,
              height: paddedRect.height,
            }}
          />
          <div
            className="fixed right-0 bg-black/65 backdrop-blur-[1px]"
            style={{
              top: paddedRect.top,
              left: paddedRect.left + paddedRect.width,
              height: paddedRect.height,
            }}
          />
          <div
            className="fixed bottom-0 left-0 right-0 bg-black/65 backdrop-blur-[1px]"
            style={{ top: paddedRect.top + paddedRect.height }}
          />
          <motion.div
            className="fixed rounded-2xl border-2 border-green-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.05),0_0_28px_rgba(34,197,94,0.7)]"
            style={{
              top: paddedRect.top,
              left: paddedRect.left,
              width: paddedRect.width,
              height: paddedRect.height,
            }}
            animate={
              isShakeAction
                ? { x: [0, -5, 5, -4, 4, 0] }
                : { scale: [1, 1.015, 1] }
            }
            transition={{ duration: isShakeAction ? 0.6 : 1.5, repeat: Infinity }}
          />
          <motion.div
            className="fixed z-[88] text-black drop-shadow-xl"
            initial={false}
            animate={{ x: cursorX, y: cursorY }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
          >
            <MousePointer2 className="h-8 w-8 -translate-x-1 -translate-y-1 rotate-[-10deg]" />
            {isClickAction && (
              <motion.span
                className="absolute left-3 top-3 h-8 w-8 rounded-full border-2 border-black/70"
                animate={{ scale: [0.2, 1.6], opacity: [0.9, 0] }}
                transition={{ duration: 1.1, repeat: Infinity }}
              />
            )}
          </motion.div>
        </>
      ) : (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-[1px]" />
      )}

      <motion.div
        className="fixed z-[90] w-[calc(100vw-32px)] max-w-[360px] overflow-hidden rounded-2xl border border-white/40 bg-white/90 shadow-2xl backdrop-blur-xl"
        style={tooltipStyle}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        key={currentStep}
      >
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-green-600">
                Bước {currentStep + 1}/{total}
              </p>
              <h3 className="mt-1 text-base font-bold text-gray-950">
                {step.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={skipTutorial}
              className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Bỏ qua hướng dẫn"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm leading-6 text-gray-600">{step.description}</p>
          {!paddedRect && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Khu vực này có thể chỉ xuất hiện sau khi bạn hoàn thành bước trên
              trang.
            </p>
          )}
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 0}
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-xl border px-3 text-sm font-semibold transition-colors",
                currentStep === 0
                  ? "cursor-not-allowed border-gray-100 text-gray-300"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50",
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </button>
            <button
              type="button"
              onClick={nextStep}
              className="inline-flex h-9 items-center gap-1 rounded-xl bg-green-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              {currentStep === total - 1 ? "Hoàn tất" : "Tiếp"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
