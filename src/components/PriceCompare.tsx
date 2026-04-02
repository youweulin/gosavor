import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingDown, Store, Calendar, Tag, Search } from 'lucide-react';
import { comparePrices, getProductSummary, searchProducts, type PriceCompareResult, type ProductRanking } from '../services/supabase';

interface PriceCompareProps {
  janCode?: string;
  productName?: string;
  translatedName?: string;
  onBack: () => void;
}

const PriceCompare = ({ janCode, productName, translatedName, onBack }: PriceCompareProps) => {
  const [stores, setStores] = useState<PriceCompareResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    minPrice: number; maxPrice: number; avgPrice: number; reportCount: number;
    translatedName: string; productName: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [janCode, productName]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (janCode) {
        const result = await getProductSummary(janCode);
        if (result) {
          setSummary(result);
          setStores(result.stores);
        }
      } else {
        const results = await comparePrices(undefined, productName);
        setStores(results);
        if (results.length > 0) {
          const prices = results.map(r => r.price);
          setSummary({
            minPrice: Math.min(...prices),
            maxPrice: Math.max(...prices),
            avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
            reportCount: results.length,
            translatedName: translatedName || productName || '',
            productName: productName || '',
          });
        }
      }
    } catch (err) {
      console.error('[GoSavor] Compare error:', err);
    } finally {
      setLoading(false);
    }
  };

  const savings = summary ? summary.maxPrice - summary.minPrice : 0;
  const savingsPercent = summary && summary.maxPrice > 0
    ? Math.round((savings / summary.maxPrice) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="font-bold text-base">💊 比價查詢</h1>
            {janCode && <p className="text-xs text-gray-400">JAN: {janCode}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4 pb-24">
        {loading ? (
          <div className="text-center py-12 text-gray-400">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
            查詢中...
          </div>
        ) : !summary || stores.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-gray-500 font-medium">目前沒有此商品的比價資料</p>
            <p className="text-sm text-gray-400 mt-2">掃描更多收據來累積比價資訊！</p>
          </div>
        ) : (
          <>
            {/* Product info */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="text-xl font-black text-gray-900">{summary.translatedName}</h2>
              <p className="text-sm text-gray-400 mt-1">{summary.productName}</p>

              {/* Price range */}
              <div className="flex items-end gap-4 mt-4">
                <div>
                  <p className="text-xs text-gray-400">最低價</p>
                  <p className="text-2xl font-black text-green-600">¥{summary.minPrice.toLocaleString()}</p>
                </div>
                <div className="text-gray-300">~</div>
                <div>
                  <p className="text-xs text-gray-400">最高價</p>
                  <p className="text-xl font-bold text-gray-400">¥{summary.maxPrice.toLocaleString()}</p>
                </div>
              </div>

              {/* Savings badge */}
              {savings > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <TrendingDown size={16} className="text-green-600" />
                  <span className="text-sm font-bold text-green-600">
                    最多省 ¥{savings.toLocaleString()}（{savingsPercent}%）
                  </span>
                </div>
              )}

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">📊 {summary.reportCount} 筆回報</span>
                <span className="text-xs text-gray-400">💰 平均 ¥{summary.avgPrice.toLocaleString()}</span>
              </div>
            </div>

            {/* Store list */}
            <h3 className="text-sm font-bold text-gray-500 flex items-center gap-1.5">
              <Store size={14} /> 各店價格
            </h3>

            <div className="space-y-2">
              {stores.map((store, i) => (
                <div
                  key={i}
                  className={`bg-white rounded-xl p-4 border ${
                    i === 0 ? 'border-green-200 ring-1 ring-green-100' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {i === 0 ? (
                        <span className="w-7 h-7 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center">🏆</span>
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      )}
                      <div>
                        <p className="font-bold text-sm text-gray-900">{store.store_name || '不明店家'}</p>
                        {store.store_branch && (
                          <p className="text-xs text-gray-400">{store.store_branch}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-lg ${i === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                        ¥{store.price.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-1 justify-end">
                        {store.is_tax_free && (
                          <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium">免稅</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-300">
                    <Calendar size={10} />
                    {new Date(store.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PriceCompare;
