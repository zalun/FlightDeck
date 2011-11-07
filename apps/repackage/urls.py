"""
repackage.urls
--------------
"""

from django.conf.urls.defaults import url, patterns

urlpatterns = patterns('repackage.views',

    url(r'^rebuild/$', 'rebuild', name='repackage_rebuild'),
    url(r'^rebuild-addons/$', 'rebuild_addons',
        name='repackage_rebuild_addons'),

    url(r'^sdk-versions/$', 'sdk_versions', name='repackage_sdk_versions'),
)
