"""
Managers for the Profile models
"""
import commonware

from django.core.exceptions import MultipleObjectsReturned, ObjectDoesNotExist
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

        def _get_profile(queries):
            try:
                return self.get(queries[0])

            except ObjectDoesNotExist:
                queries.pop(0)
                if not queries:
                    raise
                # try to find profile by the next query
                return _get_profile(queries)

            except MultipleObjectsReturned:
                profiles = self.filter(queries[0])
                log.debug("User (%s) has %d usernames: %s, attempt %s" % (
                    username, len(profiles),
                    str([(x.user.username, x.nickname) for x in profiles]),
                    _get_profile.index))

                for p in profiles:
                    p.update_from_AMO()

                if _get_profile.index > MAX_GET_PROFILE:
                    log.error(("User (%s) has multiple profiles. "
                        "AMO uids: (%s)") %
                            (username,
                            ', '.join([p.user.username for p in profiles])))
                    raise
                _get_profile.index += 1
                return _get_profile(queries)
            except Exception, error:
                log.critical("Getting profile for user (%s) failed" % username)
                raise

        # a local var of `index` becomes UnboundLocalError due to the
        # `index += 1`. Storing it on an object prevents this error.
        # Bug: https://bugzilla.mozilla.org/show_bug.cgi?id=681098
        # PEP: http://www.python.org/dev/peps/pep-3104/
        _get_profile.index = 0
        # try to get profile in given order
        return _get_profile([by_nick, by_username])


