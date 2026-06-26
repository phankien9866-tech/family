export interface Court {
  id: string;
  name: string;
  address: string;
  description: string;
  isActive: boolean;
  priceDay: number;         // Không dùng đèn (Ban ngày)
  priceFixedDay: number;    // Có đèn - Cố định (5h - 17h)
  priceFixedNight: number;  // Có đèn - Cố định (17h - 22h)
  priceRetailNight: number; // Có đèn - Khách thuê lẻ (17h - 22h)
  priceRentalRack: number;  // Giá thuê thêm vợt
  priceRentalBall: number;  // Giá thuê rổ bóng
  imageUrl?: string;        // Ảnh minh họa tuỳ chỉnh cho sân
}

export interface Booking {
  id: string;
  customerName: string;
  phone: string;
  courtId: string;
  courtName: string;
  type: 'retail' | 'fixed'; // "retail" (đặt lẻ một lần) hoặc "fixed" (đặt lịch cố định)
  dates: string[];          // mảng các ngày cụ thể dạng YYYY-MM-DD
  startTime: string;        // "05:00" -> "22:00"
  endTime: string;          // "05:00" -> "22:00"
  isLightRequired: boolean; // Có bật đèn hay không
  services: ('rack' | 'ball')[]; // mảng chứa "rack", "ball"
  status: 'pending' | 'approved' | 'cancelled';
  totalAmount: number;      // Number
  createdAt?: string;       // Thời gian tạo
}

export interface SystemConfig {
  stk: string;              // Số tài khoản ngân hàng
  bankName: string;         // Tên ngân hàng
  qrCodeUrl: string;         // Link ảnh QR Code chuyển khoản
  adminPassword: string;    // Mật khẩu Admin
  hotline?: string;         // Số hotline liên hệ
}
