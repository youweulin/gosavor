import Fuse from 'fuse.js';
import klookProducts from '../data/klook_products.json';
import kkdayProducts from '../data/kkday_products.json';

const KLOOK_AID = '30600';
const KKDAY_CID = '14336';

// Product types
interface KlookProduct {
  id: string;
  name: string;
  region: string;
}

interface KKdayProduct {
  id: string;
  name: string;
  region: string;
  category: string;
}

// Fuse.js indexes
const fuse = new Fuse(klookProducts as KlookProduct[], {
  keys: ['name'],
  threshold: 0.4,
  includeScore: true,
});

// KKDay uses category + region filtering instead of fuzzy search

// City → Region mapping
const CITY_TO_REGION: Record<string, string> = {
  '東京': 'Tokyo', 'tokyo': 'Tokyo', '新宿': 'Tokyo', '渋谷': 'Tokyo', '銀座': 'Tokyo',
  '池袋': 'Tokyo', '浅草': 'Tokyo', '淺草': 'Tokyo', '秋葉原': 'Tokyo', '上野': 'Tokyo',
  '原宿': 'Tokyo', '六本木': 'Tokyo', '品川': 'Tokyo', '台場': 'Tokyo',
  '大阪': 'Kansai', 'osaka': 'Kansai', '道頓堀': 'Kansai', '心斎橋': 'Kansai', '梅田': 'Kansai',
  '難波': 'Kansai', '天王寺': 'Kansai',
  '京都': 'Kansai', 'kyoto': 'Kansai', '嵐山': 'Kansai', '伏見': 'Kansai', '祇園': 'Kansai',
  '奈良': 'Kansai', 'nara': 'Kansai',
  '神戸': 'Kansai', '神戶': 'Kansai', 'kobe': 'Kansai',
  '福岡': 'Kyushu', 'fukuoka': 'Kyushu', '博多': 'Kyushu', '天神': 'Kyushu',
  '熊本': 'Kyushu', '別府': 'Kyushu', '由布院': 'Kyushu', '長崎': 'Kyushu',
  '札幌': 'Hokkaido', '北海道': 'Hokkaido', 'hokkaido': 'Hokkaido', '小樽': 'Hokkaido',
  '沖縄': 'Okinawa', '沖繩': 'Okinawa', 'okinawa': 'Okinawa', '那覇': 'Okinawa',
  '名古屋': 'Nagoya', 'nagoya': 'Nagoya',
  '仙台': 'Tohoku', '青森': 'Tohoku',
};

// City display name
const CITY_LABELS: Record<string, string> = {
  '東京': '東京', '新宿': '東京', '渋谷': '東京', '銀座': '東京', '池袋': '東京',
  '浅草': '東京', '淺草': '東京', '秋葉原': '東京', '上野': '東京',
  '大阪': '大阪', '道頓堀': '大阪', '心斎橋': '大阪', '梅田': '大阪', '難波': '大阪',
  '京都': '京都', '嵐山': '京都', '伏見': '京都',
  '神戸': '神戶', '神戶': '神戶',
  '奈良': '奈良', '福岡': '福岡', '博多': '福岡',
  '札幌': '札幌', '北海道': '北海道', '沖縄': '沖繩', '沖繩': '沖繩',
  '名古屋': '名古屋', '熊本': '熊本', '別府': '別府',
};

// Detect city/region from text
const detectFromText = (text: string): { region: string | null; cityLabel: string } => {
  const lower = text.toLowerCase();
  for (const [keyword, region] of Object.entries(CITY_TO_REGION)) {
    if (lower.includes(keyword.toLowerCase())) {
      return { region, cityLabel: CITY_LABELS[keyword] || keyword };
    }
  }
  return { region: null, cityLabel: '日本' };
};

// Build direct product links
const klookLink = (productId: string) =>
  `https://www.klook.com/zh-TW/activity/${productId}/?aid=${KLOOK_AID}`;

const kkdayLink = (productId: string) =>
  `https://www.kkday.com/zh-tw/product/${productId}?cid=${KKDAY_CID}`;

// Search KKDay products by category + region
const searchKKday = (category: string, region?: string | null, limit = 1): KKdayProduct[] => {
  let pool = kkdayProducts as KKdayProduct[];
  if (region) {
    pool = pool.filter(p => p.region === region || p.region === 'ALL');
  }
  if (category) {
    const catFiltered = pool.filter(p => p.category === category);
    if (catFiltered.length > 0) pool = catFiltered;
  }
  // Randomize for variety
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
};

