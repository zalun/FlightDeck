ALTER TABLE jetpack_package DROP COLUMN year_of_activity;
ALTER TABLE jetpack_package DROP COLUMN activity_updated_at;
ALTER TABLE jetpack_package ADD COLUMN activity_rating decimal(4,3);

-- this index is intended to speed up the package activity queries.
CREATE INDEX package_id_created_at ON jetpack_packagerevision (package_id, created_at DESC);