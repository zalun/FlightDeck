from django.core.paginator import EmptyPage
from django.core.urlresolvers import reverse
from django.shortcuts import render_to_response, redirect
from django.template import RequestContext

from jetpack.models import Package
from helpers import query

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
    q = request.GET.get('q', '')

    addons = query(q, user=request.user, type_='addon', limit=5)
    libs = query(q, user=request.user, type_='library', limit=5)
    addons.update(q=q,
            addons=addons['pager'].object_list,
            libraries=libs['pager'].object_list,
            total=addons.total + libraries.total
            )
    return render(request, 'aggregate.html', addons)


def search_by_type(request, type_):
    """This is a search into either addons or libraries."""
    page = request.GET.get('page', 1)
    q = (request.GET.get('q', ''))
    try:
        data = query(q, type_, user=request.user, page=page)
    except EmptyPage:
        data = query(q, type_, user=request.user)
    data.update(q=q, type=type_)
    return render(request, 'results.html', data)


def me(request):
    if not request.user.is_authenticated():
        return redirect(reverse('search.combined') + '?' +
                        request.META['QUERY_STRING'])
    q = (request.GET.get('q', ''))
    data = query(q, user=request.user, filter_by_user=True)
    data.update(q=q)
    return render(request, 'aggregate.html', data)


def me_by_type(request, type_):
    if not request.user.is_authenticated():
        return redirect(reverse('search.results') + '?' +
                        request.META['QUERY_STRING'])
    q = request.GET.get('q', '')
    data = query(q, type_, user=request.user, filter_by_user=True)
    data.update(q=q, type=type_)
    return render(request, 'results.html', data)
