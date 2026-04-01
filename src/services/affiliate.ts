import Fuse from 'fuse.js';
import klookProducts from '../data/klook_products.json';

const KLOOK_AID = '30600';
const API_BASE = 'https://aff-api.gosavor.com'; // TODO: replace with real URL

// === Types ===
export interface Product {
  id: string;
  platform: 'klook' | 'kkday';
  title: string;
  url: string;
  category: 'ticket' | 'tour' | 'food' | 'transport' | 'shopping';
  region: string;
  emoji: string;
  reason: string; // why we're recommending this
}

interface KlookProduct {
  id: string;
  name: string;
  region: string;
}

// === City Detection ===
const CITY_TO_REGION: Record<string, { region: string; label: string; area?: string }> = {
  // Tokyo
  '東京': { region: 'Tokyo', label: '東京' },
  '新宿': { region: 'Tokyo', label: '東京', area: 'shinjuku' },
  '渋谷': { region: 'Tokyo', label: '東京', area: 'shibuya' },
  '銀座': { region: 'Tokyo', label: '東京', area: 'ginza' },
  '池袋': { region: 'Tokyo', label: '東京', area: 'ikebukuro' },
  '浅草': { region: 'Tokyo', label: '東京', area: 'asakusa' },
  '淺草': { region: 'Tokyo', label: '東京', area: 'asakusa' },
  '秋葉原': { region: 'Tokyo', label: '東京', area: 'akihabara' },
  '上野': { region: 'Tokyo', label: '東京', area: 'ueno' },
  '原宿': { region: 'Tokyo', label: '東京', area: 'harajuku' },
  '六本木': { region: 'Tokyo', label: '東京', area: 'roppongi' },
  '台場': { region: 'Tokyo', label: '東京', area: 'odaiba' },
  // Kansai
  '大阪': { region: 'Kansai', label: '大阪' },
  '道頓堀': { region: 'Kansai', label: '大阪', area: 'dotonbori' },
  '心斎橋': { region: 'Kansai', label: '大阪', area: 'shinsaibashi' },
  '梅田': { region: 'Kansai', label: '大阪', area: 'umeda' },
  '難波': { region: 'Kansai', label: '大阪', area: 'namba' },
  '京都': { region: 'Kansai', label: '京都' },
  '嵐山': { region: 'Kansai', label: '京都', area: 'arashiyama' },
  '伏見': { region: 'Kansai', label: '京都', area: 'fushimi' },
  '祇園': { region: 'Kansai', label: '京都', area: 'gion' },
  '奈良': { region: 'Kansai', label: '奈良' },
  '神戶': { region: 'Kansai', label: '神戶' },
  '神戸': { region: 'Kansai', label: '神戶' },
  // Kyushu
  '福岡': { region: 'Kyushu', label: '福岡' },
  '博多': { region: 'Kyushu', label: '福岡', area: 'hakata' },
  '天神': { region: 'Kyushu', label: '福岡', area: 'tenjin' },
  '熊本': { region: 'Kyushu', label: '熊本' },
  '別府': { region: 'Kyushu', label: '別府' },
  '由布院': { region: 'Kyushu', label: '由布院' },
  '長崎': { region: 'Kyushu', label: '長崎' },
  // Others
  '札幌': { region: 'Hokkaido', label: '札幌' },
  '北海道': { region: 'Hokkaido', label: '北海道' },
  '小樽': { region: 'Hokkaido', label: '小樽' },
  '沖繩': { region: 'Okinawa', label: '沖繩' },
  '沖縄': { region: 'Okinawa', label: '沖繩' },
  '那覇': { region: 'Okinawa', label: '沖繩' },
  '名古屋': { region: 'Nagoya', label: '名古屋' },
};

export const detectLocation = (text: string): { region: string | null; label: string; area?: string } => {
  const lower = text.toLowerCase();
  for (const [keyword, info] of Object.entries(CITY_TO_REGION)) {
    if (lower.includes(keyword.toLowerCase())) return info;
  }
  return { region: null, label: '日本' };
};

