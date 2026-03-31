import { useState, useEffect } from 'react';
import { ArrowLeft, Key, Globe, AlertTriangle, RotateCcw, Eye, EyeOff, Check, Coins, ArrowLeftRight } from 'lucide-react';
import { TARGET_LANGUAGES, COMMON_ALLERGEN_IDS, HOME_CURRENCIES } from '../types';
import { fetchRates, getCurrencyCode } from './CurrencyBar';
import type { AppSettings } from '../types';
import { useT } from '../i18n/context';

interface SettingsProps {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
  onReset: () => void;
  onBack: () => void;
}

const Settings = ({ settings, onUpdate, onReset, onBack }: SettingsProps) => {
  const t = useT();
  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState(settings.geminiApiKey);
  const [keySaved, setKeySaved] = useState(false);
  const keyChanged = keyDraft !== settings.geminiApiKey;
  const [rate, setRate] = useState<number | null>(null);
  const [rateTime, setRateTime] = useState<string>('');

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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-sm px-4 py-4 flex items-center gap-3 border-b border-gray-800">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-800">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-lg">{t('settings.title')}</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Gemini API Key */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <Key size={14} /> {t('settings.apiKey')}
          </label>
          <div className="relative">
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
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => { onUpdate({ geminiApiKey: keyDraft }); setKeySaved(true); setTimeout(() => setKeySaved(false), 2000); }}
              disabled={!keyChanged}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-all ${
                keySaved
                  ? 'bg-green-600 text-white'
                  : keyChanged
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              {keySaved ? <><Check size={14} /> {t('settings.saved')}</> : t('settings.saveKey')}
            </button>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-400 hover:underline"
            >
              {t('settings.getKey')}
            </a>
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <Globe size={14} /> {t('settings.language')}
          </label>
          {(() => {
            const selected = TARGET_LANGUAGES.find(l => l.code === settings.targetLanguage);
            return (
              <select
                value={settings.targetLanguage}
                onChange={e => onUpdate({ targetLanguage: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-orange-500 focus:outline-none appearance-none text-base"
              >
                {TARGET_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.flag} {lang.label}</option>
                ))}
              </select>
            );
          })()}
          <p className="text-xs text-gray-500 mt-1">
            AI 翻譯菜單和收據時使用此語言。已根據你的瀏覽器自動偵測。
          </p>
        </div>

        {/* Home Currency */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <Coins size={14} /> {t('settings.currency')}
          </label>
          <p className="text-xs text-gray-500 mb-2">
            {t('settings.currencyHint')}
          </p>
          <select
            value={settings.homeCurrency}
            onChange={e => onUpdate({ homeCurrency: e.target.value })}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-orange-500 focus:outline-none appearance-none"
          >
            {HOME_CURRENCIES.map(curr => (
              <option key={curr.code} value={curr.code}>{curr.symbol} {curr.label}</option>
            ))}
          </select>
          {rate && (
            <div className="mt-2 p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <ArrowLeftRight size={14} className="text-orange-400" />
                <span className="text-gray-300">
                  1 JPY ≈ {rate.toFixed(4)} {settings.homeCurrency}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-1">
                <span className="text-gray-300">
                  ¥1,000 ≈ {Math.round(1000 * rate).toLocaleString()} {settings.homeCurrency}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                來源：Currency API · 更新於 {rateTime}
              </p>
            </div>
          )}
        </div>

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

        {/* Actions */}
        <div className="pt-4 space-y-3">
          <button
            onClick={onReset}
            className="w-full py-3 bg-gray-900 border border-gray-700 hover:bg-gray-800 rounded-xl font-medium flex items-center justify-center gap-2 text-gray-400"
          >
            <RotateCcw size={16} /> {t('settings.reset')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
