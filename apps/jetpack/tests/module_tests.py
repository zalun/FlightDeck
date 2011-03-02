# coding=utf-8
"""
Piotr Zalewa (pzalewa@mozilla.com)
"""
import os
import commonware
import json

from test_utils import TestCase
from nose.tools import eq_
from nose import SkipTest

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from jetpack.models import Package, PackageRevision, Module
from jetpack.errors import UpdateDeniedException

log = commonware.log.getLogger('f.test')

def next(revision):
    number = revision.revision_number
    return (PackageRevision.objects.filter(revision_number__gt=number,
                                           package=revision.package)
                                   .order_by('-revision_number')[:1])[0]

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
                code=u'ą')
        eq_(Module.objects.get(author=author).code, u'ą')

class TestModules(TestCase):

    fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

    def setUp(self):
        self.author = User.objects.get(username='john')
        self.author.set_password('password')
        self.author.save()

        self.package = self.author.packages_originated.addons()[0:1].get()
        self.revision = self.package.revisions.all()[0]

        self.client.login(username=self.author.username, password='password')

    def add_one(self, filename='tester'):
        self.client.post(self.get_add_url(self.revision.revision_number), { 'filename': filename })
        self.revision = next(self.revision)
        return self.revision

    def get_add_url(self, revision):
        args = [self.package.id_number, revision]
        return reverse('jp_addon_revision_add_module', args=args)
    
    def get_rename_url(self, revision):
        args = [self.package.id_number, revision]
        return reverse('jp_addon_revision_rename_module', args=args)

    def get_delete_url(self, revision):
        args = [self.package.id_number, revision]
        return reverse('jp_addon_revision_remove_module', args=args)

    def test_module_add(self):
        revision = self.add_one('a-module')
        # 1 for main, 1 for added, so 2
        eq_(revision.modules.all().count(), 2)
        eq_(revision.modules.all().order_by('-id')[0].filename, 'a-module')

    def test_module_add_with_extension(self):
        revision = self.add_one('test.js')
        eq_(revision.modules.all().order_by('-id')[0].filename, 'test')

    def test_module_name_sanitization(self):
        revision = self.add_one(filename='A"> <a href="google.com">malicious module')
        eq_(revision.modules.all().order_by('-id')[0].filename, 'A-a-href-google')

        revision = self.add_one(filename='void:myXSSFunction(fd.item)')
        eq_(revision.modules.all().order_by('-id')[0].filename, 'void-myXSSFunction-fd')
    
    def test_module_rename(self):
        first_name = 'a-module'
        revision = self.add_one(first_name)
        
        res = self.client.post(self.get_rename_url(self.revision.revision_number),
                               {'old_filename': first_name,
                                'new_filename': 'different-module.js'})
        
        eq_(res.status_code, 200)
        data = json.loads(res.content)
        
        eq_(data.get('filename'), 'different-module')
