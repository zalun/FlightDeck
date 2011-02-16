CREATE TABLE `api_docpage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sdk_id` int(11) NOT NULL,
  `path` varchar(255) NOT NULL,
  `html` longtext NOT NULL,
  `json` longtext NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sdk_id` (`sdk_id`,`path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
