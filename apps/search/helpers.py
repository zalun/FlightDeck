from django.core.paginator import Paginator

from elasticutils import S
from jetpack.models import Package


def query(searchq, type_=None, user=None, filter_by_user=False, page=1,
           limit=20):

    get_packages = lambda x: Package.objects.manual_order(
            [z['_id'] for z in x['hits']['hits']]).active()

    # This is a filtered query, that says we want to do a query, but not have
    # to deal with version_text='initial'
    query = dict(text=dict(_all=searchq)) if searchq else dict(match_all={})
    fq = dict(
            filtered=dict(
                query=query,
                filter={
                    'not': dict(filter=dict(
                        term=dict(version_name='initial')
                        ))
                    }
                )
            )

    q = S(fq, result_transform=get_packages).facet('_type')

    filters = {}
    if type_ in ('addon', 'library'):
        filters['_type'] = type_

    if user and user.is_authenticated():
        q.facet('author', script='term == %d ? true : false' % user.id)

    if filter_by_user:
        filters['author'] = user.id

    q = q.filter(**filters)


    try:
        page = int(page)
    except ValueError:
        page = 1

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
