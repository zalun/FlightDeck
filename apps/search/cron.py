import commonware.log
import cronjobs
from celery.messaging import establish_connection
from celeryutils import chunked

from jetpack.models import Package
from search import tasks

log = commonware.log.getLogger('f.cron')


@cronjobs.register
def index_all():
    """This reindexes all the known packages and libraries."""
    ids = Package.objects.all().values_list('id', flat=True)
    log.info("Indexing %s packages" % len(ids))
    with establish_connection() as conn:
        for chunk in chunked(ids, 100):
            tasks.index_all.apply_async(args=[chunk], connection=conn)
