import os
import commonware

from test_utils import TestCase
from nose import SkipTest
from nose.tools import eq_

from django.contrib.auth.models import User
from django.conf import settings

from jetpack.models import Package
from jetpack.package_helpers import create_from_archive, \
        create_package_from_xpi

log = commonware.log.getLogger('f.jetpack')


class PackageTest(TestCase):
    fixtures = ['mozilla_user', 'users', 'core_sdk']

    def setUp(self):
        self.author = User.objects.get(username='john')

    def test_addon_creation(self):
        package = Package(
            author=self.author,
            type='a'
        )
        package.save()
        # all packages have assigned an incremental id_number
        self.failUnless(package.id_number)
        self.assertEqual(int(package.id_number),
                settings.MINIMUM_PACKAGE_ID + 1)
        # all add-ons have PackageRevision created
        self.failUnless(package.version and package.latest)
        self.assertEqual(package.version.id, package.latest.id)
        # name is created automtically if no given
        self.failUnless(package.full_name)
        self.failUnless(package.name)
        self.assertEqual(package.full_name, self.author.username)

    def test_automatic_numbering(self):
        Package(
            author=self.author,
            type='a'
        ).save()
        # Second Library with the same name should get a " (1)" as suffix
        package = Package(
            author=self.author,
            type='a'
        )
        package.save()
        self.assertEqual(package.full_name, '%s (1)' % self.author.username)

    def test_ordering(self):
        " Newest is first "
        addon1 = Package(author=self.author, type='a')
        addon1.save()
        addon2 = Package(author=self.author, type='a')
        addon2.save()
        # My Addon should be second
        # but because in the test these are so close and we're testing in
        # mutithreaded MySQL it could be different. It would be fair to assume
        # one of these will be (1) and the other not
        names = (addon1.full_name, addon2.full_name)
        self.failUnless('%s (1)' % self.author.username in names)
        self.failUnless('%s' % self.author.username in names)

    def test_manager_filtering(self):
        Package(author=self.author, type='a').save()
        Package(author=self.author, type='a').save()
        Package(author=self.author, type='l').save()

        self.assertEqual(Package.objects.addons().count(), 2)
        self.assertEqual(Package.objects.libraries().count(), 2)

    def test_related_name(self):
        Package(author=self.author, type='a').save()
        self.assertEqual(self.author.packages_originated.count(), 1)

    def test_disable_activate(self):
        raise SkipTest()

    def test_create_adddon_from_archive(self):
        path_addon = os.path.join(
                settings.ROOT, 'apps/jetpack/tests/sample_addon.zip')
        addon = create_from_archive(path_addon, self.author, 'a')
        self.failUnless(addon)
        for att in addon.latest.attachments.all():
            self.failUnless(os.path.isfile(
                os.path.join(settings.UPLOAD_DIR, att.path)))
        self.failUnless(
                'main' in [m.filename for m in addon.latest.modules.all()])
        self.failUnless(('attachment', 'txt') in [(a.filename, a.ext)
            for a in addon.latest.attachments.all()])

    def test_create_library_from_archive(self):
        path_library = os.path.join(
                settings.ROOT, 'apps/jetpack/tests/sample_library.zip')
        library = create_from_archive(path_library, self.author, 'l')
        self.failUnless(library)
        for att in library.latest.attachments.all():
            self.failUnless(os.path.isfile(
                os.path.join(settings.UPLOAD_DIR, att.path)))
        self.failUnless('lib' in [m.filename
            for m in library.latest.modules.all()])
        self.failUnless(('attachment', 'txt') in [(a.filename, a.ext)
            for a in library.latest.attachments.all()])

    def test_create_addon_from_xpi(self):
        path_xpi = os.path.join(
                settings.ROOT, 'apps/jetpack/tests/sample_addon.xpi')
        addon = create_package_from_xpi(path_xpi, self.author)
        self.failUnless(addon)
        for att in addon.latest.attachments.all():
            self.failUnless(os.path.isfile(
                os.path.join(settings.UPLOAD_DIR, att.path)))
        self.failUnless(
                'main' in [m.filename for m in addon.latest.modules.all()])
        self.failUnless(('attachment', 'txt') in [(a.filename, a.ext)
            for a in addon.latest.attachments.all()])

    def test_update_addon_from_xpi(self):
        path_xpi = os.path.join(
                settings.ROOT, 'apps/jetpack/tests/sample_addon.xpi')
        addon = create_package_from_xpi(path_xpi, self.author)
        addon = create_package_from_xpi(path_xpi, self.author)
        self.failUnless(addon)
        eq_(addon.revisions.count(), 2)

    def test_create_addon_from_xpi_with_libs(self):
        libs = ['sample_library']
        path_xpi = os.path.join(
                settings.ROOT, 'apps/jetpack/tests/sample_addon_with_libs.xpi')
        addon = create_package_from_xpi(path_xpi, self.author, libs=libs)

        eq_(len(addon.latest.dependencies.all()), 1)
        lib = addon.latest.dependencies.all()[0]
        self.failUnless(lib.package.name in libs)
        eq_(len(lib.attachments.all()), 1)
        att = lib.attachments.all()[0]
        eq_(('attachment', 'txt'), (att.filename, att.ext))
        self.failUnless(os.path.isfile(
            os.path.join(settings.UPLOAD_DIR, att.path)))
