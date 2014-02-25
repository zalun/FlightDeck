" URL definitions "

from django.conf.urls.defaults import url, patterns

username = '(?P<username>[-\w]+)'

urlpatterns = patterns('jetpack.views',

    # browsing packages
    url(r'^addons/$', 'browser', {'type_id': 'a'},
        name='jp_browser_addons'),
    url(r'^libraries/$', 'browser', {'type_id': 'l'},
        name='jp_browser_libraries'),
    url(r'^addons/(?P<page_number>\d+)/$',
        'browser', {'type_id': 'a'}, name='jp_browser_addons_page'),
    url(r'^libraries/(?P<page_number>\d+)/$',
        'browser', {'type_id': 'l'}, name='jp_browser_libraries_page'),
    # by user
    url(r'^addons/by/%s/$' % username,
        'browser', {'type_id': 'a'}, name='jp_browser_user_addons'),
    url(r'^libraries/by/%s/$' % username,
        'browser', {'type_id': 'l'}, name='jp_browser_user_libraries'),
    url(r'^addons/by/%s/(?P<page_number>\d+)/$' % username,
        'browser', {'type_id': 'a'},
        name='jp_browser_user_addons_page'),
    url(r'^libraries/by/%s/(?P<page_number>\d+)/$' % username,
        'browser', {'type_id': 'l'},
        name='jp_browser_user_libraries_page'),

    url(r'^get_latest_revision_number/(?P<package_id>\d+)/$',
        'get_latest_revision_number', name='jp_get_latest_revision_number'),

    url(r'^addon/new/upload_xpi/$', 'upload_xpi', name='jp_upload_xpi'),

    # create new add-on/library
    url(r'^addon/new/',
        'create', {"type_id": "a"}, name='jp_addon_create'),
    url(r'^library/new/',
        'create', {"type_id": "l"}, name='jp_library_create'),

    # package - display details of the PackageRevision
    url(r'^package/(?P<pk>\d+)/latest/$',
        'view_or_edit', {'latest': True}, name='jp_latest'),
    url(r'^package/(?P<pk>\d+)/$', 'view_or_edit', name='jp_details'),
    url(r'^package/(?P<pk>\d+)/version/(?P<version_name>.*)/$',
        'view_or_edit', name='jp_version_details'),
    url(r'^package/(?P<pk>\d+)/revision/(?P<revision_number>\d+)/$',
        'view_or_edit', name='jp_revision_details'),

    # get full module info
    url(r'^get_module/(?P<revision_id>\d+)/(?P<filename>.*)$',
        'get_module', name='jp_get_module'),
    url(r'^module/(?P<pk>\d+)/$', 'download_module', name='jp_module'),

    # copy a PackageRevision
    url(r'^package/copy/(?P<revision_id>\d+)/$',
        'copy', name='jp_package_revision_copy'),

    # get Package revisions list
    url(r'^revisions_list/(?P<revision_id>\d+)/$',
        'get_revisions_list_html', name='jp_revisions_list_html'),

    # save packagerevision
    url(r'^package/save/(?P<revision_id>\d+)/$',
        'save', name='jp_revision_save'),

    # disable/activate/delete package
    url(r'^package/disable/(?P<pk>[-\w]+)/$',
        'disable', name='jp_package_disable'),
    url(r'^package/activate/(?P<pk>[-\w]+)/$',
        'activate', name='jp_package_activate'),
    url(r'^package/delete/(?P<pk>[-\w]+)/$',
        'delete', name='jp_package_delete'),

    # get all, conflicting modules
    url(r'^revision/(?P<pk>\d+)/get_modules_list/$',
        'get_revision_modules_list', name='jp_revision_get_modules_list'),
    url(r'^revision/(?P<pk>\d+)/get_conflicting_modules_list/$',
        'get_revision_conflicting_modules_list',
        name='jp_revision_get_conflicting_modules_list'),

    # add/remove module
    url(r'^package/add_module/(?P<revision_id>\d+)/$',
        'add_module', name='jp_package_revision_add_module'),
    url(r'^package/remove_module/(?P<revision_id>\d+)/$',
        'remove_module', name='jp_package_revision_remove_module'),

    # rename module
    url(r'^package/rename_module/(?P<revision_id>\d+)/$',
        'rename_module', name='jp_package_revision_rename_module'),

    # switch SDK version
    url(r'^package/switch_sdk/(?P<revision_id>\d+)/$',
        'switch_sdk', name='jp_addon_switch_sdk_version'),

    # add/remove attachment
    url(r'^package/upload_attachment/(?P<revision_id>\d+)/$',
        'upload_attachment', name='jp_package_revision_upload_attachment'),
    url(r'^revision/(?P<pk>\d+)/add_attachment/',
        'revision_add_attachment', name='jp_revision_add_attachment'),
    url(r'^package/remove_attachment/(?P<revision_id>\d+)/$',
        'remove_attachment', name='jp_package_revision_remove_attachment'),

    # rename attachment
    url(r'^package/rename_attachment/(?P<revision_id>\d+)/$',
        'rename_attachment', name='jp_package_revision_rename_attachment'),

    #add empty dir
    url(r'^package/add_folder/(?P<revision_id>\d+)/$',
        'add_folder', name='jp_package_revision_add_folder'),

    #remove empty dir
    url(r'^package/remove_folder/(?P<revision_id>\d+)/$',
        'remove_folder', name='jp_package_revision_remove_folder'),

    # display attachment
    url(r'^attachment/(?P<uid>.*)$',
        'download_attachment', name='jp_attachment'),

    # autocomplete library
    url(r'^autocomplete/library/$',
        'library_autocomplete', name='jp_library_autocomplete'),
    # assign library
    url(r'^package/assign_library/(?P<revision_id>\d+)/$',
        'assign_library', name='jp_package_revision_assign_library'),

    # update library
    url(r'^package/update_library/(?P<revision_id>\d+)/$',
        'update_library', name='jp_package_revision_update_library'),

    # remove library
    url(r'^package/remove_dependency/(?P<revision_id>\d+)/$',
        'remove_library', name='jp_package_revision_remove_library'),

    # check libraries for latest versions
    url(r'package/check_latest_dependencies/(?P<revision_id>\d+)/$',
        'latest_dependencies', name='jp_package_check_latest_dependencies'),

# zip file
    url(r'^revision/prepare_zip/(?P<revision_id>\d+)/$',
        'prepare_zip', name='jp_revision_prepare_zip'),
    url(r'^revision/download_zip/(?P<hashtag>[a-zA-Z0-9]+)/(?P<filename>.*)/$',
        'get_zip', name='jp_revision_download_zip'),
    url(r'^revision/check_zip/(?P<hashtag>[a-zA-Z0-9]+)/$',
        'check_zip', name='jp_revision_check_zip'),
    url(r'^package/zip/(?P<pk>\d+)/$',
        'all_zip', name='jp_package_zip'),
)
