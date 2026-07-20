"use client";

import { HelpCircle, PlayCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTutorial } from "./TutorialProvider";

export function TutorialTrigger() {
  const { isPromptOpen, startTutorial, closePrompt, restartTutorial } =
    useTutorial();

  return (
    <>
      <button
        type="button"
        onClick={restartTutorial}
        className="fixed bottom-5 right-24 z-[70] flex h-12 w-12 items-center justify-center rounded-full border border-green-200 bg-white text-green-700 shadow-xl shadow-green-900/10 transition-all hover:-translate-y-0.5 hover:border-green-400 hover:bg-green-50"
        aria-label="Xem hướng dẫn"
        title="Xem hướng dẫn"
      >
        <HelpCircle className="h-6 w-6" />
      </button>

      {isPromptOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/95 p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-green-600">
                  Hướng dẫn nhanh
                </p>
                <h2 className="mt-1 text-xl font-bold text-gray-950">
                  Bạn có muốn xem hướng dẫn đặt sân?
                </h2>
              </div>
              <button
                type="button"
                onClick={closePrompt}
                className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Đóng hướng dẫn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm leading-6 text-gray-600">
              Tutorial sẽ highlight từng khu vực quan trọng, có con trỏ ảo và
              tooltip giải thích từng bước. Bạn có thể xem lại bất cứ lúc nào
              bằng nút dấu hỏi.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closePrompt}
                className="rounded-xl"
              >
                Bỏ qua
              </Button>
              <Button
                type="button"
                onClick={startTutorial}
                className="gap-2 rounded-xl bg-green-600 text-white hover:bg-green-700"
              >
                <PlayCircle className="h-4 w-4" />
                Xem hướng dẫn
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
