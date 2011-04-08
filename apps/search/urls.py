from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('search.views',
    url(r'^$', 'results', name='search_results')
)
