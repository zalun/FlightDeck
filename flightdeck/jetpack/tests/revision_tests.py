import os
import shutil
from test_utils import TestCase
from mock import Mock
from exceptions import TypeError

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from person.models import Profile
from jetpack import settings
from jetpack.models import Package, PackageRevision
from jetpack.errors import 	SelfDependencyException, FilenameExistException, \
							UpdateDeniedException, AddingModuleDenied, AddingAttachmentDenied, \
							SingletonCopyException


class PackageRevisionTest(TestCase):
	fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

	def setUp(self):
		self.author = User.objects.get(username='john')
		self.addon = self.author.packages_originated.addons()[0:1].get()
		self.library = self.author.packages_originated.libraries()[0:1].get()


	def test_first_revision_creation(self):
		addon = Package(author=self.author, type='a')
		addon.save()
		revisions = PackageRevision.objects.filter(package__pk=addon.pk)
		self.assertEqual(1, revisions.count())
		revision = revisions[0]
		self.assertEqual(revision.author.username, addon.author.username)
		self.assertEqual(revision.revision_number, 0)
		self.assertEqual(revision.pk, addon.latest.pk)
		self.assertEqual(revision.pk, addon.version.pk)


	def test_save(self):
		# system should create new revision on save
		addon = Package(author=self.author, type='a')
		addon.save()
		revisions = PackageRevision.objects.filter(package__name=addon.name)
		first = revisions[0]
		first.save()
		revisions = PackageRevision.objects.filter(package__name=addon.name)
		self.assertEqual(2, revisions.count())

		# first is not the same package anymore and it does not have the version_name parameter
		self.assertEqual(None, first.version_name)

		# "old" addon doesn't know about the changes
		self.assertNotEqual(addon.latest.revision_number, first.revision_number)

		# reloading addon to update changes
		addon = first.package

		# first is the latest
		self.assertEqual(addon.latest.revision_number, first.revision_number)
		self.assertNotEqual(addon.version.revision_number, addon.latest.revision_number)


	def test_set_version(self):
		addon = Package(author=self.author, type='a')
		addon.save()
		Profile(user=self.author).save()
		first = addon.latest
		old_id = first.id
		first.set_version('test')

		# setting version does not make new revision
		self.assertEqual(first.id, old_id)

		# setting version sets it for revision, package and assigns revision to package
		self.assertEqual(first.version_name,'test')
		self.assertEqual(first.package.version_name,'test')
		self.assertEqual(first.package.version.pk, first.pk)


	def test_adding_and_removing_dependency(self):
		revisions = PackageRevision.objects.filter(package__pk=self.addon.pk)
		count = revisions.count()
		first = revisions[0]
		lib = PackageRevision.objects.filter(package__pk=self.library.pk)[0]

		# first depends on lib
		first.dependency_add(lib)
		revisions = PackageRevision.objects.filter(package__pk=self.addon.pk)

		# revisions number increased
		self.assertEqual(count + 1, revisions.count())

		first = revisions[1]
		second = revisions[0]

		# only the second revision has the dependencies
		self.assertEqual(0, first.dependencies.count())
		self.assertEqual(1, second.dependencies.count())

		# remove the dependency
		second.dependency_remove(lib)

		revisions = PackageRevision.objects.filter(package__pk=self.addon.pk)
		first = revisions[2]
		second = revisions[1]
		third = revisions[0]

		# only the second revision has the dependencies
		self.assertEqual(0, first.dependencies.count())
		self.assertEqual(1, second.dependencies.count())
		self.assertEqual(0, third.dependencies.count())
		


	def test_save_with_dependency(self):
		# system should copy on save with all dependencies
		revisions = PackageRevision.objects.filter(package__pk=self.addon.pk)
		count = revisions.count()
		first = revisions[0]
		lib = PackageRevision.objects.filter(package__pk=self.library.pk)[0]

		# make first depends on lib
		# this is setting dependency in django standard way, to keep revision structure
		# one should use dependency_add method
		first.dependencies.add(lib)

		# save creates a new revision
		first.save()
		revisions = PackageRevision.objects.filter(package__pk=self.addon.pk)
		first = revisions[1]
		second = revisions[0]
		# both revisions have the same dependencies 
		self.assertEqual(first.dependencies.count(), second.dependencies.count())
		self.assertEqual(first.dependencies.all()[0].pk, lib.pk)
		self.assertEqual(second.dependencies.all()[0].pk, lib.pk)



	def test_adding_addon_as_dependency(self):
		" Add-on can't be a dependency "
		lib = PackageRevision.objects.filter(package__pk=self.library.pk)[0]
		addon = PackageRevision.objects.filter(package__pk=self.addon.pk)[0]
		self.assertRaises(TypeError, lib.dependency_add, addon)
		self.assertEqual(0, lib.dependencies.all().count())



	def test_adding_library_to_itself_as_dependency(self):
		" Check recurrent dependency (one level only) "
		lib = PackageRevision.objects.filter(package__name=self.library.name)[0]
		self.assertRaises(SelfDependencyException, lib.dependency_add, lib)



