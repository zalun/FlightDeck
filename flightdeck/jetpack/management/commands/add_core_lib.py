from django.core.management.base import BaseCommand
from jetpack.management import create_or_update_jetpack_core

class Command(BaseCommand):
    " adds core lib provided as sdk_dir_name "
    def handle(self, sdk_dir_name, *args, **options):
        try:
            create_or_update_jetpack_core(sdk_dir_name)
            print "SDK instances created"
        except Exception, (e):
            print "Error: %s" % e
