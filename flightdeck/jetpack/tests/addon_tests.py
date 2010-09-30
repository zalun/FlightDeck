from test_utils import TestCase

class AddonTest(TestCase):
	fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

	def test_keypair_generation(self):
		raise NotImplementedError


