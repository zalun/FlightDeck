"""
Managers for the Profile models
"""
import commonware

from django.db import models
from django.db.models import Q


log = commonware.log.getLogger('f.profile.managers')
#TODO: Add Library and Addon managers and use them inside Package and views


class ProfileManager(models.Manager):
    " manager for Person object "

    def get_user_by_username_or_nick(self, username):
        # for local users
        by_username = Q(user__username=username)
        # for AMO users
        by_nick = Q(nickname=username)

        try:
            return self.get(by_nick | by_username)
        except MultipleObjectsReturned:
            profiles = self.filter(by_nick | by_username)
            log.error("User (%s) has multiple profiles. AMO uids: (%s)" %
                    (username, ', '.join([p.user.username for p in profiles])))
            raise


