from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('api.views',
    url(r'$', 'homepage', name='api_home'),
    url(r'^(?P<path>.*)$', 'show_page', name='api_page'),
)
