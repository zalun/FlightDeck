ALTER TABLE `jetpack_package` ADD `amo_id` INTEGER DEFAULT NULL;
ALTER TABLE `jetpack_packagerevision` ADD `amo_status` INTEGER DEFAULT NULL;
ALTER TABLE `jetpack_packagerevision` ADD `amo_version_name` VARCHAR(250) DEFAULT NULL;
