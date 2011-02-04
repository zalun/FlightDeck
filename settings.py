"""
Default settings for the FlightDeck site
For local configuration please use settings_local.py
"""
import os
import logging
import socket
import tempfile

# Make filepaths relative to settings.
ROOT = os.path.dirname(os.path.abspath(__file__))
path = lambda *a: os.path.join(ROOT, *a)

# Set the project version
PROJECT_VERSION = "1.0a5"

# TODO: This should be handled by prod in a settings_local.  By default, we
# shouldn't be in prod mode
# If PRODUCTION do not load development apps
PRODUCTION = True

# Django settings for flightdeck project.
DEBUG = False
TEMPLATE_DEBUG = DEBUG

ADMINS = (
        ('clouserw', 'clouserw@gmail.com'),
        ('zalun', 'pzalewa@mozilla.com'),
        ('dbuc', 'daniel@mozilla.com')
)
MANAGERS = ADMINS

DATABASES = {
    'default': {
        'NAME': 'zamboni',
        'ENGINE': 'django.db.backends.mysql',
        'HOST': '',
        'PORT': '',
        'USER': '',
        'PASSWORD': '',
        'OPTIONS': {'init_command': 'SET storage_engine=InnoDB'},
        'TEST_CHARSET': 'utf8',
        'TEST_COLLATION': 'utf8_general_ci',
    },
}


# Logging (copied from zamboni)
LOG_LEVEL = logging.DEBUG
HAS_SYSLOG = True  # syslog is used if HAS_SYSLOG and NOT DEBUG.
SYSLOG_TAG = "http_app_builder"
# See PEP 391 and log_settings.py for formatting help. Each section of LOGGING
# will get merged into the corresponding section of log_settings.py.
# Handlers and log levels are set up automatically based on LOG_LEVEL and DEBUG
# unless you set them here. Messages will not propagate through a logger
# unless propagate: True is set.
LOGGING = {
    'loggers': {
        'f.jetpack': {'level': logging.INFO},
    },
}

# How many packages per type should be displayed on the homepage
HOMEPAGE_ITEMS_LIMIT = 5

# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
TIME_ZONE = 'America/Los_Angeles'

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = 'en-us'

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

# The host currently running the site.  Only use this in code for good reason;
# the site is designed to run on a cluster and should continue to support that
HOSTNAME = socket.gethostname()

# Paths settings
MEDIA_ROOT = path('media')

FRAMEWORK_PATH = path()
SDK_SOURCE_DIR = path('lib')  # TODO: remove this var
APP_MEDIA_PREFIX = os.path.join(FRAMEWORK_PATH, 'apps')
UPLOAD_DIR = path('upload')
VIRTUAL_ENV = os.environ.get('VIRTUAL_ENV')  # TODO: remove this var

# jetpack defaults
PACKAGES_PER_PAGE = 10
MINIMUM_PACKAGE_ID = 1000000
INITIAL_VERSION_NAME = 'initial'
PACKAGE_PLURAL_NAMES = {
    'l': 'libraries',
    'a': 'addons'
}
PACKAGE_SINGULAR_NAMES = {
    'l': 'library',
    'a': 'addon'
}
DEFAULT_PACKAGE_FULLNAME = {
    'l': 'My Library'
}
HOMEPAGE_PACKAGES_NUMBER = 3

SDKDIR_PREFIX = tempfile.gettempdir()   # removed after xpi is created
XPI_TARGETDIR = tempfile.gettempdir()   # target dir - in shared directory

LIBRARY_AUTOCOMPLETE_LIMIT = 20
KEYDIR = 'keydir'
JETPACK_NEW_IS_BASE = False
JETPACK_ITEMS_PER_PAGE = 10

JETPACK_LIB_DIR = 'lib'
JETPACK_DATA_DIR = 'data'

PYTHON_EXEC = 'python'

# amo defaults
AUTH_DATABASE = None
# set it in settings_local.py if AMO auth should be used
#AUTH_DATABASE = {
#    'NAME': 'db_name',
#    'TABLE': 'users_table_name',
#    'USER': 'db_user',
#    'PASSWORD': '',  # db_password
#    'HOST': '',
#    'PORT': ''
#}

# Media section
APP_MEDIA_SUFFIX = 'media'

# URL that handles the media served from MEDIA_ROOT. Make sure to use a
# trailing slash if there is a path component (optional in other cases).
# Examples: "http://media.lawrence.com", "http://example.com/media/"
MEDIA_URL = ''

