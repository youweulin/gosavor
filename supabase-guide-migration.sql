-- GoSavor 導遊碼系統 Migration
-- Run in Supabase Dashboard → SQL Editor

-- =============================================
-- 1. redeem_codes 加導遊相關欄位
-- =============================================
ALTER TABLE redeem_codes ADD COLUMN IF NOT EXISTS shared_api_key TEXT;
ALTER TABLE redeem_codes ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES users(id);

-- =============================================
-- 2. users 加導遊碼相關欄位
-- =============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS shared_api_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer_code TEXT;

-- =============================================
-- 3. 建立導遊碼範例（先建 Kevin 的）
-- =============================================
-- 注意：shared_api_key 要填導遊自己的 Gemini API Key
-- INSERT INTO redeem_codes (code, plan, duration_days, max_uses, shared_api_key, note)
-- VALUES ('KEVIN-TOUR', 'guide', 5, 200, 'AIzaSy...導遊的Key...', '導遊 Kevin 專用');
