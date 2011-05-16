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
        self.sample_addons = [
                # 1.0b1 and 1.0b2 are not working as filename has to be
                # the same as manifest['name']
                # No such file or directory:
                # '/tempSDK/packages/sample-add-on/package.json'
                # "sample_add-on-1.0b1","sample_add-on-1.0b2",
                "sample_add-on-1.0b3",
                "sample_add-on-1.0b4" ]
        self.sdk_source_dir = os.path.join(
                settings.ROOT, 'lib/addon-sdk-1.0b5')

    def tearDown(self):
        target_xpi = os.path.join(
                settings.XPI_TARGETDIR, self.hashtag, '.xpi')
        if os.path.isfile(target_xpi):
            os.remove(target_xpi)

    # mock self.sdk.get_source_dir()
    def test_repackage(self):
        for sample in self.sample_addons:
            rep = Repackage()
            rep.download(123, sample)
            response = rep.rebuild(self.sdk_source_dir, self.hashtag)
            assert not response

    def test_forcing_version(self):
        for sample in self.sample_addons:
            rep = Repackage()
            rep.download(123, sample)
            rep.get_manifest('force.version')
        eq_(rep.manifest['version'], 'force.version')
