ALTER TABLE nurseries
    ADD COLUMN login_range_start BIGINT UNSIGNED NULL AFTER login_id_prefix,
    ADD COLUMN login_range_end BIGINT UNSIGNED NULL AFTER login_range_start;
