from django.shortcuts import render_to_response
from django.template import RequestContext
from django.db.models import Q

from jetpack.models import Package

def results(r):
    search_term = r.GET.get('q', '')
    addons = []
    libraries = []
    if search_term:
        results = Package.objects.filter(Q(name__icontains=search_term) | Q(description__icontains=search_term))
        addons = results.filter(type='a')
        libraries = results.filter(type='l')


    return render_to_response('results.html', {
        'addons': addons,
        'libraries': libraries,
        'q': search_term,
    }, context_instance=RequestContext(r))
