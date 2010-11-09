#!/usr/bin/env python
import os
import sys
import site

site.addsitedir('vendor')
site.addsitedir('vendor/lib/python')


ROOT = os.path.dirname(os.path.abspath(__file__))
path = lambda *a: os.path.join(ROOT, *a)

prev_sys_path = list(sys.path)

site.addsitedir(path('apps'))
site.addsitedir(path('lib'))
site.addsitedir(path('lib/jetpack-sdk-0.8/python-lib'))  # weak sauce

# Move the new items to the front of sys.path. (via virtualenv)
new_sys_path = []
for item in list(sys.path):
    if item not in prev_sys_path:
        new_sys_path.append(item)
        sys.path.remove(item)
sys.path[:0] = new_sys_path

# No third-party imports until we've added all our sitedirs!
from django.core.management import execute_manager, setup_environ

try:
    import settings_local as settings
except ImportError:
    try:
        import settings
    except ImportError:
        import sys
        sys.stderr.write(
            "Error: Tried importing 'settings_local.py' and 'settings.py' "
            "but neither could be found (or they're throwing an ImportError)."
            " Please come back and try again later.")
        raise

if settings.PRODUCTION:
    for app in settings.DEV_APPS:
        if app in settings.INSTALLED_APPS:
            settings.INSTALLED_APPS.remove(app)

    for middleware in settings.DEV_MIDDLEWARE_CLASSES:
        if middleware in settings.MIDDLEWARE_CLASSES:
            settings.MIDDLEWARE_CLASSES.remove(middleware)

# The first thing execute_manager does is call `setup_environ`.  Logging config
# needs to access settings, so we'll setup the environ early.
setup_environ(settings)

# Import for side-effect: configures our logging handlers.
# pylint: disable-msg=W0611
import log_settings

if __name__ == "__main__":
    execute_manager(settings)
