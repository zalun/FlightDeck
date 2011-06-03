"""
Managers for the Profile models
"""
import commonware

from django.core.exceptions import MultipleObjectsReturned
from django.db import models
from django.db.models import Q

log = commonware.log.getLogger('f.profile.managers')

MAX_GET_PROFILE = 2
class ProfileManager(models.Manager):
    " manager for Person object "

    def get_user_by_username_or_nick(self, username):
        # for local users
        by_username = Q(user__username=username)
        # for AMO users
        by_nick = Q(nickname=username)

        index = 0
        def _get_profile():
            try:
                return self.get(by_nick | by_username)
            except MultipleObjectsReturned:
                profiles = self.filter(by_nick | by_username)

                for p in profiles:
                    p.update_from_AMO()

                if index > MAX_GET_PROFILE:
                    log.error(("User (%s) has multiple profiles. "
                        "AMO uids: (%s)") %
                            (username,
                            ', '.join([p.user.username for p in profiles])))
                    raise
                index += 1
                return _get_profile()

        return _get_profile()


