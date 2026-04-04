import { useState, useEffect } from 'react';
import { ArrowLeft, Camera, X, Trash2, Upload, Check, MapPin, Store, Navigation } from 'lucide-react';
import { analyzeShelfImage, type ShelfAnalysisResult } from '../services/gemini';
import { submitPriceReports, type PriceReportInput, getNearbyStores, type StoreWithProducts } from '../services/supabase';

interface ShelfUploadProps {
  onBack: () => void;
  apiKey: string;
  targetLanguage: string;
}

const ShelfUpload = ({ onBack, apiKey, targetLanguage }: ShelfUploadProps) => {
  const [images, setImages] = useState<string[]>([]);
  const [storeName, setStoreName] = useState('');
  const [storeBranch, setStoreBranch] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ShelfAnalysisResult | null>(null);
  const [removedIdx, setRemovedIdx] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyStores, setNearbyStores] = useState<StoreWithProducts[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);

  // 開啟時自動搜尋附近店家
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoords(coords);
        setLoadingStores(true);
        const stores = await getNearbyStores(coords.lat, coords.lng, 1);
        setNearbyStores(stores);
        setLoadingStores(false);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const readFile = (file: File): Promise<string> => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    const results = await Promise.all(Array.from(files).map(readFile));
    setImages(prev => [...prev, ...results].slice(0, 4));
    e.target.value = '';
  };

  const handleAnalyze = async () => {
    if (images.length === 0 || !apiKey) return;
    setIsAnalyzing(true);
    setError('');
    setResult(null);
    setRemovedIdx(new Set());
    try {
      const imageData = images.map(img => ({
        base64: img.split(',')[1],
        mimeType: 'image/jpeg',
      }));
      const res = await analyzeShelfImage(imageData, targetLanguage, apiKey);
      setResult(res);
      if (res.storeName && !storeName) setStoreName(res.storeName);
    } catch (err: any) {
      setError(err.message || '分析失敗');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpload = async () => {
    if (!result) return;
    setIsUploading(true);
    setError('');
    try {
      const items: PriceReportInput[] = result.items
        .filter((_, i) => !removedIdx.has(i))
        .map(item => ({
          productName: item.productName,
          translatedName: item.translatedName,
          price: item.price,
          currency: 'JPY',
          storeName: storeName || result.storeName || '',
          storeBranch: storeBranch || undefined,
          category: item.category,
          isTaxFree: false,
          storeLat: gpsCoords?.lat,
          storeLng: gpsCoords?.lng,
        }));

      await submitPriceReports(items, storeName, storeBranch, gpsCoords?.lat, gpsCoords?.lng);
      setSuccess(`上傳成功！共 ${items.length} 個商品`);
      setTimeout(() => onBack(), 2000);
    } catch (err: any) {
      setError(err.message || '上傳失敗');
    } finally {
      setIsUploading(false);
    }
  };

  const activeItems = result?.items.filter((_, i) => !removedIdx.has(i)) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-lg">📸 上傳商品情報</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Error / Success */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
        )}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm flex items-center gap-2">
            <Check size={16} /> {success}
          </div>
        )}

        {/* Store info */}
        <div className="bg-white rounded-xl p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Store size={14} /> 店家名稱
          </label>

          {/* Nearby stores */}
          {loadingStores && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Navigation size={10} className="animate-spin" /> 搜尋附近店家...
            </p>
          )}
          {nearbyStores.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {nearbyStores.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setStoreName(s.name); if (s.branch) setStoreBranch(s.branch); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    storeName === s.name ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-300'
                  }`}
                >
                  {s.name}{s.branch ? ` ${s.branch}` : ''}
                </button>
              ))}
            </div>
          )}

          <input
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            placeholder={nearbyStores.length > 0 ? '點選上方或手動輸入' : 'AI 會自動偵測，或手動輸入'}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-orange-500 focus:outline-none"
          />
          <input
            value={storeBranch}
            onChange={e => setStoreBranch(e.target.value)}
            placeholder="分店名（選填）"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-orange-500 focus:outline-none"
          />
          {gpsCoords ? (
            <p className="text-[10px] text-green-500 flex items-center gap-1">
              <MapPin size={10} /> GPS 已定位
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                navigator.geolocation?.getCurrentPosition(
                  (pos) => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                  () => {},
                  { enableHighAccuracy: true, timeout: 5000 }
                );
              }}
              className="text-[10px] text-orange-500 flex items-center gap-1"
            >
              <MapPin size={10} /> 標記目前位置（如果人在店裡）
            </button>
          )}
        </div>

        {/* Image selection */}
        {!result && (
          <div className="bg-white rounded-xl p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">拍攝貨架照片（最多 4 張）</p>
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-orange-200">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </div>
              ))}
              {images.length < 4 && (
                <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-orange-300">
                  <Camera size={20} />
                  <span className="text-[10px] mt-1">加照片</span>
                  <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                </label>
              )}
            </div>

            {images.length > 0 && (
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full mt-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    AI 分析中...
                  </>
                ) : (
                  <>分析商品（{images.length} 張照片）</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-white rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">
                辨識到 {activeItems.length} 個商品
                {result.shelfCategory && <span className="text-gray-400"> · {result.shelfCategory}</span>}
              </p>
              <button
                onClick={() => { setResult(null); setImages([]); }}
                className="text-xs text-orange-500"
              >
                重新拍攝
              </button>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {result.items.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                    removedIdx.has(i) ? 'bg-gray-50 border-gray-100 opacity-40' : 'border-gray-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.translatedName}</p>
                    <p className="text-xs text-gray-400 truncate">{item.productName}</p>
                  </div>
                  <span className="text-sm font-bold text-orange-500 shrink-0">¥{item.price}</span>
                  <button
                    onClick={() => {
                      setRemovedIdx(prev => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i); else next.add(i);
                        return next;
                      });
                    }}
                    className="p-1.5 rounded-full hover:bg-gray-100"
                  >
                    <Trash2 size={14} className={removedIdx.has(i) ? 'text-gray-300' : 'text-red-400'} />
                  </button>
                </div>
              ))}
            </div>

            {activeItems.length > 0 && (
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full mt-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    上傳中...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    確認上傳（{activeItems.length} 個商品）
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShelfUpload;
