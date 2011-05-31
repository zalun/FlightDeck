from django.core.urlresolvers import reverse
from django.shortcuts import render_to_response, redirect
from django.template import RequestContext

from elasticutils import get_es

from jetpack.models import Package
from utils.helpers import alphanum_space


def render(request, template, data={}):
    return render_to_response(template, data, RequestContext(request))


def _get_facets(results):
    facets = results['facets']
    type_facets = dict(((z['term'], z['count']) for z in
                         facets['type']['terms']))
    return type_facets.get('addon', 0), type_facets.get('library', 0)


def _get_packages(results):
    hits = results['hits']
    results = {}
    for type_ in ('a', 'l'):
        ids = [r['_source']['id'] for r in hits['hits']
               if r['_source']['type'] == type_]
        results[type_] = Package.objects.filter(pk__in=ids)
    return results['a'], results['l']


term_facet = lambda f: {'terms': dict(field=f, size=10)}


def _query(searchq, type_=None, user=None, filter_by_user=False):
    if searchq:
        es = get_es()
        facets = dict(type=term_facet('_type'))
        if user and user.is_authenticated():
            facet = term_facet('author')
            facet['terms']['script'] = 'term == %d ? true : false' % user.id
            facets['author'] = facet

        query = dict(query=dict(query_string=dict(query=searchq)),
                     facets=facets, size=50)

        if type_ in ('addon', 'library'):
            query['filter'] = {'term': {'_type': type_}}

        # Can filter by user or type, not both.
        if filter_by_user:
            query['filter'] = {'term': {'author': user.id}}

        r = es.search(query, 'flightdeck')
        addon_total, library_total = _get_facets(r)
        addons, libraries = _get_packages(r)

        data = dict(addon_total=addon_total, library_total=library_total,
                    addons=addons, libraries=libraries,
                    total=r['hits']['total'], q=searchq)

        if user and user.is_authenticated():
            data['my_total'] = 0
            facets = r['facets']['author']['terms']
            if facets:
                data['my_total'] = facets[0]['count']

    else:
        data = {}

    return data


def results(request):
    """This aggregates the first results from add-ons and libraries."""
    q = alphanum_space(request.GET.get('q', ''))
    
    if q:
        data = _query(q, user=request.user)
        return render(request, 'results.html', data)
    else:
        return render(request, 'blank.html')


def search(request, type_):
    """This is a search into either addons or libraries."""
    q = alphanum_space(request.GET.get('q', ''))
    data = _query(q, type_, user=request.user)
    return render(request, 'results.html', data)


def me(request):
    if not request.user.is_authenticated():
        return redirect(reverse('search.results') + '?' +
                        request.META['QUERY_STRING'])
    q = alphanum_space(request.GET.get('q', ''))
    data = _query(q, user=request.user, filter_by_user=True)
    return render(request, 'results.html', data)
