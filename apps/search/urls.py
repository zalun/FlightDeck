from django.conf.urls.defaults import url, patterns
from search.feeds import PackageFeed

urlpatterns = patterns('search.views',
    url(r'^$', 'search_home', name='search'),

    url(r'^combined/$', 'combined', name='search.combined'),

    url(r'^(?P<type_>addon|library)/$', 'search_by_type',
        name='search_by_type'),

    url(r'^(?P<type_>addon|library|combined)/rss/$', PackageFeed()),

    url(r'^me/$', 'me', name='search.me'),

    url(r'^me/(?P<type_>addon|library)/$', 'me_by_type',
        name='search.me.by_type'),
)
