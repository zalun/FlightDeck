from test_utils import TestCase

from django.contrib.auth.models import User

from jetpack.models import Package


class LibraryTest(TestCase):
    fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

    def setUp(self):
        self.author = User.objects.get(username='john')

    def test_library_has_no_main_module(self):
        " library has no executable module "
        lib = Package.objects.get(type='l', author=self.author)
        self.assertEqual(lib.latest.get_main_module(), None)

