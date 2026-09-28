-- Demo requests submitted from the public landing site. Platform-global (no
-- nursery_id): they arrive before any nursery exists.
CREATE TABLE IF NOT EXISTS demo_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    nursery_name VARCHAR(160) NOT NULL,
    email VARCHAR(190) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    city VARCHAR(100) NULL,
    country VARCHAR(100) NULL,
    children_range ENUM('lt30','30_60','60_100','100_150','gt150') NULL,
    preferred_contact_time VARCHAR(60) NULL,
    message TEXT NULL,
    locale VARCHAR(5) NOT NULL DEFAULT 'en',
    status ENUM('new','contacted','scheduled','converted','rejected') NOT NULL DEFAULT 'new',
    admin_notes TEXT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    INDEX idx_demo_requests_status (status),
    INDEX idx_demo_requests_created_at (created_at),
    INDEX idx_demo_requests_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
