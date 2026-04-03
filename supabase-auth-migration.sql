-- GoSavor 帳號系統 Migration
-- 從匿名登入 → Email + Apple Sign In
-- Run in Supabase Dashboard → SQL Editor → New query

-- =============================================
-- 1. 新增欄位到 users 表
-- =============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';

-- email 索引（登入查詢用）
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================
-- 2. 更新 RLS 政策：改用 auth.uid()
-- （之前用 x-anonymous-id header，現在用 Supabase 內建 auth）
-- =============================================

-- 刪除舊政策
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;

-- 新政策：用 auth.uid() 對應 anonymous_id 欄位
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (anonymous_id = auth.uid()::text);

CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (anonymous_id = auth.uid()::text);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (anonymous_id = auth.uid()::text);

-- =============================================
-- 3. 更新 usage_events RLS（確保已登入用戶才能寫入）
-- =============================================
DROP POLICY IF EXISTS "Users can insert own events" ON usage_events;

CREATE POLICY "Users can insert own events" ON usage_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- 4. 更新 price_reports RLS
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can insert" ON price_reports;

CREATE POLICY "Authenticated users can insert" ON price_reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
