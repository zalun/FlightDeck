from datetime import datetime, timedelta
import os
import shutil
from time import mktime

from django.conf import settings

import commonware
import cronjobs

from . import tasks

from jetpack.models import Package
from jetpack import tasks

from celery.messaging import establish_connection
from celeryutils import chunked
from elasticutils import get_es

log = commonware.log.getLogger('f.cron')

def _prune_older_files(directory, age):
    """
    Analyzes a directory looking for files or directories older than `age`.
    Any found files will be removed.  `directory` should be an absolute
    path, `age` a UNIX timestamp.
    """

    log.info('(GC) Pruning files older than (%s) from (%s)' % (age, directory))

    age = mktime((datetime.today() - age).timetuple())

    for filename in os.listdir(directory):
        filename = os.path.join(directory, filename)
        if os.path.getmtime(filename) < age:
            log.debug('(GC) Removing: %s' % filename)
            try:
                if os.path.isdir(filename):
                    shutil.rmtree(filename)
                else:
                    os.remove(filename)
            except Exception, e:
                log.critical("(GC) Failed to remove (%s) (%s)" % (filename, e))


@cronjobs.register
def gc():
    """Garbage collection!"""
    log.info('Starting garbage collection.')

    one_day_ago = timedelta(days=1)

    if os.path.isdir(settings.XPI_TARGETDIR):
        _prune_older_files(settings.XPI_TARGETDIR, one_day_ago)

    if os.path.isdir(settings.SDKDIR_PREFIX):
        _prune_older_files(settings.SDKDIR_PREFIX, one_day_ago)


@cronjobs.register
def update_package_activity():
    """Recalculates package activity rating for all packages"""
    ids = Package.objects.all().values_list('id', flat=True)
    log.info("Updating package activity for %s packages" % len(ids))
    with establish_connection() as conn:
        for chunk in chunked(ids, 100):
            tasks.calculate_activity_rating.apply_async(args=[chunk], connection=conn)
