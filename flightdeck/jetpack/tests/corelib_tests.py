import os
from test_utils import TestCase
from mock import Mock

from django.contrib.auth.models import User
from jetpack import settings
from jetpack.models import Package
from jetpack.errors import 	SelfDependencyException, FilenameExistException, \
							UpdateDeniedException, AddingModuleDenied, AddingAttachmentDenied, \
							SingletonCopyException

class CoreLibTestCase(TestCase):

	fixtures = ['mozilla_user', 'core_sdk']

	def test_findCoreLibrary(self):
		sdk = Package.objects.get(id_number=settings.MINIMUM_PACKAGE_ID)
		self.failUnless(sdk)
		self.failUnless(sdk.is_library())

	def test_preventFromCopying(self):
		sdk = Package.objects.get(id_number=settings.MINIMUM_PACKAGE_ID)
		author = Mock()
		self.assertRaises(SingletonCopyException, sdk.copy, author)
		

