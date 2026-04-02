import { useState, useEffect } from 'react';
import { UtensilsCrossed, Receipt, Languages, MessageCircle, Wallet, Calendar, BarChart3 } from 'lucide-react';
import type { SavedScan, Expense } from '../types';
import { getScanHistory, getExpenses, getActiveTrip } from '../services/storage';

interface TripSummaryProps {
  homeCurrency: string;
}

const TripSummary = ({ homeCurrency }: TripSummaryProps) => {
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
  const generalScans = scans.filter(s => s.scanMode === 'general' || s.scanMode === 'ar-translate').length;
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

  const stats = [
    { icon: Languages, value: generalScans, label: '圖文翻譯', color: 'text-slate-600', bg: 'bg-slate-50' },
    { icon: UtensilsCrossed, value: menuScans, label: '菜單翻譯', color: 'text-orange-500', bg: 'bg-orange-50' },
    { icon: Receipt, value: receiptScans, label: '收據翻譯', color: 'text-blue-500', bg: 'bg-blue-50' },
    { icon: MessageCircle, value: chatCount, label: '對話翻譯', color: 'text-purple-500', bg: 'bg-purple-50' },
    { icon: Calendar, value: tripDays, label: '天', color: 'text-green-500', bg: 'bg-green-50' },
  ];

  const title = showAll ? '📊 全部統計' : `🗾 ${activeTrip?.name || '旅遊日記'}`;

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-gray-700">{title}</h3>
        <button
          onClick={() => setShowAll(!showAll)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            showAll
              ? 'bg-orange-100 text-orange-600'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          <BarChart3 size={12} />
          {showAll ? '本趟旅程' : '全部統計'}
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="text-center">
              <div className={`w-10 h-10 mx-auto rounded-xl ${stat.bg} flex items-center justify-center mb-1`}>
                <Icon size={18} className={stat.color} />
              </div>
              <p className="text-lg font-black text-gray-900">{stat.value}</p>
              <p className="text-[10px] text-gray-400">{stat.label}</p>
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
