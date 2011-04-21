from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('search.views',
    url(r'^$', 'results', name='search.results'),
    url(r'^(?P<type_>addon|library)/$', 'search', name='search'),
    url(r'^me/$', 'me', name='search.me'),
)
