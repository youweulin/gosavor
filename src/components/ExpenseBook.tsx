import { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Calendar, Store, Tag, User, TrendingUp } from 'lucide-react';
import type { Expense } from '../types';
import { getExpenses, deleteExpense } from '../services/storage';
import { useT } from '../i18n/context';

interface ExpenseBookProps {
  onBack: () => void;
}

const ExpenseBook = ({ onBack }: ExpenseBookProps) => {
  const t = useT();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    getExpenses().then(setExpenses);
  }, []);

  const categories = Array.from(new Set(expenses.map(e => e.category)));
  const filtered = filter === 'all' ? expenses : expenses.filter(e => e.category === filter);

  // Group by date
  const grouped = filtered.reduce<Record<string, Expense[]>>((acc, exp) => {
    const date = new Date(exp.timestamp).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(exp);
    return acc;
  }, {});

  // Totals
  const totalByCurrency = filtered.reduce<Record<string, number>>((acc, exp) => {
    acc[exp.currency] = (acc[exp.currency] || 0) + exp.amount;
    return acc;
  }, {});

  const formatAmount = (amount: number, currency: string) => {
    const formatted = amount.toLocaleString();
    return currency === '¥' || currency === '$' || currency === '€'
      ? `${currency}${formatted}` : `${formatted} ${currency}`;
  };

  const handleDelete = async (id: string) => {
    const updated = await deleteExpense(id);
    setExpenses(updated);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-sm px-4 py-4 flex items-center gap-3 border-b border-gray-800">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-800">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-lg">{t('expenses.title')}</h1>
        <span className="text-xs text-gray-500 ml-auto">{expenses.length} 筆</span>
      </div>

      {/* Summary */}
      {Object.keys(totalByCurrency).length > 0 && (
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-orange-400" />
            <span className="text-xs text-gray-400">{t('expenses.total')}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(totalByCurrency).map(([curr, total]) => (
              <div key={curr} className="text-xl font-black text-orange-400">
                {formatAmount(total, curr)}
              </div>
            ))}
          </div>
          {/* Category breakdown */}
          <div className="flex gap-3 mt-2">
            {categories.map(cat => {
              const catTotal = filtered.filter(e => e.category === cat)
                .reduce((acc, e) => acc + e.amount, 0);
              const mainCurrency = expenses[0]?.currency || '¥';
              return (
                <div key={cat} className="text-xs text-gray-500">
                  <span className="text-gray-400">{cat}</span> {formatAmount(catTotal, mainCurrency)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="px-4 py-2 flex gap-1 overflow-x-auto border-b border-gray-800">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
            filter === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'
          }`}
        >
          全部
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
              filter === cat ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expense list grouped by date */}
      <div className="px-4 py-3">
        {expenses.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Store size={48} className="mx-auto mb-4 opacity-30" />
            <p>{t('expenses.empty')}</p>
            <p className="text-sm mt-1">{t('expenses.emptyHint')}</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={12} className="text-gray-500" />
                <span className="text-xs text-gray-500 font-medium">{date}</span>
                <span className="text-xs text-gray-600">
                  {formatAmount(
                    items.reduce((a, e) => a + e.amount, 0),
                    items[0].currency
                  )}
                </span>
              </div>
              <div className="space-y-2">
                {items.map(exp => (
                  <div key={exp.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{exp.merchantName}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Tag size={10} /> {exp.category}</span>
                          {exp.payer && <span className="flex items-center gap-1"><User size={10} /> {exp.payer}</span>}
                          {exp.isTaxFree && <span className="text-green-500">免稅</span>}
                        </div>
                        {exp.items && exp.items.length > 0 && (
                          <p className="text-xs text-gray-600 mt-1">
                            {exp.items.slice(0, 3).map(i => i.translatedName).join('、')}
                            {exp.items.length > 3 && `...+${exp.items.length - 3}`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-orange-400">{formatAmount(exp.amount, exp.currency)}</span>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-1.5 rounded-full hover:bg-gray-800 text-gray-600 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ExpenseBook;
