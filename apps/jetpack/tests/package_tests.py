import os
import datetime
import commonware
from mock import Mock
from decimal import Decimal

from test_utils import TestCase
from nose.tools import eq_

from django.contrib.auth.models import User
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from jetpack.models import Package, PackageRevision
from jetpack.errors import DependencyException
from jetpack.package_helpers import create_from_archive, \
        create_package_from_xpi

log = commonware.log.getLogger('f.test')


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
        assert package.id_number
        eq_(int(package.id_number),
                settings.MINIMUM_PACKAGE_ID + 1)
        # all add-ons have PackageRevision created
        assert package.version
        assert package.latest
        eq_(package.version.id, package.latest.id)
        # name is created automtically if no given
        assert package.full_name
        assert package.name
        eq_(package.full_name, self.author.username)
        # test preventing inserting duplicates
        assert Package.objects.get(
                author=self.author,
                type='a',
                full_name=package.name)
        p = Package.objects.create(author=self.author, type='a', full_name=package.name)
        
        #test package name iteration
        eq_('john-1', p.name)
        eq_('john', package.name)
        
    
    def test_addon_creation_with_nickname(self):
        """In production if you log in with an AMO user, the username
        is set to a number and the nickname on the profile is set to the
        real username."""
        profile = self.author.get_profile()
        profile.nickname = 'Gordon'
        profile.save()
    
        package = Package(
            author=self.author,
            type='a'
        )
        package.save()
    
        eq_(package.full_name, 'Gordon')
    
    def test_library_creation_with_nickname(self):
        profile = self.author.get_profile()
        profile.nickname = 'Samuel'
        profile.save()
    
        package = Package(
            author=self.author,
            type='l'
        )
        package.save()
    
        eq_(package.full_name, 'Samuel-lib')
    
    def test_package_sanitization(self):
        bad_text = 'Te$t"><script src="google.com"></script>!#'
        good_text = 'Te$tscript srcgoogle.com/script!#'
    
        package = Package(
            author=self.author,
            type='a',
            full_name=bad_text,
            description=bad_text,
            version_name=bad_text
        )
        package.save()
    
        eq_(package.full_name, good_text)
        eq_(package.description, good_text)
        eq_(package.version_name, good_text)
    
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
        self.assertEqual(Package.objects.libraries().count(), 3)
    
    def test_manager_sort_recently_active(self):
        p1 = Package(author=self.author, type='a')
        p1.save()
        p2 = Package(author=self.author, type='a')
        p2.save()
        Package(author=self.author, type='l').save()
    
    
        p1rev2 = PackageRevision(author=self.author, revision_number=2)
        p1.revisions.add(p1rev2)
        p1rev2.created_at = datetime.datetime.now() - datetime.timedelta(60)
        super(PackageRevision, p1rev2).save()
    
        p2rev = p2.revisions.all()[0]
        p2rev.save() #makes a new revision
    
        qs = Package.objects.sort_recently_active().filter(type='a')
        eq_(qs.count(), 2)
        eq_(p2.id, qs[0].id)
        eq_(qs[0].rev_count, 2)
        eq_(qs[1].rev_count, 1)
    
    def test_related_name(self):
        Package(author=self.author, type='a').save()
        self.assertEqual(self.author.packages_originated.count(), 1)
    
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
    
    def test_disable(self):
        addon = Package.objects.create(author=self.author, type='a')
        # disabling addon
        addon.disable()
        eq_(Package.objects.active().filter(type='a').count(), 0)
        eq_(Package.objects.active(viewer=self.author).filter(type='a').count(), 1)
        return addon
    
    def test_enable(self):
        addon = self.test_disable()
    
        addon.enable()
        eq_(Package.objects.active().filter(type='a').count(), 1)
    
    def test_delete(self):
        addon = Package.objects.create(author=self.author, type='a')
        # deleting addon
        addon.delete()
        eq_(Package.objects.active().filter(type='a').count(), 0)
        eq_(Package.objects.active(viewer=self.author).filter(type='a').count(), 0)
        eq_(PackageRevision.objects.filter(package=addon).count(), 0)
    
    def test_delete_with_a_copy(self):
        addon = Package.objects.create(author=self.author, type='a')
        addon_copy = addon.copy(self.author)
        # check copy
        eq_(Package.objects.addons().active().exclude(pk=addon.pk).count(), 1)
        # deleting addon
        addon.delete()
        eq_(Package.objects.active().filter(type='a').count(), 1)
        eq_(Package.objects.active(viewer=self.author).addons().count(), 1)
        eq_(PackageRevision.objects.filter(package=addon).count(), 0)
        eq_(PackageRevision.objects.filter(package=addon_copy).count(), 1)
    
    def test_delete_with_dependency(self):
        addon = Package.objects.create(author=self.author, type='a')
        lib = Package.objects.create(author=self.author, type='l')
        addon.latest.dependency_add(lib.latest)
        # deleting lib
        lib.delete()
        eq_(Package.objects.addons().active().count(), 1)
        eq_(Package.objects.libraries().active().filter(author=self.author).count(), 0)
    
    def test_get_outdated_dependencies(self):
        addon = Package.objects.create(author=self.author, type='a')
        lib = Package.objects.create(author=self.author, type='l')
        addon.latest.dependency_add(lib.latest)
    
        lib.latest.module_create(author=self.author, filename='test', code='foo')
    
        out_of_date = addon.latest.get_outdated_dependency_versions()
        eq_(len(out_of_date), 1)
    
    def test_outdated_dependencies_with_conflicts(self):
        addon = Package.objects.create(author=self.author, type='a')
        lib = Package.objects.create(author=self.author, type='l')
        addon.latest.dependency_add(lib.latest)
    
        jan = User.objects.get(username='jan')
        jan_lib = Package(author=jan, type='l', full_name='janjanjan')
        jan_lib.save()
        dupe_lib = Package(author=jan, type='l', full_name=lib.full_name)
        dupe_lib.save()
    
        addon.latest.dependency_add(jan_lib.latest)
    
        jan_lib.latest.dependency_add(dupe_lib.latest)
        out_of_date = addon.latest.get_outdated_dependency_versions()
    
        eq_(len(out_of_date), 0)
    
    def test_update_dependency_version(self):
        addon = Package.objects.create(author=self.author, type='a')
        lib = Package.objects.create(author=self.author, type='l')
        addon.latest.dependency_add(lib.latest)
    
        lib.latest.module_create(author=self.author, filename='test', code='foo')
    
        previous_addon = addon.latest.pk
        addon.latest.dependency_update(lib.latest)
    
        self.assertNotEqual(addon.latest.pk, previous_addon)
        eq_(addon.latest.dependencies.get(package=lib), lib.latest)
    
    def test_update_invalid_dependency(self):
        addon = Package.objects.create(author=self.author, type='a')
        lib = Package.objects.create(author=self.author, type='l')
    
        self.assertRaises(DependencyException,
                          addon.latest.dependency_update,
                          lib.latest)
    
    def test_package_copy(self):
        addon = Package.objects.create(author=self.author, type='a')
        addon_copy = addon.copy(author=self.author)
        assert "(copy 1)" in addon_copy.full_name
    
        addon_copy = addon.copy(author=self.author)
        assert "(copy 1)" not in addon_copy.full_name
        assert "(copy 2)" in addon_copy.full_name
    
        addon_copy = addon.copy(author=self.author)
        assert "(copy 1)" not in addon_copy.full_name
        assert "(copy 2)" not in addon_copy.full_name
        assert "(copy 3)" in addon_copy.full_name
    
    def test_create_anew_id_number_if_current_exists(self):
        full_clean = Package.full_clean
        Package.full_clean = Mock()
        addon = Package.objects.create(author=self.author, type='a')
        addon2 = addon.copy(self.author)
        addon2.id_number = addon.id_number
        addon2.save()
        Package.full_clean = full_clean
    
    def test_description_characters(self):
        addon = Package.objects.create(author=self.author, type='a')
        description = "abcdefghijklmnoprstuwxyz!@#$%^&*(){}[]:',./?"
        addon.description = description
        addon.save()
        addon_saved = Package.objects.get(author=self.author, type='a')
        eq_(addon_saved.description, description)
    
    def test_activity_rating_calculation_one_year(self):
        addon = Package.objects.create(author=self.author, type='a')
    
        eq_(0, addon.calc_activity_rating())
    
        now = datetime.datetime.now()
    
        for i in range(1, 366):
            r = addon.revisions.create(author=self.author, revision_number=i)
            r.created_at = now-datetime.timedelta(i)
            super(PackageRevision, r).save()
    
    
        #created packages, including initial
        eq_(366, addon.revisions.count())
        eq_(Decimal('1'), addon.calc_activity_rating())
    
    def test_activity_rating_calculation_first_week(self):
        addon = Package.objects.create(type='a', author=self.author)
    
        eq_(0, addon.calc_activity_rating())
    
        now = datetime.datetime.now()
    
        # Create 1 weeks worth of revisions... should equal .30 of score
        # see models.py def Packages for weights
    
        for i in range(1, 8):
            r = addon.revisions.create(author=self.author, revision_number=i)
            r.created_at = now-datetime.timedelta(i)
            super(PackageRevision, r).save()
    
        eq_(8, addon.revisions.count())
    
        eq_(Decimal('0.300'), addon.calc_activity_rating())
    
    def test_duplicate_packages_integrity_error(self):
        # duplicate packages are denied on MySQL level
        author = User.objects.get(username='john')
        addon = Package(
                full_name='Integrity Error',
                author=author, type='a')
        addon.save()
        backup = Package.full_clean
        Package.full_clean = Mock()
        addon2 = Package(
                full_name='Integrity Error',
                author=author, type='a')
        self.assertRaises(IntegrityError, addon2.save)
        Package.full_clean = backup
        
        
    def test_duplicate_packages_name_interation(self):
        # duplicate packages are denied on MySQL level
        author = User.objects.get(username='john')
        addon = Package(
                full_name='Integrity Error',
                author=author, type='a')
        addon.save()        
        eq_(addon.latest.name, 'integrity-error')
        
        addon2 = Package(
                full_name='Integrity Error',
                author=author, type='a')
        
        addon2.save()        
        eq_(addon2.latest.name, 'john')
        
        addon3 = Package(
                full_name='Integrity Error',
                author=author, type='a')
        
        addon3.save()        
        eq_(addon3.latest.name, 'john-1')
        
        
