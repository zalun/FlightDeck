CREATE TABLE `base_celeryresponse` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `kind` varchar(100) NOT NULL,
      `time` int(11) NOT NULL,
      `modified_at` datetime NOT NULL,
      PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
