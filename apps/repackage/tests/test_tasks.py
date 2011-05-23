"""
repackage.tests.test_tasks
--------------------------
"""
import os
import urllib

from django.conf import settings

from mock import Mock
from utils.test import TestCase

from base.templatetags.base_helpers import hashtag
from repackage.tasks import download_and_rebuild


class RepackageTaskTest(TestCase):

    fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

    def setUp(self):
        self.xpi_file_prefix = "file://%s" % os.path.join(
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
                os.path.join(
                    self.xpi_file_prefix, '%s.xpi' % self.sample_addons[0]),
                self.sdk_source_dir, self.hashtag)
        assert not rep_response[1]

    def test_pingback(self):
        urllib.urlopen = Mock(return_value=open(os.path.join(
                settings.ROOT, 'apps/xpi/tests/sample_addons/',
                '%s.xpi' % self.sample_addons[0])))
        rep_response = download_and_rebuild(
                os.path.join(
                    self.xpi_file_prefix, '%s.xpi' % self.sample_addons[0]),
                self.sdk_source_dir, self.hashtag,
                pingback='test_pingback')

        start = 'msg=Exporting+extension+to+sample_add-on.xpi.%0A&secret=notsecure&location=%2Fxpi%2Fdownload%2F'
        end = '%2Fsample_add-on-1.0b3%2F&id=jid0-S9EIBmWttfoZn92i5toIRoKXb1Y&result=success'
        urllib.urlopen.assert_called_with('test_pingback',
                data='%s%s%s' % (start, self.hashtag, end))

