from functools import wraps

from django.conf import settings

import commonware
from search.utils import get_es

log = commonware.log.getLogger('f.search')


def es_required(f):
    @wraps(f)
    def wrapper(*args, **kw):
        if settings.ES_DISABLED:
            log.warning('Search not available.')
            return

        return f(*args, es=get_es(), **kw)
    return wrapper
