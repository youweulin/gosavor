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

// === Image Compression ===
const compressImage = (dataUrl: string, maxDim = 500): Promise<string> => {
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
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve('');
  });
};

// === Scan History (IndexedDB — no size limit) ===

const DB_NAME = 'gosavor_db';
const DB_VERSION = 1;
const STORE_NAME = 'scans';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const getScanHistory = async (): Promise<SavedScan[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const scans = (req.result as SavedScan[]).sort((a, b) => b.timestamp - a.timestamp);
        resolve(scans);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};

export const saveScan = async (scan: SavedScan) => {
  try {
    // Compress images before storing
    const compressed = await Promise.all(
      scan.images.map(img => compressImage(img))
    );
    const compressedScan = { ...scan, images: compressed.filter(Boolean) };
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(compressedScan);
  } catch (e) {
    console.error('Failed to save scan', e);
  }
};

export const deleteScan = async (id: string): Promise<SavedScan[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch (e) {
    console.error('Failed to delete scan', e);
  }
  return getScanHistory();
};
