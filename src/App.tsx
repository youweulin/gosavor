import { useState, useCallback } from 'react';
import { Settings as SettingsIcon, History, User, UtensilsCrossed, ShoppingCart } from 'lucide-react';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';
import { analyzeMenuImage } from './services/gemini';
import { saveOrder, saveScan } from './services/storage';
import { TARGET_LANGUAGES } from './types';
import type { MenuAnalysisResult, OrderItem, SavedOrder, SavedScan, SplitInfo } from './types';

import CameraCapture from './components/CameraCapture';
import MenuResults from './components/MenuResults';
import Checkout from './components/Checkout';
import OrderHistory from './components/OrderHistory';
import Settings from './components/Settings';
import AuthModal from './components/AuthModal';
import CurrencyBar from './components/CurrencyBar';
import InlineImageMap from './components/InlineImageMap';
import ScanHistory from './components/ScanHistory';

type Page = 'home' | 'history' | 'settings';

function App() {
  const { settings, updateSettings, resetSettings, hasApiKey } = useSettings();
  const { user, userData, login, register, logout, isRentalActive, isLifetime } = useAuth();

  const [page, setPage] = useState<Page>('home');
  const [images, setImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [menuResult, setMenuResult] = useState<MenuAnalysisResult | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
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
      const result = await analyzeMenuImage(imageData, targetLangLabel, apiKey, settings.allergens);
      setMenuResult(result);
      setQuantities({});

      // Auto-save scan to local history
      saveScan({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        restaurantName: result.restaurantName || 'Menu',
        currency: result.currency,
        items: result.items,
        images: images,
      });
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
    setQuantities({});
    setHighlightIndex(null);
    setActiveCategory(null);
    setError('');
  };

  // Load a saved scan
  const handleLoadScan = (scan: SavedScan) => {
    setMenuResult({
      currency: scan.currency,
      restaurantName: scan.restaurantName,
      items: scan.items,
    });
    setImages(scan.images);
    setQuantities({});
    setActiveCategory(null);
  };

  if (page === 'history') return <OrderHistory onBack={() => setPage('home')} />;
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
            <button onClick={() => setPage('history')} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
              <History size={18} />
            </button>
            <button onClick={() => setPage('settings')} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Sticky image map */}
      {menuResult && images.length > 0 && (
        <div className="sticky top-[53px] z-20 bg-gray-50 border-b border-gray-200 shadow-sm">
          <div className="max-w-md mx-auto px-2 py-2">
            <InlineImageMap
              images={images}
              items={menuResult.items}
              highlightIndex={highlightIndex}
              activeCategory={activeCategory}
              onTapItem={(idx) => {
                setHighlightIndex(idx);
                const el = document.getElementById(`menu-item-${idx}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => setHighlightIndex(null), 2000);
              }}
            />
          </div>
        </div>
      )}

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

        {!menuResult ? (
          <>
            <CameraCapture
              images={images}
              onImagesChange={setImages}
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
            />
            {images.length === 0 && (
              <>
                <div className="mt-8 space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { icon: '📸', title: '拍菜單', desc: 'AI 翻譯' },
                      { icon: '⚠️', title: '過敏警示', desc: '自動標記' },
                      { icon: '🗣️', title: '語音點餐', desc: '日語發音' },
                    ].map((feat, i) => (
                      <div key={i} className="p-3 bg-white rounded-xl border border-gray-100">
                        <p className="text-2xl mb-1">{feat.icon}</p>
                        <p className="text-xs font-medium text-gray-700">{feat.title}</p>
                        <p className="text-xs text-gray-400">{feat.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Scan History */}
                <ScanHistory onLoadScan={handleLoadScan} />
              </>
            )}
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">{menuResult.restaurantName || 'Menu'}</h2>
                <p className="text-xs text-gray-400">{menuResult.items.length} dishes</p>
              </div>
              <button
                onClick={handleGoHome}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 font-medium"
              >
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
                setHighlightIndex(idx);
                setTimeout(() => setHighlightIndex(null), 2000);
              }}
              onCategoryChange={setActiveCategory}
            />
          </>
        )}
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