# Settings for user management
LOGIN_URL = '/user/signin/'
LOGIN_REDIRECT_URL = '/user/dashboard/'
AUTH_PROFILE_MODULE = 'person.Profile'
AUTHENTICATION_BACKENDS = (
   'amo.authentication.AMOAuthentication',
)


# URL prefix for admin media -- CSS, JavaScript and images. Make sure to use a
# trailing slash.
# Examples: "http://foo.com/media/", "/media/".
ADMIN_MEDIA_PREFIX = '/adminmedia/'

# Title to be displayed on the Admin site
ADMIN_TITLE = "Add-on Builder Administration"

SITE_ID = 1
# Title to be used on the page
SITE_TITLE = "Add-on Builder"

# Define in settings_local.py ake this unique, and don't share it with anybody.
SECRET_KEY = 'somesecretkey'

# Cookies which should not have the httponly set to true
JAVASCRIPT_READABLE_COOKIES = ()
SESSION_COOKIE_SECURE = True

SESSION_COOKIE_NAME = "bamo_sessionid"

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.load_template_source',
    'django.template.loaders.app_directories.load_template_source',
    'django.template.loaders.eggs.load_template_source',
)

MIDDLEWARE_CLASSES = [
    # Munging REMOTE_ADDR must come before ThreadRequest.
    'commonware.middleware.SetRemoteAddrFromForwardedFor',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'debug_toolbar.middleware.DebugToolbarMiddleware',
    'utils.cookies.HttpOnlyMiddleware',
    'commonware.middleware.FrameOptionsHeader',
    'commonware.middleware.HidePasswordOnException',
]

TEMPLATE_CONTEXT_PROCESSORS = (
    'django.core.context_processors.auth',
    'django.core.context_processors.request',
    'base.context_processors.settings',
    'django.contrib.messages.context_processors.messages',
    'person.context_processors.profile',
)

ROOT_URLCONF = 'urls'

ADDONS_HELPER_URL = ('https://addons.mozilla.org/firefox/downloads/latest/'
                    '182410?src=external-builder')

TEMPLATE_DIRS = ()

# Change default test runner (works only with mysql)
TEST_RUNNER = 'test_utils.runner.RadicalTestSuiteRunner'

# Modify in settings_local if needed
SELENIUM_CONFIG = {}

# Django toolbar configuration
DEBUG_TOOLBAR_CONFIG = {
    # change to True needed if debugging creation of Add-ons
    'INTERCEPT_REDIRECTS': False
}

# Switch on debug_toolbar for these IPs
INTERNAL_IPS = ('127.0.0.1',)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.markup',
    'django.contrib.messages',

    # database migrations not implemented yet
    # 'south',

# DEV_APPS
    'django_extensions',
    'debug_toolbar',
    'django_nose',

# FLIGHTDECK APPS
    'base',              # basic flightdeck things (utils, urls)
    'person',            # user related stuff (profile etc.)
    'amo',               # currently addons.mozilla.org authentication
    'jetpack',           # Jetpack functionality
    'xpi',               # XPI management
    'api',               # API browser
    'tutorial',          # Load tutorial templates
    'cronjobs',

# 3RD PARTY APPS
    'djcelery',
]

# Which from above apps should be removed if in PRODUCTION
DEV_APPS = (
    'django_extensions',
    'debug_toolbar',
    'django_nose',
)
# Which from above Middleware classes should be removed if in PRODUCTION
DEV_MIDDLEWARE_CLASSES = (
    'debug_toolbar.middleware.DebugToolbarMiddleware',
)


# If you want to run Selenium tests, you'll need to have a server running.
# Then give this a dictionary of settings. Something like:
#SELENIUM_CONFIG = {
#     'HOST': 'localhost',
#     'PORT': 4444,
#     'BROWSER': '*firefox',
#}

import djcelery
djcelery.setup_loader()

# These settings are for if you have celeryd running
#BROKER_HOST = 'localhost'
#BROKER_PORT = 5672
#BROKER_USER = 'builder'
#BROKER_PASSWORD = 'builder'
#BROKER_VHOST = 'builder'
#BROKER_CONNECTION_TIMEOUT = 0.1
#CELERY_RESULT_BACKEND = 'amqp'
#CELERY_IGNORE_RESULT = True

# Setting this to true will bypass celeryd and execute tasks in-process
CELERY_ALWAYS_EAGER = True

ENGAGE_ROBOTS = False
