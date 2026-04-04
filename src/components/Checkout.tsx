import { useState, useEffect } from 'react';
import { X, PlayCircle, Users, Minus, Plus, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { MenuItem, OrderItem, SplitInfo } from '../types';
import { useT } from '../i18n/context';
import { fetchRates, getCurrencyCode } from './CurrencyBar';
import { speakText } from '../services/NativeSpeech';
import { registerPlugin } from '@capacitor/core';
const NativeSpeechPlugin = registerPlugin<any>('NativeSpeech');

interface CheckoutProps {
  isVisible: boolean;
  onClose: () => void;
  items: MenuItem[];
  quantities: Record<number, number>;
  currency: string;
  restaurantName: string;
  taxRate: number;
  serviceFee: number;
  onConfirmOrder: (items: OrderItem[], total: number, split?: SplitInfo) => void;
  apiKey?: string;
  targetLanguage?: string;
  homeCurrency: string;
  onOpenChat?: () => void;
  initialMode?: 'review' | 'staff' | 'split';
}

const Checkout = ({
  isVisible,
  onClose,
  items,
  quantities,
  currency,
  restaurantName,
  taxRate,
  serviceFee,
  onConfirmOrder,
  homeCurrency,
  apiKey,
  targetLanguage = '繁體中文',
  onOpenChat,
  initialMode = 'review',
}: CheckoutProps) => {
  const [mode, setMode] = useState<'review' | 'staff' | 'split'>(initialMode);
  const [splitPersons, setSplitPersons] = useState(2);
  const [paidBy, setPaidBy] = useState('');
  const t = useT();
  const [showConvert, setShowConvert] = useState(false);
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    const code = getCurrencyCode(currency).toLowerCase();
    const home = homeCurrency.toLowerCase();
    if (code !== home) {
      fetchRates(code).then(rates => { if (rates[home]) setRate(rates[home]); });
    }
  }, [currency, homeCurrency]);

  const convert = (amount: number) => {
    if (!rate) return '';
    const c = amount * rate;
    const small = ['USD', 'EUR', 'GBP', 'SGD', 'AUD', 'MYR', 'HKD'].includes(homeCurrency);
    return small ? c.toFixed(2) : Math.round(c).toLocaleString();
  };
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [chatLog, setChatLog] = useState<{ role: 'you' | 'staff'; ja: string; translated: string }[]>([]);
  const [miniTranslateInput, setMiniTranslateInput] = useState('');
  const [miniTranslateResult, setMiniTranslateResult] = useState<{ original: string; ja: string } | null>(null);
  const [isMiniTranslating, setIsMiniTranslating] = useState(false);

  const handleClose = () => {
    setMode('review');
    setOrderConfirmed(false);
    setIsSpeaking(false);
    setChatLog([]);
    onClose();
  };

  if (!isVisible) return null;

  const orderedItems: OrderItem[] = items
    .map((item, index) => ({ item, quantity: quantities[index] || 0, index }))
    .filter(x => x.quantity > 0);

  const subtotal = orderedItems.reduce((acc, { item, quantity }) => {
    return acc + (parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0) * quantity;
  }, 0);

  const taxAmount = subtotal * (taxRate / 100);
  const feeAmount = subtotal * (serviceFee / 100);
  const total = subtotal + taxAmount + feeAmount;
  const totalQty = orderedItems.reduce((acc, o) => acc + o.quantity, 0);

  const formatPrice = (amount: number) => {
    const val = Math.round(amount);
    if (['¥', '$', '€'].includes(currency)) return `${currency}${val}`;
    return `${val} ${currency}`;
  };

  // Build the Japanese order text — 品名を數量お願いします
  const orderText = (() => {
    const counter = (n: number) => {
      const counters: Record<number, string> = { 1: '一つ', 2: '二つ', 3: '三つ', 4: '四つ', 5: '五つ', 6: '六つ', 7: '七つ', 8: '八つ', 9: '九つ', 10: '十' };
      return counters[n] || `${n}つ`;
    };
    const itemsText = orderedItems.map(o => `${o.item.originalName}を${counter(o.quantity)}`).join('、');
    return `すみません、注文をお願いします。${itemsText}、以上でお願いします。`;
  })();

  // Speak using native voice (iOS) or web fallback
  const speakOrder = async () => {
    setIsSpeaking(true);
    try {
      await speakText(orderText, 'ja-JP');
      // Add to chat log
      setChatLog(prev => [...prev, { role: 'you', ja: orderText, translated: '（你的點餐內容）' }]);
    } catch { /* ignore */ }
    setTimeout(() => setIsSpeaking(false), 2000);
  };

  // Speak custom text (for replies)
  const speakCustom = async (text: string) => {
    setIsSpeaking(true);
    try {
      await speakText(text, 'ja-JP');
    } catch { /* ignore */ }
    setTimeout(() => setIsSpeaking(false), 1500);
  };

  // Mini translator: auto-detect → translate
  const handleMiniTranslate = async () => {
    const text = miniTranslateInput.trim();
    if (!text || isMiniTranslating) return;
    setIsMiniTranslating(true);
    try {
      // Detect if input is Japanese (has hiragana/katakana/kanji)
      const hasKana = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);

      let translated = '';

      // Try Apple Translate with 5s timeout
      if (Capacitor.isNativePlatform()) {
        try {
          const fromLang = hasKana ? 'ja' : 'zh-Hant';
          const toLang = hasKana ? 'zh-Hant' : 'ja';
          const appleResult = await Promise.race([
            NativeSpeechPlugin.translate({ text, from: fromLang, to: toLang }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ]);
          if (appleResult?.translated && appleResult?.engine === 'apple') {
            translated = appleResult.translated;
            console.log('[GoSavor] ✅ Apple Translate in checkout:', text.substring(0, 15), '→', translated.substring(0, 15));
          }
        } catch { /* fallback below */ }
      }

      // Gemini fallback
      if (!translated && apiKey) {
        const targetLang = hasKana ? targetLanguage : 'Japanese';
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: `Translate to ${targetLang}. Only return the translation, nothing else: "${text}"`,
          config: { thinkingConfig: { thinkingBudget: 0 } },
        });
        translated = res.text?.trim() || '';
        console.log('[GoSavor] Gemini fallback in checkout');
      }
      setMiniTranslateResult({ original: text, ja: translated || '(翻譯失敗)' });
      setMiniTranslateInput('');
    } catch {
      setMiniTranslateResult({ original: text, ja: '(翻譯失敗)' });
    } finally {
      setIsMiniTranslating(false);
    }
  };

  // Listen to staff speaking Japanese

  const handleConfirm = () => {
    const split: SplitInfo | undefined = mode === 'split' && splitPersons > 1
      ? { persons: splitPersons, paidBy, perPerson: Math.ceil(total / splitPersons) }
      : undefined;
    onConfirmOrder(orderedItems, total, split);
    setOrderConfirmed(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-950 w-full sm:max-w-md h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="px-5 py-4 flex justify-between items-center border-b border-gray-800">
          <div>
            <h3 className="font-bold text-lg">{t('checkout.title')}</h3>
            <p className="text-xs text-gray-400">
              {restaurantName || 'Restaurant'} &middot; {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-2 border-b border-gray-800 text-xs text-gray-500">
          <span className={mode === 'review' ? 'text-orange-400 font-bold' : orderConfirmed ? 'text-green-500' : ''}>{t('checkout.review')}</span>
          <span>→</span>
          <span className={mode === 'staff' ? 'text-orange-400 font-bold' : orderConfirmed ? 'text-green-500' : ''}>{t('checkout.staff')}</span>
          {orderConfirmed && (
            <>
              <span>→</span>
              <span className={mode === 'split' ? 'text-orange-400 font-bold' : 'text-green-500'}>✓</span>
            </>
          )}
          {mode === 'split' && (
            <>
              <span>→</span>
              <span className="text-orange-400 font-bold">{t('checkout.split')}</span>
            </>
          )}
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {mode === 'split' ? (
            <div className="space-y-6 py-4">
              {/* Who paid */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider">{t('checkout.whoPaid')}</label>
                <input
                  value={paidBy}
                  onChange={e => setPaidBy(e.target.value)}
                  placeholder="姓名"
                  className="mt-2 w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
              {/* Split calculator */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider">Split Calculator</label>
                <div className="mt-2 flex items-center justify-center gap-6">
                  <button
                    onClick={() => setSplitPersons(Math.max(2, splitPersons - 1))}
                    className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center hover:bg-gray-700"
                  >
                    <Minus size={20} />
                  </button>
                  <div className="text-center">
                    <p className="text-3xl font-bold">{splitPersons}</p>
                    <p className="text-xs text-gray-400">{t('checkout.persons')}</p>
                  </div>
                  <button
                    onClick={() => setSplitPersons(splitPersons + 1)}
                    className="w-12 h-12 bg-red-900/60 rounded-xl flex items-center justify-center hover:bg-red-800/60"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="mt-4 p-4 bg-gray-900 rounded-xl text-center">
                  <p className="text-xs text-gray-400">{t('checkout.perPerson')}</p>
                  <p className="text-2xl font-bold text-orange-400">
                    {formatPrice(Math.ceil(total / splitPersons))}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {orderedItems.map(({ item, quantity, index }) => (
                <div key={index} className="flex items-center justify-between py-3 border-b border-gray-800/50">
                  <div className="flex-1 min-w-0">
                    {mode === 'staff' ? (
                      <>
                        <p className="font-bold text-xl">{item.originalName} <span className="text-orange-400">× {quantity}</span></p>
                        <p className="text-sm text-gray-400">{item.translatedName}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-base">{item.translatedName} <span className="text-gray-400">× {quantity}</span></p>
                        <p className="text-xs text-gray-500">{item.originalName}</p>
                      </>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-bold">{formatPrice(parseFloat(item.price) * quantity)}</p>
                    {quantity > 1 && <p className="text-xs text-gray-500">@{formatPrice(parseFloat(item.price))}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 space-y-3">
          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>{t('checkout.subtotal')} ({totalQty} 項)</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>{t('checkout.tax')} ({taxRate}%)</span>
                <span>{formatPrice(taxAmount)}</span>
              </div>
            )}
            {serviceFee > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>{t('checkout.serviceFee')} ({serviceFee}%)</span>
                <span>{formatPrice(feeAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-1 border-t border-gray-700">
              <div className="flex items-center gap-2">
                <span>{t('checkout.total')}</span>
                {rate && (
                  <button
                    onClick={() => setShowConvert(!showConvert)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${showConvert ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-700 text-gray-400'}`}
                  >
                    {homeCurrency}
                  </button>
                )}
              </div>
              <div className="text-right">
                <span className="text-orange-400">{formatPrice(total)}</span>
                {showConvert && rate && (
                  <p className="text-sm font-bold text-orange-300">≈ {convert(total)} {homeCurrency}</p>
                )}
              </div>
            </div>
          </div>

          {orderConfirmed && mode !== 'split' ? (
            /* Order confirmed → show split option or close */
            <div className="space-y-3">
              <div className="w-full py-3 bg-green-600/20 border border-green-600 rounded-xl flex items-center justify-center gap-2 font-bold text-green-400">
                <Check size={20} /> {t('checkout.success')}
              </div>
              <button onClick={handleClose} className="w-full py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg">
                <Check size={20} /> 完成
              </button>
              <button
                onClick={() => setMode('split')}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1"
              >
                <Users size={14} /> {t('checkout.split')}
              </button>
            </div>
          ) : mode === 'split' ? (
            /* Split bill — only after order confirmed */
            <div className="space-y-2">
              <button onClick={handleClose} className="w-full py-4 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2">
                <Check size={20} /> {t('checkout.confirmSplit')}
              </button>
              <button onClick={() => setMode(orderConfirmed ? 'staff' : 'review')} className="w-full py-2 text-sm text-gray-500">{t('checkout.back')}</button>
            </div>
          ) : mode === 'staff' ? (
            /* Staff mode — speak, listen, chat with staff */
            <div className="space-y-3">
              {/* Order text */}
              <div className="p-3 bg-gray-900 rounded-xl text-center">
                <p className="text-sm font-bold text-white leading-relaxed">{orderText}</p>
              </div>

              {/* Play order button */}
              <button
                onClick={speakOrder}
                disabled={isSpeaking}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                {isSpeaking ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('checkout.speaking')}
                  </>
                ) : (
                  <><PlayCircle size={20} /> {t('checkout.speak')}</>
                )}
              </button>

              {/* Chat log */}
              {chatLog.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1.5 px-1">
                  {chatLog.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'you' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-3 py-1.5 rounded-xl text-xs ${
                        msg.role === 'you'
                          ? 'bg-orange-500/20 text-orange-300'
                          : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        <p className="font-medium">{msg.ja}</p>
                        {msg.translated && <p className="text-[10px] opacity-70 mt-0.5">{msg.translated}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick translate — type text, auto detect & translate */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={miniTranslateInput}
                    onChange={e => setMiniTranslateInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleMiniTranslate()}
                    placeholder="輸入中文或日文，自動翻譯..."
                    className="flex-1 px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    onClick={handleMiniTranslate}
                    disabled={!miniTranslateInput.trim() || isMiniTranslating}
                    className="px-4 py-3 bg-orange-500 rounded-xl text-white font-bold disabled:opacity-30"
                  >
                    {isMiniTranslating ? '...' : '翻譯'}
                  </button>
                  {onOpenChat && (
                    <button
                      onClick={onOpenChat}
                      className="px-3 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-white"
                      title="對話翻譯"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </button>
                  )}
                </div>
                {miniTranslateResult && (
                  <div className="p-3 bg-gray-800 rounded-xl flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-orange-400">{miniTranslateResult.original}</p>
                      <p className="text-xl font-black text-white mt-1">→ {miniTranslateResult.ja}</p>
                    </div>
                    <button
                      onClick={() => speakCustom(miniTranslateResult.ja)}
                      className="shrink-0 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center hover:bg-orange-600 mt-2"
                    >
                      <PlayCircle size={22} className="text-white" />
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode('review')} className="py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-400 font-medium">
                  {t('checkout.back')}
                </button>
                <button onClick={handleConfirm} className="py-2 bg-green-600 hover:bg-green-700 rounded-xl text-sm text-white font-bold flex items-center justify-center gap-1">
                  <Check size={16} /> {t('checkout.confirm')}
                </button>
              </div>
            </div>
          ) : (
            /* Review mode — confirm goes to staff mode */
            <div className="space-y-2">
              <button onClick={() => setMode('staff')} className="w-full py-4 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg">
                <Check size={20} /> {t('checkout.confirm')}
              </button>
              <button onClick={handleClose} className="w-full py-2 text-sm text-gray-500 hover:text-gray-300">
                {t('checkout.back')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Checkout;
