import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

export interface ARTranslateItem {
  original: string;
  translated: string;
}

export interface ARTranslateResult {
  hasData: boolean;
  imageBase64?: string;
  itemsJSON?: string;
  timestamp?: string;
}

interface LiveTranslatePlugin {
  start(options: { targetLang?: string }): Promise<ARTranslateResult>;
  stop(): Promise<{ success: boolean }>;
  isSupported(): Promise<{ supported: boolean }>;
}

const LiveTranslate = registerPlugin<LiveTranslatePlugin>('LiveTranslate');

/**
 * Open AR Translate camera. Returns result data when user closes.
 * start() resolves ONLY when user taps close — not immediately.
 */
export const startLiveTranslate = async (targetLang = 'zh-Hant'): Promise<{
  items: ARTranslateItem[];
  imageBase64: string;
  timestamp: number;
} | null> => {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('AR Translate requires iOS app');
  }
  const { supported } = await LiveTranslate.isSupported();
  if (!supported) {
    throw new Error('Device does not support DataScanner');
  }

  // This await blocks until user closes the AR view
  const result = await LiveTranslate.start({ targetLang });

  if (!result.hasData) return null;

  let items: ARTranslateItem[] = [];
  if (result.itemsJSON) {
    try { items = JSON.parse(result.itemsJSON); } catch { items = []; }
  }

  return {
    items,
    imageBase64: result.imageBase64 || '',
    timestamp: parseInt(result.timestamp || '0') || Date.now(),
  };
};

export const stopLiveTranslate = async () => {
  return LiveTranslate.stop();
};

export default LiveTranslate;
