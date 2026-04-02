import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// =============================================
// Anonymous Auth
// =============================================

let currentUserId: string | null = null;

/** 匿名登入（App 啟動時自動呼叫，用戶無感） */
export const initAnonymousAuth = async (): Promise<string | null> => {
  try {
    // Check existing session
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      currentUserId = session.user.id;
      console.log('[GoSavor] Supabase: existing session', currentUserId?.substring(0, 8));
      // Ensure user record exists (might have failed before due to RLS)
      await createUserRecord(currentUserId);
      await updateLastActive();
      return currentUserId;
    }

    // No session → sign in anonymously
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('[GoSavor] Supabase anonymous auth error:', error.message);
      return null;
    }

    currentUserId = data.user?.id || null;
    console.log('[GoSavor] Supabase: new anonymous user', currentUserId?.substring(0, 8));

    // Create user record
    if (currentUserId) {
      await createUserRecord(currentUserId);
    }

    return currentUserId;
  } catch (err) {
    console.error('[GoSavor] Supabase init error:', err);
    return null;
  }
};

export const getCurrentUserId = () => currentUserId;

/** 取得用戶完整資訊 */
export const getUserProfile = async () => {
  if (!currentUserId) return null;
  try {
    const { data } = await supabase.from('users')
      .select('nickname, plan, credits, daily_usage, last_reset_date, total_scans, price_report_count')
      .eq('anonymous_id', currentUserId)
      .single();
    return data;
  } catch { return null; }
};

/** 取得暱稱 */
export const getNickname = async (): Promise<string> => {
  if (!currentUserId) return '旅人';
  try {
    const { data } = await supabase.from('users')
      .select('nickname')
      .eq('anonymous_id', currentUserId)
      .single();
    return data?.nickname || '旅人';
  } catch { return '旅人'; }
};

/** 更新暱稱 */
export const updateNickname = async (nickname: string): Promise<boolean> => {
  if (!currentUserId) return false;
  try {
    const { error } = await supabase.from('users')
      .update({ nickname })
      .eq('anonymous_id', currentUserId);
    if (error) { console.error('[GoSavor] Update nickname error:', error.message); return false; }
    return true;
  } catch { return false; }
};

// =============================================
// User Record
// =============================================

const createUserRecord = async (anonymousId: string) => {
  try {
    // Verify auth is working
    const { data: authData } = await supabase.auth.getUser();
    console.log('[GoSavor] Auth uid:', authData?.user?.id?.substring(0, 8), 'anonymous_id:', anonymousId.substring(0, 8));

    const { error } = await supabase.from('users').upsert({
      anonymous_id: anonymousId,
      platform: 'ios',
      app_version: '0.8.1',
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    }, { onConflict: 'anonymous_id' });

    if (error) {
      console.error('[GoSavor] Create user error:', error.message, error.details, error.hint);
    } else {
      console.log('[GoSavor] User record created/updated ✅');
    }
  } catch (err) {
    console.error('[GoSavor] Create user error:', err);
  }
};

const updateLastActive = async () => {
  if (!currentUserId) return;
  try {
    await supabase.from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('anonymous_id', currentUserId);
  } catch { /* silent */ }
};

// =============================================
// Redeem Code (兌換碼)
// =============================================

export interface RedeemResult {
  success: boolean;
  message: string;
  plan?: string;
  expiresAt?: string;
}

export const redeemCode = async (code: string): Promise<RedeemResult> => {
  if (!currentUserId) return { success: false, message: '請先開啟 App' };

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
    if (codeData.plan) {
      parts.push(`${codeData.plan === 'supporter' ? '贊助版' : '正式版'}開通（${codeData.duration_days}天）`);
    }
    if (codeData.bonus_credits > 0) {
      parts.push(`獲得 ${codeData.bonus_credits} 點翻譯點數`);
    }

    return {
      success: true,
      message: `✨ ${parts.join(' + ')}`,
      plan: codeData.plan || undefined,
      expiresAt: codeData.plan ? expiresAt.toISOString() : undefined,
    };
  } catch (err) {
    console.error('[GoSavor] Redeem error:', err);
    return { success: false, message: '兌換失敗，請稍後再試' };
  }
};

// =============================================
// Usage Tracking
// =============================================

/** 記錄掃描事件 + 更新用戶統計 */
export const trackScanEvent = async (scanMode: string, category?: string) => {
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

/** 正規化商品名（統一半形/全形/大小寫） */
const normalizeProductName = (name: string): string => {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_\.・]/g, '')
    .replace(/[０-９]/g, m =>
      String.fromCharCode(m.charCodeAt(0) - 0xFEE0));
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
}

/** 上傳價格報告（從收據掃描自動收集） */
export const submitPriceReport = async (report: PriceReportInput) => {
  if (!currentUserId) return;

  try {
    // Get user DB id
    const { data: user } = await supabase.from('users')
      .select('id')
      .eq('anonymous_id', currentUserId)
      .single();

    if (!user) return;

    const { error } = await supabase.from('price_reports').insert({
      product_name: report.productName,
      translated_name: report.translatedName || null,
      normalized_key: normalizeProductName(report.productName),
      price: report.price,
      currency: report.currency || 'JPY',
      store_name: report.storeName || null,
      store_branch: report.storeBranch || null,
      is_tax_free: report.isTaxFree || false,
      category: report.category || null,
      area: report.area || null,
      jan_code: report.janCode || null,
      user_id: user.id,
    });

    if (error) {
      console.error('[GoSavor] Price report error:', error.message);
    } else {
      console.log('[GoSavor] Price report saved:', report.productName, '¥' + report.price);
      // Update user's price report count
      await supabase.from('users')
        .update({ price_report_count: (user as any).price_report_count + 1 })
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
) => {
  for (const report of reports) {
    await submitPriceReport({
      ...report,
      storeName: report.storeName || storeName,
      storeBranch: report.storeBranch || storeBranch,
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
