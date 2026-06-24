export interface CourtPricing {
  dayRate: number; // h/day time
  nightRate: number; // h/night time
  fixedLightDay?: number; // 5h - 17h fixed
  fixedLightNight?: number; // 17h - 22h fixed
  customLightRate?: number; // Khách thuê lẻ có đèn
}

export interface Court {
  id: string;
  name: string;
  address: string;
  type: 'trong_nha' | 'ngoai_troi';
  amenities: string[]; // ['Có mái che', 'Có hệ thống chiếu sáng']
  pricing: CourtPricing;
  services: {
    racketRentPrice: number;
    ballRentPrice: number;
  };
  description?: string;
}

export interface SystemConfig {
  bankName: string;
  bankAccount: string;
  bankOwner: string;
  qrCodeUrl: string;
  adminPasswordHash: string; // stored plainly or simple hash for simplicity
  defaultRacketPrice: number;
  defaultBallPrice: number;
}

export interface Booking {
  id: string;
  courtId: string;
  courtName: string;
  customerName: string;
  customerPhone: string;
  bookingType: 'once' | 'fixed'; // một lần hoặc cố định
  selectedDays?: string[]; // e.g. ["Thứ 2", "Thứ 4"] for repeating, or list of actual dates if pre-calculated
  dates: string[]; // array of ISO strings "YYYY-MM-DD" representing the actual booked dates
  startTime: string; // e.g., "08:00"
  endTime: string; // e.g., "10:00"
  hasRackets: boolean;
  hasBalls: boolean;
  totalAmount: number;
  paymentMethod: 'cash' | 'banking';
  notes: string;
  status: 'pending' | 'approved' | 'cancelled';
  deviceId: string; // device identifier for local history badge accuracy
  createdAt: string;
}
