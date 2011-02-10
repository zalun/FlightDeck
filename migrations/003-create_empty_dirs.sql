CREATE TABLE `jetpack_emptydir` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `author_id` int(11) NOT NULL,
  `root_dir` varchar(10) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jetpack_emptydir_337b96ff` (`author_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

CREATE TABLE `jetpack_emptydir_revisions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `emptydir_id` int(11) NOT NULL,
  `packagerevision_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `emptydir_id` (`emptydir_id`,`packagerevision_id`),
  KEY `jetpack_emptydir_revisions_de303cc` (`emptydir_id`),
  KEY `jetpack_emptydir_revisions_13e2c2ac` (`packagerevision_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
