"""
repackage.tests.test_tasks
--------------------------
"""
import os

from django.conf import settings

from utils.test import TestCase

from base.templatetags.base_helpers import hashtag
from repackage.tasks import download_and_rebuild


class RepackageTaskTest(TestCase):

    fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

    def setUp(self):
        settings.XPI_AMO_PREFIX = "file://%s" % os.path.join(
                settings.ROOT, 'apps/xpi/tests/sample_addons/')
        self.sample_addons = [
                "sample_add-on-1.0b3",
                "sample_add-on-1.0b4" ]
        self.sdk_source_dir = os.path.join(
                settings.ROOT, 'lib/addon-sdk-1.0b5')
        self.hashtag = hashtag()

    def tearDown(self):
        target_xpi = os.path.join(
                settings.XPI_TARGETDIR, self.hashtag, '.xpi')
        if os.path.isfile(target_xpi):
            os.remove(target_xpi)

    def test_download_and_rebuild(self):
        rep_response = download_and_rebuild(
                123, self.sample_addons[0], self.sdk_source_dir, self.hashtag)
        assert not rep_response


