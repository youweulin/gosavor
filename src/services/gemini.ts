import { GoogleGenAI, Type } from '@google/genai';
import { Capacitor } from '@capacitor/core';
import VisionOCR from './VisionOCR';
import { callGeminiViaWorker, isWorkerAvailable, type UsageInfo } from './workerProxy';
import type { MenuAnalysisResult, ReceiptAnalysisResult, GeneralAnalysisResult } from '../types';

// Track last usage info from Worker (for UI display)
let _lastUsageInfo: UsageInfo | null = null;
export const getLastUsageInfo = () => _lastUsageInfo;
export const clearUsageInfo = () => { _lastUsageInfo = null; };

// Shared: Run Apple Vision OCR on images, returns text blocks with bounding boxes
const runNativeOCR = async (images: { base64: string; mimeType: string }[]): Promise<{
  blocks: { id: number; imageIndex: number; text: string; box: number[] }[];
} | null> => {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    let blockId = 0;
    const blocks: { id: number; imageIndex: number; text: string; box: number[] }[] = [];
    for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
      const ocrRes = await VisionOCR.analyzeImage({ base64str: images[imgIdx].base64 });
      ocrRes.results.forEach(res => {
        blocks.push({
          id: blockId++,
          imageIndex: imgIdx,
          text: res.text,
          box: [
            res.boundingBox.y * 1000,
            res.boundingBox.x * 1000,
            (res.boundingBox.y + res.boundingBox.height) * 1000,
            (res.boundingBox.x + res.boundingBox.width) * 1000,
          ],
        });
      });
    }
    return blocks.length > 0 ? { blocks } : null;
  } catch (e) {
    console.warn('[GoSavor OCR] Native failed:', e);
    return null;
  }
};

// Scan mode context for Worker routing
let _currentScanMode = 'general';
export const setScanMode = (mode: string) => { _currentScanMode = mode; };

/**
 * Smart AI client: has key → real SDK, no key → Worker proxy object.
 * Returns same interface so all analyze functions work unchanged.
 */
const getAI = (apiKey: string) => {
  // Has own key → use real SDK (direct, no limits)
  if (apiKey) {
    return new GoogleGenAI({ apiKey });
  }

  // No key → return proxy that routes through Worker
  if (!isWorkerAvailable()) {
    throw new Error('NO_KEY:請設定 API Key 或等待系統服務上線');
  }

  return {
    models: {
      generateContent: async (params: any) => {
        const parts = params.contents?.parts || [];
        const config = params.config || {};
        const model = params.model || 'gemini-3.1-flash-lite-preview';

        const geminiRequest: any = {
          contents: [{ parts }],
          generationConfig: {
            temperature: 0,
            thinkingConfig: { thinkingBudget: 0 }, // 不要花時間思考，直接回答
          },
        };
        if (config.responseMimeType) geminiRequest.generationConfig.responseMimeType = config.responseMimeType;
        if (config.responseSchema) geminiRequest.generationConfig.responseSchema = config.responseSchema;

        const workerResult = await callGeminiViaWorker(geminiRequest, _currentScanMode, model);
        _lastUsageInfo = workerResult.usage;

        const text = workerResult.result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { text };
      },
    },
  };
};

const safeParseJSON = <T>(text: string): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    let clean = text.replace(/```\w*\s*/g, '').replace(/```/g, '').trim();
    const firstOpen = Math.min(
      ...[clean.indexOf('{'), clean.indexOf('[')].filter(i => i !== -1)
    );
    const lastClose = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'));
    if (firstOpen !== -1 && lastClose > firstOpen) {
      clean = clean.substring(firstOpen, lastClose + 1);
    }
    return JSON.parse(clean) as T;
  }
};

