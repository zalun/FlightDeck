from django.shortcuts import render_to_response
from django.template import RequestContext

from jetpack.models import Package

def results(r):
    search_term = r.GET.get('q')
    results = []
    if search_term:
        results = Package.objects.filter(name__icontains=search_term)


    return render_to_response('results.html', {
        'results': results,
        'q': search_term,
    }, context_instance=RequestContext(r))
