" XPI URL definitions "

from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('xpi.views',
    # test Add-on's PackageRevision
    url(r'^prepare_test/(?P<id_number>[-\w]+)/revision/(?P<revision_number>\d+)/$',
        'prepare_test', name='jp_addon_revision_test'),
    url(r'^prepare_download/(?P<id_number>[-\w]+)/revision/(?P<revision_number>\d+)/$',
        'prepare_download', name='jp_addon_revision_xpi'),

    # get and remove created XPI
    url(r'^test/(?P<path>.*)/$',
        'get_test', name='jp_test_xpi'),
    url(r'^download/(?P<path>.*)/(?P<filename>.*)/$',
        'get_download', name='jp_download_xpi'),
    url(r'^remove/(?P<path>.*)/$', 'clean', name='jp_rm_xpi'),
)
