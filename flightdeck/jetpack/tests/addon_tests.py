import os
from test_utils import TestCase
from mock import Mock

from django.contrib.auth.models import User
from jetpack import settings
from jetpack.models import Package
from jetpack.errors import 	SelfDependencyException, FilenameExistException, \
							UpdateDeniedException, AddingModuleDenied, AddingAttachmentDenied, \
							SingletonCopyException


class AddonTest(TestCase):
	fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

	def test_keypair_generation(self):
		raise NotImplementedError


