import { useState, useCallback, useEffect } from 'react';
import {
  Share2,
  X,
  Settings as SettingsIcon,
  User,
  ShoppingCart,
  Camera,
  Image
} from 'lucide-react';
import { useSettings } from './hooks/useSettings';
import { useAuthContext } from './contexts/AuthContext';
import { analyzeMenuImage, analyzeReceiptImage, analyzeGeneralImage, setScanMode as setGeminiScanMode, getLastUsageInfo } from './services/gemini';
import UsageBadge from './components/UsageBadge';
import ARWaitingPage from './components/ARWaitingPage';
import { saveOrder, saveScan } from './services/storage';
import { startLiveTranslate, pickNativeImage } from './services/LiveTranslate';
import DrugstoreInfo from './components/DrugstoreInfo';

import { trackScanEvent, getNickname, updateNickname, submitPriceReports, getUserProfile, redeemCode as submitRedeemCode } from './services/supabase';
import { SUPPORTED_LANGUAGES } from './i18n';
import { I18nProvider, useT } from './i18n/context';
import { AuthProvider } from './contexts/AuthContext';
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
import HomeCard from './components/HomeCard';

import GeneralView from './components/GeneralView';
import ChatTranslator from './components/ChatTranslator';
import ExpenseBook from './components/ExpenseBook';
import Diary from './components/Diary';
import RecommendCards from './components/RecommendCards';
import BottomTabBar from './components/BottomTabBar';
import { getRecommendations } from './services/affiliate';

type Page = 'home' | 'history' | 'settings' | 'expenses' | 'diary' | 'chat' | 'drugstore';

