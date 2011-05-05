-- Just some cleanup; bug 653227

-- I don't think we need this, we discard all our celery
-- responses (CELERY_IGNORE_RESULT=True)
DROP TABLE IF EXISTS `base_celeryresponse`;

-- These tables exist on stage but not production.  They
-- are just old and empty, should clean them up
DROP TABLE IF EXISTS `djcelery_crontabschedule`;
DROP TABLE IF EXISTS `djcelery_intervalschedule`;
DROP TABLE IF EXISTS `djcelery_periodictask`;
DROP TABLE IF EXISTS `djcelery_periodictasks`;
DROP TABLE IF EXISTS `djcelery_taskstate`;
DROP TABLE IF EXISTS `djcelery_workerstate`;
