-- Phase 5/6: payments + dynamic translation tables.

CREATE TABLE invoices (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id      BIGINT UNSIGNED NOT NULL,
    payer_user_id BIGINT UNSIGNED NOT NULL,
    invoice_no    VARCHAR(30) NOT NULL,
    currency      VARCHAR(3) NOT NULL DEFAULT 'SEK',
    total_minor   BIGINT NOT NULL,
    due_date      DATE NOT NULL,
    status        ENUM('due','paid','overdue','cancelled') NOT NULL DEFAULT 'due',
    period        VARCHAR(20) NULL,
    created_at    DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    UNIQUE KEY ux_invoices_no (invoice_no),
    KEY idx_invoices_child (child_id),
    KEY idx_invoices_payer (payer_user_id),
    KEY idx_invoices_status_due (status, due_date),
    CONSTRAINT fk_invoices_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
    CONSTRAINT fk_invoices_payer FOREIGN KEY (payer_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_items (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    invoice_id   BIGINT UNSIGNED NOT NULL,
    label        VARCHAR(191) NOT NULL,
    amount_minor BIGINT NOT NULL,
    KEY idx_invoice_items_invoice (invoice_id),
    CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    invoice_id       BIGINT UNSIGNED NOT NULL,
    provider         VARCHAR(20) NOT NULL,
    provider_ref     VARCHAR(100) NOT NULL,
    amount_minor     BIGINT NOT NULL,
    status           ENUM('pending','paid','declined','error') NOT NULL DEFAULT 'pending',
    paid_at          DATETIME(3) NULL,
    initiated_by     BIGINT UNSIGNED NOT NULL,
    raw_payload_json JSON NULL,
    created_at       DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    UNIQUE KEY ux_payments_ref (provider_ref),
    KEY idx_payments_invoice (invoice_id),
    CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Layer A: live-editable UI strings served as i18n bundles.
CREATE TABLE ui_translations (
    id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    locale    VARCHAR(10) NOT NULL,
    namespace VARCHAR(50) NOT NULL DEFAULT 'common',
    `key`     VARCHAR(191) NOT NULL,
    value     TEXT NOT NULL,
    UNIQUE KEY ux_ui_translations (locale, namespace, `key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Layer B: generic per-entity content translations (admins translate any
-- translatable entity without a redeploy).
CREATE TABLE content_translations (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id   BIGINT UNSIGNED NOT NULL,
    locale      VARCHAR(10) NOT NULL,
    field       VARCHAR(50) NOT NULL,
    value       TEXT NOT NULL,
    UNIQUE KEY ux_content_translations (entity_type, entity_id, locale, field)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
