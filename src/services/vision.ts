// Apple Vision OCR bridge via Capacitor
// Falls back to null on web (non-iOS)

interface VisionTextItem {
  text: string;
  boundingBox: number[]; // [ymin, xmin, ymax, xmax] 0-1000
  confidence: number;
}

interface VisionResult {
  items: VisionTextItem[];
}

// Check if running in Capacitor iOS
const isCapacitor = (): boolean => {
  return typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor.getPlatform() === 'ios';
};

// Call Apple Vision OCR via Capacitor plugin
export const recognizeText = async (imageBase64: string): Promise<VisionResult | null> => {
  if (!isCapacitor()) {
    // Not on iOS — return null, caller should fall back to Gemini
    return null;
  }

  try {
    const { Capacitor } = window as any;
    const result = await Capacitor.Plugins.VisionOCR.recognizeText({
      imageBase64,
      languages: ['ja', 'en'],
    });
    return result as VisionResult;
  } catch (e) {
    console.error('Vision OCR failed:', e);
    return null;
  }
};

// Group OCR text items into menu items (name + price pairs)
export const groupIntoMenuItems = (items: VisionTextItem[]): {
  name: string;
  price: string;
  boundingBox: number[];
}[] => {
  const menuItems: { name: string; price: string; boundingBox: number[] }[] = [];

  // Sort by vertical position (ymin)
  const sorted = [...items].sort((a, b) => a.boundingBox[0] - b.boundingBox[0]);

  // Group items that are on the same line (similar ymin within 50 units)
  const lines: VisionTextItem[][] = [];
  let currentLine: VisionTextItem[] = [];
  let lastY = -100;

  for (const item of sorted) {
    const y = item.boundingBox[0];
    if (y - lastY > 50 && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
    }
    currentLine.push(item);
    lastY = y;
  }
  if (currentLine.length > 0) lines.push(currentLine);

  // For each line, find name (left) and price (right, contains ¥ or numbers)
  for (const line of lines) {
    const sortedByX = line.sort((a, b) => a.boundingBox[1] - b.boundingBox[1]);
    const priceItem = sortedByX.find(i => /[¥￥\d]{2,}/.test(i.text));
    const nameItems = sortedByX.filter(i => i !== priceItem && !/^[¥￥]?\d+$/.test(i.text));

    if (nameItems.length > 0) {
      const name = nameItems.map(i => i.text).join(' ');
      const price = priceItem?.text.replace(/[^0-9]/g, '') || '';
      // Use the bounding box that covers all items in this line
      const allBoxes = [...nameItems, ...(priceItem ? [priceItem] : [])];
      const bbox = [
        Math.min(...allBoxes.map(i => i.boundingBox[0])),
        Math.min(...allBoxes.map(i => i.boundingBox[1])),
        Math.max(...allBoxes.map(i => i.boundingBox[2])),
        Math.max(...allBoxes.map(i => i.boundingBox[3])),
      ];

      menuItems.push({ name, price, boundingBox: bbox });
    }
  }

  return menuItems;
};

export type { VisionTextItem, VisionResult };
