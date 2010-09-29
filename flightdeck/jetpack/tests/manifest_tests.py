from copy import deepcopy
from test_utils import TestCase
from jetpack.models import Package
from jetpack import settings

class ManifestsTest(TestCase):
    " tests strictly about manifest creation "

    fixtures = ['mozilla', 'core_lib', 'users', 'packages']


    manifest = {
        'fullName': 'Test Addon',
        'name': 'test-addon',
        'description': '',
        'author': 'john',
        'version': settings.INITIAL_VERSION_NAME,
        'dependencies': ['jetpack-core'],
        'license': '',
        'url': '',
        'main': 'main',
        'contributors': [],
        'lib': 'lib'
    }


    def setUp(self):
        self.addon = Package.objects.get(name='test-addon',author__username='john')
        self.library = Package.objects.get(name='test-library')


    def test_minimal_manifest(self):
        " test if self.manifest is created for the clean addon "
        first = self.addon.latest

        manifest = deepcopy(self.manifest)
        first_manifest = first.get_manifest()
        del first_manifest['id']
        self.assertEqual(manifest, first_manifest)


    def test_manifest_from_not_current_revision(self):
        " test if the version in the manifest changes after 'updating' PackageRevision "
        first = self.addon.latest
        first.save()

        manifest = deepcopy(self.manifest)
        manifest['version'] = "%s.rev1" % settings.INITIAL_VERSION_NAME

        first_manifest = first.get_manifest()
        del first_manifest['id']
        self.assertEqual(manifest, first_manifest)


    def test_manifest_with_dependency(self):
        " test if Manifest has the right dependency list "
        first = self.addon.latest
        lib = self.library.latest
        first.dependency_add(lib)

        manifest = deepcopy(self.manifest)
        manifest['dependencies'].append('%s-%d' % ('test-library', settings.MINIMUM_PACKAGE_ID + 2))
        manifest['version'] = "%s.rev1" % settings.INITIAL_VERSION_NAME

        first_manifest = first.get_manifest()
        del first_manifest['id']
        self.assertEqual(manifest, first_manifest)


    def test_contributors_list(self):
        " test if the contributors list is exported properly "
        first = self.addon.latest
        first.contributors = "one, 12345, two words,no space"
        first.save()

        manifest = deepcopy(self.manifest)
        manifest['version'] = "%s.rev1" % settings.INITIAL_VERSION_NAME
        manifest['contributors'] = ['one', '12345', 'two words', 'no space']

        first_manifest = first.get_manifest()
        del first_manifest['id']
        self.assertEqual(manifest, first_manifest)



