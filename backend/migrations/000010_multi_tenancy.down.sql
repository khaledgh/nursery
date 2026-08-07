-- Reverse of 000010. Restores the global unique keys before dropping
-- nursery_id, since ux_users_nursery_email depends on that column.

ALTER TABLE user_notification_settings DROP INDEX idx_user_notif_deleted_at, DROP COLUMN deleted_at;
ALTER TABLE chat_messages              DROP INDEX idx_chat_messages_deleted_at, DROP COLUMN deleted_at;
ALTER TABLE conversations              DROP INDEX idx_conversations_deleted_at, DROP COLUMN deleted_at;

-- Demote any superadmin before narrowing the enum, or the MODIFY truncates the
-- value to '' and leaves an unusable row.
UPDATE users SET role = 'admin' WHERE role = 'superadmin';
ALTER TABLE users MODIFY COLUMN role ENUM('admin','teacher','parent') NOT NULL;

ALTER TABLE users
    DROP INDEX ux_users_login_id,
    DROP COLUMN login_id;

ALTER TABLE invoices
    DROP INDEX ux_invoices_nursery_no,
    ADD UNIQUE KEY ux_invoices_no (invoice_no);

ALTER TABLE users
    DROP INDEX ux_users_nursery_email,
    ADD UNIQUE KEY ux_users_email (email);

ALTER TABLE chat_messages            DROP INDEX idx_chat_messages_nursery, DROP COLUMN nursery_id;
ALTER TABLE conversations            DROP INDEX idx_conversations_nursery, DROP COLUMN nursery_id;
ALTER TABLE payments                 DROP INDEX idx_payments_nursery, DROP COLUMN nursery_id;
ALTER TABLE invoices                 DROP INDEX idx_invoices_nursery, DROP COLUMN nursery_id;
ALTER TABLE reminders                DROP INDEX idx_reminders_nursery, DROP COLUMN nursery_id;
ALTER TABLE meetups                  DROP INDEX idx_meetups_nursery, DROP COLUMN nursery_id;
ALTER TABLE community_posts          DROP INDEX idx_community_posts_nursery, DROP COLUMN nursery_id;
ALTER TABLE announcements            DROP INDEX idx_announcements_nursery, DROP COLUMN nursery_id;
ALTER TABLE events                   DROP INDEX idx_events_nursery, DROP COLUMN nursery_id;
ALTER TABLE weekly_plans             DROP INDEX idx_weekly_plans_nursery, DROP COLUMN nursery_id;
ALTER TABLE classroom_schedule_items DROP INDEX idx_sched_items_nursery, DROP COLUMN nursery_id;
ALTER TABLE daily_reports            DROP INDEX idx_daily_reports_nursery, DROP COLUMN nursery_id;
ALTER TABLE child_achievements       DROP INDEX idx_child_achievements_nursery, DROP COLUMN nursery_id;
ALTER TABLE achievement_templates    DROP INDEX idx_achievement_templates_nursery, DROP COLUMN nursery_id;
ALTER TABLE child_milestones         DROP INDEX idx_child_milestones_nursery, DROP COLUMN nursery_id;
ALTER TABLE milestone_categories     DROP INDEX idx_milestone_categories_nursery, DROP COLUMN nursery_id;
ALTER TABLE health_notes             DROP INDEX idx_health_notes_nursery, DROP COLUMN nursery_id;
ALTER TABLE medical_documents        DROP INDEX idx_medical_documents_nursery, DROP COLUMN nursery_id;
ALTER TABLE insurance_infos          DROP INDEX idx_insurance_infos_nursery, DROP COLUMN nursery_id;
ALTER TABLE emergency_contacts       DROP INDEX idx_emergency_contacts_nursery, DROP COLUMN nursery_id;
ALTER TABLE vital_logs               DROP INDEX idx_vital_logs_nursery, DROP COLUMN nursery_id;
ALTER TABLE growth_records           DROP INDEX idx_growth_records_nursery, DROP COLUMN nursery_id;
ALTER TABLE checkups                 DROP INDEX idx_checkups_nursery, DROP COLUMN nursery_id;
ALTER TABLE immunizations            DROP INDEX idx_immunizations_nursery, DROP COLUMN nursery_id;
ALTER TABLE medications              DROP INDEX idx_medications_nursery, DROP COLUMN nursery_id;
ALTER TABLE illness_logs             DROP INDEX idx_illness_logs_nursery, DROP COLUMN nursery_id;
ALTER TABLE allergies                DROP INDEX idx_allergies_nursery, DROP COLUMN nursery_id;
ALTER TABLE weekly_menus             DROP INDEX idx_weekly_menus_nursery, DROP COLUMN nursery_id;
ALTER TABLE diaper_logs              DROP INDEX idx_diaper_logs_nursery, DROP COLUMN nursery_id;
ALTER TABLE sleep_logs               DROP INDEX idx_sleep_logs_nursery, DROP COLUMN nursery_id;
ALTER TABLE hydration_logs           DROP INDEX idx_hydration_logs_nursery, DROP COLUMN nursery_id;
ALTER TABLE meal_logs                DROP INDEX idx_meal_logs_nursery, DROP COLUMN nursery_id;
ALTER TABLE diary_entries            DROP INDEX idx_diary_entries_nursery, DROP COLUMN nursery_id;
ALTER TABLE device_tokens            DROP INDEX idx_device_tokens_nursery, DROP COLUMN nursery_id;
ALTER TABLE notifications            DROP INDEX idx_notifications_nursery, DROP COLUMN nursery_id;
ALTER TABLE audit_logs               DROP INDEX idx_audit_logs_nursery, DROP COLUMN nursery_id;
ALTER TABLE media                    DROP INDEX idx_media_nursery, DROP COLUMN nursery_id;
ALTER TABLE attendances              DROP INDEX idx_attendances_nursery, DROP COLUMN nursery_id;
ALTER TABLE classrooms               DROP INDEX idx_classrooms_nursery, DROP COLUMN nursery_id;
ALTER TABLE children                 DROP INDEX idx_children_nursery, DROP COLUMN nursery_id;
ALTER TABLE users                    DROP INDEX idx_users_nursery, DROP COLUMN nursery_id;

DROP TABLE IF EXISTS nurseries;
