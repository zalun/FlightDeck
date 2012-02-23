"""
person.management.commands.fix_unicode_users
--------------------------------------------

Fix users with Unicode username saved as nickname in Profile
"""
import commonware

from django.core.management.commands.loaddata import Command as BaseCommand

from person.models import Profile

log = commonware.log.getLogger('f.jetpack')


class Command(BaseCommand):
    def handle(self, *args, **kwargs):
        """Get all :class:`~person.models.Profile` with '?' in nickname and
        update from AMO
        """
        profiles = Profile.objects.filter(nickname__contains='?')
        for profile in profiles:
            self.stdout.write("[%s] Updating nickname: %s (%s)\n" % (
                profile.user.username, profile.nickname, profile.user.email))
            profile.update_from_AMO()
