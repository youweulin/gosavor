import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

export interface ARTranslateItem {
  original: string;
  translated: string;
  boundingBox?: number[]; // [ymin, xmin, ymax, xmax] 0-1000 scale
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
 * iOS: Apple VisionKit (native AR)
 * PWA: Browser camera → Gemini 3.1-lite OCR + translation
 */
export const startLiveTranslate = async (targetLang = 'zh-Hant'): Promise<{
  items: ARTranslateItem[];
  imageBase64: string;
  timestamp: number;
} | null> => {
  // iOS: use native AR
  if (Capacitor.isNativePlatform()) {
    const { supported } = await LiveTranslate.isSupported();
    if (!supported) {
      throw new Error('Device does not support DataScanner');
    }
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
  }

  // PWA: browser camera → capture → Gemini translate
  return webCameraTranslate(targetLang);
};

/**
 * PWA: Use file input (no camera permission needed) → Gemini OCR + translation
 */
const webCameraTranslate = (targetLang: string): Promise<{
  items: ARTranslateItem[];
  imageBase64: string;
  timestamp: number;
} | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // opens rear camera directly on mobile

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.src = dataUrl;
        await new Promise(r => { img.onload = r; });

        // High quality for display/diary
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = img.width;
        fullCanvas.height = img.height;
        fullCanvas.getContext('2d')?.drawImage(img, 0, 0);
        const fullBase64 = fullCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];

        // Compressed for API
        const apiCanvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        const maxDim = 600;
        if (w > h) { if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; } }
        else { if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; } }
        apiCanvas.width = w; apiCanvas.height = h;
        apiCanvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        const base64 = apiCanvas.toDataURL('image/jpeg', 0.5).split(',')[1];

        try {
          const settings = JSON.parse(localStorage.getItem('gosavor_settings') || '{}');
          const apiKey = settings.geminiApiKey || '';
          let items: ARTranslateItem[] = [];

          const arPrompt = `Detect ALL text regions in this image. Group text by logical blocks (e.g. product name, description, ingredients, manufacturer).
For each text block, translate to ${targetLang}.
Return JSON array with bounding boxes:
[{"original":"日文原文","translated":"${targetLang}翻譯","boundingBox":[ymin,xmin,ymax,xmax]}]
- boundingBox: coordinates in 0-1000 scale relative to image dimensions
- Each block should be a meaningful text group, NOT individual characters
- Separate different sections (title, description, ingredients, etc.) into different items
Only return valid JSON, no markdown.`;

          if (apiKey) {
            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey });
            const res = await ai.models.generateContent({
              model: 'gemini-3.1-flash-lite-preview',
              contents: [
                { inlineData: { mimeType: 'image/jpeg', data: base64 } },
                { text: arPrompt },
              ],
            });
            const text = res.text?.trim() || '[]';
            items = JSON.parse(text.replace(/```\w*\s*/g, '').replace(/```/g, '').trim());
          } else {
            const { callGeminiViaWorker } = await import('./workerProxy');
            const geminiRequest = {
              contents: [{ parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64 } },
                { text: arPrompt },
              ]}],
            };
            const workerResult = await callGeminiViaWorker(geminiRequest, 'ar-translate', 'gemini-3.1-flash-lite-preview');
            const text = workerResult.result?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
            items = JSON.parse(text.replace(/```\w*\s*/g, '').replace(/```/g, '').trim());
          }

          resolve({ items, imageBase64: fullBase64, timestamp: Date.now() });
        } catch (e: any) {
          console.error('[GoSavor] Web AR translate error:', e);
          const msg = e?.message || String(e);
          if (msg.includes('GPS')) alert('系統翻譯僅限日本境內使用。請在設定中輸入自己的 API Key。');
          else if (msg.includes('LIMIT')) alert('今日免費額度已用完。');
          else if (msg.includes('quota')) alert('請在設定中輸入 Gemini API Key 或稍後再試。');
          else alert('翻譯失敗：' + msg.substring(0, 100));
          resolve(null);
        }
      };
      reader.readAsDataURL(file);
    };

    input.oncancel = () => resolve(null);
    input.click();
  });
};

export const stopLiveTranslate = async () => {
  if (Capacitor.isNativePlatform()) {
    return LiveTranslate.stop();
  }
};

/** Native image picker (camera or album) — returns base64 or null if cancelled */
export const pickNativeImage = async (source: 'camera' | 'album'): Promise<string | null> => {
  // iOS: use native plugin
  if (Capacitor.isNativePlatform()) {
    const result = await LiveTranslate.pickImage({ source });
    if (result.cancelled || !result.base64) return null;
    return result.base64;
  }

  // PWA: use file input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1]); // return base64
      };
      reader.readAsDataURL(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
};

export default LiveTranslate;