const resizeImage = (base64Str: string, maxDim = 600, quality = 0.5): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${base64Str}`;
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h) {
        if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
      } else {
        if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
    };
  });
};

export const analyzeMenuImage = async (
  images: { base64: string; mimeType: string }[],
  targetLanguage: string,
  apiKey: string,
  allergens: string[] = [],
  modelName = 'gemini-3.1-flash-lite-preview'
): Promise<MenuAnalysisResult> => {

  const ai = getAI(apiKey);
  const allergenPart = allergens.length > 0
    ? `\nUser allergens: [${allergens.join(',')}]. For each item, return matching allergen IDs in "allergens" array.`
    : '';

  // === STRATEGY: Skip Native OCR, always use Gemini Vision ===
  // Apple Vision OCR struggles with vertical Japanese text (縦書き) and mixed layouts.
  // Gemini Vision handles both horizontal and vertical menus accurately.
  // Native OCR is still used in AR mode (LiveTranslatePlugin) for speed.
  let ocrSource = 'Cloud';
  if (false && Capacitor.isNativePlatform()) { // Disabled: Gemini Vision is more reliable
    try {
      ocrSource = 'Native';
      let blockIdCounter = 0;
      const ocrBlocks: any[] = [];
      for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
        // Use the original high-res base64 for native OCR
        const ocrRes = await VisionOCR.analyzeImage({ base64str: images[imgIdx].base64 });
        ocrRes.results.forEach(res => {
          const ymin = res.boundingBox.y * 1000;
          const xmin = res.boundingBox.x * 1000;
          const ymax = (res.boundingBox.y + res.boundingBox.height) * 1000;
          const xmax = (res.boundingBox.x + res.boundingBox.width) * 1000;
          ocrBlocks.push({
            id: blockIdCounter++,
            imageIndex: imgIdx,
            text: res.text,
            box: [ymin, xmin, ymax, xmax],
            confidence: res.confidence ?? 1,
          });
        });
      }

      // Detect vertical text (縦書き) failure: Apple Vision fragments vertical text
      // into single characters instead of reading columns as words.
      const singleCharBlocks = ocrBlocks.filter(b => b.text.length <= 1).length;
      const singleCharRatio = ocrBlocks.length > 0 ? singleCharBlocks / ocrBlocks.length : 1;
      const totalChars = ocrBlocks.reduce((sum, b) => sum + b.text.length, 0);
      const avgCharsPerBlock = ocrBlocks.length > 0 ? totalChars / ocrBlocks.length : 0;
      const avgConfidence = ocrBlocks.length > 0
        ? ocrBlocks.reduce((sum, b) => sum + b.confidence, 0) / ocrBlocks.length : 0;
      // Count blocks with low confidence (<0.5) — even if a few blocks (like titles) read well,
      // many low-confidence blocks means Apple Vision is struggling with the text layout
      const lowConfBlocks = ocrBlocks.filter(b => b.confidence < 0.5).length;
      const lowConfRatio = ocrBlocks.length > 0 ? lowConfBlocks / ocrBlocks.length : 1;
      const isVerticalTextFailure = ocrBlocks.length === 0 ||
        singleCharRatio > 0.5 ||
        (avgCharsPerBlock < 2.0 && ocrBlocks.length >= 5) ||
        avgConfidence < 0.5 ||
        lowConfRatio > 0.3; // >30% of blocks have low confidence

      if (isVerticalTextFailure) {
        console.warn(`[GoSavor OCR] Vertical text detected (avg=${avgCharsPerBlock.toFixed(1)}, single=${(singleCharRatio*100).toFixed(0)}%, conf=${avgConfidence.toFixed(2)}, lowConf=${(lowConfRatio*100).toFixed(0)}%) → falling back to Gemini Vision`);
      }

      if (!isVerticalTextFailure && ocrBlocks.length >= 3) {
        // OCR quality is good — use OCR text + Gemini for translation
        // Menu always uses 2.5-flash for accurate sourceIds/bounding box matching
        // Fallback chain: gemini-2.5-flash → modelName (if 2.5 quota exceeded)
        const preferredModel = 'gemini-2.5-flash';
        let effectiveModel = preferredModel;
        // We have OCR blocks! Send text exclusively to Gemini
        const textToAnalyze = ocrBlocks.map(b => ({ id: b.id, imgIdx: b.imageIndex, text: b.text }));

        const prompt = `You are a menu parser. Below is raw OCR data extracted from ${images.length} menu image(s) using Apple Vision.
Each block has: id (unique integer), imgIdx (image index), text (raw recognized text).

OCR Blocks:
${JSON.stringify(textToAnalyze)}

Your task: identify each MENU ITEM (a dish + its price), translate to ${targetLanguage}, and return structured data.

