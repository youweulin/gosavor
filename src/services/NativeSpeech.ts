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
export const speakText = async (text: string, lang = 'ja-JP', rate = 0.9) => {
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
  // Web fallback: Web Speech API (Chrome, Edge, some Safari)
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    throw new Error('Speech recognition not supported on this browser');
  }

  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event: any) => {
    let text = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      text += event.results[i][0].transcript;
    }
    const isFinal = event.results[event.results.length - 1].isFinal;
    onResult(text, isFinal);
  };

  recognition.onerror = (event: any) => {
    console.warn('[GoSavor] Web Speech error:', event.error);
  };

  recognition.start();
  // Store reference for stopListening
  (window as any).__goSavorRecognition = recognition;
};

export const stopListening = async () => {
  if (Capacitor.isNativePlatform()) {
    await NativeSpeech.stopListening();
  } else {
    // Web fallback: stop recognition
    const recognition = (window as any).__goSavorRecognition;
    if (recognition) {
      recognition.stop();
      (window as any).__goSavorRecognition = null;
    }
  }
};

// Helper: translate using Apple first, fallback to Gemini
export const translateJapanese = async (
  text: string,
  targetLang = 'zh-Hant',
  apiKey?: string
): Promise<string> => {
  // Try Apple Translate first (free, fast, offline on real device)
  // Note: doesn't work on Simulator, falls back to Gemini
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeSpeech.translate({ text, from: 'ja', to: targetLang });
      if (res.translated && res.engine === 'apple') {
        console.log('[GoSavor] ✅ Apple Translate:', text.substring(0, 20), '→', res.translated.substring(0, 20));
        return res.translated;
      }
      console.log('[GoSavor] Apple Translate returned:', res.engine);
    } catch (e) {
      console.warn('[GoSavor] Apple Translate error (fallback to Gemini):', e);
    }
  }

  // Fallback: Gemini
  if (apiKey) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: `Translate Japanese to ${targetLang}. Return ONLY the translation:\n${text}`,
        config: { thinkingConfig: { thinkingBudget: 0 } },
      });
      return res.text?.trim() || '';
    } catch { /* ignore */ }
  }

  return '（翻譯失敗）';
};

export default NativeSpeech;
