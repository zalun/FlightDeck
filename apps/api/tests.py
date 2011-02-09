"""
Testing the cuddlefish engine to export API
"""
import os
import commonware.log

from django.conf import settings
from django.contrib.auth.models import User

from nose.tools import eq_
from utils.test import TestCase, get_latest_sdk_dir
from utils.exceptions import SimpleException
from jetpack.management import create_SDK
from jetpack.models import Package, PackageRevision, SDK
from api.helpers import export_docs
from api.models import DocPage

log = commonware.log.getLogger('f.api.tests')


class ImportDocsTest(TestCase):
    fixtures = ['mozilla_user']

    def setUp(self):
        self.mozilla = User.objects.get(username='mozilla')
        self.sdk_filename = get_latest_sdk_dir()
        # create fake core-lib and addon-kit
        core_lib = Package.objects.create(
                name='core-lib-fake',
                type='l',
                author=self.mozilla,
                public_permission=2)
        self.sdk = SDK.objects.create(
                version='test-sdk',
                core_lib=core_lib.latest,
                dir=self.sdk_filename)
        self.tar_path = os.path.join(self.sdk.get_source_dir(),
                "addon-sdk-docs.tgz")

    def test_export_docs(self):
        # the tgz file should not exist
        assert not os.path.isfile(self.tar_path)
        process = export_docs(self.sdk.get_source_dir())
        eq_(process[1], '')
        assert os.path.isfile(self.tar_path)
        # docs should be deleted after import
        self.assertRaises(SimpleException, self.sdk.import_docs)
        os.remove(self.tar_path)
        assert not os.path.isfile(self.tar_path)

    def test_import_docs(self):
        # prepare docs
        self.sdk.import_docs()
        assert not os.path.isfile(self.tar_path)
        assert DocPage.objects.count() > 1
        self.sdk.import_docs()



class CuddleTest(TestCase):

    fixtures = ['mozilla', 'core_sdk']

    def setUp(self):
        self.createCore()

    def tearDown(self):
        self.deleteCore()

    def test_basic(self):
        """
        exporting hunks
        """
        from cuddlefish import apiparser
        from api.views import SDKPACKAGESDIR
        #XXX: the path is different now
        docs_dir = os.path.join(
            SDKPACKAGESDIR, 'jetpack-core/docs')
        text = open(os.path.join(docs_dir, 'url.md')).read()
        self.failUnless(len(list(apiparser.parse_hunks(text))) > 0)

