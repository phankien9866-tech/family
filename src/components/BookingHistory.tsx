import React from 'react';
import { Booking } from '../types';
import { Calendar, Clock, Coffee, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';

interface BookingHistoryProps {
  bookings: Booking[];
}

export const BookingHistory: React.FC<BookingHistoryProps> = ({ bookings }) => {
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatDateVietnamese = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${d}/${m}`;
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-3xs">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            Đã duyệt
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100 shadow-3xs">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 shadow-3xs">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            Chờ duyệt
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs" id="booking-history-container">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900 uppercase">Lịch sử đặt sân của tôi</h2>
          <p className="text-xs text-slate-500 mt-1">
            Hiển thị các đơn đặt sân được thực hiện trên thiết bị này.
          </p>
        </div>
        <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-3xs">
          {bookings.length} đơn đặt
        </span>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200" id="no-history">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">Bạn chưa có lịch đặt sân nào.</p>
          <p className="text-slate-400 text-xs mt-1">Hãy chọn một sân ở trên và tiến hành đặt ngay!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4" id="history-list">
          {bookings.map((booking) => {
            const isFixed = booking.bookingType === 'fixed';
            
            // Format grouped dates cleanly
            const formattedDates = booking.dates.map(d => formatDateVietnamese(d)).join(', ');

            return (
              <div 
                key={booking.id} 
                className="bg-white rounded-xl border border-slate-100 p-5 shadow-2xs hover:border-slate-200 transition-all flex flex-col md:flex-row justify-between gap-4"
                id={`booking-history-item-${booking.id}`}
              >
                {/* Booking details */}
                <div className="flex-grow">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="font-bold text-slate-800 text-sm md:text-base">
                      {booking.courtName}
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider ${
                      isFixed ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isFixed ? 'Lịch cố định' : 'Lịch đặt lẻ'}
                    </span>
                    {getStatusBadge(booking.status)}
                  </div>

                  {/* Date & Time with grouped fixed-schedule visualization */}
                  <div className="flex flex-col gap-1.5 text-xs text-slate-500 my-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Khung giờ: <strong className="font-semibold text-slate-700">{booking.startTime} - {booking.endTime}</strong></span>
                    </div>

                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="leading-tight">
                        <span>Các ngày: </span>
                        <strong className="text-slate-700 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md inline-block text-[11px] font-semibold mt-0.5">
                          {formattedDates}
                        </strong>
                      </div>
                    </div>

                    {(booking.hasRackets || booking.hasBalls) && (
                      <div className="flex items-center gap-2 mt-1">
                        <Coffee className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Dịch vụ: </span>
                        <span className="font-medium text-slate-600">
                          {[
                            booking.hasRackets && 'Thuê thêm vợt',
                            booking.hasBalls && 'Rổ bóng tập'
                          ].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notes if any */}
                  {booking.notes && (
                    <p className="text-xs bg-amber-50/50 text-amber-800 border border-amber-100/30 px-3 py-2 rounded-lg italic mt-2">
                      Ghi chú: {booking.notes}
                    </p>
                  )}
                </div>

                {/* Amount and Payment status side */}
                <div className="flex flex-col justify-between items-end shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                  <div className="text-right">
                    <span className="text-slate-400 text-xs block font-medium">Hình thức:</span>
                    <span className="text-xs font-semibold text-slate-700">
                      {booking.paymentMethod === 'banking' ? 'Chuyển Khoản' : 'Trực tiếp tại sân'}
                    </span>
                  </div>

                  <div className="text-right mt-3 md:mt-0">
                    <span className="text-slate-400 text-xs block font-medium">Tổng chi phí:</span>
                    <span className="text-lg font-black text-indigo-600">{formatVND(booking.totalAmount)}</span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
