from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('search.views',
    url(r'^$', 'aggregate', name='search.aggregate'),
    url(r'^(?P<type>addons|library)/$', 'search', name='search'),
)
