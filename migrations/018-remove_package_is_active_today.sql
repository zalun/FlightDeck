ALTER TABLE jetpack_package DROP COLUMN is_active_today;
ALTER TABLE jetpack_package ADD COLUMN activity_updated_at DATETIME;
