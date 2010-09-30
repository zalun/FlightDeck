from django.test import TestCase
from django.contrib.auth import authenticate


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
