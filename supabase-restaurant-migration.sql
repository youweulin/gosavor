-- GoSavor 餐廳地圖 Migration
-- Run in Supabase Dashboard → SQL Editor

-- 1. stores 加 type 欄位（區分藥妝/餐廳）
ALTER TABLE stores ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'drugstore';

-- 2. 新增 menu_reports 表（菜品資料，類似 price_reports）
CREATE TABLE IF NOT EXISTS menu_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  store_name TEXT,
  original_name TEXT NOT NULL,
  translated_name TEXT,
  price NUMERIC,
  currency TEXT DEFAULT '¥',
  category TEXT,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS
ALTER TABLE menu_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read menu reports" ON menu_reports
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert menu reports" ON menu_reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. 索引
CREATE INDEX IF NOT EXISTS idx_menu_reports_store ON menu_reports(store_id);
CREATE INDEX IF NOT EXISTS idx_stores_type ON stores(type);
