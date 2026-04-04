/**
 * GoSavor 楽天商品圖片 Bot
 *
 * 從 price_reports 撈沒有圖片的商品 → 用楽天 API 搜尋 → 存到 products 表
 *
 * Usage: node scripts/rakuten-bot.mjs
 *
 * 環境變數（或直接在下方修改）:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_KEY (service_role key, 不是 anon key)
 * - RAKUTEN_APP_ID
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pwexugipwqmucomqusyu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''; // 填 service_role key
const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID || '40c15934-1373-4dc0-a3f6-e9fffa2f83c3';

const BATCH_SIZE = 20; // 每次處理幾個商品
const DELAY_MS = 1000; // 楽天 API 速率限制：1 req/sec

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Supabase REST API helper
async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || '',
      ...options.headers,
    },
    method: options.method || 'GET',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${path}: ${res.status} ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// 楽天 API 搜尋
async function searchRakuten(keyword) {
  const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?format=json&applicationId=${RAKUTEN_APP_ID}&keyword=${encodeURIComponent(keyword)}&hits=3`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.Items || [];
}

// 從 itemCaption 提取 JAN Code
function extractJAN(caption) {
  if (!caption) return null;
  const match = caption.match(/JAN[:\s]?(\d{13})/i) || caption.match(/(\d{13})/);
  if (match) {
    const code = match[1];
    if (code.startsWith('49') || code.startsWith('45')) return code;
  }
  return null;
}

// 主流程
async function main() {
  if (!SUPABASE_KEY) {
    console.error('❌ 請設定 SUPABASE_SERVICE_KEY 環境變數');
    console.log('   去 Supabase Dashboard → Settings → API → service_role key');
    process.exit(1);
  }

  console.log('🤖 GoSavor 楽天商品 Bot 啟動');
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log(`   Rakuten App: ${RAKUTEN_APP_ID}`);

  // 1. 從 price_reports 撈有名字但還沒在 products 表的商品
  const reports = await supabaseFetch(
    `price_reports?select=product_name,jan_code&order=created_at.desc&limit=${BATCH_SIZE * 3}`
  );

  if (!reports || reports.length === 0) {
    console.log('📦 沒有新商品需要處理');
    return;
  }

  // 去重
  const seen = new Set();
  const uniqueProducts = [];
  for (const r of reports) {
    const key = r.jan_code || r.product_name;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueProducts.push(r);
    }
  }

  console.log(`📦 找到 ${uniqueProducts.length} 個不重複商品`);

  // 2. 檢查哪些已經在 products 表
  const existingProducts = await supabaseFetch(
    `products?select=jan_code,name&limit=1000`
  );
  const existingNames = new Set((existingProducts || []).map(p => p.name));
  const existingJANs = new Set((existingProducts || []).filter(p => p.jan_code).map(p => p.jan_code));

  const toProcess = uniqueProducts.filter(p => {
    if (p.jan_code && existingJANs.has(p.jan_code)) return false;
    if (existingNames.has(p.product_name)) return false;
    return true;
  }).slice(0, BATCH_SIZE);

  if (toProcess.length === 0) {
    console.log('✅ 所有商品都已有圖片資料');
    return;
  }

  console.log(`🔍 需要搜尋 ${toProcess.length} 個商品`);

  // 3. 逐一搜尋楽天
  let successCount = 0;
  for (const product of toProcess) {
    const keyword = product.product_name.replace(/[\s\-_\.・]/g, ' ').substring(0, 30);
    console.log(`\n🔎 搜尋: ${keyword}`);

    try {
      const items = await searchRakuten(keyword);
      if (!items || items.length === 0) {
        console.log(`   ❌ 找不到`);
        await sleep(DELAY_MS);
        continue;
      }

      const item = items[0].Item;
      const imageUrl = item.mediumImageUrls?.[0]?.imageUrl?.replace('?_ex=128x128', '?_ex=300x300') || '';
      const janFromCaption = extractJAN(item.itemCaption);
      const jan = product.jan_code || janFromCaption;

      console.log(`   ✅ ${item.itemName.substring(0, 40)}`);
      console.log(`   📷 ${imageUrl ? 'OK' : 'NO IMAGE'}`);
      console.log(`   JAN: ${jan || 'N/A'}`);

      // 4. 存到 products 表
      await supabaseFetch('products', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: {
          jan_code: jan || null,
          name: product.product_name,
          translated_name: null,
          image_url: imageUrl,
          brand: item.shopName || null,
          category: null,
          rakuten_price: item.itemPrice || null,
          rakuten_url: item.itemUrl || null,
          updated_at: new Date().toISOString(),
        },
      });

      successCount++;
      console.log(`   💾 已存入 products 表`);
    } catch (err) {
      console.error(`   ❌ 錯誤: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n🎉 完成！成功處理 ${successCount}/${toProcess.length} 個商品`);
}

main().catch(console.error);
