from django.core.paginator import Paginator, EmptyPage
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


def _query(searchq, type_=None, user=None, filter_by_user=False, page=1,
           limit=20):

    get_packages = lambda x: Package.objects.filter(
            pk__in=(z['_id'] for z in x['hits']['hits']))

    q = S(searchq, result_transform=get_packages).facet('_type')

    if type_ in ('addon', 'library'):
        q = q.filter(_type=type_)

    if user and user.is_authenticated():
        q.facet('author', script='term == %d ? true : false' % user.id)

    # Can filter by user or type, not both.
    if filter_by_user:
        q.filter(author=user.id)

    pager = Paginator(q, per_page=limit).page(page)
    facet_type = q.get_facet('_type')
    data = dict(pager=pager, total=q.total,
                addon_total=facet_type.get('addon', 0),
                library_total=facet_type.get('library', 0)
                )

    if user and user.is_authenticated():
        facet =  q.get_facet('author')
        data['my_total'] = facet.values()[0] if facet else 0
    return data


def results(request):
    """This aggregates the first results from add-ons and libraries."""
    q = alphanum_space(request.GET.get('q', ''))

    if q:
        addons = _query(q, user=request.user, type_='a', limit=5)
        libs = _query(q, user=request.user, type_='l', limit=5)
        total = addons['my_total'] + libs['my_total']
        addons.update(q=q,
                addons=addons['pager'].object_list,
                libraries=libs['pager'].object_list
                )
        return render(request, 'aggregate.html', addons)
    else:
        return render(request, 'blank.html')


def search(request, type_):
    """This is a search into either addons or libraries."""
    page = request.GET.get('page', 1)
    q = alphanum_space(request.GET.get('q', ''))
    try:
        data = _query(q, type_, user=request.user, page=page)
    except EmptyPage:
        data = _query(q, type_, user=request.user)
    data.update(q=q, type=type_)
    return render(request, 'results.html', data)


def me(request):
    if not request.user.is_authenticated():
        return redirect(reverse('search.results') + '?' +
                        request.META['QUERY_STRING'])
    q = alphanum_space(request.GET.get('q', ''))
    data = _query(q, user=request.user, filter_by_user=True)
    return render(request, 'aggregate.html', data)
