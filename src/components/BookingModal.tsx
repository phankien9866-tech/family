import React, { useState, useEffect } from 'react';
import { Court, Booking, SystemConfig } from '../types';
import { X, Calendar, Clock, Sparkles, CheckSquare, CreditCard, ShieldAlert, Zap } from 'lucide-react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface BookingModalProps {
  court: Court;
  onClose: () => void;
  onBookingSuccess: () => void;
  deviceId: string;
  systemConfig: SystemConfig;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  court,
  onClose,
  onBookingSuccess,
  deviceId,
  systemConfig
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [bookingType, setBookingType] = useState<'retail' | 'fixed'>('retail');
  
  // Active lamp request state ("Yêu cầu bật đèn sân")
  const [isLightRequired, setIsLightRequired] = useState(false);

  // For 'retail' (Đặt lẻ một lần)
  const [singleDate, setSingleDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // For 'fixed' (Đặt lịch cố định)
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 30); // 1 month range default
    return today.toISOString().split('T')[0];
  });
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 3, 5]); // default Mon, Wed, Fri
  
  // Time Slot Selection
  const [startHour, setStartHour] = useState('17:00');
  const [endHour, setEndHour] = useState('19:00');

  // Extra services
  const [hasRackets, setHasRackets] = useState(false);
  const [hasBalls, setHasBalls] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'banking'>('banking');
  const [notes, setNotes] = useState('');

  const [calculatedDates, setCalculatedDates] = useState<string[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Restored full reference pricing table (left column)
  const pricingOptionsDisplay = [
    { id: 'priceDay', label: 'Không dùng đèn (Ban ngày)', rate: court.priceDay },
    { id: 'priceFixedDay', label: 'Có đèn - Cố định (5h - 17h)', rate: court.priceFixedDay },
    { id: 'priceFixedNight', label: 'Có đèn - Cố định (17h - 22h)', rate: court.priceFixedNight },
    { id: 'priceRetailNight', label: 'Có đèn - Khách thuê lẻ (17h - 22h)', rate: court.priceRetailNight }
  ];

  // Generate date list for repeating schedules
  useEffect(() => {
    if (bookingType === 'retail') {
      setCalculatedDates([singleDate]);
    } else {
      const dates: string[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start <= end) {
        let current = new Date(start);
        while (current <= end) {
          const dayOfWeek = current.getDay(); // 0 is Sunday, 1 is Monday...
          if (selectedWeekdays.includes(dayOfWeek)) {
            dates.push(current.toISOString().split('T')[0]);
          }
          current.setDate(current.getDate() + 1);
        }
      }
      setCalculatedDates(dates);
    }
  }, [bookingType, singleDate, startDate, endDate, selectedWeekdays]);

  // Calculate total amount automatically based on selected timeslot
  useEffect(() => {
    // Parse hours to minutes
    const [startH, startM] = startHour.split(':').map(Number);
    const [endH, endM] = endHour.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    
    const durationMinutes = endMinutes - startMinutes;
    if (durationMinutes <= 0) {
      setTotalPrice(0);
      return;
    }

    // Single session hour cost calculation
    let sessionCost = 0;

    // Loop through each minute to apply the exact rate and avoid any precision loss
    for (let m = startMinutes; m < endMinutes; m++) {
      const currentHour = Math.floor(m / 60);
      
      if (!isLightRequired) {
        // NẾU KHÁCH KHÔNG TÍCH CHỌN BẬT ĐÈN: Tất cả đều áp dụng giá sàn đồng giá priceDay
        sessionCost += court.priceDay / 60;
      } else {
        // NẾU KHÁCH CÓ TÍCH CHỌN BẬT ĐÈN
        if (bookingType === 'retail') {
          // Khách đặt lẻ một lần:
          // Trước 18:00 (Ban ngày): áp dụng priceDay
          // Từ 18:00 trở đi (Ban đêm): áp dụng priceRetailNight
          if (currentHour < 18) {
            sessionCost += court.priceDay / 60;
          } else {
            sessionCost += court.priceRetailNight / 60;
          }
        } else {
          // Đặt lịch cố định:
          // Trước 17:00 (Ban ngày): áp dụng priceFixedDay
          // Từ 17:00 - 22:00 (Ban đêm): áp dụng priceFixedNight
          if (currentHour < 17) {
            sessionCost += court.priceFixedDay / 60;
          } else {
            sessionCost += court.priceFixedNight / 60;
          }
        }
      }
    }

    // Round the single session cost to nearest integer (to avoid small float accumulation)
    const roundedSessionCost = Math.round(sessionCost);

    const datesCount = calculatedDates.length;
    if (datesCount === 0) {
      setTotalPrice(0);
      return;
    }

    const racketCost = hasRackets ? (court.priceRentalRack * datesCount) : 0;
    const ballCost = hasBalls ? (court.priceRentalBall * datesCount) : 0;

    setTotalPrice((roundedSessionCost * datesCount) + racketCost + ballCost);
  }, [bookingType, startHour, endHour, isLightRequired, calculatedDates, hasRackets, hasBalls, court]);

  const toggleWeekday = (day: number) => {
    if (selectedWeekdays.includes(day)) {
      if (selectedWeekdays.length > 1) {
        setSelectedWeekdays(selectedWeekdays.filter(d => d !== day));
      }
    } else {
      setSelectedWeekdays([...selectedWeekdays, day].sort());
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!customerName.trim()) {
      setError('Vui lòng nhập họ và tên của bạn.');
      return;
    }
    if (!customerPhone.trim()) {
      setError('Vui lòng nhập số điện thoại liên hệ.');
      return;
    }

    const [startH, startM] = startHour.split(':').map(Number);
    const [endH, endM] = endHour.split(':').map(Number);
    if ((endH * 60 + endM) <= (startH * 60 + startM)) {
      setError('Giờ kết thúc phải lớn hơn giờ bắt đầu.');
      return;
    }

    if (calculatedDates.length === 0) {
      setError('Vui lòng chọn ngày đặt hoặc lịch cố định hợp lệ (Không có ngày nào khớp).');
      return;
    }

    setIsLoading(true);

    try {
      // Assemble standard services list
      const servicesSelected: ('rack' | 'ball')[] = [];
      if (hasRackets) servicesSelected.push('rack');
      if (hasBalls) servicesSelected.push('ball');

      // Create new booking object strictly adhering to types
      const newBooking: Omit<Booking, 'id'> = {
        courtId: court.id,
        courtName: court.name,
        customerName: customerName.trim(),
        phone: customerPhone.trim(),
        type: bookingType,
        dates: calculatedDates,
        startTime: startHour,
        endTime: endHour,
        isLightRequired,
        services: servicesSelected,
        status: 'pending',
        totalAmount: totalPrice,
        createdAt: new Date().toISOString()
      };

      // Direct Firestore write using Pure Client SDK Async/Await
      const docRef = await addDoc(collection(db, 'bookings'), newBooking);
      // Wait, let's update with id as well
      await updateDoc(docRef, { id: docRef.id, deviceId });
      
      onBookingSuccess();
    } catch (err: any) {
      console.error('Lỗi khi đặt sân:', err);
      setError('Đã xảy ra lỗi khi gửi yêu cầu. Vui lòng thử lại sau.');
      handleFirestoreError(err, OperationType.CREATE, 'bookings');
    } finally {
      setIsLoading(false);
    }
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const mapWeekdayLabel = (day: number) => {
    const labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return labels[day];
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto" id="booking-modal-overlay">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]" id="booking-modal-container">
        
        {/* Modal Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-200" />
            <div>
              <h2 className="font-bold text-lg md:text-xl">ĐẶT SÂN PICKLEBALL</h2>
              <p className="text-xs text-indigo-100 font-medium">{court.name}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-indigo-500 rounded-full text-indigo-100 hover:text-white transition-colors cursor-pointer"
            id="btn-close-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-grow overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Left Column: Court Info & Pricing List (Reference Sidebar) */}
          <div className="md:col-span-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-4">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1">Thông tin sân</span>
              <p className="font-bold text-slate-800 text-sm">{court.name}</p>
              <p className="text-xs text-slate-500 mt-1">{court.address}</p>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Bảng giá tham chiếu</span>
              <div className="flex flex-col gap-2">
                {pricingOptionsDisplay.map((opt) => (
                  <div key={opt.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs">
                    <span className="text-xs text-slate-600 font-semibold line-clamp-2 pr-1">{opt.label}</span>
                    <span className="text-xs font-black text-slate-900 shrink-0">{formatVND(opt.rate)}/h</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block mb-2">Dịch vụ đi kèm</span>
              <div className="flex flex-col gap-1.5 text-xs text-indigo-900">
                <div className="flex justify-between">
                  <span>Thuê thêm vợt:</span>
                  <span className="font-bold">{formatVND(court.priceRentalRack)}/buổi</span>
                </div>
                <div className="flex justify-between">
                  <span>Rổ bóng tập:</span>
                  <span className="font-bold">{formatVND(court.priceRentalBall)}/buổi</span>
                </div>
              </div>
            </div>

            {paymentMethod === 'banking' && (
              <div className="mt-auto border-t border-slate-200 pt-3 flex flex-col items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 self-start">Thanh toán chuyển khoản</span>
                <img 
                  src={systemConfig.qrCodeUrl || 'https://img.vietqr.io/image/vietcombank-1023456789-compact2.png'} 
                  alt="Mã QR Chuyển khoản" 
                  className="w-28 h-28 object-contain bg-white p-1 rounded-lg border border-slate-200 shadow-3xs"
                  referrerPolicy="no-referrer"
                />
                <span className="text-[10px] text-slate-400 mt-1 text-center font-medium leading-tight">Chụp màn hình QR chuyển khoản và đính kèm khi giao dịch</span>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Booking Form */}
          <form onSubmit={handleBookingSubmit} className="md:col-span-8 flex flex-col gap-5">
            
            {/* Customer Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Họ và Tên khách hàng <span className="text-red-500">*</span></label>
                <input 
                  type="text"
                  required
                  placeholder="Nhập họ và tên"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Số điện thoại <span className="text-red-500">*</span></label>
                <input 
                  type="tel"
                  required
                  placeholder="Ví dụ: 0912345678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800"
                />
              </div>
            </div>

            {/* Booking Schedule Type Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Hình thức đặt sân</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBookingType('retail')}
                  className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    bookingType === 'retail'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                      : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Đặt lẻ một lần
                </button>
                <button
                  type="button"
                  onClick={() => setBookingType('fixed')}
                  className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    bookingType === 'fixed'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                      : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Đặt lịch cố định
                </button>
              </div>
            </div>

            {/* Date Selection Fields based on Type */}
            {bookingType === 'retail' ? (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Chọn Ngày Đặt Sân</label>
                <div className="relative">
                  <input 
                    type="date"
                    required
                    value={singleDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white text-slate-800"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/50 flex flex-col gap-3">
                <span className="text-xs font-bold text-slate-600 uppercase block">Cấu hình lịch cố định định kỳ</span>
                
                {/* Period Date Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Từ ngày</label>
                    <input 
                      type="date"
                      required
                      value={startDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Đến ngày</label>
                    <input 
                      type="date"
                      required
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                    />
                  </div>
                </div>

                {/* Days of the Week Selection */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Các ngày trong tuần muốn đặt</label>
                  <div className="flex gap-1 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                      const isActive = selectedWeekdays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleWeekday(day)}
                          className={`flex-grow py-2 px-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                            isActive
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {mapWeekdayLabel(day)}
                        </button>
                      );
                    })}
                  </div>
                  {calculatedDates.length > 0 && (
                    <span className="text-[11px] text-indigo-600 font-semibold mt-2 block">
                      Đã tự động tính: <strong className="font-extrabold">{calculatedDates.length} buổi</strong> khớp lịch.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Time slot & Automatic Pricing Calculation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Giờ chơi <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium text-slate-400">Giờ bắt đầu</span>
                    <input 
                      type="time"
                      required
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium text-slate-400">Giờ kết thúc</span>
                    <input 
                      type="time"
                      required
                      value={endHour}
                      onChange={(e) => setEndHour(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Active lamp selection (Yêu cầu bật đèn sân) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-center gap-1.5">
                <span className="block text-xs font-bold text-slate-650 uppercase">Tùy chọn đèn chiếu sáng</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox"
                    id="lightCheckbox"
                    checked={isLightRequired}
                    onChange={(e) => setIsLightRequired(e.target.checked)}
                    className="w-4.5 h-4.5 text-indigo-600 border-slate-350 rounded-sm focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="lightCheckbox" className="text-xs font-extrabold text-indigo-750 select-none cursor-pointer flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 fill-amber-500 stroke-amber-750" />
                    Yêu cầu bật đèn sân (+tiền chênh lệch)
                  </label>
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  * Nếu không bật đèn: Tính đồng giá {formatVND(court.priceDay)}/h cả ngày lẫn đêm.
                </p>
              </div>
            </div>

            {/* Extra Services Checklist */}
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-600 uppercase font-bold">Dịch vụ sân hỗ trợ thêm</span>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setHasRackets(!hasRackets)}
                  className={`flex-1 p-3 rounded-xl border-2 flex items-center gap-3 transition-all cursor-pointer ${
                    hasRackets ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-100 bg-white text-slate-600'
                  }`}
                >
                  <CheckSquare className={`w-5 h-5 shrink-0 ${hasRackets ? 'text-indigo-600' : 'text-slate-300'}`} />
                  <div className="text-left">
                    <p className="text-xs font-bold">Thuê thêm vợt</p>
                    <p className="text-[10px] text-slate-400">+{formatVND(court.priceRentalRack)} / buổi</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setHasBalls(!hasBalls)}
                  className={`flex-1 p-3 rounded-xl border-2 flex items-center gap-3 transition-all cursor-pointer ${
                    hasBalls ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-100 bg-white text-slate-600'
                  }`}
                >
                  <CheckSquare className={`w-5 h-5 shrink-0 ${hasBalls ? 'text-indigo-600' : 'text-slate-300'}`} />
                  <div className="text-left">
                    <p className="text-xs font-bold">Rổ bóng tập</p>
                    <p className="text-[10px] text-slate-400">+{formatVND(court.priceRentalBall)} / buổi</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Payment & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Hình thức thanh toán</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('banking')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      paymentMethod === 'banking'
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Chuyển Khoản
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Thanh toán trực tiếp
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Ghi chú bổ sung (nếu có)</label>
                <textarea 
                  rows={1}
                  placeholder="Ví dụ: Cần chuẩn bị sân lúc..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 bg-white"
                />
              </div>
            </div>

            {/* Errors / Sum Area */}
            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl flex items-center gap-2 text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-center sm:text-left">
                <span className="text-xs text-slate-400 block font-semibold">Tổng số tiền thanh toán ({calculatedDates.length} buổi)</span>
                <span className="text-xl sm:text-2xl font-black text-amber-400">{formatVND(totalPrice)}</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-extrabold rounded-xl shadow-md transition-all cursor-pointer text-sm"
                id="btn-confirm-booking"
              >
                {isLoading ? 'Đang gửi yêu cầu...' : 'Xác Nhận Đặt Sân'}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
};