STEP 1 — Classify each block:
- DISH NAME: a food item name (usually Japanese kanji/kana or short text)
- PRICE: contains digits and/or ¥ or ￥ symbol (e.g. "¥90", "130", "￥430")
- IGNORE: headers, page numbers, store names, decorative text, bullet points, numbered prefixes (①②③ etc.)

STEP 2 — Pair each DISH NAME block with its nearest PRICE block.
IMPORTANT: Japanese menus can be written VERTICALLY (縦書き/tategaki) or horizontally.
- For HORIZONTAL menus: pair dish name with price on the same horizontal line.
- For VERTICAL menus: text reads top-to-bottom, columns go right-to-left. Pair dish name with price in the same column or adjacent column. Look at the IMAGE to determine layout direction.

STEP 3 — For each paired menu item output:
- originalName: the dish name text as-is
- translatedName: natural translation to ${targetLanguage}
- description: 1-2 sentences describing the dish in ${targetLanguage}. Include key ingredients, cooking method, and taste. Use your food knowledge even if not visible in OCR text. MUST NOT be empty.
- price: digits only (e.g. "90")
- category: a category name in ${targetLanguage} (e.g. 炸物→Fried Foods, 定食→Set Meals). Infer from context.
- sourceIds: [dish_name_block_id, price_block_id] — these are the id values from the OCR blocks above
- imageIndex: imgIdx of the source blocks${allergenPart}

STEP 4 — Cultural & Hidden Fee Detection:
- Scan for "お通し" (Otoshi), "席料" (Seat charge), or "サービス料" (Service charge). 
- If found, include them as regular items but add a "⚠️" prefix to the translatedName.
- In the "description", explain what it is (e.g., "Standard Japanese table charge includes a small appetizer").
- If the menu looks HANDWRITTEN (手話き/tategaki/messy), use your visual understanding to infer names even if OCR text is fragmented.

