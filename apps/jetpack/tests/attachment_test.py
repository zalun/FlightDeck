import os
from test_utils import TestCase

from django.contrib.auth.models import User
from django.conf  import settings

from jetpack.models import Attachment
from jetpack.errors import UpdateDeniedException


class AttachmentTest(TestCase):
    " Testing attachment methods "

    fixtures = ['nozilla', 'core_sdk', 'users', 'packages']

    def setUp(self):
        self.author = User.objects.get(username='john')
        " Simulating upload "
        handle = open(os.path.join(settings.UPLOAD_DIR, 'test_filename.txt'), 'w')
        handle.write('unit test file')
        handle.close()
        self.attachment = Attachment.objects.create(
            filename='test_filename',
            ext='txt',
            path='test_filename.txt',
            author=self.author
        )

    def tearDown(self):
        os.remove(os.path.join(settings.UPLOAD_DIR, 'test_filename.txt'))

    def test_update_attachment_using_save(self):
        " updating attachment is not allowed "
        self.assertRaises(UpdateDeniedException, self.attachment.save)

    def test_export_file(self):
        self.attachment.export_file('/tmp')
        self.failUnless(os.path.isfile('/tmp/test_filename.txt'))
