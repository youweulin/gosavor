-- Run this in Supabase SQL Editor after the schema

-- Function to increment scan count atomically
CREATE OR REPLACE FUNCTION increment_scan_count(
  user_anonymous_id TEXT,
  scan_field TEXT
)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'UPDATE users SET %I = %I + 1, total_scans = total_scans + 1, last_active_at = now() WHERE anonymous_id = $1',
    scan_field, scan_field
  ) USING user_anonymous_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
