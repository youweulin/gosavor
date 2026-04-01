import { useState, useEffect } from 'react';
import { Camera, UtensilsCrossed, Receipt, Wallet, Calendar } from 'lucide-react';
import type { SavedScan, Expense } from '../types';
import { getScanHistory, getExpenses } from '../services/storage';

interface TripSummaryProps {
  homeCurrency: string;
}

const TripSummary = ({ homeCurrency }: TripSummaryProps) => {
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    getScanHistory().then(setScans);
    getExpenses().then(setExpenses);
  }, []);

  if (scans.length === 0 && expenses.length === 0) return null;

  // Calculate trip stats
  const menuScans = scans.filter(s => (s.scanMode || 'menu') === 'menu').length;
  const receiptScans = scans.filter(s => s.scanMode === 'receipt').length;
  const generalScans = scans.filter(s => s.scanMode === 'general').length;
  const totalScans = scans.length;

  // Trip duration (first scan to now)
  const firstScanTime = scans.length > 0
    ? Math.min(...scans.map(s => s.timestamp))
    : Date.now();
  const tripDays = Math.max(1, Math.ceil((Date.now() - firstScanTime) / (1000 * 60 * 60 * 24)));

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
    { icon: Camera, value: totalScans, label: '次掃描', color: 'text-orange-500', bg: 'bg-orange-50' },
    { icon: UtensilsCrossed, value: menuScans, label: '餐', color: 'text-orange-500', bg: 'bg-orange-50' },
    { icon: Receipt, value: receiptScans, label: '張收據', color: 'text-blue-500', bg: 'bg-blue-50' },
    { icon: Calendar, value: tripDays, label: '天', color: 'text-green-500', bg: 'bg-green-50' },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <h3 className="text-sm font-bold text-gray-500 mb-3">🗾 這趟旅行</h3>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
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
