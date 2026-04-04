-- GoSavor 商品圖片資料庫 Migration
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jan_code TEXT UNIQUE,
  name TEXT NOT NULL,
  translated_name TEXT,
  image_url TEXT,
  brand TEXT,
  spec TEXT,
  category TEXT,
  rakuten_price NUMERIC,
  rakuten_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read products" ON products
  FOR SELECT USING (true);

CREATE POLICY "Service can insert products" ON products
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update products" ON products
  FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_products_jan ON products(jan_code);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
