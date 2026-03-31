import { useState } from 'react';
import { Store, Calendar, MapPin, ShoppingBag, CheckCircle, Bookmark, Globe } from 'lucide-react';
import type { ReceiptAnalysisResult, Expense } from '../types';
import { saveExpense } from '../services/storage';

interface ReceiptViewProps {
  data: ReceiptAnalysisResult;
}

const CATEGORIES = ['購物', '餐飲', '交通', '住宿', '其他'];

const ReceiptView = ({ data }: ReceiptViewProps) => {
  const [saved, setSaved] = useState(false);
  const [category, setCategory] = useState('購物');
  const [payer, setPayer] = useState('');

  const formatPrice = (price: string, curr: string) => {
    if (!price) return '';
    const clean = String(price).replace(new RegExp(`\\${curr}`, 'g'), '').trim();
    return curr === '¥' || curr === '$' || curr === '€' ? `${curr}${clean}` : `${clean}${curr}`;
  };

  const totalQty = data.totalQuantity || data.items.reduce((acc, item) => {
    return acc + (parseInt(item.quantity?.replace(/[^0-9]/g, '') || '1') || 1);
  }, 0);

  const handleSaveExpense = async () => {
    const amount = parseFloat(data.totalAmount.replace(/[^0-9.]/g, ''));
    if (isNaN(amount) || amount <= 0) return;

    const expense: Expense = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      merchantName: data.merchantName,
      amount,
      currency: data.currency,
      category,
      payer: payer || '自己',
      items: data.items,
      isTaxFree: data.isTaxFree,
    };
    await saveExpense(expense);
    setSaved(true);
  };

  const handleTranslate = (text: string) => {
    window.open(`https://translate.google.com/?sl=auto&tl=zh-TW&text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Receipt paper style */}
      <div className="bg-white p-5 shadow-lg rounded-sm border-t-[6px] border-gray-800 relative overflow-hidden">
        {/* Jagged bottom edge */}
        <div className="absolute -bottom-1 left-0 w-full h-3 bg-white" style={{
          maskImage: 'linear-gradient(45deg, transparent 50%, black 50%), linear-gradient(-45deg, transparent 50%, black 50%)',
          maskSize: '16px 16px',
          maskRepeat: 'repeat-x',
          WebkitMaskImage: 'linear-gradient(45deg, transparent 50%, black 50%), linear-gradient(-45deg, transparent 50%, black 50%)',
          WebkitMaskSize: '16px 16px',
          WebkitMaskRepeat: 'repeat-x',
        }} />

        {/* Tax Free stamp */}
        {data.isTaxFree && (
          <div className="absolute top-10 right-4 rotate-12 border-[3px] border-green-500 text-green-600 rounded-lg px-2 py-0.5 font-black text-sm uppercase tracking-widest opacity-80">
            Tax Free
          </div>
        )}

        {/* Header */}
        <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
          <Store size={20} className="mx-auto text-gray-400 mb-1" />
          <h2 className="text-xl font-bold text-gray-900 tracking-wider">{data.merchantName}</h2>
          <button
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.merchantName)}`, '_blank')}
            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1"
          >
            <MapPin size={10} /> 搜尋店家
          </button>
          <div className="flex items-center justify-center gap-1 text-gray-400 text-xs mt-1">
            <Calendar size={10} /> {data.date || '—'}
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3 font-mono text-sm">
          <div className="flex items-center gap-2 text-gray-400 text-[10px] uppercase tracking-wider">
            <span className="w-5 text-center">數量</span>
            <span className="flex-1">品項</span>
            <span>價格</span>
          </div>

          {data.items.map((item, idx) => (
            <div key={idx} className="flex items-start justify-between gap-2 group">
              <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 border border-gray-200 text-[10px] font-bold flex items-center justify-center text-gray-500">
                {item.quantity?.replace(/[^0-9]/g, '') || '1'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 text-sm">{item.translatedName}</span>
                  <button
                    onClick={() => handleTranslate(item.originalName)}
                    className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Globe size={10} />
                  </button>
                </div>
                <span className="text-gray-400 text-xs truncate block">{item.originalName}</span>
              </div>
              <span className="font-bold text-gray-800 shrink-0">{formatPrice(item.price, data.currency)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t-2 border-dashed border-gray-300 mt-4 pt-3 space-y-1.5 font-mono text-sm">
          <div className="flex justify-between text-gray-500">
            <span className="flex items-center gap-1"><ShoppingBag size={12} /> 總數量</span>
            <span className="font-bold">{totalQty}</span>
          </div>
          {data.tax && (
            <div className="flex justify-between text-gray-500">
              <span>稅金</span>
              <span>{formatPrice(data.tax, data.currency)}</span>
            </div>
          )}
          {data.serviceCharge && (
            <div className="flex justify-between text-gray-500">
              <span>服務費</span>
              <span>{formatPrice(data.serviceCharge, data.currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-500">
            <span>免稅</span>
            {data.isTaxFree ? (
              <span className="flex items-center gap-1 text-green-600 font-bold"><CheckCircle size={12} /> 免稅</span>
            ) : (
              <span>一般</span>
            )}
          </div>
          <div className="flex justify-between items-end pt-3 border-t-2 border-gray-800">
            <span className="text-lg font-bold text-gray-900">總計</span>
            <span className="text-2xl font-black text-gray-900">{formatPrice(data.totalAmount, data.currency)}</span>
          </div>
        </div>

        {/* Save to expense */}
        <div className="mt-6 space-y-3">
          {!saved && (
            <>
              <div className="flex gap-2">
                <div className="flex-1">
                  <p className="text-[10px] text-gray-400 mb-1">分類</p>
                  <div className="flex gap-1 flex-wrap">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          category === cat ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <input
                value={payer}
                onChange={e => setPayer(e.target.value)}
                placeholder="付款人（選填）"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-orange-500 focus:outline-none"
              />
            </>
          )}

          <button
            onClick={handleSaveExpense}
            disabled={saved}
            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              saved
                ? 'bg-green-50 text-green-600 border border-green-200'
                : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
            }`}
          >
            {saved ? (
              <><CheckCircle size={16} /> 已加入記帳簿</>
            ) : (
              <><Bookmark size={16} /> 加入記帳簿</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptView;
