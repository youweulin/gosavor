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
const C = (id: string, title: string, cat: Product['category'], region: string, emoji: string, reason: string): Product =>
  ({ id, platform: 'klook', title, url: '', category: cat, region, emoji, reason });

const CURATED: Record<string, Product[]> = {
  Tokyo: [
    // 門票
    C('695', '東京迪士尼樂園/海洋門票', 'ticket', 'Tokyo', '🏰', '親子必去・即買即用'),
    C('2276', '三麗鷗彩虹樂園門票', 'ticket', 'Tokyo', '🎀', 'Hello Kitty 粉絲必去'),
    C('4911', '東京鐵塔瞭望台門票', 'ticket', 'Tokyo', '🗼', '東京地標・夜景超美'),
    C('5609', '品川水族館門票', 'ticket', 'Tokyo', '🐬', '品川站旁・親子推薦'),
    C('5563', '東京樂高樂園門票', 'ticket', 'Tokyo', '🧱', '親子室內景點'),
    // 一日遊
    C('601', '富士山箱根一日遊', 'tour', 'Tokyo', '🗻', '東京最熱門一日遊'),
    C('20405', '日光東照宮＆華嚴瀑布一日遊', 'tour', 'Tokyo', '⛩️', '世界遺產一日遊'),
    C('7891', '橫濱八景島海島樂園', 'tour', 'Tokyo', '🎡', '橫濱親子一日遊'),
    // 體驗
    C('2125', '淺草和服租賃＆攝影', 'food', 'Tokyo', '👘', '淺草文化體驗'),
    C('8318', '淺草和服體驗（站前店）', 'food', 'Tokyo', '👘', '淺草站前・方便'),
    // 交通
    C('1552', '東京地鐵一日/二日/三日券', 'transport', 'Tokyo', '🚇', '省交通費必備'),
    C('1420', 'JR Pass 全日本鐵路通票', 'transport', 'Tokyo', '🚄', '跨城市必備'),
    C('1418', 'JR Pass 東日本鐵路周遊券', 'transport', 'Tokyo', '🚃', '東日本旅遊'),
    C('9985', '箱根鎌倉周遊券', 'transport', 'Tokyo', '🎫', '箱根鎌倉一票到底'),
  ],
  Kansai: [
    // 門票
    C('598', '大阪海遊館門票', 'ticket', 'Kansai', '🐠', '大阪親子必去'),
    C('2424', '阿倍野展望台 HARUKAS 300', 'ticket', 'Kansai', '🌃', '大阪最高展望台'),
    C('1464', '京都塔門票', 'ticket', 'Kansai', '🗼', '京都地標'),
    // 一日遊
    C('3208', '伏見稻荷＆嵐山＆清水寺＆金閣寺一日遊', 'tour', 'Kansai', '⛩️', '京都經典全包'),
    C('2602', '六甲山＆有馬溫泉＆神戶三田 Outlets 一日遊', 'tour', 'Kansai', '♨️', '溫泉＋購物'),
    // 體驗
    C('1079', '京都和服租借（夢館）', 'food', 'Kansai', '👘', '京都最人氣和服店'),
    C('2826', '京都和服＆日式妝容＆拍攝', 'food', 'Kansai', '📸', '含攝影服務'),
    // 交通
    C('1512', '阪急 Tourist Pass', 'transport', 'Kansai', '🚃', '大阪京都神戶通用'),
    C('2969', 'JR Pass 高山北陸地區周遊券', 'transport', 'Kansai', '🚄', '白川鄉必備'),
    C('1420', 'JR Pass 全日本鐵路通票', 'transport', 'Kansai', '🚄', '跨城市必備'),
  ],
  Hokkaido: [
    // 門票
    C('1304', '札幌電視塔觀景台門票', 'ticket', 'Hokkaido', '🗼', '札幌地標'),
    C('14477', 'JR 塔展望室 T38 門票', 'ticket', 'Hokkaido', '🌃', '札幌夜景'),
    C('14723', '登別尼克斯海洋公園門票', 'ticket', 'Hokkaido', '🐧', '海洋動物表演'),
    C('37463', '千歲水族館門票', 'ticket', 'Hokkaido', '🐟', '新千歲機場旁'),
    // 一日遊
    C('4160', '旭山動物園＆精靈露臺＆美瑛一日遊', 'tour', 'Hokkaido', '🦊', '北海道最熱門一日遊'),
    C('15633', '旭山動物園＆美瑛雪樂園一日遊', 'tour', 'Hokkaido', '⛄', '冬季限定'),
    C('21262', '札幌旭山動物園＆美瑛自然之旅', 'tour', 'Hokkaido', '🏔', '自然風光'),
    // 體驗
    C('10139', '札幌美月櫻和服體驗', 'food', 'Hokkaido', '👘', '札幌和服'),
    C('15668', '蟹本家螃蟹料理（札幌站前）', 'food', 'Hokkaido', '🦀', '北海道必吃螃蟹'),
    // 交通
    C('3067', '北海道 JR Pass 鐵路周遊券', 'transport', 'Hokkaido', '🚃', '北海道交通必備'),
    C('1420', 'JR Pass 全日本鐵路通票', 'transport', 'Hokkaido', '🚄', '跨城市必備'),
  ],
  Kyushu: [
    // 門票
    C('19854', '福岡塔門票', 'ticket', 'Kyushu', '🗼', '福岡地標'),
    C('22209', '大分海洋宮殿水族館門票', 'ticket', 'Kyushu', '🐠', '大分親子景點'),
    C('35833', '九州國立博物館門票', 'ticket', 'Kyushu', '🏛', '太宰府旁'),
    C('37485', '城島高原公園門票', 'ticket', 'Kyushu', '🎢', '別府遊樂園'),
    C('37696', '鹿兒島水族館門票', 'ticket', 'Kyushu', '🐬', '鹿兒島親子'),
    // 一日遊（從資料看沒有直接的，用體驗替代）
    // 體驗
    C('1014', '福岡和服租借（太宰府/柳川）', 'food', 'Kyushu', '👘', '太宰府和服散步'),
    C('36138', '熊本水前寺和服體驗', 'food', 'Kyushu', '👘', '熊本文化體驗'),
    C('22549', '蟹本家螃蟹料理（福岡）', 'food', 'Kyushu', '🦀', '福岡必吃'),
    // 交通
    C('2371', 'JR Pass 全九州/南九州/北九州周遊券', 'transport', 'Kyushu', '🚃', '九州交通必備'),
    C('28320', '九州 SUNQ PASS 巴士券', 'transport', 'Kyushu', '🚌', '巴士走遍九州'),
    C('1420', 'JR Pass 全日本鐵路通票', 'transport', 'Kyushu', '🚄', '跨城市必備'),
  ],
  Okinawa: [
    // 門票
    C('1421', '美麗海水族館門票', 'ticket', 'Okinawa', '🐠', '沖繩必去No.1'),
    C('8900', '美麗海水族館五合一套票', 'ticket', 'Okinawa', '🎫', '五景點一票搞定'),
    C('13427', '琉球村門票', 'ticket', 'Okinawa', '🏯', '沖繩文化體驗'),
    C('13582', '東南植物樂園門票', 'ticket', 'Okinawa', '🌴', '熱帶植物園'),
    C('14671', '名護鳳梨園門票', 'ticket', 'Okinawa', '🍍', '鳳梨主題樂園'),
    C('29033', '古宇利海洋塔門票', 'ticket', 'Okinawa', '🌊', '古宇利島地標'),
    C('37791', '沖繩世界文化王國門票', 'ticket', 'Okinawa', '🦁', '鐘乳石洞＋文化村'),
    // 一日遊
    C('6489', '美之島觀光巴士一日遊', 'tour', 'Okinawa', '🚌', '那霸出發・輕鬆遊'),
    C('19157', '美麗海水族館＆美國村之旅', 'tour', 'Okinawa', '🏖', '水族館＋購物'),
    C('28134', '美麗海水族館一日遊巴士', 'tour', 'Okinawa', '🐋', '含交通最方便'),
    // 體驗
    C('6336', '沖繩浴衣＆和服租借', 'food', 'Okinawa', '👘', '沖繩風和服'),
  ],
  Nagoya: [
    // 門票
    C('1759', '名古屋港水族館門票', 'ticket', 'Nagoya', '🐬', '名古屋必去'),
    // 一日遊
    C('2598', '白川鄉＆飛驒高山巴士一日遊', 'tour', 'Nagoya', '🏔', '世界遺產合掌村'),
    C('14117', '高山＆白川鄉一日遊（含飛驒牛午餐）', 'tour', 'Nagoya', '🥩', '含和牛午餐'),
    C('121048', '白川鄉＆郡上八幡＆飛驒高山一日遊', 'tour', 'Nagoya', '⛩️', '三景點全包'),
    // 美食
    C('15649', '蟹本家螃蟹料理（名古屋站前）', 'food', 'Nagoya', '🦀', '名古屋必吃'),
    // 交通
    C('2969', 'JR Pass 高山北陸地區周遊券', 'transport', 'Nagoya', '🚄', '白川鄉必備'),
    C('1420', 'JR Pass 全日本鐵路通票', 'transport', 'Nagoya', '🚄', '跨城市必備'),
  ],
  Tohoku: [
    // 門票
    C('43404', '仙台海洋森林水族館門票', 'ticket', 'Tohoku', '🐟', '仙台親子景點'),
    C('92169', '會津若松城門票', 'ticket', 'Tohoku', '🏯', '東北名城'),
    C('86491', '松島博物館門票', 'ticket', 'Tohoku', '🏛', '日本三景'),
    // 一日遊
    C('103016', '藏王狐狸村＆銀山溫泉一日遊', 'tour', 'Tohoku', '🦊', '超可愛狐狸村'),
    C('93989', '鳴子峽紅葉＆銀山溫泉一日遊', 'tour', 'Tohoku', '🍁', '秋季限定'),
    // 交通
    C('9007', 'JR Pass 東北・南北海道周遊券', 'transport', 'Tohoku', '🚃', '東北交通必備'),
    C('1420', 'JR Pass 全日本鐵路通票', 'transport', 'Tohoku', '🚄', '跨城市必備'),
  ],
};

// Fill in affiliate URLs
Object.values(CURATED).flat().forEach(p => {
  if (!p.url) p.url = `https://www.klook.com/zh-TW/activity/${p.id}/?aid=${KLOOK_AID}`;
});

// === Scan mode → category priority ===
// 推「接下來想做的事」而不是「正在做的事」
const SCAN_PRIORITIES: Record<string, Product['category'][]> = {
  menu: ['ticket', 'tour', 'food'],        // 吃飽了 → 下午去景點/體驗
  receipt: ['food', 'ticket', 'tour'],     // 買完藥妝 → 餓了找吃的/逛景點
  general: ['food', 'tour', 'ticket'],     // 逛完景點 → 餓了找吃的/下一個行程
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
