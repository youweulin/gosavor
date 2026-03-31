import { GoogleGenAI, Type } from '@google/genai';
import type { MenuAnalysisResult, ReceiptAnalysisResult, GeneralAnalysisResult } from '../types';

const getAI = (apiKey: string) => new GoogleGenAI({ apiKey });

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

const resizeImage = (base64Str: string, maxDim = 800): Promise<string> => {
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
      resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
    };
  });
};

export const analyzeMenuImage = async (
  images: { base64: string; mimeType: string }[],
  targetLanguage: string,
  apiKey: string,
  allergens: string[] = [],
  modelName = 'gemini-2.5-flash'
): Promise<MenuAnalysisResult> => {
  const resized = await Promise.all(
    images.map(async (img) => ({
      base64: await resizeImage(img.base64),
      mimeType: 'image/jpeg',
    }))
  );

  const allergenPart = allergens.length > 0
    ? `\nUser allergens: [${allergens.join(',')}]. For each item, return matching allergen IDs in "allergens" array.`
    : '';

  const imageCount = resized.length;
  const prompt = `Menu translator. Analyze ${imageCount} menu image(s). Output ${targetLanguage}.
For each item:
- originalName: item name in original language
- translatedName: natural translation in ${targetLanguage}
- description: if menu has description text, translate it to ${targetLanguage}. If no description on menu, write 1 sentence explaining what the dish is (ingredients, taste) in ${targetLanguage}. MUST NOT be empty.
- price: number only (e.g. "630")
- category: in ${targetLanguage}
- boundingBox: [ymin,xmin,ymax,xmax] in 0-1000 coords
- imageIndex: which image (0-based) this item appears in. First image=0, second=1, etc.${allergenPart}
Also return currency (use ¥ for JPY) and restaurantName if visible.`;

  const imageParts = resized.map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.base64 },
  }));

  const ai = getAI(apiKey);
  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [...imageParts, { text: prompt }] },
    config: {
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          currency: { type: Type.STRING },
          restaurantName: { type: Type.STRING },
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
                imageIndex: { type: Type.NUMBER, description: '0-based index of which image this item is from' },
              },
              required: ['originalName', 'translatedName', 'price', 'category'],
            },
          },
        },
        required: ['currency', 'items'],
      },
    },
  });

  if (!response.text) throw new Error('No response from AI');
  return safeParseJSON<MenuAnalysisResult>(response.text);
};

// === Receipt Analysis ===
export const analyzeReceiptImage = async (
  images: { base64: string; mimeType: string }[],
  targetLanguage: string,
  apiKey: string,
  modelName = 'gemini-2.5-flash'
): Promise<ReceiptAnalysisResult> => {
  const resized = await Promise.all(images.map(async (img) => ({
    base64: await resizeImage(img.base64),
    mimeType: 'image/jpeg',
  })));

  const prompt = `Receipt scanner and translator. ALL translations MUST be in ${targetLanguage}.
For each item:
- originalName: text as seen on receipt (original language)
- translatedName: MUST translate to ${targetLanguage}. Example: "アリナミンEXプラス" → "合利他命EX Plus" (not English).
- quantity: number of items
- price: total price for this line
- boundingBox: [ymin,xmin,ymax,xmax] in 0-1000 coords, marking where this item appears on the receipt
Also extract: merchantName (keep original), date, currency (use ¥ for JPY), totalAmount, tax, serviceCharge, isTaxFree (check for 免税/Tax Free), totalQuantity.`;

  const imageParts = resized.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
  const ai = getAI(apiKey);
  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [...imageParts, { text: prompt }] },
    config: {
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
  modelName = 'gemini-2.5-flash'
): Promise<GeneralAnalysisResult> => {
  const resized = await Promise.all(images.map(async (img) => ({
    base64: await resizeImage(img.base64),
    mimeType: 'image/jpeg',
  })));

  const prompt = `Smart travel translator. Analyze image. ALL output in ${targetLanguage}.
For each text/sign/object found:
- originalText: text in original language
- translatedText: translation in ${targetLanguage}
- explanation: helpful context (2-3 sentences in ${targetLanguage}). If fortune slip (おみくじ/籤詩), explain the meaning and luck level.
- category: Sign/Warning/Fortune/History/Info/Notice
Also return locationGuess in ${targetLanguage} if identifiable.`;

  const imageParts = resized.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
  const ai = getAI(apiKey);
  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [...imageParts, { text: prompt }] },
    config: {
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
