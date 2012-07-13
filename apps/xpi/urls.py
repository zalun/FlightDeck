" XPI URL definitions "

from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('xpi.views',
    # create XPI
    url(r'^prepare_test/(?P<revision_id>\d+)/$',
        'prepare_test', name='jp_addon_revision_test'),
    url(r'^prepare_download/(?P<revision_id>\d+)/$',
        'prepare_download', name='jp_addon_revision_xpi'),

    # get and remove created XPI
    url(r'^test/(?P<hashtag>[a-zA-Z0-9]+)/$',
        'get_test', name='jp_test_xpi'),
    url(r'^check_download/(?P<hashtag>[a-zA-Z0-9]+)/$',
        'check_download', name='jp_check_download_xpi'),
    url(r'^download/(?P<hashtag>[a-zA-Z0-9]+)/(?P<filename>.*)/$',
        'get_download', name='jp_download_xpi'),
    url(r'^remove/(?P<path>.*)/$', 'clean', name='jp_rm_xpi'),

)
