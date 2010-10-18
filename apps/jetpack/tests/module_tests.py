"""
Piotr Zalewa (pzalewa@mozilla.com)
"""

from test_utils import TestCase

from django.contrib.auth.models import User

from jetpack.models import Module
from jetpack.errors import UpdateDeniedException


class ModuleTest(TestCase):
    " Testing module methods "

    fixtures = ['users']

    def test_update_module_using_save(self):
        " updating module is not allowed "
        author = User.objects.get(username='john')
        mod = Module.objects.create(
            filename='test_filename',
            author=author
        )
        self.assertRaises(UpdateDeniedException, mod.save)
