import React from 'react';
import { Court } from '../types';
import { MapPin, Sparkles, CheckCircle2 } from 'lucide-react';

interface CourtCardProps {
  court: Court;
  onBookNow: (court: Court) => void;
}

export const CourtCard: React.FC<CourtCardProps> = ({ court, onBookNow }) => {
  const isIndoor = court.type === 'trong_nha';

  // Format currency
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden h-full group" id={`court-card-${court.id}`}>
      {/* Decorative Top Bar reflecting type */}
      <div className={`h-2 w-full ${isIndoor ? 'bg-indigo-500' : 'bg-amber-500'}`} />

      <div className="p-6 flex flex-col flex-grow">
        {/* Court Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            isIndoor ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
          }`}>
            {isIndoor ? 'Sân Trong Nhà' : 'Sân Ngoài Trời'}
          </span>
          {court.amenities.some(a => a.toLowerCase().includes('mái che')) && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
              Có mái che
            </span>
          )}
        </div>

        {/* Court Name */}
        <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-2">
          {court.name}
        </h3>

        {/* Address */}
        <div className="flex items-start gap-1.5 text-slate-500 text-sm mb-4">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{court.address}</span>
        </div>

        {/* Amenities List */}
        <div className="mb-5 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
          <span className="text-xs font-medium text-slate-400 block mb-2 uppercase tracking-wider">Tiện ích sân:</span>
          <div className="flex flex-col gap-1.5">
            {court.amenities.map((amenity, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>{amenity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="mt-auto pt-4 border-t border-slate-100">
          <span className="text-xs font-medium text-slate-400 block mb-2 uppercase tracking-wider">Bảng giá áp dụng:</span>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-4">
            <div className="flex flex-col bg-slate-50 p-2 rounded-lg border border-slate-100">
              <span className="text-slate-400 font-normal">Giờ ngày:</span>
              <span className="font-bold text-slate-800">{formatVND(court.pricing.dayRate)}/h</span>
            </div>

            {isIndoor ? (
              <div className="flex flex-col bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span className="text-slate-400 font-normal">Đèn cố định:</span>
                <span className="font-bold text-slate-800">{formatVND(court.pricing.fixedLightNight || 100000)}/h</span>
              </div>
            ) : (
              <div className="flex flex-col bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span className="text-slate-400 font-normal">Giờ tối (Đèn):</span>
                <span className="font-bold text-slate-800">{formatVND(court.pricing.nightRate)}/h</span>
              </div>
            )}
          </div>

          <button
            onClick={() => onBookNow(court)}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer focus:ring-4 focus:ring-indigo-100"
            id={`btn-book-${court.id}`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Đặt Sân Ngay</span>
          </button>
        </div>
      </div>
    </div>
  );
};
