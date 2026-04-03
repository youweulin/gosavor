import { useState, useEffect } from 'react';
import { Wallet, BarChart3 } from 'lucide-react';
import type { SavedScan, Expense } from '../types';
import { getScanHistory, getExpenses, getActiveTrip } from '../services/storage';

interface TripSummaryProps {
  homeCurrency: string;
}

const modeEmoji = (mode?: string) => {
  switch (mode) {
    case 'receipt': return '🛍️';
    case 'general': return '⛩️';
    case 'ar-translate': return '📷';
    case 'chat': return '💬';
    default: return '🍜';
  }
};

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

  // Recent highlights (last 5)
  const recentScans = scans.slice(0, 5);

  // Summary stats
  const menuCount = scans.filter(s => (s.scanMode || 'menu') === 'menu').length;
  const receiptCount = scans.filter(s => s.scanMode === 'receipt').length;

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

      {/* Quick stats row */}
      <div className="flex gap-3 mb-3 text-xs text-gray-500">
        {menuCount > 0 && <span>🍜 {menuCount}餐</span>}
        {receiptCount > 0 && <span>🛍️ {receiptCount}購物</span>}
        {scans.length - menuCount - receiptCount > 0 && <span>📸 {scans.length - menuCount - receiptCount}翻譯</span>}
      </div>

      {/* Recent highlights */}
      {recentScans.length > 0 && (
        <div className="space-y-2 mb-3">
          {recentScans.map(scan => {
            const name = String(scan.restaurantName || '').replace(/\[Native\]\s?|\[Cloud\]\s?/g, '') || '掃描';
            const time = new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Get highlight text
            let detail = '';
            if ((scan.scanMode || 'menu') === 'menu' && scan.items.length > 0) {
              detail = scan.items.slice(0, 2).map(i => i.translatedName).join('、');
            } else if (scan.scanMode === 'receipt' && scan.receiptData?.items) {
              detail = scan.receiptData.items.slice(0, 2).map(i => i.translatedName || i.originalName).join('、');
            } else if (scan.scanMode === 'general' && scan.generalData?.items?.[0]) {
              detail = scan.generalData.items[0].translatedText?.substring(0, 20) || '';
            }

            return (
              <div key={scan.id} className="flex items-center gap-2">
                <span className="text-sm">{modeEmoji(scan.scanMode)}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-gray-800 truncate block">{name}</span>
                  {detail && <span className="text-[10px] text-gray-400 truncate block">{detail}</span>}
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">{time}</span>
              </div>
            );
          })}
        </div>
      )}

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
