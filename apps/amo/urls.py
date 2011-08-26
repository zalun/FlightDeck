from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('amo.views',
    url(r'^upload_to_amo/(?P<pk>\d+)/', 'upload_to_amo', name='amo_upload'),
    url(r'^addon_details/(?P<pk>\d+)/', 'get_addon_details',
        name='amo_get_addon_details'))
