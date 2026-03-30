import { DEFAULT_SETTINGS } from '../types';
import type { AppSettings, SavedOrder } from '../types';

const SETTINGS_KEY = 'gosavor_settings';
const ORDERS_KEY = 'gosavor_orders';

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
