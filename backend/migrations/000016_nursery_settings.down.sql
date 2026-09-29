ALTER TABLE invoices ALTER COLUMN currency SET DEFAULT 'SEK';
ALTER TABLE subscription_invoices ALTER COLUMN currency SET DEFAULT 'SEK';
ALTER TABLE plans ALTER COLUMN currency SET DEFAULT 'SEK';

ALTER TABLE nurseries
    DROP COLUMN watermark_opacity,
    DROP COLUMN watermark_position,
    DROP COLUMN watermark_media_id,
    DROP COLUMN watermark_enabled,
    DROP COLUMN currency;
