from django.conf.urls.defaults import url, patterns
from search.feeds import PackageFeed

urlpatterns = patterns('search.views',
    url(r'^$', 'search', name='search'),

    url(r'^rss/$', PackageFeed(), name='search.rss'),
    url(r'^(?P<type_>addon|library|combined)/rss/$', 'rss_redirect'),

)
