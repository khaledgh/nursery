-- Phase 13: Provision default platform superadmin account
-- Credentials:
--   Login ID: superadmin
--   Email: superadmin@nurseeplus.com
--   Password: 70578989 (bcrypt hash below)

INSERT INTO users (
    name,
    email,
    login_id,
    password_hash,
    role,
    locale,
    status,
    nursery_id,
    created_at,
    updated_at
)
SELECT
    'Super Administrator',
    'superadmin@nurseeplus.com',
    'superadmin',
    '$2a$12$/4E0rRIh3/AF7AZJhRA82.yQ1XThYgxLgkCWsAwcR0.uRbN8xv4wu',
    'superadmin',
    'en',
    'active',
    1,
    NOW(),
    NOW()
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE role = 'superadmin' OR login_id = 'superadmin' OR email = 'superadmin@nurseeplus.com'
);
