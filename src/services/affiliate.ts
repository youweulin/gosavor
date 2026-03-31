// Klook affiliate ID
const KLOOK_AID = '30600';

// Common Japanese city names to detect from restaurant/location names
const CITY_KEYWORDS: Record<string, string> = {
  '東京': '東京', 'tokyo': '東京', '新宿': '東京', '渋谷': '東京', '銀座': '東京',
  '池袋': '東京', '浅草': '東京', '淺草': '東京', '秋葉原': '東京', '上野': '東京',
  '原宿': '東京', '六本木': '東京', '品川': '東京', '台場': '東京',
  '大阪': '大阪', 'osaka': '大阪', '道頓堀': '大阪', '心斎橋': '大阪', '梅田': '大阪',
  '難波': '大阪', 'なんば': '大阪', '天王寺': '大阪',
  '京都': '京都', 'kyoto': '京都', '嵐山': '京都', '伏見': '京都', '祇園': '京都',
  '福岡': '福岡', 'fukuoka': '福岡', '博多': '福岡', '天神': '福岡',
  '札幌': '北海道', '北海道': '北海道', 'hokkaido': '北海道', '小樽': '北海道',
  '沖縄': '沖繩', '沖繩': '沖繩', 'okinawa': '沖繩', '那覇': '沖繩',
  '名古屋': '名古屋', 'nagoya': '名古屋',
  '神戸': '神戶', '神戶': '神戶', 'kobe': '神戶',
  '奈良': '奈良', 'nara': '奈良',
  '広島': '廣島', '廣島': '廣島', 'hiroshima': '廣島',
  '熊本': '熊本', '別府': '大分', '由布院': '大分',
};

// Detect city from text (restaurant name, location, etc.)
export const detectCity = (text: string): string | null => {
  const lower = text.toLowerCase();
  for (const [keyword, city] of Object.entries(CITY_KEYWORDS)) {
    if (lower.includes(keyword.toLowerCase())) {
      return city;
    }
  }
  return null;
};

// Detect context type from scan mode and content
type RecommendType = 'food' | 'shopping' | 'sightseeing' | 'general';

const detectType = (scanMode: string, merchantName?: string): RecommendType => {
  if (scanMode === 'receipt') {
    const shopKeywords = ['ファイン', 'ドラッグ', 'マツモト', 'ドン・キホーテ', 'ダイソー', 'ユニクロ', 'GU', 'ABCマート', 'ビックカメラ', 'ヨドバシ'];
    if (merchantName && shopKeywords.some(k => merchantName.includes(k))) return 'shopping';
    return 'shopping';
  }
  if (scanMode === 'general') return 'sightseeing';
  return 'food';
};

export interface Recommendation {
  title: string;
  subtitle: string;
  url: string;
  platform: 'klook' | 'kkday';
  emoji: string;
}

// Generate contextual recommendations
export const getRecommendations = (
  scanMode: string,
  restaurantName?: string,
  locationGuess?: string,
): Recommendation[] => {
  const text = restaurantName || locationGuess || '';
  const city = detectCity(text);
  const type = detectType(scanMode, text);
  const recs: Recommendation[] = [];

  const cityLabel = city || '日本';
  const klookSearch = (query: string) =>
    `https://www.klook.com/zh-TW/search/?query=${encodeURIComponent(query)}&aid=${KLOOK_AID}`;
  const kkdaySearch = (query: string) =>
    `https://www.kkday.com/zh-tw/product/productlist/?keyword=${encodeURIComponent(query)}`;

  if (type === 'food') {
    recs.push({
      title: `${cityLabel} 美食體驗`,
      subtitle: '當地人推薦的美食行程',
      url: klookSearch(`${cityLabel} 美食`),
      platform: 'klook',
      emoji: '🍽️',
    });
    if (city) {
      recs.push({
        title: `${cityLabel} 居酒屋/料理教室`,
        subtitle: '深度美食文化體驗',
        url: kkdaySearch(`${city} 美食體驗`),
        platform: 'kkday',
        emoji: '🍶',
      });
    }
  }

  if (type === 'shopping') {
    recs.push({
      title: `${cityLabel} 購物優惠`,
      subtitle: '折扣券・退稅・免稅店',
      url: klookSearch(`${cityLabel} 購物 優惠券`),
      platform: 'klook',
      emoji: '🛍️',
    });
  }

  if (type === 'sightseeing') {
    recs.push({
      title: `${cityLabel} 熱門景點`,
      subtitle: '門票・體驗・一日遊',
      url: klookSearch(`${cityLabel} 景點`),
      platform: 'klook',
      emoji: '⛩️',
    });
    recs.push({
      title: `${cityLabel} 特色體驗`,
      subtitle: '在地文化深度行程',
      url: kkdaySearch(`${city || '日本'} 體驗`),
      platform: 'kkday',
      emoji: '✨',
    });
  }

  // Always suggest essentials
  recs.push({
    title: '日本上網 eSIM',
    subtitle: '免換卡・即買即用',
    url: klookSearch('日本 eSIM'),
    platform: 'klook',
    emoji: '📶',
  });

  return recs.slice(0, 3); // Max 3 recommendations
};
