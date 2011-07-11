from celeryutils import task

from jetpack.models import Package
from elasticutils import get_es
import commonware.log

log = commonware.log.getLogger('f.search.tasks')

@task
def index_all(pks, **kw):
    ids_str = ','.join(map(str, pks))
    log.debug('ES starting bulk action for packages: [%s]' % ids_str)
    
    for package in Package.objects.filter(pk__in=pks):
        package.refresh_index(bulk=True)
    
    try:
        get_es().flush_bulk(forced=True)
    except KeyboardInterrupt:
        raise
    except Exception, e:
        log.error('ES failed bulk action (%s), package ids: [%s]'
                  % (e, ids_str))
    else:
        log.debug('ES finished bulk action for packages: [%s]' % ids_str)

@task
def index_one(pk, **kw):
    package = Package.objects.get(pk=pk)
    package.refresh_index()