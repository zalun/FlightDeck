from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('search.views',
    url(r'^$', 'results', name='search.results'),
    
    url(r'^(?P<type_>addon|library)/$', 'search_by_type',
        name='search_by_type'),
    
    url(r'^me/$', 'me', name='search.me'),
    
    url(r'^me/(?P<type_>addon|library)/$', 'me_by_type', name='search.me.by_type'),
)
