import datetime
import commonware.log
from celery.decorators import task

from jetpack.models import Package
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
    