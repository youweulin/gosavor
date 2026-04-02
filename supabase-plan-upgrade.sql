-- Run in Supabase SQL Editor
-- Add rental_expires column for 旅遊包到期時間

ALTER TABLE users ADD COLUMN IF NOT EXISTS rental_expires TIMESTAMPTZ;
