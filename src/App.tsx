import { useState, useCallback } from 'react';
import { Settings as SettingsIcon, History, User, UtensilsCrossed, ShoppingCart, BookOpen } from 'lucide-react';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';
import { analyzeMenuImage, analyzeReceiptImage, analyzeGeneralImage } from './services/gemini';
import { saveOrder, saveScan } from './services/storage';
import { TARGET_LANGUAGES } from './types';
import type { MenuAnalysisResult, ReceiptAnalysisResult, GeneralAnalysisResult, OrderItem, SavedOrder, SavedScan, SplitInfo, ScanMode } from './types';

import CameraCapture from './components/CameraCapture';
import MenuResults from './components/MenuResults';
import Checkout from './components/Checkout';
import OrderHistory from './components/OrderHistory';
import Settings from './components/Settings';
import AuthModal from './components/AuthModal';
import CurrencyBar from './components/CurrencyBar';
import InlineImageMap from './components/InlineImageMap';
import ScanHistory from './components/ScanHistory';
import ReceiptView from './components/ReceiptView';
import GeneralView from './components/GeneralView';
import ExpenseBook from './components/ExpenseBook';

type Page = 'home' | 'history' | 'settings' | 'expenses';

function App() {
  const { settings, updateSettings, resetSettings, hasApiKey } = useSettings();
  const { user, userData, login, register, logout, isRentalActive, isLifetime } = useAuth();

  const [page, setPage] = useState<Page>('home');
  const [images, setImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('menu');
  const [menuResult, setMenuResult] = useState<MenuAnalysisResult | null>(null);
  const [receiptResult, setReceiptResult] = useState<ReceiptAnalysisResult | null>(null);
  const [generalResult, setGeneralResult] = useState<GeneralAnalysisResult | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [receiptLayout, setReceiptLayout] = useState<'stack' | 'side' | 'list'>('stack');
  const [error, setError] = useState('');

  const getApiKey = useCallback((): string | null => {
    if (settings.geminiApiKey) return settings.geminiApiKey;
    if (isRentalActive || isLifetime) {
      return import.meta.env.VITE_GEMINI_API_KEY || null;
    }
    return null;
  }, [settings.geminiApiKey, isRentalActive, isLifetime]);

  const targetLangLabel = TARGET_LANGUAGES.find(l => l.code === settings.targetLanguage)?.label || 'English';

  const handleAnalyze = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError('請先設定 Gemini API Key，或登入使用租用版。');
      return;
    }
    setIsAnalyzing(true);
    setError('');
    try {
      const imageData = images.map(img => ({
        base64: img.split(',')[1],
        mimeType: 'image/jpeg',
      }));

      if (scanMode === 'menu') {
        const result = await analyzeMenuImage(imageData, targetLangLabel, apiKey, settings.allergens);
        setMenuResult(result);
        setQuantities({});
        saveScan({
          id: crypto.randomUUID(), timestamp: Date.now(), scanMode: 'menu',
          restaurantName: result.restaurantName || 'Menu',
          currency: result.currency, items: result.items, images,
        });
      } else if (scanMode === 'receipt') {
        const result = await analyzeReceiptImage(imageData, targetLangLabel, apiKey);
        setReceiptResult(result);
        saveScan({
          id: crypto.randomUUID(), timestamp: Date.now(), scanMode: 'receipt',
          restaurantName: result.merchantName || 'Receipt',
          currency: result.currency, items: [], images,
          receiptData: result,
        });
      } else {
        const result = await analyzeGeneralImage(imageData, targetLangLabel, apiKey);
        setGeneralResult(result);
        saveScan({
          id: crypto.randomUUID(), timestamp: Date.now(), scanMode: 'general',
          restaurantName: result.locationGuess || 'Translation',
          currency: '', items: [], images,
          generalData: result,
        });
      }
    } catch (err) {
      console.error(err);
      setError('分析失敗，請確認 API Key 是否正確或重試。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateQuantity = (index: number, delta: number) => {
    setQuantities(prev => {
      const next = Math.max(0, (prev[index] || 0) + delta);
      return { ...prev, [index]: next };
    });
  };

  const totalOrderQty = Object.values(quantities).reduce((a, b) => a + b, 0);

  const handleConfirmOrder = (orderedItems: OrderItem[], total: number, split?: SplitInfo) => {
    const order: SavedOrder = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      restaurantName: menuResult?.restaurantName || 'Restaurant',
      currency: menuResult?.currency || '¥',
      items: orderedItems,
      totalAmount: total,
      splitInfo: split,
    };
    saveOrder(order);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          order.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          saveOrder(order);
        },
        () => {},
        { timeout: 3000 }
      );
    }
  };

  // Go back to home / camera
  const handleGoHome = () => {
    setImages([]);
    setMenuResult(null);
    setReceiptResult(null);
    setGeneralResult(null);
    setQuantities({});
    setHighlightIndex(null);
    setActiveCategory(null);
    setActiveImageIdx(0);
    setError('');
  };

  // Load a saved scan — restore correct mode and data
  const handleLoadScan = (scan: SavedScan) => {
    handleGoHome(); // reset everything first
    setImages(scan.images);
    const mode = scan.scanMode || 'menu';
    setScanMode(mode);

    if (mode === 'menu' && scan.items.length > 0) {
      setMenuResult({
        currency: scan.currency,
        restaurantName: scan.restaurantName,
        items: scan.items,
      });
    } else if (mode === 'receipt' && scan.receiptData) {
      setReceiptResult(scan.receiptData);
    } else if (mode === 'general' && scan.generalData) {
      setGeneralResult(scan.generalData);
    }
  };

  if (page === 'history') return <OrderHistory onBack={() => setPage('home')} />;
  if (page === 'expenses') return <ExpenseBook onBack={() => setPage('home')} />;
  if (page === 'settings') {
    return (
      <Settings
        settings={settings}
        onUpdate={updateSettings}
        onReset={resetSettings}
        onBack={() => setPage('home')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button onClick={handleGoHome} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <UtensilsCrossed size={18} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">GoSavor</span>
          </button>
          <div className="flex items-center gap-1">
            {user ? (
              <button
                onClick={logout}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                {userData?.plan === 'lifetime' ? 'PRO' : userData?.plan === 'rental' ? 'RENTAL' : 'FREE'} &middot; Logout
              </button>
            ) : (
              <button onClick={() => setShowAuth(true)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
                <User size={18} />
              </button>
            )}
            <button onClick={() => setPage('expenses')} className="p-2 rounded-full hover:bg-gray-100 text-gray-500" title="記帳簿">
              <BookOpen size={18} />
            </button>
            <button onClick={() => setPage('history')} className="p-2 rounded-full hover:bg-gray-100 text-gray-500" title="點餐紀錄">
              <History size={18} />
            </button>
            <button onClick={() => setPage('settings')} className="p-2 rounded-full hover:bg-gray-100 text-gray-500" title="設定">
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Sticky image — for menu (with markers) or receipt (with markers) or general (photo only) */}
      {receiptResult && images.length > 0 && receiptLayout === 'stack' ? (
        /* Only show sticky photo in stack mode */
        <div className="sticky top-[53px] z-20 bg-gray-50 border-b border-gray-200 shadow-sm overflow-y-auto max-h-[45vh]">
          <div className="max-w-md mx-auto px-2 py-1 flex justify-center">
            {/* inline-block so container matches image size exactly */}
            <div className="relative inline-block rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img src={images[0]} alt="Receipt" className="block max-h-[45vh] w-auto" />
              {receiptResult.items.map((item, idx) => {
                if (!item.boundingBox || item.boundingBox.length < 4) return null;
                const box = item.boundingBox.some(v => v > 1) ? item.boundingBox.map(v => v / 1000) : item.boundingBox;
                if ((box[2] - box[0]) < 0.005 || (box[3] - box[1]) < 0.005) return null;
                return (
                  <div key={idx} className="absolute" style={{
                    top: `${box[0] * 100}%`, left: `${box[1] * 100}%`,
                    width: `${(box[3] - box[1]) * 100}%`, height: `${(box[2] - box[0]) * 100}%`,
                  }}>
                    <span className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-white/60 text-gray-900 border-2 border-gray-900 text-[9px] font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : generalResult && images.length > 0 ? (
        <div className="sticky top-[53px] z-20 bg-gray-50 border-b border-gray-200 shadow-sm">
          <div className="max-w-md mx-auto px-2 py-1">
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img src={images[0]} alt="Photo" className="block mx-auto max-h-[40vh] w-auto" />
            </div>
          </div>
        </div>
      ) : menuResult && images.length > 0 ? (
        <div className="sticky top-[53px] z-20 bg-gray-50 border-b border-gray-200 shadow-sm">
          <div className="max-w-md mx-auto px-2 py-1">
            <InlineImageMap
              images={images}
              items={menuResult.items}
              highlightIndex={highlightIndex}
              activeCategory={activeCategory}
              activeImageIndex={activeImageIdx}
              onTapItem={(idx) => {
                setHighlightIndex(idx);
                const el = document.getElementById(`menu-item-${idx}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => setHighlightIndex(null), 2000);
              }}
              onImageChange={(imgIdx) => {
                setActiveImageIdx(imgIdx);
                // Scroll menu list to first item of that image
                if (menuResult) {
                  const firstItem = menuResult.items.findIndex(it => (it.imageIndex ?? 0) === imgIdx);
                  if (firstItem >= 0) {
                    const el = document.getElementById(`menu-item-${firstItem}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Main */}
      <main className="max-w-md mx-auto px-4 py-4 pb-24">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
            {!hasApiKey && (
              <button onClick={() => setPage('settings')} className="ml-2 underline font-medium">
                Go to Settings
              </button>
            )}
          </div>
        )}

        {/* No results yet — show camera */}
        {!menuResult && !receiptResult && !generalResult ? (
          <>
            <CameraCapture
              images={images}
              onImagesChange={setImages}
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              scanMode={scanMode}
              onScanModeChange={setScanMode}
            />
            {images.length === 0 && (
              <ScanHistory onLoadScan={handleLoadScan} />
            )}
          </>
        ) : menuResult ? (
          /* Menu results */
          <>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">{menuResult.restaurantName || 'Menu'}</h2>
                <p className="text-xs text-gray-400">{menuResult.items.length} dishes</p>
              </div>
              <button onClick={handleGoHome} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 font-medium">
                New Scan
              </button>
            </div>
            <MenuResults
              items={menuResult.items}
              currency={menuResult.currency}
              quantities={quantities}
              onUpdateQuantity={handleUpdateQuantity}
              userAllergens={settings.allergens}
              onLocate={(idx) => {
                const itemImageIdx = menuResult?.items[idx]?.imageIndex ?? 0;
                if (itemImageIdx !== activeImageIdx) setActiveImageIdx(itemImageIdx);
                setHighlightIndex(idx);
                setTimeout(() => setHighlightIndex(null), 2000);
              }}
              onCategoryChange={setActiveCategory}
            />
          </>
        ) : receiptResult ? (
          /* Receipt results */
          <>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">收據翻譯</h2>
              <button onClick={handleGoHome} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 font-medium">
                New Scan
              </button>
            </div>
            <ReceiptView data={receiptResult} imageSrc={images[0]} layout={receiptLayout} onLayoutChange={setReceiptLayout} />
          </>
        ) : generalResult ? (
          /* General/Sign/Fortune results */
          <>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">翻譯結果</h2>
              <button onClick={handleGoHome} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 font-medium">
                New Scan
              </button>
            </div>
            <GeneralView data={generalResult} />
          </>
        ) : null}
      </main>

      {/* Floating Checkout */}
      {menuResult && totalOrderQty > 0 && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-20">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-orange-200 flex items-center justify-center gap-3 transition-all"
            >
              <ShoppingCart size={22} />
              <span>Checkout ({totalOrderQty} items)</span>
              <CurrencyBar
                foreignCurrency={menuResult.currency}
                homeCurrency={settings.homeCurrency}
                amount={Object.entries(quantities).reduce((acc, [idx, qty]) => {
                  const price = parseFloat(menuResult.items[parseInt(idx)]?.price || '0');
                  return acc + price * qty;
                }, 0)}
              />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <Checkout
        isVisible={showCheckout}
        onClose={() => setShowCheckout(false)}
        items={menuResult?.items || []}
        quantities={quantities}
        currency={menuResult?.currency || '¥'}
        restaurantName={menuResult?.restaurantName || ''}
        taxRate={settings.taxRate}
        serviceFee={settings.serviceFee}
        onConfirmOrder={handleConfirmOrder}
      />
      <AuthModal
        isVisible={showAuth}
        onClose={() => setShowAuth(false)}
        onLogin={async (e, p) => { await login(e, p); }}
        onRegister={async (e, p) => { await register(e, p); }}
      />
    </div>
  );
}

export default App;
