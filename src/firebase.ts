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

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Default Courts matching the new schema
export const DEFAULT_COURTS: Court[] = [
  {
    id: 'court-1',
    name: 'Sân Pickleball Số 1 (Trong nhà)',
    address: '140 Nguyễn Văn Cừ, Đồng Hới, Quảng Bình',
    description: 'Sân pickleball trong nhà chất lượng cao, có mái che chống mưa nắng tuyệt đối, thảm đạt tiêu chuẩn thi đấu, đèn chiếu sáng cao cấp.',
    isActive: true,
    priceDay: 60000,          // Không dùng đèn (Ban ngày)
    priceFixedDay: 80000,    // Có đèn - Cố định (5h - 17h)
    priceFixedNight: 100000, // Có đèn - Cố định (17h - 22h)
    priceRetailNight: 120000, // Có đèn - Khách thuê lẻ (17h - 22h)
    priceRentalRack: 30000,  // Giá thuê thêm vợt
    priceRentalBall: 30000   // Giá thuê rổ bóng
  },
  {
    id: 'court-2',
    name: 'Sân Pickleball Số 2 (Trong nhà - VIP)',
    address: '140 Nguyễn Văn Cừ, Đồng Hới, Quảng Bình',
    description: 'Sân pickleball trong nhà VIP thoáng mát, trang thiết bị thi đấu chuyên nghiệp, hệ thống đèn chiếu sáng thông minh.',
    isActive: true,
    priceDay: 60000,
    priceFixedDay: 80000,
    priceFixedNight: 100000,
    priceRetailNight: 120000,
    priceRentalRack: 30000,
    priceRentalBall: 30000
  }
];

// Default System Configuration matching config/system
export const DEFAULT_CONFIG: SystemConfig = {
  stk: '1023456789',
  bankName: 'Vietcombank',
  qrCodeUrl: 'https://img.vietqr.io/image/vietcombank-1023456789-compact2.png?amount=180000&addInfo=Thanh%20toan%20san%20Pickleball',
  adminPassword: 'admin' // plain admin password as requested
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
    handleFirestoreError(error, OperationType.WRITE, 'courts');
  }
}
