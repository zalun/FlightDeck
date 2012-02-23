# coding=utf-8
"""
person.urls
-----------
"""
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.test import TestCase
from mock import Mock
from nose.tools import eq_
from waffle.models import Switch

from amo.authentication import  AMOAuthentication
from django_browserid import auth
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
        with_underscore_url = reverse('person_public_profile', args=['abc_de'])
        eq_(with_underscore_url, x_url.replace('xxx', 'abc_de'))

    def test_public_utf_profile_url(self):
        user = User.objects.create(username='12345')
        profile = Profile.objects.create(user=user, nickname='ąbc')
        response = self.client.get('/user/ąbc/')
        eq_(response.status_code, 200)

    def test_dashboard_utf(self):
        user = User.objects.create(username='12345')
        profile = Profile.objects.create(user=user, nickname='ąbc')
        user.set_password('secure')
        user.save()
        self.client.login(username=user.username, password='secure')
        response = self.client.get(reverse('person_dashboard'))
        eq_(response.status_code, 200)

    def test_fake_profile(self):
        resp = self.client.get(reverse('person_public_profile', args=['xxx']))
        eq_(404, resp.status_code)


class BrowserIDLoginTest(TestCase):

    TESTEMAIL = 'jdoe@example.com'

    def setUp(self):
        Switch.objects.create(
                name='browserid-login',
                active=True)
        self.user = User.objects.create(
                username='123', email=self.TESTEMAIL)
        Profile.objects.create(user=self.user, nickname='jdoe')

        # Mocking BrowserIDBackend
        class BIDBackend():
            def verify(self, assertion, site):
                return {'email': assertion}
        self.BIDBackend = auth.BrowserIDBackend
        auth.BrowserIDBackend = BIDBackend

    def tearDown(self):
        auth.BrowserIDBackend = self.BIDBackend

    def test_existing_user_login(self):
        AMOAuthentication.auth_browserid_authenticate = Mock(
                return_value={'id': '123'})
        response = self.client.post(reverse('browserid_login'),
                        {'assertion': self.TESTEMAIL})
        eq_(response.status_code, 200)
        assert self.user.is_authenticated()

    def test_user_changed_email_on_AMO(self):
        auth.BrowserIDBackend.verify = Mock(return_value={'email': 'some@example.com'})
        AMOAuthentication.auth_browserid_authenticate = Mock(
                return_value={'id': '123', 'email': 'some@example.com'})
        response = self.client.post(reverse('browserid_login'),
                        {'assertion': 'some-assertion'})
        eq_(response.status_code, 200)
        assert self.user.is_authenticated()
        assert User.objects.filter(email='some@example.com')
        self.assertRaises(User.DoesNotExist,
                User.objects.get, email=self.TESTEMAIL)
