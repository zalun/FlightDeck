import os
import commonware
import json
import StringIO
import simplejson
import hashlib
from datetime import datetime

from test_utils import TestCase
from nose.tools import eq_
from nose import SkipTest
from mock import patch

#from pyquery import PyQuery as pq

from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from jetpack.models import Package, PackageRevision, Attachment, Module
from jetpack.errors import FilenameExistException
from base.templatetags.base_helpers import hashtag

log = commonware.log.getLogger('f.test')

def next(revision):
    number = revision.revision_number
    return (PackageRevision.objects.filter(revision_number__gt=number,
                                           package=revision.package)
                                   .order_by('-revision_number')[:1])[0]


class TestPackage(TestCase):
    fixtures = ('mozilla_user', 'core_sdk', 'users', 'packages')

    def setUp(self):
        self.hashtag = hashtag()
        self.check_download_url = reverse('jp_check_download_xpi',
                args=[self.hashtag])

    @patch('os.path.isfile')
    def test_package_check_download(self, isfile):
        """
        If we are waiting for the XPI, we'll need to test the redirecty stuff.
        """
        isfile.return_value = False
        r = self.client.get(self.check_download_url)
        eq_(r.status_code, 200)
        eq_(r.content, '{"ready": false}')
        isfile.return_value = True
        r = self.client.get(self.check_download_url)
        eq_(r.status_code, 200)
        eq_(r.content, '{"ready": true}')

    def test_package_browser_no_use(self):
        """If user does not exist raise 404
        """
        r = self.client.get(
                reverse('jp_browser_user_addons', args=['not_a_user']))
        eq_(r.status_code, 404)

    def test_display_deleted_package(self):
        author = User.objects.get(username='john')
        author.set_password('secure')
        author.save()
        user = User.objects.get(username='jan')
        user.set_password('secure')
        user.save()
        addon = Package.objects.create(author=user, type='a')
        lib = Package.objects.create(author=author, type='l')
        addon.latest.dependency_add(lib.latest)
        # logging in the author
        self.client.login(username=author.username, password='secure')
        # deleting lib
        response = self.client.get(reverse('jp_package_delete', args=[lib.id_number]))
        eq_(response.status_code, 200)
        response = self.client.get(lib.get_absolute_url())
        # lib deleted - shouldn't be visible by author
        eq_(response.status_code, 404)
        # logging in the addon owner
        self.client.login(username=user.username, password='secure')
        # addon used lib - its author shouldbe able to see it
        response = self.client.get(lib.get_absolute_url())
        eq_(response.status_code, 200)

    def test_display_disabled_package(self):
        author = User.objects.get(username='john')
        author.set_password('secure')
        author.save()
        user = User.objects.get(username='jan')
        user.set_password('secure')
        user.save()
        lib = Package.objects.create(author=author, type='l')
        # logging in the author
        self.client.login(username=author.username, password='secure')
        # private on
        response = self.client.get(reverse('jp_package_disable', args=[lib.id_number]))
        eq_(response.status_code, 200)
        response = self.client.get(lib.get_absolute_url())
        # lib private - should be visible by author
        eq_(response.status_code, 200)
        # logging in the other user
        self.client.login(username=user.username, password='secure')
        # lib private - shouldn't be visible by others
        response = self.client.get(lib.get_absolute_url())
        eq_(response.status_code, 404)

    def test_display_disabled_package(self):
        author = User.objects.get(username='john')
        author.set_password('secure')
        author.save()
        user = User.objects.get(username='jan')
        user.set_password('secure')
        user.save()
        lib = Package.objects.create(author=author, type='l')
        addon = Package.objects.create(author=user, type='a')
        addon.latest.dependency_add(lib.latest)
        # logging in the author
        self.client.login(username=author.username, password='secure')
        # private on
        response = self.client.get(reverse('jp_package_disable', args=[lib.id_number]))
        eq_(response.status_code, 200)
        # logging in the user
        self.client.login(username=user.username, password='secure')
        # addon depends on lib should be visable
        response = self.client.get(lib.get_absolute_url())
        eq_(response.status_code, 200)

class TestEmptyDirs(TestCase):
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
        return self.client.post(url, data);

    def add_one(self, name='tester', root_dir='l'):
        self.post(self.get_add_url(self.revision.revision_number),
                  { 'name': name, 'root_dir': root_dir })
        self.revision = next(self.revision)
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

        revision = next(self.revision)
        folder = revision.folders.all()[0]
        eq_(folder.name, 'tester')

    def test_remove_folder(self):
        self.add_one()
        res = self.post(self.get_delete_url(self.revision.revision_number),
                        { 'name': 'tester', 'root_dir': 'l' })
        eq_(res.status_code, 200)
        json.loads(res.content)

        revision = next(self.revision)
        eq_(revision.folders.count(), 0)

    def test_folder_sanitization(self):
        revision = self.add_one(name='A"> <script src="google.com">/m@l!c!ous')
        eq_(revision.folders.all()[0].name, 'A-script-src-googlecom-/m-l-c-ous')
        revision.folder_remove(revision.folders.all()[0])

        revision = self.add_one(name='/absolute///and/triple/')
        eq_(revision.folders.all()[0].name, 'absolute/and/triple')


class TestEditing(TestCase):
    fixtures = ('mozilla_user', 'core_sdk', 'users', 'packages')

    def setUp(self):
        self.hashtag = hashtag()

    def test_revision_list_contains_added_modules(self):
        author = User.objects.get(username='john')
        addon = Package(author=author, type='a')
        addon.save()
        mod = Module.objects.create(
                filename='test_filename',
                author=author,
                code='// test')
        rev = addon.latest
        rev.module_add(mod)
        r = self.client.get(
                reverse('jp_revisions_list_html', args=[addon.id_number]))
        assert 'test_filename' in r.content
