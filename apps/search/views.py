from django.shortcuts import render_to_response
from django.template import RequestContext

from pyes import facets, query

from search.utils import get_es


def render(request, template, data={}):
    return render_to_response(template, data, RequestContext(request))


def _get_facets(response):
    facets = response['facets']
    type_facets = dict(((z['term'], z['count']) for z in
                         facets['_type']['terms']))
    return type_facets['addon'], type_facets['library']


def aggregate(request):
    """This aggregates the first 5 results from add-ons and libraries."""
    # Query add-on, library facet and use the facet values.
    q = request.GET.get('q')
    es = get_es()
    s = query.Search(query.StringQuery(q))
    s.facet.add_term_facet('_type')
    r = es.search(s, 'flightdeck')
    addon_total, library_total = _get_facets(r)
    data = dict(addon_total=addon_total, library_total=library_total)
    return render(request, 'search/aggregate.html', data)


def search(request, type):
    """This is a search into either addons or libraries."""
    pass
