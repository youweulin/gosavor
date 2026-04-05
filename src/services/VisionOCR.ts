import { registerPlugin } from '@capacitor/core';

export interface BoundingBox {
  x: number;      // Normalized x (0 to 1)
  y: number;      // Normalized y from top (0 to 1)
  width: number;  // Normalized width (0 to 1)
  height: number; // Normalized height (0 to 1)
}

export interface OCRResult {
  text: string;
  boundingBox: BoundingBox;
  confidence: number;
}

export interface VisionOCRPlugin {
  analyzeImage(options: { base64str: string }): Promise<{ results: OCRResult[] }>;
}

const VisionOCR = registerPlugin<VisionOCRPlugin>('VisionOCR');

export default VisionOCR;
