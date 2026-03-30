import { DEFAULT_SETTINGS } from '../types';
import type { AppSettings, SavedOrder, SavedScan } from '../types';

const SETTINGS_KEY = 'gosavor_settings';
const ORDERS_KEY = 'gosavor_orders';
const SCANS_KEY = 'gosavor_scans';

// === Settings ===
export const getSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
  return { ...DEFAULT_SETTINGS };
};

export const saveSettings = (settings: AppSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// === Order History ===
export const getOrderHistory = (): SavedOrder[] => {
  try {
    const stored = localStorage.getItem(ORDERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to load order history', e);
    return [];
  }
};

export const saveOrder = (order: SavedOrder) => {
  const history = getOrderHistory();
  // Upsert: replace if same ID exists, otherwise prepend
  const exists = history.findIndex(o => o.id === order.id);
  const updated = exists >= 0
    ? history.map(o => o.id === order.id ? order : o)
    : [order, ...history];
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      // Trim oldest entries
      const trimmed = updated.slice(0, 50);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(trimmed));
    }
  }
};

export const deleteOrder = (id: string): SavedOrder[] => {
  const history = getOrderHistory();
  const updated = history.filter(o => o.id !== id);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
  return updated;
};

// === Helpers ===
const createThumbnail = (dataUrl: string, maxDim = 300): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
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
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };
    img.onerror = () => resolve(''); // fallback: no thumbnail
  });
};

// === Scan History ===
export const getScanHistory = (): SavedScan[] => {
  try {
    const stored = localStorage.getItem(SCANS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveScan = async (scan: SavedScan) => {
  // Compress images to thumbnails before storing
  const thumbnails = await Promise.all(
    scan.images.map(img => createThumbnail(img))
  );
  const compressedScan = { ...scan, images: thumbnails.filter(Boolean) };

  const history = getScanHistory();
  const exists = history.findIndex(s => s.id === scan.id);
  const updated = exists >= 0
    ? history.map(s => s.id === scan.id ? compressedScan : s)
    : [compressedScan, ...history];
  try {
    localStorage.setItem(SCANS_KEY, JSON.stringify(updated.slice(0, 20)));
  } catch {
    // Still too big — drop images from older scans
    const slim = updated.map((s, i) => i === 0 ? s : { ...s, images: [] }).slice(0, 20);
    try {
      localStorage.setItem(SCANS_KEY, JSON.stringify(slim));
    } catch {
      // Last resort: no images at all
      localStorage.setItem(SCANS_KEY, JSON.stringify(
        updated.map(s => ({ ...s, images: [] })).slice(0, 10)
      ));
    }
  }
};

export const deleteScan = (id: string): SavedScan[] => {
  const history = getScanHistory();
  const updated = history.filter(s => s.id !== id);
  localStorage.setItem(SCANS_KEY, JSON.stringify(updated));
  return updated;
};
