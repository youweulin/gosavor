import { useState, useEffect } from 'react';
import { ArrowLeft, Key, Globe, AlertTriangle, RotateCcw, Eye, EyeOff, Check, Coins, MessageCircle, Shield, Info, Bug, Send, LogOut, Mail } from 'lucide-react';
import FeedbackModal from './FeedbackModal';
import { TARGET_LANGUAGES, COMMON_ALLERGEN_IDS, HOME_CURRENCIES } from '../types';
import { fetchRates } from './CurrencyBar';
import type { AppSettings } from '../types';
import { useT } from '../i18n/context';
import { useAuthContext } from '../contexts/AuthContext';

interface SettingsProps {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
  onReset: () => void;
  onBack: () => void;
  userPlan?: string;
}

const Settings = ({ settings, onUpdate, onReset, onBack, userPlan = 'free' }: SettingsProps) => {
  const canUseApiKey = userPlan === 'supporter' || userPlan === 'pro' || userPlan === 'beta' || userPlan === 'guide';
  const hasSharedKey = userPlan === 'guide-member';
  const t = useT();
  const { userEmail, authProvider, signOut } = useAuthContext();
  const [loggingOut, setLoggingOut] = useState(false);
  const [adminStatus, setAdminStatus] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState(settings.geminiApiKey);
  const [keySaved, setKeySaved] = useState(false);
  const keyChanged = keyDraft !== settings.geminiApiKey;
  const [rate, setRate] = useState<number | null>(null);
  const [rateTime, setRateTime] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [showKeyGuide, setShowKeyGuide] = useState(false);
  const [showLegal, setShowLegal] = useState<'privacy' | 'terms' | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    const homeCode = settings.homeCurrency.toLowerCase();
    fetchRates('jpy').then(rates => {
      if (rates[homeCode]) {
        setRate(rates[homeCode]);
        const cached = localStorage.getItem('gosavor_exchange_rates');
        if (cached) {
          const ts = JSON.parse(cached).timestamp;
          setRateTime(new Date(ts).toLocaleString());
        }
      }
    });
  }, [settings.homeCurrency]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-sm px-4 py-4 flex items-center gap-3 border-b border-gray-800">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-800">
          <ArrowLeft size={20} className="text-white" />
        </button>
        <h1 className="font-bold text-lg text-white">{t('settings.title')}</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Account */}
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
              {authProvider === 'apple' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              ) : (
                <Mail size={18} className="text-orange-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{userEmail || '-'}</p>
              <p className="text-xs text-gray-500">
                {authProvider === 'apple' ? 'Apple ID' : 'Email'} · {
                  userPlan === 'supporter' ? t('settings.planSupporter') :
                  userPlan === 'pro' ? t('settings.planPro') :
                  userPlan === 'beta' ? t('settings.planBeta') :
                  userPlan === 'guide' ? '導遊版' :
                  userPlan === 'guide-member' ? '旅遊團' :
                  t('settings.planFree')
                }
              </p>
            </div>
            <button
              onClick={async () => {
                if (loggingOut) return;
                setLoggingOut(true);
                try { await signOut(); } catch { /* */ }
                setLoggingOut(false);
              }}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-red-400 rounded-lg text-xs font-medium flex items-center gap-1 shrink-0"
            >
              <LogOut size={12} />
              {loggingOut ? '...' : t('nav.logout')}
            </button>
          </div>
        </div>

        {/* Gemini API Key */}
        <div>
          <label className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Key size={14} /> {t('settings.apiKey')}
            </span>
            <button
              onClick={() => setShowKeyGuide(true)}
              className="text-xs text-orange-400 hover:text-orange-300"
            >
              {t('settings.keyGuide')}
            </button>
          </label>
          {hasSharedKey ? (
            <div className="bg-green-900/30 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎌</span>
                <div className="flex-1">
                  <p className="text-green-400 text-xs font-medium">導遊提供 API Key</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">由導遊碼自動設定，每日 15 次翻譯額度</p>
                </div>
              </div>
            </div>
          ) : canUseApiKey ? (
          <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyDraft}
                onChange={e => { setKeyDraft(e.target.value); setKeySaved(false); }}
                placeholder="AIzaSy..."
                className="w-full px-4 py-3 pr-12 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              onClick={() => { onUpdate({ geminiApiKey: keyDraft }); setKeySaved(true); setTimeout(() => setKeySaved(false), 2000); }}
              disabled={!keyChanged}
              className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-1 shrink-0 transition-all ${
                keySaved
                  ? 'bg-green-600 text-white'
                  : keyChanged
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              {keySaved ? <><Check size={14} /></> : t('settings.saveKey')}
            </button>
          </div>
          </>
          ) : (
            <div className="bg-gray-800/50 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔒</span>
                <div className="flex-1">
                  <p className="text-gray-400 text-xs">{t('settings.keyLocked')}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{t('settings.keyLockedHint')}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Language & Currency — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Globe size={14} /> {t('settings.language')}
            </label>
            <select
              value={settings.targetLanguage}
              onChange={e => onUpdate({ targetLanguage: e.target.value })}
              className="w-full px-3 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-orange-500 focus:outline-none appearance-none text-sm"
            >
              {TARGET_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.flag} {lang.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Coins size={14} /> {t('settings.currency')}
            </label>
            <select
              value={settings.homeCurrency}
              onChange={e => onUpdate({ homeCurrency: e.target.value })}
              className="w-full px-3 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-orange-500 focus:outline-none appearance-none text-sm"
            >
              {HOME_CURRENCIES.map(curr => (
                <option key={curr.code} value={curr.code}>{curr.symbol} {curr.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500 -mt-4">AI 翻譯使用此語言 · 匯率換算使用此貨幣</p>
        {rate && (
          <div className="p-3 bg-gray-800/50 rounded-lg font-mono text-sm text-gray-300">
            {(() => {
              const converted = 1000 * rate;
              const smallUnit = ['USD', 'EUR', 'GBP', 'SGD', 'AUD', 'MYR', 'HKD', 'TWD', 'CNY', 'KRW', 'THB', 'VND', 'PHP'].includes(settings.homeCurrency);
              const c = settings.homeCurrency;
              const bulkFormatted = smallUnit ? converted.toFixed(2) : Math.round(converted).toLocaleString();
              const singleFormatted = smallUnit ? rate.toFixed(4) : rate.toFixed(2);
              return (
                <div className="grid grid-cols-[auto_auto_1fr_auto] gap-x-2">
                  <span className="text-right">¥1,000</span>
                  <span>≈</span>
                  <span>{bulkFormatted} {c}</span>
                  <span className="text-[10px] text-gray-500 font-sans self-center text-right row-span-2">{rateTime?.split(' ')[0] || ''}</span>
                  <span className="text-right text-gray-500">1 JPY</span>
                  <span className="text-gray-500">≈</span>
                  <span className="text-gray-500">{singleFormatted} {c}</span>
                </div>
              );
            })()}
          </div>
        )}

        {/* Allergens */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <AlertTriangle size={14} /> {t('settings.allergens')}
          </label>
          <p className="text-xs text-gray-500 mb-3">
            {t('settings.allergensHint')}
          </p>
          <div className="flex flex-wrap gap-2">
            {COMMON_ALLERGEN_IDS.map(id => {
              const isActive = settings.allergens.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => {
                    const next = isActive
                      ? settings.allergens.filter(a => a !== id)
                      : [...settings.allergens, id];
                    onUpdate({ allergens: next });
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                      : 'bg-gray-900 text-gray-400 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {t(`allergen.${id}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bug Report / Feedback */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <Bug size={14} /> 封測回報 / 意見回饋
          </label>
          <div className="space-y-2">
            {/* In-app feedback form */}
            <button
              onClick={() => setShowFeedback(true)}
              className="w-full flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl hover:bg-orange-500/20 transition-colors"
            >
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <Send size={18} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white">回報問題 / 建議功能</p>
                <p className="text-xs text-gray-400">可附截圖，自動帶入裝置資訊</p>
              </div>
            </button>
            {/* LINE group */}
            <a
              href="https://line.me/ti/g2/hS8WkPywa7QRd9_BX5cY-IS6KzY1MvO7k-U-gQ?utm_source=invitation&utm_medium=link_copy&utm_campaign=default"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-[#06C755]/10 border border-[#06C755]/30 rounded-xl hover:bg-[#06C755]/20 transition-colors"
            >
              <div className="w-10 h-10 bg-[#06C755] rounded-xl flex items-center justify-center">
                <MessageCircle size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">加入封測 LINE 群組</p>
                <p className="text-xs text-gray-400">即時討論、搶先體驗新功能</p>
              </div>
            </a>
          </div>
        </div>

        {/* Privacy Policy & Terms */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <Shield size={14} /> 隱私權與條款
          </label>
          <div className="space-y-2">
            <button
              onClick={() => setShowLegal('privacy')}
              className="w-full flex items-center gap-3 p-3 bg-gray-900 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
            >
              <Shield size={16} className="text-gray-400" />
              <span className="text-sm text-gray-300">隱私權政策</span>
            </button>
            <button
              onClick={() => setShowLegal('terms')}
              className="w-full flex items-center gap-3 p-3 bg-gray-900 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
            >
              <Info size={16} className="text-gray-400" />
              <span className="text-sm text-gray-300">使用條款</span>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 space-y-3">
          <button
            onClick={onReset}
            className="w-full py-3 bg-white border border-gray-300 hover:bg-gray-800 rounded-xl font-medium flex items-center justify-center gap-2 text-gray-400"
          >
            <RotateCcw size={16} /> {t('settings.reset')}
          </button>
        </div>

        {/* Admin: Rakuten Sync (only for admin email) */}
        {userEmail === 'metaworldfood@gmail.com' && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-4">
            <p className="text-xs font-bold text-red-400 mb-2">🔧 管理員工具</p>
            <button
              onClick={async () => {
                setAdminStatus('⏳ 同步中...');
                try {
                  const RAKUTEN_APP_ID = '40c15934-1373-4dc0-a3f6-e9fffa2f83c3';
                  const RAKUTEN_ACCESS_KEY = 'pk_cnZ5aZt4XZnrTXsxrB0beaUrh9jeDjbJ1ek762viGfR';
                  const { supabase } = await import('../services/supabase');

                  // 1. 撈排行榜前 20 名熱門商品
                  const { getPopularProducts } = await import('../services/supabase');
                  const popular = await getPopularProducts(20);
                  if (!popular?.length) { setAdminStatus('沒有排行榜資料'); return; }

                  const { data: existing } = await supabase.from('products').select('name, jan_code').limit(1000);
                  const existNames = new Set((existing || []).map((p: any) => p.name));
                  const existJANs = new Set((existing || []).filter((p: any) => p.jan_code).map((p: any) => p.jan_code));
                  const toProcess = popular.filter(p => {
                    if (p.jan_code && existJANs.has(p.jan_code)) return false;
                    if (existNames.has(p.product_name)) return false;
                    return true;
                  }).slice(0, 10);

                  if (!toProcess.length) { setAdminStatus('✅ 所有商品已有資料'); return; }

                  let ok = 0;
                  for (const product of toProcess) {
                    const kw = product.product_name.replace(/[\d\s\-_\.・]+[錠包枚個入g粒ml本袋箱]+$/g, '').substring(0, 20) || product.product_name.substring(0, 20);
                    try {
                      const res = await fetch(`https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601?format=json&applicationId=${RAKUTEN_APP_ID}&accessKey=${RAKUTEN_ACCESS_KEY}&keyword=${encodeURIComponent(kw)}&hits=1`);
                      const data = await res.json();
                      const items = data.Items || [];
                      if (items.length > 0) {
                        const item = items[0].Item;
                        const img = (item.mediumImageUrls?.[0]?.imageUrl || '').replace('?_ex=128x128', '?_ex=300x300');
                        let jan = product.jan_code || null;
                        if (!jan && item.itemCaption) {
                          const m = item.itemCaption.match(/JAN[:\s]?(\d{13})/i) || item.itemCaption.match(/(49\d{11}|45\d{11})/);
                          if (m) jan = m[1];
                        }
                        await supabase.from('products').upsert({ jan_code: jan, name: product.product_name, image_url: img, rakuten_price: item.itemPrice, rakuten_url: item.itemUrl, updated_at: new Date().toISOString() }, { onConflict: 'jan_code' });
                        ok++;
                      }
                    } catch { /* skip */ }
                    await new Promise(r => setTimeout(r, 1200));
                  }
                  setAdminStatus(`✅ 完成！${ok}/${toProcess.length} 個商品有圖片`);
                } catch (err: any) {
                  setAdminStatus(`❌ ${err.message}`);
                }
              }}
              className="w-full py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-bold"
            >
              楽天商品圖片同步
            </button>
            {adminStatus && <p className="text-[10px] text-red-300 mt-1">{adminStatus}</p>}
          </div>
        )}

        {/* About & Version */}
        <div className="text-center pb-6">
          <button
            onClick={() => setShowAbout(true)}
            className="mb-3 px-4 py-2 text-sm text-orange-400 hover:text-orange-300 transition-colors"
          >
            關於 GoSavor
          </button>
          <p className="text-xs text-gray-600">GoSavor v0.8.8 Beta</p>
          <p className="text-[10px] text-gray-700 mt-1">Made with 🪿 in Taiwan</p>
        </div>
      </div>

      {/* API Key Guide */}
      {showKeyGuide && (
        <div className="fixed inset-0 z-50 bg-gray-950">
          <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-sm px-4 py-4 flex items-center gap-3 border-b border-gray-800">
            <button onClick={() => setShowKeyGuide(false)} className="p-2 rounded-full hover:bg-gray-800">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 className="font-bold text-lg text-white">{t('settings.keyGuide')}</h1>
          </div>
          <div className="p-4 space-y-6 overflow-y-auto" style={{ height: 'calc(100vh - 64px)' }}>
            {/* Step 1 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center">1</span>
                <h3 className="text-white font-medium">{t('guide.step1Title')}</h3>
              </div>
              <p className="text-gray-400 text-sm ml-9">{t('guide.step1Desc')}</p>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-9 inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl font-medium"
              >
                {t('guide.openStudio')}
              </a>
            </div>

            {/* Step 2 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center">2</span>
                <h3 className="text-white font-medium">{t('guide.step2Title')}</h3>
              </div>
              <p className="text-gray-400 text-sm ml-9">{t('guide.step2Desc')}</p>
            </div>

            {/* Step 3 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center">3</span>
                <h3 className="text-white font-medium">{t('guide.step3Title')}</h3>
              </div>
              <p className="text-gray-400 text-sm ml-9">{t('guide.step3Desc')}</p>
            </div>

            {/* Step 4 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-green-500 text-white text-sm font-bold flex items-center justify-center">4</span>
                <h3 className="text-white font-medium">{t('guide.step4Title')}</h3>
              </div>
              <p className="text-gray-400 text-sm ml-9">{t('guide.step4Desc')}</p>
            </div>

            {/* Info box */}
            <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
              <p className="text-orange-400 text-sm font-medium">{t('guide.freeTitle')}</p>
              <ul className="text-gray-400 text-xs space-y-1">
                <li>- {t('guide.free1')}</li>
                <li>- {t('guide.free2')}</li>
                <li>- {t('guide.free3')}</li>
              </ul>
            </div>

            {/* Done button */}
            <button
              onClick={() => setShowKeyGuide(false)}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold"
            >
              {t('guide.done')}
            </button>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 z-50 bg-gray-950">
          <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-sm px-4 py-4 flex items-center gap-3 border-b border-gray-800">
            <button onClick={() => setShowAbout(false)} className="p-2 rounded-full hover:bg-gray-800">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 className="font-bold text-lg text-white">關於 GoSavor</h1>
          </div>
          <div className="p-4 overflow-y-auto" style={{ height: 'calc(100vh - 64px)' }}>
            <AboutContent />
          </div>
        </div>
      )}

      {/* Legal Content Modal */}
      {showLegal && (
        <div className="fixed inset-0 z-50 bg-gray-950">
          <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-sm px-4 py-4 flex items-center gap-3 border-b border-gray-800">
            <button onClick={() => setShowLegal(null)} className="p-2 rounded-full hover:bg-gray-800">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 className="font-bold text-lg text-white">
              {showLegal === 'privacy' ? '隱私權政策' : '使用條款'}
            </h1>
          </div>
          <div className="p-4 overflow-y-auto" style={{ height: 'calc(100vh - 64px)' }}>
            {showLegal === 'privacy' ? <PrivacyContent /> : <TermsContent />}
          </div>
        </div>
      )}
    </div>
  );
};

const AboutContent = () => (
  <div className="text-sm text-gray-300 space-y-6">
    {/* Logo & Name */}
    <div className="text-center pt-4">
      <img src="/goose-logo.png" alt="GoSavor" className="w-24 h-24 rounded-2xl mx-auto mb-4 shadow-lg" />
      <h2 className="text-2xl font-bold text-white">GoSavor</h2>
      <p className="text-orange-400 font-medium mt-1">購莎鵝 — 日本旅遊 AI 翻譯神器</p>
      <p className="text-xs text-gray-500 mt-2">v0.8.1 Beta</p>
    </div>

    {/* Name meaning */}
    <div className="flex justify-center gap-6 py-4">
      {[
        { en: 'Go', zh: '購', desc: '買買買' },
        { en: 'Sa', zh: '殺', desc: '殺價血拼' },
        { en: 'Vor', zh: '鵝', desc: '又餓又可愛' },
      ].map(p => (
        <div key={p.en} className="text-center">
          <div className="text-2xl font-extrabold text-orange-500">{p.en}</div>
          <div className="text-sm text-gray-400">{p.zh}</div>
          <div className="text-[11px] text-gray-500">{p.desc}</div>
        </div>
      ))}
    </div>

    <p className="text-center text-gray-400 text-sm px-4">
      一隻斯文、懂吃、又幫你買東西的白色小胖鵝 🪿
    </p>

    {/* Features */}
    <div className="space-y-3 pt-2">
      <h3 className="text-base font-bold text-white border-b border-gray-800 pb-1">購莎鵝會什麼？</h3>
      {[
        { icon: '📸', title: '拍菜單・秒翻譯', desc: 'AI 辨識菜名、價格、描述，自動標示 14 種過敏原' },
        { icon: '🧾', title: '掃收據・自動記帳', desc: '辨識商品名稱與價格，即時匯率換算' },
        { icon: '👁️', title: 'AR 即時翻譯', desc: '鏡頭對準藥妝標示，翻譯疊在畫面上（免費無限次）' },
        { icon: '💬', title: '對話翻譯', desc: '中日雙向即時翻譯，支援語音輸入與朗讀' },
        { icon: '💰', title: '藥妝比價', desc: '群眾回報價格，跨店比價不怕買貴' },
        { icon: '💱', title: '匯率換算', desc: '即時日圓匯率，支援 13 種幣別' },
      ].map(f => (
        <div key={f.title} className="flex items-start gap-3 p-3 bg-gray-900/50 rounded-xl">
          <span className="text-xl">{f.icon}</span>
          <div>
            <div className="font-semibold text-white text-sm">{f.title}</div>
            <div className="text-xs text-gray-400 mt-0.5">{f.desc}</div>
          </div>
        </div>
      ))}
    </div>

    {/* Credits */}
    <div className="text-center pt-4 pb-2 space-y-2">
      <p className="text-xs text-gray-500">Made with 🪿 in Taiwan</p>
      <p className="text-xs text-gray-600">© 2026 GoSavor 購莎鵝</p>
      <p className="text-xs text-gray-600">support@gosavor.com</p>
    </div>
  </div>
);

const sectionStyle = "text-sm text-gray-300 space-y-3";
const h2Style = "text-base font-bold text-white mt-6 mb-2 pb-1 border-b border-gray-800";
const h3Style = "text-sm font-semibold text-gray-200 mt-4 mb-1";
const liStyle = "text-sm text-gray-400 ml-4 list-disc";
const highlightStyle = "bg-orange-500/10 border-l-2 border-orange-500 p-3 rounded-r-lg text-sm text-gray-300 my-3";
const warnStyle = "bg-red-500/10 border-l-2 border-red-500 p-3 rounded-r-lg text-sm text-gray-300 my-3";

const PrivacyContent = () => (
  <div className={sectionStyle}>
    <p className="text-xs text-gray-500">Last updated: April 4, 2026</p>
    <p>GoSavor ("the Service") values your privacy. This policy describes how we collect, use, store, and protect your information.</p>

    <h2 className={h2Style}>1. Information We Collect</h2>
    <div className={highlightStyle}>
      <strong>Account registration:</strong> GoSavor requires Email registration or Apple Sign In. We collect your email address for authentication purposes only.
    </div>

    <h3 className={h3Style}>1.1 Automatically Collected</h3>
    <ul>
      <li className={liStyle}>User ID and email — account identification and quota tracking</li>
      <li className={liStyle}>Authentication provider (Email / Apple) — login management</li>
      <li className={liStyle}>Device platform (iOS / PWA) — technical support</li>
      <li className={liStyle}>App version — version management and debugging</li>
      <li className={liStyle}>Daily usage count — quota management</li>
      <li className={liStyle}>Scan events (type and timestamp) — feature analytics</li>
    </ul>

    <h3 className={h3Style}>1.2 Information You Provide</h3>
    <ul>
      <li className={liStyle}>Nickname — personalized display</li>
      <li className={liStyle}>Photos taken or selected — AI translation analysis (temporarily stored in memory only, not retained after analysis)</li>
      <li className={liStyle}>Allergen preferences — allergen labeling during menu translation</li>
      <li className={liStyle}>Gemini API Key (optional) — bring your own API key</li>
      <li className={liStyle}>Feedback and screenshots — service quality improvement</li>
    </ul>

    <h3 className={h3Style}>1.3 Location Information (Authorization Required)</h3>
    <p>Used to display your current city and weather, verify whether you are in Japan, and record receipt location data. You may disable location permissions at any time.</p>

    <h3 className={h3Style}>1.4 Receipt & Price Report Data</h3>
    <p>When you scan receipts, the following information is automatically extracted and anonymously collected for our crowdsourced price comparison service:</p>
    <ul>
      <li className={liStyle}><strong>Collected:</strong> Store name, product names, prices, quantities, JAN codes (barcodes), tax-free status, purchase date</li>
      <li className={liStyle}><strong>NOT collected:</strong> Credit card numbers, cardholder names, or any personal payment information</li>
    </ul>
    <p>This data is de-identified and used solely to provide price comparison services to all users. Individual purchase records cannot be traced back to specific users.</p>

    <h2 className={h2Style}>2. How Your Data Is Used</h2>
    <ul>
      <li className={liStyle}><strong>AI Translation:</strong> Photos are sent to Google Gemini API for analysis, compressed before transmission, and not retained by Google for training purposes</li>
      <li className={liStyle}><strong>Weather & Location:</strong> GPS coordinates are sent to OpenStreetMap (Nominatim) and wttr.in</li>
      <li className={liStyle}><strong>Currency Conversion:</strong> Via public exchange rate API; no personal information is transmitted</li>
      <li className={liStyle}><strong>Travel Recommendations:</strong> Klook and KKday activity links; these platforms may record click sources</li>
      <li className={liStyle}><strong>Usage Analytics:</strong> For service improvement and quota management; not used for advertising</li>
    </ul>

    <h2 className={h2Style}>3. Third-Party Services</h2>
    <ul>
      <li className={liStyle}>Supabase (Tokyo) — data storage</li>
      <li className={liStyle}>Google Gemini API — AI translation</li>
      <li className={liStyle}>Cloudflare Workers — API proxy</li>
      <li className={liStyle}>OpenStreetMap — geocoding</li>
      <li className={liStyle}>wttr.in — weather data</li>
      <li className={liStyle}>Klook, KKday — affiliate recommendations</li>
    </ul>

    <h2 className={h2Style}>4. Data Security</h2>
    <ul>
      <li className={liStyle}>Cloud data stored in Supabase Tokyo datacenter with TLS encryption</li>
      <li className={liStyle}>Row Level Security (RLS) ensures users can only access their own data</li>
      <li className={liStyle}>Photos are temporarily stored in memory only; never permanently uploaded</li>
      <li className={liStyle}>No cookies, no third-party tracking scripts</li>
    </ul>

    <h2 className={h2Style}>5. Your Rights</h2>
    <ul>
      <li className={liStyle}>Modify or clear your nickname and preference settings</li>
      <li className={liStyle}>Disable location and camera permissions</li>
      <li className={liStyle}>Request deletion of all your data (support@gosavor.com)</li>
      <li className={liStyle}>Reset to default to clear all local data</li>
    </ul>

    <h2 className={h2Style}>6. Children's Privacy</h2>
    <p>This Service is not designed for children under 13. We do not knowingly collect personal information from children.</p>

    <h2 className={h2Style}>7. Contact Us</h2>
    <p>Email: support@gosavor.com</p>

    <p className="text-center text-xs text-gray-600 mt-8">© 2026 GoSavor. All rights reserved.</p>
  </div>
);

const TermsContent = () => (
  <div className={sectionStyle}>
    <p className="text-xs text-gray-500">最後更新：2026 年 4 月 3 日</p>
    <p>使用 GoSavor 即表示您同意以下條款。</p>

    <h2 className={h2Style}>一、服務說明</h2>
    <p>GoSavor 是專為日本旅遊設計的 AI 翻譯工具，提供菜單翻譯、收據翻譯、即時翻譯（AR）、對話翻譯、比價功能與匯率轉換。</p>

    <h2 className={h2Style}>二、使用資格</h2>
    <ul>
      <li className={liStyle}>年滿 13 歲方可使用</li>
      <li className={liStyle}>封測期間部分功能需兌換碼開通</li>
    </ul>

    <h2 className={h2Style}>三、方案與費用</h2>
    <h3 className={h3Style}>免費方案</h3>
    <ul>
      <li className={liStyle}>每日 AI 翻譯額度：1 次</li>
      <li className={liStyle}>AR 即時翻譯：無限制（Apple 翻譯框架）</li>
      <li className={liStyle}>對話翻譯：無限制</li>
    </ul>
    <h3 className={h3Style}>付費方案（未來推出）</h3>
    <p>所有付費功能透過 Apple In-App Purchase 進行，退款依照 Apple 政策處理。</p>
    <h3 className={h3Style}>兌換碼</h3>
    <p>僅供免費推廣，不可買賣或轉讓，有使用次數限制與有效期限。</p>

    <h2 className={h2Style}>四、AI 翻譯免責聲明</h2>
    <div className={warnStyle}>
      <strong>重要提醒：</strong>翻譯結果僅供參考，可能存在不準確之處。
    </div>
    <ul>
      <li className={liStyle}>菜單翻譯可能因圖片品質導致辨識錯誤</li>
      <li className={liStyle}>收據金額辨識可能有誤差，以實際收據為準</li>
      <li className={liStyle}><strong>過敏原標示僅為 AI 推測，不能取代向餐廳確認</strong></li>
      <li className={liStyle}>價格比較來自群眾回報，可能不即時或有誤</li>
      <li className={liStyle}>匯率為參考值，以實際兌換匯率為準</li>
    </ul>

    <h2 className={h2Style}>五、使用者行為規範</h2>
    <ul>
      <li className={liStyle}>不得以自動化方式大量存取</li>
      <li className={liStyle}>不得繞過使用額度限制</li>
      <li className={liStyle}>不得提交不實的價格回報</li>
      <li className={liStyle}>不得用於違法目的</li>
    </ul>

    <h2 className={h2Style}>六、價格回報與群眾資料</h2>
    <p>掃描收據時產生的價格資料經去識別化後用於比價服務。我們保留將資料用於統計分析或 B2B 服務的權利。</p>

    <h2 className={h2Style}>七、智慧財產權</h2>
    <ul>
      <li className={liStyle}>GoSavor 商標、Logo（購莎鵝 🪿）歸本服務所有</li>
      <li className={liStyle}>您上傳的照片著作權歸您所有</li>
      <li className={liStyle}>AI 翻譯結果不構成原創著作物</li>
    </ul>

    <h2 className={h2Style}>八、第三方連結</h2>
    <p>本服務包含 Klook 與 KKday 推薦連結，點擊後的交易與本服務無關。我們可能從聯盟行銷獲得佣金。</p>

    <h2 className={h2Style}>九、服務中斷與終止</h2>
    <p>本服務處於封測階段（Beta），可能不穩定。我們保留隨時暫停、修改或終止服務的權利。</p>

    <h2 className={h2Style}>十、責任限制</h2>
    <p>本服務按「現況」提供。對於翻譯錯誤、過敏原標示不正確、價格資訊不準確等造成的損失，本服務不承擔責任。</p>

    <h2 className={h2Style}>十一、準據法</h2>
    <p>本條款受中華民國（台灣）法律管轄，以台灣台中地方法院為第一審管轄法院。</p>

    <h2 className={h2Style}>十二、聯繫我們</h2>
    <p>Email：support@gosavor.com</p>
    <p>LINE 封測群組：購莎鵝 Beta 測試與除錯～許願地</p>

    <p className="text-center text-xs text-gray-600 mt-8">© 2026 GoSavor 購莎鵝 · Made in Taiwan</p>
  </div>
);

export default Settings;
