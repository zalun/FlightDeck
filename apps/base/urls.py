from django.conf.urls.defaults import patterns, url

urlpatterns = patterns('',
    url('^services/monitor$', 'base.views.monitor', name='monitor'),
    url('^services/settings$', 'base.views.site_settings', name='settings'),
)
