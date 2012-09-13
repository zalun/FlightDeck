import commonware.log
import cronjobs
from pyes.exceptions import ElasticSearchException
from celery.messaging import establish_connection
from celeryutils import chunked
from elasticutils import get_es

from django.conf import settings

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


@cronjobs.register
def setup_mapping():
    """Create index, and setup mapping, for ES."""

    package_mapping = {
        'properties': {
            # type is only ever 'a' or 'l', and we do exact matchs.
            # 'a' gets analyzed otherwise
            'type': {'type': 'string', 'index': 'not_analyzed'},
            'activity': {'type': 'float'}
        },
    }

    es = get_es()
    index = settings.ES_INDEXES['default']
    try:
        es.create_index_if_missing(index)
        es.put_mapping(Package._meta.db_table, package_mapping,
                index)
    except ElasticSearchException, e:
        log.debug(e)

