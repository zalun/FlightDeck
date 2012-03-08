import hashlib
import commonware
import traceback
import sys

from django.contrib.auth.models import User
from django.core.mail import mail_admins
from django.utils.encoding import smart_str
from django.conf import settings

from amo.helpers import get_amo_cursor
from person.models import Profile
from utils.amo import AMOOAuth

DEFAULT_AMO_PASSWORD = 'saved in AMO'

log = commonware.log.getLogger('f.authentication')


class AMOAuthentication:

    supports_object_permissions = False
    supports_anonymous_user = False
    supports_inactive_user = False

    def authenticate(self, username, password):
        """
            Authenticate user by contacting with AMO
        """

        # TODO: Validate alphanum + .-_@

        # check if username exists in database
        try:
            user = User.objects.get(username=username)
            # was user signed up via AMO?
            if user.password != DEFAULT_AMO_PASSWORD:
                # standard authorisation
                if user.check_password(password):
                    try:
                        profile = user.get_profile()
                    except:
                        # create empty profile for users stored in FD database
                        profile = Profile(user=user)
                        profile.save()
                    return user
                return None
        except User.DoesNotExist:
            # username does not exist in FD database
            user = None

        if not settings.AUTH_DATABASE:
            return None

        # here contact AMO and receive authentication status
        email = username
        username = self.auth_db_authenticate(username, password)

        if not username:
            return None

        # check if user was already signed to FD
        try:
            user = User.objects.get(username=username)
            # update user's email if needed
            if user.email != email:
                user.email = email
                user.save()
        except:
            # save user into the database
            user = User(
                username=username,
                email=email,
                password=DEFAULT_AMO_PASSWORD,
            )
            user.save()

        # Manage profile
        try:
            profile = user.get_profile()
        except Profile.DoesNotExist:
            profile = Profile(user=user)

        profile.update_from_AMO(self.user_data)
        return user

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except:
            return None

    def auth_db_authenticate(self, username, password):
        " authenticate email/password pair in AMO database "

        user_data = AMOAuthentication.fetch_amo_user(username)

        if '$' not in user_data['password']:
            valid = (get_hexdigest('md5', '',
                                   password) == user_data['password'])
        else:
            algo, salt, hsh = user_data['password'].split('$')
            valid = (hsh == get_hexdigest(algo, salt, password))

        if not valid:
            return None

        username = user_data['id']
        self.user_data = user_data
        return username

    @staticmethod
    def auth_browserid_authenticate(email):
        """
            fetch the user from amo, no password validation, since we're using
            browserid
        """
        return AMOAuthentication.fetch_amo_user(email)

    @staticmethod
    def fetch_amo_user(email):
        amo = AMOOAuth(domain=settings.AMOOAUTH_DOMAIN,
                       port=settings.AMOOAUTH_PORT,
                       protocol=settings.AMOOAUTH_PROTOCOL,
                       prefix=settings.AMOOAUTH_PREFIX)
        amo.set_consumer(consumer_key=settings.AMOOAUTH_CONSUMERKEY,
                         consumer_secret=settings.AMOOAUTH_CONSUMERSECRET)
        return amo.get_user_by_email(email) or None


def get_hexdigest(algorithm, salt, raw_password):
    return hashlib.new(algorithm, smart_str(salt + raw_password)).hexdigest()
