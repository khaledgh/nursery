-- Per-nursery settings that used to live in the platform-global settings table.
ALTER TABLE nurseries
    ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'USD' AFTER timezone,
    ADD COLUMN watermark_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER logo_media_id,
    ADD COLUMN watermark_media_id BIGINT UNSIGNED NULL AFTER watermark_enabled,
    ADD COLUMN watermark_position ENUM('bottom_right','bottom_left','top_right','top_left','center') NOT NULL DEFAULT 'bottom_right' AFTER watermark_media_id,
    ADD COLUMN watermark_opacity TINYINT UNSIGNED NOT NULL DEFAULT 60 AFTER watermark_position;

-- Keep the currency nurseries were already billing in (from the old global setting).
UPDATE nurseries n
JOIN settings s ON s.`key` = 'currency'
SET n.currency = UPPER(JSON_UNQUOTE(s.value_json))
WHERE CHAR_LENGTH(JSON_UNQUOTE(s.value_json)) = 3;

-- New rows default to USD instead of SEK.
ALTER TABLE plans ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE subscription_invoices ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE invoices ALTER COLUMN currency SET DEFAULT 'USD';
