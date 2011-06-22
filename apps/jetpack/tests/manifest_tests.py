import commonware

from copy import deepcopy
from nose.tools import eq_
from test_utils import TestCase

from django.contrib.auth.models import User
from django.conf import settings

from jetpack.models import Package

log = commonware.log.getLogger('f.test')


class ManifestsTest(TestCase):
    " tests strictly about manifest creation "

    fixtures = ['mozilla', 'core_sdk', 'users', 'packages']

    manifest = {
        'fullName': u'Test Addon',
        'name': u'test-addon',
        'description': u'',
        'author': u'john',
        'version': settings.INITIAL_VERSION_NAME,
        'dependencies': ['api-utils', 'addon-kit'],
        'license': u'',
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
        manifest['dependencies'].append('test-library')
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

    def test_deeper_dependency(self):
        first = self.addon.latest
        revlib = self.library.latest
        firstpk = first.pk
        # add revlib to dependencies
        first.dependency_add(revlib)
        assert firstpk != first.pk
        firstpk = first.pk
        lib2 = self.library.copy(author=self.addon.author)
        first.dependency_add(lib2.latest)
        assert firstpk != first.pk
        manifest = first.get_manifest()
        eq_(manifest['dependencies'],
                ['api-utils', 'addon-kit', u'test-library',
                    u'test-library-copy-1'])
