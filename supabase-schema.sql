-- GoSavor Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor → New query

-- =============================================
-- 1. USERS TABLE (極精簡，只存必要資訊)
-- =============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id TEXT UNIQUE NOT NULL,
  nickname TEXT DEFAULT '旅人',
  platform TEXT DEFAULT 'ios',
  device_model TEXT,
  app_version TEXT,
  target_language TEXT DEFAULT 'zh-Hant',
  has_own_api_key BOOLEAN DEFAULT false,

  -- 用量統計
  total_scans INT DEFAULT 0,
  menu_scans INT DEFAULT 0,
  receipt_scans INT DEFAULT 0,
  general_scans INT DEFAULT 0,
  ar_scans INT DEFAULT 0,
  chat_sessions INT DEFAULT 0,
  price_report_count INT DEFAULT 0,

  -- 付費（Phase 2 預留）
  plan TEXT DEFAULT 'free',
  credits INT DEFAULT 0,

  -- 用量控制
  daily_usage INT DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,

  -- 時間
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX idx_users_anonymous_id ON users(anonymous_id);
CREATE INDEX idx_users_created_at ON users(created_at);

-- RLS 政策：用戶只能讀寫自己的資料
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (anonymous_id = current_setting('request.headers')::json->>'x-anonymous-id');

-- =============================================
-- 2. PRICE REPORTS TABLE (核心資產)
-- =============================================
CREATE TABLE price_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  translated_name TEXT,
  normalized_key TEXT NOT NULL,
  price INT NOT NULL,
  currency TEXT DEFAULT 'JPY',
  store_name TEXT,
  store_branch TEXT,
  is_tax_free BOOLEAN DEFAULT false,
  category TEXT,
  area TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引（查詢加速）
CREATE INDEX idx_price_product ON price_reports(normalized_key);
CREATE INDEX idx_price_store ON price_reports(store_name);
CREATE INDEX idx_price_area ON price_reports(area);
CREATE INDEX idx_price_date ON price_reports(created_at);
CREATE INDEX idx_price_user ON price_reports(user_id);

-- RLS：任何人可讀，登入用戶可寫
ALTER TABLE price_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read price reports" ON price_reports
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert" ON price_reports
  FOR INSERT WITH CHECK (true);

-- =============================================
-- 3. USAGE EVENTS TABLE (行為追蹤，精簡版)
-- =============================================
CREATE TABLE usage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  event TEXT NOT NULL,
  scan_mode TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_user ON usage_events(user_id);
CREATE INDEX idx_events_date ON usage_events(created_at);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own events" ON usage_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can read own events" ON usage_events
  FOR SELECT USING (true);
