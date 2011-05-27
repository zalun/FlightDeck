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
        self.rebuild_url = reverse('repackage_rebuild')

    def test_repackage_bad_request(self):
        # POST request is required
        response = self.client.get(self.rebuild_url)
        eq_(response.status_code, 405)
        # security field is required
        response = self.client.post(self.rebuild_url)
        eq_(response.status_code, 403)
        # location field is reuired
        response = self.client.post(self.rebuild_url, {
            'secret': settings.AMO_SECRET_KEY})
        eq_(response.status_code, 400)
        # invalid version format
        response = self.client.post(self.rebuild_url, {
            'location': os.path.join(
                self.xpi_file_prefix, self.sample_addons[1]),
            'secret': settings.AMO_SECRET_KEY,
            'addons': simplejson.dumps([{
                'location': os.path.join(
                    self.xpi_file_prefix, self.sample_addons[1]),
                }]),
            'version': 'invalid string'})
        log.debug(response.content)
        eq_(response.status_code, 200)
        log.debug(response.content)
        # invalid secret key

    def test_repackage_with_download(self):
        tasks.low_rebuild.delay = Mock(return_value=None)
        get_rebuild = lambda sample: self.client.post(self.rebuild_url, {
            'location': os.path.join(self.xpi_file_prefix, sample),
            'secret': settings.AMO_SECRET_KEY})

        # test add-ons build with SDK 1.0b3
        response = get_rebuild(self.sample_addons[0])
        eq_(response.status_code, 200)
        content = simplejson.loads(response.content)
        assert 'status' in content
        eq_(content['status'], 'success')

        # test add-ons build with SDK 1.0b4
        response = get_rebuild(self.sample_addons[1])
        eq_(response.status_code, 200)
        content = simplejson.loads(response.content)
        assert 'status' in content
        eq_(content['status'], 'success')

    def test_bulk_repackage_with_download(self):
        tasks.low_rebuild.delay = Mock(return_value=None)
        response = self.client.post(self.rebuild_url, {
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
        eq_(tasks.low_rebuild.delay.call_count, 2)

    def test_single_upload_and_rebuild(self):
        file_pre = os.path.join(settings.ROOT, 'apps/xpi/tests/sample_addons/')
        tasks.low_rebuild.delay = Mock(return_value=None)
        with open(os.path.join(file_pre, self.sample_addons[1])) as f:
            response = self.client.post(self.rebuild_url, {
                'upload': f,
                'secret': settings.AMO_SECRET_KEY})
        eq_(response.status_code, 200)
        content = simplejson.loads(response.content)
        eq_(content['status'], 'success')
        eq_(tasks.low_rebuild.delay.call_count, 1)

    def test_bulk_upload_and_rebuild(self):
        file_pre = os.path.join(settings.ROOT, 'apps/xpi/tests/sample_addons/')
        tasks.low_rebuild.delay = Mock(return_value=None)
        f0 = open(os.path.join(file_pre, self.sample_addons[0]))
        f1 = open(os.path.join(file_pre, self.sample_addons[1]))
        response = self.client.post(self.rebuild_url, {
            'upload_a': f0,
            'upload_b': f1,
            'addons': simplejson.dumps([
                {'upload': 'upload_a'},
                {'upload': 'upload_b'}
                ]),
            'secret': settings.AMO_SECRET_KEY})
        eq_(response.status_code, 200)
        content = simplejson.loads(response.content)
        eq_(content['status'], 'success')
        eq_(tasks.low_rebuild.delay.call_count, 2)

