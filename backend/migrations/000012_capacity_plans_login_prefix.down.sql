ALTER TABLE nurseries
    DROP COLUMN login_id_prefix;

DELETE FROM plans WHERE code IN ('tier-50', 'tier-80', 'tier-120');
