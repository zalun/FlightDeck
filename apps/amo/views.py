from django.shortcuts import render_to_response

from amo import tasks

def upload_to_amo(request, pk):
    """Upload a XPI to AMO
    """
    tasks.upload_to_amo.delay(pk)
    return HttpResponse('{"delayed": true}')
