# Set the project version
PROJECT_VERSION = "1.0a5"

# Django settings for flightdeck project.
PRODUCTION = True
DEBUG = False
TEMPLATE_DEBUG = DEBUG

ADMINS = (
   # ('Your Name', 'your_email@domain.com'),
)

HOMEPAGE_ITEMS_LIMIT = 5

MANAGERS = ADMINS

# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
TIME_ZONE = 'America/Chicago'

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = 'en-us'

SITE_ID = 1

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

# Absolute path to the directory that holds media.
# Example: "/home/media/media.lawrence.com/"
MEDIA_ROOT = ''

# URL that handles the media served from MEDIA_ROOT. Make sure to use a
# trailing slash if there is a path component (optional in other cases).
# Examples: "http://media.lawrence.com", "http://example.com/media/"
MEDIA_URL = ''

LOGIN_URL = '/user/signin/'
LOGIN_REDIRECT_URL = '/user/dashboard/'

# URL prefix for admin media -- CSS, JavaScript and images. Make sure to use a
# trailing slash.
# Examples: "http://foo.com/media/", "/media/".
ADMIN_MEDIA_PREFIX = '/adminmedia/'

ADMIN_TITLE = "Add-on Builder Administration"

SITE_TITLE = "Add-on Builder"

# Make this unique, and don't share it with anybody.
SECRET_KEY = 'somesecretkey'

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.load_template_source',
    'django.template.loaders.app_directories.load_template_source',
    'django.template.loaders.eggs.load_template_source',
)

MIDDLEWARE_CLASSES = (
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'debug_toolbar.middleware.DebugToolbarMiddleware',
)

TEMPLATE_CONTEXT_PROCESSORS = (
    'django.core.context_processors.auth',
    'django.core.context_processors.request',
    'base.context_processors.settings',
    'django.contrib.messages.context_processors.messages',
    'person.context_processors.profile',
)

ROOT_URLCONF = 'flightdeck.urls'

ADDONS_HELPER_URL = 'https://addons.mozilla.org/firefox/downloads/latest/182410?src=external-builder'

TEMPLATE_DIRS = (
)

# Tests
TEST_RUNNER = 'test_utils.runner.RadicalTestSuiteRunner'


# If you want to run Selenium tests, you'll need to have a server running.
# Then give this a dictionary of settings. Something like:
#     'HOST': 'localhost',
#     'PORT': 4444,
#     'BROWSER': '*firefox', # Alternative: *safari
SELENIUM_CONFIG = {}

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.markup',
    'django.contrib.messages',

    # database migrations
    # not implemented yet
    # 'south',

# DEV_APPS
    'django_extensions',
    'debug_toolbar',
    'django_nose',

# FLIGHTDECK APPS

    # FlightDeck apps
    'base',              # basic flightdeck things (utils, urls)
    'person',            # user related stuff (profile etc.)
    'amo',               # currently addons.mozilla.org authentication
    'jetpack',           # Jetpack functionality
    'api',               # API browser
    'tutorial'           # Load tutorial templates
]

DEV_APPS = [
    'django_extensions',
    'debug_toolbar',
    'django_nose',
]

AUTH_PROFILE_MODULE = 'person.Profile'

AUTHENTICATION_BACKENDS = (
   'amo.authentication.AMOAuthentication',
)

# overwrite default settings with the ones from settings_local.py
try:
    from settings_local import *
except:
    pass

if PRODUCTION:
    for app in DEV_APPS:
        if app in INSTALLED_APPS:
            INSTALLED_APPS.remove(app)

execfile(ACTIVATE_THIS, dict(__file__=ACTIVATE_THIS))
