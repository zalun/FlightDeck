from optparse import make_option, OptionParser

from django.core.management.base import BaseCommand
from jetpack.management import create_SDK, update_SDK
from jetpack.models import SDK


class Command(BaseCommand):
    " adds core lib provided as sdk_dir_name "
    option_list = BaseCommand.option_list + (
            make_option('--options',
                dest="options",
                default=None,
                help="Apply this options to ``cfx xpi`` command"),
            make_option('--useversion',
                dest="version",
                default=None,
                help="Version string to show in Builder"),
            make_option('-i', '--import',
                dest='should_import',
                action='store_true',
                default=False,
                help="Import code to Builder"),
            )

    def handle(self, sdk_dir_name, options=None, version=None,
            should_import=False, *args, **kwargs):
        if SDK.objects.count() > 0:
            update_SDK(sdk_dir_name, options=options, version=version,
                    should_import=should_import)
        else:
            create_SDK(sdk_dir_name, options=options, version=version,
                    should_import=should_import)
        print "SDK instances created"
