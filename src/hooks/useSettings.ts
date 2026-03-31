import { useState, useCallback } from 'react';
import { DEFAULT_SETTINGS } from '../types';
import type { AppSettings } from '../types';
import { getSettings, saveSettings } from '../services/storage';
import { SUPPORTED_LANGUAGES } from '../i18n';

// Detect browser language and map to supported language
const detectLanguage = (): string => {
  const browserLang = navigator.language || 'en';
  // Exact match first
  const exact = SUPPORTED_LANGUAGES.find(l => l.code === browserLang);
  if (exact) return exact.code;
  // Prefix match: "zh" → zh-TW, "fr-CA" → fr, "es-MX" → es
  const prefix = browserLang.split('-')[0];
  const prefixMatch = SUPPORTED_LANGUAGES.find(l => l.code.startsWith(prefix));
  if (prefixMatch) return prefixMatch.code;
  return 'en';
};

// Map language code → default currency
const LANG_TO_CURRENCY: Record<string, string> = {
  'zh-TW': 'TWD', 'zh-CN': 'CNY', 'en': 'USD',
  'ko': 'KRW', 'th': 'THB', 'vi': 'VND', 'id': 'IDR',
  'fr': 'EUR', 'es': 'EUR', 'de': 'EUR',
};

// Detect home currency from browser language
const detectCurrency = (): string => {
  const lang = navigator.language || '';
  const map: Record<string, string> = {
    ...LANG_TO_CURRENCY,
    'zh-HK': 'HKD', 'zh': 'TWD',
    'en-US': 'USD', 'en-AU': 'AUD', 'en-GB': 'GBP', 'en-SG': 'SGD', 'ms': 'MYR',
  };
  return map[lang] || map[lang.split('-')[0]] || 'TWD';
};

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = getSettings();
    // If never saved before (fresh user), auto-detect
    if (!saved.targetLanguage || saved.targetLanguage === DEFAULT_SETTINGS.targetLanguage) {
      const detected = detectLanguage();
      const currency = detectCurrency();
      if (detected !== DEFAULT_SETTINGS.targetLanguage || currency !== DEFAULT_SETTINGS.homeCurrency) {
        const auto = { ...saved, targetLanguage: detected, homeCurrency: currency };
        saveSettings(auto);
        return auto;
      }
    }
    return saved;
  });

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      // Auto-switch currency when language changes
      if (partial.targetLanguage && !partial.homeCurrency) {
        const autoCurrency = LANG_TO_CURRENCY[partial.targetLanguage];
        if (autoCurrency) {
          next.homeCurrency = autoCurrency;
        }
      }
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
    saveSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const hasApiKey = settings.geminiApiKey.length > 0;

  return { settings, updateSettings, resetSettings, hasApiKey };
};
