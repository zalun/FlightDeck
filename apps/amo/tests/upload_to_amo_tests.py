import commonware
import shutil
import tempfile
import os

from mock import Mock
from nose.tools import eq_

from django.contrib.auth.models import User
from django.conf import settings

from amo.tasks import upload_to_amo
from base.templatetags.base_helpers import hashtag
from jetpack.models import (Package, PackageRevision, STATUS_UNREVIEWED,
        STATUS_PUBLIC)
from utils.amo import AMOOAuth
from utils.test import TestCase

log = commonware.log.getLogger('f.test')


class UploadTest(TestCase):
    fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']
    ADDON_AMO_ID = 1

    def setUp(self):
        self.author = User.objects.get(username='john')
        self.addonrev = Package.objects.get(name='test-addon',
                                         author__username='john').latest
        self.hashtag = hashtag()
        self.xpi_file = os.path.join(settings.XPI_TARGETDIR,
                "%s.xpi" % self.hashtag)
        self.SDKDIR = tempfile.mkdtemp()
        self.amo = AMOOAuth(domain=settings.AMOOAUTH_DOMAIN,
                           port=settings.AMOOAUTH_PORT,
                           protocol=settings.AMOOAUTH_PROTOCOL,
                           prefix=settings.AMOOAUTH_PREFIX)

    def tearDown(self):
        if os.path.exists(self.SDKDIR):
            shutil.rmtree(self.SDKDIR)
        if os.path.exists(self.xpi_file):
            os.remove(self.xpi_file)

    def test_create_new_amo_addon(self):
        AMOOAuth._send = Mock(return_value={
            'status': STATUS_UNREVIEWED,
            'id': self.ADDON_AMO_ID})
        upload_to_amo(self.addonrev.pk, self.hashtag)
        # checking status and other attributes
        addonrev = Package.objects.get(name='test-addon',
                                       author__username='john').latest
        eq_(addonrev.package.amo_id, self.ADDON_AMO_ID)
        eq_(addonrev.amo_version_name, 'initial')
        eq_(addonrev.amo_status, STATUS_UNREVIEWED)
        # check if right API was called
        assert 'POST' in AMOOAuth._send.call_args[0]
        assert self.amo.url('addon') in AMOOAuth._send.call_args[0]

    def test_update_amo_addon(self):
        AMOOAuth._send = Mock(return_value={'status': STATUS_UNREVIEWED})
        # set add-on as uploaded
        self.addonrev.amo_status = STATUS_PUBLIC
        self.addonrev.amo_version_name = self.addonrev.get_version_name()
        self.addonrev.package.amo_id = self.ADDON_AMO_ID
        # create a new revision
        self.addonrev.save()
        upload_to_amo(self.addonrev.pk, self.hashtag)
        # checking status and other attributes
        addonrev = Package.objects.get(name='test-addon',
                                       author__username='john').latest
        eq_(addonrev.amo_version_name,
                'initial.rev%d' % addonrev.revision_number)
        eq_(addonrev.amo_status, STATUS_UNREVIEWED)
        # check if right API was called
        assert 'POST' in AMOOAuth._send.call_args[0]
        assert self.amo.url('version') % self.ADDON_AMO_ID in AMOOAuth._send.call_args[0]
