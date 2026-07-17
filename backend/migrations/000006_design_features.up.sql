-- Phase 6: design-driven features — classroom schedules, weekly learning
-- plans, report moods, per-user announcement archive.

CREATE TABLE classroom_schedule_items (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    classroom_id BIGINT UNSIGNED NOT NULL,
    weekday      TINYINT NOT NULL, -- 0=Sunday .. 6=Saturday (Go time.Weekday)
    starts_at    VARCHAR(8) NOT NULL, -- "09:00"
    title        VARCHAR(191) NOT NULL,
    description  VARCHAR(500) NULL,
    icon         VARCHAR(50) NULL,
    color        VARCHAR(20) NULL,
    sort         INT NOT NULL DEFAULT 0,
    created_at   DATETIME(3) NULL,
    updated_at   DATETIME(3) NULL,
    deleted_at   DATETIME(3) NULL,
    KEY idx_schedule_room_day (classroom_id, weekday),
    CONSTRAINT fk_schedule_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE weekly_plans (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    classroom_id BIGINT UNSIGNED NOT NULL,
    week_start   DATE NOT NULL,
    note         VARCHAR(1000) NULL,
    created_by   BIGINT UNSIGNED NOT NULL,
    created_at   DATETIME(3) NULL,
    updated_at   DATETIME(3) NULL,
    deleted_at   DATETIME(3) NULL,
    UNIQUE KEY ux_plan_room_week (classroom_id, week_start),
    CONSTRAINT fk_plan_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_plan_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE weekly_plan_items (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    weekly_plan_id BIGINT UNSIGNED NOT NULL,
    kind           ENUM('learning_area','activity','gain') NOT NULL,
    day            TINYINT NULL, -- 0=Sunday .. 6=Saturday; only for kind='activity'
    title          VARCHAR(191) NOT NULL,
    description    VARCHAR(500) NULL,
    icon           VARCHAR(50) NULL,
    color          VARCHAR(20) NULL,
    sort           INT NOT NULL DEFAULT 0,
    KEY idx_plan_item_plan (weekly_plan_id),
    CONSTRAINT fk_plan_item_plan FOREIGN KEY (weekly_plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE daily_reports ADD COLUMN moods_json JSON NULL AFTER home_tips_json;

ALTER TABLE announcement_reads ADD COLUMN archived_at DATETIME(3) NULL AFTER acknowledged_at;
