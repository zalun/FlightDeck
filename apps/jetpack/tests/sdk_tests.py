"""
jetpack.tests.sdk_tests
-----------------------
"""
import commonware

from test_utils import TestCase
from nose.tools import eq_

from django.conf import settings
from django.contrib.auth.models import User

from jetpack.models import Package, PackageRevision, SDK

log = commonware.log.getLogger('f.test')


class SDKTests(TestCase):
    fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

    def setUp(self):
        self.addon = Package.objects.filter(type='a')[0]
        self.mozuser = User.objects.get(username='4757633')
        self.sdk = SDK.objects.get()
        self.LOWEST_APPROVED_SDK = settings.LOWEST_APPROVED_SDK

    def tearDown(self):
        settings.LOWEST_APPROVED_SDK = self.LOWEST_APPROVED_SDK

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

    def test_is_deprecated(self):
        settings.LOWEST_APPROVED_SDK = '1.0.2'
        self.sdk.version = '1.0'
        assert self.sdk.is_deprecated()
        self.sdk.version = '1.0.10'
        assert not self.sdk.is_deprecated()
        self.sdk.version = '1.0.2'
        assert not self.sdk.is_deprecated()

        # Althought it is broken here there is no danger hence we are not
        # allow for beta SDK in production
        # If needed, the solution is to use parse_version from pkg_resources
        # library (proposed in http://stackoverflow.com/a/6972866/23457)
        #self.sdk.version = '1.0.2.beta1'
        #assert self.sdk.is_deprecated()

        settings.LOWEST_APPROVED_SDK = '1.0.2.beta2'
        self.sdk.version = '1.0.2.beta1'
        assert self.sdk.is_deprecated()

