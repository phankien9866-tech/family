import React, { useState, useEffect } from 'react';
import { Court, Booking, SystemConfig } from '../types';
import { 
  Check, X, Plus, Edit, Trash2, Key, Settings, CreditCard, 
  MapPin, CheckSquare, Layers, Lock, ShieldCheck, RefreshCw, ChevronDown, Zap, Calendar, Clock,
  Mail, AlertCircle, Upload, FileImage
} from 'lucide-react';
import { 
  collection, doc, updateDoc, deleteDoc, addDoc, setDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

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

  // Forgot password states
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordStatus, setForgotPasswordStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showPasswordInline, setShowPasswordInline] = useState(false);
  
  // Tab control: 'bookings' | 'courts' | 'settings'
  const [activeTab, setActiveTab] = useState<'bookings' | 'courts' | 'settings'>('bookings');

  // Booking filtering state
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'all' | 'pending' | 'approved' | 'cancelled'>('all');

  // Court editing/adding state
  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false);
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [courtFormName, setCourtFormName] = useState('');
  const [courtFormAddress, setCourtFormAddress] = useState('');
  const [courtFormDescription, setCourtFormDescription] = useState('');
  const [courtFormIsActive, setCourtFormIsActive] = useState(true);
  
  // Pricing states
  const [priceDay, setPriceDay] = useState(60000);
  const [priceFixedDay, setPriceFixedDay] = useState(80000);
  const [priceFixedNight, setPriceFixedNight] = useState(100000);
  const [priceRetailNight, setPriceRetailNight] = useState(120000);
  const [priceRentalRack, setPriceRentalRack] = useState(30000);
  const [priceRentalBall, setPriceRentalBall] = useState(30000);

  // System settings state
  const [stk, setStk] = useState(systemConfig.stk || '');
  const [bankName, setBankName] = useState(systemConfig.bankName || '');
  const [qrCodeUrl, setQrCodeUrl] = useState(systemConfig.qrCodeUrl || '');
  const [adminPassword, setAdminPassword] = useState(systemConfig.adminPassword || '');

  // Image upload state
  const [isCompressingQR, setIsCompressingQR] = useState(false);
  const [qrUploadError, setQrUploadError] = useState('');

  // Memory-safe Image Compression for files up to 100MB+
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, JPEG).'));
        return;
      }

      // Memory safe: use Object URL instead of reading full 100MB into FileReader memory
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try {
          const maxDim = 600; // Optimal QR code resolution
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Không thể khởi tạo Canvas Context.');
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // Quality 0.75 is extremely high clarity for QRs while maintaining a tiny Firestore footprint (< 30KB)
          const base64Str = canvas.toDataURL('image/jpeg', 0.75);
          
          URL.revokeObjectURL(objectUrl);
          resolve(base64Str);
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Không thể tải tệp hình ảnh. Vui lòng chọn ảnh khác.'));
      };

      img.src = objectUrl;
    });
  };

  const handleQRFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingQR(true);
    setQrUploadError('');

    try {
      // Direct compression of potential massive file (e.g. 100MB+)
      const compressedBase64 = await compressImage(file);
      setQrCodeUrl(compressedBase64);
      triggerAlert('success', 'Đã nén và tải lên ảnh QR thành công!');
    } catch (err: any) {
      console.error(err);
      setQrUploadError(err.message || 'Lỗi khi xử lý hình ảnh.');
      triggerAlert('error', err.message || 'Lỗi khi xử lý hình ảnh.');
    } finally {
      setIsCompressingQR(false);
      // Reset input value to allow uploading same file again
      e.target.value = '';
    }
  };

  // Mutation loader
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [generalLoading, setGeneralLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Reset setting forms on systemConfig change
  useEffect(() => {
    setStk(systemConfig.stk || '');
    setBankName(systemConfig.bankName || '');
    setQrCodeUrl(systemConfig.qrCodeUrl || '');
    setAdminPassword(systemConfig.adminPassword || '');
  }, [systemConfig]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    const correctPassword = systemConfig.adminPassword || 'admin';
    if (passwordInput === correctPassword) {
      setIsAdminUnlocked(true);
      triggerAlert('success', 'Đăng nhập trang quản trị thành công!');
    } else {
      setLoginError('Mật khẩu quản trị viên không chính xác. Vui lòng thử lại.');
    }
  };

  const handleForgotPassword = async () => {
    setForgotPasswordLoading(true);
    setForgotPasswordStatus(null);
    try {
      const correctPassword = systemConfig.adminPassword || 'admin';
      const email = 'phankien386@gmail.com';
      
      const response = await fetch(`https://formsubmit.co/ajax/${email}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: 'Yêu cầu cấp lại mật khẩu Quản trị Sân Pickleball',
          _captcha: 'false',
          message: `Xin chào,\n\nHệ thống đặt sân Pickleball vừa nhận được yêu cầu cấp lại mật khẩu quản trị từ bạn.\n\nMật khẩu quản trị viên hiện tại của bạn là: ${correctPassword}\n\nChúc bạn quản lý sân chơi vui vẻ và thành công!\nTrân trọng.`,
          _template: 'table'
        })
      });

      if (response.ok) {
        setForgotPasswordStatus({
          type: 'success',
          text: 'Đã gửi thành công! Vui lòng kiểm tra email phankien386@gmail.com (bao gồm cả thư rác / spam).'
        });
      } else {
        throw new Error('Gửi mail qua FormSubmit thất bại.');
      }
    } catch (err) {
      console.error(err);
      setForgotPasswordStatus({
        type: 'error',
        text: 'Không thể kết nối đến máy chủ gửi thư. Bạn có thể nhấn nút "Hiện mật khẩu trực tiếp" bên dưới để lấy ngay mật khẩu.'
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  // Helper to trigger alert message
  const triggerAlert = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // 1. Duyệt đơn
  const handleApproveBooking = async (bookingId: string) => {
    setActionLoadingId(bookingId);
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, { status: 'approved' });
      await onRefreshData();
      triggerAlert('success', 'Đã phê duyệt đơn đặt sân thành công!');
    } catch (err) {
      console.error(err);
      triggerAlert('error', 'Lỗi khi duyệt đơn đặt sân.');
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${bookingId}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // 2. Hủy đơn
  const handleCancelBooking = async (bookingId: string) => {
    setActionLoadingId(bookingId);
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, { status: 'cancelled' });
      await onRefreshData();
      triggerAlert('success', 'Đã hủy đơn đặt sân thành công!');
    } catch (err) {
      console.error(err);
      triggerAlert('error', 'Lỗi khi hủy đơn đặt sân.');
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${bookingId}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // 3. Xóa đơn đặt sân hoàn toàn
  const handleDeleteBooking = async (bookingId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn đơn đặt sân này khỏi hệ thống?')) {
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
      handleFirestoreError(err, OperationType.DELETE, `bookings/${bookingId}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // 4. Mở modal thêm/sửa sân
  const openCourtModal = (court: Court | null = null) => {
    if (court) {
      setEditingCourt(court);
      setCourtFormName(court.name);
      setCourtFormAddress(court.address);
      setCourtFormDescription(court.description || '');
      setCourtFormIsActive(court.isActive !== false);
      setPriceDay(court.priceDay);
      setPriceFixedDay(court.priceFixedDay);
      setPriceFixedNight(court.priceFixedNight);
      setPriceRetailNight(court.priceRetailNight);
      setPriceRentalRack(court.priceRentalRack);
      setPriceRentalBall(court.priceRentalBall);
    } else {
      setEditingCourt(null);
      setCourtFormName('');
      setCourtFormAddress('140 Nguyễn Văn Cừ, Đồng Hới, Quảng Bình');
      setCourtFormDescription('');
      setCourtFormIsActive(true);
      setPriceDay(60000);
      setPriceFixedDay(80000);
      setPriceFixedNight(100000);
      setPriceRetailNight(120000);
      setPriceRentalRack(30000);
      setPriceRentalBall(30000);
    }
    setIsCourtModalOpen(true);
  };

  // 5. Quản lý sân: Lưu sân
  const handleSaveCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courtFormName.trim()) {
      triggerAlert('error', 'Vui lòng nhập tên sân.');
      return;
    }

    setGeneralLoading(true);
    try {
      const courtData = {
        name: courtFormName.trim(),
        address: courtFormAddress.trim(),
        description: courtFormDescription.trim(),
        isActive: courtFormIsActive,
        priceDay: Number(priceDay),
        priceFixedDay: Number(priceFixedDay),
        priceFixedNight: Number(priceFixedNight),
        priceRetailNight: Number(priceRetailNight),
        priceRentalRack: Number(priceRentalRack),
        priceRentalBall: Number(priceRentalBall)
      };

      if (editingCourt) {
        const courtRef = doc(db, 'courts', editingCourt.id);
        await updateDoc(courtRef, courtData);
        triggerAlert('success', 'Đã cập nhật thông tin sân thành công!');
      } else {
        const newDocRef = await addDoc(collection(db, 'courts'), courtData);
        await updateDoc(newDocRef, { id: newDocRef.id });
        triggerAlert('success', 'Đã thêm sân mới thành công!');
      }

      setIsCourtModalOpen(false);
      await onRefreshData();
    } catch (err) {
      console.error(err);
      triggerAlert('error', 'Gặp lỗi trong quá trình lưu thông tin sân.');
      handleFirestoreError(err, editingCourt ? OperationType.UPDATE : OperationType.CREATE, editingCourt ? `courts/${editingCourt.id}` : 'courts');
    } finally {
      setGeneralLoading(false);
    }
  };

  // 6. Xóa sân hoàn toàn
  const handleDeleteCourt = async (courtId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn XÓA SÂN này khỏi hệ thống? Tất cả thông tin bảng giá sẽ mất sạch.')) {
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
      handleFirestoreError(err, OperationType.DELETE, `courts/${courtId}`);
    } finally {
      setGeneralLoading(false);
    }
  };

  // 7. Lưu cấu hình hệ thống
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stk.trim() || !bankName.trim() || !adminPassword.trim()) {
      triggerAlert('error', 'Vui lòng nhập đầy đủ các thông tin bắt buộc.');
      return;
    }

    setGeneralLoading(true);
    try {
      let finalQrCodeUrl = qrCodeUrl.trim();
      if (!finalQrCodeUrl || finalQrCodeUrl.includes('vietqr.io')) {
        const cleanedBank = bankName.trim().replace(/\s+/g, '').toLowerCase();
        finalQrCodeUrl = `https://img.vietqr.io/image/${cleanedBank}-${stk.trim()}-compact2.png?amount=100000&addInfo=Thanh%20toan%20san%20Pickleball`;
      }

      const updatedConfig: SystemConfig = {
        stk: stk.trim(),
        bankName: bankName.trim(),
        qrCodeUrl: finalQrCodeUrl,
        adminPassword: adminPassword.trim()
      };

      await setDoc(doc(db, 'config', 'system'), updatedConfig, { merge: true });
      await onRefreshData();
      
      triggerAlert('success', 'Đã lưu cấu hình hệ thống thành công!');
    } catch (err) {
      console.error(err);
      triggerAlert('error', 'Lỗi khi lưu cấu hình hệ thống.');
      handleFirestoreError(err, OperationType.WRITE, 'config/system');
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
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase">Mật khẩu Quản trị</label>
              <button
                type="button"
                onClick={() => {
                  setIsForgotModalOpen(true);
                  setForgotPasswordStatus(null);
                  setShowPasswordInline(false);
                }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-850 hover:underline cursor-pointer focus:outline-hidden"
              >
                Quên mật khẩu?
              </button>
            </div>
            <input 
              type="password"
              required
              placeholder="Nhập mật khẩu..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50 text-slate-800"
            />
          </div>
          {loginError && <p className="text-xs text-red-500 font-semibold">{loginError}</p>}
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer text-sm"
          >
            Đăng Nhập
          </button>
        </form>

        {/* FORGOT PASSWORD MODAL */}
        {isForgotModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-55 overflow-y-auto" id="forgot-password-modal">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
              <div className="bg-indigo-600 p-5 text-white flex justify-between items-center shrink-0">
                <h3 className="font-extrabold text-sm md:text-base tracking-tight flex items-center gap-2">
                  <Key className="w-5 h-5 text-indigo-100" />
                  <span>QUÊN MẬT KHẨU QUẢN TRỊ</span>
                </h3>
                <button 
                  type="button" 
                  onClick={() => setIsForgotModalOpen(false)} 
                  className="text-indigo-100 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Hệ thống hỗ trợ gửi lại thông tin mật khẩu quản trị viên về địa chỉ hòm thư email chính chủ của bạn:
                </p>
                
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-800">phankien386@gmail.com</span>
                </div>

                {forgotPasswordStatus && (
                  <div className={`p-4 rounded-xl border text-xs leading-relaxed font-semibold ${
                    forgotPasswordStatus.type === 'success' 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                      : 'bg-rose-50 border-rose-100 text-rose-800'
                  }`}>
                    {forgotPasswordStatus.text}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={forgotPasswordLoading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5"
                >
                  <Mail className="w-4 h-4" />
                  <span>{forgotPasswordLoading ? 'Đang gửi email...' : 'Gửi mật khẩu về email'}</span>
                </button>
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsForgotModalOpen(false)} 
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col gap-6" id="admin-panel-container">
      
      {/* Admin Panel Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
            <span>QUẢN LÝ HỆ THỐNG VIP V2.0</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium">Bảng điều khiển theo thời gian thực kết nối Firestore</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'bookings' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Đơn đặt sân ({bookings.length})
          </button>
          <button
            onClick={() => setActiveTab('courts')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'courts' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Sân & Giá ({courts.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'settings' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5 inline mr-1" />
            Cấu hình
          </button>
        </div>
      </div>

      {/* Global notifications inside admin */}
      {message.text && (
        <div className={`p-4 rounded-xl border text-xs font-bold transition-all ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* 1. TAB: BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100/50">
            <span className="text-xs font-bold text-slate-500 uppercase">Bộ lọc trạng thái</span>
            <div className="flex gap-1.5">
              {(['all', 'pending', 'approved', 'cancelled'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setBookingStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    bookingStatusFilter === status
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {status === 'all' && 'Tất cả'}
                  {status === 'pending' && 'Chờ duyệt'}
                  {status === 'approved' && 'Đã duyệt'}
                  {status === 'cancelled' && 'Đã hủy'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {getFilteredBookings().length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <p className="text-slate-500 text-xs font-medium">Không có đơn đặt sân nào khớp bộ lọc.</p>
              </div>
            ) : (
              getFilteredBookings().map((booking) => (
                <div 
                  key={booking.id}
                  className="bg-white rounded-2xl border border-slate-100 p-5 shadow-2xs hover:border-slate-200 transition-all flex flex-col md:flex-row justify-between gap-4"
                >
                  <div className="flex-grow flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{booking.courtName}</span>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-xs uppercase ${
                        booking.type === 'fixed' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {booking.type === 'fixed' ? 'Cố định' : 'Thuê lẻ'}
                      </span>
                      {booking.isLightRequired && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-xs text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                          <Zap className="w-3 h-3 fill-amber-500 stroke-amber-800" />
                          Có đèn
                        </span>
                      )}
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-xs uppercase ${
                        booking.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                        booking.status === 'cancelled' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {booking.status === 'approved' && 'Đã duyệt'}
                        {booking.status === 'cancelled' && 'Đã hủy'}
                        {booking.status === 'pending' && 'Chờ duyệt'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex flex-col gap-1 mt-1">
                      <div><strong className="text-slate-800">Khách hàng:</strong> {booking.customerName} - <strong>SĐT:</strong> {booking.phone}</div>
                      <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /><span>Thời gian chơi: {booking.startTime} - {booking.endTime}</span></div>
                      <div className="flex items-start gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5" /><span className="break-all">Danh sách ngày: {booking.dates.join(', ')}</span></div>
                      {booking.services && booking.services.length > 0 && (
                        <div><strong>Dịch vụ:</strong> {booking.services.map(s => s === 'rack' ? 'Thuê vợt' : 'Rổ bóng').join(', ')}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end gap-3 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-medium">Doanh thu tạm tính</span>
                      <span className="text-base font-black text-indigo-600">{formatVND(booking.totalAmount)}</span>
                    </div>

                    {/* Operational Actions */}
                    <div className="flex gap-2">
                      {booking.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproveBooking(booking.id)}
                            disabled={actionLoadingId === booking.id}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Duyệt</span>
                          </button>
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            disabled={actionLoadingId === booking.id}
                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Hủy</span>
                          </button>
                        </>
                      )}
                      {booking.status !== 'pending' && (
                        <span className="text-[10px] text-slate-400 font-bold self-center mr-2">Đã xử lý</span>
                      )}
                      <button
                        onClick={() => handleDeleteBooking(booking.id)}
                        disabled={actionLoadingId === booking.id}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer"
                        title="Xóa vĩnh viễn"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. TAB: COURTS */}
      {activeTab === 'courts' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase">Danh sách sân trong hệ thống</span>
            <button
              onClick={() => openCourtModal(null)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shadow-3xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Sân Mới</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courts.map((court) => (
              <div 
                key={court.id}
                className="bg-white rounded-2xl border border-slate-100 p-5 shadow-2xs flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-sm font-bold text-slate-800">{court.name}</span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-sm uppercase ${
                      court.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {court.isActive ? 'Hoạt động' : 'Tạm dừng'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 flex items-start gap-1 mb-3"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />{court.address}</p>
                  
                  {/* Pricing Matrix summary */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-1.5 text-xs text-slate-600">
                    <div className="flex justify-between"><span>Giá sàn ban ngày:</span><span className="font-extrabold text-slate-950">{formatVND(court.priceDay)}/h</span></div>
                    <div className="flex justify-between"><span>Lịch cố định ngày:</span><span className="font-extrabold text-slate-950">{formatVND(court.priceFixedDay)}/h</span></div>
                    <div className="flex justify-between"><span>Lịch cố định tối (đèn):</span><span className="font-extrabold text-slate-950">{formatVND(court.priceFixedNight)}/h</span></div>
                    <div className="flex justify-between"><span>Giá thuê lẻ tối (đèn):</span><span className="font-extrabold text-slate-950">{formatVND(court.priceRetailNight)}/h</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5"><span>Vợt / Bóng thuê:</span><span className="font-bold text-slate-650">{formatVND(court.priceRentalRack)} / {formatVND(court.priceRentalBall)}</span></div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => openCourtModal(court)}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Sửa sân</span>
                  </button>
                  <button
                    onClick={() => handleDeleteCourt(court.id)}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa sân</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. TAB: SYSTEM SETTINGS */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 flex flex-col gap-4">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block border-b border-slate-200 pb-2">Cấu hình thanh toán & Mật khẩu hệ thống</span>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Tên Ngân Hàng <span className="text-red-500">*</span></label>
              <input 
                type="text"
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Số Tài Khoản (STK) <span className="text-red-500">*</span></label>
              <input 
                type="text"
                required
                value={stk}
                onChange={(e) => setStk(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-200/60 pt-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Mật Khẩu Quản Trị <span className="text-red-500">*</span></label>
              <input 
                type="text"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <p className="text-[10px] text-slate-400 mt-1 italic">Dùng để đăng nhập vào trang quản trị này.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Mã QR Thanh Toán Nhận Tiền</label>
              <div className="flex flex-col gap-3">
                {/* Visual Options / Status */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col gap-3">
                  {qrCodeUrl ? (
                    <div className="flex items-center gap-3">
                      <div className="relative w-16 h-16 bg-slate-50 rounded-lg border border-slate-100 p-1 flex items-center justify-center shrink-0">
                        {qrCodeUrl.startsWith('data:') ? (
                          <img 
                            src={qrCodeUrl} 
                            alt="QR Đã tải lên" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <FileImage className="w-8 h-8 text-indigo-500" />
                        )}
                        <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-[8px] font-bold px-1 py-0.5 rounded-sm">
                          {qrCodeUrl.startsWith('data:') ? 'Custom' : 'Link'}
                        </span>
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">
                          {qrCodeUrl.startsWith('data:') ? 'Mã QR hình ảnh cá nhân' : qrCodeUrl}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {qrCodeUrl.startsWith('data:') ? 'Đã nén tối ưu bộ nhớ' : 'Mã QR theo đường dẫn link'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setQrCodeUrl('');
                          triggerAlert('success', 'Đã chuyển về mã VietQR tự động theo STK.');
                        }}
                        className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer transition-all shrink-0"
                      >
                        Reset / Xóa
                      </button>
                    </div>
                  ) : (
                    <div className="bg-indigo-50/50 text-indigo-950 p-3 rounded-xl border border-indigo-100/50 flex items-start gap-2">
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <span className="font-bold">VietQR tự động:</span> Hệ thống đang tự tạo mã QR VietQR động theo tên ngân hàng <strong className="font-extrabold">{bankName || '(Chưa nhập)'}</strong> và số tài khoản <strong className="font-extrabold">{stk || '(Chưa nhập)'}</strong>.
                      </div>
                    </div>
                  )}

                  {/* The File Upload Area supporting Drag and Drop & huge 100MB+ files */}
                  <div className="relative border-2 border-dashed border-slate-250 hover:border-indigo-400 rounded-xl p-4 transition-colors flex flex-col items-center justify-center bg-slate-50/50">
                    <input 
                      type="file"
                      id="qr-file-upload"
                      accept="image/*"
                      disabled={isCompressingQR}
                      onChange={handleQRFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                    <span className="text-xs font-extrabold text-slate-750 text-center">
                      {isCompressingQR ? 'Đang nén ảnh kích thước lớn...' : 'Tải lên / Kéo thả ảnh mã QR ngân hàng'}
                    </span>
                    <span className="text-[9px] text-slate-400 mt-1 text-center font-medium leading-tight">
                      Hỗ trợ mọi kích thước ảnh (kể cả ảnh gốc camera &gt;100MB) nhờ công nghệ nén tại máy khách.
                    </span>
                  </div>

                  {qrUploadError && (
                    <div className="text-[10px] text-rose-600 font-semibold leading-tight mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{qrUploadError}</span>
                    </div>
                  )}

                  {/* Fallback Text Input for custom URLs */}
                  <div className="border-t border-slate-100 pt-3 mt-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Hoặc dán URL liên kết ảnh trực tiếp:</label>
                    <input 
                      type="text"
                      placeholder="https://example.com/my-qr-image.png"
                      value={qrCodeUrl.startsWith('data:') ? '' : qrCodeUrl}
                      onChange={(e) => setQrCodeUrl(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 placeholder-slate-350 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={generalLoading}
            className="mt-2 self-start px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer"
          >
            {generalLoading ? 'Đang lưu...' : 'Lưu cấu hình hệ thống'}
          </button>
        </form>
      )}

      {/* COURT CRUD MODAL DIALOG */}
      {isCourtModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-55 overflow-y-auto">
          <form onSubmit={handleSaveCourt} className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            
            <div className="bg-indigo-600 p-5 text-white flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-base md:text-lg">{editingCourt ? 'SỬA THÔNG TIN SÂN CHƠI' : 'THÊM MỚI SÂN PICKLEBALL'}</h3>
              <button type="button" onClick={() => setIsCourtModalOpen(false)} className="text-indigo-100 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tên Sân <span className="text-red-500">*</span></label>
                  <input 
                    type="text"
                    required
                    placeholder="Sân Pickleball Số..."
                    value={courtFormName}
                    onChange={(e) => setCourtFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Địa chỉ Sân</label>
                  <input 
                    type="text"
                    required
                    value={courtFormAddress}
                    onChange={(e) => setCourtFormAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Mô tả / Tiện ích sân</label>
                <textarea 
                  rows={2}
                  placeholder="Thảm đạt chuẩn, thung lũng gió mát..."
                  value={courtFormDescription}
                  onChange={(e) => setCourtFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox"
                    id="courtActive"
                    checked={courtFormIsActive}
                    onChange={(e) => setCourtFormIsActive(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded-md focus:ring-indigo-500"
                  />
                  <label htmlFor="courtActive" className="text-xs font-bold text-slate-600 uppercase select-none">Trạng thái hoạt động</label>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-3">Cấu hình bảng giá chi tiết (VND/giờ hoặc VND/buổi)</span>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Không dùng đèn (Ban ngày)</label>
                    <input 
                      type="number"
                      required
                      value={priceDay}
                      onChange={(e) => setPriceDay(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Có đèn - Khách thuê lẻ (17h - 22h)</label>
                    <input 
                      type="number"
                      required
                      value={priceRetailNight}
                      onChange={(e) => setPriceRetailNight(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Có đèn - Cố định (5h - 17h)</label>
                    <input 
                      type="number"
                      required
                      value={priceFixedDay}
                      onChange={(e) => setPriceFixedDay(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Có đèn - Cố định (17h - 22h)</label>
                    <input 
                      type="number"
                      required
                      value={priceFixedNight}
                      onChange={(e) => setPriceFixedNight(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-slate-150 pt-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Giá Thuê Thêm Vợt (Buổi)</label>
                    <input 
                      type="number"
                      required
                      value={priceRentalRack}
                      onChange={(e) => setPriceRentalRack(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Giá Thuê Rổ Bóng (Buổi)</label>
                    <input 
                      type="number"
                      required
                      value={priceRentalBall}
                      onChange={(e) => setPriceRentalBall(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button type="button" onClick={() => setIsCourtModalOpen(false)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer">Thoát</button>
              <button type="submit" disabled={generalLoading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs">{generalLoading ? 'Đang lưu...' : 'Lưu cấu hình sân'}</button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
};
