import os.path

FRAMEWORK_PATH = os.path.dirname(os.path.dirname(__file__)) + '/'

ADMINS = (
   # ('Your Name', 'your_email@domain.com'),
)

# this is default development setting - please change to other db in production
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        # Change 'postgresql_psycopg2', 'postgresql', 'mysql', 'sqlite3'
        'NAME': os.path.join(FRAMEWORK_PATH, 'dev.db'),
        'USER': '',
        'PASSWORD': '',
        'HOST': '',
        'PORT': '',
    }
}

TIME_ZONE = 'America/San Francisco'
LANGUAGE_CODE = 'en-us'
SITE_ID = 1
MEDIA_ROOT = ''
MEDIA_URL = ''
SECRET_KEY = 'randomstring'

DEBUG = False

INTERNAL_IPS = ('127.0.0.1',)

MEDIA_ROOT = os.path.join(FRAMEWORK_PATH, 'flightdeck/media/')

#ADMIN_MEDIA_ROOT = os.path.join(FRAMEWORK_PATH,
#                                'flightdeck/adminmedia/')

SDK_SOURCE_DIR = os.path.join(FRAMEWORK_PATH, 'sdk_versions/')

# this setting is needed so os applications run from within the site
# will use the same virtual environment
VIRTUAL_ENV = '/path/to/virtual/env'
ACTIVATE_THIS = os.path.join(VIRTUAL_ENV, 'bin/activate_this.py')

# uncomment if FlightDeck should authenticate against database
#AUTH_DATABASE = {
#    'NAME': '',
#    'TABLE': 'users',
#    'USER': '',
#    'PASSWORD': '',
#    'HOST': '',
#    'PORT': ''
#} # it's always MySQL!
