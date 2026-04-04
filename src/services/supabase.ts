import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// =============================================
// Auth Helper
// =============================================

/** 取得目前登入的用戶 ID（從 Supabase session） */
export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch { return null; }
};

/** 取得用戶完整資訊 */
export const getUserProfile = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  try {
    const { data } = await supabase.from('users')
      .select('nickname, plan, credits, daily_usage, last_reset_date, total_scans, price_report_count, email, auth_provider, shared_api_key, referrer_code')
      .eq('anonymous_id', userId)
      .single();
    return data;
  } catch { return null; }
};

/** 取得暱稱 */
export const getNickname = async (): Promise<string> => {
  const userId = await getCurrentUserId();
  if (!userId) return '旅人';
  try {
    const { data } = await supabase.from('users')
      .select('nickname')
      .eq('anonymous_id', userId)
      .single();
    return data?.nickname || '旅人';
  } catch { return '旅人'; }
};

/** 更新暱稱 */
export const updateNickname = async (nickname: string): Promise<boolean> => {
  const userId = await getCurrentUserId();
  if (!userId) return false;
  try {
    const { error } = await supabase.from('users')
      .update({ nickname })
      .eq('anonymous_id', userId);
    if (error) { console.error('[GoSavor] Update nickname error:', error.message); return false; }
    return true;
  } catch { return false; }
};

// =============================================
// Redeem Code (兌換碼)
// =============================================

export interface RedeemResult {
  success: boolean;
  message: string;
  plan?: string;
  expiresAt?: string;
  guideName?: string;
}

export const redeemCode = async (code: string): Promise<RedeemResult> => {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return { success: false, message: '請先登入' };

  try {
    // 1. Find code
    const { data: codeData, error: codeErr } = await supabase
      .from('redeem_codes')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    if (codeErr || !codeData) return { success: false, message: '無效的兌換碼' };

    // 2. Check usage limit
    if (codeData.used_count >= codeData.max_uses) {
      return { success: false, message: '此兌換碼已達使用上限' };
    }

    // 3. Get user
    const { data: user } = await supabase
      .from('users')
      .select('id, plan')
      .eq('anonymous_id', currentUserId)
      .single();

    if (!user) return { success: false, message: '用戶不存在' };

    // 4. Check if already redeemed
    const { data: existing } = await supabase
      .from('redeem_history')
      .select('id')
      .eq('code_id', codeData.id)
      .eq('user_id', user.id);

    if (existing && existing.length > 0) {
      return { success: false, message: '你已經使用過此兌換碼' };
    }

    // 5. Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + codeData.duration_days);

    // 6. Record redemption
    await supabase.from('redeem_history').insert({
      code_id: codeData.id,
      user_id: user.id,
      expires_at: expiresAt.toISOString(),
    });

    // 7. Increment used count
    await supabase.from('redeem_codes')
      .update({ used_count: codeData.used_count + 1 })
      .eq('id', codeData.id);

    // 8. Update user
    const userUpdates: any = {};

    // Update plan if code has one
    if (codeData.plan) {
      userUpdates.plan = codeData.plan;
      userUpdates.rental_expires = expiresAt.toISOString();
    }

    // 導遊碼：帶入共用 API Key + referrer_code
    if (codeData.shared_api_key) {
      userUpdates.shared_api_key = codeData.shared_api_key;
    }
    userUpdates.referrer_code = codeData.code;

    // Add bonus credits
    if (codeData.bonus_credits > 0) {
      // Get current credits first
      const { data: currentUser } = await supabase.from('users')
        .select('credits')
        .eq('anonymous_id', currentUserId)
        .single();
      userUpdates.credits = (currentUser?.credits || 0) + codeData.bonus_credits;
    }

    if (Object.keys(userUpdates).length > 0) {
      await supabase.from('users')
        .update(userUpdates)
        .eq('anonymous_id', currentUserId);
    }

    // Build success message
    const parts: string[] = [];
    const planNames: Record<string, string> = {
      supporter: '贊助版', pro: '正式版', beta: '公測版',
      guide: '導遊版', 'guide-member': '旅遊團',
    };
    if (codeData.plan) {
      const name = planNames[codeData.plan] || codeData.plan;
      // guide-member: 顯示「導遊XX贊助版」
      const guideLabel = codeData.plan === 'guide-member' && codeData.note
        ? `導遊${codeData.note.split('·')[0].trim()}贊助版`
        : name;
      parts.push(`${guideLabel}開通（${codeData.duration_days}天）`);
    }
    if (codeData.bonus_credits > 0) {
      parts.push(`獲得 ${codeData.bonus_credits} 點翻譯點數`);
    }

    // Extract guide name from note (format: "Kevin · 2026/4/4")
    const guideName = codeData.plan === 'guide-member' && codeData.note
      ? codeData.note.split('·')[0].trim()
      : undefined;

    return {
      success: true,
      message: `✨ ${parts.join(' + ')}`,
      plan: codeData.plan || undefined,
      expiresAt: codeData.plan ? expiresAt.toISOString() : undefined,
      guideName,
    };
  } catch (err) {
    console.error('[GoSavor] Redeem error:', err);
    return { success: false, message: '兌換失敗，請稍後再試' };
  }
};

