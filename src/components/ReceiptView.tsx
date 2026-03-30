import { Store, Calendar, MapPin, ShoppingBag, CheckCircle } from 'lucide-react';
import type { ReceiptAnalysisResult } from '../types';

interface ReceiptViewProps {
  data: ReceiptAnalysisResult;
}

const ReceiptView = ({ data }: ReceiptViewProps) => {
  const formatPrice = (price: string, curr: string) => {
    if (!price) return '';
    const clean = String(price).replace(new RegExp(`\\${curr}`, 'g'), '').trim();
    return curr === '¥' || curr === '$' || curr === '€' ? `${curr}${clean}` : `${clean}${curr}`;
  };

  const totalQty = data.totalQuantity || data.items.reduce((acc, item) => {
    return acc + (parseInt(item.quantity?.replace(/[^0-9]/g, '') || '1') || 1);
  }, 0);

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white p-5 shadow-lg rounded-xl border border-gray-200 relative">
        {/* Tax Free badge */}
        {data.isTaxFree && (
          <div className="absolute top-4 right-4 border-2 border-green-500 text-green-600 rounded-lg px-2 py-0.5 text-xs font-black rotate-6">
            TAX FREE
          </div>
        )}

        {/* Header */}
        <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
          <Store size={20} className="mx-auto text-gray-400 mb-1" />
          <h2 className="text-lg font-bold text-gray-900">{data.merchantName}</h2>
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
        <div className="space-y-2 text-sm">
          {data.items.map((item, idx) => (
            <div key={idx} className="flex items-start justify-between gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 text-[10px] font-bold flex items-center justify-center text-gray-500">
                {item.quantity?.replace(/[^0-9]/g, '') || '1'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{item.translatedName}</p>
                <p className="text-xs text-gray-400 truncate">{item.originalName}</p>
              </div>
              <span className="font-bold text-gray-900 shrink-0">{formatPrice(item.price, data.currency)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-dashed border-gray-300 mt-4 pt-3 space-y-1 text-sm">
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
            <span className="flex items-center gap-1">
              {data.isTaxFree ? <><CheckCircle size={12} className="text-green-500" /> 免稅</> : '一般'}
            </span>
          </div>
          <div className="flex justify-between items-end pt-2 border-t border-gray-800">
            <span className="font-bold text-gray-900">總計</span>
            <span className="text-2xl font-black text-gray-900">{formatPrice(data.totalAmount, data.currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptView;