class RevisionIOTest(PackageRevisionTest):
	" testing saving to disk "

	def setUp(self):
		super(RevisionIOTest, self).setUp()
		os.mkdir('/tmp/testupload')

	def tearDown(self):
		shutil.rmtree('/tmp/testupload')


	def test_adding_attachment(self):
		first = PackageRevision.objects.filter(package__pk=self.addon.pk)[0]
		first.attachment_create(
			filename='test',
			ext='txt',
			path='/tmp/testupload',
			author=self.author
		)

		revisions = PackageRevision.objects.filter(package__pk=self.addon.pk)
		first = revisions[1]
		second = revisions[0]
		
		self.assertEqual(0, first.attachments.count())
		self.assertEqual(1, second.attachments.count())


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
from jetpack.errors import 	SelfDependencyException, FilenameExistException, \
							UpdateDeniedException, AddingModuleDenied, AddingAttachmentDenied
from jetpack.xpi_utils import sdk_copy, xpi_build, xpi_remove


class PackageRevisionTest(PackageTestCase):
	

	def test_adding_module(self):
		first = PackageRevision.objects.filter(package__name=self.addon.name)[0]
		first.module_create(
			filename=TEST_FILENAME,
			author=self.user
		)

		first = PackageRevision.objects.filter(package__name=self.addon.name)[1]
		second = PackageRevision.objects.filter(package__name=self.addon.name)[0]
		
		self.assertEqual(1, len(first.modules.all()))
		self.assertEqual(2, len(second.modules.all()))


	def test_updating_module(self):
		
		first = PackageRevision.objects.filter(package__name=self.addon.name)[0]
		mod = first.module_create(
			filename=TEST_FILENAME,
			author=self.user
		)
		mod.code = 'test'
		first.module_update(mod)

		self.assertEqual(3, len(PackageRevision.objects.filter(package__name=self.addon.name)))
		self.assertEqual(2, len(Module.objects.filter(filename=TEST_FILENAME)))

		first = PackageRevision.objects.filter(package__name=self.addon.name)[1]
		last = PackageRevision.objects.filter(package__name=self.addon.name)[0]

		self.assertEqual(2,len(last.modules.all()))
		
		


	def test_adding_module_which_was_added_to_other_package_before(self):
		" assigning module to more than one packages should be prevented! "
		addon = Package.objects.create(
			full_name="Other Package", 
			author=self.user, 
			type='a'
		)
		rev = PackageRevision.objects.filter(package__name='other-package')[0]
		first = PackageRevision.objects.filter(package__name=self.addon.name)[0]
		mod = Module.objects.create(
			filename=TEST_FILENAME,
			author=self.user
		)
		first.module_add(mod)
		self.assertRaises(AddingModuleDenied, rev.module_add, mod)
		

	def test_adding_module_with_existing_filename(self):
		
		first = PackageRevision.objects.filter(package__name=self.addon.name)[0]
		first.module_create(
			filename=TEST_FILENAME,
			author=self.user
		)
		self.assertRaises(FilenameExistException, first.module_create,
			**{'filename':TEST_FILENAME,'author':self.user}
		)
		mod = Module.objects.create(
			filename=TEST_FILENAME,
			author=self.user
		)
		self.assertRaises(FilenameExistException, first.module_add, mod)
		
	def test_adding_attachment_which_was_added_to_other_package_before(self):
		" assigning attachment to more than one packages should be prevented! "
		addon = Package.objects.create(
			full_name="Other Package", 
			author=self.user, 
			type='a'
		)
		rev = PackageRevision.objects.filter(package__name='other-package')[0]
		first = PackageRevision.objects.filter(package__name=self.addon.name)[0]
		att = Attachment.objects.create(
			filename=TEST_FILENAME,
			ext=TEST_FILENAME_EXTENSION,
			path=TEST_UPLOAD_PATH,
			author=self.user
		)
		first.attachment_add(att)
		self.assertRaises(AddingAttachmentDenied, rev.attachment_add, att)
		

	def test_adding_attachment_with_existing_filename(self):
		
		first = PackageRevision.objects.filter(package__name=self.addon.name)[0]
		first.attachment_create(
			filename=TEST_FILENAME,
			ext=TEST_FILENAME_EXTENSION,
			path=TEST_UPLOAD_PATH,
			author=self.user
		)
		self.assertRaises(FilenameExistException, first.attachment_create,
			**{	'filename': TEST_FILENAME,
				'ext': TEST_FILENAME_EXTENSION,
				'author': self.user,
				'path': TEST_UPLOAD_PATH,
				}
		)

		att = Attachment.objects.create(
			filename=TEST_FILENAME,
			ext=TEST_FILENAME_EXTENSION,
			path=TEST_UPLOAD_PATH,
			author=self.user
		)
		self.assertRaises(FilenameExistException, first.attachment_add, att)



