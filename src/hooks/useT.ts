import { useMemo } from 'react';
import { getT } from '../i18n';
import { useSettings } from './useSettings';

// Shortcut hook: returns t() function based on current language setting
export const useT = () => {
  const { settings } = useSettings();
  return useMemo(() => getT(settings.targetLanguage), [settings.targetLanguage]);
};