// =============================================
// Guide Tour Code (導遊生成團員碼)
// =============================================

export interface TourCodeInfo {
  code: string;
  used_count: number;
  max_uses: number;
  duration_days: number;
  is_active: boolean;
  created_at: string;
}

/** 查詢導遊已生成的團員碼 */
export const getGuideTourCodes = async (): Promise<TourCodeInfo[]> => {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return [];
  try {
    const { data: user } = await supabase.from('users')
      .select('id')
      .eq('anonymous_id', currentUserId)
      .single();
    if (!user) return [];

    const { data } = await supabase.from('redeem_codes')
      .select('code, used_count, max_uses, duration_days, is_active, created_at')
      .eq('referrer_id', user.id)
      .eq('plan', 'guide-member')
      .order('created_at', { ascending: false })
      .limit(10);

    return data || [];
  } catch { return []; }
};

export interface GenerateTourCodeResult {
  success: boolean;
  code?: string;
  message: string;
}

/** 導遊生成團員兌換碼（綁自己的 API Key） */
export const generateTourCode = async (apiKey: string, durationDays = 5, maxUses = 40): Promise<GenerateTourCodeResult> => {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return { success: false, message: '請先登入' };

  try {
    // Get guide's user DB id + nickname
    const { data: user } = await supabase.from('users')
      .select('id, plan, nickname')
      .eq('anonymous_id', currentUserId)
      .single();

    if (!user || user.plan !== 'guide') {
      return { success: false, message: '僅限導遊使用' };
    }
    const guideName = user.nickname || '導遊';

    // Generate code: TOUR-MMDD-XXXX
    const now = new Date();
    const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `TOUR-${mmdd}-${randomPart}`;

    // Insert into redeem_codes
    const { error } = await supabase.from('redeem_codes').insert({
      code,
      plan: 'guide-member',
      duration_days: durationDays,
      max_uses: maxUses,
      shared_api_key: apiKey,
      referrer_id: user.id,
      is_active: true,
      note: `${guideName} · ${new Date().toLocaleDateString()}`,
    });

    if (error) {
      // Duplicate code? retry once
      if (error.code === '23505') {
        const retry = `TOUR-${mmdd}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        await supabase.from('redeem_codes').insert({
          code: retry,
          plan: 'guide-member',
          duration_days: durationDays,
          max_uses: maxUses,
          shared_api_key: apiKey,
          referrer_id: user.id,
          is_active: true,
          note: `${guideName} · ${new Date().toLocaleDateString()}`,
        });
        return { success: true, code: retry, message: `團員碼已生成：${retry}` };
      }
      return { success: false, message: error.message };
    }

    return { success: true, code, message: `團員碼已生成：${code}` };
  } catch (err) {
    console.error('[GoSavor] Generate tour code error:', err);
    return { success: false, message: '生成失敗，請稍後再試' };
  }
};

// =============================================
// Usage Tracking
// =============================================

/** 記錄掃描事件 + 更新用戶統計 */
export const trackScanEvent = async (scanMode: string, category?: string) => {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return;

  try {
    // 1. Get user's DB id
    const { data: user } = await supabase.from('users')
      .select('id')
      .eq('anonymous_id', currentUserId)
      .single();

    if (!user) return;

    // 2. Insert usage event
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event: 'scan',
      scan_mode: scanMode,
      category: category || null,
    });

    // 3. Update user scan counts
    const field = scanMode === 'menu' ? 'menu_scans'
      : scanMode === 'receipt' ? 'receipt_scans'
      : scanMode === 'ar-translate' ? 'ar_scans'
      : 'general_scans';

    await supabase.rpc('increment_scan_count', {
      user_anonymous_id: currentUserId,
      scan_field: field,
    });

    console.log('[GoSavor] Tracked:', scanMode, category || '');
  } catch (err) {
    // Don't crash app if tracking fails
    console.warn('[GoSavor] Track error:', err);
  }
};

// =============================================
// Price Reports (核心資產)
// =============================================

/** 正規化名稱（統一半形/全形/大小寫） */
const normalizeName = (name: string): string => {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_\.・]/g, '')
    .replace(/[０-９]/g, m =>
      String.fromCharCode(m.charCodeAt(0) - 0xFEE0));
};
const normalizeProductName = normalizeName;

/** 店家歸戶：同名+近距離(100m內) → 同一家店 */
const findOrCreateStore = async (
  storeName: string,
  storeBranch?: string,
  lat?: number,
  lng?: number,
  isTaxFree?: boolean,
): Promise<string | null> => {
  if (!storeName) return null;
  const normalized = normalizeName(storeName + (storeBranch || ''));

  try {
    // 先用 normalized_name 查有沒有已知店家
    const { data: existing } = await supabase.from('stores')
      .select('id, lat, lng, report_count')
      .eq('normalized_name', normalized)
      .limit(1)
      .single();

    if (existing) {
      // 更新統計 + GPS（取最新的座標，或補上之前缺的）
      const updates: Record<string, unknown> = {
        report_count: (existing.report_count || 0) + 1,
        last_reported_at: new Date().toISOString(),
      };
      if (lat && lng && !existing.lat) {
        updates.lat = lat;
        updates.lng = lng;
      }
      if (isTaxFree) updates.is_tax_free = true;
      await supabase.from('stores').update(updates).eq('id', existing.id);
      return existing.id;
    }

    // 新店家 → 建立
    const { data: newStore } = await supabase.from('stores').insert({
      name: storeName,
      branch: storeBranch || null,
      normalized_name: normalized,
      lat: lat || null,
      lng: lng || null,
      is_tax_free: isTaxFree || false,
      report_count: 1,
    }).select('id').single();

    return newStore?.id || null;
  } catch {
    return null;
  }
};

export interface PriceReportInput {
  productName: string;
  translatedName?: string;
  price: number;
  currency?: string;
  storeName?: string;
  storeBranch?: string;
  isTaxFree?: boolean;
  category?: string;
  area?: string;
  janCode?: string;
  storeLat?: number;
  storeLng?: number;
  receiptDate?: string;
}

/** 上傳價格報告（從收據掃描自動收集，自動店家歸戶） */
export const submitPriceReport = async (report: PriceReportInput) => {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    console.warn('[GoSavor] Price report skipped: 用戶未登入');
    return;
  }

  try {
    // Get user DB id
    const { data: user, error: userError } = await supabase.from('users')
      .select('id, price_report_count')
      .eq('anonymous_id', currentUserId)
      .single();

    if (!user) {
      console.warn('[GoSavor] Price report skipped: users 表找不到用戶', currentUserId, userError?.message);
      return;
    }

    // 店家歸戶：自動找到或建立店家記錄
    const storeId = await findOrCreateStore(
      report.storeName || '',
      report.storeBranch,
      report.storeLat,
      report.storeLng,
      report.isTaxFree,
    );

    const { error } = await supabase.from('price_reports').insert({
      product_name: report.productName,
      translated_name: report.translatedName || null,
      normalized_key: normalizeProductName(report.productName),
      price: report.price,
      currency: report.currency || 'JPY',
      store_id: storeId,
      store_name: report.storeName || null,
      store_branch: report.storeBranch || null,
      is_tax_free: report.isTaxFree || false,
      category: report.category || null,
      area: report.area || null,
      jan_code: report.janCode || null,
      store_lat: report.storeLat || null,
      store_lng: report.storeLng || null,
      receipt_date: report.receiptDate || null,
      user_id: user.id,
    });

    if (error) {
      console.error('[GoSavor] Price report error:', error.message);
    } else {
      console.log('[GoSavor] Price report saved:', report.productName, '¥' + report.price);
      // Update user's price report count
      await supabase.from('users')
        .update({ price_report_count: (user.price_report_count || 0) + 1 })
        .eq('anonymous_id', currentUserId);
    }
  } catch (err) {
    console.warn('[GoSavor] Price report error:', err);
  }
};

/** 批次上傳價格報告（一張收據多個品項） */
export const submitPriceReports = async (
  reports: PriceReportInput[],
  storeName?: string,
  storeBranch?: string,
  storeLat?: number,
  storeLng?: number,
  receiptDate?: string,
) => {
  for (const report of reports) {
    await submitPriceReport({
      ...report,
      storeName: report.storeName || storeName,
      storeBranch: report.storeBranch || storeBranch,
      storeLat: report.storeLat ?? storeLat,
      storeLng: report.storeLng ?? storeLng,
      receiptDate: report.receiptDate || receiptDate,
    });
  }
};

// =============================================
// Price Comparison (比價查詢)
// =============================================

export interface PriceCompareResult {
  store_name: string;
  store_branch: string | null;
  price: number;
  is_tax_free: boolean;
  jan_code: string | null;
  created_at: string;
}

export interface ProductRanking {
  translated_name: string;
  product_name: string;
  jan_code: string | null;
  normalized_key: string;
  report_count: number;
  min_price: number;
  max_price: number;
  avg_price: number;
}

/** 用 JAN Code 或商品名查比價 */
export const comparePrices = async (
  janCode?: string,
  productName?: string,
): Promise<PriceCompareResult[]> => {
  try {
    let query = supabase
      .from('price_reports')
      .select('store_name, store_branch, price, is_tax_free, jan_code, created_at')
      .order('price', { ascending: true });

    if (janCode) {
      query = query.eq('jan_code', janCode);
    } else if (productName) {
      const key = normalizeProductName(productName);
      query = query.eq('normalized_key', key);
    } else {
      return [];
    }

    const { data, error } = await query;
    if (error) { console.error('[GoSavor] Compare error:', error.message); return []; }
    return data || [];
  } catch { return []; }
};

/** 用 JAN Code 查商品摘要 */
export const getProductSummary = async (janCode: string) => {
  try {
    const { data, error } = await supabase
      .from('price_reports')
      .select('translated_name, product_name, price, store_name, store_branch, is_tax_free, created_at')
      .eq('jan_code', janCode)
      .order('price', { ascending: true });

    if (error || !data || data.length === 0) return null;

    const prices = data.map(d => d.price);
    return {
      translatedName: data[0].translated_name,
      productName: data[0].product_name,
      janCode,
      reportCount: data.length,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      stores: data,
    };
  } catch { return null; }
};

/** 熱門商品排行榜 TOP N */
export const getPopularProducts = async (limit = 20): Promise<ProductRanking[]> => {
  try {
    const { data, error } = await supabase.rpc('get_popular_products', { result_limit: limit });
    if (error) {
      // Fallback: simple query if RPC not available
      console.warn('[GoSavor] RPC fallback:', error.message);
      const { data: fallback } = await supabase
        .from('price_reports')
        .select('translated_name, product_name, jan_code, normalized_key, price')
        .not('jan_code', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!fallback) return [];

      // Client-side aggregation
      const grouped: Record<string, ProductRanking> = {};
      for (const row of fallback) {
        const key = row.jan_code || row.normalized_key;
        if (!grouped[key]) {
          grouped[key] = {
            translated_name: row.translated_name,
            product_name: row.product_name,
            jan_code: row.jan_code,
            normalized_key: row.normalized_key,
            report_count: 0,
            min_price: row.price,
            max_price: row.price,
            avg_price: 0,
          };
        }
        const g = grouped[key];
        g.report_count++;
        g.min_price = Math.min(g.min_price, row.price);
        g.max_price = Math.max(g.max_price, row.price);
        g.avg_price = Math.round(((g.avg_price * (g.report_count - 1)) + row.price) / g.report_count);
      }

      return Object.values(grouped)
        .sort((a, b) => b.report_count - a.report_count)
        .slice(0, limit);
    }
    return data || [];
  } catch { return []; }
};

/** 搜尋商品（模糊搜尋） */
export const searchProducts = async (query: string): Promise<ProductRanking[]> => {
  try {
    const { data, error } = await supabase
      .from('price_reports')
      .select('translated_name, product_name, jan_code, normalized_key, price')
      .or(`translated_name.ilike.%${query}%,product_name.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];

    // Client-side aggregation
    const grouped: Record<string, ProductRanking> = {};
    for (const row of data) {
      const key = row.jan_code || row.normalized_key;
      if (!grouped[key]) {
        grouped[key] = {
          translated_name: row.translated_name,
          product_name: row.product_name,
          jan_code: row.jan_code,
          normalized_key: row.normalized_key,
          report_count: 0, min_price: row.price, max_price: row.price, avg_price: 0,
        };
      }
      const g = grouped[key];
      g.report_count++;
      g.min_price = Math.min(g.min_price, row.price);
      g.max_price = Math.max(g.max_price, row.price);
      g.avg_price = Math.round(((g.avg_price * (g.report_count - 1)) + row.price) / g.report_count);
    }

    return Object.values(grouped).sort((a, b) => b.report_count - a.report_count);
  } catch { return []; }
};

// =============================================
// Store Map (地圖查詢)
// =============================================

export interface StoreWithProducts {
  id: string;
  name: string;
  branch: string | null;
  lat: number;
  lng: number;
  is_tax_free: boolean;
  report_count: number;
  last_reported_at: string;
  topProducts?: { name: string; translatedName: string; price: number; janCode: string }[];
}

/** 查詢附近店家（含熱門商品） */
export const getNearbyStores = async (
  lat: number,
  lng: number,
  radiusKm = 2,
): Promise<StoreWithProducts[]> => {
  try {
    // 粗略的經緯度範圍過濾（1度 ≈ 111km）
    const delta = radiusKm / 111;
    const { data: stores, error } = await supabase
      .from('stores')
      .select('*')
      .gte('lat', lat - delta)
      .lte('lat', lat + delta)
      .gte('lng', lng - delta)
      .lte('lng', lng + delta)
      .order('report_count', { ascending: false })
      .limit(50);

    if (error || !stores) return [];

    // 為每家店查 TOP 3 熱門商品
    const storesWithProducts: StoreWithProducts[] = [];
    for (const store of stores) {
      const { data: products } = await supabase
        .from('price_reports')
        .select('product_name, translated_name, price, jan_code')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // 去重取 TOP 3
      const seen = new Set<string>();
      const topProducts: StoreWithProducts['topProducts'] = [];
      for (const p of products || []) {
        const key = p.jan_code || p.product_name;
        if (!seen.has(key)) {
          seen.add(key);
          topProducts.push({
            name: p.product_name,
            translatedName: p.translated_name || p.product_name,
            price: p.price,
            janCode: p.jan_code || '',
          });
          if (topProducts.length >= 3) break;
        }
      }

      storesWithProducts.push({
        id: store.id,
        name: store.name,
        branch: store.branch,
        lat: store.lat,
        lng: store.lng,
        is_tax_free: store.is_tax_free,
        report_count: store.report_count,
        last_reported_at: store.last_reported_at,
        topProducts,
      });
    }

    return storesWithProducts;
  } catch { return []; }
};

/** 取得所有店家（不限距離，用於瀏覽模式） */
export const getAllStores = async (): Promise<StoreWithProducts[]> => {
  try {
    const { data: stores, error } = await supabase
      .from('stores')
      .select('*')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('report_count', { ascending: false })
      .limit(100);

    if (error || !stores) return [];

    return stores.map(store => ({
      id: store.id,
      name: store.name,
      branch: store.branch,
      lat: store.lat,
      lng: store.lng,
      is_tax_free: store.is_tax_free,
      report_count: store.report_count,
      last_reported_at: store.last_reported_at,
    }));
  } catch { return []; }
};
