from test_utils import TestCase
from mock import Mock

from jetpack import conf
from jetpack.models import Package
from jetpack.errors import SingletonCopyException


class CoreLibTestCase(TestCase):

    fixtures = ['mozilla_user', 'core_sdk']

    def test_findCoreLibrary(self):
        sdk = Package.objects.get(id_number=conf.MINIMUM_PACKAGE_ID)
        self.failUnless(sdk)
        self.failUnless(sdk.is_library())

    def test_preventFromCopying(self):
        sdk = Package.objects.get(id_number=conf.MINIMUM_PACKAGE_ID)
        author = Mock()
        self.assertRaises(SingletonCopyException, sdk.copy, author)
