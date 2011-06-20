"""
jetpack.management.commands.force_sdk
-------------------------------------

Force all addons depending on SDK which version is between given versions
to depend on another SDK
"""
import commonware

from optparse import make_option

from django.core.management.commands.loaddata import Command as BaseCommand

from django.db import models
from jetpack.models import SDK, PackageRevision

log = commonware.log.getLogger('f.jetpack')


class Command(BaseCommand):
    args = "<target_version from_version to_version>"
    option_list = BaseCommand.option_list + (
            make_option('--purge',
                action='store_true',
                dest='purge',
                default=False,
                help='Delete all SDK except of target version'),
            make_option('--force_purge',
                action='store_true',
                dest='force_purge',
                default=False,
                help="Don't bother about the errors")
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
        log.debug('changing (%d) revisions' % len(revisions))
        failed_revisions = {}
        for revision in revisions:
            if revision.sdk != sdk:
                try:
                    revision.force_sdk(sdk)
                except Exception, err:
                    serr = str(err)
                    if serr not in failed_revisions:
                        failed_revisions[serr] = []
                    failed_revisions[serr].append(revision.get_absolute_url())

        self.stdout.write("%d Revisions switched to SDK %s\n" % (
            len(revisions), target_version))

        if failed_revisions:
            self.stderr.write("There were errors\n")
            for serr, revs in failed_revisions.items():
                self.stderr.write("\n" + serr + "\n")
                for rev in revs:
                    self.stderr.write(rev + "\n")

        if kwargs.get('purge', False):
            if failed_revisions:
                if kwargs.get('force_purge', False):
                    self.stdout('Forcing the purge\n')
                else:
                    self.stderr.write("Couldn't purge due to above errors.\n")
                    return
            oldrevs = PackageRevision.objects.filter(
                    package=sdk.core_lib.package).exclude(
                            version_name=sdk.version)
            oldsdks = SDK.objects.exclude(version=target_version)
            for oldsdk in oldsdks:
                oldsdk.delete(purge=True)
            self.stdout.write("%d SDK(s) removed\n" % len(oldsdks))
