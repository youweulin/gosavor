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
  pickImage(options: { source: 'camera' | 'album' }): Promise<{ cancelled: boolean; base64?: string }>;
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

/** Native image picker (camera or album) — returns base64 or null if cancelled */
export const pickNativeImage = async (source: 'camera' | 'album'): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) return null;
  const result = await LiveTranslate.pickImage({ source });
  if (result.cancelled || !result.base64) return null;
  return result.base64;
};

export default LiveTranslate;
