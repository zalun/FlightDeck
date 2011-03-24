from django.conf import settings

from pyes import ES

_es = None


def get_es():
    """Return one es object."""
    global _es
    if not _es:
        _es = ES(settings.ES_HOSTS, default_indexes=[settings.ES_INDEX])
    return _es
