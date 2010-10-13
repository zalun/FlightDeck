import os

from django.conf.urls.defaults import *
from django.views import static
from django.conf import settings

from flightdeck.base import views as base_views



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
    # static files
    # this should be used only in development server
    url(r'^media/jetpack/(?P<path>.*)$', static.serve,
        {'document_root': os.path.join(
            settings.MEDIA_PREFIX, 'jetpack', settings.MEDIA_SUFFIX)
        }, name='jetpack_media'),
    url(r'^media/api/(?P<path>.*)$', static.serve,
        {'document_root': os.path.join(
            settings.MEDIA_PREFIX, 'api', settings.MEDIA_SUFFIX)
        }, name='api_media'),
    url(r'^media/tutorial/(?P<path>.*)$', static.serve,
        {'document_root': os.path.join(
            settings.MEDIA_PREFIX, 'tutorial', settings.MEDIA_SUFFIX)
        }, name='tutorial_media'),
    url(r'^media/(?P<path>.*)$', static.serve,
        {'document_root': settings.MEDIA_ROOT}, name='media'),

    # API Browser
    (r'^api/', include('api.urls')),

    # Tutorial
    (r'^tutorial/', include('tutorial.urls')),

    # Person
    (r'^user/', include('person.urls')),

    # Jetpack
    (r'', include('jetpack.urls'))
])
urlpatterns = patterns('', *urls)
