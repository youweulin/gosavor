import { useState, useEffect } from 'react';
import { Wallet, BarChart3 } from 'lucide-react';
import type { Expense } from '../types';
import type { SavedScan } from '../types';
import { getScanHistory, getExpenses, getActiveTrip } from '../services/storage';

interface TripSummaryProps {
  homeCurrency: string;
}

const TripSummary = ({}: TripSummaryProps) => {
  const [allScans, setAllScans] = useState<SavedScan[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    getScanHistory().then(setAllScans);
    getExpenses().then(setAllExpenses);
  }, []);

  if (allScans.length === 0 && allExpenses.length === 0) return null;

  const activeTrip = getActiveTrip();
  const tripStart = activeTrip?.startDate || 0;

  const scans = showAll ? allScans : allScans.filter(s => s.timestamp >= tripStart);
  const expenses = showAll ? allExpenses : allExpenses.filter(e => e.timestamp >= tripStart);

  // Trip duration
  const startTime = showAll
    ? (allScans.length > 0 ? Math.min(...allScans.map(s => s.timestamp)) : Date.now())
    : (tripStart || (scans.length > 0 ? Math.min(...scans.map(s => s.timestamp)) : Date.now()));
  const tripDays = Math.max(1, Math.ceil((Date.now() - startTime) / (1000 * 60 * 60 * 24)));

  // Total spending
  const totalByC: Record<string, number> = {};
  expenses.forEach(e => {
    totalByC[e.currency] = (totalByC[e.currency] || 0) + e.amount;
  });

  const formatAmount = (amount: number, currency: string) => {
    const formatted = Math.round(amount).toLocaleString();
    return currency === '¥' || currency === '$' || currency === '€'
      ? `${currency}${formatted}` : `${formatted} ${currency}`;
  };

  const menuCount = scans.filter(s => (s.scanMode || 'menu') === 'menu').length;
  const receiptCount = scans.filter(s => s.scanMode === 'receipt').length;
  const generalCount = scans.filter(s => s.scanMode === 'general').length;
  const arCount = scans.filter(s => s.scanMode === 'ar-translate').length;
  const chatCount = scans.filter(s => s.scanMode === 'chat').length;

  const tripName = showAll ? '全部統計' : (activeTrip?.name || '旅遊日記');

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🇯🇵</span>
          <h3 className="text-base font-bold text-gray-800">{tripName}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-green-600">第 {tripDays} 天</span>
          <button
            onClick={() => setShowAll(!showAll)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
              showAll ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <BarChart3 size={10} />
            {showAll ? '本趟' : '全部'}
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-orange-50 rounded-xl py-2">
          <p className="text-xl font-black text-orange-500">{menuCount}</p>
          <p className="text-[10px] text-gray-500">🍜 餐</p>
        </div>
        <div className="bg-pink-50 rounded-xl py-2">
          <p className="text-xl font-black text-pink-500">{receiptCount}</p>
          <p className="text-[10px] text-gray-500">🛍️ 購物</p>
        </div>
        <div className="bg-blue-50 rounded-xl py-2">
          <p className="text-xl font-black text-blue-500">{generalCount + arCount}</p>
          <p className="text-[10px] text-gray-500">📸 翻譯</p>
        </div>
        <div className="bg-green-50 rounded-xl py-2">
          <p className="text-xl font-black text-green-500">{chatCount}</p>
          <p className="text-[10px] text-gray-500">💬 對話</p>
        </div>
      </div>

      {/* Spending summary */}
      {Object.keys(totalByC).length > 0 && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <Wallet size={14} className="text-orange-500" />
          <span className="text-xs text-gray-500">已花費</span>
          <div className="flex gap-2 ml-auto">
            {Object.entries(totalByC).map(([curr, total]) => (
              <span key={curr} className="font-bold text-sm text-gray-900">
                {formatAmount(total, curr)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TripSummary;
