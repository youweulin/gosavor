/**
 * GoSavor Rakuten Sync Worker (獨立)
 * - 管理員觸發，從 price_reports 搜楽天圖片 → upsert products
 *
 * Environment variables:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SYNC_SECRET
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const RAKUTEN_AFF_ID = '52834e1e.f525d9b8.52834e1f.1db22431';

async function handleRakutenSync(env, url) {
  const syncKey = url.searchParams.get('key');
  if (syncKey !== (env.SYNC_SECRET || 'gosavor-sync-2026')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const BATCH = parseInt(url.searchParams.get('batch') || '10');
  const results = [];

  const reportsRes = await fetch(`${env.SUPABASE_URL}/rest/v1/price_reports?select=product_name,jan_code&order=created_at.desc&limit=${BATCH * 3}`, {
    headers: { 'apikey': env.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}` },
  });
  const reports = await reportsRes.json();
  if (!reports || reports.length === 0) return json({ message: 'No products to process', results: [] });

  const seen = new Set();
  const unique = [];
  for (const r of reports) {
    const key = r.jan_code || r.product_name;
    if (!seen.has(key)) { seen.add(key); unique.push(r); }
  }

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

  for (const product of toProcess) {
    const fullName = product.product_name.replace(/[\s\-_\.・]/g, ' ').substring(0, 30);
    const shortName = product.product_name.replace(/[\d\s\-_\.・]+[錠包枚個入g粒ml本袋箱]+$/g, '').substring(0, 20);
    const keywords = [fullName, shortName].filter((v, i, a) => v && a.indexOf(v) === i);

    let items = [];
    let keyword = fullName;
    try {
      for (const kw of keywords) {
        keyword = kw;
        const rakutenUrl = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?format=json&affiliateId=${RAKUTEN_AFF_ID}&keyword=${encodeURIComponent(kw)}&hits=1`;
        const rakutenRes = await fetch(rakutenUrl);
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

      let jan = product.jan_code || null;
      if (!jan && item.itemCaption) {
        const m = item.itemCaption.match(/JAN[:\s]?(\d{13})/i) || item.itemCaption.match(/(49\d{11}|45\d{11})/);
        if (m) jan = m[1];
      }

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

    if (url.pathname === '/api/rakuten-sync' && request.method === 'GET') {
      return handleRakutenSync(env, url);
    }

    if (url.pathname === '/api/rakuten-test' && request.method === 'GET') {
      const kw = url.searchParams.get('q') || '龍角散';
      const rakutenUrl = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?format=json&affiliateId=${RAKUTEN_AFF_ID}&keyword=${encodeURIComponent(kw)}&hits=1`;
      const res = await fetch(rakutenUrl);
      const raw = await res.text();
      return new Response(raw, { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }

    return json({ error: 'Not found' }, 404);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
