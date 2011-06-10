from copy import deepcopy
from test_utils import TestCase

from django.contrib.auth.models import User
from django.conf import settings

from jetpack.models import Package


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
        self.addon = Package.objects.get(name='test-addon',
                                         author__username='john')
        self.library = Package.objects.get(name='test-library')

    def test_minimal_manifest(self):
        " test if self.manifest is created for the clean addon "
        author = User.objects.get(username='john')
        author.username='123'
        profile = author.get_profile()
        profile.nickname = 'john'
        author.save()
        profile.save()

        first = self.addon.latest

        manifest = deepcopy(self.manifest)
        first_manifest = first.get_manifest()
        del first_manifest['id']
        self.assertEqual(manifest, first_manifest)

    def test_manifest_from_not_current_revision(self):
        """
        test if the version in the manifest changes after 'updating'
        PackageRevision
        """
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
        manifest['dependencies'].append('test-library-%s' % self.library.id_number)
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
