import { GoogleGenAI, Type } from '@google/genai';
import type { MenuAnalysisResult } from '../types';

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
