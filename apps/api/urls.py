from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('api.views',
    url(r'$', 'homepage', name='api_home'),
    url(r'^(?P<path>.*)$', 'show_page', name='api_page'),
    url(r'^(?P<package_name>[-\w]+)/module/(?P<module_name>[-\w]+)/$',
            'module', name='api_module'),
    url(r'^(?P<package_name>[-\w]+)/$', 'package', name='api_package'),
)
