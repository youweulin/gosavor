-- Run in Supabase SQL Editor
-- 兌換碼系統

CREATE TABLE redeem_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  plan TEXT,                                -- 開通的方案（null=不改方案）
  duration_days INT DEFAULT 90,             -- 方案有效天數
  bonus_credits INT DEFAULT 0,              -- 贈送點數
  max_uses INT DEFAULT 1,                   -- 最多可用次數
  used_count INT DEFAULT 0,                 -- 已使用次數
  is_active BOOLEAN DEFAULT true,           -- 是否啟用
  created_at TIMESTAMPTZ DEFAULT now(),
  note TEXT                                 -- 備註
);

-- 兌換紀錄
CREATE TABLE redeem_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID REFERENCES redeem_codes(id),
  user_id UUID REFERENCES users(id),
  redeemed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL           -- 到期時間
);

-- RLS
ALTER TABLE redeem_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE redeem_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active codes" ON redeem_codes
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can insert redeem history" ON redeem_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can read own history" ON redeem_history
  FOR SELECT USING (true);

-- 插入各種兌換碼
INSERT INTO redeem_codes (code, plan, duration_days, max_uses, note) VALUES
  -- 公測碼（贊助版，90天，可多人用）
  ('GOSAVOR2026', 'supporter', 90, 100, '公測通用碼'),
  ('BETA-TEST', 'supporter', 90, 10, '測試用'),

  -- VIP 碼（正式版，365天，限量）
  ('KEVIN-VIP', 'pro', 365, 1, 'Kevin 專用'),

  -- 合作推廣碼（贊助版，30天體驗）
  ('KLOOK-JP', 'supporter', 30, 50, 'Klook 合作推廣'),
  ('KKDAY-JP', 'supporter', 30, 50, 'KKDay 合作推廣'),

  -- 部落客/YouTuber 專用（正式版，180天）
  ('CREATOR-2026', 'pro', 180, 20, '創作者專用');

-- plan 權限對照：
-- supporter = 贊助版（解鎖自帶 Key，$199 等級）
-- pro       = 正式版（解鎖自帶 Key，$599 等級）
-- rental    = 旅遊包（系統 Key 50次/天）
