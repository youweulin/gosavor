import { useState, useEffect } from 'react';
import { UtensilsCrossed, Receipt, Languages, MessageCircle, Wallet, BarChart3, Scan } from 'lucide-react';
import type { SavedScan, Expense } from '../types';
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

  // Filter by current trip or show all
  const scans = showAll ? allScans : allScans.filter(s => s.timestamp >= tripStart);
  const expenses = showAll ? allExpenses : allExpenses.filter(e => e.timestamp >= tripStart);

  const menuScans = scans.filter(s => (s.scanMode || 'menu') === 'menu').length;
  const receiptScans = scans.filter(s => s.scanMode === 'receipt').length;
  const generalScans = scans.filter(s => s.scanMode === 'general').length;
  const arScans = scans.filter(s => s.scanMode === 'ar-translate').length;
  const chatCount = parseInt(localStorage.getItem('gosavor_chat_count') || '0');

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

  // 順序配合底部 BottomTabBar：萬用 → 菜單 → AR → 收據 → 對話
  const stats = [
    { icon: Languages, value: generalScans, color: 'text-slate-600' },
    { icon: UtensilsCrossed, value: menuScans, color: 'text-orange-500' },
    { icon: Scan, value: arScans, color: 'text-zinc-500' },
    { icon: Receipt, value: receiptScans, color: 'text-blue-500' },
    { icon: MessageCircle, value: chatCount, color: 'text-purple-500' },
  ];

  const tripName = showAll ? '全部統計' : (activeTrip?.name || '旅遊日記');

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      {/* Header: trip name + days + toggle */}
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

      {/* Stats: icons + big numbers only */}
      <div className="grid grid-cols-5 gap-1">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="flex items-center gap-2 justify-center">
              <Icon size={16} className={stat.color} />
              <span className="text-2xl font-black text-gray-900">{stat.value}</span>
            </div>
          );
        })}
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
