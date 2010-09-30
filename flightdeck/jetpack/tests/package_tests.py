import os
from test_utils import TestCase
from mock import Mock

from django.contrib.auth.models import User
from jetpack import settings
from jetpack.models import Package
from jetpack.errors import 	SelfDependencyException, FilenameExistException, \
							UpdateDeniedException, AddingModuleDenied, AddingAttachmentDenied, \
							SingletonCopyException


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
		self.assertEqual(int(package.id_number), settings.MINIMUM_PACKAGE_ID + 1)
		# all add-ons have PackageRevision created
		self.failUnless(package.version and package.latest)
		self.assertEqual(package.version.id, package.latest.id)
		# name is created automtically if no given
		self.failUnless(package.full_name)
		self.failUnless(package.name)
		self.assertEqual(package.full_name, 'My Add-on')


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
		self.assertEqual(package.full_name, 'My Add-on (1)')


	def test_ordering(self):
		" Newest is first "
		addon1 = Package(author=self.author, type='a')
		addon1.save()
		addon2 = Package(author=self.author, type='a')
		addon2.save()
		# My Addon should be second 
		self.assertEqual(Package.objects.all()[0].full_name, 'My Add-on (1)')
		
	
	def test_manager_filtering(self):
		Package(author=self.author, type='a').save()
		Package(author=self.author, type='a').save()
		Package(author=self.author, type='l').save()

		self.assertEqual(Package.objects.addons().count(), 2)
		self.assertEqual(Package.objects.libraries().count(), 2)


	def test_related_name(self):
		Package(author=self.author, type='a').save()
		self.assertEqual(self.author.packages_originated.count(), 1)


	def test_unique_package_name(self):
		addon = Package(full_name='Addon', author=self.author, type='a')
		addon.save()
		self.assertEqual(addon.get_unique_package_name(), 'addon-1000001')


	def test_disable_activate(self):
		raise NotImplementedError


