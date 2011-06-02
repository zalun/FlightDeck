"""
person.urls
-----------
"""
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.test import TestCase
from nose.tools import eq_

from person.models import Profile


class ProfileTest(TestCase):

    def setUp(self):
        self.user = User(
            username='jdoe',
            first_name='John',
            last_name='Doe'
        )
        self.user.save()

        self.profile = Profile()
        self.profile.user = self.user
        self.profile.nickname = 'doer'

        self.profile.save()

    def tearDown(self):
        self.profile.delete()
        self.user.delete()

    def test_get_fullname(self):
        self.assertEqual(self.user.get_profile().get_fullname(), 'John Doe')

    def test_public_profile_url(self):
        x_url = reverse('person_public_profile', args=['xxx'])
        with_dash_url = reverse('person_public_profile', args=['abc-cde'])
        eq_(with_dash_url, x_url.replace('xxx', 'abc-cde'))
