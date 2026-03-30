import { useState, useCallback } from 'react';
import { DEFAULT_SETTINGS } from '../types';
import type { AppSettings } from '../types';
import { getSettings, saveSettings } from '../services/storage';

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
    saveSettings({ ...DEFAULT_SETTINGS });
  }, []);

  // Check if user has a valid API key configured
  const hasApiKey = settings.geminiApiKey.length > 0;

  return { settings, updateSettings, resetSettings, hasApiKey };
};
