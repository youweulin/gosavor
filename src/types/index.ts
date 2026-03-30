// === Menu Analysis ===
export interface MenuItem {
  originalName: string;
  translatedName: string;
  description: string;
  price: string;
  category: string;
  spicyLevel?: number; // 0-3
  recommended?: boolean;
  allergens?: string[]; // e.g. ["shrimp", "peanut"]
  boundingBox?: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1
  imageIndex?: number; // which image this item belongs to (0-based)
}

export interface MenuAnalysisResult {
  currency: string;
  restaurantName?: string;
  items: MenuItem[];
}

// === Receipt Analysis ===
export interface ReceiptItem {
  originalName: string;
  translatedName: string;
  quantity: string;
  price: string;
}

export interface ReceiptAnalysisResult {
  merchantName: string;
  date: string;
  currency: string;
  totalAmount: string;
  items: ReceiptItem[];
  tax?: string;
  serviceCharge?: string;
  isTaxFree?: boolean;
  totalQuantity?: number;
}

// === General/Sign Translation ===
export interface GeneralItem {
  originalText: string;
  translatedText: string;
  explanation: string;
  category: string;
}

export interface GeneralAnalysisResult {
  locationGuess?: string;
  items: GeneralItem[];
}

// === Scan Mode ===
export type ScanMode = 'menu' | 'receipt' | 'general';

// === Scan History ===
export interface SavedScan {
  id: string;
  timestamp: number;
  restaurantName: string;
  currency: string;
  items: MenuItem[];
  images: string[]; // base64 thumbnails
}

// === Order ===
export interface OrderItem {
  item: MenuItem;
  quantity: number;
  index: number;
}

export interface SplitInfo {
  persons: number;
  paidBy: string;
  perPerson: number;
}

export interface SavedOrder {
  id: string;
  timestamp: number;
  restaurantName: string;
  location?: { lat: number; lng: number };
  currency: string;
  items: OrderItem[];
  totalAmount: number;
  splitInfo?: SplitInfo;
}

// === Settings ===
export interface AppSettings {
  geminiApiKey: string;
  taxRate: number; // percentage, e.g. 10
  serviceFee: number; // percentage, e.g. 0
  targetLanguage: string;
  allergens: string[];
  homeCurrency: string; // e.g. "TWD"
}

// === User Auth ===
export type UserPlan = 'free' | 'rental' | 'lifetime';

export interface UserData {
  uid: string;
  email: string;
  plan: UserPlan;
  rentalExpiry?: number; // timestamp
  createdAt: number;
}

// === Constants ===
export const TARGET_LANGUAGES = [
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'th', label: 'ภาษาไทย' },
  { code: 'vi', label: 'Tiếng Việt' },
];

export const COMMON_ALLERGENS = [
  { id: 'shrimp', label: '蝦', labelJa: 'えび' },
  { id: 'crab', label: '蟹', labelJa: 'かに' },
  { id: 'peanut', label: '花生', labelJa: 'ピーナッツ' },
  { id: 'egg', label: '蛋', labelJa: '卵' },
  { id: 'milk', label: '牛奶', labelJa: '乳' },
  { id: 'wheat', label: '小麥', labelJa: '小麦' },
  { id: 'soba', label: '蕎麥', labelJa: 'そば' },
  { id: 'fish', label: '魚', labelJa: '魚' },
  { id: 'soy', label: '大豆', labelJa: '大豆' },
  { id: 'sesame', label: '芝麻', labelJa: 'ごま' },
  { id: 'shellfish', label: '貝類', labelJa: '貝類' },
  { id: 'beef', label: '牛肉', labelJa: '牛肉' },
  { id: 'pork', label: '豬肉', labelJa: '豚肉' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  taxRate: 10,
  serviceFee: 0,
  targetLanguage: 'zh-TW',
  allergens: [],
  homeCurrency: 'TWD',
};
