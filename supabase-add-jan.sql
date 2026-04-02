-- Add JAN Code column to price_reports
ALTER TABLE price_reports ADD COLUMN jan_code TEXT;
CREATE INDEX idx_price_jan ON price_reports(jan_code);