STEP 5 — Also return:
- currency (use ¥ for JPY)
- restaurantName (if visible in blocks, else empty string). IMPORTANT: restaurantName should be EXACTLY what is in the menu. Do NOT append anything.
- layoutDirection: "vertical" if the menu uses vertical Japanese writing (縦書き/tategaki, columns read top-to-bottom, right-to-left), "horizontal" if text reads left-to-right in rows. Look at the IMAGE to determine this.
- izakayaAlert: If the menu contains many snacks, alcohol, or mentions Otoshi, provide a 1-sentence friendly reminder about Izakaya culture in ${targetLanguage}.`;

        // Send tiny thumbnails (200px) so AI can see the menu for better descriptions
        const thumbs = await Promise.all(
          images.map(async (img) => ({
            inlineData: { mimeType: 'image/jpeg', data: await resizeImage(img.base64, 200) }
          }))
        );

        const menuConfig = {
          temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              currency: { type: Type.STRING },
              restaurantName: { type: Type.STRING },
              layoutDirection: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    originalName: { type: Type.STRING },
                    translatedName: { type: Type.STRING },
                    description: { type: Type.STRING },
                    price: { type: Type.STRING },
                    category: { type: Type.STRING },
                    allergens: { type: Type.ARRAY, items: { type: Type.STRING } },
                    sourceIds: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                    imageIndex: { type: Type.INTEGER },
                  },
                  required: ['originalName', 'translatedName', 'price', 'category', 'sourceIds'],
                },
              },
            },
            required: ['currency', 'items', 'layoutDirection'],
          },
        };

        let response;
        try {
          response = await ai.models.generateContent({
            model: effectiveModel,
            contents: { parts: [...thumbs, { text: prompt }] },
            config: menuConfig,
          });
        } catch (err: any) {
          // If 2.5-flash quota exceeded (429) or unavailable (503), fallback to 3.1-lite
          const errStr = JSON.stringify(err) + (err?.message || '') + (err?.status || '');
          if (effectiveModel === 'gemini-2.5-flash' && (errStr.includes('429') || errStr.includes('503') || errStr.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED'))) {
            effectiveModel = modelName; // fallback to default model
            response = await ai.models.generateContent({
              model: effectiveModel,
              contents: { parts: [...thumbs, { text: prompt }] },
              config: menuConfig,
            });
          } else {
            throw err;
          }
        }

        if (!response.text) throw new Error('No response from AI');
        const parsed = safeParseJSON<any>(response.text);
        
        // Keep restaurant name clean (no prefix tags)
        parsed.restaurantName = (parsed.restaurantName || '').trim();
        
        // Post-process: Calculate bounding boxes from sourceIds
        parsed.items = parsed.items.map((item: any) => {
          let ymin = 1000, xmin = 1000, ymax = 0, xmax = 0;
          const matchedBlocks: any[] = [];

          if (item.sourceIds && item.sourceIds.length > 0) {
            item.sourceIds.forEach((sid: number) => {
              const block = ocrBlocks.find(b => b.id === sid);
              if (block) matchedBlocks.push(block);
            });
          }

          if (matchedBlocks.length > 0) {
            // Full vertical union across all blocks (correct row height)
            matchedBlocks.forEach(block => {
              if (block.box[0] < ymin) ymin = block.box[0];
              if (block.box[2] > ymax) ymax = block.box[2];
            });

            // For X: find the block most likely to be the actual dish name.
            // Filter: 1) Skip price blocks. 2) Prefer blocks that overlap with originalName. 
            // 3) Skip VERY short blocks (likely label stickers like 인기No.1).
            const isPriceBlock = (text: string) => /^[¥￥]?\s*\d[\d,]*\s*円?$/.test(text.trim());
            const charOverlap = (a: string, b: string) =>
              [...b].filter(c => a.includes(c)).length / Math.max(b.length, 1);

            // Filter out price blocks and tiny prefix snippets
            const nameBlocks = matchedBlocks.filter(b => !isPriceBlock(b.text));
            
            // Heuristic: Prefer blocks longer than 2 characters for positioning if possible
            const substantialBlocks = nameBlocks.filter(b => b.text.length > 2);
            const candidates = substantialBlocks.length > 0 ? substantialBlocks : nameBlocks;

            const positionBlock = candidates.length > 0
              ? candidates.reduce((best, block) =>
                  charOverlap(block.text, item.originalName) >= charOverlap(best.text, item.originalName)
                    ? block : best
                , candidates[0])
              : matchedBlocks[0];

            xmin = positionBlock.box[1];
            xmax = positionBlock.box[3];
          }

          // Fallback box for UI to recognize (it's big enough to pass hasBox test)
          if (matchedBlocks.length === 0) {
            const nameBlock = ocrBlocks.find(
              b => b.imageIndex === (item.imageIndex ?? 0) &&
              (b.text.includes(item.originalName) || item.originalName.includes(b.text))
            );
            if (nameBlock) {
              [ymin, xmin, ymax, xmax] = nameBlock.box;
            } else {
              // Better distributed fallback if nothing matched (e.g. top of the page)
              ymin = 50; xmin = 50; ymax = 100; xmax = 250;
            }
          }

          return {
            ...item,
            boundingBox: [ymin, xmin, ymax, xmax],
            sourceIds: undefined // Clean up
          };
        });

        return {
          ...parsed,
          ocrDebug: {
            source: ocrSource,
            blocks: ocrBlocks,
            rawResponse: response.text
          }
        } as MenuAnalysisResult;
      }
    } catch (e) {
      console.warn("Native OCR failed, falling back to Gemini Vision:", e);
    }
  }

  // === STRATEGY: Fallback to Gemini Vision (Web / PWA) ===
  // PWA menu needs larger images (800px/70%) for accurate bounding box positions
  const pwaResized = await Promise.all(
    images.map(async (img) => ({
      base64: await resizeImage(img.base64, 800, 0.7),
      mimeType: 'image/jpeg',
    }))
  );
  const imageCount = pwaResized.length;
  const prompt = `You are a precise menu translator. Analyze ${imageCount} menu image(s). Output in ${targetLanguage}.

