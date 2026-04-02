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

    const { data, error } = await supabase.from('users').upsert({
      anonymous_id: anonymousId,
      platform: 'ios',
      app_version: '1.0.0',
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
