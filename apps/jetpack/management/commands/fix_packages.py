"""
jetpack.management.commands.fix_packages
----------------------------------------

Fix uniqueness (author, name) and empty latest
"""
import commonware

from django.core.management.commands.loaddata import Command as BaseCommand

from jetpack.models import Package

log = commonware.log.getLogger('f.jetpack')


class Command(BaseCommand):
    def handle(self, *args, **kwargs):
        """Get all packages and try to fix them
        """
        packages = Package.objects.all()
        fixed_uniqueness_count = 0
        fixed_latest_count = 0
        deleted_packages_count = 0
        for package in packages:
            if package.fix_uniqueness():
                fixed_uniqueness_count += 1
            latest = package.fix_latest()
            if latest:
                if latest.pk:
                    fixed_latest_count += 1
                else:
                    deleted_packages_count += 1
        self.stdout.write("""
Finished fixing packages.
%d uniqueness fixed
%d latest revisions fixed
%d packages deleted
""" % (fixed_uniqueness_count, fixed_latest_count, deleted_packages_count))