For EACH menu item found, return:
- originalName: item name in original language (exactly as written)
- translatedName: natural translation in ${targetLanguage}
- description: 1 sentence explaining the dish in ${targetLanguage}. MUST NOT be empty.
- price: number only (e.g. "630"), no currency symbol
- category: in ${targetLanguage}
- boundingBox: [ymin, xmin, ymax, xmax] in 0-1000 scale.
  CRITICAL RULES for boundingBox:
  1. Each box MUST precisely cover ONLY that item's text (name + price) on the image
  2. Each item MUST have a DIFFERENT position — NO overlapping or clustered boxes
  3. ymin < ymax, xmin < xmax (top-left to bottom-right)
  4. Items at the TOP of menu → small ymin (~0-200). Items at BOTTOM → large ymin (~700-1000)
  5. Items on LEFT side → small xmin (~0-300). Items on RIGHT → large xmin (~600-1000)
  6. Box height should be ~30-80 (tight around text), NOT covering the entire menu
  7. VERTICAL menus (縦書き): text reads top-to-bottom, columns right-to-left. Adjust bounding boxes accordingly — each column is a separate item area
- imageIndex: which image (0-based) this item appears in.${allergenPart}

Cultural & Hidden Fee Detection:
- Scan for "お通し" (Otoshi), "席料" (Seat charge), or "サービス料" (Service charge).
- If found, include them as regular items but add a "⚠️" prefix to the translatedName.
- In the "description", explain what it is (e.g., "Standard Japanese table charge includes a small appetizer").

Also return:
- currency (use ¥ for JPY)
- restaurantName (exactly as written on the menu, no prefix or tags)
- layoutDirection: "vertical" if the menu uses vertical Japanese writing (縦書き), "horizontal" if text reads left-to-right in rows.`;

  const imageParts = pwaResized.map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.base64 },
  }));

  // PWA menu: try 2.5-flash first, fallback to 3.1-lite if quota exceeded
  const pwaMenuConfig = {
    temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
    responseMimeType: 'application/json' as const,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        currency: { type: Type.STRING },
        restaurantName: { type: Type.STRING },
        layoutDirection: { type: Type.STRING },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalName: { type: Type.STRING },
              translatedName: { type: Type.STRING },
              description: { type: Type.STRING },
              price: { type: Type.STRING },
              category: { type: Type.STRING },
              allergens: { type: Type.ARRAY, items: { type: Type.STRING } },
              boundingBox: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              imageIndex: { type: Type.INTEGER },
            },
            required: ['originalName', 'translatedName', 'price', 'category', 'boundingBox', 'imageIndex'],
          },
        },
      },
      required: ['currency', 'items', 'layoutDirection'],
    },
  };

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [...imageParts, { text: prompt }] },
      config: pwaMenuConfig,
    });
  } catch (err: any) {
    const errStr = String(err?.message || '') + JSON.stringify(err);
    if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
      response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: [...imageParts, { text: prompt }] },
        config: pwaMenuConfig,
      });
    } else {
      throw err;
    }
  }

  if (!response.text) throw new Error('No response from AI');
  const result = safeParseJSON<MenuAnalysisResult>(response.text);

  // Auto-fix bounding box scale: if all values < 100, assume 0-100 scale → multiply by 10
  if (result.items?.length > 0) {
    const allBoxes = result.items.filter((it: any) => it.boundingBox?.length === 4).map((it: any) => it.boundingBox);
    if (allBoxes.length > 0) {
      const maxVal = Math.max(...allBoxes.flat());
      if (maxVal <= 100) {
        // Scale 0-100 → 0-1000
        result.items = result.items.map((it: any) => ({
          ...it,
          boundingBox: it.boundingBox?.map((v: number) => v * 10),
        }));
      } else if (maxVal <= 1) {
        // Scale 0-1 → 0-1000
        result.items = result.items.map((it: any) => ({
          ...it,
          boundingBox: it.boundingBox?.map((v: number) => Math.round(v * 1000)),
        }));
      }
    }
  }

  return {
    ...result,
    ocrDebug: {
      source: 'Cloud (Fallback)',
      blocks: [],
      rawResponse: response.text
    }
  };
};

// === Receipt Analysis ===
export const analyzeReceiptImage = async (
  images: { base64: string; mimeType: string }[],
  targetLanguage: string,
  apiKey: string,
  modelName = 'gemini-3.1-flash-lite-preview'
): Promise<ReceiptAnalysisResult> => {
  const ai = getAI(apiKey);

  // Try Native OCR first
  const native = await runNativeOCR(images);
  if (native) {
    const textBlocks = native.blocks.map(b => ({ id: b.id, text: b.text }));
    const thumb = await resizeImage(images[0].base64, 200);

    const prompt = `Receipt scanner. Below is OCR data from a receipt. Translate ALL to ${targetLanguage}.

