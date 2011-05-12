from django.conf import settings
from django.test import TestCase
from django.contrib.auth import authenticate

from nose import SkipTest

class AuthTest(TestCase):

    def test_failing_login(self):
        # testing failed authentication on AMO
        # this test assumes FlightDeck has access to AMO database
        self.assertEqual(
            None,
            authenticate(
                username='non existing',
                password='user')
            )

    def test_successful_login(self):
        # if settings_local contains AMO user data  check if login is
        # successful
        # assumes that FlightDeck has access to AMO database
        if not (settings.TEST_AMO_USERNAME and settings.TEST_AMO_PASSWORD):
            raise SkipTest()
        assert authenticate(
                username=settings.AMO_USERNAME,
                password=settings.AMO_PASSWORD)
