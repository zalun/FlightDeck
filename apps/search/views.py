from django.core.urlresolvers import reverse
from django.shortcuts import render_to_response, redirect
from django.template import RequestContext

from elasticutils import S, get_es

from jetpack.models import Package
from utils.helpers import alphanum_space


def render(request, template, data={}):
    return render_to_response(template, data, RequestContext(request))


def _get_packages(hits):
    results = {}
    for type_ in ('a', 'l'):
        ids = [r['_source']['id'] for r in hits
               if r['_source']['type'] == type_]
        results[type_] = Package.objects.filter(pk__in=ids)
    return results['a'], results['l']


term_facet = lambda f: {'terms': dict(field=f, size=10)}


def _query(searchq, type_=None, user=None, filter_by_user=False):
    q = S(searchq).facet('_type')

    if type_ in ('addon', 'library'):
        q = q.filter(_type=type_)

    if user and user.is_authenticated():
        q.facet('author', script='term == %d ? true : false' % user.id)

    # Can filter by user or type, not both.
    if filter_by_user:
        q.filter(author=user.id)

    q.execute(perpage=50)
    addon_total = q.get_facet('_type').get('addon', 0)
    library_total = q.get_facet('_type').get('library', 0)
    addons, libraries = _get_packages(q.get_results())

    data = dict(addon_total=addon_total, library_total=library_total,
                addons=addons, libraries=libraries, total=q.total, q=searchq)

    if user and user.is_authenticated():
        facet =  q.get_facet('author')
        data['my_total'] = facet.values()[0] if facet else 0
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
