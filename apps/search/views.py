import commonware.log
from django.core.paginator import Paginator, EmptyPage
from django.core.urlresolvers import reverse
from django.shortcuts import render_to_response, redirect
from django.template import RequestContext

from jetpack.models import Package
from .helpers import package_search, get_activity_scale
from .forms import SearchForm
from pyes.urllib3.connectionpool import TimeoutError

log = commonware.log.getLogger('f.search')

SORT_MAPPING = {
    'score':'_score',
    'activity':'-activity',
    'forked':'-copies_count',
    'used':'-times_depended',
    'new':'-created_at',
    'size':'-size',
}

def search(request):
    form = SearchForm(request.GET)
    form.is_valid()
    query = form.cleaned_data
    q = query.get('q').lower()
    type_ = query.get('type') or None
    types = {'a': 'addon', 'l': 'library'}
    page = query.get('page') or 1    
    limit = 20
    activity_map = get_activity_scale()
    
    if q and query.get('sort') == '':
        sort = '_score'
        query['sort'] = 'score' 
    elif query.get('sort') == '':
        sort = '-activity'
        query['sort'] = 'activity'
    else:
        sort = SORT_MAPPING.get(query.get('sort'))

    filters = {}
    filters['user'] = request.user

    author = query.get('author')
    if author:
        filters['author'] = author.id

    if query.get('copies'):
        filters['copies_count__gte'] = query['copies']
    else:
        query['copies'] = 0

    if query.get('used') and type_ != 'a':
        # Add-ons can't be depended upon, so this query would filter out
        # every single Add-on
        filters['times_depended__gte'] = query['used']
    else:
        query['used'] = 0
        
    if query.get('example'):
        filters['example'] = 'true'
        
    if query.get('featured'):
        filters['featured'] = 'true'

    if query.get('activity'):
        filters['activity__gte'] = activity_map.get(str(query['activity']), 0)
         
    copies_facet = {'terms': {'field': 'copies_count'}}
    times_depended_facet = {'terms': {'field': 'times_depended'}}
    examples_facet = {'query': {'term': {'example': 'true' }}}
    featured_facet = {'query': {'term': {'featured': 'true' }}}
    facets_ = {
                'copies': copies_facet,
                'times_depended': times_depended_facet,
                'example': examples_facet,
                'featured': featured_facet
               }
   
    template = ''
    results={}
    facets={}
    
    if type_:
        filters['type'] = type_        
        qs = package_search(q, **filters).order_by(sort).facet(**facets_)                
        try:
            results['pager'] = Paginator(qs, per_page=limit).page(page)
        except EmptyPage:
            results['pager'] = Paginator(qs, per_page=limit).page(1)
        facets = _facets(results['pager'].object_list.facets)
        facets['everyone_total'] = len(qs)
        template = 'results.html'
    else:
        # combined view
        results['addons'] = package_search(q, type='a', **filters) \
            .order_by(sort)[:5]
        results['libraries'] = package_search(q, type='l', **filters) \
            .order_by(sort)[:5]
        results['all'] = package_search(q, **filters).facet(**facets_)[:0]
        
        facets = _facets(results['all'].facets)
        facets['everyone_total'] = facets['combined_total']
        template = 'aggregate.html'
    
    
    ctx = {
        'q': q,
        'page': 'search',
        'form': form,
        'query': query,
        'type': types.get(type_, None)
    }
    
    ctx.update(results)
    ctx.update(facets)
    
    if request.is_ajax():
        template = 'ajax/' + template
    return _render(request, template, ctx)


def rss_redirect(request, type_):
    from base.helpers import urlparams
    form = SearchForm(request.GET)
    form.is_valid()

    query = dict(form.cleaned_data)
    if type_ != 'combined':
        query['type'] = type_[0]

    return redirect(urlparams(reverse('search.rss'), **query), permanent=True)


def _render(request, template, data={}):
    return render_to_response(template, data, RequestContext(request))


def _facets(facets):   
    type_totals = dict((t['term'], t['count']) for t in facets['types'])
    my_total = 0
    if 'author' in facets and len(facets['author']):
        my_total = facets['author'][0]['count']

    max_copies = 0
    if 'copies' in facets:
        copies_steps = [t['term'] for t in facets['copies']]
        if copies_steps:
            copies_steps.sort()
            max_ = copies_steps.pop()
            max_copies = max(max_copies, max_)

    max_times_depended = 0
    if 'times_depended' in facets:
        depended_steps = [t['term'] for t in facets['times_depended']]
        if depended_steps:
            depended_steps.sort()
            max_ = depended_steps.pop()
            max_times_depended = max(max_times_depended, max_)

    example_count = 0
    if 'example' in facets:
        example_count = facets['example']
    
    featured_count = 0    
    if 'featured' in facets:
        featured_count = facets['featured']

    return {
        'addon_total': type_totals.get('a', 0),
        'library_total': type_totals.get('l', 0),
        'my_total': my_total,
        'combined_total': type_totals.get('a', 0) + type_totals.get('l', 0),
        'max_copies': max_copies,
        'max_times_depended': max_times_depended,
        'examples_total': example_count,
        'featured_total': featured_count
    }
