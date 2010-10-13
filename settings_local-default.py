"""
Local settings
Please copy to settings_local.py which should remain private
"""

import os

FRAMEWORK_PATH = os.path.dirname(os.path.dirname(__file__)) + '/'

ADMINS = (
    #('Your Name', 'your@email.info'),
)

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'db_name',
        'USER': 'db_user',
        'PASSWORD': '',  # database password
        'HOST': '',
        'PORT': '',
    }
}

SDK_SOURCE_DIR = os.path.join(FRAMEWORK_PATH, 'sdk_versions/')

MEDIA_ROOT = os.path.join(FRAMEWORK_PATH, 'flightdeck/media')
MEDIA_PREFIX = os.path.join(FRAMEWORK_PATH, 'flightdeck/')

SECRET_KEY = 'somerandomstring' # please change it

# this setting is needed so os applicatio') run from within the site
# will use the same virtual environment
VIRTUAL_ENV = os.environ.get('VIRTUAL_ENV')
ACTIVATE_THIS = os.path.join(VIRTUAL_ENV, 'bin/activate_this.py')


#AUTH_DATABASE = {
#    'NAME': 'db_name',
#    'TABLE': 'users_table_name',
#    'USER': 'db_user',
#    'PASSWORD': '',  # db_password
#    'HOST': '',
#    'PORT': ''
#}

# If you want to run Selenium tests, you'll need to have a server running.
# Then give this a dictionary of settings. Something like:
#SELENIUM_CONFIG = {
#     'HOST': 'localhost',
#     'PORT': 4444,
#     'BROWSER': '*firefox',
#}

PRODUCTION = True
DEBUG = False
TEMPLATE_DEBUG = DEBUG