// === Time-based category logic ===
const getTimeCategory = (): 'morning' | 'afternoon' | 'evening' | 'night' => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
};

// === High-conversion curated products per region ===
// These are manually picked best-sellers that actually convert
const CURATED: Record<string, Product[]> = {
  Tokyo: [
    { id: '601', platform: 'klook', title: '富士山箱根一日遊', url: '', category: 'tour', region: 'Tokyo', emoji: '🗻', reason: '東京最熱門一日遊' },
    { id: '100861', platform: 'klook', title: '日本 eSIM 上網卡', url: '', category: 'transport', region: 'Tokyo', emoji: '📶', reason: '旅遊必備' },
    { id: '2282', platform: 'klook', title: 'teamLab Planets 門票', url: '', category: 'ticket', region: 'Tokyo', emoji: '🎨', reason: '東京必去景點' },
    { id: '4708', platform: 'klook', title: '東京晴空塔門票', url: '', category: 'ticket', region: 'Tokyo', emoji: '🗼', reason: '東京地標' },
    { id: '6498', platform: 'klook', title: '東京迪士尼門票', url: '', category: 'ticket', region: 'Tokyo', emoji: '🏰', reason: '親子必去' },
    { id: '1551', platform: 'klook', title: '淺草和服體驗', url: '', category: 'food', region: 'Tokyo', emoji: '👘', reason: '文化體驗' },
  ],
  Kansai: [
    { id: '2618', platform: 'klook', title: '大阪環球影城門票', url: '', category: 'ticket', region: 'Kansai', emoji: '🎢', reason: '大阪必去' },
    { id: '4191', platform: 'klook', title: '京都嵐山竹林一日遊', url: '', category: 'tour', region: 'Kansai', emoji: '🎋', reason: '京都經典' },
    { id: '5765', platform: 'klook', title: '大阪周遊卡', url: '', category: 'transport', region: 'Kansai', emoji: '🚃', reason: '省交通費必備' },
    { id: '3027', platform: 'klook', title: '京都和服租借', url: '', category: 'food', region: 'Kansai', emoji: '👘', reason: '京都必體驗' },
    { id: '5032', platform: 'klook', title: '奈良東大寺+餵鹿', url: '', category: 'tour', region: 'Kansai', emoji: '🦌', reason: '可愛小鹿' },
    { id: '7228', platform: 'klook', title: '大阪道頓堀美食導覽', url: '', category: 'food', region: 'Kansai', emoji: '🍜', reason: '在地美食' },
  ],
  Hokkaido: [
    { id: '8823', platform: 'klook', title: '小樽運河巡禮', url: '', category: 'tour', region: 'Hokkaido', emoji: '🏔', reason: '北海道經典' },
    { id: '12055', platform: 'klook', title: '旭山動物園門票', url: '', category: 'ticket', region: 'Hokkaido', emoji: '🐧', reason: '親子推薦' },
  ],
  Kyushu: [
    { id: '9234', platform: 'klook', title: '別府地獄溫泉巡禮', url: '', category: 'tour', region: 'Kyushu', emoji: '♨️', reason: '九州溫泉之旅' },
    { id: '15032', platform: 'klook', title: '由布院一日遊', url: '', category: 'tour', region: 'Kyushu', emoji: '🌿', reason: '九州最美小鎮' },
  ],
  Okinawa: [
    { id: '18900', platform: 'klook', title: '美麗海水族館門票', url: '', category: 'ticket', region: 'Okinawa', emoji: '🐠', reason: '沖繩必去' },
    { id: '19550', platform: 'klook', title: '青之洞窟潛水體驗', url: '', category: 'food', region: 'Okinawa', emoji: '🤿', reason: '沖繩必玩' },
  ],
};

// Fill in affiliate URLs
Object.values(CURATED).flat().forEach(p => {
  if (!p.url) p.url = `https://www.klook.com/zh-TW/activity/${p.id}/?aid=${KLOOK_AID}`;
});

