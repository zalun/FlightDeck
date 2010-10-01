from django.conf.urls.defaults import url, patterns
from django.contrib.auth.views import login, logout
from forms import AuthenticationForm


urlpatterns = patterns('person.views',
    url(r'^signin/$', login,
        {'authentication_form': AuthenticationForm}, name='login'),
    url(r'^signout/$', logout, {"next_page": "/"}, name='logout'),

    # dashboard
    url(r'dashboard/$', 'dashboard', name='person_dashboard'),

    # disabled
    url(r'^disabled_addons/$', 'dashboard_browser',
        {'type': 'a', 'disabled': True}, name='person_disabled_addons'),
    url(r'^disabled_libraries/$', 'dashboard_browser',
        {'type': 'l', 'disabled': True}, name='person_disabled_libraries'),
    url(r'^disabled_addons/(?P<page_number>\d+)/$', 'dashboard_browser',
        {'type': 'a', 'disabled': True}, name='person_disabled_addons_page'),
    url(r'^disabled_libraries/(?P<page_number>\d+)/$', 'dashboard_browser',
        {'type': 'l', 'disabled': True},
        name='person_disabled_libraries_page'),

    # packages
    url(r'^addons/$',
        'dashboard_browser', {'type': 'a'}, name='person_addons'),
    url(r'^libraries/$',
        'dashboard_browser', {'type': 'l'}, name='person_libraries'),
    url(r'^addons/(?P<page_number>\d+)/$',
        'dashboard_browser', {'type': 'a'}, name='person_addons_page'),
    url(r'^libraries/(?P<page_number>\d+)/$',
        'dashboard_browser', {'type': 'l'}, name='person_libraries_page'),

    # public profile
    url(r'^(?P<username>\w+)/$', 'public_profile',
        name='person_public_profile'),
)
