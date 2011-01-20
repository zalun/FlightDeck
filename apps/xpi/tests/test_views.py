import os
import simplejson

from test_utils import TestCase
from nose.tools import eq_
from nose import SkipTest
from mock import patch

from django.core.urlresolvers import reverse

from base.templatetags.base_helpers import hashtag


class TestViews(TestCase):
    fixtures = ('mozilla_user', 'core_sdk', 'users', 'packages')

    def setUp(self):
        self.hashtag = hashtag()
        self.check_download_url = reverse('jp_check_download_xpi',
                args=[self.hashtag])

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
