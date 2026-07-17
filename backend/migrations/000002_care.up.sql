-- Phase 2: daily care logs.

CREATE TABLE diary_entries (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id          BIGINT UNSIGNED NOT NULL,
    type              ENUM('meal','sleep','activity','diaper','note','photo') NOT NULL,
    title             VARCHAR(191) NOT NULL,
    body              VARCHAR(2000) NULL,
    occurred_at       DATETIME(3) NOT NULL,
    logged_by_user_id BIGINT UNSIGNED NOT NULL,
    is_live           TINYINT(1) NOT NULL DEFAULT 1,
    created_at        DATETIME(3) NULL,
    updated_at        DATETIME(3) NULL,
    deleted_at        DATETIME(3) NULL,
    KEY idx_diary_child_time (child_id, occurred_at),
    CONSTRAINT fk_diary_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
    CONSTRAINT fk_diary_logged_by FOREIGN KEY (logged_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE diary_media (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    diary_entry_id BIGINT UNSIGNED NOT NULL,
    media_id       BIGINT UNSIGNED NOT NULL,
    sort           INT NOT NULL DEFAULT 0,
    KEY idx_diary_media_entry (diary_entry_id),
    CONSTRAINT fk_diary_media_entry FOREIGN KEY (diary_entry_id) REFERENCES diary_entries(id) ON DELETE CASCADE,
    CONSTRAINT fk_diary_media_media FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE meal_logs (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id   BIGINT UNSIGNED NOT NULL,
    meal_type  ENUM('breakfast','lunch','snack','dinner') NOT NULL,
    status     ENUM('ate_well','ate_half','ate_little','didnt_eat') NOT NULL,
    served_at  DATETIME(3) NOT NULL,
    note       VARCHAR(500) NULL,
    image_id   BIGINT UNSIGNED NULL,
    created_at DATETIME(3) NULL,
    updated_at DATETIME(3) NULL,
    deleted_at DATETIME(3) NULL,
    KEY idx_meal_child_time (child_id, served_at),
    CONSTRAINT fk_meal_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
    CONSTRAINT fk_meal_image FOREIGN KEY (image_id) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hydration_logs (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id   BIGINT UNSIGNED NOT NULL,
    date       DATE NOT NULL,
    cups       INT NOT NULL DEFAULT 0,
    rating     VARCHAR(20) NULL,
    created_at DATETIME(3) NULL,
    updated_at DATETIME(3) NULL,
    deleted_at DATETIME(3) NULL,
    UNIQUE KEY ux_hydration_child_date (child_id, date),
    CONSTRAINT fk_hydration_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE weekly_menus (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    classroom_id BIGINT UNSIGNED NOT NULL,
    date         DATE NOT NULL,
    meal_type    ENUM('breakfast','lunch','snack','dinner') NOT NULL,
    dish_name    VARCHAR(191) NOT NULL,
    items_json   JSON NULL,
    is_balanced  TINYINT(1) NOT NULL DEFAULT 1,
    image_id     BIGINT UNSIGNED NULL,
    created_at   DATETIME(3) NULL,
    updated_at   DATETIME(3) NULL,
    deleted_at   DATETIME(3) NULL,
    UNIQUE KEY ux_menu_room_date_type (classroom_id, date, meal_type),
    CONSTRAINT fk_menu_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_menu_image FOREIGN KEY (image_id) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE menu_ratings (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    weekly_menu_id BIGINT UNSIGNED NOT NULL,
    child_id       BIGINT UNSIGNED NOT NULL,
    rating         ENUM('eats','sometimes','doesnt_eat') NOT NULL,
    created_at     DATETIME(3) NULL,
    updated_at     DATETIME(3) NULL,
    deleted_at     DATETIME(3) NULL,
    UNIQUE KEY ux_rating_menu_child (weekly_menu_id, child_id),
    CONSTRAINT fk_rating_menu FOREIGN KEY (weekly_menu_id) REFERENCES weekly_menus(id) ON DELETE CASCADE,
    CONSTRAINT fk_rating_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sleep_logs (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id          BIGINT UNSIGNED NOT NULL,
    start_at          DATETIME(3) NOT NULL,
    end_at            DATETIME(3) NOT NULL,
    total_minutes     INT NOT NULL,
    quality_pct       INT NOT NULL DEFAULT 0,
    mood_after        VARCHAR(30) NULL,
    deep_min          INT NOT NULL DEFAULT 0,
    light_min         INT NOT NULL DEFAULT 0,
    awake_min         INT NOT NULL DEFAULT 0,
    took_to_sleep_min INT NOT NULL DEFAULT 0,
    created_at        DATETIME(3) NULL,
    updated_at        DATETIME(3) NULL,
    deleted_at        DATETIME(3) NULL,
    KEY idx_sleep_child_start (child_id, start_at),
    CONSTRAINT fk_sleep_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE diaper_logs (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    child_id   BIGINT UNSIGNED NOT NULL,
    time       DATETIME(3) NOT NULL,
    wetness    ENUM('dry','wet','heavy') NOT NULL,
    stool      ENUM('none','hard','normal','soft','loose','diarrhea') NOT NULL DEFAULT 'none',
    comfort    ENUM('happy','fussy') NOT NULL DEFAULT 'happy',
    note       VARCHAR(500) NULL,
    created_at DATETIME(3) NULL,
    updated_at DATETIME(3) NULL,
    deleted_at DATETIME(3) NULL,
    KEY idx_diaper_child_time (child_id, time),
    CONSTRAINT fk_diaper_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
