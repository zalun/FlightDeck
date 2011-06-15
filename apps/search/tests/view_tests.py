from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from nose import SkipTest
from nose.tools import eq_

from jetpack.models import Package
from search.tests import ESTestCase

def create_addon(name):
    return create_package(name, type='a')


def create_library(name):
    return create_package(name, type='l')


def create_package(name, type):
    u = User.objects.get(username='john')
    return Package.objects.create(full_name=name, author=u, type=type)



class TestSearch(ESTestCase):
    fixtures = ('mozilla_user', 'users', 'core_sdk')

    def test_pagenumber_with_weird_characters(self):
        " Should not error if non-int value is passed for the page number "
        url = '%s?q=%s&page=%s' % (reverse('search_by_type', args=['addon']),
                                   'test', '-^')
        
        resp = self.client.get(url)
        
        eq_(200, resp.status_code)
