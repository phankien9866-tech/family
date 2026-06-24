import { initializeApp } from 'firebase/app';
import { initializeFirestore, getDocs, collection, setDoc, doc } from 'firebase/firestore';
import { Court, SystemConfig } from './types';

// Real Firebase configurations from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyCRjywEvtUWtS9bc_AqXh7woWSUAVeihFk",
  authDomain: "yttriferous-cursor-pjmtp.firebaseapp.com",
  projectId: "yttriferous-cursor-pjmtp",
  storageBucket: "yttriferous-cursor-pjmtp.firebasestorage.app",
  messagingSenderId: "643103095881",
  appId: "1:643103095881:web:e1f3864e8f0571719a1398"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID from config
const db = initializeFirestore(app, {}, "ai-studio-281e5529-8b9c-47bf-8f84-623b0cbe1c16");

export { db };

// Default Courts (Bản 2 chính xác bảng giá thực tế)
export const DEFAULT_COURTS: Court[] = [
  {
    id: 'court-1',
    name: 'Sân Pickleball Số 1 (Trong nhà)',
    address: '140 - Nguyễn Văn Cừ - Đồng Hới - Quảng Trị',
    type: 'trong_nha',
    amenities: ['Có mái che mưa nắng', 'Hệ thống chiếu sáng đêm'],
    pricing: {
      dayRate: 60000,          // Giờ ban ngày không dùng đèn
      nightRate: 120000,       // Giờ ban đêm có dùng đèn
      fixedLightDay: 80000,    // Đèn cố định (5h - 17h)
      fixedLightNight: 100000, // Đèn cố định (17h - 22h)
      customLightRate: 120000  // Đèn khách thuê lẻ
    },
    services: {
      racketRentPrice: 30000,  // Thuê thêm vợt
      ballRentPrice: 30000     // Rổ bóng tập
    },
    description: 'Sân pickleball trong nhà chất lượng cao, có mái che chống mưa nắng tuyệt đối, thảm đạt tiêu chuẩn thi đấu, đèn chiếu sáng cao cấp.'
  },
  {
    id: 'court-2',
    name: 'Sân Pickleball Số 2 (Ngoài trời)',
    address: '140 - Nguyễn Văn Cừ - Đồng Hới - Quảng Trị',
    type: 'ngoai_troi',
    amenities: ['Hệ thống chiếu sáng đêm (Không có mái che)'],
    pricing: {
      dayRate: 120000,          // Giờ ban ngày (No lights / Standard)
      nightRate: 180000,        // Giờ có đèn tối (Tùy khung giờ có đèn)
      fixedLightDay: 120000,    // Khung giờ chuẩn không đèn
      fixedLightNight: 180000,  // Khung giờ có đèn
      customLightRate: 180000   // Thuê lẻ giờ có đèn
    },
    services: {
      racketRentPrice: 30000,
      ballRentPrice: 30000
    },
    description: 'Sân pickleball ngoài trời thoáng mát, không gian rộng rãi, hệ thống đèn chiếu sáng đêm hiện đại, phù hợp cho những trận đấu kịch tính.'
  }
];

// Default System Configuration
export const DEFAULT_CONFIG: SystemConfig = {
  bankName: 'Vietcombank',
  bankAccount: '1023456789',
  bankOwner: 'NGUYEN VAN A',
  qrCodeUrl: 'https://img.vietqr.io/image/vietcombank-1023456789-compact2.png?amount=100000&addInfo=Thanh%20toan%20san%20Pickleball',
  adminPasswordHash: 'admin123', // plain default, can be modified via system settings
  defaultRacketPrice: 30000,
  defaultBallPrice: 30000
};

// Seeding helper to guarantee initial data is loaded
export async function seedDatabaseIfEmpty() {
  try {
    const courtsSnap = await getDocs(collection(db, 'courts'));
    if (courtsSnap.empty) {
      console.log('Seeding initial courts...');
      for (const court of DEFAULT_COURTS) {
        await setDoc(doc(db, 'courts', court.id), court);
      }
    }

    const configSnap = await getDocs(collection(db, 'config'));
    if (configSnap.empty) {
      console.log('Seeding initial configuration...');
      await setDoc(doc(db, 'config', 'system'), DEFAULT_CONFIG);
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}
