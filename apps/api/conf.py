import os
from django.conf import settings

from jetpack.models import SDK

sdks = SDK.objects.all()
if sdks.count() > 0:
    SDKPACKAGESDIR = os.path.join(settings.FRAMEWORK_PATH,
                               'sdk_versions', sdks[0].dir, 'packages')
    SDKVERSION = sdks[0].version
else:
    SDKPACKAGESDIR = os.path.join(settings.VIRTUAL_ENV,
                               'src/jetpack-sdk/packages')

# ------------------------------------------------------------------------
VIRTUAL_ENV = settings.VIRTUAL_ENV
FRAMEWORK_PATH = settings.FRAMEWORK_PATH
DEBUG = settings.DEBUG
