-- Run in Supabase SQL Editor
-- 意見回饋系統

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL DEFAULT 'general',        -- bug, feature, general
  message TEXT NOT NULL,
  screenshot TEXT,                              -- base64 screenshot (optional)
  device_info JSONB,                            -- { platform, version, screen, userAgent }
  app_version TEXT DEFAULT '1.0.0',
  status TEXT DEFAULT 'new',                    -- new, read, resolved
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- 用戶只能新增自己的回饋
CREATE POLICY "Users can insert own feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用戶可以看自己的回饋
CREATE POLICY "Users can read own feedback"
  ON feedback FOR SELECT
  USING (auth.uid() = user_id);
