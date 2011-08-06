import commonware.log
from django.core.paginator import Paginator, EmptyPage
from django.core.urlresolvers import reverse
from django.shortcuts import render_to_response, redirect
from django.template import RequestContext

from jetpack.models import Package
from .helpers import package_search
from .forms import SearchForm

log = commonware.log.getLogger('f.search')


def render(request, template, data={}):
    return render_to_response(template, data, RequestContext(request))


term_facet = lambda f: {'terms': dict(field=f, size=10)}


def search_home(request):
    q = request.GET.get('q', '')
    if q:
        return redirect('%s?q=%s' % (reverse(combined), q))
    return render(request, 'blank.html', {'page': 'search'})

def combined(request):
    """This aggregates the first results from add-ons and libraries."""
    form = SearchForm(request.GET)
    form.is_valid()
    query = form.cleaned_data
    q = query.get('q')

    addons = package_search(q, user=request.user, type='a')
    libraries = package_search(q, user=request.user, type='l')

    author = query.get('author')
    if author:
        addons = addons.filter(author=author.id)
        libraries = libraries.filter(author=author.id)

    addon_total = addons.count()
    library_total = libraries.count()
    ctx = {
        'q': q,
        'form': form,
        'query': query,
        'addon_total': addon_total,
        'library_total': library_total,
        'total': addon_total + library_total,
        'addons': addons[:5],
        'libraries': libraries[:5]
    }
    return render(request, 'aggregate.html', ctx)


def search_by_type(request, type_):
    """This is a search into either addons or libraries."""
    form = SearchForm(request.GET)
    form.is_valid()

    query = form.cleaned_data
    page = query.get('page') or 1
    q = query.get('q')
    user = request.user

    qs = package_search(q, user=request.user, type=type_[0])

    author = query.get('author')
    if author:
        qs = qs.filter(author=author.id)


    pager = Paginator(qs, per_page=20).page(page)
    facets = pager.object_list.facets
    type_totals = dict((t['term'], t['count']) for t in facets['types'])
    my_total = 0
    if 'author' in facets and len(facets['author']):
        my_total = facets['author'][0]['count']
    ctx = {
        'form': form,
        'query': query,
        'pager': pager,
        'type': type_,
        'addon_total': type_totals.get('a', 0),
        'library_total': type_totals.get('l', 0),
        'my_total': my_total,
        'total': type_totals.get('a', 0) + type_totals.get('a', 0),
        'page': 'search'
    }
    return render(request, 'results.html', ctx)


def me(request):
    if not request.user.is_authenticated():
        return redirect(reverse('search.combined') + '?' +
                        request.META['QUERY_STRING'])
    q = request.GET.get('q', '')
    data = aggregate(q, user=request.user, filter_by_user=True)
    return render(request, 'aggregate.html', data)


