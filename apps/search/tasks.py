from celeryutils import task

from jetpack.models import Package
from elasticutils import get_es


@task
def index_all(pks, **kw):
    for package in Package.objects.filter(pk__in=pks):
        package.refresh_index(bulk=True)
    
    try:
        get_es().flush_bulk(forced=True)
    except KeyboardInterrupt:
        raise
    except Exception, e:
        log.error('ES failed bulk action (%s), package ids: [%s]'
                  % (e, ','.join(map(str, pks))))