OCR Blocks:
${JSON.stringify(textBlocks)}

Parse this receipt:
- merchantName: store name (keep original, INCLUDE branch e.g. "ココカラファイン 銀座4丁目店")
- date, currency (use ¥ for JPY), totalAmount, tax, serviceCharge
- isTaxFree: check for 免税/Tax Free
- items: each purchased item with:
  - originalName: product name as on receipt
  - translatedName: translated to ${targetLanguage} (NOT English)
  - quantity: number of items (e.g. "4")
  - price: LINE TOTAL price (quantity × unit price). Example: if unit price is ¥5,980 and qty is 4, price should be "23920" NOT "5980"
  - janCode: the barcode number (JAN/EAN code, usually 13 digits starting with 49 or 45) found below/near each product name. Example: "4987123145428". If not found, leave empty string.
  - sourceIds: [block_id(s)] — OCR block IDs for this item
IMPORTANT: price = total for that line, NOT unit price. Check the receipt carefully for ¥XX,XXX非 amounts.`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: thumb } }, { text: prompt }] },
      config: {
        temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchantName: { type: Type.STRING },
            date: { type: Type.STRING },
            currency: { type: Type.STRING },
            totalAmount: { type: Type.STRING },
            tax: { type: Type.STRING },
            serviceCharge: { type: Type.STRING },
            isTaxFree: { type: Type.BOOLEAN },
            totalQuantity: { type: Type.INTEGER },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  originalName: { type: Type.STRING },
                  translatedName: { type: Type.STRING },
                  quantity: { type: Type.STRING },
                  price: { type: Type.STRING },
                  janCode: { type: Type.STRING },
                  sourceIds: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                },
                required: ['originalName', 'translatedName', 'price'],
              },
            },
          },
          required: ['merchantName', 'totalAmount', 'items', 'currency'],
        },
      },
    });

    if (!response.text) throw new Error('No response from AI');
    const parsed = safeParseJSON<any>(response.text);

    // Map sourceIds to bounding boxes
    parsed.items = parsed.items.map((item: any) => {
      if (item.sourceIds?.length > 0) {
        let ymin = 1000, xmin = 1000, ymax = 0, xmax = 0;
        item.sourceIds.forEach((sid: number) => {
          const block = native.blocks.find(b => b.id === sid);
          if (block) {
            ymin = Math.min(ymin, block.box[0]);
            xmin = Math.min(xmin, block.box[1]);
            ymax = Math.max(ymax, block.box[2]);
            xmax = Math.max(xmax, block.box[3]);
          }
        });
        return { ...item, boundingBox: [ymin, xmin, ymax, xmax], sourceIds: undefined };
      }
      return { ...item, sourceIds: undefined };
    });

    return parsed as ReceiptAnalysisResult;
  }

  // Fallback: Cloud (Gemini Vision)
  const resized = await Promise.all(images.map(async (img) => ({
    base64: await resizeImage(img.base64),
    mimeType: 'image/jpeg',
  })));

  const prompt = `Receipt scanner and translator. ALL translations MUST be in ${targetLanguage}.
