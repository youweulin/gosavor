import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

interface LiveTranslatePlugin {
  start(options: { targetLang?: string }): Promise<{ success: boolean }>;
  stop(): Promise<{ success: boolean }>;
  isSupported(): Promise<{ supported: boolean }>;
  addListener(event: 'liveTranslateClosed', callback: () => void): Promise<any>;
}

const LiveTranslate = registerPlugin<LiveTranslatePlugin>('LiveTranslate');

export const startLiveTranslate = async (targetLang = 'zh-Hant') => {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Live Translate requires iOS app');
  }
  const { supported } = await LiveTranslate.isSupported();
  if (!supported) {
    throw new Error('Device does not support DataScanner');
  }
  await LiveTranslate.addListener('liveTranslateClosed', () => {
    console.log('[GoSavor] Live Translate closed by user');
  });
  return LiveTranslate.start({ targetLang });
};

export const stopLiveTranslate = async () => {
  return LiveTranslate.stop();
};

export default LiveTranslate;
