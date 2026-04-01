import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

export interface NativeSpeechPlugin {
  speak(options: { text: string; lang?: string; rate?: number; pitch?: number }): Promise<{ success: boolean }>;
  startListening(options: { lang?: string }): Promise<{ success: boolean }>;
  stopListening(): Promise<{ success: boolean }>;
  getVoices(options: { lang?: string }): Promise<{ voices: { name: string; lang: string; quality: string }[] }>;
  translate(options: { text: string; from?: string; to?: string }): Promise<{ translated: string; engine: string }>;
  addListener(event: 'speechResult', callback: (data: { text: string; isFinal: boolean }) => void): Promise<any>;
}

const NativeSpeech = registerPlugin<NativeSpeechPlugin>('NativeSpeech');

// Helper: speak with fallback to Web Speech API
export const speakText = async (text: string, lang = 'ja-JP', rate = 0.45) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeSpeech.speak({ text, lang, rate });
      return;
    } catch (e) {
      console.warn('[GoSavor] Native speak failed, using Web fallback:', e);
    }
  }
  // Web fallback
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const voices = window.speechSynthesis.getVoices();
  const jpVoices = voices.filter(v => v.lang.startsWith(lang.substring(0, 2)));
  const femalePrefer = ['Kyoko', 'O-Ren', 'Google 日本語', 'Siri', 'Nanami'];
  let voice = null;
  for (const key of femalePrefer) {
    voice = jpVoices.find(v => v.name.includes(key));
    if (voice) break;
  }
  if (!voice && jpVoices.length > 0) voice = jpVoices[0];
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
};

// Helper: listen with callback
export const startListening = async (
  lang = 'ja-JP',
  onResult: (text: string, isFinal: boolean) => void
) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeSpeech.addListener('speechResult', (data) => {
        onResult(data.text, data.isFinal);
      });
      await NativeSpeech.startListening({ lang });
      return;
    } catch (e) {
      console.warn('[GoSavor] Native listen failed:', e);
    }
  }
  // No web fallback for speech recognition (requires native)
  throw new Error('Speech recognition requires iOS app');
};

export const stopListening = async () => {
  if (Capacitor.isNativePlatform()) {
    await NativeSpeech.stopListening();
  }
};

// Helper: translate using Apple first, fallback to Gemini
export const translateJapanese = async (
  text: string,
  targetLang = 'zh-Hant',
  apiKey?: string
): Promise<string> => {
  // Use Gemini for translation (Apple Translate causes system popup that blocks UI)
  if (apiKey) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate Japanese to ${targetLang}. Return ONLY the translation:\n${text}`,
        config: { thinkingConfig: { thinkingBudget: 0 } },
      });
      return res.text?.trim() || '';
    } catch { /* ignore */ }
  }

  return '（翻譯失敗）';
};

export default NativeSpeech;
