"""
repackage.tests.test_tasks
--------------------------
"""
import commonware
import os
import simplejson
import tempfile
import urllib2
import urlparse
#import zipfile

from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from mock import Mock
from nose.tools import eq_
from utils.test import TestCase

from base.helpers import hashtag
from jetpack.models import SDK
from repackage.tasks import rebuild_from_location, rebuild_from_upload, rebuild_addon
from repackage.helpers import increment_version

log = commonware.log.getLogger('f.repackage')

OLDURLOPEN = urllib2.urlopen

class RepackageTaskTest(TestCase):

    fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

    def setUp(self):
        self.xpi_file_prefix = "file://%s" % os.path.join(
                settings.ROOT, 'apps/xpi/tests/sample_addons/')
        self.sample_addons = [
                "sample_add-on-1.0b3",
                "sample_add-on-1.0b4",
                "sample_add-on-1.0rc2.xpi"]
        self.sdk_source_dir = settings.REPACKAGE_SDK_SOURCE or os.path.join(
                settings.ROOT, 'lib/addon-sdk-1.0rc2')
        self.hashtag = hashtag()
        self.target_basename = os.path.join(
                settings.XPI_TARGETDIR, self.hashtag)

    def tearDown(self):
        urllib2.urlopen = OLDURLOPEN
        if os.path.exists('%s.xpi' % self.target_basename):
            os.remove('%s.xpi' % self.target_basename)
        if os.path.exists('%s.json' % self.target_basename):
            os.remove('%s.json' % self.target_basename)

    def test_download_and_rebuild(self):
        test_file = os.path.join(
                    self.xpi_file_prefix, '%s.xpi' % self.sample_addons[0])
        rep_response = rebuild_from_location(test_file, self.sdk_source_dir,
            self.hashtag)
        assert not rep_response[1]

    def test_download_and_failed_rebuild(self):
        with tempfile.NamedTemporaryFile() as bad_xpi:
            urllib2.urlopen = Mock(return_value=open(bad_xpi.name))
            self.assertRaises(Exception,
                    rebuild_from_location,
                    'file://%s' % bad_xpi.name, self.sdk_source_dir,
                    self.hashtag,
                    pingback='test_pingback',
                    options='--strip-xpi')
        assert os.path.exists('%s.json' % self.target_basename)
        response_json = {}
        with open('%s.json' % self.target_basename) as response:
            response_json = simplejson.loads(response.read())
        eq_(response_json['status'], 'error')
        params = urlparse.parse_qs(urllib2.urlopen.call_args[1]['data'])
        eq_(params['result'][0], 'failure')

    def test_pingback(self):
        urllib2.urlopen = Mock(return_value=open(os.path.join(
                settings.ROOT, 'apps/xpi/tests/sample_addons/',
                '%s.xpi' % self.sample_addons[0])))
        rebuild_from_location(
                os.path.join(
                    self.xpi_file_prefix, '%s.xpi' % self.sample_addons[0]),
                self.sdk_source_dir, self.hashtag,
                pingback='test_pingback',
                options='--strip-xpi')

        desired_response = {
                'msg': 'Exporting extension to sample_add-on.xpi.',
                'secret': settings.AMO_SECRET_KEY,
                'location': '%s%s' % (settings.SITE_URL,
                    reverse('jp_download_xpi', args=[
                        self.hashtag, self.sample_addons[0]])),
                'post': None,
                'id': 'jid0-S9EIBmWttfoZn92i5toIRoKXb1Y',
                'result': 'success'}
        params = urlparse.parse_qs(urllib2.urlopen.call_args[1]['data'])
        eq_(desired_response['secret'], params['secret'][0])
        eq_(desired_response['location'], params['location'][0])
        eq_(desired_response['result'], params['result'][0])


class RebuildAddonTest(TestCase):

    fixtures = ['mozilla_user', 'core_sdk', 'users', 'packages']

    def setUp(self):
        self.hashtag = hashtag()
        self.author = User.objects.get(username='john')
        self.addon = self.author.packages_originated.addons()[0:1].get()
        self.core_sdk = SDK.objects.latest('pk')
        self.createTestSDK()

    def test_rebuild_addon(self):
        urllib2.urlopen = Mock()
        rev = self.addon.latest
        pingback_url = 'http://example.com/pingback'
        assert rebuild_addon(rev.pk, self.hashtag,
                             self.test_sdk.version,
                             pingback=pingback_url)
        call_args = urllib2.urlopen.call_args
        eq_(pingback_url, call_args[0][0])
        assert 'success' in call_args[1]['data']
        assert self.hashtag in call_args[1]['data']
        assert rev.package.name in call_args[1]['data']
        assert increment_version(rev.get_version_name_only()) in call_args[1]['data']
