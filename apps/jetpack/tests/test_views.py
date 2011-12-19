import os
import commonware
import json

from nose.tools import eq_
#from nose import SkipTest
from mock import patch   #, Mock

from test_utils import TestCase
from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.db.models.signals import post_save

from jetpack.models import Package, PackageRevision, Module, save_first_revision
from base.helpers import hashtag

log = commonware.log.getLogger('f.test')


def next_revision(revision):
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
        isfile.return_value = False
        r = self.client.get(self.check_download_url)
        eq_(r.status_code, 200)
        eq_(r.content, '{"ready": false}')
        isfile.return_value = True
        r = self.client.get(self.check_download_url)
        eq_(r.status_code, 200)
        eq_(r.content, '{"ready": true}')

    def test_package_browser_no_user(self):
        """If user does not exist raise 404
        """
        r = self.client.get(
                reverse('jp_browser_user_addons', args=['not_a-user']))
        eq_(r.status_code, 404)

    def test_author_can_edit_package(self):
        user = User.objects.get(username='jan')
        user.set_password('secure')
        user.save()
        addon = Package.objects.create(author=user, type='a')
        # not logged in
        response = self.client.get(addon.get_absolute_url())
        assert 'save_url' not in response.content
        # after log in
        self.client.login(username=user.username, password='secure')
        response = self.client.get(addon.get_absolute_url())
        assert 'save_url' in response.content
        # after setting the addon to private
        response = self.client.get(reverse('jp_package_disable',
            args=[addon.id_number]))
        self.client.login(username=user.username, password='secure')
        response = self.client.get(addon.get_absolute_url())
        assert 'save_url' in response.content

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
        response = self.client.get(reverse('jp_package_delete',
            args=[lib.id_number]))
        eq_(response.status_code, 200)
        response = self.client.get(lib.get_absolute_url())
        # lib deleted - shouldn't be visible by author
        eq_(response.status_code, 404)
        # logging in the addon owner
        self.client.login(username=user.username, password='secure')
        # addon used lib - its author should be able to see it
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
        response = self.client.get(reverse('jp_package_disable',
            args=[lib.id_number]))
        eq_(response.status_code, 200)
        response = self.client.get(lib.get_absolute_url())
        # lib private - should be visible by author
        eq_(response.status_code, 200)
        # logging in the other user
        self.client.login(username=user.username, password='secure')
        # lib private - shouldn't be visible by others
        response = self.client.get(lib.get_absolute_url())
        eq_(response.status_code, 404)

    def test_display_disabled_library_in_addon(self):
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
        response = self.client.get(reverse('jp_package_disable',
            args=[lib.id_number]))
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
        return self.client.post(url, data)

    def add_one(self, name='tester', root_dir='l'):
        self.post(self.get_add_url(self.revision.revision_number),
                  {'name': name, 'root_dir': root_dir})
        self.revision = next_revision(self.revision)
        return self.revision

    def get_add_url(self, revision):
        args = [self.package.id_number, revision]
        return reverse('jp_addon_revision_add_folder', args=args)

    def get_delete_url(self, revision):
        args = [self.package.id_number, revision]
        return reverse('jp_addon_revision_remove_folder', args=args)

    def test_add_folder(self):
        res = self.post(self.get_add_url(self.revision.revision_number),
                        {'name': 'tester', 'root_dir': 'l'})
        eq_(res.status_code, 200)
        json.loads(res.content)

        revision = next_revision(self.revision)
        folder = revision.folders.all()[0]
        eq_(folder.name, 'tester')

    def test_remove_folder(self):
        self.add_one()
        res = self.post(self.get_delete_url(self.revision.revision_number),
                        {'name': 'tester', 'root_dir': 'l'})
        eq_(res.status_code, 200)
        json.loads(res.content)

        revision = next_revision(self.revision)
        eq_(revision.folders.count(), 0)

    def test_folder_sanitization(self):
        revision = self.add_one(name='A"> <script src="google.com">/m@l!c!ous')
        eq_(revision.folders.all()[0].name,
                'A-script-src-googlecom-/m-l-c-ous')
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

    def test_package_name_change(self):
        author = User.objects.get(username='jan')
        author.set_password('secure')
        author.save()
        addon1 = Package(author=author, type='a')
        addon1.save()
        rev1 = addon1.latest
        self.client.login(username=author.username, password='secure')
        response = self.client.post(addon1.latest.get_save_url(), {
            'full_name': 'FULL NAME'})
        eq_(response.status_code, 200)
        addon2 = Package.objects.get(pk=addon1.pk)
        eq_(len(addon2.revisions.all()), 2)
        eq_(addon2.full_name, addon2.latest.full_name)
        assert rev1.name != addon2.latest.name


class TestRevision(TestCase):
    fixtures = ('mozilla_user', 'core_sdk', 'users', 'packages')

    def test_copy_revision(self):
        author = User.objects.get(username='john')
        addon = Package(author=author, type='a')
        addon.save()
        # unauthenticated
        response = self.client.get(addon.latest.get_copy_url())
        eq_(response.status_code, 302)
        # authenticated
        author.set_password('secure')
        author.save()
        self.client.login(username=author.username, password='secure')
        response = self.client.get(addon.latest.get_copy_url())
        eq_(response.status_code, 200)
        assert 'Add-on' in response.content
        assert 'copied' in response.content

    def test_dashboard_with_broken_package(self):
        # fixable add-on - no latest given
        author = User.objects.get(username='john')
        addon = Package(
                full_name='FIXABLE',
                author=author, type='a')
        addon.save()
        latest = addon.latest
        # removing addon.latest
        addon.latest = None
        addon.save()
        assert not addon.latest
        response = self.client.get(author.get_profile().get_profile_url())
        eq_(response.status_code, 200)
        addon = Package.objects.get(full_name='FIXABLE')
        # displaying the broken addon should fix it
        assert addon.latest
        eq_(addon.latest, latest)

        # package with no version at all
        post_save.disconnect(save_first_revision, sender=Package)
        addon = Package(
                full_name='BROKEN',
                name='broken',
                author=author, type='a')
        addon.save()
        post_save.connect(save_first_revision, sender=Package)
        assert not addon.latest
        response = self.client.get(author.get_profile().get_profile_url())
        eq_(response.status_code, 200)
        self.assertRaises(Package.DoesNotExist,
                Package.objects.get, full_name='BROKEN')
