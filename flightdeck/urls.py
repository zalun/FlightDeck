from django.conf.urls.defaults import *
from django.views import static
from django.conf import settings   
from django.contrib import admin

from flightdeck.base import views as base_views

admin.autodiscover()


urls = [
	# home
	url(r'^$',base_views.homepage, name='home'),
	]

if settings.DEBUG:

	try:
		import grappelli
		urls.append((r'^grappelli/', include('grappelli.urls')))
	except:
		""
	# admin
	urls.extend([
		(r'^admin/doc/', include('django.contrib.admindocs.urls')),
		(r'^admin/', include(admin.site.urls))
	])

urls.extend([
	# static files
	# this should be used only in development server
	# please refer to http://docs.djangoproject.com/en/dev/howto/deployment/modwsgi/#serving-media-files
	url(r'^media/(?P<path>.*)$', static.serve, {'document_root': settings.MEDIA_ROOT}, name='media'),

	# API Browser
	(r'^api/', include('api.urls')),

	# Tutorial
	(r'^tutorial/', include('tutorial.urls')),

	# Jetpack
	(r'^user/', include('person.urls')),
	(r'', include('jetpack.urls'))
])
urlpatterns = patterns('', *urls)
