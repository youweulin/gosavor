/**
 * GoSavor Cloudflare Worker
 * - Gemini API proxy (protects system key)
 * - JWT verification (Supabase anonymous auth)
 * - Plan-based daily usage control
 * - GPS Japan geofence check
 *
 * Environment variables (set in Cloudflare Dashboard):
 *   GEMINI_API_KEY      - System Gemini API key
 *   SUPABASE_URL        - https://xxxxx.supabase.co
 *   SUPABASE_ANON_KEY   - Supabase anon public key
 *   SUPABASE_JWT_SECRET - Supabase JWT secret
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Scan-Mode, X-Latitude, X-Longitude',
};

// =============================================
// Plan-based daily limits (system API only)
// supporter/pro use own key, don't hit Worker
// =============================================
const IS_BETA_PERIOD = true; // flip to false when 正式版 launches

const DAILY_LIMITS = {
  free:    IS_BETA_PERIOD ? 5 : 2,    // 免費：公測5次，正式2次
  rental:  50,                         // 旅遊包：50次/天 硬上限
  // 點數包：無日上限，用完點數就沒了
};

// =============================================
// Japan GPS geofence
// =============================================
const JAPAN_BOUNDS = {
  latMin: 24.0, latMax: 46.0,
  lonMin: 122.0, lonMax: 154.0,
};

function isInJapan(lat, lon) {
  if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) return false;
  return lat >= JAPAN_BOUNDS.latMin && lat <= JAPAN_BOUNDS.latMax &&
         lon >= JAPAN_BOUNDS.lonMin && lon <= JAPAN_BOUNDS.lonMax;
}

// =============================================
// JWT verification (via Supabase JWKS)
// Supports both ECC P-256 (ES256) and HS256
// =============================================
let _jwksCache = null;
let _jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour

async function getJWKS(supabaseUrl) {
  const now = Date.now();
  if (_jwksCache && (now - _jwksCacheTime) < JWKS_CACHE_TTL) return _jwksCache;

  const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
  if (!res.ok) return null;
  _jwksCache = await res.json();
  _jwksCacheTime = now;
  return _jwksCache;
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function verifyJWT(token, secret, supabaseUrl) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const headerStr = new TextDecoder().decode(base64UrlDecode(parts[0]));
    const payloadStr = new TextDecoder().decode(base64UrlDecode(parts[1]));
    const header = JSON.parse(headerStr);
    const payload = JSON.parse(payloadStr);

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    // Check issuer (Supabase format: "https://xxx.supabase.co/auth/v1" or "supabase")
    if (!payload.iss || (!payload.iss.includes('supabase') && payload.iss !== 'supabase')) return null;
    // Check has user id
    if (!payload.sub) return null;

    const signatureBytes = base64UrlDecode(parts[2]);
    const signedInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

    if (header.alg === 'ES256') {
      // ECC P-256 verification via JWKS
      const jwks = await getJWKS(supabaseUrl);
      if (!jwks?.keys) return null;

      const headerKid = (header.kid || '').toLowerCase();
      const jwk = jwks.keys.find(k => (k.kid || '').toLowerCase() === headerKid) || jwks.keys[0];
      if (!jwk) return null;

      const key = await crypto.subtle.importKey(
        'jwk', jwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, ['verify']
      );

      const valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key, signatureBytes, signedInput
      );
      return valid ? payload : null;

    } else if (header.alg === 'HS256') {
      // HMAC-SHA256 verification (legacy)
      const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['verify']
      );
      const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, signedInput);
      return valid ? payload : null;
    }

    return null;
  } catch (err) {
    console.error('JWT verify error:', err);
    return null;
  }
}

// =============================================
// Supabase helpers
// =============================================
async function getUser(supabaseUrl, supabaseKey, userId) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/users?anonymous_id=eq.${userId}&select=plan,credits,daily_usage,last_reset_date,rental_expires`,
    { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
  );
  const data = await res.json();
  return data?.[0] || null;
}

async function updateUser(supabaseUrl, supabaseKey, userId, updates) {
  await fetch(`${supabaseUrl}/rest/v1/users?anonymous_id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(updates),
  });
}

// =============================================
// Usage control logic
// =============================================
function getUserLimit(user) {
  const plan = user?.plan || 'free';

  // supporter/pro should use own key, not system API
  // but if they somehow hit Worker, give them free-tier limit
  if (plan === 'supporter' || plan === 'pro') {
    return DAILY_LIMITS.free;
  }

  // rental (旅遊包): check expiry
  if (plan === 'rental') {
    const expires = user.rental_expires ? new Date(user.rental_expires) : null;
    if (expires && expires > new Date()) {
      return DAILY_LIMITS.rental; // 50次/天
    }
    // expired → fall back to free
    return DAILY_LIMITS.free;
  }

  // has credits (點數包): no daily limit, just deduct credits
  if ((user?.credits || 0) > 0) {
    return 9999; // 無日上限，靠點數餘額控制
  }

  // free
  return DAILY_LIMITS.free;
}

function getDailyUsage(user) {
  const today = new Date().toISOString().split('T')[0];
  if (user?.last_reset_date !== today) return 0; // new day = reset
  return user?.daily_usage || 0;
}

// =============================================
// Vertex AI / Gemini API proxy
// =============================================

// --- Google OAuth2 via Service Account JWT ---
let _accessToken = null;
let _tokenExpiry = 0;

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\n/g, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64UrlEncode(data) {
  if (typeof data === 'string') {
    return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // Handle Uint8Array (binary signature data)
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(email, privateKey) {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid (with 60s buffer)
  if (_accessToken && _tokenExpiry > now + 60) return _accessToken;

  // Build JWT
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  const signInput = new TextEncoder().encode(`${header}.${payload}`);

  // Import private key and sign
  const keyData = pemToArrayBuffer(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, signInput);
  const sig64 = base64UrlEncode(new Uint8Array(signature));

  const jwt = `${header}.${payload}.${sig64}`;

  // Exchange JWT for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth token error ${res.status}: ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  _accessToken = data.access_token;
  _tokenExpiry = now + (data.expires_in || 3600);
  return _accessToken;
}

async function callGemini(env, requestBody, model) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    let url, headers;

    if (env.GCP_PRIVATE_KEY && env.GCP_SERVICE_ACCOUNT_EMAIL && env.GCP_PROJECT_ID) {
      // Vertex AI (uses Google Cloud $300 credits)
      const token = await getAccessToken(env.GCP_SERVICE_ACCOUNT_EMAIL, env.GCP_PRIVATE_KEY);
      const region = 'us-central1';
      url = `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${env.GCP_PROJECT_ID}/locations/${region}/publishers/google/models/${model}:generateContent`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };
    } else {
      // Fallback: direct Gemini API key
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
      headers = { 'Content-Type': 'application/json' };
    }

    // Vertex AI requires different format: roles must be "user" or "model"
    let body = requestBody;
    if (env.GCP_PRIVATE_KEY) {
      body = JSON.parse(JSON.stringify(requestBody)); // deep clone
      // Ensure all content parts have valid role
      if (body.contents) {
        if (Array.isArray(body.contents)) {
          body.contents = body.contents.map(c => ({
            ...c,
            role: c.role === 'model' ? 'model' : 'user',
          }));
        }
      }
      // Remove thinkingConfig (not supported by Vertex AI)
      if (body.generationConfig?.thinkingConfig) {
        delete body.generationConfig.thinkingConfig;
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini error ${res.status}: ${errText.substring(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================
// Main handler
// =============================================
// =============================================
// 楽天商品圖片 Bot（管理員觸發）
// GET /api/rakuten-sync?key=YOUR_SECRET
// =============================================
const RAKUTEN_APP_ID = '40c15934-1373-4dc0-a3f6-e9fffa2f83c3';
const RAKUTEN_ACCESS_KEY = 'pk_cnZ5aZt4XZnrTXsxrB0beaUrh9jeDjbJ1ek762viGfR';

async function handleRakutenSync(env, url) {
  // 簡易驗證（防止隨意觸發）
  const syncKey = url.searchParams.get('key');
  if (syncKey !== (env.SYNC_SECRET || 'gosavor-sync-2026')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const BATCH = parseInt(url.searchParams.get('batch') || '10');
  const results = [];

  // 1. 撈 price_reports 有名字的商品
  const reportsRes = await fetch(`${env.SUPABASE_URL}/rest/v1/price_reports?select=product_name,jan_code&order=created_at.desc&limit=${BATCH * 3}`, {
    headers: { 'apikey': env.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}` },
  });
  const reports = await reportsRes.json();
  if (!reports || reports.length === 0) return json({ message: 'No products to process', results: [] });

  // 去重
  const seen = new Set();
  const unique = [];
  for (const r of reports) {
    const key = r.jan_code || r.product_name;
    if (!seen.has(key)) { seen.add(key); unique.push(r); }
  }

  // 2. 檢查已在 products 表的
  const existRes = await fetch(`${env.SUPABASE_URL}/rest/v1/products?select=name,jan_code&limit=1000`, {
    headers: { 'apikey': env.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}` },
  });
  const existing = await existRes.json();
  const existNames = new Set((existing || []).map(p => p.name));
  const existJANs = new Set((existing || []).filter(p => p.jan_code).map(p => p.jan_code));

  const toProcess = unique.filter(p => {
    if (p.jan_code && existJANs.has(p.jan_code)) return false;
    if (existNames.has(p.product_name)) return false;
    return true;
  }).slice(0, BATCH);

  if (toProcess.length === 0) return json({ message: 'All products already have data', results: [] });

  // 3. 搜尋楽天
  for (const product of toProcess) {
    // 嘗試完整名、截短名、去數字名
    const fullName = product.product_name.replace(/[\s\-_\.・]/g, ' ').substring(0, 30);
    const shortName = product.product_name.replace(/[\d\s\-_\.・]+[錠包枚個入g粒ml本袋箱]+$/g, '').substring(0, 20);
    const keywords = [fullName, shortName].filter((v, i, a) => v && a.indexOf(v) === i);

    let items = [];
    let keyword = fullName;
    try {
      for (const kw of keywords) {
        keyword = kw;
        const rakutenUrl = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601?format=json&applicationId=${RAKUTEN_APP_ID}&accessKey=${RAKUTEN_ACCESS_KEY}&keyword=${encodeURIComponent(kw)}&hits=1`;
        const rakutenRes = await fetch(rakutenUrl, {
          headers: { 'Referer': 'https://gosavor.zeabur.app/' },
        });
        const rawText = await rakutenRes.text();
        let data;
        try { data = JSON.parse(rawText); } catch {
          results.push({ name: kw, status: 'parse_error', raw: rawText.substring(0, 200) });
          continue;
        }
        if (data.error) {
          results.push({ name: kw, status: 'api_error', error: data.error, desc: data.error_description });
          continue;
        }
        items = data.Items || [];
        if (items.length > 0) break;
        await new Promise(r => setTimeout(r, 1100));
      }

      if (items.length === 0) {
        results.push({ name: keyword, status: 'not_found', tried: keywords });
        continue;
      }

      const item = items[0].Item;
      const imageUrl = (item.mediumImageUrls?.[0]?.imageUrl || '').replace('?_ex=128x128', '?_ex=300x300');

      // Extract JAN from caption
      let jan = product.jan_code || null;
      if (!jan && item.itemCaption) {
        const m = item.itemCaption.match(/JAN[:\s]?(\d{13})/i) || item.itemCaption.match(/(49\d{11}|45\d{11})/);
        if (m) jan = m[1];
      }

      // 4. Upsert to products
      await fetch(`${env.SUPABASE_URL}/rest/v1/products`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          jan_code: jan,
          name: product.product_name,
          image_url: imageUrl,
          rakuten_price: item.itemPrice || null,
          rakuten_url: item.itemUrl || null,
          updated_at: new Date().toISOString(),
        }),
      });

      results.push({ name: keyword, status: 'ok', image: !!imageUrl, jan });
    } catch (err) {
      results.push({ name: keyword, status: 'error', error: err.message });
    }

    // Rate limit: 1 req/sec
    await new Promise(r => setTimeout(r, 1100));
  }

  return json({ message: `Processed ${results.length} products`, results });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // 楽天 Sync endpoint（GET）
    if (url.pathname === '/api/rakuten-sync' && request.method === 'GET') {
      return handleRakutenSync(env, url);
    }

    // 楽天 debug test（GET）
    if (url.pathname === '/api/rakuten-test' && request.method === 'GET') {
      const kw = url.searchParams.get('q') || '龍角散';
      const rakutenUrl = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601?format=json&applicationId=${RAKUTEN_APP_ID}&accessKey=${RAKUTEN_ACCESS_KEY}&keyword=${encodeURIComponent(kw)}&hits=1`;
      const res = await fetch(rakutenUrl, { headers: { 'Referer': 'https://gosavor.zeabur.app/' } });
      const raw = await res.text();
      return new Response(raw, { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    try {
      // 1. Verify JWT
      const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
      if (!token) return json({ error: 'Missing token' }, 401);

      const payload = await verifyJWT(token, env.SUPABASE_JWT_SECRET, env.SUPABASE_URL);
      if (!payload) {
        // Debug: decode without verify to see what's wrong
        try {
          const debugPayload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          const debugHeader = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
          return json({ error: 'Invalid token', debug: { alg: debugHeader.alg, kid: debugHeader.kid, iss: debugPayload.iss, sub: debugPayload.sub?.substring(0, 8), exp: debugPayload.exp } }, 401);
        } catch {}
        return json({ error: 'Invalid token' }, 401);
      }

      const userId = payload.sub;

      // 2. Get user from Supabase
      const user = await getUser(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, userId);
      const plan = user?.plan || 'free';

      // 3. If supporter/pro → they should use own key
      if (plan === 'supporter' || plan === 'pro') {
        return json({
          error: 'USE_OWN_KEY',
          message: '請使用自帶 API Key（設定 → API Key）',
          plan,
        }, 403);
      }

      // 4. GPS check (system API = Japan only)
      const lat = parseFloat(request.headers.get('X-Latitude') || '');
      const lon = parseFloat(request.headers.get('X-Longitude') || '');
      if (!isNaN(lat) && !isNaN(lon) && !isInJapan(lat, lon)) {
        return json({
          error: 'GPS_NOT_JAPAN',
          message: '系統翻譯僅限日本境內使用',
        }, 403);
      }

      // 5. Check daily usage
      const limit = getUserLimit(user);
      const usage = getDailyUsage(user);

      if (usage >= limit) {
        return json({
          error: 'DAILY_LIMIT',
          message: `今日額度已用完（${limit}次/天）`,
          usage, limit,
          plan,
          hasCredits: (user?.credits || 0) > 0,
        }, 429);
      }

      // 6. Proxy to Gemini
      const body = await request.json();
      const result = await callGemini(
        env,
        body.geminiRequest,
        body.model || 'gemini-3.1-flash-lite-preview'
      );

      // 7. Update usage
      const today = new Date().toISOString().split('T')[0];
      const isNewDay = user?.last_reset_date !== today;
      const updates = {
        daily_usage: isNewDay ? 1 : (user?.daily_usage || 0) + 1,
        last_reset_date: today,
        last_active_at: new Date().toISOString(),
      };

      // Deduct credit if using credits
      if (plan === 'free' && (user?.credits || 0) > 0) {
        updates.credits = Math.max(0, (user.credits || 0) - 1);
      }

      await updateUser(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, userId, updates);

      // 8. Return result
      return json({
        result,
        usage: {
          used: (isNewDay ? 0 : usage) + 1,
          limit,
          remaining: limit - (isNewDay ? 0 : usage) - 1,
          plan,
          credits: updates.credits ?? user?.credits ?? 0,
        },
      });

    } catch (err) {
      return json({ error: 'Server error', details: err.message }, 500);
    }
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