function AppInner() {
  const t = useT();
  const { settings, updateSettings, resetSettings } = useSettings();
  const { isAuthenticated } = useAuthContext();

  // Load user profile after auth
  useEffect(() => {
    if (isAuthenticated) {
      getNickname().then(setProfileNickname);
      getUserProfile().then(p => { if (p?.plan) setUserPlan(p.plan); });
    }
  }, [isAuthenticated]);

  const [page, setPage] = useState<Page>('home');
  const [images, setImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isARProcessing, setIsARProcessing] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('menu');
  const [activeTab, setActiveTab] = useState('menu');
  const [autoAnalyze, setAutoAnalyze] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [scanRefreshKey, setScanRefreshKey] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [profileNickname, setProfileNickname] = useState('旅人');
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState('');
  const [userPlan, setUserPlan] = useState('free');
  const [usageInfo, setUsageInfo] = useState<ReturnType<typeof getLastUsageInfo>>(null);
  const [menuResults, setMenuResults] = useState<MenuAnalysisResult[]>([]);
  const [activeMenuPage, setActiveMenuPage] = useState(0);
  // Computed: current page's result (backward compatible)
  const menuResult = menuResults.length > 0 ? menuResults[activeMenuPage] || menuResults[0] : null;
  const setMenuResult = (r: MenuAnalysisResult | null) => {
    if (r) setMenuResults([r]);
    else setMenuResults([]);
  };
  const [receiptResult, setReceiptResult] = useState<ReceiptAnalysisResult | null>(null);
  const [generalResult, setGeneralResult] = useState<GeneralAnalysisResult | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<'review' | 'staff' | 'split'>('review');
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [receiptLayout, setReceiptLayout] = useState<'stack' | 'side' | 'list'>('stack');
  const [receiptHighlight, setReceiptHighlight] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [error, setError] = useState('');
  const [gpsCity, setGpsCity] = useState('');

  // Get GPS city for recommendations
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&accept-language=ja`);
        const data = await res.json();
        const addr = data.address || {};
        const area = addr.suburb || addr.neighbourhood || addr.quarter || '';
        const city = addr.city || addr.town || addr.county || addr.state || '';
        const combined = [city, area].filter(Boolean).join(' ');
        if (combined) setGpsCity(combined);
      } catch {}
    }, () => {}, { timeout: 5000 });
  }, []);

  const getApiKey = useCallback((): string | null => {
    return settings.geminiApiKey || null;
  }, [settings.geminiApiKey]);

  const targetLangLabel = SUPPORTED_LANGUAGES.find(l => l.code === settings.targetLanguage)?.label || 'English';

  const DAILY_LIMIT = 50;
  const checkDailyLimit = (): boolean => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem('gosavor_daily_usage');
    const data = stored ? JSON.parse(stored) : { date: '', count: 0 };
    if (data.date !== today) return true; // new day
    return data.count < DAILY_LIMIT;
  };
  const incrementDailyUsage = () => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem('gosavor_daily_usage');
    const data = stored ? JSON.parse(stored) : { date: '', count: 0 };
    if (data.date !== today) {
      localStorage.setItem('gosavor_daily_usage', JSON.stringify({ date: today, count: 1 }));
    } else {
      localStorage.setItem('gosavor_daily_usage', JSON.stringify({ date: today, count: data.count + 1 }));
    }
  };

  const handleAnalyze = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError('請先到設定輸入你的 Gemini API Key。贊助版用戶可使用「如何取得免費 API Key？」教學取得。');
      return;
    }
    const isUnlimited = userPlan === 'supporter' || userPlan === 'pro';
    if (!isUnlimited && !checkDailyLimit()) {
      setError(`今日已達 ${DAILY_LIMIT} 次翻譯上限，明天 00:00 重置。開通贊助版可享無限翻譯！`);
      return;
    }
    setGeminiScanMode(scanMode);
    setIsAnalyzing(true);
    setError('');
    try {
      const imageData = images.map(img => ({
        base64: img.split(',')[1],
        mimeType: 'image/jpeg',
      }));

      if (scanMode === 'menu') {
        // Translate each image separately (max 4 pages)
        const pagesToTranslate = images.slice(0, 4);
        const results: MenuAnalysisResult[] = [];
        for (let i = 0; i < pagesToTranslate.length; i++) {
          const pageImageData = [{ base64: pagesToTranslate[i].split(',')[1], mimeType: 'image/jpeg' }];
          const result = await analyzeMenuImage(pageImageData, targetLangLabel, apiKey, settings.allergens);
          results.push(result);
        }
        setMenuResults(results);
        setActiveMenuPage(0);
        setUsageInfo(getLastUsageInfo());
        setQuantities({});
        // Save all items across pages
        const allItems = results.flatMap(r => r.items);
        saveScan({
          id: crypto.randomUUID(), timestamp: Date.now(), scanMode: 'menu',
          restaurantName: results[0]?.restaurantName || 'Menu',
          currency: results[0]?.currency || '¥', items: allItems, images,
        });
        trackScanEvent('menu');
      } else if (scanMode === 'receipt') {
        const result = await analyzeReceiptImage(imageData, targetLangLabel, apiKey);
        setReceiptResult(result);
        setUsageInfo(getLastUsageInfo());
        saveScan({
          id: crypto.randomUUID(), timestamp: Date.now(), scanMode: 'receipt',
          restaurantName: result.merchantName || 'Receipt',
          currency: result.currency, items: [], images,
          receiptData: result,
        });
        trackScanEvent('receipt');
        // Auto-submit price reports to Supabase (核心資產收集)
        if (result.items && result.items.length > 0) {
          submitPriceReports(
            result.items
              .filter(item => item.originalName && item.price)
              .map(item => {
                const totalPrice = parseFloat(item.price.replace(/,/g, '')) || 0;
                const qty = parseInt(item.quantity) || 1;
                return {
                  productName: item.originalName,
                  translatedName: item.translatedName || '',
                  price: Math.round(totalPrice / qty),
                  currency: result.currency || 'JPY',
                  isTaxFree: result.isTaxFree || false,
                  category: 'Receipt',
                  janCode: item.janCode || '',
                };
              }),
            result.merchantName,
          );
        }
      } else {
        const result = await analyzeGeneralImage(imageData, targetLangLabel, apiKey);
        setGeneralResult(result);
        setUsageInfo(getLastUsageInfo());
        saveScan({
          id: crypto.randomUUID(), timestamp: Date.now(), scanMode: 'general',
          restaurantName: result.locationGuess || 'Translation',
          currency: '', items: [], images,
          generalData: result,
        });
        trackScanEvent('general', result.items[0]?.category);
      }
      incrementDailyUsage();
    } catch (err: any) {
      const msg = err?.message || err?.toString?.() || String(err);
      console.error('[GoSavor] Analyze error:', msg);
      if (msg.includes('LIMIT')) {
        setError('今日免費體驗額度（1次）已用完。開通贊助版 $299 → 自帶 API Key 無限翻譯！也可輸入兌換碼開通。');
      } else if (msg.includes('GPS') || msg.includes('日本')) {
        setError('系統翻譯僅限日本境內使用。到日本後可免費體驗 1 次/天！或開通贊助版自帶 API Key 不受地區限制。');
      } else if (msg.includes('NO_KEY') || msg.includes('NO_AUTH')) {
        setError('翻譯服務準備中，請稍後再試。');
      } else if (msg.includes('USE_OWN_KEY')) {
        setError('請到設定輸入你的 API Key');
      } else {
        setError(t('error.failed'));
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-analyze when photo is selected from bottom bar
  useEffect(() => {
    if (autoAnalyze && images.length > 0 && !isAnalyzing) {
      console.log('[GoSavor] autoAnalyze triggered! mode:', scanMode, 'images:', images.length);
      if (scanMode === 'menu') {
        console.log('[GoSavor] BLOCKED autoAnalyze for menu mode');
        setAutoAnalyze(false);
        return;
      }
      setAutoAnalyze(false);
      handleAnalyze();
    }
  }, [autoAnalyze, images, isAnalyzing]);

  const handleUpdateQuantity = (index: number, delta: number) => {
    const key = `${activeMenuPage}-${index}`;
    setQuantities(prev => {
      const next = Math.max(0, (prev[key] || 0) + delta);
      return { ...prev, [key]: next };
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
    setShowCamera(false);
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
    } else if (mode === 'ar-translate' && scan.arTranslateItems) {
      // Display AR translate items as general result (image shown via ARImageOverlay)
      setScanMode('general');
      setGeneralResult({
        locationGuess: scan.restaurantName || 'AR翻譯',
        items: scan.arTranslateItems.map(item => ({
          originalText: item.original,
          translatedText: item.translated,
          explanation: '',
          category: 'AR',
          boundingBox: item.boundingBox,
        })),
      });
    }
  };

  // Hidden file input for camera/gallery (MUST be before any early returns — React hooks rule)
  const fileInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) (window as any).__gosavor_file_input = node;
  }, []);

  if (page === 'history') return <OrderHistory onBack={() => setPage('home')} />;
  if (page === 'expenses') return <ExpenseBook onBack={() => setPage('home')} />;
  if (page === 'diary') return <Diary onBack={() => setPage('home')} />;
  if (page === 'drugstore') return <DrugstoreInfo onBack={() => setPage('home')} />;
  if (page === 'chat') {
    const apiKey = getApiKey();
    return <ChatTranslator
      onBack={() => setPage('home')}
      onBackToCheckout={menuResult ? () => { setPage('home'); setCheckoutMode('staff'); setShowCheckout(true); } : undefined}
      apiKey={apiKey || ''}
      targetLanguage={settings.targetLanguage}
    />;
  }
  if (page === 'settings') {
    return (
      <Settings
        settings={settings}
        onUpdate={updateSettings}
        onReset={resetSettings}
        onBack={() => setPage('home')}
        userPlan={userPlan}
      />
    );
  }

  const handleFileFromBottomBar = () => {
    const input = (window as any).__gosavor_file_input as HTMLInputElement;
    if (input) input.click();
  };

  const handleBottomBarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // Read first image and auto-analyze
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        const imgData = ev.target.result as string;
        setImages([imgData]);
        // Auto-trigger analysis after a tick (so state updates)
        // Trigger auto-analyze after image state updates
        setTimeout(() => setAutoAnalyze(true), 50);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Simplified Top Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button onClick={handleGoHome} className="flex items-center gap-2.5 hover:opacity-70 transition-opacity">
            <img src="/goose-logo.png" alt="GoSavor" className="w-9 h-9 rounded-lg" />
            <span className="font-bold text-lg text-gray-900">GoSavor</span>
            {!(window as any).Capacitor?.isNativePlatform?.() && (
              <span className="text-[9px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">PWA v0.8.8</span>
            )}
            <UsageBadge usage={usageInfo} hasOwnKey={!!settings.geminiApiKey} />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                const name = await getNickname();
                setProfileNickname(name);
                setShowProfile(true);
              }}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            >
              <User size={20} />
            </button>
            <button onClick={() => setPage('settings')} className="p-2 rounded-full hover:bg-gray-100 text-gray-500" title="設定">
              <SettingsIcon size={20} />
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
      ) : generalResult && images.length > 0 && !generalResult.items.some(i => i.category === 'AR') ? (
        <div className="sticky top-[53px] z-20 bg-gray-50 border-b border-gray-200 shadow-sm">
          <div className="max-w-md mx-auto">
            <img src={images[0]} alt="Photo" className="w-full object-cover max-h-[35vh]" />
          </div>
        </div>
      ) : menuResult && images.length > 0 ? (
        <div className="sticky top-[53px] z-20 bg-gray-50 border-b border-gray-200 shadow-sm">
          <div className="max-w-md mx-auto px-2 py-1">
            <InlineImageMap
              images={menuResults.length > 1 ? [images[activeMenuPage]] : images}
              items={menuResult.items}
              highlightIndex={highlightIndex}
              activeCategory={activeCategory}
              activeImageIndex={menuResults.length > 1 ? 0 : activeImageIdx}
              onTapItem={(idx) => {
                setHighlightIndex(idx);
                const el = document.getElementById(`menu-item-${idx}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => setHighlightIndex(null), 2000);
              }}
              onImageChange={(imgIdx) => {
                if (menuResults.length > 1) {
                  // Multi-page: imgIdx is always 0, use page tabs to switch
                  return;
                }
                setActiveImageIdx(imgIdx);
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
      <main className="max-w-md mx-auto px-4 pt-2 pb-24">
        {error && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <p className="text-sm text-gray-800 leading-relaxed">{error}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setError(''); setPage('settings'); }}
                className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold"
              >
                🔑 贊助開通
              </button>
              <button
                onClick={() => { setError(''); setShowProfile(true); }}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold"
              >
                🎫 輸入兌換碼
              </button>
            </div>
          </div>
        )}

        {!menuResult && !receiptResult && !generalResult ? (
          <div className="flex flex-col">
            {/* Home screen content when no photos/results */}
            {images.length === 0 && !isAnalyzing && !showCamera ? (
              <div className="space-y-4">
                {/* Welcome + Location + Weather */}
                <HomeCard
                  nickname={profileNickname}
                  userPlan={userPlan}
                  onDiary={() => setPage('diary')}
                  onExpenses={() => setPage('expenses')}
                  onHistory={() => setPage('history')}
                />

                {/* Drugstore Info */}
                <button
                  onClick={() => setPage('drugstore')}
                  className="w-full bg-blue-50/80 border border-blue-100 rounded-2xl p-4 text-left hover:bg-blue-100/60 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-slate-800">💊 藥妝情報・比價搜尋</h3>
                      <p className="text-sm text-slate-500 mt-1">查看熱門商品排行、跨店比價</p>
                    </div>
                    <span className="text-2xl text-blue-400">📊</span>
                  </div>
                </button>

                {/* Recommendations */}
                <div>
                  <RecommendCards loadProducts={() => getRecommendations(scanMode, undefined, undefined, gpsCity)} context="home" />
                </div>

                {/* Recent Scans */}
                <ScanHistory key={scanRefreshKey} onLoadScan={handleLoadScan} />
              </div>
            ) : (
              /* Camera capture + analyzing state */
              <div>
                <CameraCapture
                  images={images}
                  onImagesChange={(imgs) => {
                    setImages(imgs);
                    if (scanMode === 'menu') {
                      setAutoAnalyze(false);
                    } else if (imgs.length > 0) {
                      setTimeout(() => setAutoAnalyze(true), 50);
                    }
                  }}
                  onAnalyze={handleAnalyze}
                  isAnalyzing={isAnalyzing}
                  scanMode={scanMode}
                  onAddPage={async () => {
                    const { pickNativeImage } = await import('./services/LiveTranslate');
                    const base64 = await pickNativeImage('album');
                    if (base64) {
                      setImages(prev => [...prev, `data:image/jpeg;base64,${base64}`].slice(0, 4));
                    }
                  }}
                />
                {isAnalyzing && (
                  <div className="mt-4">
                    <RecommendCards loadProducts={() => getRecommendations(scanMode)} context="loading" />
                  </div>
                )}
              </div>
            )}

            {/* Footer Info */}
            {images.length === 0 && !isAnalyzing && (
              <div className="flex flex-col items-center py-10 opacity-60">
                <p className="text-gray-400 text-sm text-center font-medium">
                  {scanMode === 'menu' ? t('mode.menu.desc') : scanMode === 'receipt' ? t('mode.receipt.desc') : t('mode.general.desc')}
                </p>
                <p className="text-gray-300 text-[10px] mt-1.5 uppercase tracking-widest font-bold flex items-center gap-2">
                  <span className="w-4 h-px bg-gray-200" />
                  點下方 📷 開始掃描
                  <span className="w-4 h-px bg-gray-200" />
                </p>
              </div>
            )}
          </div>
        ) : menuResult ? (
          /* Menu results */
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-gray-900 truncate">{String(menuResult.restaurantName || 'Menu').replace(/\[Native\]\s?|\[Cloud\]\s?/g, '')}</h2>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span>{menuResult.items.length} {t('result.dishes')}</span>
                  <span>·</span>
                  <button onClick={() => { setScanMode('receipt'); handleAnalyze(); }} className="text-blue-500 hover:underline">收據</button>
                  <button onClick={() => { setScanMode('general'); handleAnalyze(); }} className="text-slate-500 hover:underline">萬用</button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                <button onClick={handleShareMenu} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500">
                  <Share2 size={14} />
                </button>
                <button onClick={handleGoHome} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 font-medium">
                  {t('result.newScan')}
                </button>
              </div>
            </div>
            {/* Page tabs for multi-page menu */}
            {menuResults.length > 1 && (
              <div className="flex gap-2 mb-3">
                {menuResults.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setActiveMenuPage(i); setActiveImageIdx(i); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                      activeMenuPage === i
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    第 {i + 1} 頁
                  </button>
                ))}
              </div>
            )}

            <div id="share-result">
              <MenuResults
                items={menuResult.items}
                currency={menuResult.currency}
                quantities={Object.fromEntries(
                  Object.entries(quantities)
                    .filter(([k]) => k.startsWith(`${activeMenuPage}-`))
                    .map(([k, v]) => [parseInt(k.split('-')[1]), v])
                )}
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
            </div>
            <div className="flex justify-center mt-3">
            </div>
            {/* Affiliate recommendations */}
            <div className="mt-4">
              <RecommendCards loadProducts={() => getRecommendations('menu', menuResult.restaurantName)} />
            </div>
          </>
        ) : receiptResult ? (
          /* Receipt results */
          <>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">{String(t('result.receipt'))}</h2>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <button onClick={() => { setScanMode('menu'); handleAnalyze(); }} className="text-orange-500 hover:underline">菜單</button>
                  <button onClick={() => { setScanMode('general'); handleAnalyze(); }} className="text-slate-500 hover:underline">萬用</button>
                </div>
              </div>
              <button onClick={handleGoHome} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 font-medium">
                {t('result.newScan')}
              </button>
            </div>
            <div id="share-result">
              <ReceiptView data={receiptResult} imageSrc={images[0]} layout={receiptLayout} onLayoutChange={setReceiptLayout} highlightIdx={receiptHighlight} onHighlight={(idx) => { setReceiptHighlight(idx); setTimeout(() => setReceiptHighlight(null), 2000); }} homeCurrency={settings.homeCurrency} />
            </div>
            <div className="flex justify-center mt-3">
            </div>
            <div className="mt-4">
              <RecommendCards loadProducts={() => getRecommendations('receipt', receiptResult.merchantName)} />
            </div>
          </>
        ) : generalResult ? (
          /* General/Sign/Fortune results */
          <>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">{String(t('result.translation'))}</h2>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <button onClick={() => { setScanMode('menu'); handleAnalyze(); }} className="text-orange-500 hover:underline">菜單</button>
                  <button onClick={() => { setScanMode('receipt'); handleAnalyze(); }} className="text-blue-500 hover:underline">收據</button>
                </div>
              </div>
              <button onClick={handleGoHome} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 font-medium">
                {t('result.newScan')}
              </button>
            </div>
            <div id="share-result">
              <GeneralView data={generalResult} imageSrc={images[0]} />
            </div>
            <div className="flex justify-center mt-3">
            </div>
            <div className="mt-4">
              <RecommendCards loadProducts={() => getRecommendations('general', undefined, generalResult.locationGuess)} />
            </div>
          </>
        ) : null}
      </main>

      {/* Floating Checkout */}
      {menuResult && totalOrderQty > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-2 z-40 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent pt-4">
          <div className="max-w-md mx-auto">
            {(() => {
              const totalForeign = Object.entries(quantities).reduce((acc, [key, qty]) => {
                const [pageIdx, itemIdx] = key.split('-').map(Number);
                const price = parseFloat(menuResults[pageIdx]?.items[itemIdx]?.price || '0');
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

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setShowProfile(false)}>
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Handle bar */}
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 sm:hidden" />

            <h3 className="text-xl font-black text-gray-900 mb-5">👤 我的帳戶</h3>

            {/* Nickname */}
            <div className="mb-5">
              <label className="text-xs font-medium text-gray-400 mb-1 block">暱稱</label>
              <input
                value={profileNickname}
                onChange={e => setProfileNickname(e.target.value)}
                placeholder="輸入你的暱稱"
                maxLength={20}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-orange-400 focus:outline-none"
              />
            </div>

            {/* Plan & Usage */}
            {(() => {
              const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
              const isPaid = userPlan === 'supporter' || userPlan === 'pro';
              const isBeta = userPlan === 'beta';
              const hasAccess = isPaid || isBeta;
              return (
              <div className={`bg-gradient-to-br ${hasAccess ? 'from-orange-50 to-amber-50 border-orange-200' : 'from-gray-50 to-orange-50 border-orange-100'} rounded-2xl p-4 mb-5 border`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{isPaid ? '⭐' : isBeta ? '🧪' : isNative ? '🍎' : '🌐'}</span>
                    <div>
                      <p className="font-bold text-sm text-gray-900">
                        {isPaid ? (userPlan === 'pro' ? '正式版' : '贊助版') : isBeta ? '公開測試版' : '免費體驗版'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {isPaid ? '感謝支持 GoSavor！' : isBeta ? '自帶 Key · 50次/天' : `${isNative ? 'iOS 版' : 'PWA 網頁版'}・封測期間`}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${hasAccess ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'}`}>
                    {isPaid ? (userPlan === 'pro' ? 'Pro' : 'Supporter') : isBeta ? 'Beta' : 'Free'}
                  </span>
                </div>

                {/* Feature list */}
                <div className="space-y-1.5 text-sm">
                  {isNative && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">AR翻譯</span>
                        <span className="text-green-600 font-medium">無限 ✅</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">對話翻譯</span>
                        <span className="text-green-600 font-medium">無限 ✅</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">AI 翻譯（菜單/收據/萬用）</span>
                    <span className={hasAccess ? 'text-green-600 font-medium' : 'text-gray-400'}>
                      {isPaid ? '無限（自帶 Key）✅' : isBeta ? '50 次/天（自帶 Key）✅' : '🔒 需兌換碼'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">自帶 API Key</span>
                    {hasAccess ? (
                      <span className="text-green-600 font-medium">已開通 ✅</span>
                    ) : (
                      <span className="text-gray-400">🔒 需開通</span>
                    )}
                  </div>
                </div>

                {/* Upgrade hint */}
                {!isPaid && (
                  <div className="mt-3 pt-3 border-t border-orange-100">
                    {isBeta ? (
                      <p className="text-xs text-gray-500">升級贊助版 → 無限翻譯，不受每日 50 次限制</p>
                    ) : (
                      <p className="text-xs text-gray-500">輸入公測兌換碼開通，或直接開通贊助版（7/1 前 $299）</p>
                    )}
                  </div>
                )}
              </div>
              );
            })()}

            {/* Redeem code */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-400 mb-1 block">兌換碼</label>
              <div className="flex gap-2">
                <input
                  value={redeemCode}
                  onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                  placeholder="輸入兌換碼"
                  maxLength={20}
                  className="flex-1 px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-mono tracking-wider focus:border-orange-400 focus:outline-none"
                />
                <button
                  onClick={async () => {
                    if (!redeemCode.trim()) return;
                    setRedeemStatus('⏳');
                    const result = await submitRedeemCode(redeemCode.trim());
                    setRedeemStatus(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
                    if (result.success) {
                      setRedeemCode('');
                      if (result.plan) setUserPlan(result.plan);
                    }
                  }}
                  className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold shrink-0"
                >
                  兌換
                </button>
              </div>
              {redeemStatus && (
                <p className={`text-xs mt-1.5 ${redeemStatus.startsWith('✅') ? 'text-green-600' : redeemStatus.startsWith('❌') ? 'text-red-500' : 'text-gray-400'}`}>
                  {redeemStatus}
                </p>
              )}
            </div>

            {/* Settings button */}
            <button
              onClick={() => { setShowProfile(false); setPage('settings'); }}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 mb-3"
            >
              ⚙️ 前往設定（API Key / 語言）
            </button>

            {/* Save & Close */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowProfile(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 font-medium"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  const name = profileNickname.trim() || '旅人';
                  await updateNickname(name);
                  setProfileNickname(name);
                  setShowProfile(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-bold"
              >
                儲存暱稱
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <Checkout
        isVisible={showCheckout}
        onClose={() => { setShowCheckout(false); setQuantities({}); }}
        items={menuResults.flatMap(r => r.items)}
        quantities={Object.fromEntries(
          (() => {
            // Convert "pageIdx-itemIdx" to flat index for Checkout
            let offset = 0;
            const entries: [number, number][] = [];
            menuResults.forEach((r, pageIdx) => {
              Object.entries(quantities)
                .filter(([k]) => k.startsWith(`${pageIdx}-`))
                .forEach(([k, v]) => {
                  const itemIdx = parseInt(k.split('-')[1]);
                  entries.push([offset + itemIdx, v]);
                });
              offset += r.items.length;
            });
            return entries;
          })()
        )}
        currency={menuResult?.currency || '¥'}
        restaurantName={menuResult?.restaurantName || ''}
        taxRate={settings.taxRate}
        serviceFee={settings.serviceFee}
        onConfirmOrder={handleConfirmOrder}
        homeCurrency={settings.homeCurrency}
        apiKey={getApiKey() || ''}
        onOpenChat={() => { setShowCheckout(false); setCheckoutMode('staff'); setPage('chat'); }}
        initialMode={checkoutMode}
      />
      <AuthModal />

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
      {/* Floating photo picker (native camera / album) */}
      {showPhotoPicker && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={() => setShowPhotoPicker(false)}>
          {(window as any).Capacitor?.isNativePlatform?.() ? (
            /* iOS: separate camera/album buttons (native plugin) */
            <div
              className="absolute left-1/2 -translate-x-1/2 flex items-center bg-white rounded-full shadow-2xl overflow-hidden"
              style={{ bottom: '110px' }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={async () => {
                  setShowPhotoPicker(false);
                  const base64 = await pickNativeImage('camera');
                  if (base64) {
                    setMenuResults([]); setReceiptResult(null); setGeneralResult(null);
                    setImages([`data:image/jpeg;base64,${base64}`]);
                    setShowCamera(true);
                    setTimeout(() => setAutoAnalyze(true), 50);
                  }
                }}
                className="flex flex-col items-center gap-1 px-6 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors border-r border-gray-100"
              >
                <Camera size={24} className={scanMode === 'menu' ? 'text-orange-500' : scanMode === 'receipt' ? 'text-blue-500' : 'text-slate-600'} />
                <span className="text-[13px] font-bold text-gray-800 tracking-wide">拍照</span>
              </button>
              <button
                onClick={async () => {
                  setShowPhotoPicker(false);
                  const base64 = await pickNativeImage('album');
                  if (base64) {
                    const newImg = `data:image/jpeg;base64,${base64}`;
                    if (scanMode === 'menu') {
                      // Menu mode: accumulate images (max 4), don't auto-translate
                      setAutoAnalyze(false);
                      setMenuResults([]);
                      setImages(prev => {
                        const current = menuResults.length > 0 ? [] : prev;
                        return [...current, newImg].slice(0, 4);
                      });
                      setShowCamera(true);
                    } else {
                      setImages([newImg]);
                      setShowCamera(true);
                      setTimeout(() => setAutoAnalyze(true), 50);
                    }
                  }
                }}
                className="flex flex-col items-center gap-1 px-6 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <Image size={24} className={scanMode === 'menu' ? 'text-orange-500' : scanMode === 'receipt' ? 'text-blue-500' : 'text-slate-600'} />
                <span className="text-[13px] font-bold text-gray-800 tracking-wide">{scanMode === 'menu' ? '相簿(多選)' : '相簿'}</span>
              </button>
            </div>
          ) : (
            /* PWA: single button */
            <div
              className="absolute left-1/2 -translate-x-1/2 bg-white rounded-full shadow-2xl overflow-hidden"
              style={{ bottom: '110px' }}
              onClick={e => { e.stopPropagation();
                setShowPhotoPicker(false);
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = () => {
                  const file = input.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = reader.result as string;
                    console.log('[GoSavor] PWA photo selected, mode:', scanMode);
                    // Clear ALL previous results
                    setMenuResults([]); setReceiptResult(null); setGeneralResult(null);
                    setAutoAnalyze(false);
                    if (scanMode === 'menu') {
                      console.log('[GoSavor] PWA menu: adding photo, no auto-analyze');
                      setImages(prev => [...prev, dataUrl].slice(0, 4));
                      setShowCamera(true);
                    } else {
                      console.log('[GoSavor] PWA non-menu: single photo, auto-analyze');
                      setImages([dataUrl]);
                      setShowCamera(true);
                      setTimeout(() => setAutoAnalyze(true), 50);
                    }
                  };
                  reader.readAsDataURL(file);
                };
                input.click();
              }}
            >
              <div className="flex flex-col items-center gap-1 px-8 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <Camera size={28} className={scanMode === 'menu' ? 'text-orange-500' : scanMode === 'receipt' ? 'text-blue-500' : 'text-slate-600'} />
                <span className="text-[13px] font-bold text-gray-800 tracking-wide">拍照 / 相簿</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AR Processing waiting page (PWA only) */}
      {isARProcessing && (
        <ARWaitingPage onClose={() => setIsARProcessing(false)} />
      )}

      <BottomTabBar
        scanMode={scanMode}
        activeTab={activeTab}
        onModeChange={(mode) => {
          setScanMode(mode);
          setActiveTab(mode);
          if (menuResult || receiptResult || generalResult) {
            handleGoHome();
          }
          if (!(window as any).Capacitor?.isNativePlatform?.()) {
            // PWA: directly open system file picker
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                setImages([`data:image/jpeg;base64,${base64}`]);
                setShowCamera(true);
                setTimeout(() => setAutoAnalyze(true), 50);
              };
              reader.readAsDataURL(file);
            };
            input.click();
          } else {
            setShowPhotoPicker(true);
          }
        }}
        onCameraPress={() => {
          if (!(window as any).Capacitor?.isNativePlatform?.()) {
            // PWA: directly open system file picker
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                setImages([`data:image/jpeg;base64,${base64}`]);
                setShowCamera(true);
                setTimeout(() => setAutoAnalyze(true), 50);
              };
              reader.readAsDataURL(file);
            };
            input.click();
          } else {
            handleFileFromBottomBar();
          }
        }}
        onARPress={async () => {
          setActiveTab('ar');
          try {
            const result = await startLiveTranslate('zh-Hant', () => {
              // Called after photo is taken, before API call — show loading page
              setIsARProcessing(true);
            });
            setIsARProcessing(false);
            if (result && result.items.length > 0) {
              const imageDataUrl = result.imageBase64
                ? `data:image/jpeg;base64,${result.imageBase64}` : '';
              await saveScan({
                id: crypto.randomUUID(),
                timestamp: result.timestamp,
                scanMode: 'ar-translate',
                restaurantName: result.items[0]?.translated?.substring(0, 20) || 'AR翻譯',
                currency: '',
                items: [],
                images: imageDataUrl ? [imageDataUrl] : [],
                arTranslateItems: result.items,
              });
              console.log('[GoSavor] AR saved to diary:', result.items.length, 'items');
              trackScanEvent('ar-translate');
              setScanRefreshKey(k => k + 1);

              // Show AR results immediately as general translation
              setScanMode('general');
              if (imageDataUrl) setImages([imageDataUrl]);
              setGeneralResult({
                locationGuess: 'AR 即時翻譯',
                items: result.items.map(item => ({
                  originalText: item.original,
                  translatedText: item.translated,
                  explanation: '',
                  category: 'AR',
                  boundingBox: item.boundingBox,
                })),
              });
              setShowCamera(true);
            }
          } catch (e) { console.error('[GoSavor] AR Translate error:', e); }
          setIsARProcessing(false);
        }}
        onChatPress={() => {
          setActiveTab('chat');
          handleGoHome();
          setPage('chat');
        }}
        chatActive={activeTab === 'chat'}
      />
    </div>
  );
}

function App() {
  const { settings } = useSettings();
  return (
    <AuthProvider>
      <I18nProvider lang={settings.targetLanguage}>
        <AppInner />
      </I18nProvider>
    </AuthProvider>
  );
}

export default App;
