from elasticutils import S, F
from jetpack.models import Package


def package_search(searchq='', user=None, score_on=None, **filters):
    """This provides some sane defaults to filter on when searching Packages"""

    # This is a filtered query, that says we want to do a query, but not have
    # to deal with version_text='initial' or 'copy'
    notInitialOrCopy = ~(F(version_name='initial') | F(version_name='copy'))

    qs = Package.search().filter(notInitialOrCopy, **filters)

    # Add type facet (minus any type filter)
    facetFilter = dict((k, v) for k, v in filters.items() if k != 'type')
    if facetFilter:
        facetFilter = notInitialOrCopy & F(**facetFilter)
    else:
        facetFilter = notInitialOrCopy
    qs = qs.facet(types={'terms': {'field': 'type'},
                'facet_filter': facetFilter.filters})

    if searchq:
        qs = qs.query(or_=package_query(searchq))

    if user and user.is_authenticated():
        qs = qs.facet(author={'terms': {
            'field': 'author',
            'script':'term == %d ? true : false' % user.id}
        })

    return qs


def package_query(q):
    # 1. Prefer name text matches first (boost=3).
    # 2. Try fuzzy matches on name ("git hub" => github) (boost=2).
    # 3. Try query as a the start of name (boost=1.5)
    # 4. Try text match inside description (boost=0.8)
    return dict(full_name__text={'query': q, 'boost': 3},
                full_name__fuzzy={'value': q, 'boost': 2, 'prefix_length': 4},
                full_name__startswith={'value': q, 'boost': 1.5},
                description__text={'query': q, 'boost': 0.8})
