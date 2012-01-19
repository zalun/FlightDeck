from optparse import make_option

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
                help="Version string to show in Builder"),)

    def handle(self, sdk_dir_name, options=None, version=None, *args, **kwargs):
        if SDK.objects.count() > 0:
            update_SDK(sdk_dir_name, options=options, version=version)
        else:
            create_SDK(sdk_dir_name, options=options, version=version)
        print "SDK instances created"
