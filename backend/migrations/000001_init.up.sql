-- Phase 0/1 schema: identity, children, classrooms, attendance, platform.
-- Conventions: BIGINT UNSIGNED PKs, utf8mb4, soft deletes via deleted_at.

CREATE TABLE media (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    disk        ENUM('local','s3') NOT NULL,
    path        VARCHAR(500) NOT NULL,
    url         VARCHAR(500) NOT NULL,
    mime        VARCHAR(100) NOT NULL,
    size        BIGINT NOT NULL,
    width       INT NULL,
    height      INT NULL,
    uploaded_by BIGINT UNSIGNED NOT NULL,
    created_at  DATETIME(3) NULL,
    updated_at  DATETIME(3) NULL,
    deleted_at  DATETIME(3) NULL,
    KEY idx_media_uploaded_by (uploaded_by),
    KEY idx_media_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(191) NOT NULL,
    email         VARCHAR(191) NOT NULL,
    phone         VARCHAR(32) NULL,
    password_hash VARCHAR(191) NOT NULL,
    role          ENUM('admin','teacher','parent') NOT NULL,
    locale        VARCHAR(10) NOT NULL DEFAULT 'en',
    avatar_id     BIGINT UNSIGNED NULL,
    status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
    last_login_at DATETIME(3) NULL,
    created_at    DATETIME(3) NULL,
    updated_at    DATETIME(3) NULL,
    deleted_at    DATETIME(3) NULL,
    UNIQUE KEY ux_users_email (email),
    KEY idx_users_deleted_at (deleted_at),
    CONSTRAINT fk_users_avatar FOREIGN KEY (avatar_id) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id          BIGINT UNSIGNED NOT NULL,
    token_hash       VARCHAR(64) NOT NULL,
    device_info      VARCHAR(255) NULL,
    expires_at       DATETIME(3) NOT NULL,
    revoked_at       DATETIME(3) NULL,
    replaced_by_hash VARCHAR(64) NULL,
    created_at       DATETIME(3) NULL,
    UNIQUE KEY ux_refresh_tokens_hash (token_hash),
    KEY idx_refresh_tokens_user (user_id),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_resets (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT UNSIGNED NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    used_at    DATETIME(3) NULL,
    created_at DATETIME(3) NULL,
    UNIQUE KEY ux_password_resets_hash (token_hash),
    KEY idx_password_resets_user (user_id),
    CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE device_tokens (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id             BIGINT UNSIGNED NOT NULL,
    one_signal_player_id VARCHAR(191) NOT NULL,
    platform            VARCHAR(20) NOT NULL,
    locale              VARCHAR(10) NULL,
    last_seen_at        DATETIME(3) NULL,
    created_at          DATETIME(3) NULL,
    updated_at          DATETIME(3) NULL,
    deleted_at          DATETIME(3) NULL,
    UNIQUE KEY ux_device_tokens_player (one_signal_player_id),
    KEY idx_device_tokens_user (user_id),
    CONSTRAINT fk_device_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE classrooms (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(191) NOT NULL,
    room_location VARCHAR(191) NULL,
    age_group     VARCHAR(50) NULL,
    capacity      INT NOT NULL DEFAULT 0,
    opens_at      VARCHAR(8) NULL,
    closes_at     VARCHAR(8) NULL,
    image_id      BIGINT UNSIGNED NULL,
    created_at    DATETIME(3) NULL,
    updated_at    DATETIME(3) NULL,
    deleted_at    DATETIME(3) NULL,
    KEY idx_classrooms_deleted_at (deleted_at),
    CONSTRAINT fk_classrooms_image FOREIGN KEY (image_id) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE classroom_translations (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    classroom_id BIGINT UNSIGNED NOT NULL,
    locale       VARCHAR(10) NOT NULL,
    name         VARCHAR(191) NOT NULL,
    UNIQUE KEY ux_classroom_locale (classroom_id, locale),
    CONSTRAINT fk_classroom_translations_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE classroom_teachers (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    classroom_id    BIGINT UNSIGNED NOT NULL,
    teacher_user_id BIGINT UNSIGNED NOT NULL,
    role            ENUM('lead','assistant') NOT NULL DEFAULT 'assistant',
    created_at      DATETIME(3) NULL,
    updated_at      DATETIME(3) NULL,
    deleted_at      DATETIME(3) NULL,
    UNIQUE KEY ux_classroom_teacher (classroom_id, teacher_user_id),
    KEY idx_classroom_teachers_teacher (teacher_user_id),
    CONSTRAINT fk_classroom_teachers_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_classroom_teachers_user FOREIGN KEY (teacher_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE children (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100) NOT NULL,
    dob            DATE NOT NULL,
    gender         VARCHAR(20) NULL,
    blood_type     VARCHAR(5) NULL,
    avatar_id      BIGINT UNSIGNED NULL,
    classroom_id   BIGINT UNSIGNED NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'active',
    present_status ENUM('checked_in','checked_out','absent') NOT NULL DEFAULT 'checked_out',
    checked_in_at  DATETIME(3) NULL,
    created_at     DATETIME(3) NULL,
    updated_at     DATETIME(3) NULL,
    deleted_at     DATETIME(3) NULL,
    KEY idx_children_classroom (classroom_id),
    KEY idx_children_deleted_at (deleted_at),
    CONSTRAINT fk_children_avatar FOREIGN KEY (avatar_id) REFERENCES media(id) ON DELETE SET NULL,
    CONSTRAINT fk_children_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE guardians (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    parent_user_id BIGINT UNSIGNED NOT NULL,
    child_id       BIGINT UNSIGNED NOT NULL,
    relationship   VARCHAR(30) NOT NULL,
    is_primary     TINYINT(1) NOT NULL DEFAULT 0,
    can_pickup     TINYINT(1) NOT NULL DEFAULT 1,
    created_at     DATETIME(3) NULL,
    updated_at     DATETIME(3) NULL,
    deleted_at     DATETIME(3) NULL,
    UNIQUE KEY ux_guardian_parent_child (parent_user_id, child_id),
    KEY idx_guardians_child (child_id),
    CONSTRAINT fk_guardians_parent FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_guardians_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendances (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id       BIGINT UNSIGNED NOT NULL,
    date           DATE NOT NULL,
    status         ENUM('present','absent','late','early_pickup') NOT NULL,
    checked_in_at  DATETIME(3) NULL,
    checked_out_at DATETIME(3) NULL,
    note           VARCHAR(500) NULL,
    requested_by   BIGINT UNSIGNED NULL,
    confirmed_by   BIGINT UNSIGNED NULL,
    confirmed_at   DATETIME(3) NULL,
    created_at     DATETIME(3) NULL,
    updated_at     DATETIME(3) NULL,
    deleted_at     DATETIME(3) NULL,
    UNIQUE KEY ux_attendance_child_date (child_id, date),
    CONSTRAINT fk_attendances_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
    CONSTRAINT fk_attendances_requested_by FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_attendances_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE locales (
    code        VARCHAR(10) NOT NULL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    native_name VARCHAR(100) NOT NULL,
    direction   ENUM('ltr','rtl') NOT NULL DEFAULT 'ltr',
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    is_default  TINYINT(1) NOT NULL DEFAULT 0,
    sort_order  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE settings (
    `key`      VARCHAR(100) NOT NULL PRIMARY KEY,
    value_json JSON NOT NULL,
    updated_at DATETIME(3) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_user_id BIGINT UNSIGNED NOT NULL,
    action        VARCHAR(50) NOT NULL,
    entity        VARCHAR(100) NOT NULL,
    entity_id     BIGINT UNSIGNED NULL,
    diff_json     JSON NULL,
    ip            VARCHAR(45) NULL,
    created_at    DATETIME(3) NULL,
    KEY idx_audit_logs_actor (actor_user_id),
    KEY idx_audit_logs_entity (entity, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT UNSIGNED NOT NULL,
    category   VARCHAR(30) NOT NULL,
    title      VARCHAR(191) NOT NULL,
    body       VARCHAR(1000) NULL,
    data_json  JSON NULL,
    read_at    DATETIME(3) NULL,
    sent_at    DATETIME(3) NULL,
    created_at DATETIME(3) NULL,
    updated_at DATETIME(3) NULL,
    deleted_at DATETIME(3) NULL,
    KEY idx_notifications_user (user_id),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default locale rows
INSERT INTO locales (code, name, native_name, direction, is_active, is_default, sort_order) VALUES
    ('en', 'English', 'English', 'ltr', 1, 1, 0),
    ('sv', 'Swedish', 'Svenska', 'ltr', 1, 0, 1),
    ('ar', 'Arabic',  'العربية', 'rtl', 1, 0, 2);
