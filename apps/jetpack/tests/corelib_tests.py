from test_utils import TestCase

from django.contrib.auth.models import User
from django.conf import settings

from jetpack.models import Package
from jetpack.errors import SingletonCopyException


class CoreLibTestCase(TestCase):

    fixtures = ['mozilla_user', 'core_sdk', 'users']

    def setUp(self):
        " get core lib from fixtures "
        self.corelib = Package.objects.get(id_number=settings.MINIMUM_PACKAGE_ID)

    def test_findCoreLibrary(self):
        self.failUnless(self.corelib)
        self.failUnless(self.corelib.is_library())
        self.failUnless(self.corelib.is_singleton())
        self.failUnless(self.corelib.is_core())

    def test_preventFromCopying(self):
        author = User.objects.get(username='john')
        self.assertRaises(SingletonCopyException, self.corelib.copy, author)