class ModuleTest(PackageTestCase):

	def test_update_module_using_save(self):
		" updating module is not allowed "
		mod = Module.objects.create(
			filename=TEST_FILENAME,
			author=self.user
		)
		self.assertRaises(UpdateDeniedException,mod.save)


class AttachmentTest(PackageTestCase):

	def setUp(self):
		super(AttachmentTest, self).setUp()
		self.attachment = Attachment.objects.create(
			filename=TEST_FILENAME,
			ext=TEST_FILENAME_EXTENSION,
			path=TEST_UPLOAD_PATH,
			author=self.user
		)
		

	def test_update_attachment_using_save(self):
		" updating attachment is not allowed "
		self.assertRaises(UpdateDeniedException,self.attachment.save)

	def test_export_file(self):
		self.createFile()
		self.attachment.export_file('/tmp')
		self.failUnless(os.path.isfile('/tmp/%s.%s' % (TEST_FILENAME, TEST_FILENAME_EXTENSION)))

		
class ManifestsTest(PackageTestCase):
	" tests strictly about manifest creation "

	manifest = {
		'fullName': TEST_ADDON_FULLNAME,
		'name': TEST_ADDON_NAME,
		'description': '',
		'author': TEST_USERNAME,
		'version': settings.INITIAL_VERSION_NAME,
		'dependencies': ['jetpack-core'],
		'license': '',
		'url': '',
		'main': 'main',
		'contributors': [],
		'lib': 'lib'
	}
	
	def test_minimal_manifest(self):
		" test if self.manifest is created for the clean addon "
		first = PackageRevision.objects.filter(package__name=self.addon.name)[0]

		manifest = deepcopy(self.manifest)
		first_manifest = first.get_manifest()
		del first_manifest['id']
		self.assertEqual(manifest, first_manifest)


	def test_manifest_from_not_current_revision(self):
		" test if the version in the manifest changes after 'updating' PackageRevision "
		first = PackageRevision.objects.filter(package__name=self.addon.name)[0]
		first.save()

		manifest = deepcopy(self.manifest)
		manifest['version'] = "%s rev. 1" % settings.INITIAL_VERSION_NAME

		first_manifest = first.get_manifest()
		del first_manifest['id']
		self.assertEqual(manifest, first_manifest)


	def test_manifest_with_dependency(self):
		" test if Manifest has the right dependency list "
		first = PackageRevision.objects.filter(package__name=self.addon.name)[0]
		lib = PackageRevision.objects.filter(package__name=self.library.name)[0]
		first.dependency_add(lib)

		manifest = deepcopy(self.manifest)
		manifest['dependencies'].append('%s-%d' % (TEST_LIBRARY_NAME, settings.MINIMUM_PACKAGE_ID + 1))
		manifest['version'] = "%s rev. 1" % settings.INITIAL_VERSION_NAME

		first_manifest = first.get_manifest()
		del first_manifest['id']
		self.assertEqual(manifest, first_manifest)

	def test_contributors_list(self):
		" test if the contributors list is exported properly "
		first = PackageRevision.objects.filter(package__name=self.addon.name)[0]
		first.contributors = "one, 12345, two words,no space"
		first.save()

		manifest = deepcopy(self.manifest)
		manifest['version'] = "%s rev. 1" % settings.INITIAL_VERSION_NAME
		manifest['contributors'] = ['one', '12345', 'two words', 'no space']

		first_manifest = first.get_manifest()
		del first_manifest['id']
		self.assertEqual(manifest, first_manifest)
		

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


