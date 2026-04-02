/**
 * GoSavor Cloudflare Worker
 * - Gemini API proxy (protects system key)
 * - JWT verification (Supabase anonymous auth)
 * - Daily usage control per user
 * - GPS Japan geofence check
 *
 * Environment variables (set in Cloudflare Dashboard):
 *   GEMINI_API_KEY     - System Gemini API key
 *   SUPABASE_URL       - https://xxxxx.supabase.co
 *   SUPABASE_ANON_KEY  - Supabase anon public key
 *   SUPABASE_JWT_SECRET - Supabase JWT secret (Settings → API → JWT Secret)
 */

// =============================================
// CORS headers
// =============================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Scan-Mode, X-Latitude, X-Longitude',
};

// =============================================
// Daily usage limits by scan mode
// =============================================
const DAILY_LIMITS = {
  receipt: 5,    // 收據：5張/天（免費，收集資料用）
  menu: 10,      // 菜單：10次/天
  general: 10,   // 萬用：10次/天
};

// =============================================
// Japan GPS geofence
// =============================================
const JAPAN_BOUNDS = {
  latMin: 24.0,   // 沖繩南端
  latMax: 46.0,   // 北海道北端
  lonMin: 122.0,  // 與那國島
  lonMax: 154.0,  // 南鳥島
};

function isInJapan(lat, lon) {
  if (lat === null || lon === null || lat === undefined || lon === undefined) {
    return false;
  }
  return lat >= JAPAN_BOUNDS.latMin && lat <= JAPAN_BOUNDS.latMax &&
         lon >= JAPAN_BOUNDS.lonMin && lon <= JAPAN_BOUNDS.lonMax;
}

// =============================================
// JWT verification (Supabase)
// =============================================
async function verifyJWT(token, secret) {
  try {
    // Decode JWT parts
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.log('JWT expired');
      return null;
    }

    // Verify signature using HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureInput = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signature = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify('HMAC', key, signature, signatureInput);
    if (!valid) {
      console.log('JWT signature invalid');
      return null;
    }

    return payload;
  } catch (err) {
    console.error('JWT verify error:', err);
    return null;
  }
}

// =============================================
// Supabase helpers
// =============================================
async function getDailyUsage(supabaseUrl, supabaseKey, userId) {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`${supabaseUrl}/rest/v1/users?anonymous_id=eq.${userId}&select=daily_usage,last_reset_date`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });
  const data = await res.json();
  if (!data || data.length === 0) return { usage: 0, needsReset: false };

  const user = data[0];
  const needsReset = user.last_reset_date !== today;
  return {
    usage: needsReset ? 0 : (user.daily_usage || 0),
    needsReset,
  };
}

async function incrementUsage(supabaseUrl, supabaseKey, userId, scanMode) {
  const today = new Date().toISOString().split('T')[0];

  // Reset if new day, then increment
  const { needsReset } = await getDailyUsage(supabaseUrl, supabaseKey, userId);

  const updateBody = needsReset
    ? { daily_usage: 1, last_reset_date: today, last_active_at: new Date().toISOString() }
    : { daily_usage: undefined, last_active_at: new Date().toISOString() }; // will use RPC

  if (needsReset) {
    await fetch(`${supabaseUrl}/rest/v1/users?anonymous_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(updateBody),
    });
  } else {
    // Atomic increment
    await fetch(`${supabaseUrl}/rest/v1/rpc/increment_daily_usage`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_anonymous_id: userId }),
    });
  }
}

// =============================================
// Gemini API proxy
// =============================================
async function callGemini(apiKey, requestBody, model = 'gemini-2.5-flash') {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${error}`);
  }

  return await res.json();
}

// =============================================
// Main handler
// =============================================
export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    try {
      // 1. Extract JWT from Authorization header
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) {
        return jsonResponse({ error: 'Missing authorization token' }, 401);
      }

      // 2. Verify JWT
      const payload = await verifyJWT(token, env.SUPABASE_JWT_SECRET);
      if (!payload) {
        return jsonResponse({ error: 'Invalid or expired token' }, 401);
      }
      const userId = payload.sub; // Supabase auth user ID

      // 3. Get scan mode and check GPS
      const scanMode = request.headers.get('X-Scan-Mode') || 'general';
      const lat = parseFloat(request.headers.get('X-Latitude') || '');
      const lon = parseFloat(request.headers.get('X-Longitude') || '');

      // GPS check (only for system key usage)
      if (!isInJapan(lat, lon) && !isNaN(lat)) {
        return jsonResponse({
          error: 'GPS_NOT_JAPAN',
          message: '系統翻譯僅限日本境內使用。請使用自帶 API Key。',
        }, 403);
      }

      // 4. Check daily usage
      const limit = DAILY_LIMITS[scanMode] || DAILY_LIMITS.general;
      const { usage } = await getDailyUsage(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, userId);

      if (usage >= limit) {
        return jsonResponse({
          error: 'DAILY_LIMIT_REACHED',
          message: `今日${scanMode === 'receipt' ? '收據' : scanMode === 'menu' ? '菜單' : '翻譯'}額度已用完（${limit}次/天）`,
          usage,
          limit,
          resetAt: '明天 00:00',
        }, 429);
      }

      // 5. Proxy to Gemini
      const body = await request.json();
      const model = body.model || 'gemini-2.5-flash';
      const geminiRequest = body.geminiRequest;

      if (!geminiRequest) {
        return jsonResponse({ error: 'Missing geminiRequest in body' }, 400);
      }

      const result = await callGemini(env.GEMINI_API_KEY, geminiRequest, model);

      // 6. Increment usage
      await incrementUsage(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, userId, scanMode);

      // 7. Return result with usage info
      return jsonResponse({
        result,
        usage: {
          used: usage + 1,
          limit,
          remaining: limit - usage - 1,
        },
      });

    } catch (err) {
      console.error('Worker error:', err);
      return jsonResponse({ error: 'Internal server error', details: err.message }, 500);
    }
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}
