import { useState, useEffect, lazy, Suspense } from 'react';
import { ArrowLeft, Search, TrendingUp, ChevronRight, Map, Camera } from 'lucide-react';
import { getPopularProducts, searchProducts, type ProductRanking } from '../services/supabase';
import PriceCompare from './PriceCompare';

const StoreMap = lazy(() => import('./StoreMap'));
const ShelfUpload = lazy(() => import('./ShelfUpload'));

type ViewMode = 'list' | 'map' | 'upload';

interface DrugstoreInfoProps {
  onBack: () => void;
  userPlan?: string;
  apiKey?: string;
  targetLanguage?: string;
}

const DrugstoreInfo = ({ onBack, userPlan = 'free', apiKey = '', targetLanguage = 'Traditional Chinese' }: DrugstoreInfoProps) => {
  const [popular, setPopular] = useState<ProductRanking[]>([]);
  const [searchResults, setSearchResults] = useState<ProductRanking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ProductRanking | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    getPopularProducts(30).then(data => {
      setPopular(data);
      setLoading(false);
    });
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchProducts(searchQuery.trim());
    setSearchResults(results);
    setIsSearching(false);
  };

  // Show PriceCompare if product selected
  if (selectedProduct) {
    return (
      <PriceCompare
        janCode={selectedProduct.jan_code || undefined}
        productName={selectedProduct.product_name}
        translatedName={selectedProduct.translated_name}
        onBack={() => setSelectedProduct(null)}
      />
    );
  }

  const displayList = searchQuery.trim() && searchResults.length > 0 ? searchResults : popular;

  // 地圖模式
  if (viewMode === 'map') {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
        </div>
      }>
        <StoreMap onBack={() => setViewMode('list')} />
      </Suspense>
    );
  }

  // 上傳模式（導遊專用）
  if (viewMode === 'upload') {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
        </div>
      }>
        <ShelfUpload onBack={() => setViewMode('list')} apiKey={apiKey} targetLanguage={targetLanguage} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1"><ArrowLeft size={20} /></button>
            <h1 className="font-bold text-lg">💊 藥妝情報</h1>
          </div>
          <div className="flex items-center gap-2">
            {(userPlan === 'guide' || userPlan === 'supporter' || userPlan === 'pro') && apiKey && (
              <button
                onClick={() => setViewMode('upload')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-sm font-medium"
              >
                <Camera size={14} />
                上傳情報
              </button>
            )}
            <button
              onClick={() => setViewMode('map')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full text-sm font-medium"
            >
              <Map size={14} />
              地圖
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4 pb-24">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="搜尋商品名稱（中文或日文）"
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-orange-400 focus:outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-4 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm disabled:opacity-50"
          >
            {isSearching ? '...' : '搜尋'}
          </button>
        </div>

        {/* Search results or rankings */}
        {searchQuery.trim() && searchResults.length > 0 && (
          <h3 className="text-sm font-bold text-gray-500">
            🔍 搜尋結果（{searchResults.length} 個商品）
          </h3>
        )}

        {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-500">找不到「{searchQuery}」的比價資料</p>
            <p className="text-xs text-gray-400 mt-1">掃描更多收據來累積資料！</p>
          </div>
        )}

        {!searchQuery.trim() && (
          <h3 className="text-sm font-bold text-gray-500 flex items-center gap-1.5">
            <TrendingUp size={14} /> 熱門商品排行
          </h3>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
            載入中...
          </div>
        ) : displayList.length === 0 && !searchQuery.trim() ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-4">📊</p>
            <p className="text-gray-500 font-medium">還沒有比價資料</p>
            <p className="text-sm text-gray-400 mt-2">掃描藥妝收據，自動累積比價情報！</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayList.map((product, i) => (
              <button
                key={product.jan_code || product.normalized_key}
                onClick={() => setSelectedProduct(product)}
                className="w-full bg-white rounded-xl p-4 border border-gray-100 hover:border-orange-200 transition-colors text-left flex items-center gap-3"
              >
                {/* Rank badge */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                  i === 0 ? 'bg-yellow-400 text-white' :
                  i === 1 ? 'bg-gray-300 text-white' :
                  i === 2 ? 'bg-amber-600 text-white' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {i + 1}
                </div>

                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900 truncate">{product.translated_name}</p>
                  <p className="text-xs text-gray-400 truncate">{product.product_name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-medium text-green-600">
                      ¥{product.min_price.toLocaleString()}
                      {product.min_price !== product.max_price && (
                        <span className="text-gray-400"> ~ ¥{product.max_price.toLocaleString()}</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-300">{product.report_count} 筆</span>
                  </div>
                </div>

                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DrugstoreInfo;