"""
# Commenting out all tests

import shutil
import subprocess
from copy import deepcopy
from exceptions import TypeError

from django.test import TestCase
from django.utils import simplejson
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from test_utils import create_test_user
from jetpack.models import Package, PackageRevision, Module, Attachment
from jetpack import settings
from jetpack.errors import     SelfDependencyException, FilenameExistException, \
                            UpdateDeniedException, AddingModuleDenied, AddingAttachmentDenied
from jetpack.xpi_utils import sdk_copy, xpi_build, xpi_remove


class PackageRevisionTest(PackageTestCase):


class XPIBuildTest(PackageTest):

    def makeSDKDir(self):
        os.mkdir (SDKDIR)
        os.mkdir('%s/packages' % SDKDIR)

    def setUp(self):
        super (XPIBuildTest, self).setUp()
        self.addonrev = PackageRevision.objects.filter(package__name=self.addon.name)[0]
        self.librev = PackageRevision.objects.filter(package__name=self.library.name)[0]
        self.librev.module_create(
            filename=TEST_FILENAME,
            author=self.user)


    def test_package_dir_generation(self):
        " test if all package dirs are created properly "
        self.makeSDKDir()
        package_dir = self.library.make_dir('%s/packages' % SDKDIR)
        self.failUnless(os.path.isdir(package_dir))
        self.failUnless(os.path.isdir('%s/%s' % (package_dir, self.library.get_lib_dir())))


    def test_save_modules(self):
        " test if module is saved "
        self.makeSDKDir()
        package_dir = self.library.make_dir('%s/packages' % SDKDIR)
        self.librev.export_modules('%s/%s' % (package_dir, self.library.get_lib_dir()))

        self.failUnless(os.path.isfile('%s/packages/%s/%s/%s.js' % (
                            SDKDIR,
                            self.library.get_unique_package_name(),
                            self.library.get_lib_dir(),
                            TEST_FILENAME)))

    def test_manifest_file_creation(self):
        " test if manifest is created properly "
        self.makeSDKDir()
        package_dir = self.library.make_dir('%s/packages' % SDKDIR)
        self.librev.export_manifest(package_dir)
        self.failUnless(os.path.isfile('%s/package.json' % package_dir))
        handle = open('%s/package.json' % package_dir)
        manifest_json = handle.read()
        manifest = simplejson.loads(manifest_json)
        self.assertEqual(manifest, self.librev.get_manifest())


    def test_minimal_lib_export(self):
        " test if all the files are in place "
        self.makeSDKDir()
        self.librev.export_files_with_dependencies('%s/packages' % SDKDIR)
        package_dir = '%s/packages/%s' % (SDKDIR, self.library.get_unique_package_name())
        self.failUnless(os.path.isdir(package_dir))
        self.failUnless(os.path.isdir('%s/%s' % (package_dir, self.library.get_lib_dir())))
        self.failUnless(os.path.isfile('%s/package.json' % package_dir))
        self.failUnless(os.path.isfile('%s/%s/%s.js' % (
                            package_dir,
                            self.library.get_lib_dir(),
                            TEST_FILENAME)))


    def test_addon_export_with_dependency(self):
        " test if lib and main.js are properly exported "
        self.makeSDKDir()
        addon_dir = '%s/packages/%s' % (SDKDIR, self.addon.get_unique_package_name())
        lib_dir = '%s/packages/%s' % (SDKDIR, self.library.get_unique_package_name())

        self.addonrev.dependency_add(self.librev)
        self.addonrev.export_files_with_dependencies('%s/packages' % SDKDIR)
        self.failUnless(os.path.isdir('%s/%s' % (addon_dir, self.addon.get_lib_dir())))
        self.failUnless(os.path.isdir('%s/%s' % (lib_dir, self.library.get_lib_dir())))
        self.failUnless(os.path.isfile('%s/%s/%s.js' % (
                            addon_dir,
                            self.addon.get_lib_dir(),
                            self.addonrev.module_main)))


    def test_addon_export_with_attachment(self):
        " test if attachment file is coped "
        self.makeSDKDir()
        self.createFile()
        addon_dir = '%s/packages/%s' % (SDKDIR, self.addon.get_unique_package_name())
        self.addonrev.attachment_create(
            filename=TEST_FILENAME,
            ext=TEST_FILENAME_EXTENSION,
            path=TEST_UPLOAD_PATH,
            author=self.user
        )
        self.addonrev.export_files_with_dependencies('%s/packages' % SDKDIR)
        self.failUnless(os.path.isfile('%s/%s/%s.%s' % (
                            addon_dir,
                            self.addon.get_data_dir(),
                            TEST_FILENAME, TEST_FILENAME_EXTENSION)))


    def test_copying_sdk(self):
        sdk_copy(SDKDIR)
        self.failUnless(os.path.isdir(SDKDIR))


    def test_minimal_xpi_creation(self):
        " xpi build from an addon straight after creation "
        sdk_copy(SDKDIR)
        self.addonrev.export_files_with_dependencies('%s/packages' % SDKDIR)
        out = xpi_build(SDKDIR,
                    '%s/packages/%s' % (SDKDIR, self.addon.get_unique_package_name()))
        # assert no error output
        self.assertEqual('', out[1])
        # assert xpi was created
        self.failUnless(os.path.isfile('%s/packages/%s/%s.xpi' % (
            SDKDIR, self.addon.get_unique_package_name(), self.addon.name)))

    def test_addon_with_other_modules(self):
        " addon has now more modules "
        self.addonrev.module_create(
            filename=TEST_FILENAME,
            author=self.user
        )
        sdk_copy(SDKDIR)
        self.addonrev.export_files_with_dependencies('%s/packages' % SDKDIR)
        out = xpi_build(SDKDIR,
                    '%s/packages/%s' % (SDKDIR, self.addon.get_unique_package_name()))
        # assert no error output
        self.assertEqual('', out[1])
        self.failUnless(out[0])
        # assert xpi was created
        self.failUnless(os.path.isfile('%s/packages/%s/%s.xpi' % (
            SDKDIR, self.addon.get_unique_package_name(), self.addon.name)))


    def test_xpi_with_empty_dependency(self):
        " empty lib is created "
        lib = Package.objects.create(
            full_name=TEST_LIBRARY_FULLNAME,
            author=self.user,
            type='l'
        )
        librev = PackageRevision.objects.filter(package__id_number=lib.id_number)[0]
        self.addonrev.dependency_add(librev)
        sdk_copy(SDKDIR)
        self.addonrev.export_files_with_dependencies('%s/packages' % SDKDIR)
        out = xpi_build(SDKDIR,
                    '%s/packages/%s' % (SDKDIR, self.addon.get_unique_package_name()))
        # assert no error output
        self.assertEqual('', out[1])
        # assert xpi was created
        self.failUnless(os.path.isfile('%s/packages/%s/%s.xpi' % (
            SDKDIR, self.addon.get_unique_package_name(), self.addon.name)))


    def test_xpi_with_dependency(self):
        " addon has one dependency with a file "
        self.addonrev.dependency_add(self.librev)
        sdk_copy(SDKDIR)
        self.addonrev.export_files_with_dependencies('%s/packages' % SDKDIR)
        out = xpi_build(SDKDIR,
                    '%s/packages/%s' % (SDKDIR, self.addon.get_unique_package_name()))
        # assert no error output
        self.assertEqual('', out[1])
        # assert xpi was created
        self.failUnless(os.path.isfile('%s/packages/%s/%s.xpi' % (
            SDKDIR, self.addon.get_unique_package_name(), self.addon.name)))


class ManyUsersTests(TestCase):

    fixtures = ['test_users.json', 'test_basic_usecase.json']

    def test_fixtures_loaded(self):
        self.failUnless(User.objects.get(username='1234567'))
        self.failUnless(Package.objects.all()[0])

"""

