-- Run in Supabase SQL Editor
-- Atomic increment for daily usage (called by Cloudflare Worker)

CREATE OR REPLACE FUNCTION increment_daily_usage(user_anonymous_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET daily_usage = daily_usage + 1,
      last_active_at = now()
  WHERE anonymous_id = user_anonymous_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
