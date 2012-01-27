"""
Managers for the Jetpack models
"""
import datetime
import commonware

from django.db import models
from django.conf import settings

from base.managers import QuerySetManager

log = commonware.log.getLogger('f.jetpack.managers')
#TODO: Add Library and Addon managers and use them inside Package and views

class SDKManager(models.Manager):
    " manager for SDK class "

    def exclude_disabled(self):
        query = self
        for disabled in settings.DISABLED_SDKS:
            query = query.exclude(version=disabled)
        return query.all()

class PackageManager(QuerySetManager):
    " manager for Package object "

    class QuerySet(QuerySetManager.QuerySet):

        def active(self, viewer=None):
            " filter out inactive packages "
            active_q = models.Q(active=True)
            notdeleted_q = models.Q(deleted=False)
            if viewer:
                active_q = active_q | models.Q(author=viewer)
            return self.filter(notdeleted_q).filter(active_q)

        def active_with_deleted(self, viewer=None):
            """Filter out inactive packages, consider owners of packages
            depending on deleted packages
            """
            from jetpack.models import PackageRevision
            active_q = models.Q(active=True)
            notdeleted_q = models.Q(deleted=False)
            if viewer:
                private_q = models.Q(author=viewer)
                active_q = active_q | private_q
                undelete_list = [dep.to_packagerevision.package.pk for dep in \
                        list(PackageRevision.dependencies.through.objects.filter(
                            from_packagerevision__package__author=viewer,
                            to_packagerevision__package__deleted=True))]
                undelete_q = models.Q(pk__in=undelete_list)
                notdeleted_q = notdeleted_q | undelete_q
            return self.filter(notdeleted_q).filter(active_q)

        def active_with_disabled(self, viewer=None):
            """Filter out inactive packages, consider owners of packages
            depending on disabled packages
            """
            from jetpack.models import PackageRevision
            active_q = models.Q(active=True)
            notdeleted_q = models.Q(deleted=False)
            if viewer:
                private_q = models.Q(author=viewer)
                activate_list = [dep.to_packagerevision.package.pk for dep in \
                        list(PackageRevision.dependencies.through.objects.filter(
                            from_packagerevision__package__author=viewer,
                            to_packagerevision__package__active=False))]
                activated_q = models.Q(pk__in=activate_list)
                active_q = active_q | private_q | activated_q
            return self.filter(notdeleted_q).filter(active_q)

        def disabled(self):
            " filter out active packages "
            return self.filter(active=False)

        def addons(self):
            " return addons only "
            return self.filter(type="a")

        def libraries(self):
            " return libraries only "
            return self.filter(type="l")

        def sort_recently_active(self):
            last_month = datetime.datetime.utcnow() - datetime.timedelta(30)
            return self.extra(select={
                'rev_count': 'select count(*) from jetpack_packagerevision '
                             'where jetpack_packagerevision.created_at > \'%s\' '
                             'and jetpack_packagerevision.package_id = jetpack_package.id'
                             % last_month.strftime('%Y-%m-%d')
            }).order_by('-rev_count', *self.model._meta.ordering)
