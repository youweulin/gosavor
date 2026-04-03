/**
 * GoSavor Worker Proxy
 * Routes Gemini API calls through Cloudflare Worker when user has no own key.
 * Worker holds the system key, verifies JWT, and controls daily usage.
 */

import { supabase } from './supabase';

// Worker URL — set after deploying to Cloudflare
const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

export interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
}

export interface WorkerResponse {
  result: any;
  usage: UsageInfo;
}

/** Check if Worker proxy is available */
export const isWorkerAvailable = () => !!WORKER_URL;

/** Get current GPS position */
const getCurrentPosition = (): Promise<{ lat: number; lon: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 300000 } // 5s timeout, cache 5min
    );
  });
};

/**
 * Call Gemini API through Worker proxy
 * @param geminiRequest - The request body for Gemini API
 * @param scanMode - 'receipt' | 'menu' | 'general'
 * @param model - Gemini model name
 * @returns Worker response with result + usage info
 */
export const callGeminiViaWorker = async (
  geminiRequest: any,
  scanMode: string,
  model = 'gemini-3.1-flash-lite-preview',
): Promise<WorkerResponse> => {
  if (!WORKER_URL) {
    throw new Error('Worker URL not configured');
  }

  // Get Supabase JWT
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('NO_AUTH');
  }

  // Get GPS (best effort, don't block if fails)
  const pos = await getCurrentPosition();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'X-Scan-Mode': scanMode,
  };

  if (pos) {
    headers['X-Latitude'] = String(pos.lat);
    headers['X-Longitude'] = String(pos.lon);
  }

  console.log('[GoSavor Worker] Calling:', WORKER_URL, 'mode:', scanMode, 'GPS:', pos);

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ geminiRequest, model }),
  });

  const data = await response.json();
  console.log('[GoSavor Worker] Response:', response.status, JSON.stringify(data).substring(0, 200));

  if (!response.ok) {
    // Handle specific errors
    if (data.error === 'DAILY_LIMIT' || data.error === 'DAILY_LIMIT_REACHED') {
      throw new Error(`LIMIT:${data.message}|${data.usage}|${data.limit}`);
    }
    if (data.error === 'GPS_NOT_JAPAN') {
      throw new Error(`GPS:${data.message}`);
    }
    if (data.error === 'USE_OWN_KEY') {
      throw new Error(`USE_OWN_KEY:${data.message}`);
    }
    throw new Error(data.error || 'Worker request failed');
  }

  return data;
};

/**
 * Smart Gemini call: use own key if available, otherwise Worker proxy
 */
export const smartGeminiCall = async (
  geminiRequest: any,
  scanMode: string,
  ownApiKey?: string,
  model = 'gemini-3.1-flash-lite-preview',
): Promise<{ result: any; usage?: UsageInfo; viaWorker: boolean }> => {
  // Has own key → direct call (no limits)
  if (ownApiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ownApiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequest),
    });
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const result = await res.json();
    return { result, viaWorker: false };
  }

  // No own key → use Worker proxy
  if (!isWorkerAvailable()) {
    throw new Error('NO_KEY:請設定 Gemini API Key 或等待系統服務上線');
  }

  const workerResult = await callGeminiViaWorker(geminiRequest, scanMode, model);
  return { result: workerResult.result, usage: workerResult.usage, viaWorker: true };
};