For each item:
- originalName: text as seen on receipt (original language)
- translatedName: MUST translate to ${targetLanguage}. Example: "アリナミンEXプラス" → "合利他命EX Plus" (not English).
- quantity: number of items (e.g. "4")
- price: LINE TOTAL (qty × unit price). If ¥5,980 × 4, price="23920" NOT "5980"
- janCode: barcode number (JAN/EAN, 13 digits, starts with 49/45) found near each product. Empty string if not found.
- boundingBox: [ymin,xmin,ymax,xmax] in 0-1000 coords
Also extract: merchantName (keep original, INCLUDE branch name), date, currency (use ¥ for JPY), totalAmount, tax, serviceCharge, isTaxFree, totalQuantity.`;

  const imageParts = resized.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [...imageParts, { text: prompt }] },
    config: {
      temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          merchantName: { type: Type.STRING },
          date: { type: Type.STRING },
          currency: { type: Type.STRING },
          totalAmount: { type: Type.STRING },
          tax: { type: Type.STRING },
          serviceCharge: { type: Type.STRING },
          isTaxFree: { type: Type.BOOLEAN },
          totalQuantity: { type: Type.INTEGER },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalName: { type: Type.STRING },
                translatedName: { type: Type.STRING },
                quantity: { type: Type.STRING },
                price: { type: Type.STRING },
                janCode: { type: Type.STRING },
                boundingBox: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              },
              required: ['originalName', 'translatedName', 'price'],
            },
          },
        },
        required: ['merchantName', 'totalAmount', 'items', 'currency'],
      },
    },
  });
  if (!response.text) throw new Error('No response from AI');
  return safeParseJSON<ReceiptAnalysisResult>(response.text);
};

// === General / Sign / Fortune Translation ===
export const analyzeGeneralImage = async (
  images: { base64: string; mimeType: string }[],
  targetLanguage: string,
  apiKey: string,
  modelName = 'gemini-3.1-flash-lite-preview'
): Promise<GeneralAnalysisResult> => {
  const ai = getAI(apiKey);

  // Try Native OCR first — send OCR text + small image for context
  const native = await runNativeOCR(images);
  const thumb = await resizeImage(images[0].base64, 300); // slightly larger for signs/fortune
  const ocrContext = native
    ? `\n\nApple Vision OCR detected text:\n${native.blocks.map(b => b.text).join('\n')}\n`
    : '';

  const prompt = `Smart travel translator. Analyze image. ALL output in ${targetLanguage}.${ocrContext}

IMPORTANT: Detect the type of content first.

If FORTUNE SLIP (おみくじ/籤詩/御神籤):
- Return as a SINGLE item (do NOT split into multiple items!)
- translatedText: ONLY the overall fortune level (e.g. "大吉", "中吉", "小吉", "末吉", "凶"). This is the MAIN TITLE.
- originalText: the COMPLETE original text, with line breaks between sections
- category: "Fortune"
- explanation: Write in ${targetLanguage}, use this EXACT format:

  📜 [Translate the poetic story/verse at the top of the fortune into ${targetLanguage}. Keep it literary and mystical, like ancient poetry. 2-3 sentences.]

  ---

  ✦ 願望（Wish）：[interpretation]
  ✦ 待人（Relationships）：[interpretation]
  ✦ 失物（Lost Items）：[interpretation]
  ✦ 旅行（Travel）：[interpretation]
  ✦ 學問（Study）：[interpretation]
  ✦ 商売（Business）：[interpretation]
  ✦ 争事（Disputes）：[interpretation]
  ✦ 戀愛（Love）：[interpretation]
  ✦ 病気（Health）：[interpretation]
  (Only include sections visible on the slip)

  ---

  💫 [Overall advice - warm, encouraging, 1-2 sentences]

If MEDICINE / PHARMACY PRODUCT (藥品、醫藥品、第○類医薬品):
- Return as a SINGLE item
- translatedText: product name translated to ${targetLanguage}
- originalText: original product name
- category: "Medicine"
- explanation: Write in ${targetLanguage}, use this EXACT format:

  💊 **product name in ${targetLanguage}**

  **主要功效：**
  [What this medicine treats/does. 2-3 sentences.]

  **主要成分：**
  [List key active ingredients with brief explanation of each]

  **用法用量：**
  [Dosage instructions: how many, how often, when to take]

  **注意事項：**
  [Important warnings: who should NOT take it, side effects, interactions]

  **類別：** [第1類/第2類/第3類医薬品 or cosmetic]

If COSMETIC / BEAUTY PRODUCT (美妝、化粧品、スキンケア):
- Return as a SINGLE item
- translatedText: product name translated to ${targetLanguage}
- originalText: original product name
- category: "Beauty"
- explanation: Write in ${targetLanguage}, use this EXACT format:

  💄 **product name in ${targetLanguage}**

  **產品類型：** [e.g. 面膜、精華液、防曬]
  **主要功效：** [What it does. 2-3 sentences.]
  **主要成分：** [Key ingredients with benefits]
  **使用方式：** [How to use]
  **適合膚質：** [Skin type recommendation]

