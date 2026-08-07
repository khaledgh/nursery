-- Phase 10: Multi-tenancy.
--
-- Introduces the `nurseries` tenant root and stamps `nursery_id` onto every
-- table that is queried directly. Child rows reached only through a scoped
-- parent (invoice_items, report_ratings, guardians, ...) are deliberately left
-- alone: the parent is already scoped, so a column there would be cost without
-- safety. Platform-global tables (locales, settings, translations) are never
-- scoped.
--
-- All existing rows backfill to nursery 1 via the column DEFAULT, so this
-- migration is behaviour-preserving for the current single-nursery install.

CREATE TABLE IF NOT EXISTS nurseries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    contact_email VARCHAR(191) NULL,
    contact_phone VARCHAR(32) NULL,
    locale VARCHAR(10) NOT NULL DEFAULT 'en',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Stockholm',
    status ENUM('active','suspended','cancelled') NOT NULL DEFAULT 'active',
    logo_media_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    UNIQUE KEY ux_nurseries_slug (slug),
    INDEX idx_nurseries_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the tenant that owns all pre-existing data. Name comes from the existing
-- settings row when present so the install keeps its identity.
INSERT INTO nurseries (id, name, slug, status)
SELECT 1,
       COALESCE(
           NULLIF(TRIM(BOTH '"' FROM (SELECT value_json FROM settings WHERE `key` = 'nursery_name' LIMIT 1)), ''),
           'Little Talent Childcare'
       ),
       'default',
       'active'
WHERE NOT EXISTS (SELECT 1 FROM nurseries WHERE id = 1);

-- ---------------------------------------------------------------------------
-- nursery_id on every directly-queried table.
-- DEFAULT 1 backfills existing rows in place; the app always sets it explicitly.
-- ---------------------------------------------------------------------------

ALTER TABLE users                    ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_users_nursery (nursery_id);
ALTER TABLE children                 ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_children_nursery (nursery_id);
ALTER TABLE classrooms               ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_classrooms_nursery (nursery_id);
ALTER TABLE attendances              ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_attendances_nursery (nursery_id);
ALTER TABLE media                    ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_media_nursery (nursery_id);
ALTER TABLE audit_logs               ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_audit_logs_nursery (nursery_id);
ALTER TABLE notifications            ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_notifications_nursery (nursery_id);
ALTER TABLE device_tokens            ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_device_tokens_nursery (nursery_id);

-- care
ALTER TABLE diary_entries            ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_diary_entries_nursery (nursery_id);
ALTER TABLE meal_logs                ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_meal_logs_nursery (nursery_id);
ALTER TABLE hydration_logs           ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_hydration_logs_nursery (nursery_id);
ALTER TABLE sleep_logs               ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_sleep_logs_nursery (nursery_id);
ALTER TABLE diaper_logs              ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_diaper_logs_nursery (nursery_id);
ALTER TABLE weekly_menus             ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_weekly_menus_nursery (nursery_id);

-- health
ALTER TABLE allergies                ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_allergies_nursery (nursery_id);
ALTER TABLE illness_logs             ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_illness_logs_nursery (nursery_id);
ALTER TABLE medications              ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_medications_nursery (nursery_id);
ALTER TABLE immunizations            ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_immunizations_nursery (nursery_id);
ALTER TABLE checkups                 ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_checkups_nursery (nursery_id);
ALTER TABLE growth_records           ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_growth_records_nursery (nursery_id);
ALTER TABLE vital_logs               ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_vital_logs_nursery (nursery_id);
ALTER TABLE emergency_contacts       ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_emergency_contacts_nursery (nursery_id);
ALTER TABLE insurance_infos          ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_insurance_infos_nursery (nursery_id);
ALTER TABLE medical_documents        ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_medical_documents_nursery (nursery_id);
ALTER TABLE health_notes             ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_health_notes_nursery (nursery_id);

-- development
ALTER TABLE milestone_categories     ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_milestone_categories_nursery (nursery_id);
ALTER TABLE child_milestones         ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_child_milestones_nursery (nursery_id);
ALTER TABLE achievement_templates    ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_achievement_templates_nursery (nursery_id);
ALTER TABLE child_achievements       ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_child_achievements_nursery (nursery_id);
ALTER TABLE daily_reports            ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_daily_reports_nursery (nursery_id);

-- planning
ALTER TABLE classroom_schedule_items ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_sched_items_nursery (nursery_id);
ALTER TABLE weekly_plans             ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_weekly_plans_nursery (nursery_id);

-- engagement
ALTER TABLE events                   ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_events_nursery (nursery_id);
ALTER TABLE announcements            ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_announcements_nursery (nursery_id);
ALTER TABLE community_posts          ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_community_posts_nursery (nursery_id);
ALTER TABLE meetups                  ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_meetups_nursery (nursery_id);
ALTER TABLE reminders                ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_reminders_nursery (nursery_id);

-- money
ALTER TABLE invoices                 ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_invoices_nursery (nursery_id);
ALTER TABLE payments                 ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_payments_nursery (nursery_id);

-- chat
ALTER TABLE conversations            ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_conversations_nursery (nursery_id);
ALTER TABLE chat_messages            ADD COLUMN nursery_id BIGINT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX idx_chat_messages_nursery (nursery_id);

-- ---------------------------------------------------------------------------
-- Globally-unique keys become per-tenant. Without this, two nurseries cannot
-- both have a parent at the same email, and invoice numbering collides.
-- ---------------------------------------------------------------------------

ALTER TABLE users
    DROP INDEX ux_users_email,
    ADD UNIQUE KEY ux_users_nursery_email (nursery_id, email);

ALTER TABLE invoices
    DROP INDEX ux_invoices_no,
    ADD UNIQUE KEY ux_invoices_nursery_no (nursery_id, invoice_no);

-- ---------------------------------------------------------------------------
-- Login ID: the mobile credential. Globally unique so a single lookup resolves
-- both the user and their nursery, which is what removes the need to ask a
-- parent which nursery they belong to at login.
-- ---------------------------------------------------------------------------

ALTER TABLE users
    ADD COLUMN login_id VARCHAR(32) NULL AFTER email,
    ADD UNIQUE KEY ux_users_login_id (login_id);

-- Backfill every existing parent and teacher: '<slug>-<id>', lowercased.
UPDATE users u
JOIN nurseries n ON n.id = u.nursery_id
SET u.login_id = LOWER(CONCAT(n.slug, '-', u.id))
WHERE u.login_id IS NULL
  AND u.role IN ('parent', 'teacher');

-- ---------------------------------------------------------------------------
-- Superadmin tier. users.role is an ENUM, so a new role needs a schema change.
-- ---------------------------------------------------------------------------

ALTER TABLE users
    MODIFY COLUMN role ENUM('superadmin','admin','teacher','parent') NOT NULL;

-- ---------------------------------------------------------------------------
-- Close the soft-delete gap left by migration 000009: these three tables were
-- added without deleted_at, so GORM's soft delete silently did nothing.
-- ---------------------------------------------------------------------------

ALTER TABLE conversations              ADD COLUMN deleted_at DATETIME NULL, ADD INDEX idx_conversations_deleted_at (deleted_at);
ALTER TABLE chat_messages              ADD COLUMN deleted_at DATETIME NULL, ADD INDEX idx_chat_messages_deleted_at (deleted_at);
ALTER TABLE user_notification_settings ADD COLUMN deleted_at DATETIME NULL, ADD INDEX idx_user_notif_deleted_at (deleted_at);
