import { useState, useCallback } from 'react';
import {
  Share2,
  X,
  Settings as SettingsIcon,
  History,
  User,
  UtensilsCrossed,
  ShoppingCart,
  BookOpen,
  NotebookPen
} from 'lucide-react';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';
import { analyzeMenuImage, analyzeReceiptImage, analyzeGeneralImage } from './services/gemini';
import { saveOrder, saveScan } from './services/storage';
import { SUPPORTED_LANGUAGES } from './i18n';
import { I18nProvider, useT } from './i18n/context';
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
import Diary from './components/Diary';
import RecommendCards from './components/RecommendCards';
import BottomTabBar from './components/BottomTabBar';
import { getRecommendations } from './services/affiliate';

type Page = 'home' | 'history' | 'settings' | 'expenses' | 'diary';

function AppInner() {
  const t = useT();
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
  const [receiptHighlight, setReceiptHighlight] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [error, setError] = useState('');

  const getApiKey = useCallback((): string | null => {
    if (settings.geminiApiKey) return settings.geminiApiKey;
    if (isRentalActive || isLifetime) {
      return import.meta.env.VITE_GEMINI_API_KEY || null;
    }
    return null;
  }, [settings.geminiApiKey, isRentalActive, isLifetime]);

  const targetLangLabel = SUPPORTED_LANGUAGES.find(l => l.code === settings.targetLanguage)?.label || 'English';

  const handleAnalyze = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError(t('error.noKey'));
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
      setError(t('error.failed'));
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
  const handleShareMenu = async () => {
    if (!menuResult) return;
    const name = menuResult.restaurantName || 'Menu';
    const items = menuResult.items.map((item, i) => {
      const price = menuResult.currency === '¥' ? `¥${item.price}` : `${item.price}${menuResult.currency}`;
      return `${i + 1}. ${item.translatedName} ${price}\n   ${item.originalName}${item.description ? `\n   ${item.description}` : ''}`;
    }).join('\n');
    const text = `🍽️ ${name} — GoSavor\n\n${items}\n\n想吃什麼？回覆編號就好！`;

    if (navigator.share) {
      try {
        await navigator.share({ title: name, text });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      alert('已複製到剪貼簿！');
    }
  };

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
  if (page === 'diary') return <Diary onBack={() => setPage('home')} />;
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

  // Hidden file input for camera/gallery
  const fileInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) (window as any).__gosavor_file_input = node;
  }, []);

  const handleFileFromBottomBar = () => {
    const input = (window as any).__gosavor_file_input as HTMLInputElement;
    if (input) input.click();
  };

  const handleBottomBarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setImages(prev => [...prev, ev.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Simplified Top Bar */}
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
              <button onClick={logout} className="px-2 py-1 text-[10px] text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                {userData?.plan === 'lifetime' ? 'PRO' : userData?.plan === 'rental' ? 'RENTAL' : 'FREE'} · {t('nav.logout')}
              </button>
            ) : (
              <button onClick={() => setShowAuth(true)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
                <User size={18} />
              </button>
            )}
            <button onClick={() => setPage('settings')} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Hidden file input for bottom bar camera button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleBottomBarFile}
        className="hidden"
      />

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
                const active = receiptHighlight === idx;
                return (
                  <div key={idx} className={`absolute cursor-pointer ${active ? 'z-10' : ''}`}
                    onClick={() => {
                      setReceiptHighlight(idx);
                      const el = document.getElementById(`receipt-item-${idx}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      setTimeout(() => setReceiptHighlight(null), 2000);
                    }}
                    style={{
                      top: `${box[0] * 100}%`, left: `${box[1] * 100}%`,
                      width: `${(box[3] - box[1]) * 100}%`, height: `${(box[2] - box[0]) * 100}%`,
                    }}>
                    <span className={`absolute -top-2 -left-2 rounded-full font-black flex items-center justify-center transition-all duration-300 ${
                      active
                        ? 'w-8 h-8 text-sm bg-orange-500 text-white shadow-[0_0_0_2px_white,0_0_10px_rgba(249,115,22,0.7)] animate-bounce'
                        : 'w-5 h-5 text-[9px] bg-white/60 text-gray-900 border-2 border-gray-900'
                    }`}>
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
                {t('error.goSettings')}
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
            {/* Show recommendations while analyzing */}
            {isAnalyzing && (
              <div className="mt-4">
                <RecommendCards loadProducts={() => getRecommendations(scanMode)} context="loading" />
              </div>
            )}
            {images.length === 0 && !isAnalyzing && (
              <ScanHistory onLoadScan={handleLoadScan} />
            )}
          </>
        ) : menuResult ? (
          /* Menu results */
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-900 truncate">{menuResult.restaurantName || 'Menu'}</h2>
                  <button 
                    onClick={() => setShowDebug(true)}
                    className="shrink-0 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-mono hover:bg-slate-200"
                  >
                    DEBUG
                  </button>
                </div>
                <p className="text-xs text-gray-400">{menuResult.items.length} {t('result.dishes')}</p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <button onClick={handleShareMenu} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600" title="分享菜單">
                  <Share2 size={16} />
                </button>
                <button onClick={handleGoHome} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 font-medium whitespace-nowrap">
                  {t('result.newScan')}
                </button>
              </div>
            </div>
            {/* Wrong mode? Re-analyze */}
            <div className="mb-3 flex items-center gap-1 text-xs text-gray-400">
              <span>不對？改用</span>
              <button onClick={() => { setScanMode('receipt'); handleAnalyze(); }} className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded-full font-medium hover:bg-blue-100">收據翻譯</button>
              <button onClick={() => { setScanMode('general'); handleAnalyze(); }} className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded-full font-medium hover:bg-slate-100">萬用翻譯</button>
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
            {/* Affiliate recommendations */}
            <div className="mt-4">
              <RecommendCards loadProducts={() => getRecommendations('menu', menuResult.restaurantName)} />
            </div>
          </>
        ) : receiptResult ? (
          /* Receipt results */
          <>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{t('result.receipt')}</h2>
              <button onClick={handleGoHome} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 font-medium">
                {t('result.newScan')}
              </button>
            </div>
            <div className="mb-3 flex items-center gap-1 text-xs text-gray-400">
              <span>不對？改用</span>
              <button onClick={() => { setScanMode('menu'); handleAnalyze(); }} className="px-2 py-0.5 bg-orange-50 text-orange-500 rounded-full font-medium hover:bg-orange-100">菜單翻譯</button>
              <button onClick={() => { setScanMode('general'); handleAnalyze(); }} className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded-full font-medium hover:bg-slate-100">萬用翻譯</button>
            </div>
            <ReceiptView data={receiptResult} imageSrc={images[0]} layout={receiptLayout} onLayoutChange={setReceiptLayout} highlightIdx={receiptHighlight} onHighlight={(idx) => { setReceiptHighlight(idx); setTimeout(() => setReceiptHighlight(null), 2000); }} homeCurrency={settings.homeCurrency} />
            <div className="mt-4">
              <RecommendCards loadProducts={() => getRecommendations('receipt', receiptResult.merchantName)} />
            </div>
          </>
        ) : generalResult ? (
          /* General/Sign/Fortune results */
          <>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{t('result.translation')}</h2>
              <button onClick={handleGoHome} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 font-medium">
                {t('result.newScan')}
              </button>
            </div>
            <div className="mb-3 flex items-center gap-1 text-xs text-gray-400">
              <span>不對？改用</span>
              <button onClick={() => { setScanMode('menu'); handleAnalyze(); }} className="px-2 py-0.5 bg-orange-50 text-orange-500 rounded-full font-medium hover:bg-orange-100">菜單翻譯</button>
              <button onClick={() => { setScanMode('receipt'); handleAnalyze(); }} className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded-full font-medium hover:bg-blue-100">收據翻譯</button>
            </div>
            <GeneralView data={generalResult} />
            <div className="mt-4">
              <RecommendCards loadProducts={() => getRecommendations('general', undefined, generalResult.locationGuess)} />
            </div>
          </>
        ) : null}
      </main>

      {/* Floating Checkout */}
      {menuResult && totalOrderQty > 0 && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-20">
          <div className="max-w-md mx-auto">
            {(() => {
              const totalForeign = Object.entries(quantities).reduce((acc, [idx, qty]) => {
                const price = parseFloat(menuResult.items[parseInt(idx)]?.price || '0');
                return acc + price * qty;
              }, 0);
              const curr = menuResult.currency;
              const formatted = curr === '¥' || curr === '$' || curr === '€'
                ? `${curr}${totalForeign.toLocaleString()}`
                : `${totalForeign.toLocaleString()} ${curr}`;
              return (
                <button
                  onClick={() => setShowCheckout(true)}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold shadow-xl shadow-orange-200 transition-all"
                >
                  <div className="flex items-center justify-center gap-2 text-lg">
                    <ShoppingCart size={20} />
                    <span>{t('checkout.button')} ({totalOrderQty} {t('result.items')})</span>
                    <span className="font-black">{formatted}</span>
                  </div>
                  <div className="mt-0.5">
                    <CurrencyBar
                      foreignCurrency={curr}
                      homeCurrency={settings.homeCurrency}
                      amount={totalForeign}
                    />
                  </div>
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modals */}
      <Checkout
        isVisible={showCheckout}
        onClose={() => { setShowCheckout(false); setQuantities({}); }}
        items={menuResult?.items || []}
        quantities={quantities}
        currency={menuResult?.currency || '¥'}
        restaurantName={menuResult?.restaurantName || ''}
        taxRate={settings.taxRate}
        serviceFee={settings.serviceFee}
        onConfirmOrder={handleConfirmOrder}
        homeCurrency={settings.homeCurrency}
      />
      <AuthModal
        isVisible={showAuth}
        onClose={() => setShowAuth(false)}
        onLogin={async (e, p) => { await login(e, p); }}
        onRegister={async (e, p) => { await register(e, p); }}
      />

      {/* Debug Modal */}
      {showDebug && menuResult?.ocrDebug && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md max-h-[80vh] rounded-2xl flex flex-col shadow-2xl">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">OCR Debug Info</h3>
              <button onClick={() => setShowDebug(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4 font-mono text-xs">
              <div className="p-2 bg-blue-50 text-blue-700 rounded border border-blue-100">
                <strong>Engine:</strong> {menuResult.ocrDebug.source}
              </div>
              <div>
                <strong>OCR Blocks ({menuResult.ocrDebug.blocks.length}):</strong>
                <pre className="mt-1 p-2 bg-gray-900 text-green-400 rounded overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(menuResult.ocrDebug.blocks.slice(0, 50), null, 2)}
                </pre>
              </div>
              <div>
                <strong>Gemini Raw Response:</strong>
                <pre className="mt-1 p-2 bg-gray-900 text-yellow-400 rounded overflow-x-auto whitespace-pre-wrap">
                  {menuResult.ocrDebug.rawResponse}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Tab Bar */}
      <BottomTabBar
        scanMode={scanMode}
        onModeChange={(mode) => {
          setScanMode(mode);
          if (menuResult || receiptResult || generalResult) {
            handleGoHome(); // reset when switching mode
          }
        }}
        onCameraPress={handleFileFromBottomBar}
        onDiaryPress={() => setPage('diary')}
        hasResults={!!(menuResult || receiptResult || generalResult)}
      />
    </div>
  );
}

function App() {
  const { settings } = useSettings();
  return (
    <I18nProvider lang={settings.targetLanguage}>
      <AppInner />
    </I18nProvider>
  );
}

export default App;
