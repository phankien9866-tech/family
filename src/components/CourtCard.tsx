import React from 'react';
import { Court } from '../types';
import { MapPin, Sparkles, CheckCircle2 } from 'lucide-react';

interface CourtCardProps {
  court: Court;
  onBookNow: (court: Court) => void;
}

export const CourtCard: React.FC<CourtCardProps> = ({ court, onBookNow }) => {
  const isIndoor = court.isActive; // or whatever, we can display badge depending on standard properties or if it has "Trong nhà" in its name

  // Format currency
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const isIndoorName = court.name.toLowerCase().includes('trong nhà');

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden h-full group" id={`court-card-${court.id}`}>
      
      {/* Court Photo */}
      <div className="relative h-44 w-full bg-slate-100 overflow-hidden shrink-0">
        <img 
          src={court.imageUrl || 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80'} 
          alt={court.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-3 right-3">
          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-xs uppercase tracking-wide ${
            isIndoorName ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'
          }`}>
            {isIndoorName ? 'Trong Nhà' : 'Ngoài Trời'}
          </span>
        </div>
      </div>

      {/* Decorative Top Bar reflecting type */}
      <div className={`h-1.5 w-full ${isIndoorName ? 'bg-indigo-500' : 'bg-amber-500'}`} />

      <div className="p-6 flex flex-col flex-grow">
        {/* Court Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            isIndoorName ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
          }`}>
            {isIndoorName ? 'Sân Trong Nhà' : 'Sân Ngoài Trời'}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            court.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
          }`}>
            {court.isActive ? 'Đang hoạt động' : 'Tạm dừng'}
          </span>
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

        {/* Amenities List / Description */}
        <div className="mb-5 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50 flex-grow">
          <span className="text-xs font-medium text-slate-400 block mb-2 uppercase tracking-wider">Mô tả & Tiện ích:</span>
          <p className="text-xs text-slate-600 mb-3 leading-relaxed">{court.description || 'Không có mô tả chi tiết.'}</p>
          <div className="flex flex-col gap-1.5 border-t border-slate-200/60 pt-2.5">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Giá sàn ngày: {formatVND(court.priceDay)}/h</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Giá lẻ tối (Có đèn): {formatVND(court.priceRetailNight)}/h</span>
            </div>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="pt-4 border-t border-slate-100">
          <span className="text-xs font-medium text-slate-400 block mb-2 uppercase tracking-wider">Thông tin giá thuê vợt & bóng:</span>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-4">
            <div className="flex flex-col bg-slate-50 p-2 rounded-lg border border-slate-100">
              <span className="text-slate-400 font-normal">Thuê vợt:</span>
              <span className="font-bold text-slate-800">{formatVND(court.priceRentalRack)}/buổi</span>
            </div>
            <div className="flex flex-col bg-slate-50 p-2 rounded-lg border border-slate-100">
              <span className="text-slate-400 font-normal">Rổ bóng:</span>
              <span className="font-bold text-slate-800">{formatVND(court.priceRentalBall)}/buổi</span>
            </div>
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