// Search products by keyword + region
const searchProducts = (query: string, region?: string | null, limit = 3): KlookProduct[] => {
  let results = fuse.search(query).map(r => r.item);
  if (region) {
    const regionFiltered = results.filter(p => p.region === region);
    if (regionFiltered.length >= limit) results = regionFiltered;
  }
  return results.slice(0, limit);
};

// Get random products from region
const getRegionProducts = (region: string, limit = 2): KlookProduct[] => {
  const regionProducts = (klookProducts as KlookProduct[]).filter(p => p.region === region);
  const shuffled = regionProducts.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
};

export interface Recommendation {
  title: string;
  subtitle: string;
  url: string;
  platform: 'klook' | 'kkday';
  emoji: string;
}

// Context keywords for different scan modes
const FOOD_KEYWORDS = ['美食', 'グルメ', 'food tour', '料理教室', 'cooking', '居酒屋', 'ramen'];

// Main recommendation function
export const getRecommendations = (
  scanMode: string,
  restaurantName?: string,
  locationGuess?: string,
): Recommendation[] => {
  const text = restaurantName || locationGuess || '';
  const { region, cityLabel } = detectFromText(text);
  const recs: Recommendation[] = [];

  if (scanMode === 'menu') {
    // Search for food experiences in the area
    const keywords = region ? FOOD_KEYWORDS : ['日本 美食'];
    const query = `${cityLabel} ${keywords[Math.floor(Math.random() * keywords.length)]}`;
    const products = searchProducts(query, region, 2);

    if (products.length > 0) {
      products.forEach(p => {
        recs.push({
          title: p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name,
          subtitle: `${cityLabel} · Klook 預訂`,
          url: klookLink(p.id),
          platform: 'klook',
          emoji: '🍽️',
        });
      });
    }

    // KKDay food experience — direct product link
    searchKKday('美食', region, 1).forEach(p => {
      recs.push({
        title: p.name,
        subtitle: 'KKday 預訂',
        url: kkdayLink(p.id),
        platform: 'kkday',
        emoji: '🍶',
      });
    });

    // Add region random picks if not enough
    if (recs.length < 3 && region) {
      getRegionProducts(region, 2 - recs.length).forEach(p => {
        recs.push({
          title: p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name,
          subtitle: `${cityLabel} · Klook 預訂`,
          url: klookLink(p.id),
          platform: 'klook',
          emoji: '✨',
        });
      });
    }
  }

  if (scanMode === 'receipt') {
    const query = `${cityLabel} 購物 優惠`;
    const products = searchProducts(query, region, 2);
    products.forEach(p => {
      recs.push({
        title: p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name,
        subtitle: `${cityLabel} · Klook 預訂`,
        url: klookLink(p.id),
        platform: 'klook',
        emoji: '🛍️',
      });
    });

    // KKDay shopping/transport — direct product link
    searchKKday('交通', region, 1).forEach(p => {
      recs.push({
        title: p.name,
        subtitle: 'KKday 預訂',
        url: kkdayLink(p.id),
        platform: 'kkday',
        emoji: '🎫',
      });
    });
  }

  if (scanMode === 'general') {
    const query = `${cityLabel} 景點 體驗`;
    const products = searchProducts(query, region, 1);
    products.forEach(p => {
      recs.push({
        title: p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name,
        subtitle: `${cityLabel} · Klook 預訂`,
        url: klookLink(p.id),
        platform: 'klook',
        emoji: '⛩️',
      });
    });
    // KKDay sightseeing — direct product link
    searchKKday('體驗', region, 1).forEach(p => {
      recs.push({
        title: p.name,
        subtitle: 'KKday 預訂',
        url: kkdayLink(p.id),
        platform: 'kkday',
        emoji: '🎌',
      });
    });
  }

  // Fallback: eSIM (always relevant, direct product link)
  if (recs.length < 3) {
    const esimProducts = searchProducts('日本 eSIM', null, 1);
    if (esimProducts.length > 0) {
      recs.push({
        title: esimProducts[0].name.length > 30 ? esimProducts[0].name.substring(0, 30) + '...' : esimProducts[0].name,
        subtitle: '免換卡・即買即用',
        url: klookLink(esimProducts[0].id),
        platform: 'klook',
        emoji: '📶',
      });
    }
  }

  return recs.slice(0, 3);
};

export { detectFromText, searchProducts, klookLink, kkdayLink };
