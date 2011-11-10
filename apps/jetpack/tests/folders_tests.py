import os
import json

from test_utils import TestCase
#from nose import SkipTest
from nose.tools import eq_

from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from jetpack.models import Package, PackageRevision, Module, EmptyDir, \
        Attachment

def newest(revision):
    number = revision.revision_number
    return (PackageRevision.objects.filter(revision_number__gt=number,
                                           package=revision.package)
                                   .order_by('-revision_number')[:1])[0]

class FolderTest(TestCase):
    fixtures = ['mozilla_user', 'users', 'packages']

    def setUp(self):
        self.author = User.objects.get(username='john')
        self.path = 'util'

    def test_folder_removed_when_modules_added(self):
        " EmptyDir's shouldn't exist if there are modules inside the 'dir' "
        addon = Package(author=self.author, type='a')
        addon.save()
        revision = PackageRevision.objects.filter(package__name=addon.name)[0]

        folder = EmptyDir(name=self.path, author=self.author, root_dir='l')
        folder.save()
        revision.folder_add(folder)
        self.assertEqual(1, revision.folders.count())

        mod = Module(
            filename='/'.join([self.path, 'helpers']),
            author=self.author,
            code='//test code'
        )
        mod.save()
        revision.module_add(mod)
        self.assertEqual(0, revision.folders.count())

        mod = Module(
            filename='model',
            author=self.author,
            code='//test code'
        )
        mod.save()
        revision.module_add(mod)
        self.assertEqual(0, revision.folders.count())

    def test_folder_added_when_modules_removed(self):
        " EmptyDir's should be added if all modules in a 'dir' are removed "
        addon = Package(author=self.author, type='a')
        addon.save()
        revision = PackageRevision.objects.filter(package__name=addon.name)[0]

        mod = Module(
            filename='/'.join([self.path, 'helpers']),
            author=self.author,
            code='//test code'
        )
        mod.save()
        revision.module_add(mod)
        self.assertEqual(0, revision.folders.count())

        revision.module_remove(mod)
        self.assertEqual(1, revision.folders.count())
        self.assertEqual(self.path, revision.folders.all()[0].name)

    def test_folder_removed_when_attachments_added(self):
        " EmptyDir's shouldn't exist if there are attachments inside the 'dir' "
        addon = Package.objects.create(author=self.author, type='a')
        revision = addon.latest

        folder = EmptyDir.objects.create(name=self.path, author=self.author,
                root_dir='d')
        revision.folder_add(folder)
        self.assertEqual(1, revision.folders.count())

        att = Attachment(
            filename='/'.join([self.path, 'helpers']),
            author=self.author,
            ext='js'
        )
        att.save()
        revision.attachment_add(att)
        self.assertEqual(0, revision.folders.count())

        att = Attachment(
            filename='model',
            author=self.author,
            ext='html'
        )
        att.save()
        revision.attachment_add(att)
        self.assertEqual(0, revision.folders.count())

    def test_folder_added_when_attachments_removed(self):
        " EmptyDir's should be added if all attachments in a 'dir' are removed "
        addon = Package(author=self.author, type='a')
        addon.save()
        revision = PackageRevision.objects.filter(package__name=addon.name)[0]

        att = Attachment(
            filename='/'.join([self.path, 'helpers']),
            author=self.author,
            ext='js'
        )
        att.save()
        revision.attachment_add(att)
        self.assertEqual(0, revision.folders.count())

        revision.attachment_remove(att)
        self.assertEqual(1, revision.folders.count())
        self.assertEqual(self.path, revision.folders.all()[0].name)

class TestViews(TestCase):
    fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

    def setUp(self):
        if not os.path.exists(settings.UPLOAD_DIR):
            os.makedirs(settings.UPLOAD_DIR)

        self.author = User.objects.get(username='john')
        self.author.set_password('password')
        self.author.save()

        self.package = self.author.packages_originated.addons()[0:1].get()
        self.revision = self.package.revisions.all()[0]

        self.client.login(username=self.author.username, password='password')

    def post(self, url, data):
        return self.client.post(url, data)

    def add_one(self, name='tester', root_dir='l'):
        self.post(self.get_add_url(self.revision.revision_number),
                  { 'name': name, 'root_dir': root_dir })
        self.revision = newest(self.revision)
        return self.revision

    def get_add_url(self, revision):
        args = [self.package.id_number, revision]
        return reverse('jp_addon_revision_add_folder', args=args)

    def get_delete_url(self, revision):
        args = [self.package.id_number, revision]
        return reverse('jp_addon_revision_remove_folder', args=args)

    def test_add_folder(self):
        res = self.post(self.get_add_url(self.revision.revision_number),
                        { 'name': 'tester', 'root_dir': 'l' })
        eq_(res.status_code, 200)
        json.loads(res.content)

        revision = newest(self.revision)
        folder = revision.folders.all()[0]
        eq_(folder.name, 'tester')

    def test_remove_folder(self):
        self.add_one()
        res = self.post(self.get_delete_url(self.revision.revision_number),
                        { 'name': 'tester', 'root_dir': 'l' })
        eq_(res.status_code, 200)
        json.loads(res.content)

        revision = newest(self.revision)
        eq_(revision.folders.count(), 0)

    def test_remove_fake_folder(self):
        self.add_one()
        res = self.post(self.get_delete_url(self.revision.revision_number), {
            'name': 'im_not_a_folder',
            'root_dir': 'l'
        })

        eq_(res.status_code, 403)

    def test_folder_sanitization(self):
        revision = self.add_one(name='A"> <script src="google.com">/m@l!c!ous')
        eq_(revision.folders.all()[0].name, 'A-script-src-googlecom-/m-l-c-ous')
        revision.folder_remove(revision.folders.all()[0])

        revision = self.add_one(name='/absolute///and/triple/')
        eq_(revision.folders.all()[0].name, 'absolute/and/triple')
