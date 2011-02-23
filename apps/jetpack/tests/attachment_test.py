# coding=utf-8
import os
import tempfile
import commonware

from test_utils import TestCase
from nose.tools import eq_
from nose import SkipTest

from django.contrib.auth.models import User
from django.conf  import settings

from jetpack.models import Attachment, Package

log = commonware.log.getLogger('f.test')


class AttachmentTest(TestCase):
    """Testing attachment methods."""

    fixtures = ('core_sdk', 'users')

    def setUp(self):
        self.author = User.objects.get(username='john')

        self.old = settings.UPLOAD_DIR
        settings.UPLOAD_DIR = tempfile.mkdtemp()

        # Simulating upload.
        self.attachment = Attachment.objects.create(
            filename='test_filename.txt',
            author=self.author
        )
        self.attachment.create_path()
        self.attachment.data = 'test'
        self.attachment.write()

        self.path = self.attachment.path

    def tearDown(self):
        os.remove(os.path.join(settings.UPLOAD_DIR, self.path))
        settings.UPLOAD_DIR = self.old

    def test_export_file(self):
        destination = tempfile.mkdtemp()
        filename = '%s.%s' % (self.attachment.filename, self.attachment.ext)
        filename = os.path.join(destination, filename)
        self.attachment.export_file(destination)
        assert os.path.isfile(filename)

    def test_create_attachment_with_utf_content(self):
        self.attachment.data = u'ą'
        self.attachment.write()
        destination = tempfile.mkdtemp()
        filename = '%s.%s' % (self.attachment.filename, self.attachment.ext)
        filename = os.path.join(destination, filename)
        self.attachment.export_file(destination)
        assert os.path.isfile(filename)
        f = open(filename, 'r')
        eq_(f.read(), "ą")
        f.close()

    def test_update_attachment_with_utf_content_from_view(self):
        addon = Package.objects.create(
                type='a',
                author=self.author)
        addon.latest.attachment_add(self.attachment)
        self.author.set_password('secure')
        self.author.save()
        self.client.login(username=self.author.username, password='secure')
        response = self.client.post(addon.latest.get_save_url(), {
            self.attachment.pk: u'ą'})
        eq_(response.status_code, 200)
        addon = Package.objects.get(author=self.author)
        eq_(addon.latest.revision_number, 2)
        eq_(addon.latest.attachments.get().read(), u'ą')
