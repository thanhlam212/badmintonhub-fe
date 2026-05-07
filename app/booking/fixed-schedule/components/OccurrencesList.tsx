'use client';

import { Calendar, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { Occurrence } from '../types';

interface Props {
  occurrences: Occurrence[];
  onToggleSkip: (date: string) => void;
}

export function OccurrencesList({ occurrences, onToggleSkip }: Props) {
  const selectedCount = occurrences.filter(occ => !occ.skip).length;
  const conflictCount = occurrences.filter(occ => !occ.available && !occ.skip).length;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Danh sách buổi đặt ({selectedCount}/{occurrences.length})
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Kiểm tra và điều chỉnh các buổi. Bỏ chọn các buổi không muốn đặt.
        </p>
      </div>

      {/* Summary */}
      {conflictCount > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700">
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm">
            Có {conflictCount} buổi bị trùng lịch. Vui lòng bỏ chọn các buổi này.
          </p>
        </div>
      )}

      {/* Occurrences List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {occurrences.map((occ) => (
          <div
            key={occ.date}
            className={`
              flex items-center justify-between p-4 rounded-lg border
              ${occ.skip ? 'bg-gray-50 opacity-60' : 'bg-white'}
              ${!occ.available && !occ.skip ? 'border-red-300 bg-red-50' : 'border-gray-200'}
            `}
          >
            <div className="flex items-center gap-3 flex-1">
              <input
                type="checkbox"
                checked={!occ.skip}
                onChange={() => onToggleSkip(occ.date)}
                disabled={!occ.available}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{occ.dayLabel}</span>
                  <span className="text-sm text-gray-500">{occ.date}</span>
                  
                  {/* Status Badge */}
                  {occ.available ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                      Khả dụng
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                      <XCircle className="h-3 w-3" />
                      Trùng lịch
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {occ.timeStart} - {occ.timeEnd}
                  </span>
                  <span>{occ.amount.toLocaleString()}đ</span>
                </div>

                {/* Conflicts Info */}
                {!occ.available && occ.conflicts.length > 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    Trùng: {occ.conflicts.map(c => c.time).join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}