"""
Managers for the Profile models
"""
import commonware

from django.db import models

log = commonware.log.getLogger('f.profile.managers')
#TODO: Add Library and Addon managers and use them inside Package and views


class ProfileManager(models.Manager):
    " manager for Person object "

    def get_user_by_username_or_nick(self, username):
        by_username = Q(user__username=username)
        by_nick = Q(nick=username)
        return self.get(by_nick | by_username)