If SNACK / FOOD PACKAGE (零食、お菓子、食品包裝):
- Return as a SINGLE item
- translatedText: product name translated to ${targetLanguage}
- originalText: original product name
- category: "Food"
- explanation: Write in ${targetLanguage}, use this EXACT format:

  🍬 **product name in ${targetLanguage}**

  **口味描述：** [Flavor description. What does it taste like?]
  **主要成分：** [Key ingredients]
  **過敏原：** ⚠️ [List ALL allergens: 小麥、乳、卵、大豆、落花生、えび、かに etc.]
  **營養資訊：** [Calories, key nutrition per serving if visible]
  **保存方式：** [Storage instructions if visible]

If SIGN/NOTICE/OTHER:
- For each text/sign/object found:
  - originalText: text in original language
  - translatedText: translation in ${targetLanguage}
  - explanation: helpful context (2-3 sentences in ${targetLanguage})
  - category: Sign/Warning/History/Info/Notice

Also return locationGuess in ${targetLanguage} if identifiable.`;

  const thumbPart = { inlineData: { mimeType: 'image/jpeg', data: thumb } };
  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [thumbPart, { text: prompt }] },
    config: {
      temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          locationGuess: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalText: { type: Type.STRING },
                translatedText: { type: Type.STRING },
                explanation: { type: Type.STRING },
                category: { type: Type.STRING },
              },
              required: ['originalText', 'translatedText', 'explanation', 'category'],
            },
          },
        },
        required: ['items'],
      },
    },
  });
  if (!response.text) throw new Error('No response from AI');
  return safeParseJSON<GeneralAnalysisResult>(response.text);
};

// =============================================
// Shelf Photo Analysis (導遊專用：貨架照片批次辨識)
// =============================================

export interface ShelfAnalysisResult {
  storeName: string;
  shelfCategory: string;
  items: {
    productName: string;
    translatedName: string;
    price: number;
    category: string;
  }[];
}

export const analyzeShelfImage = async (
  images: { base64: string; mimeType: string }[],
  targetLanguage: string,
  apiKey: string,
): Promise<ShelfAnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-3.1-flash-lite-preview';

  const imageParts = images.map((img) => ({
    inlineData: { data: img.base64, mimeType: img.mimeType },
  }));

  const prompt = `You are a drugstore product scanner. Analyze ${images.length} shelf/display photo(s) from a Japanese drugstore.
Extract ALL visible products with their FULL names, specs, and prices.

IMPORTANT: productName must include the FULL product name with brand, variant, size/quantity/weight as shown on the price tag or packaging.
Examples:
- ✅ "龍角散ダイレクト ミント 20包" (includes variant + quantity)
- ✅ "パブロンゴールドA錠 210錠" (includes variant + count)
- ✅ "ビオレUV アクアリッチ ウォータリーエッセンス 110g" (includes size)
- ❌ "龍角散" (too vague, missing spec)
- ❌ "パブロン" (too vague, missing variant)

For each product:
- productName: FULL original Japanese name with brand + variant + size/quantity (e.g. "ロキソニンS 12錠")
- translatedName: translate to ${targetLanguage}, include spec (e.g. "樂可舒寧S 12錠")
- price: number only, tax-included price if visible (e.g. 1280)
- category: product category in ${targetLanguage} (e.g. 感冒藥, 止痛藥, 面膜, 護膚品, 零食)

Also detect:
- storeName: store name if visible on shelf tags or signage (e.g. マツモトキヨシ, ココカラファイン)
- shelfCategory: what section of the store this shelf is (e.g. 感冒藥, 維生素, 美妝)

Be thorough — extract EVERY product visible, even partially visible ones. Prioritize accuracy of prices.`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [...imageParts, { text: prompt }] },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          storeName: { type: Type.STRING },
          shelfCategory: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                productName: { type: Type.STRING },
                translatedName: { type: Type.STRING },
                price: { type: Type.NUMBER },
                category: { type: Type.STRING },
              },
              required: ['productName', 'translatedName', 'price', 'category'],
            },
          },
        },
        required: ['storeName', 'shelfCategory', 'items'],
      },
    },
  });

  if (!response.text) throw new Error('No response from AI');
  return safeParseJSON<ShelfAnalysisResult>(response.text);
};
