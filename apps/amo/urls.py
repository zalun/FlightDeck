from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('amo.views',
    url(r'^upload_to_amo/(?P<pk>\d+)/', 'upload_to_amo', name='amo_upload'),
    url(r'^addon_details_from_amo/(?P<pk>\d+)/', 'get_addon_details_from_amo',
        name='amo_get_addon_details'),
    url(r'^addon_details/(?P<pk>\d+)/', 'get_addon_details',
        name='get_addon_status'))
