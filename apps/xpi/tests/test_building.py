# coding=utf-8
import commonware
import os
import shutil
import simplejson
import tempfile
import time

from mock import Mock
#from nose.tools import eq_
from utils.test import TestCase

from django.contrib.auth.models import User
from django.conf import settings

from jetpack.models import Module, Package, PackageRevision, SDK
from xpi import xpi_utils
from base.templatetags.base_helpers import hashtag

log = commonware.log.getLogger('f.tests')


class XPIBuildTest(TestCase):

    fixtures = ['mozilla', 'core_sdk', 'users', 'packages']

    def setUp(self):
        self.hashtag = hashtag()
        self.author = User.objects.get(username='john')
        self.addon = Package.objects.get(name='test-addon',
                                         author__username='john')
        self.library = Package.objects.get(name='test-library')
        self.addonrev = self.addon.latest
        self.librev = self.library.latest
        mod = Module.objects.create(
            filename='test_module',
            code='// test module',
            author=self.author
        )
        self.librev.module_add(mod)
        self.SDKDIR = tempfile.mkdtemp()
        self.attachment_file_name = os.path.join(
                settings.UPLOAD_DIR, 'test_filename.txt')
        handle = open(self.attachment_file_name, 'w')
        handle.write('.')
        handle.close()
        # link core to the latest SDK
        self.createCore()
        settings.XPI_AMO_PREFIX = "file://%s" % os.path.join(
                settings.ROOT, 'apps/xpi/tests/sample_addons/')
        self.target_basename = os.path.join(
                settings.XPI_TARGETDIR, self.hashtag)
        self.backup_get_source_dir = SDK.get_source_dir
        SDK.get_source_dir = Mock(return_value=os.path.join(
            settings.ROOT, 'lib', settings.TEST_SDK))

    def tearDown(self):
        self.deleteCore()
        if os.path.exists(self.SDKDIR):
            shutil.rmtree(self.SDKDIR)
        if os.path.exists(self.attachment_file_name):
            os.remove(self.attachment_file_name)
        if os.path.exists('%s.xpi' % self.target_basename):
            os.remove('%s.xpi' % self.target_basename)
        if os.path.exists('%s.json' % self.target_basename):
            os.remove('%s.json' % self.target_basename)
        SDK.get_source_dir = self.backup_get_source_dir

    def makeSDKDir(self):
        os.mkdir('%s/packages' % self.SDKDIR)

    def test_package_dir_generation(self):
        " test if all package dirs are created properly "
        self.makeSDKDir()
        package_dir = self.library.latest.make_dir('%s/packages' % self.SDKDIR)
        self.failUnless(os.path.isdir(package_dir))
        self.failUnless(os.path.isdir(
            '%s/%s' % (package_dir, self.library.latest.get_lib_dir())))

    def test_save_modules(self):
        " test if module is saved "
        self.makeSDKDir()
        package_dir = self.library.latest.make_dir('%s/packages' % self.SDKDIR)
        self.librev.export_modules(
            '%s/%s' % (package_dir, self.library.latest.get_lib_dir()))

        self.failUnless(os.path.isfile('%s/%s/%s.js' % (
                            package_dir,
                            self.library.latest.get_lib_dir(),
                            'test_module')))

    def test_manifest_file_creation(self):
        " test if manifest is created properly "
        self.makeSDKDir()
        package_dir = self.library.latest.make_dir('%s/packages' % self.SDKDIR)
        self.librev.export_manifest(package_dir)
        self.failUnless(os.path.isfile('%s/package.json' % package_dir))
        handle = open('%s/package.json' % package_dir)
        manifest_json = handle.read()
        manifest = simplejson.loads(manifest_json)
        self.assertEqual(manifest, self.librev.get_manifest())

    def test_minimal_lib_export(self):
        " test if all the files are in place "
        self.makeSDKDir()
        self.librev.export_files_with_dependencies('%s/packages' % self.SDKDIR)
        package_dir = self.librev.get_dir_name('%s/packages' % self.SDKDIR)
        self.failUnless(os.path.isdir(package_dir))
        self.failUnless(os.path.isdir(
            '%s/%s' % (package_dir, self.library.latest.get_lib_dir())))
        self.failUnless(os.path.isfile('%s/package.json' % package_dir))
        self.failUnless(os.path.isfile('%s/%s/%s.js' % (
                            package_dir,
                            self.library.latest.get_lib_dir(),
                            'test_module')))

    def test_addon_export_with_dependency(self):
        " test if lib and main.js are properly exported "
        self.makeSDKDir()
        addon_dir = self.addon.latest.get_dir_name('%s/packages' % self.SDKDIR)
        lib_dir = self.library.latest.get_dir_name('%s/packages' % self.SDKDIR)

        self.addonrev.dependency_add(self.librev)
        self.addonrev.export_files_with_dependencies(
            '%s/packages' % self.SDKDIR)
        self.failUnless(os.path.isdir(
            '%s/%s' % (addon_dir, self.addon.latest.get_lib_dir())))
        self.failUnless(os.path.isdir(
            '%s/%s' % (lib_dir, self.library.latest.get_lib_dir())))
        self.failUnless(os.path.isfile(
            '%s/%s/%s.js' % (
                addon_dir,
                self.addon.latest.get_lib_dir(),
                self.addonrev.module_main)))

    def test_addon_export_with_attachment(self):
        """Test if attachment file is copied."""
        self.makeSDKDir()
        # create attachment in upload dir
        handle = open(self.attachment_file_name, 'w')
        handle.write('unit test file')
        handle.close()
        attachment = self.addonrev.attachment_create(
            filename='test_filename.txt',
            author=self.author
        )
        attachment.create_path()
        attachment.data = ''
        attachment.write()
        self.addonrev.export_files_with_dependencies(
            '%s/packages' % self.SDKDIR)
        self.failUnless(os.path.isfile(self.attachment_file_name))

    def test_copying_sdk(self):
        xpi_utils.sdk_copy(self.addonrev.sdk.get_source_dir(), self.SDKDIR)
        self.failUnless(os.path.isdir(self.SDKDIR))

    def test_minimal_xpi_creation(self):
        " xpi build from an addon straight after creation "
        tstart = time.time()
        xpi_utils.sdk_copy(self.addonrev.sdk.get_source_dir(), self.SDKDIR)
        self.addonrev.export_keys(self.SDKDIR)
        self.addonrev.export_files_with_dependencies(
            '%s/packages' % self.SDKDIR)
        err = xpi_utils.build(
                self.SDKDIR,
                self.addon.latest.get_dir_name('%s/packages' % self.SDKDIR),
                self.addon.name, self.hashtag, tstart=tstart)
        # assert no error output
        assert not err[1]
        # assert xpi was created
        assert os.path.isfile('%s.xpi' % self.target_basename)
        assert os.path.isfile('%s.json' % self.target_basename)

    def test_addon_with_other_modules(self):
        " addon has now more modules "
        self.addonrev.module_create(
            filename='test_filename',
            author=self.author
        )
        tstart = time.time()
        xpi_utils.sdk_copy(self.addonrev.sdk.get_source_dir(), self.SDKDIR)
        self.addonrev.export_keys(self.SDKDIR)
        self.addonrev.export_files_with_dependencies(
            '%s/packages' % self.SDKDIR)
        err = xpi_utils.build(
                self.SDKDIR,
                self.addon.latest.get_dir_name('%s/packages' % self.SDKDIR),
                self.addon.name, self.hashtag, tstart=tstart)
        # assert no error output
        assert not err[1]
        # assert xpi was created
        assert os.path.isfile('%s.xpi' % self.target_basename)
        assert os.path.isfile('%s.json' % self.target_basename)

    def test_xpi_with_empty_dependency(self):
        " empty lib is created "
        lib = Package.objects.create(
            full_name='Test Library XPI',
            author=self.author,
            type='l'
        )
        librev = PackageRevision.objects.filter(
            package__id_number=lib.id_number)[0]
        self.addonrev.dependency_add(librev)
        tstart = time.time()
        xpi_utils.sdk_copy(self.addonrev.sdk.get_source_dir(), self.SDKDIR)
        self.addonrev.export_keys(self.SDKDIR)
        self.addonrev.export_files_with_dependencies(
            '%s/packages' % self.SDKDIR)
        err = xpi_utils.build(
                self.SDKDIR,
                self.addon.latest.get_dir_name('%s/packages' % self.SDKDIR),
                self.addon.name, self.hashtag, tstart=tstart)
        # assert no error output
        assert not err[1]
        # assert xpi was created
        assert os.path.isfile('%s.xpi' % self.target_basename)
        assert os.path.isfile('%s.json' % self.target_basename)

    def test_xpi_with_dependency(self):
        " addon has one dependency with a file "
        self.addonrev.dependency_add(self.librev)
        tstart = time.time()
        xpi_utils.sdk_copy(self.addonrev.sdk.get_source_dir(), self.SDKDIR)
        self.addonrev.export_keys(self.SDKDIR)
        self.addonrev.export_files_with_dependencies(
            '%s/packages' % self.SDKDIR)
        err = xpi_utils.build(
                self.SDKDIR,
                self.addon.latest.get_dir_name('%s/packages' % self.SDKDIR),
                self.addon.name, self.hashtag, tstart=tstart)
        # assert no error output
        assert not err[1]
        # assert xpi was created
        assert os.path.isfile('%s.xpi' % self.target_basename)
        assert os.path.isfile('%s.json' % self.target_basename)

    def test_broken_dependency(self):
        # A > B
        # B > C
        # C > D
        # A requires via shortcut modules from api-libs, A, B and C
        addon = Package.objects.create(
                author=self.author,
                full_name='A',
                name='a',
                type='a')
        mod = addon.latest.modules.get()
        mod.code += """
require('file');
require('addonAmodule');
require('libBmodule');
// this fails
require('libCmodule');
"""
        addon.latest.update(mod)
        addon.latest.module_create(
                author=addon.author,
                filename='addonAmodule',
                code="// empty module")
        # creating Library B
        libB = Package.objects.create(
                author=self.author,
                full_name='B',
                name='b',
                type='l')
        mod = libB.latest.modules.get()
        mod.code = """
require('file');
require('libBmodule');
require('libCmodule');
"""
        libB.latest.update(mod)
        libB.latest.module_create(
                author=addon.author,
                filename='libBmodule',
                code="// empty module")
        # creating Library C
        libC = Package.objects.create(
                author=self.author,
                full_name='C',
                name='c',
                type='l')
        mod = libC.latest.modules.get()
        mod.code = """
require('file');
require('libCmodule');
"""
        libC.latest.update(mod)
        libC.latest.module_create(
                author=addon.author,
                filename='libCmodule',
                code="// empty module")
        # adding dependencies
        libB.latest.dependency_add(libC.latest)
        addon.latest.dependency_add(libB.latest)
        celery_eager = settings.CELERY_ALWAYS_EAGER
        settings.CELERY_ALWAYS_EAGER = False
        response = addon.latest.build_xpi(hashtag=self.hashtag)
        settings.CELERY_ALWAYS_EAGER = celery_eager
        assert response[1]

    def test_addon_with_deep_dependency(self):
        # A > B, C
        # B > C
        # C > D
        # A requires via shortcut modules from api-libs, A, B and C
        # B requires via shortcut modules from api-libs, B and C
        # C requires via shortcut modules from api-libs, C and D
        addon = Package.objects.create(
                author=self.author,
                full_name='A',
                name='a',
                type='a')
        mod = addon.latest.modules.get()
        mod.code += """
require('file');
require('addonAmodule');
require('libBmodule');
require('libCmodule');
require('d/libDmodule');
"""
        addon.latest.update(mod)
        addon.latest.module_create(
                author=addon.author,
                filename='addonAmodule',
                code="// empty module")
        # creating Library B
        libB = Package.objects.create(
                author=self.author,
                full_name='B',
                name='b',
                type='l')
        mod = libB.latest.modules.get()
        mod.code = """
require('file');
require('libBmodule');
require('libCmodule');
require('d/libDmodule');
"""
        libB.latest.update(mod)
        libB.latest.module_create(
                author=addon.author,
                filename='libBmodule',
                code="// empty module")
        # creating Library C
        libC = Package.objects.create(
                author=self.author,
                full_name='C',
                name='c',
                type='l')
        mod = libC.latest.modules.get()
        mod.code = """
require('file');
require('libCmodule');
require('libDmodule');
"""
        libC.latest.update(mod)
        libC.latest.module_create(
                author=addon.author,
                filename='libCmodule',
                code="// empty module")
        # creating Library D
        libD = Package.objects.create(
                author=self.author,
                full_name='D',
                name='d',
                type='l')
        mod = libD.latest.modules.get()
        mod.code = """
require('file');
require('libDmodule');
"""
        libD.latest.update(mod)
        libD.latest.module_create(
                author=addon.author,
                filename='libDmodule',
                code="// empty module")
        # now assigning dependencies
        libC.latest.dependency_add(libD.latest)
        libB.latest.dependency_add(libC.latest)
        addon.latest.dependency_add(libC.latest)
        addon.latest.dependency_add(libB.latest)
        celery_eager = settings.CELERY_ALWAYS_EAGER
        settings.CELERY_ALWAYS_EAGER = False
        response = addon.latest.build_xpi(hashtag=self.hashtag)
        settings.CELERY_ALWAYS_EAGER = celery_eager
        assert not response[1]

    def test_module_with_utf(self):

        mod = Module.objects.create(
            filename='test_utf',
            code='// ą',
            author=self.author
        )
        self.library.latest.module_add(mod)
        self.makeSDKDir()
        package_dir = self.library.latest.make_dir('%s/packages' % self.SDKDIR)
        self.librev.export_modules(
            '%s/%s' % (package_dir, self.library.latest.get_lib_dir()))

        self.failUnless(os.path.isfile('%s/%s/%s.js' % (
                            package_dir,
                            self.library.latest.get_lib_dir(),
                            'test_module')))

    def test_package_included_multiple_times(self):
        """ If separate dependencies require the same library, it shouldn't error """
        pack = Package.objects.create(type='l', author=self.author)
        packrev = pack.latest
        self.librev.dependency_add(packrev)
        self.addonrev.dependency_add(packrev)
        self.addonrev.dependency_add(self.librev)
        self.addonrev.build_xpi(hashtag=self.hashtag, rapid=True)
