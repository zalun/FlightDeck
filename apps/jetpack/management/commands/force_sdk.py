"""
jetpack.management.commands.force_sdk
-------------------------------------

Force all addons depending on SDK which version is between given versions
to depend on another SDK
"""
from optparse import make_option

from django.core.management.commands.loaddata import Command as BaseCommand

from django.db import models
from jetpack.models import SDK, PackageRevision

class Command(BaseCommand):
    args = "<target_version from_version to_version>"
    option_list = BaseCommand.option_list + (
            make_option('--purge',
                action='store_true',
                dest='purge',
                default=False,
                help='Delete all SDK except of target version'),
            )

    def handle(self, target_version, from_version=None, to_version=None, *args, **kwargs):
        """Force add-ons to use SDK with version ``target_version``

        :params:
            * target_version (string) Use that target_version
            * from_version (string) Choose add-ons using sdk with higher
              version
            * to_version (string) Choose add-ons using sdk with lower version
            * kwargs['purge'] (boolean) Should all other SDKs be purged
        """
        try:
            sdk = SDK.objects.get(version=target_version)
        except:
            self.stderr.write("ERROR: No such version (%s)\n" % target_version)
            exit(1)

        from_q = to_q = models.Q()
        revisions = PackageRevision.objects.filter(
                package__type='a').exclude(sdk__version=target_version)

        if from_version:
            from_q = models.Q(sdk__version__gt=from_version)
            revisions = revisions.filter(from_q)
        if to_version:
            to_q = models.Q(sdk__version__lt=to_version)
            revisions = revisions.filter(to_q)

        revisions = revisions.all()
        for revision in revisions:
            if revision.sdk != sdk:
                revision.force_sdk(sdk)

        self.stdout.write("%d Revisions switched to SDK %s\n" % (
            len(revisions), target_version))

        if kwargs.get('purge', False):
            oldrevs = PackageRevision.objects.filter(
                    package=sdk.core_lib.package).exclude(
                            version_name=sdk.version)
            oldsdks = SDK.objects.exclude(version=target_version)
            for oldsdk in oldsdks:
                oldsdk.delete(purge=True)
            self.stdout.write("%d SDK(s) removed\n" % len(oldsdks))
