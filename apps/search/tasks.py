from celeryutils import task

from jetpack.models import Package
from elasticutils import get_es

#testing stuffz
from django.conf import settings
from pyes import ES
es = ES(settings.ES_HOSTS,
    default_indexes=[settings.ES_INDEX], timeout=60, bulk_size=100)

@task
def index_all(pks, **kw):
    for package in Package.objects.filter(pk__in=pks):
        package.refresh_index(es=es, bulk=True)
    
    es.flush_bulk(forced=True)