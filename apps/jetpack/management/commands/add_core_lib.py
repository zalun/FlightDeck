from optparse import make_option

from django.core.management.base import BaseCommand
from jetpack.management import create_or_update_SDK


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

    def handle(self, sdk_dir_name, *args, **kwargs):
        #try:
        create_or_update_SDK(sdk_dir_name,
                options=kwargs['options'],
                version=kwargs['version'])
        print "SDK instances created"
        #except Exception, (e):
        #    print "Error: %s" % e
