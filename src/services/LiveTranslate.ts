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
 * PWA: Open browser camera, capture photo, send to Gemini for OCR + translation
 */
const webCameraTranslate = (targetLang: string): Promise<{
  items: ARTranslateItem[];
  imageBase64: string;
  timestamp: number;
} | null> => {
  return new Promise((resolve) => {
    // Create fullscreen camera overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000;display:flex;flex-direction:column;';

    const video = document.createElement('video');
    video.style.cssText = 'flex:1;object-fit:cover;';
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');

    // Top bar with close button
    const topBar = document.createElement('div');
    topBar.style.cssText = 'position:absolute;top:0;left:0;right:0;padding:16px;display:flex;justify-content:space-between;align-items:center;z-index:2;';
    topBar.innerHTML = `
      <button id="ar-close" style="width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.5);color:white;border:none;font-size:20px;cursor:pointer;">✕</button>
      <span style="color:white;font-size:14px;background:rgba(0,0,0,0.5);padding:4px 12px;border-radius:12px;">對準文字拍照翻譯</span>
    `;

    // Bottom bar with capture button
    const bottomBar = document.createElement('div');
    bottomBar.style.cssText = 'position:absolute;bottom:0;left:0;right:0;padding:32px;display:flex;justify-content:center;z-index:2;';
    bottomBar.innerHTML = `
      <button id="ar-capture" style="width:72px;height:72px;border-radius:50%;background:white;border:4px solid rgba(255,255,255,0.5);cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,0.3);"></button>
    `;

    // Loading overlay (hidden initially)
    const loadingOverlay = document.createElement('div');
    loadingOverlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.7);display:none;justify-content:center;align-items:center;z-index:3;';
    loadingOverlay.innerHTML = `<div style="text-align:center;color:white;"><div style="font-size:32px;margin-bottom:12px;">🪿</div><div style="font-size:16px;">購莎鵝翻譯中...</div></div>`;

    overlay.appendChild(video);
    overlay.appendChild(topBar);
    overlay.appendChild(bottomBar);
    overlay.appendChild(loadingOverlay);
    document.body.appendChild(overlay);

    let stream: MediaStream | null = null;

    const cleanup = () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      overlay.remove();
    };

    // Close button
    overlay.querySelector('#ar-close')?.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    // Capture button
    overlay.querySelector('#ar-capture')?.addEventListener('click', async () => {
      if (!video.videoWidth) return;

      // Capture HIGH quality frame for display/diary
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = video.videoWidth;
      fullCanvas.height = video.videoHeight;
      fullCanvas.getContext('2d')?.drawImage(video, 0, 0);
      const fullBase64 = fullCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];

      // Capture compressed frame for API (save tokens)
      const apiCanvas = document.createElement('canvas');
      const maxDim = 600;
      let w = video.videoWidth, h = video.videoHeight;
      if (w > h) { if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; } }
      else { if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; } }
      apiCanvas.width = w;
      apiCanvas.height = h;
      apiCanvas.getContext('2d')?.drawImage(video, 0, 0, w, h);
      const base64 = apiCanvas.toDataURL('image/jpeg', 0.5).split(',')[1];

      // Show loading
      loadingOverlay.style.display = 'flex';
      (overlay.querySelector('#ar-capture') as HTMLElement).style.display = 'none';

      try {
        // Send to Gemini for OCR + translation
        const { GoogleGenAI } = await import('@google/genai');
        const settings = JSON.parse(localStorage.getItem('gosavor_settings') || '{}');
        const apiKey = settings.geminiApiKey || '';

        // Try own key first, then worker proxy
        let items: ARTranslateItem[] = [];

        if (apiKey) {
          const ai = new GoogleGenAI({ apiKey });
          const res = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: [
              { inlineData: { mimeType: 'image/jpeg', data: base64 } },
              { text: `Detect ALL text in this image. For each text block, translate to ${targetLang}.
Return JSON array: [{"original":"detected text","translated":"translation"}]
Only return valid JSON, no markdown.` },
            ],
          });
          const text = res.text?.trim() || '[]';
          const clean = text.replace(/```\w*\s*/g, '').replace(/```/g, '').trim();
          items = JSON.parse(clean);
        } else {
          // Use worker proxy
          const { callGeminiViaWorker } = await import('./workerProxy');
          const geminiRequest = {
            contents: [{ parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64 } },
              { text: `Detect ALL text in this image. For each text block, translate to ${targetLang}.
Return JSON array: [{"original":"detected text","translated":"translation"}]
Only return valid JSON, no markdown.` },
            ]}],
          };
          const workerResult = await callGeminiViaWorker(geminiRequest, 'ar-translate', 'gemini-3.1-flash-lite-preview');
          const text = workerResult.result?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
          const clean = text.replace(/```\w*\s*/g, '').replace(/```/g, '').trim();
          items = JSON.parse(clean);
        }

        cleanup();
        resolve({
          items,
          imageBase64: fullBase64,
          timestamp: Date.now(),
        });
      } catch (e: any) {
        console.error('[GoSavor] Web AR translate error:', e);
        const msg = e?.message || String(e);
        // Show error to user so they know what happened
        if (msg.includes('GPS')) {
          alert('系統翻譯僅限日本境內使用。請在設定中輸入自己的 API Key。');
        } else if (msg.includes('LIMIT')) {
          alert('今日免費額度已用完。');
        } else if (msg.includes('NO_KEY') || msg.includes('quota')) {
          alert('請在設定中輸入 Gemini API Key 或稍後再試。');
        } else {
          alert('翻譯失敗：' + msg.substring(0, 100));
        }
        cleanup();
        resolve(null);
      }
    });

    // Start camera — fallback to file picker if camera not available
    navigator.mediaDevices?.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    }).then(s => {
      stream = s;
      video.srcObject = s;
    }).catch(() => {
      // Camera not available → fallback to file input (camera/album)
      cleanup();
      webFilePickerTranslate(targetLang).then(resolve);
    });
  });
};

