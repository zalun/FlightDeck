from django.core.urlresolvers import reverse

import test_utils
from nose.tools import eq_
from mock import patch
from pyquery import PyQuery as pq


class TestViews(test_utils.TestCase):
    fixtures = ('mozilla_user', 'core_sdk', 'users', 'packages')

    def setUp(self):
        self.url = reverse('jp_addon_revision_xpi', args=[1000001, 0])

    def test_package_download_xpi(self):
        r = self.client.get(self.url)
        eq_(r.status_code, 200)

    @patch('os.path.isfile')
    def test_package_download_xpi_async(self, isfile):
        """
        If we are waiting for the XPI, we'll need to test the redirecty stuff.
        """
        isfile.return_value = False
        r = self.client.get(self.url)
        eq_(r.status_code, 302)
        next = r.get('Location', '')
        assert next.endswith(self.url + '?retry=1')
        r = self.client.get(next)
        doc = pq(r.content)
        eq_(doc('#app-content h2').text(), 'XPI Not Ready')
