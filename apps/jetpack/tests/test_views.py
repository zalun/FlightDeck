import os
import commonware
import json
import StringIO
import simplejson
import hashlib
from datetime import datetime

from test_utils import TestCase
from nose.tools import eq_
from nose import SkipTest
from mock import patch

#from pyquery import PyQuery as pq

from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from jetpack.models import Package, PackageRevision, Attachment
from jetpack.errors import FilenameExistException
from base.templatetags.base_helpers import hashtag

log = commonware.log.getLogger('f.test')

def next(revision):
    number = revision.revision_number
    return (PackageRevision.objects.filter(revision_number__gt=number,
                                           package=revision.package)
                                   .order_by('-revision_number')[:1])[0]


class TestPackage(TestCase):
    fixtures = ('mozilla_user', 'core_sdk', 'users', 'packages')

    def setUp(self):
        self.hashtag = hashtag()
        self.check_download_url = reverse('jp_check_download_xpi',
                args=[self.hashtag])

    @patch('os.path.isfile')
    def test_package_check_download(self, isfile):
        """
        If we are waiting for the XPI, we'll need to test the redirecty stuff.
        """
        isfile.return_value = False
        r = self.client.get(self.check_download_url)
        eq_(r.status_code, 200)
        eq_(r.content, '{"ready": false}')
        isfile.return_value = True
        r = self.client.get(self.check_download_url)
        eq_(r.status_code, 200)
        eq_(r.content, '{"ready": true}')

    def test_package_browser_no_use(self):
        """If user does not exist raise 404
        """
        r = self.client.get(
                reverse('jp_browser_user_addons', args=['not_a_user']))
        eq_(r.status_code, 404)

    def test_display_deleted_package(self):
        author = User.objects.get(username='john')
        author.set_password('secure')
        author.save()
        user = User.objects.get(username='jan')
        user.set_password('secure')
        user.save()
        addon = Package.objects.create(author=user, type='a')
        lib = Package.objects.create(author=author, type='l')
        addon.latest.dependency_add(lib.latest)
        # logging in the author
        self.client.login(username=author.username, password='secure')
        # deleting lib
        response = self.client.get(reverse('jp_package_delete', args=[lib.id_number]))
        eq_(response.status_code, 200)
        response = self.client.get(lib.get_absolute_url())
        # lib deleted - shouldn't be visible by author
        eq_(response.status_code, 404)
        # logging in the addon owner
        self.client.login(username=user.username, password='secure')
        # addon used lib - its author shouldbe able to see it
        response = self.client.get(lib.get_absolute_url())
        eq_(response.status_code, 200)

    def test_display_disabled_package(self):
        author = User.objects.get(username='john')
        author.set_password('secure')
        author.save()
        user = User.objects.get(username='jan')
        user.set_password('secure')
        user.save()
        lib = Package.objects.create(author=author, type='l')
        # logging in the author
        self.client.login(username=author.username, password='secure')
        # private on
        response = self.client.get(reverse('jp_package_disable', args=[lib.id_number]))
        eq_(response.status_code, 200)
        response = self.client.get(lib.get_absolute_url())
        # lib private - should be visible by author
        eq_(response.status_code, 200)
        # logging in the other user
        self.client.login(username=user.username, password='secure')
        # lib private - shouldn't be visible by others
        response = self.client.get(lib.get_absolute_url())
        eq_(response.status_code, 404)

    def test_display_disabled_package(self):
        author = User.objects.get(username='john')
        author.set_password('secure')
        author.save()
        user = User.objects.get(username='jan')
        user.set_password('secure')
        user.save()
        lib = Package.objects.create(author=author, type='l')
        addon = Package.objects.create(author=user, type='a')
        addon.latest.dependency_add(lib.latest)
        # logging in the author
        self.client.login(username=author.username, password='secure')
        # private on
        response = self.client.get(reverse('jp_package_disable', args=[lib.id_number]))
        eq_(response.status_code, 200)
        # logging in the user
        self.client.login(username=user.username, password='secure')
        # addon depends on lib should be visable
        response = self.client.get(lib.get_absolute_url())
        eq_(response.status_code, 200)
