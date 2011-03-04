import commonware.log
from celeryutils import task

from jetpack.models import Package
from search.utils import get_es


@task
def index_all(pks, **kw):
    for package in Package.objects.filter(pk__in=pks):
        package.refresh_index(bulk=True)

    get_es().refresh()
