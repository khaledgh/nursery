ALTER TABLE announcement_reads DROP COLUMN archived_at;
ALTER TABLE daily_reports DROP COLUMN moods_json;
DROP TABLE IF EXISTS weekly_plan_items;
DROP TABLE IF EXISTS weekly_plans;
DROP TABLE IF EXISTS classroom_schedule_items;
