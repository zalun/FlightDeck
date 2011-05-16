"""
repackage.urls
--------------
"""

from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('repackage.views',

    #url(r'^repackage/sdk/(?P<sdk_dir>[-\\.\\w]+)/(?P<amo_id>[0-9]+)/(?P<amo_file>[-\\w]+)/$', 'repackage'),
    url(r'^fromftp/(?P<amo_id>[0-9]+)/(?P<amo_file>[-+\.\w]+)/$',
        'download_and_rebuild'),
    url(r'^fromftp/(?P<amo_id>[0-9]+)/(?P<amo_file>[-+\.\w]+)/(?P<target_version>[-+\.\w]+)/$',
        'download_and_rebuild')

)