/**
 * Fallback: use file input to pick/take a photo, then send to Gemini for translation
 */
const webFilePickerTranslate = (targetLang: string): Promise<{
  items: ARTranslateItem[];
  imageBase64: string;
  timestamp: number;
} | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // prefer rear camera on mobile

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
        const resizedBase64 = apiCanvas.toDataURL('image/jpeg', 0.5).split(',')[1];

        try {
          const settings = JSON.parse(localStorage.getItem('gosavor_settings') || '{}');
          const apiKey = settings.geminiApiKey || '';
          let items: ARTranslateItem[] = [];
          const prompt = `Detect ALL text in this image. For each text block, translate to ${targetLang}.\nReturn JSON array: [{"original":"detected text","translated":"translation"}]\nOnly return valid JSON, no markdown.`;

          if (apiKey) {
            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey });
            const res = await ai.models.generateContent({
              model: 'gemini-3.1-flash-lite-preview',
              contents: [
                { inlineData: { mimeType: 'image/jpeg', data: resizedBase64 } },
                { text: prompt },
              ],
            });
            const text = res.text?.trim() || '[]';
            items = JSON.parse(text.replace(/```\w*\s*/g, '').replace(/```/g, '').trim());
          } else {
            const { callGeminiViaWorker } = await import('./workerProxy');
            const geminiRequest = {
              contents: [{ parts: [
                { inlineData: { mimeType: 'image/jpeg', data: resizedBase64 } },
                { text: prompt },
              ]}],
            };
            const workerResult = await callGeminiViaWorker(geminiRequest, 'ar-translate', 'gemini-3.1-flash-lite-preview');
            const text = workerResult.result?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
            items = JSON.parse(text.replace(/```\w*\s*/g, '').replace(/```/g, '').trim());
          }

          resolve({ items, imageBase64: fullBase64, timestamp: Date.now() });
        } catch (e) {
          console.error('[GoSavor] File picker translate error:', e);
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
