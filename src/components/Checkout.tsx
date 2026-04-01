import { useState, useEffect } from 'react';
import { X, PlayCircle, Users, Minus, Plus, Check, Mic, MicOff, MessageCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { MenuItem, OrderItem, SplitInfo } from '../types';
import { useT } from '../i18n/context';
import { fetchRates, getCurrencyCode } from './CurrencyBar';
import { speakText, startListening, stopListening, translateJapanese } from '../services/NativeSpeech';

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
}: CheckoutProps) => {
  const [mode, setMode] = useState<'review' | 'staff' | 'split'>('review');
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
  const [isListening, setIsListening] = useState(false);
  const [staffSaid, setStaffSaid] = useState('');
  const [staffTranslated, setStaffTranslated] = useState('');
  const [chatLog, setChatLog] = useState<{ role: 'you' | 'staff'; ja: string; translated: string }[]>([]);
  const [miniTranslateInput, setMiniTranslateInput] = useState('');
  const [miniTranslateResult, setMiniTranslateResult] = useState<{ original: string; ja: string } | null>(null);
  const [isMiniTranslating, setIsMiniTranslating] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  const [isSpeakingToStaff, setIsSpeakingToStaff] = useState(false);

  const handleClose = () => {
    setMode('review');
    setOrderConfirmed(false);
    setIsSpeaking(false);
    setIsListening(false);
    setStaffSaid('');
    setStaffTranslated('');
    setChatLog([]);
    setIsSpeakingToStaff(false);
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
      await speakText(orderText, 'ja-JP', 0.45);
      // Add to chat log
      setChatLog(prev => [...prev, { role: 'you', ja: orderText, translated: '（你的點餐內容）' }]);
    } catch { /* ignore */ }
    setTimeout(() => setIsSpeaking(false), 2000);
  };

  // Speak custom text (for replies)
  const speakCustom = async (text: string) => {
    setIsSpeaking(true);
    try {
      await speakText(text, 'ja-JP', 0.45);
    } catch { /* ignore */ }
    setTimeout(() => setIsSpeaking(false), 1500);
  };

  // Translate: Apple first (instant offline) → Gemini fallback
  const translateText = async (jaText: string): Promise<string> => {
    if (!jaText.trim()) return '';
    // Map target language to Apple locale code
    const langMap: Record<string, string> = {
      '繁體中文': 'zh-Hant', '简体中文': 'zh-Hans', 'English': 'en',
      '한국어': 'ko', 'ภาษาไทย': 'th', 'Tiếng Việt': 'vi',
      'Français': 'fr', 'Español': 'es', 'Deutsch': 'de',
    };
    const targetCode = langMap[targetLanguage] || 'zh-Hant';
    return translateJapanese(jaText, targetCode, apiKey);
  };

  // Mini translator: user language → Japanese
  const handleMiniTranslate = async () => {
    const text = miniTranslateInput.trim();
    if (!text || isMiniTranslating) return;
    setIsMiniTranslating(true);
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate to Japanese. Only return the translation: "${text}"`,
        config: { thinkingConfig: { thinkingBudget: 0 } },
      });
      const ja = res.text?.trim() || text;
      setMiniTranslateResult({ original: text, ja });
      setMiniTranslateInput('');
    } catch {
      setMiniTranslateResult({ original: text, ja: '(翻譯失敗)' });
    } finally {
      setIsMiniTranslating(false);
    }
  };

  // Listen to staff speaking Japanese
  const lastHeardRef = { current: '' };

  const toggleListening = async () => {
    if (isListening) {
      await stopListening();
      setIsListening(false);
      // Translate the last heard text
      const finalText = lastHeardRef.current;
      if (finalText.trim()) {
        const translated = await translateText(finalText);
        setStaffTranslated(translated);
        setChatLog(prev => [...prev, { role: 'staff' as const, ja: finalText, translated }]);
        // Increment chat count for trip stats
        const count = parseInt(localStorage.getItem('gosavor_chat_count') || '0');
        localStorage.setItem('gosavor_chat_count', String(count + 1));
      }
      return;
    }
    setStaffSaid('');
    setStaffTranslated('');
    lastHeardRef.current = '';
    setIsListening(true);
    try {
      await startListening('ja-JP', (text, _isFinal) => {
        if (text.trim()) {
          setStaffSaid(text);
          lastHeardRef.current = text;
        }
      });
    } catch {
      setIsListening(false);
    }
  };

  // "I want to say" — listen user's language, translate to Japanese, speak
  const userLangMap: Record<string, string> = {
    '繁體中文': 'zh-TW', '简体中文': 'zh-CN', 'English': 'en-US',
    '한국어': 'ko-KR', 'ภาษาไทย': 'th-TH', 'Tiếng Việt': 'vi-VN',
    'Français': 'fr-FR', 'Español': 'es-ES', 'Deutsch': 'de-DE',
  };
  const userLangCode = userLangMap[targetLanguage] || 'zh-TW';

  const handleSpeakToStaff = async () => {
    if (isSpeakingToStaff) {
      await stopListening();
      setIsSpeakingToStaff(false);
      return;
    }
    setIsSpeakingToStaff(true);
    try {
      await startListening(userLangCode, async (text, isFinal) => {
        if (isFinal && text.trim()) {
          setIsSpeakingToStaff(false);
          // Translate user's language → Japanese
          const appleToLang: Record<string, string> = {
            'zh-TW': 'zh-Hant', 'zh-CN': 'zh-Hans', 'en-US': 'en',
            'ko-KR': 'ko', 'th-TH': 'th', 'vi-VN': 'vi',
            'fr-FR': 'fr', 'es-ES': 'es', 'de-DE': 'de',
          };
          const fromCode = appleToLang[userLangCode] || 'zh-Hant';
          let translated = '';
          if (Capacitor.isNativePlatform()) {
            try {
              const { default: NS } = await import('../services/NativeSpeech');
              const res = await NS.translate({ text, from: fromCode, to: 'ja' });
              if (res.translated && res.engine === 'apple') translated = res.translated;
            } catch { /* fallback below */ }
          }
          if (!translated && apiKey) {
            try {
              const { GoogleGenAI } = await import('@google/genai');
              const ai = new GoogleGenAI({ apiKey });
              const res = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Translate to natural Japanese. Return ONLY Japanese:\n${text}`,
                config: { thinkingConfig: { thinkingBudget: 0 } },
              });
              translated = res.text?.trim() || '';
            } catch { /* ignore */ }
          }
          if (translated) {
            // Speak the Japanese translation
            await speakText(translated, 'ja-JP', 0.45);
            setChatLog(prev => [...prev, { role: 'you', ja: translated, translated: text }]);
          }
        }
      });
    } catch {
      setIsSpeakingToStaff(false);
    }
  };

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

              {/* Listen to staff */}
              {isNative && (
                <div className="space-y-2">
                  <button
                    onClick={toggleListening}
                    className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                      isListening
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                  >
                    {isListening ? (
                      <><MicOff size={20} /> 停止聆聽</>
                    ) : (
                      <><Mic size={20} /> 🎤 聽店員說話</>
                    )}
                  </button>
                  {staffSaid && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                      <p className="text-xs text-blue-400 mb-1">🇯🇵 店員說：</p>
                      <p className="text-sm font-bold text-white">{staffSaid}</p>
                      {staffTranslated && (
                        <p className="text-sm text-orange-300 mt-1">→ {staffTranslated}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* I want to say — speak your language, auto translate to Japanese */}
              {isNative && (
                <button
                  onClick={handleSpeakToStaff}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    isSpeakingToStaff
                      ? 'bg-green-500 hover:bg-green-600 animate-pulse'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {isSpeakingToStaff ? (
                    <><MicOff size={20} /> 停止</>
                  ) : (
                    <><MessageCircle size={20} /> 🗣 我要說（{targetLanguage}→日語）</>
                  )}
                </button>
              )}

              {/* Mini translator — type and see translation */}
              <div className="bg-gray-800 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={miniTranslateInput}
                    onChange={e => setMiniTranslateInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleMiniTranslate()}
                    placeholder="輸入想說的話..."
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-xl text-sm text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    onClick={handleMiniTranslate}
                    disabled={!miniTranslateInput.trim() || isMiniTranslating}
                    className="px-3 py-2 bg-orange-500 rounded-xl text-white text-sm font-bold disabled:opacity-30"
                  >
                    {isMiniTranslating ? '...' : '翻譯'}
                  </button>
                </div>
                {miniTranslateResult && (
                  <div className="p-2.5 bg-gray-700/50 rounded-lg">
                    <p className="text-sm font-bold text-orange-400">{miniTranslateResult.original}</p>
                    <p className="text-base font-bold text-white mt-1">→ {miniTranslateResult.ja}</p>
                    <button
                      onClick={() => { speakCustom(miniTranslateResult.ja); setChatLog(prev => [...prev, { role: 'you', ja: miniTranslateResult.ja, translated: miniTranslateResult.original }]); }}
                      className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                    >
                      <PlayCircle size={14} /> 播放日語
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
