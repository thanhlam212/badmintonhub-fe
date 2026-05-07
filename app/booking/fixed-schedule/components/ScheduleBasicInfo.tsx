'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
import type { FixedScheduleCycle } from '../types';

interface Court {
  id: number;
  name: string;
  price: number;
  type: string;
}

interface Props {
  onPreview: (data: {
    courtId: number;
    cycle: FixedScheduleCycle;
    startDate: string;
    endDate: string;
    timeStart: string;
    timeEnd: string;
  }) => void;
  loading?: boolean;
}

export function ScheduleBasicInfo({ onPreview, loading }: Props) {
  const [courts, setCourts] = useState<Court[]>([]);
  const [formData, setFormData] = useState({
    courtId: '',
    cycle: 'weekly' as FixedScheduleCycle,
    startDate: '',
    endDate: '',
    timeStart: '08:00',
    timeEnd: '10:00',
  });

  // Fetch courts
  useEffect(() => {
    const fetchCourts = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/courts`);
        const data = await response.json();
        setCourts(data);
      } catch (error) {
        console.error('Error fetching courts:', error);
      }
    };
    fetchCourts();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.courtId || !formData.startDate || !formData.endDate) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }
    onPreview({
      courtId: parseInt(formData.courtId),
      cycle: formData.cycle,
      startDate: formData.startDate,
      endDate: formData.endDate,
      timeStart: formData.timeStart,
      timeEnd: formData.timeEnd,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Thông tin cơ bản
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Chọn sân, chu kỳ và khoảng thời gian bạn muốn đặt lịch cố định
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Court Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Chọn sân *</label>
          <select
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.courtId}
            onChange={(e) => setFormData(prev => ({ ...prev, courtId: e.target.value }))}
            required
          >
            <option value="">Chọn sân cầu lông</option>
            {courts.map(court => (
              <option key={court.id} value={court.id}>
                {court.name} - {court.type} - {court.price.toLocaleString()}đ/giờ
              </option>
            ))}
          </select>
        </div>

        {/* Cycle Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Chu kỳ đặt lịch *</label>
          <select
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.cycle}
            onChange={(e) => setFormData(prev => ({ ...prev, cycle: e.target.value as FixedScheduleCycle }))}
          >
            <option value="weekly">Hàng tuần (tối thiểu 4 tuần)</option>
            <option value="monthly">Hàng tháng (tối thiểu 2 tháng)</option>
          </select>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Ngày bắt đầu *</label>
            <input
              type="date"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.startDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Ngày kết thúc *</label>
            <input
              type="date"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.endDate}
              min={formData.startDate || new Date().toISOString().split('T')[0]}
              onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              required
            />
          </div>
        </div>

        {/* Time Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Giờ bắt đầu *</label>
            <input
              type="time"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.timeStart}
              onChange={(e) => setFormData(prev => ({ ...prev, timeStart: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Giờ kết thúc *</label>
            <input
              type="time"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.timeEnd}
              onChange={(e) => setFormData(prev => ({ ...prev, timeEnd: e.target.value }))}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? 'Đang xử lý...' : 'Xem trước lịch đặt'}
        </button>
      </form>
    </div>
  );
}