// === Scan mode → category priority ===
const SCAN_PRIORITIES: Record<string, Product['category'][]> = {
  menu: ['food', 'ticket', 'tour'],       // 在餐廳 → 推美食體驗 > 景點 > 一日遊
  receipt: ['shopping', 'ticket', 'tour'], // 在購物 → 推優惠 > 景點 > 一日遊
  general: ['ticket', 'tour', 'food'],     // 在景點 → 推門票 > 一日遊 > 美食
};

const TIME_BOOST: Record<string, Product['category'][]> = {
  morning: ['tour'],        // 早上推一日遊（還來得及出發）
  afternoon: ['ticket'],    // 下午推門票（即買即用）
  evening: ['food'],        // 傍晚推美食體驗（居酒屋）
  night: ['tour', 'ticket'], // 晚上推明天的行程
};

// === Offline fallback: Fuse.js search ===
const fuse = new Fuse(klookProducts as KlookProduct[], {
  keys: ['name'],
  threshold: 0.4,
});

const searchOffline = (query: string, region: string | null, limit = 3): Product[] => {
  let results = fuse.search(query).map(r => r.item);
  if (region) {
    const filtered = results.filter(p => p.region === region);
    if (filtered.length >= limit) results = filtered;
  }
  return results.slice(0, limit).map(p => ({
    id: p.id,
    platform: 'klook' as const,
    title: p.name.length > 35 ? p.name.substring(0, 35) + '...' : p.name,
    url: `https://www.klook.com/zh-TW/activity/${p.id}/?aid=${KLOOK_AID}`,
    category: 'ticket' as const,
    region: p.region,
    emoji: '🎫',
    reason: '',
  }));
};

// === Try API, fallback to offline ===
const fetchFromAPI = async (region: string, category: string): Promise<Product[] | null> => {
  try {
    const res = await fetch(`${API_BASE}/api/products?region=${region}&category=${category}&limit=3`, {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.products || null;
  } catch {
    return null; // offline or API down
  }
};

// === Main: Smart Recommendation Engine ===
export const getRecommendations = async (
  scanMode: string,
  restaurantName?: string,
  locationGuess?: string,
): Promise<Product[]> => {
  const text = restaurantName || locationGuess || '';
  const { region, label, area } = detectLocation(text);
  const time = getTimeCategory();
  const priorities = SCAN_PRIORITIES[scanMode] || ['ticket', 'tour'];
  const timeBoost = TIME_BOOST[time] || [];

  console.log(`[GoSavor Ads] mode=${scanMode} region=${region} area=${area} time=${time}`);

  // Step 1: Try API (if online)
  if (region) {
    const primaryCategory = priorities[0];
    const apiProducts = await fetchFromAPI(region, primaryCategory);
    if (apiProducts && apiProducts.length > 0) {
      console.log(`[GoSavor Ads] API returned ${apiProducts.length} products`);
      return apiProducts.slice(0, 3);
    }
  }

  // Step 2: Offline — use curated high-conversion products
  console.log(`[GoSavor Ads] Using offline curated products`);
  const regionKey = region || 'Tokyo';
  const curated = CURATED[regionKey] || CURATED['Tokyo'];

  // Score and sort by relevance
  const scored = curated.map(product => {
    let score = 0;
    // Category match with scan mode priorities
    const catIndex = priorities.indexOf(product.category);
    if (catIndex >= 0) score += (3 - catIndex) * 10; // higher priority = higher score
    // Time boost
    if (timeBoost.includes(product.category)) score += 5;
    // Randomness (so it's not always the same)
    score += Math.random() * 3;
    return { product, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, 3).map(s => ({
    ...s.product,
    reason: s.product.reason || `${label}推薦`,
  }));

  // If not enough curated, fill with Fuse.js search
  if (results.length < 3) {
    const searchQuery = `${label} ${priorities[0] === 'food' ? '美食 體驗' : '景點 門票'}`;
    const extras = searchOffline(searchQuery, region, 3 - results.length);
    results.push(...extras);
  }

  return results.slice(0, 3);
};

// === Exports ===
export { detectLocation as detectFromText };
