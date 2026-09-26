-- Phase 12: Capacity pricing plans ($60/$80/$120 USD) & custom nursery login prefix

ALTER TABLE nurseries
    ADD COLUMN login_id_prefix VARCHAR(32) NULL AFTER slug;

UPDATE nurseries
SET login_id_prefix = LOWER(slug)
WHERE login_id_prefix IS NULL;

-- Seed USD capacity pricing tiers
INSERT INTO plans (code, name, max_students, max_staff, price_minor, currency, billing_period, is_active)
SELECT * FROM (
    SELECT 'tier-50'  AS code, 'Starter (20–50)' AS name,  50 AS max_students, 10 AS max_staff,  6000 AS price_minor, 'USD' AS currency, 'monthly' AS billing_period, TRUE AS is_active
    UNION ALL SELECT 'tier-80',  'Growth (51–80)',  80, 20,  8000, 'USD', 'monthly', TRUE
    UNION ALL SELECT 'tier-120', 'Pro (81–120)',    120, 35, 12000, 'USD', 'monthly', TRUE
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE plans.code = seed.code);
