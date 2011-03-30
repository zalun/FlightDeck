import time

from celery.decorators import task

from django.core.exceptions import ObjectDoesNotExist

from base.models import CeleryResponse


@task(rate_limit='10/s')
def response_time(kind, timer):
    """Record the response time
    """
    try:
        response = CeleryResponse.objects.get(kind=kind)
    except ObjectDoesNotExist:
        response = CeleryResponse(kind=kind)
    response.time = time.clock() - timer
    response.save()
