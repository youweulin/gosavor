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
// 公測期限：2026-05-05 23:59:59 UTC+9 (JST)
const BETA_EXPIRES = new Date('2026-05-05T23:59:59+09:00');
const IS_BETA_PERIOD = () => new Date() < BETA_EXPIRES;

// 公測獎勵期限：2027-05-05（過期後 beta plan 歸零）
const BETA_REWARD_EXPIRES = new Date('2027-05-05T23:59:59+09:00');
const IS_BETA_REWARD = () => new Date() < BETA_REWARD_EXPIRES;

const DAILY_LIMITS = {
  free:          0,                     // 免費：不能用系統 API（需先兌換碼）
  guide_member: 15,                     // 旅遊團：15次/天
  unlimited:    9999,                   // 其他有效 plan：不限
  rental:       50,                     // 旅遊包：50次/天 硬上限（正式版用）
};

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
    `${supabaseUrl}/rest/v1/users?anonymous_id=eq.${userId}&select=plan,credits,daily_usage,last_reset_date,rental_expires,shared_api_key`,
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

  // free = 沒兌換碼，不能用系統 API
  if (plan === 'free') {
    return DAILY_LIMITS.free; // 0
  }

  // guide-member（旅遊團）: 15次/天
  if (plan === 'guide-member') {
    return DAILY_LIMITS.guide_member;
  }

  // rental (旅遊包): check expiry
  if (plan === 'rental') {
    const expires = user.rental_expires ? new Date(user.rental_expires) : null;
    if (expires && expires > new Date()) {
      return DAILY_LIMITS.rental;
    }
    return DAILY_LIMITS.free;
  }

  // has credits (點數包): no daily limit, just deduct credits
  if ((user?.credits || 0) > 0) {
    return 9999;
  }

  // beta plan: 公測期不限 → 過期後 15 次/天（獎勵到 2027/5/5）→ 之後歸零
  if (plan === 'beta' && !IS_BETA_PERIOD()) {
    return IS_BETA_REWARD() ? 15 : 0;
  }

  // 其他有效 plan（beta公測中, guide, supporter, pro）: 不限次數
  return DAILY_LIMITS.unlimited;
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
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
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

      // 3. Free users = no redeem code, block entirely
      if (plan === 'free') {
        return json({
          error: 'NO_PLAN',
          message: '請先輸入兌換碼開通使用權限',
          plan,
        }, 403);
      }

      // 4. GPS check: not in Japan → cap at 15 times/day (prevent abuse)
      const lat = parseFloat(request.headers.get('X-Latitude') || '');
      const lon = parseFloat(request.headers.get('X-Longitude') || '');
      const inJapan = isNaN(lat) || isNaN(lon) || // no GPS = assume Japan
        (lat >= 24.0 && lat <= 46.0 && lon >= 122.0 && lon <= 154.0);

      // 5. Check daily usage
      const limit = inJapan ? getUserLimit(user) : Math.min(getUserLimit(user), 15);
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

      // 6. Proxy to Gemini — only allow users with shared_api_key (guide-member)
      //    All other plans must use their own key from the frontend, not the system key.
      const body = await request.json();
      if (!user?.shared_api_key) {
        return json({
          error: 'USE_OWN_KEY',
          message: '請在設定中輸入你的 Gemini API Key',
          plan,
        }, 403);
      }
      const effectiveEnv = { ...env, GEMINI_API_KEY: user.shared_api_key, GCP_PRIVATE_KEY: null };

      const result = await callGemini(
        effectiveEnv,
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
