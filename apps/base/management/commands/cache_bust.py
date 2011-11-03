import os
import time

from django.core.management.base import BaseCommand
from django.conf import settings

class Command(BaseCommand):
    """
    Updates build.py with a new BUILD_ID that can be used for assets.
    """

    def handle(self, *args, **kwargs):
        build_id = hex(int(time.time()))[2:]

        build_id_file = os.path.realpath(os.path.join(settings.ROOT,
                                                      'build.py'))

        with open(build_id_file, 'w') as f:
            f.write('BUILD_ID = "%s"' % build_id)
            f.write('\n')
