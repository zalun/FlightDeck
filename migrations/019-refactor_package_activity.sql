ALTER TABLE jetpack_package DROP COLUMN year_of_activity;
ALTER TABLE jetpack_package DROP COLUMN activity_updated_at;
ALTER TABLE jetpack_package ADD COLUMN activity_rating decimal(4,3);