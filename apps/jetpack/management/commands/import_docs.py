from django.core.management.base import BaseCommand

from jetpack.models import SDK

class Command(BaseCommand):
    """ imports docs for given SDK """

    def handle(self, sdk_dir_name, *args, **options):

        sdk = SDK.objects.get(dir=sdk_dir_name)
        sdk.import_docs()
        print "SDK documentation imported"

