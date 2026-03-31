import { useState } from 'react';
import { X, PlayCircle, Users, Minus, Plus, Check } from 'lucide-react';
import type { MenuItem, OrderItem, SplitInfo } from '../types';
import { useT } from '../i18n/context';

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
}: CheckoutProps) => {
  const [mode, setMode] = useState<'review' | 'staff' | 'split'>('review');
  const [splitPersons, setSplitPersons] = useState(2);
  const [paidBy, setPaidBy] = useState('');
  const t = useT();
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
  const [greeting, setGreeting] = useState<'tw' | 'kr' | 'en' | 'none'>('tw');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);

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

  const greetingTexts: Record<string, { intro: string; thanks: string }> = {
    tw: { intro: '台湾から来ました。', thanks: '本当にありがとうございます！とても感謝しています！' },
    kr: { intro: '韓国から来ました。', thanks: '本当にありがとうございます！감사합니다！' },
    en: { intro: 'I came from abroad.', thanks: 'Thank you so much! とても感謝しています！' },
    none: { intro: '', thanks: 'ありがとうございます。' },
  };

  const speakOrder = () => {
    const g = greetingTexts[greeting];
    const itemsText = orderedItems.map(o => `${o.item.originalName}、${o.quantity}つ`).join('。');
    const fullText = `すみません、${g.intro}注文をお願いします。ご注文内容、${itemsText}。以上です。${g.thanks}`;

    const u = new SpeechSynthesisUtterance(fullText);
    u.lang = 'ja-JP';

    // Pick voice by gender preference
    const voices = window.speechSynthesis.getVoices();
    const jpVoices = voices.filter(v => v.lang.startsWith('ja'));

    // Female: Kyoko, O-Ren, Google 日本語 (female default)
    // Male: Otoya, Hattori
    const femaleKeys = ['Kyoko', 'O-Ren', 'Siri', 'Google'];
    const maleKeys = ['Otoya', 'Hattori', 'Takumi'];

    const preferred = voiceGender === 'female' ? femaleKeys : maleKeys;
    const fallback = voiceGender === 'female' ? maleKeys : femaleKeys;

    let voice = null;
    for (const key of preferred) {
      voice = jpVoices.find(v => v.name.includes(key));
      if (voice) break;
    }
    if (!voice) {
      for (const key of fallback) {
        voice = jpVoices.find(v => v.name.includes(key));
        if (voice) break;
      }
    }
    if (!voice && jpVoices.length > 0) voice = jpVoices[0];
    if (voice) u.voice = voice;

    setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  const handleConfirm = () => {
    const split: SplitInfo | undefined = mode === 'split' && splitPersons > 1
      ? { persons: splitPersons, paidBy, perPerson: Math.ceil(total / splitPersons) }
      : undefined;
    onConfirmOrder(orderedItems, total, split);
    setOrderConfirmed(true);
    setTimeout(() => {
      setOrderConfirmed(false);
      onClose();
    }, 1500);
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
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-gray-800">
          {(['review', 'staff', 'split'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                mode === m ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-500'
              }`}
            >
              {m === 'review' ? t('checkout.review') : m === 'staff' ? t('checkout.staff') : t('checkout.split')}
            </button>
          ))}
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
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">{quantity}x</span>
                    <div>
                      {mode === 'staff' ? (
                        <>
                          <p className="font-bold text-base">{item.originalName}</p>
                          <p className="text-xs text-gray-500">{item.translatedName}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium">{item.translatedName}</p>
                          <p className="text-xs text-gray-500">{item.originalName}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(parseFloat(item.price) * quantity)}</p>
                    <p className="text-xs text-gray-500">= {formatPrice(parseFloat(item.price) * quantity)}</p>
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
              <span>{t('checkout.total')}</span>
              <span className="text-orange-400">{formatPrice(total)}</span>
            </div>
          </div>

          {/* Order confirmed toast */}
          {orderConfirmed ? (
            <div className="w-full py-4 bg-green-600 rounded-xl flex items-center justify-center gap-2 font-bold">
              <Check size={20} /> {t('checkout.success')}
            </div>
          ) : mode === 'staff' ? (
            <div className="space-y-3">
              {/* Voice & Greeting settings */}
              <div className="flex gap-2">
                {/* Voice gender */}
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 mb-1">{t('voice.label')}</p>
                  <div className="flex gap-1">
                    {([['female', t('voice.female')], ['male', t('voice.male')]] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setVoiceGender(val)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          voiceGender === val ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Greeting origin */}
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 mb-1">{t('voice.from')}</p>
                  <div className="flex gap-1">
                    {([['tw', '🇹🇼'], ['kr', '🇰🇷'], ['en', '🌍'], ['none', '無']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setGreeting(val)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          greeting === val ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Play button */}
              <button
                onClick={speakOrder}
                disabled={isSpeaking}
                className="w-full py-4 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg"
              >
                {isSpeaking ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('checkout.speaking')}
                  </>
                ) : (
                  <>
                    <PlayCircle size={24} /> {t('checkout.speak')}
                  </>
                )}
              </button>
              <button
                onClick={() => setMode('review')}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-300"
              >
                {t('checkout.back')}
              </button>
            </div>
          ) : mode === 'split' ? (
            <button onClick={handleConfirm} className="w-full py-4 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2">
              <Users size={20} /> {t('checkout.confirmSplit')}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setMode('staff')} className="py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 text-sm">
                <PlayCircle size={18} /> {t('checkout.staff')}
              </button>
              <button onClick={handleConfirm} className="py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold flex items-center justify-center gap-2 text-sm">
                <Check size={18} /> {t('checkout.confirm')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Checkout;
