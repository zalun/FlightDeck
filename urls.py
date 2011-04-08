from django.conf.urls.defaults import *
from django.views import static
from django.conf import settings

from base import views as base_views


urls = [
    # home
    url(r'^$', base_views.homepage, name='home'),
    ]

if settings.DEBUG:

    from django.contrib import admin
    admin.autodiscover()
    # admin
    urls.extend([
        (r'^admin/doc/', include('django.contrib.admindocs.urls')),
        (r'^admin/', include(admin.site.urls))
    ])

urls.extend([
    url(r'^media/(?P<path>.*)$', static.serve,
        {'document_root': settings.MEDIA_ROOT}, name='media'),

    # API Browser
    (r'^xpi/', include('xpi.urls')),

    # API Browser
    (r'^api/', include('api.urls')),

    # Tutorial
    (r'^tutorial/', include('tutorial.urls')),

    # Person
    (r'^user/', include('person.urls')),

    # Search
    (r'^search/', include('search.urls')),

    # Jetpack
    (r'', include('jetpack.urls')),

    # Monitor
    (r'', include('base.urls')),

    # Worker HACK
    (r'worker-javascript.js$', static.serve, {
        'document_root': settings.MEDIA_ROOT,
        'path': 'lib/ace/worker-javascript.js'})
])
urlpatterns = patterns('', *urls)
