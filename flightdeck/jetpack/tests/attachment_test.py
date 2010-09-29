import os
from test_utils import TestCase

from django.contrib.auth.models import User

from jetpack import settings
from jetpack.models import Attachment
from jetpack.errors import UpdateDeniedException

class AttachmentTest(TestCase):
    " Testing attachment methods "

    fixtures = ['nozilla', 'core_sdk', 'users', 'packages']


    def setUp(self):
        self.author = User.objects.get(username='john')
        self.attachment = Attachment.objects.create(
            filename='test_filename',
            ext='txt',
            path='pack_rev_path',
            author=self.author
        )
        os.mkdir(os.path.join(settings.UPLOAD_DIR,'pack_rev_path/'))
        os.mkdir(os.path.join(settings.UPLOAD_DIR,'pack_rev_path/test_filename/'))

    def test_update_attachment_using_save(self):
        " updating attachment is not allowed "
        self.assertRaises(UpdateDeniedException, self.attachment.save)


    def test_export_file(self):
        self.attachment.export_file('/tmp')
        self.failUnless(os.path.isfile('/tmp/test_filename.txt'))

