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
  ocrDebug?: {
    source: string;
    blocks: any[];
    rawResponse?: string;
  };
}

// === Receipt Analysis ===
export interface ReceiptItem {
  originalName: string;
  translatedName: string;
  quantity: string;
  price: string;
  janCode?: string;
  boundingBox?: number[];
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
  boundingBox?: number[]; // [ymin, xmin, ymax, xmax] 0-1000 scale (AR translate)
}

export interface GeneralAnalysisResult {
  locationGuess?: string;
  items: GeneralItem[];
}

// === Scan Mode ===
export type ScanMode = 'menu' | 'receipt' | 'general' | 'ar-translate' | 'chat';
export type UIScanMode = 'menu' | 'receipt' | 'general'; // Modes with UI config

// === Scan History ===
export interface SavedScan {
  id: string;
  timestamp: number;
  restaurantName: string;
  currency: string;
  scanMode: ScanMode;
  items: MenuItem[];
  images: string[];
  receiptData?: ReceiptAnalysisResult;
  generalData?: GeneralAnalysisResult;
  note?: string; // user diary note
  mood?: string; // emoji mood
  tags?: string[]; // category tags
  arTranslateItems?: { original: string; translated: string; boundingBox?: number[] }[]; // AR translate results
  chatMessages?: { role: 'user' | 'staff'; original: string; translated: string }[]; // Chat conversation
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

// === Expense / Accounting ===
export interface Expense {
  id: string;
  timestamp: number;
  merchantName: string;
  amount: number;
  currency: string;
  category: string; // 購物/餐飲/交通/其他
  payer: string;
  items?: ReceiptItem[];
  isTaxFree?: boolean;
}

// === Trip ===
export interface Trip {
  id: string;
  name: string;          // e.g. "東京 5日遊"
  startDate: number;     // timestamp
  endDate?: number;       // timestamp (when finished)
  location?: string;      // main city
  totalScans: number;
  totalMeals: number;
  totalReceipts: number;
  totalSpending: Record<string, number>; // { "¥": 30813 }
  isActive: boolean;
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
export type UserPlan = 'free' | 'beta' | 'supporter' | 'pro' | 'rental';

// === Constants ===
// Re-exported from i18n - kept for backward compatibility
export { SUPPORTED_LANGUAGES as TARGET_LANGUAGES } from '../i18n';

export const HOME_CURRENCIES = [
  { code: 'TWD', label: '新台幣 TWD', symbol: 'NT$' },
  { code: 'HKD', label: '港幣 HKD', symbol: 'HK$' },
  { code: 'CNY', label: '人民幣 CNY', symbol: '¥' },
  { code: 'USD', label: '美元 USD', symbol: '$' },
  { code: 'KRW', label: '韓元 KRW', symbol: '₩' },
  { code: 'THB', label: '泰銖 THB', symbol: '฿' },
  { code: 'VND', label: '越南盾 VND', symbol: '₫' },
  { code: 'SGD', label: '新加坡幣 SGD', symbol: 'S$' },
  { code: 'MYR', label: '馬來幣 MYR', symbol: 'RM' },
  { code: 'EUR', label: '歐元 EUR', symbol: '€' },
  { code: 'GBP', label: '英鎊 GBP', symbol: '£' },
  { code: 'AUD', label: '澳幣 AUD', symbol: 'A$' },
];

// Allergen IDs — display labels come from i18n keys: allergen.{id}
export const COMMON_ALLERGEN_IDS = [
  'shrimp', 'crab', 'peanut', 'egg', 'milk', 'wheat',
  'soba', 'fish', 'soy', 'sesame', 'shellfish', 'beef', 'pork',
];

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  taxRate: 0,
  serviceFee: 0,
  targetLanguage: 'zh-TW',
  allergens: [],
  homeCurrency: 'TWD',
};
