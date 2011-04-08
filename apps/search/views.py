from django.shortcuts import render_to_response
from django.template import RequestContext

def results(r):
    search_term = r.GET.get('q')
    results = []
    if search_term:
        pass

    return render_to_response('results.html', {
        'results': results,
    }, context_instance=RequestContext(r))
