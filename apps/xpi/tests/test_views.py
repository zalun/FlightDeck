"""
xpi.tests.test_views
--------------------
"""
import mock
import simplejson
import os
import commonware

from test_utils import TestCase
from nose.tools import eq_
from mock import patch

from django.core.urlresolvers import reverse
from django.conf import settings

from base.shortcuts import get_object_with_related_or_404

from base.helpers import hashtag
from xpi import tasks
from jetpack.models import PackageRevision

log = commonware.log.getLogger('f.test')


class TestViews(TestCase):
    fixtures = ('mozilla_user', 'core_sdk', 'users', 'packages')

    def setUp(self):
        self.hashtag = hashtag()
        self.check_download_url = reverse('jp_check_download_xpi',
                args=[self.hashtag])
        self.prepare_test_url = reverse('jp_addon_revision_test',
                args=['1000003', 0])
        self.xpi_path = os.path.join(
            settings.XPI_TARGETDIR, '%s.xpi' % self.hashtag)

    def tearDown(self):
        if os.path.isfile(self.xpi_path):
            os.remove(self.xpi_path)

    @patch('os.path.isfile')
    def test_package_check_download(self, isfile):
        """
        Checking the responses of check_download_xpi
        """
        isfile.return_value = False
        r = self.client.get(self.check_download_url)
        eq_(r.status_code, 200)
        response = simplejson.loads(r.content)
        assert not response['ready']
        isfile.return_value = True
        r = self.client.get(self.check_download_url)
        eq_(r.status_code, 200)
        response = simplejson.loads(r.content)
        assert response['ready']

    def test_downloading_xpi(self):
        """Check if the right file is downloaded
        """
        mimetype = 'text/plain; charset=x-user-defined'
        uri = reverse('jp_test_xpi', args=[self.hashtag])
        # no file check
        response = self.client.get(uri)
        eq_(response.status_code, 200)
        eq_(response.content, '')
        # create a file and check
        with open(self.xpi_path, 'w') as xpi:
            xpi.write('test')
        response = self.client.get(uri)
        eq_(response.status_code, 200)
        eq_(response.content, 'test')

    def test_hashtag(self):
        revision = PackageRevision.objects.get(pk=205)
        uri = reverse('jp_addon_revision_test',
            args=[revision.package.id_number, revision.revision_number])
        response = self.client.post(uri, {'hashtag': 'abc/123'})
        eq_(response.status_code, 403)
        response = self.client.post(uri, {'hashtag': self.hashtag})
        eq_(response.status_code, 200)
        response = self.client.post(
                reverse('jp_addon_revision_xpi', args=[
                    revision.package.id_number, revision.revision_number]),
                {'hashtag': 'abc.123'})
        eq_(response.status_code, 403)
        response = self.client.get('/xpi/test/abc/123')
        eq_(response.status_code, 404)
        response = self.client.get('/xpi/check_download/abc%20123')
        eq_(response.status_code, 404)

    def test_cach_hashtag(self):
        mock_backup = os.path.exists
        os.path.exists = mock.Mock(return_value=True)
        tasks.xpi_build_task = mock.Mock()
        response = self.client.post(self.prepare_test_url, {
            'hashtag': 'abc'})
        os.path.exists = mock_backup
        assert not tasks.xpi_build_task.called
        os.path.exists = mock.Mock(return_value=False)
        response = self.client.post(self.prepare_test_url, {
            'hashtag': 'abc'})
        os.path.exists = mock_backup
        assert tasks.xpi_build_task.called
