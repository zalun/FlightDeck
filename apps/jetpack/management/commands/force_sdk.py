"""
jetpack.management.commands.force_sdk
-------------------------------------

Force all addons depending on SDK which version is between given versions
to depend on another SDK
"""
import commonware

from optparse import make_option

from django.core.management.commands.loaddata import Command as BaseCommand

from django.core.exceptions import ValidationError, ObjectDoesNotExist
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

    def handle(self, target_version, from_version, *args, **kwargs):
        """Force add-ons to use SDK with version ``target_version``

        :params:
            * target_version (string) Use that target_version
            * from_version (string) Choose add-ons using sdk with higher
              version
        """
        try:
            sdk = SDK.objects.get(version=target_version)
        except ObjectDoesNotExist:
            self.stderr.write("ERROR: No such version (%s)\n" % target_version)
            exit(1)

        revisions = (PackageRevision.objects
                .filter(package__type='a')
                .exclude(sdk__version=str(target_version))
                .filter(sdk__version=str(from_version))).all()

        if revisions:
            log.debug('changing (%d) revisions' % len(revisions))
        failed_revisions = {}
        for revision in revisions:
            if revision.sdk != sdk:
                try:
                    revision.force_sdk(sdk)
                except ValidationError:
                    # forcing the name
                    force_name = "forced %s" % revision.package.id_number
                    log.debug('Forcing the name (%s)' % force_name)
                    revision.package.full_name = force_name
                    revision.full_name = force_name
                    revision.package.save()
                    try:
                        revision.force_sdk(sdk)
                    except Exception, err:
                        # forcing the name not possible
                        log.warning('Revision failed (%s)' % revision)
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
