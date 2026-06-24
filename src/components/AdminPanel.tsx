import React, { useState, useEffect } from 'react';
import { Court, Booking, SystemConfig } from '../types';
import { 
  Check, X, Plus, Edit, Trash2, Key, Settings, CreditCard, 
  MapPin, CheckSquare, Layers, Lock, ShieldCheck, RefreshCw, ChevronDown
} from 'lucide-react';
import { 
  collection, getDocs, doc, updateDoc, deleteDoc, addDoc, setDoc 
} from 'firebase/firestore';
import { db } from '../firebase';

interface AdminPanelProps {
  courts: Court[];
  bookings: Booking[];
  systemConfig: SystemConfig;
  onRefreshData: () => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  courts,
  bookings,
  systemConfig,
  onRefreshData
}) => {
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Tab control: 'bookings' | 'courts' | 'settings'
  const [activeTab, setActiveTab] = useState<'bookings' | 'courts' | 'settings'>('bookings');

  // Booking filtering state
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'all' | 'pending' | 'approved' | 'cancelled'>('all');

  // Court editing/adding state
  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false);
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [courtFormName, setCourtFormName] = useState('');
  const [courtFormAddress, setCourtFormAddress] = useState('');
  const [courtFormType, setCourtFormType] = useState<'trong_nha' | 'ngoai_troi'>('trong_nha');
  const [courtFormAmenities, setCourtFormAmenities] = useState<string>('');
  
  // Pricing states
  const [priceDayRate, setPriceDayRate] = useState(60000);
  const [priceNightRate, setPriceNightRate] = useState(120000);
  const [priceFixedLightDay, setPriceFixedLightDay] = useState(80000);
  const [priceFixedLightNight, setPriceFixedLightNight] = useState(100000);
  const [priceCustomLightRate, setPriceCustomLightRate] = useState(120000);

  // System settings state
  const [bankName, setBankName] = useState(systemConfig.bankName);
  const [bankAccount, setBankAccount] = useState(systemConfig.bankAccount);
  const [bankOwner, setBankOwner] = useState(systemConfig.bankOwner);
  const [qrCodeUrl, setQrCodeUrl] = useState(systemConfig.qrCodeUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Mutation loader
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [generalLoading, setGeneralLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Reset setting forms on systemConfig change
  useEffect(() => {
    setBankName(systemConfig.bankName);
    setBankAccount(systemConfig.bankAccount);
    setBankOwner(systemConfig.bankOwner);
    setQrCodeUrl(systemConfig.qrCodeUrl);
  }, [systemConfig]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    const correctPassword = systemConfig.adminPasswordHash || 'admin123';
    if (passwordInput === correctPassword) {
      setIsAdminUnlocked(true);
      setMessage({ type: 'success', text: 'Đăng nhập trang quản trị thành công!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } else {
      setLoginError('Mật khẩu quản trị viên không chính xác. Vui lòng thử lại.');
    }
  };

  // Helper to trigger alert message
  const triggerAlert = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // 1. Duyệt đơn (State flow: status = 'approved') - Strictly awaits Firestore
  const handleApproveBooking = async (bookingId: string) => {
    setActionLoadingId(bookingId);
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      // Wait for cloud persistence to succeed before UI modification
      await updateDoc(bookingRef, { status: 'approved' });
      await onRefreshData();
      triggerAlert('success', 'Đã phê duyệt đơn đặt sân thành công!');
    } catch (err) {
      console.error(err);
      triggerAlert('error', 'Lỗi khi duyệt đơn đặt sân.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 2. Hủy đơn (State flow: status = 'cancelled') - Strictly awaits Firestore
  const handleCancelBooking = async (bookingId: string) => {
    setActionLoadingId(bookingId);
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      // Wait for cloud persistence to succeed before UI modification
      await updateDoc(bookingRef, { status: 'cancelled' });
      await onRefreshData();
      triggerAlert('success', 'Đã hủy đơn đặt sân thành công!');
    } catch (err) {
      console.error(err);
      triggerAlert('error', 'Lỗi khi hủy đơn đặt sân.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 3. Xóa đơn đặt sân hoàn toàn
  const handleDeleteBooking = async (bookingId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn đơn đặt sân này khỏi cơ sở dữ liệu?')) {
      return;
    }
    setActionLoadingId(bookingId);
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      await deleteDoc(bookingRef);
      await onRefreshData();
      triggerAlert('success', 'Đã xóa vĩnh viễn đơn đặt sân thành công!');
    } catch (err) {
      console.error(err);
      triggerAlert('error', 'Lỗi khi xóa đơn đặt sân.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 4. Quản lý sân: Mở modal thêm/sửa
  const openCourtModal = (court: Court | null = null) => {
    if (court) {
      setEditingCourt(court);
      setCourtFormName(court.name);
      setCourtFormAddress(court.address);
      setCourtFormType(court.type);
      setCourtFormAmenities(court.amenities.join(', '));
      setPriceDayRate(court.pricing.dayRate);
      setPriceNightRate(court.pricing.nightRate || 120000);
      setPriceFixedLightDay(court.pricing.fixedLightDay || 80000);
      setPriceFixedLightNight(court.pricing.fixedLightNight || 100000);
      setPriceCustomLightRate(court.pricing.customLightRate || 120000);
    } else {
      setEditingCourt(null);
      setCourtFormName('');
      setCourtFormAddress('140 - Nguyễn Văn Cừ - Đồng Hới - Quảng Trị');
      setCourtFormType('trong_nha');
      setCourtFormAmenities('Có mái che mưa nắng, Hệ thống chiếu sáng đêm');
      setPriceDayRate(60000);
      setPriceNightRate(120000);
      setPriceFixedLightDay(80000);
      setPriceFixedLightNight(100000);
      setPriceCustomLightRate(120000);
    }
    setIsCourtModalOpen(true);
  };

  // 5. Quản lý sân: Lưu sân (Thêm hoặc Sửa)
  const handleSaveCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courtFormName.trim()) {
      triggerAlert('error', 'Vui lòng nhập tên sân.');
      return;
    }

    setGeneralLoading(true);
    try {
      const parsedAmenities = courtFormAmenities
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

      const courtData: Omit<Court, 'id'> = {
        name: courtFormName.trim(),
        address: courtFormAddress.trim(),
        type: courtFormType,
        amenities: parsedAmenities,
        pricing: {
          dayRate: Number(priceDayRate),
          nightRate: Number(priceNightRate),
          fixedLightDay: Number(priceFixedLightDay),
          fixedLightNight: Number(priceFixedLightNight),
          customLightRate: Number(priceCustomLightRate)
        },
        services: {
          racketRentPrice: systemConfig.defaultRacketPrice || 30000,
          ballRentPrice: systemConfig.defaultBallPrice || 30000
        }
      };

      if (editingCourt) {
        // Edit court
        const courtRef = doc(db, 'courts', editingCourt.id);
        await setDoc(courtRef, { ...courtData, id: editingCourt.id });
        triggerAlert('success', 'Đã cập nhật thông tin sân thành công!');
      } else {
        // Add new court
        const newDocRef = await addDoc(collection(db, 'courts'), courtData);
        // Save ID as well
        await updateDoc(newDocRef, { id: newDocRef.id });
        triggerAlert('success', 'Đã thêm sân mới thành công!');
      }

      setIsCourtModalOpen(false);
      await onRefreshData();
    } catch (err) {
      console.error(err);
      triggerAlert('error', 'Gặp lỗi trong quá trình lưu thông tin sân.');
    } finally {
      setGeneralLoading(false);
    }
  };

  // 6. Quản lý sân: Xóa sân mất tích hoàn toàn
  const handleDeleteCourt = async (courtId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn XÓA MẤT TÍCH HOÀN TOÀN sân này khỏi hệ thống? Tất cả thông tin bảng giá sẽ mất sạch.')) {
      return;
    }
    setGeneralLoading(true);
    try {
      const courtRef = doc(db, 'courts', courtId);
      await deleteDoc(courtRef);
      await onRefreshData();
      triggerAlert('success', 'Đã xóa vĩnh viễn sân thành công!');
    } catch (err) {
      console.error(err);
      triggerAlert('error', 'Gặp lỗi khi xóa sân.');
    } finally {
      setGeneralLoading(false);
    }
  };

  // 7. Lưu cấu hình hệ thống (Bank details, default rates, password)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralLoading(true);
    try {
      let finalPassword = systemConfig.adminPasswordHash;
      if (newPassword.trim()) {
        if (newPassword !== confirmPassword) {
          triggerAlert('error', 'Mật khẩu xác nhận không trùng khớp.');
          setGeneralLoading(false);
          return;
        }
        finalPassword = newPassword.trim();
      }

      // Generate smart VietQR link dynamically if empty or changed
      let finalQrCodeUrl = qrCodeUrl;
      if (!finalQrCodeUrl || finalQrCodeUrl.includes('vietqr.io')) {
        const cleanedBank = bankName.trim().replace(/\s+/g, '').toLowerCase();
        finalQrCodeUrl = `https://img.vietqr.io/image/${cleanedBank}-${bankAccount.trim()}-compact2.png?amount=100000&addInfo=Thanh%20toan%20san%20Pickleball`;
      }

      const updatedConfig: SystemConfig = {
        bankName: bankName.trim(),
        bankAccount: bankAccount.trim(),
        bankOwner: bankOwner.trim().toUpperCase(),
        qrCodeUrl: finalQrCodeUrl,
        adminPasswordHash: finalPassword,
        defaultRacketPrice: systemConfig.defaultRacketPrice || 30000,
        defaultBallPrice: systemConfig.defaultBallPrice || 30000
      };

      await setDoc(doc(db, 'config', 'system'), updatedConfig);
      await onRefreshData();
      
      setNewPassword('');
      setConfirmPassword('');
      triggerAlert('success', 'Đã lưu cấu hình hệ thống và thông tin tài khoản ngân hàng thành công!');
    } catch (err) {
      console.error(err);
      triggerAlert('error', 'Lỗi khi lưu cấu hình hệ thống.');
    } finally {
      setGeneralLoading(false);
    }
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const getFilteredBookings = () => {
    if (bookingStatusFilter === 'all') return bookings;
    return bookings.filter(b => b.status === bookingStatusFilter);
  };

  // Lock admin layout if not unlocked
  if (!isAdminUnlocked) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden" id="admin-login-card">
        <div className="bg-indigo-600 p-6 text-center text-white">
          <Lock className="w-12 h-12 mx-auto mb-3 text-indigo-100" />
          <h2 className="text-xl font-bold">XÁC THỰC QUẢN TRỊ VIÊN</h2>
          <p className="text-xs text-indigo-100 mt-1">Yêu cầu quyền truy cập hệ thống để tiếp tục</p>
        </div>
        <form onSubmit={handleAdminLogin} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Mật khẩu Quản trị</label>
            <input 
              type="password"
              placeholder="Nhập mật khẩu..."
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all text-slate-800"
            />
          </div>

          {loginError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100 font-medium">
              {loginError}
            </p>
          )}

          <button 
            type="submit"
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-all cursor-pointer text-sm"
          >
            Đăng Nhập Trang Quản Trị
          </button>
          
          <p className="text-[10px] text-slate-400 text-center">
            * Mật khẩu mặc định hệ thống: <strong className="font-extrabold select-all">admin123</strong>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-3xl border border-slate-100 p-6 shadow-xs flex flex-col gap-6" id="admin-panel-unlocked">
      
      {/* Alert Notification Popup */}
      {message.text && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs md:text-sm font-semibold animate-bounce shadow-md ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
        }`} id="admin-alert">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Admin Panel Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 uppercase">Trang quản trị viên</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">Quản lý hệ thống đặt sân Pickleball v2.0 - Khách đặt sân, cấu hình ngân hàng.</p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={async () => {
              setGeneralLoading(true);
              await onRefreshData();
              setGeneralLoading(false);
              triggerAlert('success', 'Đã tải lại dữ liệu mới nhất từ Cloud Firestore!');
            }}
            disabled={generalLoading}
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl hover:text-indigo-600 transition-colors flex items-center gap-2 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${generalLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          <button 
            onClick={() => setIsAdminUnlocked(false)}
            className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Đăng xuất Admin
          </button>
        </div>
      </div>

      {/* Admin Tab Nav */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-xl shadow-2xs">
        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'bookings' 
              ? 'bg-indigo-600 text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Duyệt Đơn Đặt Sân ({bookings.length})
        </button>
        <button
          onClick={() => setActiveTab('courts')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'courts' 
              ? 'bg-indigo-600 text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          Quản Lý Sân ({courts.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'settings' 
              ? 'bg-indigo-600 text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Settings className="w-4 h-4" />
          Cấu Hình Hệ Thống
        </button>
      </div>

      {/* Tab 1: BOOKING APPROVALS LIST */}
      {activeTab === 'bookings' && (
        <div className="flex flex-col gap-4">
          
          {/* Booking Status Filter Bar */}
          <div className="flex gap-2 flex-wrap bg-white p-3 rounded-xl border border-slate-100">
            <span className="text-xs text-slate-400 self-center mr-2 font-bold uppercase tracking-wider">Trạng thái:</span>
            {(['all', 'pending', 'approved', 'cancelled'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setBookingStatusFilter(st)}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                  bookingStatusFilter === st
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st === 'all' && 'Tất cả'}
                {st === 'pending' && 'Chờ duyệt'}
                {st === 'approved' && 'Đã duyệt'}
                {st === 'cancelled' && 'Đã hủy'}
              </button>
            ))}
          </div>

          {/* Bookings Table / List */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3">Khách hàng</th>
                    <th className="px-5 py-3">Sân & Lịch đặt</th>
                    <th className="px-5 py-3 text-right">Thành tiền</th>
                    <th className="px-5 py-3">Thanh toán</th>
                    <th className="px-5 py-3 text-center">Trạng thái</th>
                    <th className="px-5 py-3 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs md:text-sm">
                  {getFilteredBookings().length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400 font-medium">
                        Không tìm thấy đơn đặt sân nào khớp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    getFilteredBookings().map((booking) => {
                      const isFixed = booking.bookingType === 'fixed';
                      const isPending = booking.status === 'pending';
                      const isLoading = actionLoadingId === booking.id;

                      return (
                        <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors">
                          
                          {/* Khách hàng info */}
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-900">{booking.customerName}</p>
                            <p className="text-xs text-slate-500 font-semibold mt-1">{booking.customerPhone}</p>
                            {booking.notes && (
                              <p className="text-[10px] bg-amber-50 text-amber-800 border border-amber-100 p-1 rounded-md mt-1 italic max-w-xs">
                                HN: {booking.notes}
                              </p>
                            )}
                          </td>

                          {/* Sân & Lịch đặt */}
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-700">{booking.courtName}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              Giờ: <strong className="text-indigo-600 font-bold">{booking.startTime} - {booking.endTime}</strong>
                            </p>
                            <p className="text-[11px] text-slate-400 font-medium leading-normal mt-1">
                              Ngày: {booking.dates.map(d => d.split('-').reverse().slice(0, 2).join('/')).join(', ')}
                            </p>
                            <span className="inline-block mt-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase">
                              {isFixed ? `Định kỳ (${booking.dates.length} buổi)` : 'Lẻ (1 buổi)'}
                            </span>
                          </td>

                          {/* Thành tiền */}
                          <td className="px-5 py-4 text-right font-black text-indigo-600">
                            {formatVND(booking.totalAmount)}
                          </td>

                          {/* Thanh toán */}
                          <td className="px-5 py-4">
                            <span className={`text-[11px] font-semibold ${
                              booking.paymentMethod === 'banking' ? 'text-indigo-600' : 'text-slate-600'
                            }`}>
                              {booking.paymentMethod === 'banking' ? 'Chuyển Khoản' : 'Thanh toán trực tiếp'}
                            </span>
                          </td>

                          {/* Trạng thái */}
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-block text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              booking.status === 'approved' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : booking.status === 'cancelled'
                                ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                            }`}>
                              {booking.status === 'approved' && 'Đã duyệt'}
                              {booking.status === 'cancelled' && 'Đã hủy'}
                              {booking.status === 'pending' && 'Chờ duyệt'}
                            </span>
                          </td>

                          {/* Luồng xử lý chuẩn và an toàn (✔ Duyệt / ✖ Hủy / 🗑 Xóa) */}
                          <td className="px-5 py-4 text-center">
                            <div className="flex justify-center items-center gap-2">
                              {isPending ? (
                                <>
                                  <button
                                    onClick={() => handleApproveBooking(booking.id)}
                                    disabled={isLoading}
                                    title="Duyệt đơn này (Phê duyệt)"
                                    className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all shadow-2xs hover:scale-105 disabled:opacity-50 cursor-pointer"
                                    id={`btn-approve-${booking.id}`}
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleCancelBooking(booking.id)}
                                    disabled={isLoading}
                                    title="Hủy đơn này (Từ chối)"
                                    className="p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-all shadow-2xs hover:scale-105 disabled:opacity-50 cursor-pointer"
                                    id={`btn-cancel-${booking.id}`}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleDeleteBooking(booking.id)}
                                  disabled={isLoading}
                                  title="Xóa vĩnh viễn khỏi DB"
                                  className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                  id={`btn-delete-booking-${booking.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: COURT MANAGEMENT */}
      {activeTab === 'courts' && (
        <div className="flex flex-col gap-5">
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-slate-800 text-sm md:text-base uppercase">Danh sách sân đang hoạt động</h3>
            <button
              onClick={() => openCourtModal(null)}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 text-xs cursor-pointer"
              id="btn-add-court"
            >
              <Plus className="w-4 h-4" />
              Thêm Sân Pickleball Mới
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courts.map((court) => (
              <div 
                key={court.id} 
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between"
                id={`admin-court-card-${court.id}`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      court.type === 'trong_nha' 
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {court.type === 'trong_nha' ? 'Trong nhà' : 'Ngoài trời'}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openCourtModal(court)}
                        title="Chỉnh sửa sân"
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                        id={`btn-edit-court-${court.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCourt(court.id)}
                        title="Xóa sân mất tích"
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        id={`btn-delete-court-${court.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-800 text-base">{court.name}</h4>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {court.address}
                  </p>

                  {/* Pricing table preview */}
                  <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-1 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Giá ban ngày:</span>
                      <strong className="text-slate-700">{formatVND(court.pricing.dayRate)}/h</strong>
                    </div>
                    {court.type === 'trong_nha' ? (
                      <>
                        <div className="flex justify-between text-slate-500">
                          <span>Cố định (5h-17h):</span>
                          <strong className="text-slate-700">{formatVND(court.pricing.fixedLightDay || 80000)}/h</strong>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>Cố định (17h-22h):</span>
                          <strong className="text-slate-700">{formatVND(court.pricing.fixedLightNight || 100000)}/h</strong>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>Đèn thuê lẻ:</span>
                          <strong className="text-slate-700">{formatVND(court.pricing.customLightRate || 120000)}/h</strong>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-slate-500">
                        <span>Giá buổi tối (đèn):</span>
                        <strong className="text-slate-700">{formatVND(court.pricing.nightRate || 180000)}/h</strong>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {court.amenities.map((am, index) => (
                      <span key={index} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm font-semibold">
                        {am}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Inline Edit/Add Court Modal (No clutter) */}
          {isCourtModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="bg-indigo-600 text-white p-5 flex justify-between items-center">
                  <h4 className="font-bold">{editingCourt ? 'CHỈNH SỬA SÂN' : 'THÊM SÂN PICKLEBALL'}</h4>
                  <button onClick={() => setIsCourtModalOpen(false)} className="p-1 hover:bg-indigo-500 rounded-full cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveCourt} className="p-6 flex flex-col gap-4 overflow-y-auto">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên Sân <span className="text-red-500">*</span></label>
                    <input 
                      type="text"
                      required
                      value={courtFormName}
                      onChange={(e) => setCourtFormName(e.target.value)}
                      placeholder="Ví dụ: Sân Pickleball Số 3 (Có mái che)"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Địa Chỉ <span className="text-red-500">*</span></label>
                    <input 
                      type="text"
                      required
                      value={courtFormAddress}
                      onChange={(e) => setCourtFormAddress(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Loại Sân</label>
                      <select
                        value={courtFormType}
                        onChange={(e) => setCourtFormType(e.target.value as any)}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800"
                      >
                        <option value="trong_nha">Sân Trong nhà</option>
                        <option value="ngoai_troi">Sân Ngoài trời</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiện Ích (Ngăn cách bằng dấu phẩy)</label>
                      <input 
                        type="text"
                        value={courtFormAmenities}
                        onChange={(e) => setCourtFormAmenities(e.target.value)}
                        placeholder="Ví dụ: Có mái che, Thảm thi đấu, Hệ thống đèn"
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Pricing Configurations */}
                  <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
                    <span className="text-xs font-bold text-indigo-600 uppercase">Cấu hình bảng giá của sân (VNĐ/giờ)</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Giá ban ngày (không đèn)</label>
                        <input 
                          type="number"
                          required
                          value={priceDayRate}
                          onChange={(e) => setPriceDayRate(Number(e.target.value))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                        />
                      </div>

                      {courtFormType === 'trong_nha' ? (
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">Có đèn - Lẻ</label>
                          <input 
                            type="number"
                            required
                            value={priceCustomLightRate}
                            onChange={(e) => setPriceCustomLightRate(Number(e.target.value))}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">Có đèn - Tối/Đêm</label>
                          <input 
                            type="number"
                            required
                            value={priceNightRate}
                            onChange={(e) => setPriceNightRate(Number(e.target.value))}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                          />
                        </div>
                      )}
                    </div>

                    {courtFormType === 'trong_nha' && (
                      <div className="grid grid-cols-2 gap-3 bg-indigo-50/50 p-2.5 rounded-lg">
                        <div>
                          <label className="block text-[10px] font-semibold text-indigo-700 mb-1">Cố định (5h - 17h)</label>
                          <input 
                            type="number"
                            required
                            value={priceFixedLightDay}
                            onChange={(e) => setPriceFixedLightDay(Number(e.target.value))}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-indigo-700 mb-1">Cố định (17h - 22h)</label>
                          <input 
                            type="number"
                            required
                            value={priceFixedLightNight}
                            onChange={(e) => setPriceFixedLightNight(Number(e.target.value))}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md cursor-pointer text-xs"
                  >
                    Lưu Thay Đổi Sân
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: SYSTEM CONFIGURATION & BANKING */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-2xs flex flex-col gap-5">
          
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-800 text-sm md:text-base uppercase flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              Thông tin Ngân hàng nhận tiền thanh toán (QR CODE)
            </h3>
            <p className="text-xs text-slate-400 mt-1">Thông tin này sẽ hiển thị trực tiếp cho khách hàng quét mã khi chọn Chuyển khoản.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên Ngân hàng</label>
              <input 
                type="text"
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Ví dụ: Vietcombank, MBBank..."
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số tài khoản</label>
              <input 
                type="text"
                required
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="Nhập số tài khoản"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên chủ tài khoản</label>
              <input 
                type="text"
                required
                value={bankOwner}
                onChange={(e) => setBankOwner(e.target.value)}
                placeholder="NGUYEN VAN A"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mã QR / Đường dẫn VietQR link (Có thể tự cập nhật hoặc hệ thống tự sinh)</label>
            <input 
              type="text"
              value={qrCodeUrl}
              onChange={(e) => setQrCodeUrl(e.target.value)}
              placeholder="Để trống hệ thống sẽ tự sinh link VietQR chuẩn"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 mt-2">
            <h3 className="font-extrabold text-slate-800 text-sm uppercase flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-indigo-600" />
              Đổi Mật Khẩu Đăng Nhập Trang Quản Trị
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu mới</label>
                <input 
                  type="password"
                  placeholder="Nhập mật khẩu mới..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Xác nhận mật khẩu mới</label>
                <input 
                  type="password"
                  placeholder="Xác nhận lại mật khẩu..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={generalLoading}
            className="w-full sm:w-auto self-end px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-all text-xs cursor-pointer mt-3"
            id="btn-save-settings"
          >
            Lưu Toàn Bộ Cấu Hình Hệ Thống
          </button>
        </form>
      )}

    </div>
  );
};
