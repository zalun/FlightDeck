from django.conf.urls.defaults import url, patterns, include
from django.views import static
from django.conf import settings
from django.contrib import admin

from flightdeck.base import views as base_views

admin.autodiscover()


urls = [
    # home
    url(r'^$', base_views.homepage, name='home'),
    ]

if settings.DEBUG:

    # admin
    urls.extend([
        (r'^admin/doc/', include('django.contrib.admindocs.urls')),
        (r'^admin/', include(admin.site.urls))
    ])

urls.extend([
    # static files
    # this should be used only in development server
    url(r'^media/(?P<path>.*)$', static.serve,
        {'document_root': settings.MEDIA_ROOT}, name='media'),

    # API Browser
    (r'^api/', include('api.urls')),

    # Tutorial
    (r'^tutorial/', include('tutorial.urls')),

    # Jetpack
    (r'^user/', include('person.urls')),
    (r'', include('jetpack.urls'))
])
urlpatterns = patterns('', *urls)
