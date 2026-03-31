import { useState } from 'react';
import { Store, Calendar, MapPin, ShoppingBag, CheckCircle, Bookmark, Globe, Rows3, Columns2, List } from 'lucide-react';
import type { ReceiptAnalysisResult, ReceiptItem, Expense } from '../types';
import { saveExpense } from '../services/storage';

interface ReceiptViewProps {
  data: ReceiptAnalysisResult;
  imageSrc?: string;
  layout: 'stack' | 'side' | 'list';
  onLayoutChange: (layout: 'stack' | 'side' | 'list') => void;
  highlightIdx: number | null;
  onHighlight: (idx: number) => void;
}

const CATEGORIES = ['購物', '餐飲', '交通', '住宿', '其他'];

const normalize = (box: number[]): number[] => {
  if (box.some(v => v > 1)) return box.map(v => v / 1000);
  return box;
};

const hasBox = (item: ReceiptItem) => {
  const b = item.boundingBox;
  if (!b || b.length < 4) return false;
  const n = normalize(b);
  return (n[2] - n[0]) > 0.005 && (n[3] - n[1]) > 0.005;
};

const ReceiptView = ({ data, imageSrc, layout, onLayoutChange, highlightIdx, onHighlight }: ReceiptViewProps) => {
  const [saved, setSaved] = useState(false);
  const [category, setCategory] = useState('購物');
  const [payer, setPayer] = useState('');

  const formatPrice = (price: string | number, curr: string) => {
    const clean = String(price).replace(/[^0-9.]/g, '').trim();
    if (!clean) return '';
    const num = parseFloat(clean);
    const formatted = num.toLocaleString();
    return curr === '¥' || curr === '$' || curr === '€' ? `${curr}${formatted}` : `${formatted}${curr}`;
  };

  const totalQty = data.totalQuantity || data.items.reduce((acc, item) => {
    return acc + (parseInt(item.quantity?.replace(/[^0-9]/g, '') || '1') || 1);
  }, 0);

  const handleSaveExpense = async () => {
    const amount = parseFloat(data.totalAmount.replace(/[^0-9.]/g, ''));
    if (isNaN(amount) || amount <= 0) return;
    const expense: Expense = {
      id: crypto.randomUUID(), timestamp: Date.now(),
      merchantName: data.merchantName, amount, currency: data.currency,
      category, payer: payer || '自己', items: data.items, isTaxFree: data.isTaxFree,
    };
    await saveExpense(expense);
    setSaved(true);
  };

  // Photo with numbered markers
  const photoWithMarkers = imageSrc && (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <img src={imageSrc} alt="Receipt" className="w-full block" />
      {data.items.map((item, idx) => {
        const active = highlightIdx === idx;
        if (hasBox(item)) {
          const [ymin, xmin, ymax, xmax] = normalize(item.boundingBox!);
          return (
            <div
              key={idx}
              onClick={() => onHighlight(idx)}
              className={`absolute cursor-pointer ${active ? 'z-10' : ''}`}
              style={{
                top: `${ymin * 100}%`, left: `${xmin * 100}%`,
                width: `${(xmax - xmin) * 100}%`, height: `${(ymax - ymin) * 100}%`,
              }}
            >
              <span className={`absolute -top-2.5 -left-2.5 rounded-full flex items-center justify-center font-black transition-all duration-300 ${
                active
                  ? 'w-8 h-8 text-sm bg-orange-500 text-white shadow-[0_0_0_2px_white,0_0_10px_rgba(249,115,22,0.7)] animate-bounce'
                  : 'w-5 h-5 text-[9px] bg-white/60 text-gray-900 border-2 border-gray-900'
              }`}>
                {idx + 1}
              </span>
            </div>
          );
        }
        return null;
      })}
    </div>
  );

  // Receipt translation content
  const receiptContent = (
    <div className="bg-white p-3 shadow-lg rounded-sm border-t-[6px] border-gray-800 relative overflow-hidden">
      {/* Jagged bottom */}
      <div className="absolute -bottom-1 left-0 w-full h-3 bg-white" style={{
        maskImage: 'linear-gradient(45deg, transparent 50%, black 50%), linear-gradient(-45deg, transparent 50%, black 50%)',
        maskSize: '16px 16px', maskRepeat: 'repeat-x',
        WebkitMaskImage: 'linear-gradient(45deg, transparent 50%, black 50%), linear-gradient(-45deg, transparent 50%, black 50%)',
        WebkitMaskSize: '16px 16px', WebkitMaskRepeat: 'repeat-x',
      }} />

      {data.isTaxFree && (
        <div className="absolute top-8 right-3 rotate-12 border-[3px] border-green-500 text-green-600 rounded-lg px-2 py-0.5 font-black text-xs uppercase tracking-widest opacity-80">
          Tax Free
        </div>
      )}

      {/* Header */}
      <div className="text-center border-b-2 border-dashed border-gray-300 pb-2 mb-2">
        <Store size={16} className="mx-auto text-gray-400 mb-0.5" />
        <h2 className="text-base font-bold text-gray-900">{data.merchantName}</h2>
        <button
          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.merchantName)}`, '_blank')}
          className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:underline mt-0.5"
        >
          <MapPin size={8} /> 搜尋店家
        </button>
        <div className="flex items-center justify-center gap-1 text-gray-400 text-[10px] mt-0.5">
          <Calendar size={8} /> {data.date || '—'}
        </div>
      </div>

      {/* Items */}
      <div className="text-sm divide-y divide-gray-100">
        {data.items.map((item, idx) => {
          const qty = parseInt(item.quantity?.replace(/[^0-9]/g, '') || '1') || 1;
          const lineTotal = parseFloat(item.price?.replace(/[^0-9.]/g, '') || '0');
          const unitPrice = qty > 0 ? Math.round(lineTotal / qty) : lineTotal;
          const active = highlightIdx === idx;

          return (
            <div
              key={idx}
              id={`receipt-item-${idx}`}
              onClick={() => onHighlight(idx)}
              className={`py-1.5 cursor-pointer transition-colors ${active ? 'bg-orange-50' : ''}`}
            >
              <div className="flex items-start gap-1.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-1">
                    <span className="font-bold text-gray-900 text-sm">{item.translatedName}</span>
                    <span className="font-bold text-gray-900 shrink-0 text-sm">{formatPrice(item.price, data.currency)}</span>
                  </div>
                  <div className="text-xs text-gray-400">{item.originalName}</div>
                  <div className="text-xs font-medium text-gray-600">{formatPrice(unitPrice, data.currency)} × {qty}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="border-t-2 border-dashed border-gray-300 mt-3 pt-2 space-y-1 text-sm">
        <div className="flex justify-between text-gray-500 text-xs">
          <span className="flex items-center gap-1"><ShoppingBag size={10} /> 總數量</span>
          <span className="font-bold">{totalQty} 件</span>
        </div>
        {data.tax && (
          <div className="flex justify-between text-gray-500 text-xs">
            <span>稅金</span><span>{formatPrice(data.tax, data.currency)}</span>
          </div>
        )}
        {data.serviceCharge && (
          <div className="flex justify-between text-gray-500 text-xs">
            <span>服務費</span><span>{formatPrice(data.serviceCharge, data.currency)}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-500 text-xs">
          <span>免稅</span>
          {data.isTaxFree ? <span className="flex items-center gap-1 text-green-600 font-bold"><CheckCircle size={10} /> 免稅</span> : <span>一般</span>}
        </div>
        <div className="flex justify-between items-end pt-2 border-t-2 border-gray-800">
          <span className="font-bold text-gray-900">總計</span>
          <span className="text-xl font-black text-gray-900">{formatPrice(data.totalAmount, data.currency)}</span>
        </div>
      </div>

      {/* Expense saving */}
      <div className="mt-4 space-y-2">
        {!saved && (
          <>
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${category === cat ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'}`}
                >{cat}</button>
              ))}
            </div>
            <input value={payer} onChange={e => setPayer(e.target.value)} placeholder="付款人（選填）"
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:border-orange-500 focus:outline-none" />
          </>
        )}
        <button onClick={handleSaveExpense} disabled={saved}
          className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${
            saved ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
          }`}
        >
          {saved ? <><CheckCircle size={14} /> 已加入記帳簿</> : <><Bookmark size={14} /> 加入記帳簿</>}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Layout toggle */}
      {imageSrc && (
        <div className="flex justify-end mb-2 gap-1">
          <button onClick={() => onLayoutChange('stack')}
            className={`p-1.5 rounded-lg ${layout === 'stack' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}
            title="上下對照"><Rows3 size={16} /></button>
          <button onClick={() => onLayoutChange('side')}
            className={`p-1.5 rounded-lg ${layout === 'side' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}
            title="左右對照"><Columns2 size={16} /></button>
          <button onClick={() => onLayoutChange('list')}
            className={`p-1.5 rounded-lg ${layout === 'list' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}
            title="純翻譯"><List size={16} /></button>
        </div>
      )}

      {layout === 'side' && imageSrc ? (
        /* Side by side: photo left, receipt right */
        <div className="flex gap-2 max-w-4xl">
          <div className="w-[40%] shrink-0">
            <div className="sticky top-[60px]">
              {photoWithMarkers}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            {receiptContent}
          </div>
        </div>
      ) : (
        /* Stack or List mode — both show receipt content, stack has sticky photo in header */
        receiptContent
      )}
    </div>
  );
};

export default ReceiptView;
