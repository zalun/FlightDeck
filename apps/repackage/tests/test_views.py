"""
repackage.tests.test_views
--------------------------
"""

import commonware
import os
import simplejson

from mock import Mock
from nose.tools import eq_
from utils.test import TestCase

from django.conf import settings
from django.core.urlresolvers import reverse

#from base.templatetags.base_helpers import hashtag
from jetpack.models import SDK
#from repackage.models import Repackage
from repackage import tasks

log = commonware.log.getLogger('f.repackage')


def _del_xpi(hashtag):
    target_xpi = os.path.join(
            settings.XPI_TARGETDIR, hashtag, '.xpi')
    if os.path.isfile(target_xpi):
        os.remove(target_xpi)

class RepackageViewsTest(TestCase):
    fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

    def setUp(self):
        settings.CELERY_ALWAYS_EAGER = True
        self.xpi_file_prefix = "file://%s" % os.path.join(
                settings.ROOT, 'apps/xpi/tests/sample_addons/')
        self.sample_addons = [
                "sample_add-on-1.0b3.xpi",
                "sample_add-on-1.0b4.xpi" ]
        sdk_source_dir = os.path.join(
                settings.ROOT, 'lib/addon-sdk-1.0b5')
        self.single_rebuild = reverse('repackage_rebuild')
        self.bulk_rebuild = reverse('repackage_bulk_rebuild')

    def test_repackage_bad_request(self):
        # POST request is required
        response = self.client.get(self.single_rebuild)
        eq_(response.status_code, 405)
        response = self.client.get(self.bulk_rebuild)
        eq_(response.status_code, 405)
        # security field is required
        response = self.client.post(self.single_rebuild)
        eq_(response.status_code, 403)
        response = self.client.post(self.bulk_rebuild)
        eq_(response.status_code, 403)
        # location field is reuired
        response = self.client.post(self.single_rebuild, {
            'secret': settings.AMO_SECRET_KEY})
        eq_(response.status_code, 400)
        response = self.client.post(self.bulk_rebuild, {
            'secret': settings.AMO_SECRET_KEY})
        eq_(response.status_code, 400)
        # invalid version format
        response = self.client.post(self.single_rebuild, {
            'location': os.path.join(
                self.xpi_file_prefix, self.sample_addons[1]),
            'secret': settings.AMO_SECRET_KEY,
            'version': 'invalid string'})
        eq_(response.status_code, 400)
        response = self.client.post(self.bulk_rebuild, {
            'addons': simplejson.dumps([{
                'location': os.path.join(
                    self.xpi_file_prefix, self.sample_addons[1]),
                }]),
            'secret': settings.AMO_SECRET_KEY,
            'version': 'invalid string'})
        log.debug(response.content)
        eq_(response.status_code, 200)
        log.debug(response.content)
        # invalid secret key

    def test_repackage_with_download(self):
        tasks.download_and_rebuild.delay = Mock(return_value=None)
        get_rebuild = lambda sample: self.client.post(self.single_rebuild, {
            'location': os.path.join(self.xpi_file_prefix, sample),
            'secret': settings.AMO_SECRET_KEY})

        # test add-ons build with SDK 1.0b3
        response = get_rebuild(self.sample_addons[0])
        eq_(response.status_code, 200)
        content = simplejson.loads(response.content)
        assert 'hashtag' in content

        # test add-ons build with SDK 1.0b4
        response = get_rebuild(self.sample_addons[1])
        eq_(response.status_code, 200)
        content = simplejson.loads(response.content)
        assert 'hashtag' in content

    def test_bulk_repackage_with_download(self):
        tasks.bulk_download_and_rebuild.delay = Mock(return_value=None)
        response = self.client.post(self.bulk_rebuild, {
            'addons': simplejson.dumps([
                {'location': os.path.join(
                    self.xpi_file_prefix, self.sample_addons[0])},
                {'location': os.path.join(
                    self.xpi_file_prefix, self.sample_addons[1])},
                ]),
            'secret': settings.AMO_SECRET_KEY})

        eq_(response.status_code, 200)
        content = simplejson.loads(response.content)
        eq_(content['status'], 'success')
        eq_(tasks.bulk_download_and_rebuild.delay.call_count, 2)
