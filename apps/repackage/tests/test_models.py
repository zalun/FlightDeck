"""
repackage.tests.test_models
---------------------------
"""
import os
import commonware

from mock import Mock
from nose.tools import eq_
from utils.test import TestCase

from django.conf import settings

from base.templatetags.base_helpers import hashtag
from repackage.models import Repackage

log = commonware.log.getLogger('f.tests')


class RepackageTest(TestCase):

    def setUp(self):
        self.hashtag = hashtag()
        settings.XPI_AMO_PREFIX = "file://%s" % os.path.join(
                settings.ROOT, 'apps/xpi/tests/sample_addons/')

    # mock self.sdk.get_source_dir()
    def test_repackage(self):
        sample_addons = [
                # 1.0b1 and 1.0b2 are not working as filename has to be
                # the same as manifest['name']
                # No such file or directory:
                # '/tempSDK/packages/sample-add-on/package.json'
                # "sample_add-on-1.0b1","sample_add-on-1.0b2",
                "sample_add-on-1.0b3",
                "sample_add-on-1.0b4" ]
        sdk_source_dir = os.path.join(settings.ROOT, 'lib/addon-sdk-1.0b5')
        for sample in sample_addons:
            hashtag = self.hashtag
            rep = Repackage()
            rep.download(123, sample)
            response = rep.rebuild(sdk_source_dir, hashtag)
            assert not response
