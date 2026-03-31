import { useState } from 'react';
import { ArrowLeft, Key, Percent, Globe, AlertTriangle, RotateCcw, Eye, EyeOff, Check } from 'lucide-react';
import { TARGET_LANGUAGES, COMMON_ALLERGENS } from '../types';
import type { AppSettings } from '../types';

interface SettingsProps {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
  onReset: () => void;
  onBack: () => void;
}

const Settings = ({ settings, onUpdate, onReset, onBack }: SettingsProps) => {
  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState(settings.geminiApiKey);
  const [keySaved, setKeySaved] = useState(false);
  const keyChanged = keyDraft !== settings.geminiApiKey;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-sm px-4 py-4 flex items-center gap-3 border-b border-gray-800">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-800">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-lg">App Settings</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Gemini API Key */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <Key size={14} /> Gemini API Key
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
              {keySaved ? <><Check size={14} /> 已儲存</> : '儲存 Key'}
            </button>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-400 hover:underline"
            >
              Get a free API Key here
            </a>
          </div>
        </div>

        {/* Price Estimation */}
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
            <Percent size={14} /> Price Estimation Settings
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Tax Rate (%)</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  value={settings.taxRate}
                  onChange={e => onUpdate({ taxRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                />
                <span className="text-gray-400">%</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Service Fee (%)</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  value={settings.serviceFee}
                  onChange={e => onUpdate({ serviceFee: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                />
                <span className="text-gray-400">%</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            These rates will be applied in the final price estimation (e.g. +10% service charge).
          </p>
        </div>

        {/* Language */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <Globe size={14} /> Target Language
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TARGET_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => onUpdate({ targetLanguage: lang.code })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  settings.targetLanguage === lang.code
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-900 text-gray-400 border border-gray-700 hover:border-gray-600'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Allergens */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <AlertTriangle size={14} /> Allergen Settings
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Select your allergens. AI will flag menu items containing these ingredients.
          </p>
          <div className="flex flex-wrap gap-2">
            {COMMON_ALLERGENS.map(allergen => {
              const isActive = settings.allergens.includes(allergen.id);
              return (
                <button
                  key={allergen.id}
                  onClick={() => {
                    const next = isActive
                      ? settings.allergens.filter(a => a !== allergen.id)
                      : [...settings.allergens, allergen.id];
                    onUpdate({ allergens: next });
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                      : 'bg-gray-900 text-gray-400 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {allergen.label} ({allergen.labelJa})
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
            <RotateCcw size={16} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
