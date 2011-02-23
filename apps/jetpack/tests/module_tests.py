# coding=utf-8
"""
Piotr Zalewa (pzalewa@mozilla.com)
"""
import commonware

from test_utils import TestCase
from nose.tools import eq_
from nose import SkipTest

from django.contrib.auth.models import User

from jetpack.models import Module
from jetpack.errors import UpdateDeniedException

log = commonware.log.getLogger('f.test')

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

    def test_create_module_with_utf_content(self):
        author = User.objects.get(username='john')
        mod = Module.objects.create(
                filename='test_filename',
                author=author,
                code="ą")
        raise SkipTest
        # this would work if db would be in utf-8 mode
        #eq_(Module.objects.get(author=author).code, "ą")
