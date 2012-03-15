import hashlib
import commonware

from django.contrib.auth.models import User
from django.utils.encoding import smart_str

from amo.helpers import fetch_amo_user
from person.models import Profile

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
        # check if username exists in database
        try:
            user = User.objects.get(username=username)
            # was user signed up via AMO?
            if user.password != DEFAULT_AMO_PASSWORD:
                # standard authorisation
                if user.check_password(password):
                    try:
                        profile = user.get_profile()
                    except Profile.DoesNotExist:
                        # create empty profile for users stored in FD database
                        profile = Profile(user=user)
                        profile.save()
                    return user
                return None
        except User.DoesNotExist:
            # username does not exist in FD database
            return None
        return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None

    @staticmethod
    def auth_browserid_authenticate(email):
        """
            fetch the user from amo, no password validation, since we're using
            browserid
        """
        return fetch_amo_user(email)


def get_hexdigest(algorithm, salt, raw_password):
    return hashlib.new(algorithm, smart_str(salt + raw_password)).hexdigest()
