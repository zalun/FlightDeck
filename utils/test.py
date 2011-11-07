import os

from test_utils import TestCase as _TestCase
from django.conf import settings
from django.contrib.auth.models import User

from jetpack.models import SDK, Package

def get_latest_sdk_dir():
    lib_dir = os.path.join(settings.FRAMEWORK_PATH, 'lib')
    sdks = os.listdir(lib_dir)
    found = None
    sdk_time = -1
    if hasattr(settings, 'TEST_SDK'):
        return settings.TEST_SDK
    for sdk in sdks:
        if os.path.isdir(os.path.join(lib_dir, sdk)):
            sdk_inf = os.stat(os.path.join(lib_dir, sdk))
            if sdk_time < 0 or sdk_time < sdk_inf.st_ctime:
                sdk_time = sdk_inf.st_ctime
                found = sdk
    return found

class TestCase(_TestCase):
    """
    Base class for tests depending on existance of lib/jetpack-sdk
    """
    def createCore(self, core_dir='jetpack-sdk'):
        " discover the newest dir and link to it "
        # find the newest SDK
        self.sdk_filename = get_latest_sdk_dir()
        self.sdk_path = os.path.join(settings.FRAMEWORK_PATH,
                'lib/', core_dir)
        sdk_orig = os.path.join(settings.FRAMEWORK_PATH, 'lib',
                self.sdk_filename)
        self.core_link_created = False
        if not os.path.exists(self.sdk_path):
            os.symlink(sdk_orig, self.sdk_path)
            self.core_link_created = True

    def deleteCore(self):
        " remove symlink "
        if not hasattr(self, 'core_link_created'):
            return
        if self.core_link_created:
            os.remove(self.sdk_path)

    def createTestSDK(self, name='test'):
        if SDK.objects.count():
            core_sdk = SDK.objects.latest('pk')
            core_lib = core_sdk.core_lib
            core_lib.save()
            kit_lib = core_sdk.kit_lib
            kit_lib.save()
        else:
            # create Package and PackageRevision
            author = User.objects.create(username='SDK owner')
            core_lib = Package.objects.create(
                   full_name='Core Lib',
                   type='l',
                   author=author).latest
            kit_lib = Package.objects.create(
                   full_name='Kit Lib',
                   type='l',
                   author=author).latest

        self.test_sdk = SDK.objects.create(
                version='test',
                core_lib=core_lib,
                kit_lib=kit_lib,
                dir=settings.TEST_SDK)

