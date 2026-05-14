'use client';

import { Calendar, Clock, CheckCircle2, XCircle, RefreshCw, SkipForward } from 'lucide-react';
import type { OccurrenceUIState, OccurrenceAction } from '../types';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Props {
  occurrences: OccurrenceUIState[];
  onSetAction: (date: string, action: OccurrenceAction) => void;
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function StatusBadge({ occ }: { occ: OccurrenceUIState }) {
  if (!occ.hasConflict) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
        <CheckCircle2 className="h-3 w-3" />
        Khả dụng
      </span>
    );
  }
  if (occ.suggestedReplacement) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
        <RefreshCw className="h-3 w-3" />
        Có sân bù
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
      <XCircle className="h-3 w-3" />
      Trùng lịch
    </span>
  );
}

function ActionButtons({
  occ,
  onSetAction,
}: {
  occ: OccurrenceUIState;
  onSetAction: (date: string, action: OccurrenceAction) => void;
}) {
  // Buổi không conflict → chỉ có 2 option: keep hoặc skip
  if (!occ.hasConflict) {
    return (
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onSetAction(occ.date, 'keep')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            occ.action === 'keep'
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
          }`}
        >
          <CheckCircle2 className="h-3 w-3" />
          Giữ buổi
        </button>
        <button
          onClick={() => onSetAction(occ.date, 'skip')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            occ.action === 'skip'
              ? 'bg-gray-500 text-white border-gray-500'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          }`}
        >
          <SkipForward className="h-3 w-3" />
          Bỏ buổi
        </button>
      </div>
    );
  }

  // Buổi conflict có sân bù → 3 option: replace, skip
  if (occ.suggestedReplacement) {
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        <button
          onClick={() => onSetAction(occ.date, 'replace')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            occ.action === 'replace'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-blue-600 border-blue-300 hover:border-blue-500'
          }`}
        >
          <RefreshCw className="h-3 w-3" />
          Dùng {occ.suggestedReplacement.courtName}
        </button>
        <button
          onClick={() => onSetAction(occ.date, 'skip')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            occ.action === 'skip'
              ? 'bg-gray-500 text-white border-gray-500'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          }`}
        >
          <SkipForward className="h-3 w-3" />
          Bỏ buổi
        </button>
      </div>
    );
  }

  // Buổi conflict không tìm được sân bù → chỉ có thể skip
  return (
    <div className="mt-2">
      <span className="text-xs text-red-600 italic">
        Không tìm được sân thay thế — buổi này sẽ bị bỏ qua
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function OccurrencesList({ occurrences, onSetAction }: Props) {
  const keptCount = occurrences.filter(
    (o) => o.action === 'keep' || o.action === 'replace',
  ).length;
  const skippedCount = occurrences.filter((o) => o.action === 'skip').length;
  const replacedCount = occurrences.filter((o) => o.action === 'replace').length;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Danh sách buổi ({keptCount}/{occurrences.length} buổi)
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Kiểm tra và chọn cách xử lý cho từng buổi trước khi thanh toán
        </p>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-3 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">
          ✅ {occurrences.filter((o) => !o.hasConflict).length} buổi khả dụng
        </span>
        {replacedCount > 0 && (
          <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
            🔄 {replacedCount} buổi dùng sân bù
          </span>
        )}
        {skippedCount > 0 && (
          <span className="px-3 py-1 bg-gray-50 text-gray-600 text-xs rounded-full border border-gray-200">
            ⏭ {skippedCount} buổi bỏ qua
          </span>
        )}
      </div>

      {/* Occurrences list */}
      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {occurrences.map((occ) => (
          <div
            key={occ.date}
            className={`p-4 rounded-lg border transition-colors ${
              occ.action === 'skip'
                ? 'bg-gray-50 border-gray-200 opacity-60'
                : occ.action === 'replace'
                ? 'bg-blue-50 border-blue-200'
                : occ.hasConflict
                ? 'bg-amber-50 border-amber-200'
                : 'bg-white border-gray-200'
            }`}
          >
            {/* Row 1: Date info + status badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{occ.dayLabel}</span>
                <span className="text-gray-500 text-sm">{occ.date}</span>
                <StatusBadge occ={occ} />
              </div>
            </div>

            {/* Row 2: Time + replacement info */}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {/* Nếu đang replace, hiển thị sân bù */}
                {occ.action === 'replace' && occ.selectedReplacement
                  ? `${occ.selectedReplacement.courtName} • ${occ.selectedReplacement.timeStart}-${occ.selectedReplacement.timeEnd}`
                  : `${occ.timeStart} - ${occ.timeEnd}`}
              </span>

              {/* Hiển thị conflict info */}
              {occ.hasConflict && occ.conflicts.length > 0 && (
                <span className="text-xs text-red-500">
                  Trùng giờ: {occ.conflicts.map((c) => c.time).join(', ')}
                </span>
              )}
            </div>

            {/* Row 3: Action buttons */}
            <ActionButtons occ={occ} onSetAction={onSetAction} />
          </div>
        ))}
      </div>
    </div>
  );
}