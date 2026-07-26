-- Phase 7: track when a reminder was announced.
--
-- Reminders were only sent by the 07:00 cron on their date, so one created for
-- today after that ran never reached anyone. Creation now announces same-day
-- reminders immediately, and this column stops the cron announcing them again.
ALTER TABLE reminders ADD COLUMN notified_at DATETIME(3) NULL AFTER created_by;

-- Existing reminders dated before today have already had their moment; marking
-- them keeps the next cron run from notifying about past dates.
UPDATE reminders SET notified_at = NOW() WHERE date < CURDATE();
