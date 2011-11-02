CREATE TABLE `waffle_flag_groups` (
    `id` integer AUTO_INCREMENT NOT NULL PRIMARY KEY,
    `flag_id` integer NOT NULL,
    `group_id` integer NOT NULL,
    UNIQUE (`flag_id`, `group_id`)
);
ALTER TABLE `waffle_flag_groups` ADD CONSTRAINT `group_id_refs_id_4ea49f34` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`);
CREATE TABLE `waffle_flag_users` (
    `id` integer AUTO_INCREMENT NOT NULL PRIMARY KEY,
    `flag_id` integer NOT NULL,
    `user_id` integer NOT NULL,
    UNIQUE (`flag_id`, `user_id`)
);
ALTER TABLE `waffle_flag_users` ADD CONSTRAINT `user_id_refs_id_451d203e` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);
CREATE TABLE `waffle_flag` (
    `id` integer AUTO_INCREMENT NOT NULL PRIMARY KEY,
    `name` varchar(100) NOT NULL UNIQUE,
    `everyone` bool,
    `percent` numeric(3, 1),
    `testing` bool NOT NULL,
    `superusers` bool NOT NULL,
    `staff` bool NOT NULL,
    `authenticated` bool NOT NULL,
    `rollout` bool NOT NULL,
    `note` longtext NOT NULL
);
ALTER TABLE `waffle_flag_groups` ADD CONSTRAINT `flag_id_refs_id_71957f83` FOREIGN KEY (`flag_id`) REFERENCES `waffle_flag` (`id`);
ALTER TABLE `waffle_flag_users` ADD CONSTRAINT `flag_id_refs_id_7010f3ee` FOREIGN KEY (`flag_id`) REFERENCES `waffle_flag` (`id`);
CREATE TABLE `waffle_switch` (
    `id` integer AUTO_INCREMENT NOT NULL PRIMARY KEY,
    `name` varchar(100) NOT NULL UNIQUE,
    `active` bool NOT NULL,
    `note` longtext NOT NULL
);
CREATE TABLE `waffle_sample` (
    `id` integer AUTO_INCREMENT NOT NULL PRIMARY KEY,
    `name` varchar(100) NOT NULL UNIQUE,
    `percent` numeric(4, 1) NOT NULL,
    `note` longtext NOT NULL
);
