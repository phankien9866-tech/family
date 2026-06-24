import { useState, useEffect } from 'react';
import { Court, Booking, SystemConfig } from './types';
import { db, seedDatabaseIfEmpty, DEFAULT_CONFIG, handleFirestoreError, OperationType } from './firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { CourtCard } from './components/CourtCard';
import { BookingModal } from './components/BookingModal';
import { BookingHistory } from './components/BookingHistory';
import { AdminPanel } from './components/AdminPanel';
import { 
  Search, SlidersHorizontal, Sparkles, History, ShieldCheck, 
  MapPin, CheckSquare, Phone, Info, Star
} from 'lucide-react';

export default function App() {
  // Device ID for booking history tracking
  const [deviceId, setDeviceId] = useState('');
  
  // Data lists
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_CONFIG);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [courtTypeFilter, setCourtTypeFilter] = useState<'all' | 'trong_nha' | 'ngoai_troi'>('all');
  const [needCovered, setNeedCovered] = useState(false);
  const [needLight, setNeedLight] = useState(false);

  // Active view: 'book' | 'history' | 'admin'
  const [activeView, setActiveView] = useState<'book' | 'history' | 'admin'>('book');

  // Selected court for booking popup
  const [bookingCourt, setBookingCourt] = useState<Court | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);

  // 1. Initialize Device ID and Seed/Fetch Database
  useEffect(() => {
    // Unique device id stored in localStorage
    let storedId = localStorage.getItem('pickleball_device_id');
    if (!storedId) {
      storedId = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('pickleball_device_id', storedId);
    }
    setDeviceId(storedId);

    const initializeData = async () => {
      setIsLoading(true);
      try {
        // Seed first if db has no initial content
        await seedDatabaseIfEmpty();
        await fetchAllData();
      } catch (err) {
        console.error('Error in initial fetch:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  // 2. Fetch all collections from Cloud Firestore
  const fetchAllData = async () => {
    try {
      // Fetch courts
      const courtsQuery = query(collection(db, 'courts'));
      const courtsSnap = await getDocs(courtsQuery);
      const fetchedCourts: Court[] = [];
      courtsSnap.forEach((doc) => {
        fetchedCourts.push({ id: doc.id, ...doc.data() } as Court);
      });
      setCourts(fetchedCourts);

      // Fetch bookings ordered by creation date
      const bookingsQuery = query(collection(db, 'bookings'));
      const bookingsSnap = await getDocs(bookingsQuery);
      const fetchedBookings: Booking[] = [];
      bookingsSnap.forEach((doc) => {
        fetchedBookings.push({ id: doc.id, ...doc.data() } as Booking);
      });
      // Sort bookings descending (newest first)
      fetchedBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(fetchedBookings);

      // Fetch system configuration
      const configSnap = await getDocs(collection(db, 'config'));
      if (!configSnap.empty) {
        configSnap.forEach((doc) => {
          if (doc.id === 'system') {
            setSystemConfig(doc.data() as SystemConfig);
          }
        });
      }
    } catch (error) {
      console.error('Failed to sync with Cloud Firestore:', error);
      handleFirestoreError(error, OperationType.GET, 'courts');
    }
  };

  // Filter courts based on user input
  const getFilteredCourts = () => {
    return courts.filter((court) => {
      // Name/Address match query
      const matchSearch = 
        court.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        court.address.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Type match
      const matchType = courtTypeFilter === 'all' || court.type === courtTypeFilter;

      // Amenities filter
      const matchCovered = !needCovered || court.amenities.some(am => am.toLowerCase().includes('mái che'));
      const matchLight = !needLight || court.amenities.some(am => am.toLowerCase().includes('chiếu sáng') || am.toLowerCase().includes('đèn'));

      return matchSearch && matchType && matchCovered && matchLight;
    });
  };

  // Get current device bookings and pending notifications count
  const myBookings = bookings.filter(b => b.deviceId === deviceId);
  const myBookingsCount = myBookings.length;

  const handleBookingSuccess = async () => {
    setBookingCourt(null);
    setIsSuccessMessage(true);
    await fetchAllData(); // reload entire sync data safely
    setTimeout(() => {
      setIsSuccessMessage(false);
      setActiveView('history'); // direct customer to history page to see pending reservation
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col selection:bg-indigo-500 selection:text-white" id="main-root">
      
      {/* Dynamic Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-xs" id="main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo area */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>PICKLEBALL HUB</span>
                  <span className="text-xs bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-sm border border-indigo-100">V2.0</span>
                </h1>
                <p className="text-[10px] md:text-xs text-slate-400 font-medium">Hệ thống đặt sân & quản lý bảng giá thực tế</p>
              </div>
            </div>

            {/* Navigation tabs */}
            <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200" id="header-nav">
              <button
                onClick={() => setActiveView('book')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                  activeView === 'book'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Đặt Sân Chơi
              </button>
              
              <button
                onClick={() => setActiveView('history')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 relative cursor-pointer ${
                  activeView === 'history'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Đơn Của Tôi</span>
                {myBookingsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-sm">
                    {myBookingsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveView('admin')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                  activeView === 'admin'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Quản Trị</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Accent Section */}
      <div className="bg-indigo-950 text-white py-12 px-4 relative overflow-hidden shrink-0" id="hero-accent">
        <div className="absolute inset-0 opacity-10 bg-radial from-indigo-500 to-transparent"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
          <div className="text-center md:text-left">
            <span className="text-xs bg-indigo-500 text-white font-extrabold px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">
              Hệ thống đặt sân thông minh
            </span>
            <h2 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">
              ĐẶT LỊCH SÂN PICKLEBALL CHUYÊN NGHIỆP
            </h2>
            <p className="text-sm text-indigo-200 mt-2 max-w-2xl">
              Hỗ trợ tính tiền tự động theo bảng giá chi tiết trong nhà/ngoài trời, quản lý đơn đặt lịch lẻ/lịch cố định, nhận tiền qua mã QR chuyển khoản nhanh 24/7.
            </p>
          </div>
          <div className="flex gap-4 items-center bg-indigo-900/50 p-4 rounded-2xl border border-indigo-800/50 backdrop-blur-md">
            <div className="p-3 bg-indigo-600 rounded-xl text-white">
              <Phone className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <p className="text-indigo-300 font-bold uppercase">Hotline hỗ trợ gấp</p>
              <p className="text-base font-black text-white mt-0.5">0912.345.678</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        
        {/* Success alert message for reservation submission */}
        {isSuccessMessage && (
          <div className="mb-6 bg-emerald-50 border border-emerald-100 text-emerald-800 p-5 rounded-2xl shadow-md flex items-start gap-4 animate-bounce" id="success-alert">
            <div className="p-2 bg-emerald-500 text-white rounded-xl">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm md:text-base">GỬI YÊU CẦU ĐẶT SÂN THÀNH CÔNG!</h4>
              <p className="text-xs text-emerald-700/90 mt-1">
                Lịch đặt sân của bạn đã được ghi nhận trên Cloud Firestore. Vui lòng chụp màn hình chuyển khoản (nếu chọn Chuyển khoản) và đợi Admin duyệt trong vài phút!
              </p>
            </div>
          </div>
        )}

        {/* Global Loading state */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4" id="global-loader">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-semibold text-sm">Đang tải dữ liệu từ Cloud Firestore...</p>
          </div>
        ) : (
          <>
            {/* 1. VIEW: BOOK (Đặt sân & Bộ lọc) */}
            {activeView === 'book' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="book-view-container">
                
                {/* Left Column: Smart Filters (BỘ LỌC THÔNG MINH BÊN TRÁI) */}
                <aside className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col gap-6 h-fit" id="filter-sidebar">
                  
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                      <h3 className="font-extrabold text-slate-800 text-sm md:text-base uppercase tracking-tight">Bộ lọc tìm kiếm</h3>
                    </div>
                    {(searchQuery || courtTypeFilter !== 'all' || needCovered || needLight) && (
                      <button 
                        onClick={() => {
                          setSearchQuery('');
                          setCourtTypeFilter('all');
                          setNeedCovered(false);
                          setNeedLight(false);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                        id="btn-clear-filters"
                      >
                        Xóa tất cả
                      </button>
                    )}
                  </div>

                  {/* Filter Input 1: Tìm kiếm tên/địa chỉ */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tìm theo tên hoặc địa chỉ</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text"
                        placeholder="Tìm sân Nguyễn Văn Cừ, trong nhà..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs md:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 bg-slate-50/50 text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Filter Option 2: Loại sân (Tất cả/Trong nhà/Ngoài trời) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Loại sân</label>
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => setCourtTypeFilter('all')}
                        className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          courtTypeFilter === 'all' 
                            ? 'bg-white text-slate-900 shadow-2xs font-bold' 
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        Tất cả
                      </button>
                      <button
                        onClick={() => setCourtTypeFilter('trong_nha')}
                        className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          courtTypeFilter === 'trong_nha' 
                            ? 'bg-white text-slate-900 shadow-2xs font-bold' 
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        Trong nhà
                      </button>
                      <button
                        onClick={() => setCourtTypeFilter('ngoai_troi')}
                        className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          courtTypeFilter === 'ngoai_troi' 
                            ? 'bg-white text-slate-900 shadow-2xs font-bold' 
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        Ngoài trời
                      </button>
                    </div>
                  </div>

                  {/* Filter Option 3: Tiện ích tối thiểu */}
                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tiện ích tối thiểu</label>
                    <div className="flex flex-col gap-2.5">
                      <button
                        type="button"
                        onClick={() => setNeedCovered(!needCovered)}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          needCovered ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900' : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <CheckSquare className={`w-4 h-4 ${needCovered ? 'text-indigo-600' : 'text-slate-300'}`} />
                        <span className="text-xs font-bold">Có mái che mưa nắng</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNeedLight(!needLight)}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          needLight ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900' : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <CheckSquare className={`w-4 h-4 ${needLight ? 'text-indigo-600' : 'text-slate-300'}`} />
                        <span className="text-xs font-bold">Hệ thống chiếu sáng đêm</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-[11px] text-slate-400 flex items-start gap-1.5 leading-normal">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>Lưu ý: Bảng giá hệ thống luôn hiển thị giá thực tế theo cấu hình và thời điểm chơi có bật đèn hay không. Không có đánh giá ảo.</span>
                  </div>

                </aside>

                {/* Right Column: Courts Grid */}
                <section className="lg:col-span-8 flex flex-col gap-6" id="courts-grid-container">
                  <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100">
                    <p className="text-xs md:text-sm font-semibold text-slate-600">
                      Tìm thấy <strong className="text-indigo-600 font-extrabold">{getFilteredCourts().length} sân</strong> đáp ứng các tiêu chuẩn lựa chọn.
                    </p>
                  </div>

                  {getFilteredCourts().length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-3xs" id="no-courts-found">
                      <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600 font-bold text-base">Không tìm thấy sân phù hợp</p>
                      <p className="text-slate-400 text-xs mt-1">Vui lòng thay đổi từ khóa tìm kiếm hoặc điều chỉnh bộ lọc tiện ích.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="courts-grid">
                      {getFilteredCourts().map((court) => (
                        <CourtCard 
                          key={court.id} 
                          court={court} 
                          onBookNow={(selectedCourt) => setBookingCourt(selectedCourt)} 
                        />
                      ))}
                    </div>
                  )}
                </section>

              </div>
            )}

            {/* 2. VIEW: HISTORY (Lịch sử của tôi) */}
            {activeView === 'history' && (
              <div className="max-w-4xl mx-auto" id="history-view-container">
                <BookingHistory bookings={myBookings} />
              </div>
            )}

            {/* 3. VIEW: ADMIN (Trang quản trị viên) */}
            {activeView === 'admin' && (
              <div className="max-w-5xl mx-auto" id="admin-view-container">
                <AdminPanel 
                  courts={courts}
                  bookings={bookings}
                  systemConfig={systemConfig}
                  onRefreshData={fetchAllData}
                />
              </div>
            )}
          </>
        )}

      </main>

      {/* Dynamic Booking Dialog Portal */}
      {bookingCourt && (
        <BookingModal 
          court={bookingCourt} 
          deviceId={deviceId}
          systemConfig={systemConfig}
          onClose={() => setBookingCourt(null)}
          onBookingSuccess={handleBookingSuccess}
        />
      )}

      {/* Modern Compact Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 px-4 border-t border-slate-800 mt-auto shrink-0" id="main-footer">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
          <div className="text-center sm:text-left">
            <p className="font-extrabold text-white text-sm">HỆ THỐNG ĐẶT SÂN PICKLEBALL TRUNG TÂM</p>
            <p className="text-slate-500 mt-1">Bản quyền © 2026. Thiết kế và vận hành theo bảng giá thực tế.</p>
          </div>
          <div className="flex gap-4">
            <span className="text-slate-500">Địa chỉ: 140 Nguyễn Văn Cừ, Đồng Hới, Quảng Trị</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
