'use client';

import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import type { FixedScheduleCycle, FixedSchedulePreviewRequest, Court } from '../types';

interface Props {
  onPreview: (data: FixedSchedulePreviewRequest) => void;
  loading?: boolean;
}

export function ScheduleBasicInfo({ onPreview, loading }: Props) {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(true);
  const [formData, setFormData] = useState({
    courtId: '',
    cycle: 'weekly' as FixedScheduleCycle,
    startDate: '',
    endDate: '',
    timeStart: '08:00',
    timeEnd: '10:00',
  });

  useEffect(() => {
    const fetchCourts = async () => {
      try {
        setLoadingCourts(true);
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const res = await fetch(`${API_URL}/courts`);
        if (!res.ok) throw new Error('Failed to fetch courts');
        const data = await res.json();
        // Handle cả { data: [...] } lẫn [...]
        setCourts(Array.isArray(data) ? data : data.data || []);
      } catch (err) {
        console.error('Error fetching courts:', err);
        setCourts([]);
      } finally {
        setLoadingCourts(false);
      }
    };
    fetchCourts();
  }, []);

  const set = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.courtId || !formData.startDate || !formData.endDate) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    onPreview({
      courtId: parseInt(formData.courtId), // ← Chuyển sang number trước khi gửi lên hook
      cycle: formData.cycle,
      startDate: formData.startDate,
      endDate: formData.endDate,
      timeStart: formData.timeStart,
      timeEnd: formData.timeEnd,
    });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Thông tin cơ bản
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Chọn sân, chu kỳ và khoảng thời gian muốn đặt lịch cố định
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Chọn sân */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Chọn sân <span className="text-red-500">*</span>
          </label>
          {loadingCourts ? (
            <div className="w-full px-3 py-2 border rounded-lg text-gray-400 text-sm">
              Đang tải danh sách sân...
            </div>
          ) : (
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.courtId}
              onChange={(e) => set('courtId', e.target.value)}
              required
            >
              <option value="">Chọn sân cầu lông</option>
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {court.name} — {court.type} — {court.price.toLocaleString('vi-VN')}đ/giờ
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Chu kỳ */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Chu kỳ đặt lịch <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.cycle}
            onChange={(e) => set('cycle', e.target.value)}
          >
            <option value="weekly">Hàng tuần (tối thiểu 4 tuần)</option>
            <option value="monthly">Hàng tháng (tối thiểu 2 chu kỳ)</option>
          </select>
        </div>

        {/* Ngày bắt đầu / kết thúc */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Ngày bắt đầu <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.startDate}
              min={today}
              onChange={(e) => set('startDate', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Ngày kết thúc <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.endDate}
              min={formData.startDate || today}
              onChange={(e) => set('endDate', e.target.value)}
              required
            />
          </div>
        </div>

        {/* Giờ bắt đầu / kết thúc */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Giờ bắt đầu <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.timeStart}
              onChange={(e) => set('timeStart', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Giờ kết thúc <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.timeEnd}
              onChange={(e) => set('timeEnd', e.target.value)}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || loadingCourts}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Đang xử lý...' : 'Xem trước lịch đặt →'}
        </button>
      </form>
    </div>
  );
}