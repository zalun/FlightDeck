"""
repackage.tests.test_models
---------------------------
"""
import os
import commonware

#from mock import Mock
from nose.tools import eq_
from utils.test import TestCase

from django.conf import settings
from django.http import Http404

from base.templatetags.base_helpers import hashtag
from repackage.helpers import Repackage

log = commonware.log.getLogger('f.tests')


class RepackageTest(TestCase):

    def setUp(self):
        self.hashtag = hashtag()
        self.file_prefix = os.path.join(settings.ROOT,
                'apps/xpi/tests/sample_addons/')
        self.xpi_file_prefix = "file://%s" % self.file_prefix
        self.sample_addons = [
                "sample_add-on-1.0b3.xpi",
                "sample_add-on-1.0b4.xpi",
                "sample_add-on-1.0rc2.xpi"]
        self.sdk_source_dir = settings.REPACKAGE_SDK_SOURCE or os.path.join(
                settings.ROOT, 'lib/addon-sdk-1.0rc2')

    def tearDown(self):
        target_xpi = os.path.join(
                settings.XPI_TARGETDIR, self.hashtag, '.xpi')
        if os.path.isfile(target_xpi):
            os.remove(target_xpi)

    # mock self.sdk.get_source_dir()
    def test_repackage(self):
        for sample in self.sample_addons:
            rep = Repackage()
            rep.download(os.path.join(self.xpi_file_prefix, sample))
            response = rep.rebuild(self.sdk_source_dir, self.hashtag)
            assert not response[1]

    def test_not_existing_location(self):
        rep = Repackage()
        self.assertRaises(Http404,
                rep.download,
                'http://builder.addons.mozilla.org/wrong_file.xpi')

    def test_forcing_version(self):
        for sample in self.sample_addons:
            rep = Repackage()
            rep.download(os.path.join(self.xpi_file_prefix, sample))
            rep.get_manifest({'version': 'force.version'})
        eq_(rep.manifest['version'], 'force.version')
