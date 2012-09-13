import datetime
import commonware.log
import time

from statsd import statsd
from celery.decorators import task

from jetpack.models import Package, PackageRevision
from elasticutils import get_es

log = commonware.log.getLogger('f.celery')


@task
def calculate_activity_rating(pks,**kw):
    ids_str = ','.join(map(str, pks))
    log.debug('ES starting calculate_activity_rating for packages: [%s]'
              % ids_str)

    for package in Package.objects.filter(pk__in=pks):
        package.activity_rating = package.calc_activity_rating()
        package.save()

    log.debug('ES completed calculate_activity_rating for packages: [%s]'
              % ids_str)


@task
def zip_source(pk, hashtag, tqueued=None, **kw):
    if not hashtag:
        log.critical("[zip] No hashtag provided")
        return
    tstart = time.time()
    if tqueued:
        tinqueue = (tstart - tqueued) * 1000
        statsd.timing('zip.queued', tinqueue)
        log.info('[zip:%s] Addon job picked from queue (%dms)' % (hashtag, tinqueue))
    log.debug("[zip:%s] Compressing" % pk)
    PackageRevision.objects.get(pk=pk).zip_source(hashtag=hashtag, tstart=tstart)
    log.debug("[zip:%s] Compressed" % pk)
