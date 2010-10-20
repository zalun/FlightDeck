import os

from test_utils import TestCase as _TestCase

from jetpack import conf

class TestCase(_TestCase):
    """
    Base class for tests depending on existance of lib/jetpack-sdk
    """
    def createCore(self):
        " discover the newest dir and link to it "
        if not hasattr(self, 'sdk_filename'):
            return
        self.sdk_path = os.path.join(conf.FRAMEWORK_PATH, 'lib/jetpack-sdk')
        sdk_orig = os.path.join(conf.FRAMEWORK_PATH, 'lib', self.sdk_filename)
        self.core_link_created = False
        if not os.path.exists(self.sdk_path):
            os.symlink(sdk_orig, self.sdk_path)
            self.core_link_created = True

    def deleteCore(self):
        " remove symlink "
        if not hasattr(self, 'remove_link'):
            return
        if self.core_link_created:
            os.remove(self.sdk_path)


#def create_test_user(username="test_username", password="password",
#                     email="test@example.com"):
#    from django.contrib.auth.models import User
#    from person.models import Profile
#
#    user = User(
#        username=username,
#        password=password,
#        email=email
#    )
#    user.save()
#    Profile(
#        user=user
#    ).save()
#    return user
