-- Phase 3: health module + development (milestones, achievements, daily reports).

CREATE TABLE allergies (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id   BIGINT UNSIGNED NOT NULL,
    name       VARCHAR(191) NOT NULL,
    severity   ENUM('mild','moderate','severe') NOT NULL DEFAULT 'mild',
    created_at DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    KEY idx_allergies_child (child_id),
    CONSTRAINT fk_allergies_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE illness_logs (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id    BIGINT UNSIGNED NOT NULL,
    title       VARCHAR(191) NOT NULL,
    status      ENUM('active','recovered','resolved') NOT NULL DEFAULT 'active',
    temperature FLOAT NULL,
    date        DATE NULL,
    note        VARCHAR(1000) NULL,
    created_at  DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    KEY idx_illness_child (child_id),
    CONSTRAINT fk_illness_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE medications (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id   BIGINT UNSIGNED NOT NULL,
    name       VARCHAR(191) NOT NULL,
    dosage     VARCHAR(100) NULL,
    schedule   VARCHAR(191) NULL,
    start_date DATE NULL,
    end_date   DATE NULL,
    active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    KEY idx_medications_child (child_id),
    CONSTRAINT fk_medications_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE immunizations (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id      BIGINT UNSIGNED NOT NULL,
    vaccine       VARCHAR(191) NOT NULL,
    given_date    DATE NULL,
    next_due_date DATE NULL,
    status        VARCHAR(30) NULL,
    created_at    DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    KEY idx_immunizations_child (child_id),
    CONSTRAINT fk_immunizations_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE checkups (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id   BIGINT UNSIGNED NOT NULL,
    type       VARCHAR(100) NOT NULL,
    date       DATE NULL,
    outcome    VARCHAR(500) NULL,
    doctor     VARCHAR(191) NULL,
    created_at DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    KEY idx_checkups_child (child_id),
    CONSTRAINT fk_checkups_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE growth_records (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id     BIGINT UNSIGNED NOT NULL,
    date         DATE NOT NULL,
    height_cm    FLOAT NULL,
    weight_kg    FLOAT NULL,
    head_circ_cm FLOAT NULL,
    created_at   DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    KEY idx_growth_child (child_id, date),
    CONSTRAINT fk_growth_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vital_logs (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id      BIGINT UNSIGNED NOT NULL,
    date          DATE NOT NULL,
    temperature   FLOAT NULL,
    mood          VARCHAR(30) NULL,
    energy        VARCHAR(30) NULL,
    appetite      VARCHAR(30) NULL,
    sleep_summary VARCHAR(191) NULL,
    created_at    DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    KEY idx_vitals_child (child_id, date),
    CONSTRAINT fk_vitals_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE emergency_contacts (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id   BIGINT UNSIGNED NOT NULL,
    name       VARCHAR(191) NOT NULL,
    relation   VARCHAR(50) NULL,
    phone      VARCHAR(32) NOT NULL,
    priority   INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    KEY idx_emergency_child (child_id),
    CONSTRAINT fk_emergency_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE insurance_infos (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id    BIGINT UNSIGNED NOT NULL,
    provider    VARCHAR(191) NOT NULL,
    policy_no   VARCHAR(100) NULL,
    status      VARCHAR(30) NULL,
    valid_until DATE NULL,
    created_at  DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    KEY idx_insurance_child (child_id),
    CONSTRAINT fk_insurance_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE medical_documents (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id   BIGINT UNSIGNED NOT NULL,
    media_id   BIGINT UNSIGNED NOT NULL,
    title      VARCHAR(191) NOT NULL,
    kind       VARCHAR(50) NULL,
    created_at DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    KEY idx_meddocs_child (child_id),
    CONSTRAINT fk_meddocs_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
    CONSTRAINT fk_meddocs_media FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE health_notes (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id    BIGINT UNSIGNED NOT NULL,
    title       VARCHAR(191) NOT NULL,
    body        VARCHAR(2000) NULL,
    authored_by BIGINT UNSIGNED NOT NULL,
    created_at  DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    KEY idx_healthnotes_child (child_id),
    CONSTRAINT fk_healthnotes_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE milestone_categories (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(191) NOT NULL,
    description VARCHAR(500) NULL,
    color       VARCHAR(20) NULL,
    icon        VARCHAR(50) NULL,
    created_at  DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE child_milestones (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id     BIGINT UNSIGNED NOT NULL,
    category_id  BIGINT UNSIGNED NOT NULL,
    progress_pct INT NOT NULL DEFAULT 0,
    description  VARCHAR(1000) NULL,
    status       VARCHAR(30) NOT NULL DEFAULT 'in_progress',
    assessed_by  BIGINT UNSIGNED NOT NULL,
    assessed_at  DATETIME(3) NOT NULL,
    created_at   DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    UNIQUE KEY ux_milestone_child_cat (child_id, category_id),
    CONSTRAINT fk_milestones_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
    CONSTRAINT fk_milestones_category FOREIGN KEY (category_id) REFERENCES milestone_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE achievement_templates (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(191) NOT NULL,
    description VARCHAR(500) NULL,
    icon        VARCHAR(50) NULL,
    color       VARCHAR(20) NULL,
    created_at  DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE child_achievements (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id                BIGINT UNSIGNED NOT NULL,
    achievement_template_id BIGINT UNSIGNED NOT NULL,
    awarded_date            DATE NOT NULL,
    note                    VARCHAR(500) NULL,
    awarded_by              BIGINT UNSIGNED NOT NULL,
    created_at              DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    KEY idx_achievements_child (child_id),
    CONSTRAINT fk_achievements_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
    CONSTRAINT fk_achievements_template FOREIGN KEY (achievement_template_id) REFERENCES achievement_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE daily_reports (
    id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id           BIGINT UNSIGNED NOT NULL,
    date               DATE NOT NULL,
    summary            VARCHAR(2000) NULL,
    highlight_text     VARCHAR(1000) NULL,
    highlight_media_id BIGINT UNSIGNED NULL,
    home_tips_json     JSON NULL,
    created_by         BIGINT UNSIGNED NOT NULL,
    created_at         DATETIME(3) NULL, updated_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
    UNIQUE KEY ux_report_child_date (child_id, date),
    CONSTRAINT fk_reports_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
    CONSTRAINT fk_reports_media FOREIGN KEY (highlight_media_id) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE report_ratings (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    daily_report_id BIGINT UNSIGNED NOT NULL,
    dimension       VARCHAR(30) NOT NULL,
    rating          ENUM('thriving','doing_well','improving','needs_support') NOT NULL,
    note            VARCHAR(500) NULL,
    UNIQUE KEY ux_rating_report_dim (daily_report_id, dimension),
    CONSTRAINT fk_report_ratings_report FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
