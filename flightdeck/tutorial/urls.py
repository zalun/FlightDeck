from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('tutorial.views',
    url(r'^$', 'tutorial', name='tutorial'),
)
