import os
import json
import StringIO
from datetime import datetime

from test_utils import TestCase
from nose.tools import eq_
from nose import SkipTest
from mock import patch

from pyquery import PyQuery as pq

from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from jetpack.models import PackageRevision, Attachment
from jetpack.errors import FilenameExistException
from jetpack.views import latest_by_uid


def next(revision):
    number = revision.revision_number
    return (PackageRevision.objects.filter(revision_number__gt=number)
                                   .order_by('-revision_number')[:1])[0]


class TestViews(TestCase):
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


class TestAttachments(TestCase):
    fixtures = ['mozilla_user', 'users', 'core_sdk', 'packages']

    def setUp(self):
        if not os.path.exists(settings.UPLOAD_DIR):
            os.makedirs(settings.UPLOAD_DIR)

        self.author = User.objects.get(username='john')
        self.author.set_password('password')
        self.author.save()

        self.package = self.author.packages_originated.addons()[0:1].get()
        self.revision = self.package.revisions.all()[0]

        self.add_url = self.get_add_url(self.revision.revision_number)
        self.change_url = self.get_change_url(self.revision.revision_number)
        self.client.login(username=self.author.username, password='password')

    def test_attachment_error(self):
        res = self.client.post(self.add_url, {})
        eq_(res.status_code, 500)

    def add_one(self):
        self.post(self.add_url, 'foo', 'some.txt')
        return PackageRevision.objects.get(package=self.package,
                                           revision_number=1)

    def get_add_url(self, revision):
        args = [self.package.id_number, revision]
        return reverse('jp_addon_revision_add_attachment', args=args)

    def get_change_url(self, revision):
        args = [self.package.id_number, revision]
        return reverse('jp_addon_revision_save', args=args)

    def get_delete_url(self, revision):
        args = [self.package.id_number, revision]
        return reverse('jp_addon_revision_remove_attachment', args=args)

    def get_revision(self):
        return PackageRevision.objects.get(pk=self.revision.pk)

    def post(self, url, data, filename):
        # A post that matches the JS and uses raw_post_data.
        return self.client.post(url, data,
                                content_type='text/plain',
                                HTTP_X_FILE_NAME=filename)

    def test_attachment_path(self):
        res = self.post(self.add_url, 'foo', 'some.txt')
        eq_(res.status_code, 200)
        revision = PackageRevision.objects.get(package=self.package,
                                               revision_number=1)
        att = revision.attachments.all()[0]
        bits = att.path.split(os.path.sep)
        now = datetime.now()
        eq_(bits[-4:-1], now.strftime('%Y-%m-%d').split('-'))

    def test_attachment_add_read(self):
        res = self.post(self.add_url, 'foo', 'some.txt')
        eq_(res.status_code, 200)

        revision = PackageRevision.objects.get(package=self.package,
                                               revision_number=1)
        eq_(revision.attachments.count(), 1)
        eq_(revision.attachments.all()[0].read(), 'foo')

    def test_attachment_add(self):
        res = self.post(self.add_url, 'foo', 'some.txt')
        eq_(res.status_code, 200)
        json.loads(res.content)

        revision = PackageRevision.objects.get(package=self.package,
                                               revision_number=1)
        eq_(revision.attachments.count(), 1)

    def test_attachment_large(self):
        raise SkipTest()
        # A test for large attachments... really slow things
        # down, so before you remove the above, clean this up
        # or drop down the file size limit.
        temp = StringIO.StringIO()
        for x in range(0, 1024 * 32):
            temp.write("x" * 1024)

        self.post(self.add_url, temp.getvalue(), 'some-big-file.txt')

    def test_attachment_same_fails(self):
        self.test_attachment_add()
        self.assertRaises(FilenameExistException, self.post,
                          self.get_add_url(1), 'foo bar', 'some.txt')

    def test_attachment_revision_count(self):
        revisions = PackageRevision.objects.filter(package=self.package)
        eq_(revisions.count(), 1)
        self.test_attachment_add()
        eq_(revisions.count(), 2)
        # Double check that adding a revision does not create a new version.

    def test_attachment_same_change(self):
        self.test_attachment_add()
        revision = PackageRevision.objects.get(package=self.package,
                                               revision_number=1)
        eq_(revision.attachments.count(), 1)

        data = {revision.attachments.all()[0].get_uid: 'foo bar'}
        res = self.client.post(self.get_change_url(1), data)
        eq_(res.status_code, 200)

        eq_(revision.attachments.all()[0].read(), 'foo')

        revision = PackageRevision.objects.get(package=self.package,
                                               revision_number=2)
        eq_(revision.attachments.count(), 1)
        eq_(revision.attachments.all()[0].read(), 'foo bar')

    def test_attachment_two_files(self):
        revision = self.add_one()
        assert revision.attachments.count(), 1

        self.post(self.add_url, 'foo', 'some-other.txt')
        assert revision.attachments.count(), 2

    def test_attachment_latest(self):
        old = self.add_one()
        old_uid = old.attachments.all()[0].get_uid

        data = {old.attachments.all()[0].get_uid: 'foo bar'}
        self.client.post(self.get_change_url(1), data)

        new = PackageRevision.objects.get(package=self.package,
                                          revision_number=2)
        new_uid = new.attachments.all()[0].get_uid

        eq_(latest_by_uid(old, old_uid).get_uid, new_uid)
        eq_(latest_by_uid(new, old_uid).get_uid, new_uid)
        eq_(latest_by_uid(old, new_uid).get_uid, new_uid)
        eq_(latest_by_uid(new, new_uid).get_uid, new_uid)
        eq_(latest_by_uid(old, 'foofy'), None)

    def test_attachment_old_uid(self):
        revision = self.add_one()

        data = {revision.attachments.all()[0].get_uid: 'foo bar'}
        self.client.post(self.get_change_url(1), data)

        revision = PackageRevision.objects.get(package=self.package,
                                               revision_number=2)
        eq_(revision.attachments.count(), 1)

        # Note here we are still sending the old uid, insted of the
        # newer and fancier one.
        data = {revision.attachments.all()[0].get_uid: 'foo bar two'}
        self.client.post(self.get_change_url(2), data)

        revision = PackageRevision.objects.get(package=self.package,
                                               revision_number=3)
        eq_(revision.attachments.all()[0].read(), 'foo bar two')

        # Check the old data.
        revision = PackageRevision.objects.get(package=self.package,
                                               revision_number=2)
        eq_(revision.attachments.all()[0].read(), 'foo bar')

    def test_attachment_jump_revision(self):
        revision = self.add_one()

        data = {revision.attachments.all()[0].get_uid: 'foo bar'}
        self.client.post(self.get_change_url(1), data)

        data = {revision.attachments.all()[0].get_uid: 'foo bar zero'}
        self.client.post(self.get_change_url(0), data)

        eq_(PackageRevision.objects.filter(package=self.package).count(), 4)
        atts = Attachment.objects.filter(revisions__package=self.package)

        eq_(atts[0].read(), 'foo')
        eq_(atts[1].read(), 'foo bar')
        eq_(atts[2].read(), 'foo bar zero')
        eq_(atts[2].revisions.all()[0].revision_number, 3)

    def test_paths(self):
        revision = self.add_one()

        data = {revision.attachments.all()[0].get_uid: 'foo bar'}
        self.client.post(self.get_change_url(1), data)
        atts = Attachment.objects.filter(revisions__package=self.package)

        assert atts[0].get_file_path().endswith('%s-some.txt' % atts[0].pk)
        assert atts[1].get_file_path().endswith('%s-some.txt' % atts[1].pk)

    def test_attachment_remove(self):
        revision = self.add_one()

        data = {'uid': revision.attachments.all()[0].get_uid}
        self.client.post(self.get_delete_url(1), data)

        revision = PackageRevision.objects.get(package=self.package,
                                               revision_number=2)
        assert not revision.attachments.all().count()

    def test_attachment_remove_old(self):
        revision = self.add_one()

        data = {revision.attachments.all()[0].get_uid: 'foo bar'}
        self.client.post(self.get_change_url(1), data)

        # this is now an old uid
        data = {'uid': revision.attachments.all()[0].get_uid}
        self.client.post(self.get_delete_url(2), data)

        revision = PackageRevision.objects.get(package=self.package,
                                               revision_number=3)
        assert not revision.attachments.all().count()
