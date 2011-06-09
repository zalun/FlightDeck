ALTER TABLE `jetpack_packagerevision` ADD `name` VARCHAR(250) NOT NULL;
UPDATE jetpack_packagerevision r,jetpack_package p SET r.name = p.name WHERE p.id=r.package_id;

ALTER TABLE `jetpack_packagerevision` ADD `full_name` VARCHAR(250) NOT NULL;
UPDATE jetpack_packagerevision r,jetpack_package p SET r.full_name = p.full_name WHERE p.id=r.package_id;

