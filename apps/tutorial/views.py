from django.shortcuts import render_to_response
from django.template import RequestContext


def tutorial(r):
    return render_to_response('tutorial.html',
        context_instance=RequestContext(r))
