-- Phase 11: SaaS subscriptions, seat caps, and per-nursery capabilities.
--
-- Deliberately separate from the existing `invoices` table: that one is
-- per-child tuition owed to the nursery and is tenant data. These tables are
-- what the nursery owes the platform. Conflating them would put platform
-- revenue inside the customer's own books.

CREATE TABLE IF NOT EXISTS plans (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(191) NOT NULL,
    max_students INT NOT NULL,
    max_staff INT NOT NULL DEFAULT 0,          -- 0 = unlimited
    price_minor BIGINT NOT NULL,               -- minor units, never floats
    currency VARCHAR(3) NOT NULL DEFAULT 'SEK',
    billing_period ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
    features_json JSON NULL,                   -- capability defaults
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    UNIQUE KEY ux_plans_code (code),
    INDEX idx_plans_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nursery_id BIGINT UNSIGNED NOT NULL,
    plan_id BIGINT UNSIGNED NOT NULL,
    status ENUM('trialing','active','past_due','suspended','cancelled') NOT NULL DEFAULT 'trialing',
    -- Copied from the plan on assignment so a superadmin can grant a
    -- per-nursery override without forking the plan itself.
    max_students INT NOT NULL,
    max_staff INT NOT NULL DEFAULT 0,
    current_period_start DATE NULL,
    current_period_end DATE NULL,
    trial_ends_at DATE NULL,
    grace_until DATE NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    UNIQUE KEY ux_subscriptions_nursery (nursery_id),
    INDEX idx_subscriptions_status (status),
    INDEX idx_subscriptions_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_invoices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nursery_id BIGINT UNSIGNED NOT NULL,
    subscription_id BIGINT UNSIGNED NOT NULL,
    invoice_no VARCHAR(30) NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'SEK',
    period VARCHAR(20) NOT NULL,               -- e.g. "2026-08"
    due_date DATE NOT NULL,
    status ENUM('due','paid','overdue','cancelled') NOT NULL DEFAULT 'due',
    paid_at DATETIME NULL,
    marked_paid_by BIGINT UNSIGNED NULL,       -- superadmin id; billing is manual
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    UNIQUE KEY ux_sub_invoices_no (invoice_no),
    INDEX idx_sub_invoices_nursery (nursery_id),
    INDEX idx_sub_invoices_status (status),
    INDEX idx_sub_invoices_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nursery_capabilities (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nursery_id BIGINT UNSIGNED NOT NULL,
    capability VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    granted_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_nursery_capability (nursery_id, capability)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the three default plans.
INSERT INTO plans (code, name, max_students, max_staff, price_minor, currency, billing_period, is_active)
SELECT * FROM (
    SELECT 'starter'    AS code, 'Starter'    AS name,  30 AS max_students,  6 AS max_staff,  99000 AS price_minor, 'SEK' AS currency, 'monthly' AS billing_period, TRUE AS is_active
    UNION ALL SELECT 'growth',     'Growth',     100, 20, 249000, 'SEK', 'monthly', TRUE
    UNION ALL SELECT 'enterprise', 'Enterprise', 500,  0, 599000, 'SEK', 'monthly', TRUE
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE plans.code = seed.code);

-- Put the existing nursery on Growth so the current install keeps working with
-- room to spare rather than tripping a cap the moment this ships.
INSERT INTO subscriptions (nursery_id, plan_id, status, max_students, max_staff, current_period_start, current_period_end)
SELECT 1, p.id, 'active', p.max_students, p.max_staff, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR)
FROM plans p
WHERE p.code = 'growth'
  AND EXISTS (SELECT 1 FROM nurseries WHERE id = 1)
  AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE nursery_id = 1);
