from django.conf.urls.defaults import patterns, url

urlpatterns = patterns('',
    url('^robots.txt$', 'base.views.robots'),
    url('^services/monitor$', 'base.views.monitor', name='monitor'),
    url('^services/settings$', 'base.views.site_settings', name='settings'),
    url('^services/monitor_file$', 'base.views.monitor_file_check', name='monitor_file'),
)
