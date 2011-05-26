"""
repackage.tests.test_tasks
--------------------------
"""
import os
import urllib
import urlparse

from django.conf import settings
from django.core.urlresolvers import reverse

from mock import Mock
from nose.tools import eq_
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

        desired_response = {
                'msg': 'Exporting extension to sample_add-on.xpi.',
                'secret': settings.BUILDER_SECRET_KEY,
                'location': reverse('jp_download_xpi', args=[
                        self.hashtag, self.sample_addons[0]]),
                'post': None,
                'id': 'jid0-S9EIBmWttfoZn92i5toIRoKXb1Y',
                'result': 'success'}
        params = urlparse.parse_qs(urllib.urlopen.call_args[1]['data'])
        eq_(desired_response['secret'], params['secret'][0])
        eq_(desired_response['location'], params['location'][0])
        eq_(desired_response['result'], params['result'][0])

