from django.conf.urls.defaults import url, patterns
from django.contrib.auth.views import login, logout
from forms import AuthenticationForm

from nose.tools import eq_


urlpatterns = patterns('person.views',
    url(r'^signin/$', login,
        {'authentication_form': AuthenticationForm}, name='login'),
    url(r'^signout/$', logout, {"next_page": "/"}, name='logout'),
    
    url('^browserid-login/', 'browserid_login', name='browserid_login'),

    # dashboard
    url(r'dashboard/$', 'dashboard', name='person_dashboard'),

    # disabled
    url(r'^private_addons/$', 'dashboard_browser',
        {'type': 'a', 'disabled': True}, name='person_disabled_addons'),
    url(r'^private_libraries/$', 'dashboard_browser',
        {'type': 'l', 'disabled': True}, name='person_disabled_libraries'),
    url(r'^private_addons/(?P<page_number>\d+)/$', 'dashboard_browser',
        {'type': 'a', 'disabled': True}, name='person_disabled_addons_page'),
    url(r'^private_libraries/(?P<page_number>\d+)/$', 'dashboard_browser',
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
    url(r'^(?P<username>[-\w]+)/$', 'public_profile',
        name='person_public_profile'),
)
