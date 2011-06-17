"""
jetpack.tests.sdk_tests
-----------------------
"""
import commonware

from test_utils import TestCase
from nose.tools import eq_

from django.contrib.auth.models import User

from jetpack.models import Package, PackageRevision, SDK

log = commonware.log.getLogger('f.test')


class SDKTests(TestCase):
    fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

    def setUp(self):
        self.addon = Package.objects.filter(type='a')[0]
        self.mozuser = User.objects.get(username='mozilla')
        self.sdk = SDK.objects.get()

    def test_purge(self):
        version = 'testsdk'
        kit_lib = PackageRevision.objects.create(
                author=self.mozuser,
                package=self.sdk.kit_lib.package,
                revision_number=self.sdk.kit_lib.revision_number + 1,
                version_name=version)
        core_lib = PackageRevision.objects.create(
                author=self.mozuser,
                package=self.sdk.core_lib.package,
                revision_number=self.sdk.core_lib.revision_number + 1,
                version_name=version)
        sdk = SDK.objects.create(
                version=version,
                kit_lib=kit_lib,
                core_lib=core_lib,
                dir='somefakedir')
        sdk.delete(purge=True)
        eq_(len(PackageRevision.objects.filter(version_name=version)), 0)

